"""Formatos de entrada e saida.

Regra de ouro deste app, aprendida em projeto anterior a custo alto: **dia de
calendario sai como texto "YYYY-MM-DD"**. Se sair como datetime, o navegador
recebe "2026-08-22T00:00:00Z", exibe 21/08 21:00 no fuso de Brasilia, e a partir
das 21h o app inteiro passa a discordar do calendario. Ver `clock.py`.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .clock import iso_day, to_brt
from .models import User


# ------------------------------------------------------------------ entrada
class LoginIn(BaseModel):
    slug: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=1, max_length=200)


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=6, max_length=200)


class PushSubscribeIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1000)
    p256dh: str = Field(min_length=10, max_length=200)
    auth: str = Field(min_length=4, max_length=100)
    label: str = Field(default="", max_length=60)


class CoupleSettingsIn(BaseModel):
    start_date: str | None = Field(default=None, max_length=10)
    name: str | None = Field(default=None, max_length=60)


# ------------------------------------------------------------------ saida
def moment_iso(value: datetime | None) -> str | None:
    """Instante com o fuso junto — nunca um 'Z' que a tela vai reinterpretar."""
    return to_brt(value).isoformat() if value else None


def user_out(user: User | None, online: bool = False) -> dict | None:
    if user is None:
        return None
    return {
        "id": user.id,
        "slug": user.slug,
        "name": user.name,
        "tracks_cycle": user.tracks_cycle,
        "online": online,
        "last_seen_at": moment_iso(user.last_seen_at),
    }


__all__ = [
    "LoginIn",
    "PasswordChangeIn",
    "PushSubscribeIn",
    "CoupleSettingsIn",
    "user_out",
    "moment_iso",
    "iso_day",
]
