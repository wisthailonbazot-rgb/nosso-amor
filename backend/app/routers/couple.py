from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import media_store, missions, push, settings_store
from ..clock import iso_day, parse_day, today, utcnow
from ..db import get_db
from ..models import ImportantDate, LoveTap, Moment, User
from ..realtime import hub, publish
from ..schemas import moment_iso
from ..security import create_media_token, current_user, partner_of

router = APIRouter(prefix="/api/couple", tags=["casal"])

# Cada toque tem um texto próprio: cinco botões que mandam "te cutucou" não
# valem nada. O nome é o que faz o aviso chegar com significado.
TAPS = {
    "heart": {"label": "Coração", "message": "mandou um coração pra você"},
    "kiss": {"label": "Beijo", "message": "mandou um beijo"},
    "hug": {"label": "Abraço", "message": "está te abraçando daqui"},
    "miss": {"label": "Saudade", "message": "está com saudade de você"},
    "poke": {"label": "Cutucão", "message": "cutucou você"},
    "thinking": {"label": "Pensando", "message": "está pensando em você agora"},
    "come_here": {"label": "Vem pra cá", "message": "quer você bem pertinho"},
    "cuddle": {"label": "Grudinho", "message": "quer ficar de grudinho"},
    "cafune": {"label": "Cafuné", "message": "mandou um cafuné"},
    "sorry": {"label": "Foi mal", "message": "mandou um pedido de desculpas"},
    "safe": {"label": "Amor seguro", "message": "lembrou de cuidar do amor de vocês"},
}

# Intervalo mínimo entre toques do mesmo tipo. Sem isso, o outro leva vinte
# notificações seguidas quando alguém descobre o botão.
TAP_COOLDOWN_SECONDS = 60


class TapIn(BaseModel):
    type: str = Field(max_length=20)


class DateIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    day: str = Field(max_length=10)
    repeat_yearly: bool = True
    reminder_days_before: int = Field(default=3, ge=0, le=60)
    emoji: str = Field(default="", max_length=10)


class CoupleIn(BaseModel):
    start_date: str | None = Field(default=None, max_length=10)
    name: str | None = Field(default=None, max_length=60)


class ProfileIn(BaseModel):
    name: str = Field(min_length=2, max_length=40)


# ------------------------------------------------------------------ toques
@router.get("/taps")
def list_taps(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.query(LoveTap).order_by(LoveTap.created_at.desc()).limit(30).all()
    partner = partner_of(db, user)
    return {
        "kinds": [{"code": code, **info} for code, info in TAPS.items()],
        "items": [
            {
                "id": r.id,
                "type": r.type,
                "label": TAPS.get(r.type, {}).get("label", r.type),
                "sender_id": r.sender_id,
                "mine": r.sender_id == user.id,
                "seen": r.seen_at is not None,
                "created_at": moment_iso(r.created_at),
            }
            for r in rows
        ],
        "partner_online": bool(partner and hub.is_online(partner.id)),
    }


@router.post("/taps")
def send_tap(
    payload: TapIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    if payload.type not in TAPS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Esse toque não existe")

    recent = (
        db.query(LoveTap)
        .filter(LoveTap.sender_id == user.id, LoveTap.type == payload.type)
        .order_by(LoveTap.created_at.desc())
        .first()
    )
    if recent:
        elapsed = (utcnow() - recent.created_at.replace(tzinfo=utcnow().tzinfo)).total_seconds()
        if elapsed < TAP_COOLDOWN_SECONDS:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Espere {int(TAP_COOLDOWN_SECONDS - elapsed)}s pra mandar de novo.",
            )

    tap = LoveTap(sender_id=user.id, type=payload.type)
    db.add(tap)
    db.flush()
    missions.record(db, "love_tap")

    partner = partner_of(db, user)
    info = TAPS[payload.type]
    if partner:
        # o toque aparece na hora pra quem está com o app aberto...
        publish("love_tap", {"type": payload.type, "from": user.id, "label": info["label"]},
                to_user=partner.id)
        # ...e vira notificação pra quem não está
        if not hub.is_online(partner.id):
            push.send_to_user(
                db,
                partner.id,
                title=user.name,
                body=info["message"],
                url="/",
                kind="love_tap",
                tag="love_tap",
            )
    db.commit()
    return {"ok": True, "type": payload.type}


@router.post("/taps/seen")
def mark_taps_seen(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    partner = partner_of(db, user)
    if partner is None:
        return {"ok": True, "marked": 0}
    count = (
        db.query(LoveTap)
        .filter(LoveTap.sender_id == partner.id, LoveTap.seen_at.is_(None))
        .update({LoveTap.seen_at: utcnow()})
    )
    db.commit()
    return {"ok": True, "marked": count}


# ------------------------------------------------------------------ datas
def _next_occurrence(day: date, repeat_yearly: bool, reference: date) -> date | None:
    """Quando essa data acontece de novo.

    Data que se repete todo ano precisa pular pro ano seguinte depois que passa —
    senão "nosso aniversário" fica eternamente no passado e o lembrete nunca mais
    dispara. 29 de fevereiro em ano comum vira 1 de março, pra não sumir.
    """
    if not repeat_yearly:
        return day if day >= reference else None
    year = reference.year
    for candidate_year in (year, year + 1):
        try:
            candidate = day.replace(year=candidate_year)
        except ValueError:
            candidate = date(candidate_year, 3, 1)  # 29/02 em ano não bissexto
        if candidate >= reference:
            return candidate
    return None


@router.get("/dates")
def list_dates(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    reference = today()
    rows = db.query(ImportantDate).all()
    items = []
    for row in rows:
        upcoming = _next_occurrence(row.day, row.repeat_yearly, reference)
        items.append(
            {
                "id": row.id,
                "title": row.title,
                "day": iso_day(row.day),
                "emoji": row.emoji,
                "repeat_yearly": row.repeat_yearly,
                "reminder_days_before": row.reminder_days_before,
                "next": iso_day(upcoming),
                "days_until": (upcoming - reference).days if upcoming else None,
                "years": (upcoming.year - row.day.year) if (upcoming and row.repeat_yearly) else None,
            }
        )
    # o que está mais perto primeiro; o que já passou e não repete, no fim
    items.sort(key=lambda i: (i["days_until"] is None, i["days_until"] or 0))
    return {"items": items, "couple": settings_store.get(db, "couple")}


@router.post("/dates")
def create_date(
    payload: DateIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    day = parse_day(payload.day)
    if day is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data inválida")
    row = ImportantDate(
        title=payload.title.strip(),
        day=day,
        repeat_yearly=payload.repeat_yearly,
        reminder_days_before=payload.reminder_days_before,
        emoji=payload.emoji[:10],
        created_by=user.id,
    )
    db.add(row)
    db.commit()
    publish("dates", {"reason": "created"})
    return {"ok": True, "id": row.id}


@router.delete("/dates/{date_id}")
def delete_date(
    date_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    removed = db.query(ImportantDate).filter(ImportantDate.id == date_id).delete()
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Data não encontrada")
    db.commit()
    publish("dates", {"reason": "deleted"})
    return {"ok": True}


@router.put("/settings")
def update_couple(
    payload: CoupleIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    patch = {}
    if payload.start_date is not None:
        if payload.start_date:
            day = parse_day(payload.start_date)
            if day is None:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data inválida")
            if day > today():
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Vocês não começaram no futuro"
                )
            patch["start_date"] = day.isoformat()
        else:
            patch["start_date"] = ""
    if payload.name is not None:
        patch["name"] = payload.name.strip()[:60]

    result = settings_store.put(db, "couple", patch)
    db.commit()
    publish("couple", result)
    return result


@router.put("/profile")
def update_profile(
    payload: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    """Cada pessoa edita apenas o próprio nome; o personagem fica na rota de avatar."""
    name = " ".join(payload.name.strip().split())
    if len(name) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Digite um nome com pelo menos 2 letras")
    user.name = name
    db.commit()
    publish("profile", {"user_id": user.id, "name": name})
    return {"id": user.id, "name": name, "slug": user.slug}


# ------------------------------------------------------------------ momentos
@router.get("/moments")
def list_moments(
    before: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(Moment)
    if before:
        query = query.filter(Moment.id < before)
    rows = query.order_by(Moment.id.desc()).limit(20).all()
    token = create_media_token(user)
    people = {u.id: u.name for u in db.query(User).all()}
    return {
        "items": [
            {
                "id": r.id,
                "author_id": r.author_id,
                "author_name": people.get(r.author_id, "?"),
                "caption": r.caption,
                "media": f"/media/{r.media_path}?token={token}" if r.media_path else None,
                "thumb": f"/media/{r.media_thumb or r.media_path}?token={token}"
                if r.media_path
                else None,
                "happened_on": iso_day(r.happened_on),
                "reactions": r.reactions or {},
                "created_at": moment_iso(r.created_at),
            }
            for r in rows
        ],
        "has_more": len(rows) == 20,
    }


@router.post("/moments")
def create_moment(
    file: UploadFile | None = File(default=None),
    caption: str = Form(default=""),
    happened_on: str = Form(default=""),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    text = caption.strip()
    if not text and file is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escreva algo ou mande uma foto")

    saved = media_store.save_image(file) if file is not None else {"path": "", "thumb": ""}
    row = Moment(
        author_id=user.id,
        caption=text[:2000],
        media_path=saved["path"],
        media_thumb=saved["thumb"],
        happened_on=parse_day(happened_on) or today(),
        reactions={},
    )
    db.add(row)
    db.flush()

    partner = partner_of(db, user)
    if partner:
        push.send_to_user(
            db,
            partner.id,
            title="Momento novo no mural",
            body=f"{user.name}: {text[:80] or 'mandou uma foto'}",
            url="/momentos",
            kind="momento",
        )
    db.commit()
    publish("moments", {"reason": "created"})
    return {"ok": True, "id": row.id}


@router.post("/moments/{moment_id}/react")
def react_moment(
    moment_id: int,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(Moment, moment_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Momento não encontrado")
    emoji = str((payload or {}).get("reaction", ""))[:8]

    # JSON mutável: sem trocar o dicionário inteiro, o SQLAlchemy não percebe
    reactions = dict(row.reactions or {})
    if emoji:
        reactions[str(user.id)] = emoji
    else:
        reactions.pop(str(user.id), None)
    row.reactions = reactions
    db.commit()
    publish("moments", {"reason": "reaction", "id": moment_id})
    return {"ok": True, "reactions": reactions}


@router.delete("/moments/{moment_id}")
def delete_moment(
    moment_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    row = db.get(Moment, moment_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Momento não encontrado")
    if row.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só dá pra apagar o que você postou")
    media_store.remove(row.media_path, row.media_thumb)
    db.delete(row)
    db.commit()
    publish("moments", {"reason": "deleted"})
    return {"ok": True}
