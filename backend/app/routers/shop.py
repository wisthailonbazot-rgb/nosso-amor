from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import catalog, economy, missions, push
from ..db import get_db
from ..models import InventoryItem, ShopItem, User
from ..realtime import publish
from ..schemas import moment_iso
from ..security import current_user, partner_of

router = APIRouter(prefix="/api/shop", tags=["loja"])

# Quem é o dono do que foi comprado.
#   avatar -> de quem comprou (a roupa é individual)
#   pet e casa -> do casal, `user_id` nulo (os dois usam o mesmo bichinho e a mesma casa)
COUPLE_CATEGORIES = {"pet", "house"}

CATEGORY_LABEL = {"pet": "Bichinho", "avatar": "Avatar", "house": "Casa"}


class BuyIn(BaseModel):
    code: str = Field(min_length=1, max_length=60)
    quantity: int = Field(default=1, ge=1, le=20)


def owner_id_for(category: str, user: User) -> int | None:
    return None if category in COUPLE_CATEGORIES else user.id


def owned_map(db: Session, user: User) -> dict[int, int]:
    """item_id -> quantidade que ESTE usuário pode usar (dele + do casal)."""
    rows = (
        db.query(InventoryItem)
        .filter((InventoryItem.user_id == user.id) | (InventoryItem.user_id.is_(None)))
        .all()
    )
    result: dict[int, int] = {}
    for row in rows:
        result[row.item_id] = result.get(row.item_id, 0) + row.quantity
    return result


def _item_out(item: ShopItem, owned: int) -> dict:
    return {
        "id": item.id,
        "code": item.code,
        "category": item.category,
        "subcategory": item.subcategory,
        "name": item.name,
        "description": item.description,
        "price": item.price,
        "consumable": item.consumable,
        "metadata": item.item_metadata or {},
        "owned": owned,
        # item que não é consumível só faz sentido comprar uma vez
        "can_buy": item.consumable or owned == 0,
    }


@router.get("")
def list_shop(
    category: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(ShopItem).filter(ShopItem.active.is_(True))
    if category:
        query = query.filter(ShopItem.category == category)
    items = query.order_by(ShopItem.sort_order, ShopItem.id).all()
    mine = owned_map(db, user)

    grouped: dict[str, dict[str, list]] = {}
    # Ordem dos grupos = ordem em que apareceram no catalogo, nao alfabetica.
    # Alfabetica coloca "acessorios" antes de "cabelo", o que nao e como ninguem
    # se veste; a ordem do catalogo e a que faz sentido pra quem esta montando o look.
    group_rank: dict[tuple[str, str], int] = {}
    for item in items:
        sub = item.subcategory or "geral"
        grouped.setdefault(item.category, {}).setdefault(sub, []).append(
            _item_out(item, mine.get(item.id, 0))
        )
        group_rank.setdefault((item.category, sub), item.sort_order)

    return {
        "balance": economy.balance(db, user.id),
        "categories": [
            {
                "code": cat,
                "label": CATEGORY_LABEL.get(cat, cat),
                "groups": [
                    {"code": sub, "items": entries}
                    for sub, entries in sorted(
                        subs.items(), key=lambda kv: group_rank[(cat, kv[0])]
                    )
                ],
            }
            for cat, subs in sorted(
                grouped.items(), key=lambda kv: ["avatar", "house", "pet"].index(kv[0])
            )
        ],
    }


@router.get("/inventory")
def inventory(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    rows = (
        db.query(InventoryItem)
        .filter((InventoryItem.user_id == user.id) | (InventoryItem.user_id.is_(None)))
        .all()
    )
    return {
        "items": [
            {
                "item_id": row.item_id,
                "code": row.item.code,
                "name": row.item.name,
                "category": row.item.category,
                "subcategory": row.item.subcategory,
                "metadata": row.item.item_metadata or {},
                "quantity": row.quantity,
                "shared": row.user_id is None,
                "acquired_at": moment_iso(row.acquired_at),
            }
            for row in rows
        ]
    }


@router.post("/buy")
def buy(payload: BuyIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    item = db.query(ShopItem).filter(ShopItem.code == payload.code).first()
    if item is None or not item.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esse item não está à venda")

    owner = owner_id_for(item.category, user)
    existing = (
        db.query(InventoryItem)
        .filter(InventoryItem.item_id == item.id)
        .filter(
            InventoryItem.user_id.is_(None) if owner is None else InventoryItem.user_id == owner
        )
        .first()
    )

    quantity = payload.quantity if item.consumable else 1
    if not item.consumable and existing is not None:
        # comprar de novo uma roupa que já é sua seria só perder moeda
        raise HTTPException(status.HTTP_409_CONFLICT, f"{item.name} já é de vocês.")

    total = item.price * quantity
    # `spend` recusa saldo negativo e já devolve a mensagem certa
    economy.spend(
        db,
        user.id,
        total,
        "purchase",
        reference=item.code,
        note=f"{item.name}{f' x{quantity}' if quantity > 1 else ''}",
    )

    if existing is None:
        db.add(InventoryItem(user_id=owner, item_id=item.id, quantity=quantity))
    else:
        existing.quantity += quantity
    missions.record(db, "shop_buy")

    partner = partner_of(db, user)
    if partner and owner is None:
        push.send_to_user(
            db,
            partner.id,
            title="Compra nova pra nós",
            body=f"{user.name} comprou {item.name}",
            url="/loja",
            kind="loja",
        )
    db.commit()

    new_balance = economy.balance(db, user.id)
    publish("wallet", {"balance": new_balance}, to_user=user.id)
    publish("inventory", {"code": item.code, "category": item.category})
    return {"ok": True, "spent": total, "balance": new_balance, "code": item.code}


def take_from_inventory(db: Session, user: User, item: ShopItem, quantity: int = 1) -> int:
    """Da baixa de um consumivel e devolve quanto sobrou.

    Fica aqui, e nao no modulo do pet, porque quem manda no inventario e a loja —
    assim existe UM lugar que sabe dar baixa, e nao dois que podem discordar.
    NAO faz commit: quem chamou e que decide quando a operacao inteira fecha.
    """
    if not item.consumable:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Esse item não se gasta")

    owner = owner_id_for(item.category, user)
    row = (
        db.query(InventoryItem)
        .filter(InventoryItem.item_id == item.id)
        .filter(
            InventoryItem.user_id.is_(None) if owner is None else InventoryItem.user_id == owner
        )
        .first()
    )
    if row is None or row.quantity < quantity:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Vocês não têm {item.name} suficiente."
        )

    row.quantity -= quantity
    remaining = row.quantity
    if row.quantity <= 0:
        db.delete(row)
    db.flush()
    return max(0, remaining)


def owns(db: Session, user: User, item: ShopItem) -> int:
    """Quantas unidades ESTE usuario pode usar (dele + do casal)."""
    owner = owner_id_for(item.category, user)
    row = (
        db.query(InventoryItem)
        .filter(InventoryItem.item_id == item.id)
        .filter(
            InventoryItem.user_id.is_(None) if owner is None else InventoryItem.user_id == owner
        )
        .first()
    )
    return row.quantity if row else 0


@router.post("/consume")
def consume(payload: BuyIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    item = db.query(ShopItem).filter(ShopItem.code == payload.code).first()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item não encontrado")

    remaining = take_from_inventory(db, user, item, payload.quantity)
    db.commit()
    publish("inventory", {"code": item.code, "category": item.category})
    return {"ok": True, "remaining": remaining}


@router.get("/avatar-options")
def avatar_options(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """O que ESTE usuário pode vestir: o que é de graça + o que ele comprou.

    A tela usa isso pra montar o editor, e o servidor usa a MESMA regra pra validar
    o que foi salvo — as duas leituras saem daqui, então não têm como divergir.
    """
    mine = owned_map(db, user)
    items = (
        db.query(ShopItem)
        .filter(ShopItem.category == "avatar", ShopItem.active.is_(True))
        .order_by(ShopItem.sort_order)
        .all()
    )
    options: dict[str, list] = {slot: list(styles) for slot, styles in catalog.FREE_AVATAR_STYLES.items()}
    catalogue: dict[str, list] = {}
    for item in items:
        meta = item.item_metadata or {}
        slot, style = meta.get("slot"), meta.get("style")
        if not slot or not style:
            continue
        catalogue.setdefault(slot, []).append(
            {"style": style, "name": item.name, "code": item.code, "price": item.price,
             "owned": mine.get(item.id, 0) > 0}
        )
        if mine.get(item.id, 0) > 0:
            options.setdefault(slot, []).append(style)
    return {
        "allowed": options,
        "catalog": catalogue,
        "colors": {
            "skin": catalog.SKIN_TONES,
            "hair": catalog.HAIR_COLORS,
            "eyes": catalog.EYE_COLORS,
        },
        "layers": catalog.AVATAR_LAYERS,
        "defaults": catalog.DEFAULT_AVATAR,
    }
