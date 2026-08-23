from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import cycle_science, push, settings_store
from ..clock import iso_day, parse_day, today
from ..db import get_db
from ..models import CycleDay, CyclePeriod, CyclePrediction, User
from ..realtime import publish
from ..schemas import moment_iso
from ..security import current_user, partner_of

router = APIRouter(prefix="/api/cycle", tags=["ciclo"])

# O que o parceiro enxerga. Quem decide é quem registra, na própria tela de ciclo.
PRIVACY_LEVELS = ("resumo", "completo", "nada")


class PeriodIn(BaseModel):
    start_day: str = Field(max_length=10)
    end_day: str | None = Field(default=None, max_length=10)


class DayIn(BaseModel):
    flow: str | None = None
    symptoms: list[str] | None = None
    mood: str | None = None
    energy: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=2000)


class PrivacyIn(BaseModel):
    share: str


def owner(db: Session) -> User | None:
    """Quem registra ciclo. Sem essa pessoa cadastrada, o módulo não existe."""
    return db.query(User).filter(User.tracks_cycle.is_(True), User.active.is_(True)).first()


def require_owner(user: User = Depends(current_user)) -> User:
    if not user.tracks_cycle:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só quem registra o ciclo pode mudar isso")
    return user


def _analysis(db: Session, person: User) -> dict:
    periods = (
        db.query(CyclePeriod)
        .filter(CyclePeriod.user_id == person.id)
        .order_by(CyclePeriod.start_day)
        .all()
    )
    starts = [p.start_day for p in periods]
    ends = {p.start_day: p.end_day for p in periods if p.end_day}
    return cycle_science.analyze(starts, ends, today())


def _store_prediction(db: Session, person: User, data: dict) -> None:
    """Guarda a previsão pra que o job de lembrete não precise recalcular tudo."""
    row = (
        db.query(CyclePrediction).filter(CyclePrediction.user_id == person.id).first()
    )
    if row is None:
        row = CyclePrediction(user_id=person.id)
        db.add(row)
    row.predicted_next_start = data["predicted_next_start"]
    row.fertile_window_start = data["fertile_start"]
    row.fertile_window_end = data["fertile_end"]
    row.ovulation_day = data["ovulation_day"]
    row.current_phase = data["current_phase"]
    row.cycle_length_avg = data["cycle_length"]
    row.cycle_length_std = data["cycle_variation"]
    row.period_length_avg = data["period_length"]
    row.based_on_cycles = data["cycles_recorded"]
    row.confidence = data["confidence"]
    db.flush()


def _public(data: dict) -> dict:
    """Converte o resultado do cálculo pro formato que o app entende.

    Todo dia de calendário sai como texto — é a regra da casa (ver `clock.py`).
    """
    phase = cycle_science.phase_info(data["current_phase"])
    return {
        "has_data": data["has_data"],
        "cycles_recorded": data["cycles_recorded"],
        "cycle_day": data["cycle_day"],
        "cycle_length": data["cycle_length"],
        "cycle_variation": data["cycle_variation"],
        "period_length": data["period_length"],
        "regular": data["regular"],
        "confidence": data["confidence"],
        "last_period_start": iso_day(data["last_period_start"]),
        "predicted_next_start": iso_day(data["predicted_next_start"]),
        "days_until_next": data["days_until_next"],
        "ovulation_day": iso_day(data["ovulation_day"]),
        "fertile_start": iso_day(data["fertile_start"]),
        "fertile_end": iso_day(data["fertile_end"]),
        "phase": {"code": data["current_phase"], **phase},
        "warnings": data["warnings"],
        "disclaimer": cycle_science.DISCLAIMER,
        "sources": cycle_science.sources_for(data["sources"]),
    }


@router.get("")
def cycle_view(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    person = owner(db)
    if person is None:
        return {"available": False, "reason": "Ninguém está registrando ciclo neste app."}

    privacy = settings_store.get(db, "cycle_privacy")
    is_owner = person.id == user.id

    if not is_owner and privacy["share"] == "nada":
        # some de vez pro parceiro: nem fase, nem previsão
        return {"available": False, "reason": "O ciclo está privado."}

    data = _analysis(db, person)
    if is_owner:
        _store_prediction(db, person, data)
        db.commit()

    view = {
        "available": True,
        "is_owner": is_owner,
        "owner_name": person.name,
        "privacy": privacy["share"],
        **_public(data),
    }

    if is_owner or privacy["share"] == "completo":
        view["today_log"] = _day_out(_find_day(db, person, today()))
    else:
        # visão de resumo: fase, previsão e "como ajudar" — sem sintoma nem nota
        view.pop("warnings", None)
        view["partner_note"] = _partner_note(data)

    view["options"] = {
        "flow": cycle_science.FLOW_LEVELS,
        "symptoms": cycle_science.SYMPTOMS,
        "moods": cycle_science.MOODS,
    }
    return view


def _partner_note(data: dict) -> str:
    """O texto que ele vê. Fala do que dá pra fazer, não do que ela sente."""
    phase = cycle_science.phase_info(data["current_phase"])
    parts = [phase["help"]]
    days = data.get("days_until_next")
    if days is not None and 0 <= days <= 3:
        parts.append(f"A menstruação deve chegar em {days} dia(s).")
    elif days is not None and days < 0:
        parts.append(f"Está {abs(days)} dia(s) depois do previsto.")
    return " ".join(p for p in parts if p)


# ------------------------------------------------------------------ menstruação
@router.post("/period")
def add_period(
    payload: PeriodIn, user: User = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    start = parse_day(payload.start_day)
    end = parse_day(payload.end_day)
    if start is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data de início inválida")
    if start > today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não dá pra registrar no futuro")
    if end and end < start:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "O fim não pode ser antes do início")

    existing = (
        db.query(CyclePeriod)
        .filter(CyclePeriod.user_id == user.id, CyclePeriod.start_day == start)
        .first()
    )
    if existing:
        existing.end_day = end
    else:
        # Sobreposição: registrar um início dentro de uma menstruação que ainda
        # está aberta bagunçaria o cálculo de duração de ciclo pra sempre.
        clash = (
            db.query(CyclePeriod)
            .filter(
                CyclePeriod.user_id == user.id,
                CyclePeriod.start_day <= start,
                CyclePeriod.end_day.is_(None),
            )
            .order_by(CyclePeriod.start_day.desc())
            .first()
        )
        if clash and (start - clash.start_day).days < 10:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Já existe uma menstruação em aberto desde {clash.start_day.isoformat()}. "
                "Feche ela antes de começar outra.",
            )
        db.add(CyclePeriod(user_id=user.id, start_day=start, end_day=end))

    db.flush()
    data = _analysis(db, user)
    _store_prediction(db, user, data)

    partner = partner_of(db, user)
    privacy = settings_store.get(db, "cycle_privacy")
    if partner and privacy["share"] != "nada" and existing is None:
        push.send_to_user(
            db,
            partner.id,
            title="Ciclo atualizado",
            body=f"{user.name} registrou o começo da menstruação.",
            url="/ciclo",
            kind="ciclo",
            dedupe_key=f"cycle-start:{user.id}:{start.isoformat()}",
        )
    db.commit()
    publish("cycle", {"reason": "period"})
    return _public(data)


@router.delete("/period/{start_day}")
def remove_period(
    start_day: str, user: User = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    day = parse_day(start_day)
    removed = (
        db.query(CyclePeriod)
        .filter(CyclePeriod.user_id == user.id, CyclePeriod.start_day == day)
        .delete()
    )
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Não havia registro nesse dia")
    db.flush()
    data = _analysis(db, user)
    _store_prediction(db, user, data)
    db.commit()
    publish("cycle", {"reason": "period"})
    return _public(data)


@router.get("/periods")
def list_periods(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    person = owner(db)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ninguém registra ciclo")
    privacy = settings_store.get(db, "cycle_privacy")
    if person.id != user.id and privacy["share"] == "nada":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "O ciclo está privado")

    rows = (
        db.query(CyclePeriod)
        .filter(CyclePeriod.user_id == person.id)
        .order_by(CyclePeriod.start_day.desc())
        .limit(24)
        .all()
    )
    return {
        "items": [
            {"start_day": iso_day(r.start_day), "end_day": iso_day(r.end_day)} for r in rows
        ]
    }


# ------------------------------------------------------------------ registro do dia
def _find_day(db: Session, person: User, day) -> CycleDay | None:
    return (
        db.query(CycleDay)
        .filter(CycleDay.user_id == person.id, CycleDay.day == day)
        .first()
    )


def _day_out(row: CycleDay | None) -> dict | None:
    if row is None:
        return None
    return {
        "day": iso_day(row.day),
        "flow": row.flow,
        "symptoms": row.symptoms or [],
        "mood": row.mood,
        "energy": row.energy,
        "notes": row.notes,
        "updated_at": moment_iso(row.updated_at),
    }


@router.get("/day/{day}")
def get_day(day: str, user: User = Depends(require_owner), db: Session = Depends(get_db)) -> dict:
    parsed = parse_day(day)
    if parsed is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data inválida")
    return {"day": iso_day(parsed), "log": _day_out(_find_day(db, user, parsed))}


@router.put("/day/{day}")
def save_day(
    day: str,
    payload: DayIn,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> dict:
    parsed = parse_day(day)
    if parsed is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data inválida")
    if parsed > today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não dá pra registrar no futuro")

    valid_flow = {f["code"] for f in cycle_science.FLOW_LEVELS}
    if payload.flow is not None and payload.flow not in valid_flow:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fluxo inválido")
    if payload.symptoms is not None:
        unknown = set(payload.symptoms) - set(cycle_science.SYMPTOMS)
        if unknown:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Sintoma desconhecido: {', '.join(sorted(unknown))}"
            )
    if payload.mood is not None and payload.mood and payload.mood not in cycle_science.MOODS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Humor inválido")

    row = _find_day(db, user, parsed)
    if row is None:
        row = CycleDay(user_id=user.id, day=parsed)
        db.add(row)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None or field in ("mood", "notes"):
            setattr(row, field, value if value is not None else "")
    db.commit()
    publish("cycle", {"reason": "day", "day": iso_day(parsed)})
    return {"ok": True, "log": _day_out(row)}


@router.get("/calendar")
def calendar(
    start: str,
    end: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Os dias entre duas datas, cada um com a fase e o que houver registrado.

    Uma chamada só monta o mês inteiro — o calendário não faz uma requisição por
    dia, que no celular seria lento e caro.
    """
    person = owner(db)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ninguém registra ciclo")
    privacy = settings_store.get(db, "cycle_privacy")
    is_owner = person.id == user.id
    if not is_owner and privacy["share"] == "nada":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "O ciclo está privado")

    from_day = parse_day(start)
    to_day = parse_day(end)
    if from_day is None or to_day is None or to_day < from_day:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Intervalo inválido")
    if (to_day - from_day).days > 400:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Intervalo grande demais")

    periods = (
        db.query(CyclePeriod)
        .filter(CyclePeriod.user_id == person.id)
        .order_by(CyclePeriod.start_day)
        .all()
    )
    data = _analysis(db, person)
    period_days: set = set()
    starts: set = set()
    for row in periods:
        starts.add(row.start_day)
        if row.end_day:
            finish = row.end_day
        else:
            # Menstruação ainda aberta: marca do início até hoje. Marcar só o dia
            # do início faria o calendário discordar da própria tela — que diz
            # "dia 4 do ciclo, fase menstrual" enquanto o mês mostra um dia só.
            # O teto de 10 dias evita pintar meses inteiros quando alguém esquece
            # de registrar o fim.
            finish = min(today(), row.start_day + timedelta(days=10))
        cursor = row.start_day
        while cursor <= finish:
            period_days.add(cursor)
            cursor += timedelta(days=1)

    logs = {}
    if is_owner or privacy["share"] == "completo":
        rows = (
            db.query(CycleDay)
            .filter(CycleDay.user_id == person.id, CycleDay.day >= from_day, CycleDay.day <= to_day)
            .all()
        )
        logs = {r.day: r for r in rows}

    fertile_start = data["fertile_start"]
    fertile_end = data["fertile_end"]
    predicted = data["predicted_next_start"]
    period_length = int(data["period_length"] or 5)

    days = []
    cursor = from_day
    while cursor <= to_day:
        marks = []
        if cursor in period_days:
            marks.append("menstruacao")
        if cursor in starts:
            marks.append("inicio")
        if fertile_start and fertile_start <= cursor <= fertile_end:
            marks.append("fertil")
        if data["ovulation_day"] and cursor == data["ovulation_day"]:
            marks.append("ovulacao")
        if predicted and predicted <= cursor < predicted + timedelta(days=period_length):
            marks.append("previsto")
        log = logs.get(cursor)
        days.append(
            {
                "day": iso_day(cursor),
                "marks": marks,
                "flow": log.flow if log else None,
                "has_log": bool(log and (log.symptoms or log.mood or log.notes)),
            }
        )
        cursor += timedelta(days=1)

    return {"days": days, "is_owner": is_owner, "privacy": privacy["share"]}


# ------------------------------------------------------------------ privacidade
@router.put("/privacy")
def set_privacy(
    payload: PrivacyIn, user: User = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    if payload.share not in PRIVACY_LEVELS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Opção inválida")
    result = settings_store.put(db, "cycle_privacy", {"share": payload.share})
    db.commit()
    publish("cycle", {"reason": "privacy"})
    return result
