from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..clock import utcnow
from ..config import PUSH_ENABLED, VAPID_PUBLIC_KEY
from .. import economy, settings_store
from ..db import get_db
from ..models import User
from ..realtime import hub
from ..schemas import LoginIn, PasswordChangeIn, user_out
from ..security import (
    burn_password_time,
    client_ip,
    create_token,
    current_user,
    hash_password,
    login_throttle,
    partner_of,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/config")
def public_config(db: Session = Depends(get_db)) -> dict:
    """O que a tela de login precisa saber antes de existir sessao.

    Nao expoe nada sensivel: a chave publica do VAPID e publica por definicao, e
    os nomes servem pra tela mostrar os dois botoes de quem esta entrando.
    """
    users = db.query(User).filter(User.active.is_(True)).order_by(User.id).all()
    couple = settings_store.get(db, "couple")
    return {
        "app_name": couple.get("name") or "Nosso app",
        "push_enabled": PUSH_ENABLED,
        "vapid_public_key": VAPID_PUBLIC_KEY,
        "users": [{"slug": u.slug, "name": u.name} for u in users],
    }


@router.post("/auth/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)) -> dict:
    slug = payload.slug.strip().lower()
    keys = [f"slug:{slug}", f"ip:{client_ip(request)}"]
    login_throttle.check(keys)

    user = db.query(User).filter(func.lower(User.slug) == slug).first()
    if user is None or not user.active:
        burn_password_time()  # mesmo tempo de resposta com login que existe e que nao existe
        login_throttle.fail(keys)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login ou senha errados")

    if not verify_password(payload.password, user.password_hash):
        login_throttle.fail(keys)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login ou senha errados")

    login_throttle.reset(keys)
    user.last_seen_at = utcnow()
    economy.wallet_of(db, user.id)  # garante carteira no primeiro login
    db.commit()
    return {"token": create_token(user), "user": user_out(user, online=True)}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    user.last_seen_at = utcnow()
    db.commit()
    partner = partner_of(db, user)
    return {
        "user": user_out(user, online=True),
        "partner": user_out(partner, online=hub.is_online(partner.id) if partner else False),
        "balance": economy.balance(db, user.id),
        "couple": settings_store.get(db, "couple"),
        "cycle_privacy": settings_store.get(db, "cycle_privacy"),
        "push_enabled": PUSH_ENABLED,
        "vapid_public_key": VAPID_PUBLIC_KEY,
    }


@router.post("/auth/password")
def change_password(
    payload: PasswordChangeIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Senha atual errada")
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1  # derruba as sessoes antigas, inclusive esta
    db.commit()
    return {"ok": True, "token": create_token(user)}
