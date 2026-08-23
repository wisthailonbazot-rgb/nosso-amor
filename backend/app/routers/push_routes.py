from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import push
from ..clock import utcnow
from ..config import PUSH_ENABLED, VAPID_PUBLIC_KEY
from ..db import get_db
from ..models import Notification, PushSubscription, User
from ..schemas import PushSubscribeIn, moment_iso
from ..security import current_user

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/status")
def status(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Alimenta a tela de diagnostico do app.

    Existe porque push no iPhone falha de formas silenciosas (app aberto no Safari
    em vez da Tela de Inicio, permissao negada, iOS antigo). A tela mostra em texto
    o que o servidor enxerga daquele aparelho, em vez de deixar voces adivinhando.
    """
    devices = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user.id)
        .order_by(PushSubscription.created_at.desc())
        .all()
    )
    return {
        "push_enabled": PUSH_ENABLED,
        "vapid_public_key": VAPID_PUBLIC_KEY,
        "devices": [
            {
                "id": d.id,
                "label": d.label or "aparelho",
                "user_agent": d.user_agent[:120],
                "failures": d.failures,
                "last_ok_at": moment_iso(d.last_ok_at),
                "created_at": moment_iso(d.created_at),
            }
            for d in devices
        ],
    }


@router.post("/subscribe")
def subscribe(
    payload: PushSubscribeIn,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    agent = request.headers.get("user-agent", "")[:300]
    existing = (
        db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint).first()
    )
    if existing is None:
        existing = PushSubscription(endpoint=payload.endpoint)
        db.add(existing)
    # o mesmo endpoint pode trocar de dono se o outro entrar no mesmo aparelho
    existing.user_id = user.id
    existing.p256dh = payload.p256dh
    existing.auth = payload.auth
    existing.user_agent = agent
    existing.label = payload.label or _guess_label(agent)
    existing.failures = 0
    existing.last_ok_at = utcnow()
    db.commit()
    return {"ok": True, "id": existing.id, "push_enabled": PUSH_ENABLED}


@router.post("/unsubscribe")
def unsubscribe(
    payload: dict, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    endpoint = (payload or {}).get("endpoint", "")
    removed = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == endpoint, PushSubscription.user_id == user.id)
        .delete()
    )
    db.commit()
    return {"ok": True, "removed": removed}


@router.post("/test")
def test_push(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    result = push.send_to_user(
        db,
        user.id,
        title="Testando 1, 2, 3",
        body="Se voce esta lendo isso, a notificacao funciona neste aparelho.",
        url="/perfil",
        kind="teste",
    )
    db.commit()
    return result


def _guess_label(agent: str) -> str:
    lowered = agent.lower()
    if "iphone" in lowered:
        return "iPhone"
    if "ipad" in lowered:
        return "iPad"
    if "android" in lowered:
        return "Android"
    if "windows" in lowered:
        return "PC"
    return "aparelho"


# ------------------------------------------------------------------ avisos
avisos = APIRouter(prefix="/api/notifications", tags=["push"])


@avisos.get("")
def list_notifications(
    user: User = Depends(current_user), db: Session = Depends(get_db), limit: int = 40
) -> dict:
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .count()
    )
    return {
        "unread": unread,
        "items": [
            {
                "id": n.id,
                "kind": n.kind,
                "title": n.title,
                "body": n.body,
                "url": n.url,
                "read": n.read_at is not None,
                "created_at": moment_iso(n.created_at),
            }
            for n in rows
        ],
    }


@avisos.post("/read")
def mark_read(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    now = utcnow()
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .update({Notification.read_at: now})
    )
    db.commit()
    return {"ok": True, "marked": count}
