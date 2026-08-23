from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import economy, missions, settings_store
from ..clock import today
from ..db import get_db
from ..models import DailyStreak, User, WalletTransaction
from ..realtime import publish
from ..schemas import iso_day, moment_iso
from ..security import current_user

router = APIRouter(prefix="/api/wallet", tags=["economia"])

SOURCE_LABEL = {
    "daily_checkin": "Check-in diário",
    "task": "Tarefa",
    "minigame": "Minigame",
    "purchase": "Compra",
    "gift": "Presente",
    "pet": "Bichinho",
    "house": "Casa",
    "admin": "Ajuste",
}


def _streak_of(db: Session, user_id: int) -> DailyStreak:
    streak = db.get(DailyStreak, user_id)
    if streak is None:
        streak = DailyStreak(user_id=user_id, current_streak=0, best_streak=0)
        db.add(streak)
        db.flush()
    return streak


def _checkin_reward(streak_days: int, rules: dict) -> int:
    """Base + bonus por dia de sequencia, com teto.

    O teto existe pra sequencia longa nao virar dinheiro infinito: no dia 400 a
    recompensa e a mesma do dia 30.
    """
    capped = min(streak_days, rules["checkin_streak_cap"])
    return rules["checkin_base"] + capped * rules["checkin_streak_bonus"]


def _streak_view(streak: DailyStreak, day) -> dict:
    """O que a tela precisa saber sobre a sequencia HOJE.

    `current_streak` guardado pode estar velho: se a pessoa faltou ontem, o numero
    no banco ainda e o antigo ate ela abrir o app de novo. Aqui a leitura ja
    considera a falta, entao a tela nunca mostra sequencia que nao existe mais.
    """
    last = streak.last_checkin_day
    if last == day:
        alive, done = streak.current_streak, True
    elif last == day - timedelta(days=1):
        alive, done = streak.current_streak, False
    else:
        alive, done = 0, False
    return {
        "current": alive,
        "best": streak.best_streak,
        "checked_in_today": done,
        "last_day": iso_day(last),
    }


@router.get("")
def wallet_view(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    day = today()
    streak = _streak_of(db, user.id)
    rules = settings_store.get(db, "economy")
    view = _streak_view(streak, day)
    db.commit()
    return {
        "balance": economy.balance(db, user.id),
        "streak": view,
        "next_checkin_reward": _checkin_reward(view["current"] + 1, rules),
    }


@router.post("/checkin")
def checkin(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Check-in do dia. Duas chamadas no mesmo dia pagam uma vez so."""
    day = today()
    streak = _streak_of(db, user.id)
    rules = settings_store.get(db, "economy")

    if streak.last_checkin_day == day:
        db.commit()
        return {
            "already": True,
            "earned": 0,
            "balance": economy.balance(db, user.id),
            "streak": _streak_view(streak, day),
        }

    # Sequencia continua se o ultimo foi ONTEM; qualquer buraco maior recomeca do 1.
    continues = streak.last_checkin_day == day - timedelta(days=1)
    new_streak = streak.current_streak + 1 if continues else 1
    reward = _checkin_reward(new_streak, rules)

    tx = economy.try_earn(
        db,
        user.id,
        reward,
        "daily_checkin",
        reference=day.isoformat(),
        note=f"sequência de {new_streak} dia(s)",
        dedupe_key=f"checkin:{user.id}:{day.isoformat()}",
    )
    if tx is None:
        # O banco ja tinha a linha de hoje (dois toques ao mesmo tempo). Alinha o
        # contador com a realidade e devolve como "ja feito", sem pagar de novo.
        streak.last_checkin_day = day
        db.commit()
        return {
            "already": True,
            "earned": 0,
            "balance": economy.balance(db, user.id),
            "streak": _streak_view(streak, day),
        }

    streak.current_streak = new_streak
    streak.best_streak = max(streak.best_streak, new_streak)
    streak.last_checkin_day = day
    missions.record(db, "checkin")
    db.commit()

    new_balance = economy.balance(db, user.id)
    publish("wallet", {"balance": new_balance}, to_user=user.id)
    return {
        "already": False,
        "earned": reward,
        "balance": new_balance,
        "streak": _streak_view(streak, day),
    }


@router.get("/history")
def history(
    user: User = Depends(current_user), db: Session = Depends(get_db), limit: int = 50
) -> dict:
    rows = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == user.id)
        .order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
        .limit(min(limit, 200))
        .all()
    )
    return {
        "balance": economy.balance(db, user.id),
        "audit": economy.audit(db, user.id),
        "items": [
            {
                "id": r.id,
                "amount": r.amount,
                "direction": r.direction,
                "source": r.source,
                "source_label": SOURCE_LABEL.get(r.source, r.source),
                "note": r.note,
                "balance_after": r.balance_after,
                "created_at": moment_iso(r.created_at),
            }
            for r in rows
        ],
    }
