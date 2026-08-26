from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import catalog
from ..db import get_db
from ..models import Avatar, InventoryItem, ShopItem, User
from ..realtime import publish
from ..schemas import moment_iso
from ..security import current_user, partner_of
from .shop import owned_map

router = APIRouter(prefix="/api/avatar", tags=["avatar"])

# Campos que guardam ESTILO e precisam de posse. Cor é livre: cor não se compra.
STYLE_SLOTS = {
    "hair_style": "hair",
    "top": "top",
    "bottom": "bottom",
    "shoes": "shoes",
    "head": "head",
    "extra": "extra",
}
COLOR_FIELDS = {
    "skin": "skin",
    "hair_color": "hair",
    "eye_color": "eyes",
    "top_color": None,
    "bottom_color": None,
    "shoes_color": None,
}
# Escolhas livres: nao custam nada e nao passam pela posse, porque nao sao
# roupa — sao tracos da pessoa.
FACE_FIELDS = {
    "eyes": ["redondo", "amendoado", "fechado", "sonolento", "animado"],
    "mouth": ["sorriso", "serio", "risada", "bico", "lingua"],
    "brows": ["reta", "arqueada", "grossa", "fina"],
    "corpo": ["reto", "curvas"],
}


class AvatarIn(BaseModel):
    config: dict


def _allowed_styles(db: Session, user: User) -> dict[str, set[str]]:
    """Estilos que este usuário pode vestir: os de graça + os que ele comprou."""
    allowed = {slot: set(styles) for slot, styles in catalog.FREE_AVATAR_STYLES.items()}
    mine = owned_map(db, user)
    items = db.query(ShopItem).filter(ShopItem.category == "avatar").all()
    for item in items:
        if mine.get(item.id, 0) <= 0:
            continue
        meta = item.item_metadata or {}
        if meta.get("slot") and meta.get("style"):
            allowed.setdefault(meta["slot"], set()).add(meta["style"])
    # "nada nesse lugar" é sempre permitido (tirar o boné, ficar sem colar)
    for slot in STYLE_SLOTS.values():
        allowed.setdefault(slot, set()).add("")
    return allowed


def sanitize(db: Session, user: User, incoming: dict) -> dict:
    """Monta a configuração final a partir do padrão + o que veio, validando tudo.

    Esta função é a trava da economia do avatar. Sem ela, bastaria mandar
    `{"top": "jaqueta"}` pra vestir uma peça de 240 corações sem pagar — a tela
    esconde o botão, mas esconder botão não é segurança.
    """
    allowed = _allowed_styles(db, user)
    config = dict(catalog.DEFAULT_AVATAR)

    for field, slot in STYLE_SLOTS.items():
        if field not in incoming:
            continue
        value = str(incoming[field] or "")
        if value not in allowed.get(slot, set()):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Você ainda não tem isso pra vestir ({slot}: {value or 'vazio'}).",
            )
        config[field] = value

    for field, palette_name in COLOR_FIELDS.items():
        if field not in incoming:
            continue
        value = str(incoming[field] or "")
        if not _is_hex(value):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cor inválida em {field}")
        if palette_name:
            palette = {
                "skin": catalog.SKIN_TONES,
                "hair": catalog.HAIR_COLORS,
                "eyes": catalog.EYE_COLORS,
            }[palette_name]
            if value not in palette:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cor fora da paleta em {field}")
        config[field] = value

    for field, choices in FACE_FIELDS.items():
        if field not in incoming:
            continue
        value = str(incoming[field] or "")
        if value not in choices:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Opção inválida em {field}")
        config[field] = value

    if "blush" in incoming:
        config["blush"] = bool(incoming["blush"])
    return config


def _is_hex(value: str) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 7
        and value[0] == "#"
        and all(c in "0123456789abcdefABCDEF" for c in value[1:])
    )


def avatar_of(db: Session, user_id: int) -> Avatar:
    row = db.get(Avatar, user_id)
    if row is None:
        row = Avatar(user_id=user_id, config=dict(catalog.DEFAULT_AVATAR))
        db.add(row)
        db.flush()
    return row


@router.get("")
def my_avatar(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    mine = avatar_of(db, user.id)
    partner = partner_of(db, user)
    partner_avatar = avatar_of(db, partner.id) if partner else None
    db.commit()
    return {
        "config": mine.config or dict(catalog.DEFAULT_AVATAR),
        "updated_at": moment_iso(mine.updated_at),
        "partner": {
            "name": partner.name,
            "config": partner_avatar.config or dict(catalog.DEFAULT_AVATAR),
        }
        if partner
        else None,
    }


@router.put("")
def save_avatar(
    payload: AvatarIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    config = sanitize(db, user, payload.config or {})
    row = avatar_of(db, user.id)
    row.config = config
    db.commit()
    publish("avatar", {"user_id": user.id, "config": config})
    return {"ok": True, "config": config}
