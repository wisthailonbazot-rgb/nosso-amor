"""A casa: planta com varios comodos, editor e o quintal.

Tres coisas aqui merecem atencao, porque sao onde este modulo pode estragar
progressao em silencio:

1. **O tamanho e a forma do movel vem do CATALOGO, nunca do app.** Se a tela
   pudesse mandar `w` e `d`, um sofa de 3x1 chegaria como 1x1 e caberia em
   qualquer buraco — e a partir dai a casa aceitaria arranjo impossivel.

2. **Cada movel comprado pode estar em um lugar so.** Movel nao e consumivel:
   quem comprou um sofa tem UM sofa. Sem essa conta, copiar o item na lista
   antes de salvar encheria a casa de sofas de graca. E a mesma ideia do
   "esconder o botao nao e seguranca" que ja vale pro avatar.

3. **`revision` e o que impede um apagar o arranjo do outro.** Os dois mexem na
   casa ao mesmo tempo; quem salvar com revisao velha leva 409 e recarrega, em
   vez de sobrescrever calado.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import catalog, economy, missions, pet_care, push
from ..clock import utcnow
from ..db import get_db
from ..models import InventoryItem, Room, RoomLayout, ShopItem, User
from ..realtime import publish
from ..schemas import moment_iso
from ..security import current_user, partner_of
from .pet import get_pet

router = APIRouter(prefix="/api/house", tags=["casa"])

DEFAULT_FLOOR = {"indoor": "padrao", "outdoor": "grama"}
DEFAULT_WALL = "padrao"

# Onde cada tipo de coisa pode ficar. Rede e churrasqueira dentro do quarto — e
# geladeira no meio do quintal — seriam engracado uma vez e chato pra sempre.
OUTDOOR_ONLY = {"quintal"}
INDOOR_ONLY = {"moveis", "decoracao", "eletronicos", "bichinho"}


class ItemIn(BaseModel):
    """O que a tela manda por movel. Repare no que NAO esta aqui: `w`, `d` e
    `shape`. Essas tres o servidor busca no catalogo."""

    code: str = Field(min_length=1, max_length=60)
    col: int = Field(ge=0, le=63)
    row: int = Field(ge=0, le=63)
    dir: int = Field(default=0, ge=0, le=3)


class LayoutIn(BaseModel):
    revision: int = Field(ge=0)
    floor: str = Field(default="", max_length=30)
    wall: str = Field(default="", max_length=30)
    items: list[ItemIn] = Field(default_factory=list, max_length=120)


# ------------------------------------------------------------------ inventario
def _house_items(db: Session) -> dict[str, ShopItem]:
    rows = db.query(ShopItem).filter(ShopItem.category == "house").all()
    return {row.code: row for row in rows}


def _owned_counts(db: Session) -> dict[str, int]:
    """Quantas unidades de cada item de casa o casal tem. Casa e do casal: o
    `user_id` nulo do inventario e o que faz os dois decorarem a mesma sala."""
    rows = (
        db.query(InventoryItem)
        .join(ShopItem, ShopItem.id == InventoryItem.item_id)
        .filter(ShopItem.category == "house", InventoryItem.user_id.is_(None))
        .all()
    )
    return {row.item.code: row.quantity for row in rows}


def _styles_owned(db: Session, kind: str) -> list[str]:
    """Estilos de piso/parede que ja foram comprados, mais o que vem de graca."""
    free = [DEFAULT_FLOOR["indoor"], DEFAULT_FLOOR["outdoor"]] if kind == "floor" else [DEFAULT_WALL]
    owned = set(_owned_counts(db))
    styles = list(dict.fromkeys(free))
    for code, item in _house_items(db).items():
        shape = (item.item_metadata or {}).get("shape", "")
        if shape.startswith(f"{kind}:") and code in owned:
            style = shape.split(":", 1)[1]
            if style not in styles:
                styles.append(style)
    return styles


def _placeable(db: Session) -> dict[str, dict]:
    """Moveis que dao pra posicionar (exclui piso e parede, que sao acabamento)."""
    out = {}
    for code, item in _house_items(db).items():
        meta = item.item_metadata or {}
        shape = meta.get("shape", "")
        if ":" in shape:
            continue  # piso/parede nao se posiciona
        out[code] = {
            "code": code,
            "name": item.name,
            "subcategory": item.subcategory,
            "shape": shape,
            "w": int(meta.get("width", 1)) or 1,
            "d": int(meta.get("height", 1)) or 1,
        }
    return out


# ------------------------------------------------------------------ leitura
def _layout_of(db: Session, room: Room) -> RoomLayout:
    layout = db.query(RoomLayout).filter(RoomLayout.room_id == room.id).first()
    if layout is None:
        layout = RoomLayout(
            room_id=room.id,
            grid_data={
                "floor": DEFAULT_FLOOR["outdoor" if room.outdoor else "indoor"],
                "wall": DEFAULT_WALL,
                "items": [],
            },
            revision=1,
        )
        db.add(layout)
        db.flush()
    return layout


def _room_out(db: Session, room: Room, mess_by_room: dict[int, list]) -> dict:
    layout = _layout_of(db, room)
    data = layout.grid_data or {}
    return {
        "code": room.code,
        "name": room.name,
        "x": room.plan_x,
        "y": room.plan_y,
        "w": room.width,
        "h": room.height,
        "outdoor": bool(room.outdoor),
        "unlocked": bool(room.unlocked),
        "unlock_price": room.unlock_price,
        "revision": layout.revision,
        "floor": data.get("floor") or DEFAULT_FLOOR["outdoor" if room.outdoor else "indoor"],
        "wall": data.get("wall") or DEFAULT_WALL,
        "items": data.get("items", []),
        "mess": mess_by_room.get(room.id, []),
        "updated_at": moment_iso(layout.updated_at),
    }


@router.get("")
def read(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    # O bichinho envelhece mesmo quando quem abriu foi a tela da casa: e aqui
    # que a sujeira dele aparece, entao ela precisa estar em dia.
    pet = get_pet(db)
    # todos envelhecem, nao so o que esta na tela (ver `pet_care.decay_all`)
    pet_care.decay_all(db)
    db.commit()

    mess_by_room: dict[int, list] = {}
    for m in pet_care.pending_mess(db):
        mess_by_room.setdefault(m.room_id, []).append(
            {"id": m.id, "col": m.col, "row": m.row, "kind": m.kind}
        )

    rooms = db.query(Room).order_by(Room.sort_order, Room.id).all()
    counts = _owned_counts(db)
    placeable = _placeable(db)
    placed: dict[str, int] = {}
    for room in rooms:
        for entry in (_layout_of(db, room).grid_data or {}).get("items", []):
            placed[entry["code"]] = placed.get(entry["code"], 0) + 1
    return {
        "rooms": [_room_out(db, room, mess_by_room) for room in rooms],
        "doors": catalog.DOORS,
        "balance": economy.balance(db, user.id),
        "floors": _styles_owned(db, "floor"),
        "walls": _styles_owned(db, "wall"),
        "catalog": [
            {**spec, "owned": counts.get(code, 0), "placed": placed.get(code, 0)}
            for code, spec in sorted(placeable.items())
            if counts.get(code, 0) > 0
        ],
        "pet": {
            "chosen": bool(pet.species),
            "species": pet.species,
            "name": pet.name,
            "room_code": pet.room_code or "sala",
            "mood": pet_care.mood_of(pet, sum(len(v) for v in mess_by_room.values())),
            "stage": pet_care.stage_for(pet_care.level_for(int(pet.xp or 0))),
            "growth": pet_care.growth_of(int(pet.xp or 0)),
            "accessories": pet.accessories or {},
            "colors": (catalog.PET_SPECIES_BY_CODE.get(pet.species) or {}).get("colors", []),
            "sick": bool(pet.sick),
            "mess_count": sum(len(v) for v in mess_by_room.values()),
        },
    }


# ------------------------------------------------------------------ escrita
@router.post("/room/{code}/unlock")
def unlock(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    room = db.query(Room).filter(Room.code == code).first()
    if room is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esse cômodo não existe")
    if room.unlocked:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{room.name} já está aberto")

    economy.spend(
        db, user.id, room.unlock_price, "purchase", reference=f"room:{room.code}",
        note=f"Abriu {room.name}",
    )
    room.unlocked = True
    room.unlocked_at = utcnow()
    _layout_of(db, room)

    partner = partner_of(db, user)
    if partner:
        push.send_to_user(
            db, partner.id, title="Cômodo novo!",
            body=f"{user.name} abriu {room.name}", url="/casa", kind="casa",
        )
    db.commit()
    balance = economy.balance(db, user.id)
    publish("wallet", {"balance": balance}, to_user=user.id)
    publish("house", {"reason": "unlock", "room": room.code})
    return {"ok": True, "balance": balance, "room": room.code}


@router.put("/room/{code}/layout")
def save_layout(
    code: str,
    payload: LayoutIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    room = db.query(Room).filter(Room.code == code).first()
    if room is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esse cômodo não existe")
    if not room.unlocked:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{room.name} ainda está trancado")

    layout = _layout_of(db, room)
    if payload.revision != layout.revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Alguém mexeu na casa enquanto você arrumava. Abra de novo pra ver como ficou.",
        )

    floor = payload.floor or DEFAULT_FLOOR["outdoor" if room.outdoor else "indoor"]
    wall = payload.wall or DEFAULT_WALL
    if floor not in _styles_owned(db, "floor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esse piso não é de vocês")
    if wall not in _styles_owned(db, "wall"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Essa parede não é de vocês")

    placeable = _placeable(db)
    owned = _owned_counts(db)
    # Quantos de cada item ja estao nos OUTROS comodos: o limite de "um movel,
    # um lugar" vale na casa inteira, nao por comodo.
    used_elsewhere: dict[str, int] = {}
    for other in db.query(Room).filter(Room.id != room.id).all():
        for item in ((db.query(RoomLayout).filter(RoomLayout.room_id == other.id).first() or RoomLayout()).grid_data or {}).get("items", []):
            used_elsewhere[item["code"]] = used_elsewhere.get(item["code"], 0) + 1

    dirty = {(m.col, m.row) for m in pet_care.pending_mess(db, room.id)}
    taken: dict[tuple[int, int], str] = {}
    here: dict[str, int] = {}
    saved = []

    for index, entry in enumerate(payload.items):
        spec = placeable.get(entry.code)
        if spec is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Item desconhecido: {entry.code}")
        if room.outdoor and spec["subcategory"] in INDOOR_ONLY:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"{spec['name']} não fica bem no quintal"
            )
        if not room.outdoor and spec["subcategory"] in OUTDOOR_ONLY:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"{spec['name']} é coisa de área externa"
            )

        here[entry.code] = here.get(entry.code, 0) + 1
        total = here[entry.code] + used_elsewhere.get(entry.code, 0)
        if total > owned.get(entry.code, 0):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Vocês só têm {owned.get(entry.code, 0)} de {spec['name']}.",
            )

        # Girar 90 graus troca largura por profundidade — a mesma regra do
        # desenho, senao a conferencia do servidor e a da tela discordariam.
        w, d = (spec["d"], spec["w"]) if entry.dir % 2 == 1 else (spec["w"], spec["d"])
        if entry.col + w > room.width or entry.row + d > room.height:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"{spec['name']} não cabe aí — passa da parede."
            )

        for r in range(entry.row, entry.row + d):
            for c in range(entry.col, entry.col + w):
                if (c, r) in taken:
                    raise HTTPException(
                        status.HTTP_400_BAD_REQUEST,
                        f"{spec['name']} está em cima de {placeable[taken[(c, r)]]['name']}.",
                    )
                if (c, r) in dirty:
                    raise HTTPException(
                        status.HTTP_400_BAD_REQUEST,
                        "Tem sujeira do bichinho aí. Limpa primeiro.",
                    )
                taken[(c, r)] = entry.code

        saved.append(
            {
                "id": index + 1,
                "code": entry.code,
                "shape": spec["shape"],
                "col": entry.col,
                "row": entry.row,
                "w": w,
                "d": d,
                "dir": entry.dir,
            }
        )

    layout.grid_data = {"floor": floor, "wall": wall, "items": saved}
    layout.revision += 1
    layout.updated_by = user.id
    missions.record(db, "house_save")
    db.commit()

    mess_by_room: dict[int, list] = {}
    for m in pet_care.pending_mess(db, room.id):
        mess_by_room.setdefault(m.room_id, []).append(
            {"id": m.id, "col": m.col, "row": m.row, "kind": m.kind}
        )
    body = _room_out(db, room, mess_by_room)
    # Tempo real: o outro ve o movel andar enquanto voce arrasta e solta.
    publish("house", {"reason": "layout", "room": body})
    return {"ok": True, "room": body}
