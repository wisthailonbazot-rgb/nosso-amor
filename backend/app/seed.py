"""O que precisa existir pro app funcionar no primeiro boot.

Tudo aqui e idempotente: roda a cada subida do container sem duplicar nada e sem
sobrescrever o que voces dois ja mexeram. Em particular:

  - senha existente NUNCA e trocada por variavel de ambiente (senao trocar a senha
    no app seria desfeito no proximo deploy);
  - item de loja e atualizado por `code` (preco/nome podem mudar), mas o que voces
    ja compraram fica no inventario de qualquer jeito;
  - comodo ja desbloqueado nao volta a ser bloqueado.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from . import catalog, economy, settings_store
from .clock import parse_day
from .config import (
    COUPLE_START_DATE,
    CYCLE_OWNER_SLUG,
    INITIAL_COINS,
    USER_A_NAME,
    USER_A_PASSWORD,
    USER_A_SLUG,
    USER_B_NAME,
    USER_B_PASSWORD,
    USER_B_SLUG,
)
from .models import Avatar, InventoryItem, Pet, QuizQuestion, Room, RoomLayout, ShopItem, User, Wallet, WalletTransaction
from .security import hash_password


def _ensure_user(db: Session, slug: str, name: str, password: str) -> User | None:
    if not (slug and password):
        return None
    user = db.query(User).filter(User.slug == slug).first()
    if user is None:
        user = User(
            slug=slug,
            name=name or slug.capitalize(),
            password_hash=hash_password(password),
            tracks_cycle=(slug == CYCLE_OWNER_SLUG),
        )
        db.add(user)
        db.flush()
        print(f"[boot] usuario criado: {slug}")
    else:
        # nome e "quem registra ciclo" podem ser corrigidos por variavel; senha nao.
        if name and user.name != name:
            user.name = name
        if CYCLE_OWNER_SLUG:
            user.tracks_cycle = user.slug == CYCLE_OWNER_SLUG

    if db.get(Wallet, user.id) is None:
        db.add(Wallet(user_id=user.id, balance=0))
        db.flush()
    if INITIAL_COINS and not db.query(WalletTransaction).filter(WalletTransaction.user_id == user.id).first():
        economy.try_earn(
            db, user.id, INITIAL_COINS, "admin", note="saldo inicial",
            dedupe_key=f"initial-coins:{user.id}",
        )
    if db.get(Avatar, user.id) is None:
        db.add(Avatar(user_id=user.id, config=dict(catalog.DEFAULT_AVATAR)))
    db.flush()
    return user


def _ensure_rooms(db: Session) -> None:
    for order, spec in enumerate(catalog.ROOMS):
        room = db.query(Room).filter(Room.code == spec["code"]).first()
        if room is None:
            room = Room(
                code=spec["code"],
                name=spec["name"],
                width=spec["width"],
                height=spec["height"],
                unlock_price=spec["unlock_price"],
                unlocked=spec["unlock_price"] == 0,
                sort_order=order,
            )
            db.add(room)
        else:
            room.name = spec["name"]
            room.unlock_price = spec["unlock_price"]
            room.sort_order = order
            # tamanho vem do catalogo: mudar a planta nao pode exigir migracao
            room.width = spec["width"]
            room.height = spec["height"]
        room.plan_x = spec.get("x", 0)
        room.plan_y = spec.get("y", 0)
        room.outdoor = bool(spec.get("outdoor", False))
        # comodo ja aberto continua aberto, mesmo que o preco mude no catalogo
        if spec["unlock_price"] == 0:
            room.unlocked = True
    db.flush()


def _ensure_shop(db: Session) -> None:
    existing = {i.code: i for i in db.query(ShopItem).all()}
    seen: set[str] = set()
    for order, spec in enumerate(catalog.SHOP_ITEMS):
        seen.add(spec["code"])
        item = existing.get(spec["code"])
        if item is None:
            item = ShopItem(code=spec["code"])
            db.add(item)
        item.category = spec["category"]
        item.subcategory = spec.get("subcategory", "")
        item.name = spec["name"]
        item.description = spec.get("description", "")
        item.price = spec["price"]
        item.asset_ref = spec.get("asset_ref", "")
        item.item_metadata = spec.get("metadata", {})
        item.consumable = spec.get("consumable", False)
        item.sort_order = order
        item.active = True
    # item que saiu do catalogo some da loja, mas continua no inventario de quem comprou
    for code, item in existing.items():
        if code not in seen:
            item.active = False
    db.flush()


def _ensure_quiz(db: Session) -> None:
    have = {q.text for q in db.query(QuizQuestion).all()}
    for spec in catalog.QUIZ_QUESTIONS:
        if spec["text"] not in have:
            db.add(QuizQuestion(text=spec["text"], category=spec.get("category", "geral")))
    db.flush()


def _ensure_pet(db: Session) -> None:
    if db.query(Pet).first() is None:
        # nasce sem especie: a primeira tela do pet pede pra voces dois escolherem
        db.add(Pet(id=1, name="", species="", appearance_config={}))
        db.flush()


def _ensure_starter_room(db: Session) -> None:
    room=db.query(Room).filter(Room.code=="sala").first()
    if room is None or db.query(RoomLayout).filter(RoomLayout.room_id==room.id).first():
        return
    codes=["house_sofa","house_mesa","house_caminha_pet","house_comedouro"]
    items={i.code:i for i in db.query(ShopItem).filter(ShopItem.code.in_(codes)).all()}
    positions={"house_sofa":(1,1),"house_mesa":(5,2),"house_caminha_pet":(1,5),"house_comedouro":(4,6)}
    saved=[]
    for index,code in enumerate(codes):
        item=items.get(code)
        if not item: continue
        if not db.query(InventoryItem).filter(InventoryItem.user_id.is_(None),InventoryItem.item_id==item.id).first():
            db.add(InventoryItem(user_id=None,item_id=item.id,quantity=1))
        meta=item.item_metadata or {};col,row=positions[code]
        saved.append({"id":index+1,"code":code,"shape":meta["shape"],"col":col,"row":row,"w":meta["width"],"d":meta["height"],"dir":0})
    db.add(RoomLayout(room_id=room.id,revision=1,grid_data={"floor":"padrao","wall":"padrao","items":saved}))
    db.flush()


def run(db: Session) -> None:
    _ensure_user(db, USER_A_SLUG, USER_A_NAME, USER_A_PASSWORD)
    _ensure_user(db, USER_B_SLUG, USER_B_NAME, USER_B_PASSWORD)
    _ensure_rooms(db)
    _ensure_shop(db)
    _ensure_starter_room(db)
    _ensure_quiz(db)
    _ensure_pet(db)

    couple = settings_store.get(db, "couple")
    if COUPLE_START_DATE and not couple.get("start_date"):
        # `parse_day` devolve None em vez de estourar, entao a conferencia e aqui:
        # variavel de ambiente escrita errada tem que aparecer no log do boot, nao
        # virar um contador de dias silenciosamente vazio.
        parsed = parse_day(COUPLE_START_DATE)
        if parsed is None:
            print(f"[boot] COUPLE_START_DATE invalida ({COUPLE_START_DATE!r}); ignorada")
        else:
            settings_store.put(db, "couple", {"start_date": parsed.isoformat()})

    db.commit()
