"""O bichinho.

As regras de fome, sujeira e evolucao NAO moram aqui: moram em `pet_care.py`,
que e testado com o relogio adiantado. Este arquivo e so a porta HTTP — le o
bichinho, envelhece ate agora, aplica o cuidado e conta pro outro pelo WebSocket.

Duas travas que valem repetir, porque sao do tipo que some sem ninguem ver:

1. Toda leitura passa por `apply_decay` ANTES de responder. Se a fome so caisse
   quando alguem abre a tela, quem nunca abre teria um bichinho eterno.
2. O item so sai do inventario DEPOIS de o efeito ser calculado, na mesma
   transacao. Comida que some sem alimentar e o bug classico deste modulo.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import catalog, economy, missions, pet_care, push
from ..clock import today, utcnow
from ..db import get_db
from ..models import HouseMess, Pet, PetInteraction, Room, ShopItem, User
from ..realtime import publish
from ..schemas import moment_iso
from ..security import current_user, partner_of
from .shop import owns, take_from_inventory

router = APIRouter(prefix="/api/pet", tags=["bichinho"])


class ChooseIn(BaseModel):
    species: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=40)


class RenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class ItemIn(BaseModel):
    code: str = Field(min_length=1, max_length=60)


class AccessoryIn(BaseModel):
    code: str = Field(default="", max_length=60)


class MoveIn(BaseModel):
    room_code: str = Field(min_length=1, max_length=40)


class AdoptIn(BaseModel):
    species: str = Field(min_length=1, max_length=30)
    name: str = Field(default="", max_length=40)


# Os minijogos. O `teto` e o limite de pontos que a rota aceita: qualquer coisa
# acima disso e app adulterado, e o servidor recusa em vez de pagar.
# Teto de bichinhos na casa. Nao e limitacao tecnica: quatro ja e mais cuidado
# do que duas pessoas dao conta, e a sujeira de cada um cai na mesma casa. Sem
# teto, dava pra encher a sala de sujeira sem querer.
MAX_PETS = 4

JOGOS = {
    "bolinha": {"nome": "Aventura da bolinha", "teto": 12, "descanso_min": 2, "energia": 8},
    "corrida": {"nome": "Corrida do bichinho", "teto": 40, "descanso_min": 3, "energia": 10},
}


class GameIn(BaseModel):
    score: int = Field(ge=0, le=60)
    duration_ms: int = Field(ge=5000, le=180000)
    game: str = Field(default="bolinha", max_length=20)
    # Identificador DA PARTIDA, sorteado pelo app quando ela comeca.
    #
    # Ele existe pra uma coisa so: separar "o dedo bateu duas vezes no fim da
    # mesma partida" de "joguei outra partida". Com o premio pago por partida,
    # essa diferenca virou dinheiro — e datar a chave pelo relogio nao resolve,
    # porque duas partidas curtas cabem no mesmo segundo e uma delas deixaria de
    # pagar sem motivo nenhum.
    match_id: str = Field(default="", max_length=40)


def get_pet(db: Session) -> Pet:
    """O bichinho ATIVO: o que a tela mostra e o que recebe cuidado agora.

    Ponto unico de entrada — a casa, o jogo e todas as rotas de cuidado passam
    por aqui. Foi o que permitiu passar de um bichinho pra varios sem espalhar
    "qual deles?" por todo o codigo.
    """
    pets = db.query(Pet).order_by(Pet.id).all()
    if not pets:  # o seed cria; isto e cinto de seguranca
        pet = Pet(id=1, name="", species="", appearance_config={}, active=True)
        db.add(pet)
        db.flush()
        return pet
    for pet in pets:
        if pet.active:
            return pet
    # Nenhum marcado: e o banco de antes de existirem varios bichinhos, ou
    # alguem apagou o ativo. O primeiro com especie assume; sem nenhum, o
    # primeiro da fila (que e a linha vazia esperando a escolha).
    escolhido = next((p for p in pets if p.species), pets[0])
    escolhido.active = True
    db.flush()
    return escolhido


def _ativar(db: Session, pet: Pet) -> None:
    """Marca UM como ativo e desmarca os outros.

    A exclusividade e garantida aqui, e nao por um `if` na tela: dois ativos
    fariam a casa mostrar um bichinho e o cuidado cair em outro.
    """
    for outro in db.query(Pet).all():
        if outro.active and outro.id != pet.id:
            outro.active = False
    pet.active = True
    db.flush()


def pets_resumo(db: Session) -> list[dict]:
    """A lista curta pra tela trocar de bichinho sem carregar tudo de cada um."""
    return [
        {
            "id": p.id,
            "name": p.name,
            "species": p.species,
            "species_name": (catalog.PET_SPECIES_BY_CODE.get(p.species) or {}).get("name", ""),
            "colors": (catalog.PET_SPECIES_BY_CODE.get(p.species) or {}).get("colors", []),
            "active": bool(p.active),
            "level": pet_care.level_for(int(p.xp or 0)),
            "growth": pet_care.growth_of(int(p.xp or 0)),
            "sick": bool(p.sick),
            "mood": pet_care.mood_of(p, 0),
            # Onde cada um esta e o que cada um esta vestindo: e o que a CASA
            # precisa pra desenhar todos eles andando pelo comodo, e nao so o
            # que esta ativo. Sem `room_code` a casa nao sabe quem esta ali;
            # sem `accessories` os outros apareceriam sem a coleira comprada.
            "room_code": p.room_code or "sala",
            "accessories": dict(p.accessories or {}),
            # o pior atributo: e o que denuncia, na lista, quem esta precisando
            "worst": min(getattr(p, stat) for stat in pet_care.STATS),
        }
        for p in pet_care.all_pets(db)
    ]


def _item(db: Session, code: str, subcategory: str | None = None) -> ShopItem:
    item = db.query(ShopItem).filter(ShopItem.code == code).first()
    if item is None or item.category != "pet":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esse item não é do bichinho")
    if subcategory and item.subcategory != subcategory:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{item.name} não serve pra isso")
    return item


def pet_out(db: Session, pet: Pet) -> dict:
    mess = pet_care.pending_mess(db)
    rooms = {r.id: r for r in db.query(Room).all()}
    progress = pet_care.level_progress(int(pet.xp or 0))
    species = pet_care.species_of(pet)
    return {
        "id": pet.id,
        "chosen": bool(pet.species),
        "name": pet.name,
        "species": pet.species,
        "species_name": species.get("name", ""),
        "tagline": species.get("tagline", ""),
        "colors": species.get("colors", []),
        "appearance": pet.appearance_config or {},
        "accessories": pet.accessories or {},
        "room_code": pet.room_code or "sala",
        "stats": {stat: getattr(pet, stat) for stat in pet_care.STATS},
        # Quanto tempo falta pra cada atributo zerar. E o que deixa o dono
        # entender que aquilo anda sozinho, em vez de descobrir depois.
        "empty_in_hours": {
            stat: pet_care.hours_until_empty(pet, stat) for stat in pet_care.STATS
        },
        "sick": bool(pet.sick),
        "mood": pet_care.mood_of(pet, len(mess)),
        "level": progress["level"],
        "stage": pet_care.stage_for(progress["level"]),
        # crescimento continuo (0 a 1): e o que o desenho usa pra interpolar a
        # proporcao do corpo. O `stage` acima continua pro texto da tela.
        "growth": pet_care.growth_of(int(pet.xp or 0)),
        "xp": int(pet.xp or 0),
        "xp_into": progress["into"],
        "xp_need": progress["need"],
        "xp_ratio": progress["ratio"],
        "mess_count": len(mess),
        "mess": [
            {
                "id": m.id,
                "room_code": rooms[m.room_id].code if m.room_id in rooms else "",
                "col": m.col,
                "row": m.row,
                "kind": m.kind,
                "created_at": moment_iso(m.created_at),
            }
            for m in mess
        ],
        "born_at": moment_iso(pet.born_at),
        "last_interaction_at": moment_iso(pet.last_interaction_at),
        "can_cuddle_at": moment_iso(_cuddle_ready(pet)),
        "toy_ready": {
            code: moment_iso(pet_care.toy_ready_at(pet, code))
            for code in (pet.toy_cooldowns or {})
        },
    }


def _cuddle_ready(pet: Pet):
    from datetime import timedelta

    if not pet.last_petted_at:
        return None
    return pet.last_petted_at + timedelta(minutes=pet_care.PET_COOLDOWN_MIN)


def _log(db: Session, pet: Pet, user: User, action: str, code: str, effect: dict) -> None:
    db.add(
        PetInteraction(
            pet_id=pet.id, user_id=user.id, action=action, item_code=code, effect=effect
        )
    )


def _respond(db: Session, pet: Pet, extra: dict | None = None) -> dict:
    db.commit()
    body = pet_out(db, pet)
    publish("pet", body)
    return {**(extra or {}), "pet": body}


# ------------------------------------------------------------------ leitura
@router.get("/species")
def species_list() -> dict:
    """As especies pra escolher. Nao sao skins: cada uma tem ritmo proprio."""
    return {
        "species": [
            {
                "code": s["code"],
                "name": s["name"],
                "tagline": s["tagline"],
                "colors": s["colors"],
                # Fica visivel ANTES de escolher: o ritmo faz parte da escolha.
                "traits": {
                    "hunger": s["hunger"],
                    "hygiene": s["hygiene"],
                    "energy": s["energy"],
                    "happiness": s["happiness"],
                    "mess_rate": s["mess_rate"],
                },
            }
            for s in catalog.PET_SPECIES
        ]
    }


@router.get("")
def read(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    pet = get_pet(db)
    report = pet_care.apply_decay(db, pet)
    # Os OUTROS tambem envelhecem. Se so o ativo caisse, bastaria trocar de
    # bichinho pra congelar o faminto — e o cuidado deixaria de custar.
    for outro in pet_care.all_pets(db):
        if outro.id != pet.id:
            pet_care.apply_decay(db, outro)
    db.commit()
    body = pet_out(db, pet)
    if report["mess_born"]:
        # o outro precisa ver a sujeira aparecer sem recarregar
        publish("pet", body)
    return {"pet": body, "since": report, "pets": pets_resumo(db)}


@router.get("/items")
def items(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """O que voces tem pra cuidar dele. A tela nao inventa: a lista vem daqui."""
    pet = get_pet(db)
    pet_care.apply_decay(db, pet)
    db.commit()
    rows = (
        db.query(ShopItem)
        .filter(ShopItem.category == "pet", ShopItem.active.is_(True))
        .order_by(ShopItem.sort_order)
        .all()
    )
    now = utcnow()
    out = []
    for item in rows:
        quantity = owns(db, user, item)
        ready = pet_care.toy_ready_at(pet, item.code)
        out.append(
            {
                "code": item.code,
                "name": item.name,
                "subcategory": item.subcategory,
                "price": item.price,
                "consumable": item.consumable,
                "quantity": quantity,
                "effect": item.item_metadata or {},
                "ready_at": moment_iso(ready),
                "ready": quantity > 0 and (ready is None or ready <= now),
            }
        )
    return {"items": out}


# ------------------------------------------------------------------ escolha
@router.post("/choose")
def choose(payload: ChooseIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    pet = get_pet(db)
    if pet.species:
        # Trocar de especie zeraria a progressao do casal, e um toque errado
        # apagaria meses de cuidado. Renomear pode; trocar de bicho, nao.
        raise HTTPException(status.HTTP_409_CONFLICT, f"{pet.name} já é de vocês.")
    if payload.species not in catalog.PET_SPECIES_BY_CODE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Essa espécie não existe")

    now = utcnow()
    pet.species = payload.species
    pet.name = payload.name.strip()
    pet.born_at = now
    pet.last_decay_at = now  # o relogio dele so comeca a correr agora
    pet.mess_debt = 0.0
    pet.decay_residue = {}
    for stat in pet_care.STATS:
        setattr(pet, stat, 80)
    _ativar(db, pet)

    partner = partner_of(db, user)
    if partner:
        push.send_to_user(
            db,
            partner.id,
            title="Temos um bichinho!",
            body=f"{user.name} escolheu {pet.name}, um {catalog.PET_SPECIES_BY_CODE[payload.species]['name'].lower()}",
            url="/pet",
            kind="pet",
        )
    return _respond(db, pet)


@router.patch("")
def rename(payload: RenameIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    pet = get_pet(db)
    if not pet.species:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escolham o bichinho primeiro")
    pet_care.apply_decay(db, pet)
    pet.name = payload.name.strip()
    return _respond(db, pet)


@router.post("/adopt")
def adopt(payload: AdoptIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Adota MAIS UM bichinho, usando uma licenca de especie comprada na loja.

    Antes esta rota TROCAVA a especie do unico bichinho, mantendo nome e
    progressao. Agora ela cria um bichinho novo, com a vida dele — que e o que
    o dono pediu ao querer mais de um.

    A licenca e CONSUMIDA. Sem isso, uma compra viraria bichinho infinito: era
    so chamar a rota de novo. Trocar entre os que ja moram na casa continua de
    graca (`/select`) — o que custa e trazer mais um pra dentro.
    """
    if payload.species not in catalog.PET_SPECIES_BY_CODE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Essa espécie não existe")
    item = db.query(ShopItem).filter(ShopItem.code == f"pet_especie_{payload.species}").first()
    if item is None or owns(db, user, item) < 1:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Adote essa espécie na loja primeiro")

    atual = get_pet(db)
    if not atual.species:
        # Ainda nao escolheram nenhum: a licenca preenche a linha que ja existe,
        # em vez de deixar um bichinho vazio pra sempre no banco.
        pet = atual
    else:
        if len(pet_care.all_pets(db)) >= MAX_PETS:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"A casa já está com {MAX_PETS} bichinhos. Cuidar de mais que isso não dá.",
            )
        pet = Pet(name="", species="", appearance_config={})
        db.add(pet)
        db.flush()

    take_from_inventory(db, user, item, 1)
    now = utcnow()
    pet.species = payload.species
    especie = catalog.PET_SPECIES_BY_CODE[payload.species]
    pet.name = (payload.name or "").strip() or especie["name"]
    pet.born_at = now
    pet.last_decay_at = now
    pet.mess_debt = 0.0
    pet.decay_residue = {}
    pet.sick = False
    pet.room_code = atual.room_code or "sala"
    for stat_name in pet_care.STATS:
        setattr(pet, stat_name, 80)
    _ativar(db, pet)

    partner = partner_of(db, user)
    if partner:
        push.send_to_user(
            db,
            partner.id,
            title="Chegou mais um!",
            body=f"{user.name} adotou {pet.name}, um {especie['name'].lower()}",
            url="/pet",
            kind="pet",
        )
    return _respond(db, pet)


@router.post("/{pet_id}/select")
def select(pet_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Troca qual bichinho esta na tela. Nao custa nada e nao apaga nada."""
    pet = db.get(Pet, pet_id)
    if pet is None or not pet.species:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esse bichinho não existe")
    pet_care.decay_all(db)
    _ativar(db, pet)
    return _respond(db, pet)


@router.post("/{pet_id}/soltar")
def soltar(pet_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Dispensa um bichinho da casa.

    Faltava. Dava pra adotar e nunca pra desfazer — e como cada licença de
    espécie da loja traz um bichinho NOVO, comprar a segunda licença de gato
    deixa dois gatos na fila pra sempre, sem saída. Foi exatamente o que
    aconteceu com o dono.

    Duas travas, e as duas existem pra ninguém se arrepender:

    1. **não dá pra soltar o último**: sem bichinho nenhum a tela do bichinho
       volta pra adoção e a casa perde o morador — quem quer isso quer outra
       coisa, não isto;
    2. **soltar o ATIVO passa a vez pro próximo** antes de apagar. Sem isso,
       `get_pet` ficaria sem ativo e todas as rotas de cuidado passariam a
       responder sobre um bichinho que não existe mais.

    A sujeira que ele deixou na casa continua lá, de propósito: o bicho foi
    embora, a bagunça não se limpa sozinha.
    """
    pet = db.get(Pet, pet_id)
    if pet is None or not pet.species:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esse bichinho não existe")

    vivos = [p for p in db.query(Pet).order_by(Pet.id).all() if p.species]
    if len(vivos) <= 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Esse é o único bichinho de vocês — não dá pra ficar sem nenhum.",
        )

    nome = pet.name
    if pet.active:
        proximo = next(p for p in vivos if p.id != pet.id)
        _ativar(db, proximo)

    db.query(PetInteraction).filter(PetInteraction.pet_id == pet.id).delete()
    db.delete(pet)
    db.commit()
    return _respond(db, get_pet(db), {"soltou": nome})


@router.post("/move")
def move(payload: MoveIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Leva o bichinho pra outro comodo. Ele passa a sujar LA."""
    pet = get_pet(db)
    if not pet.species:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escolham o bichinho primeiro")
    room = db.query(Room).filter(Room.code == payload.room_code).first()
    if room is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esse cômodo não existe")
    if not room.unlocked:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{room.name} ainda está trancado")
    pet_care.apply_decay(db, pet)
    pet.room_code = room.code
    return _respond(db, pet)


# ------------------------------------------------------------------ cuidado
def _require_pet(db: Session) -> Pet:
    pet = get_pet(db)
    if not pet.species:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escolham o bichinho primeiro")
    pet_care.apply_decay(db, pet)
    return pet


@router.post("/feed")
def feed(payload: ItemIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    pet = _require_pet(db)
    item = _item(db, payload.code, "comida")
    effect = dict(item.item_metadata or {})
    if "hunger" in effect and pet.hunger >= 100:
        # Empanturrar nao pode gastar o item a toa.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{pet.name} está sem fome nenhuma")
    if "hygiene" in effect and "hunger" not in effect and pet.hygiene >= 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{pet.name} já está limpinho")

    action = "bathe" if "hygiene" in effect and "hunger" not in effect else "feed"
    result = pet_care.touch(db, pet, effect, action)
    take_from_inventory(db, user, item, 1)
    _log(db, pet, user, action, item.code, result["applied"])
    missions.record(db, "pet_feed" if action == "feed" else "pet_clean")
    return _respond(db, pet, {"used": item.name, **result})


@router.post("/bathe")
def bathe(payload: ItemIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Banho e a mesma mecanica de comida: gasta um item. Rota separada so pra
    tela ficar honesta sobre o que esta fazendo."""
    return feed(payload, user, db)


@router.post("/play")
def play(payload: ItemIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    pet = _require_pet(db)
    item = _item(db, payload.code, "brinquedo")
    if owns(db, user, item) <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Vocês não têm {item.name}")

    now = utcnow()
    ready = pet_care.toy_ready_at(pet, item.code)
    if ready is not None and ready > now:
        minutes = int((ready - now).total_seconds() // 60) + 1
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{pet.name} já cansou de {item.name.lower()}. Volta em {minutes} min.",
        )

    effect = dict(item.item_metadata or {})
    cooldown = int(effect.pop("cooldown_min", 30))
    if effect.get("energy", 0) < 0 and pet.energy < abs(int(effect["energy"])):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"{pet.name} está sem energia pra brincar"
        )

    result = pet_care.touch(db, pet, effect, "play")
    pet_care.set_toy_cooldown(pet, item.code, cooldown, now)
    _log(db, pet, user, "play", item.code, result["applied"])
    missions.record(db, "pet_play")
    return _respond(db, pet, {"used": item.name, **result})


# Corações que uma partida rende. AGORA TODA PARTIDA PAGA.
#
# Antes era uma vez por dia, por medo de virar caça-níquel — e o medo era justo:
# prêmio por partida, sem nenhum limite, é imprimir moeda. Só que o efeito
# colateral era pior do que o problema: a partir da segunda partida o jogo não
# valia mais nada, e um jogo que não vale nada ninguém joga.
#
# O que resolve os dois é o limite não ser o RELÓGIO, e sim a **energia do
# bichinho**: cada partida gasta energia, e sem energia não dá pra jogar. Foi o
# que o dono pediu com todas as letras, e por acaso é o desenho certo — a
# torneira continua fechada (de 100 de energia saem umas sete partidas), mas
# fecha por um motivo que aparece na tela e que dá pra resolver cuidando dele,
# em vez de por uma regra invisível de calendário.
#
# O valor acompanha o desempenho, então jogar bem vale mais do que jogar muito.
PREMIO_MINIMO = 2
PREMIO_MAXIMO = 10


@router.post("/game")
def game(payload: GameIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Uma partida curta de minijogo com o bichinho.

    Vale pros dois jogos (`bolinha` e `corrida`): o que muda entre eles é o teto
    de pontos, o descanso e a energia gasta — tudo em `JOGOS`, num lugar só.

    Ponto e duração têm teto no schema; o descanso impede virar torneira infinita
    de experiência. É brincadeira com o pet, não caça-níquel.
    """
    regra = JOGOS.get(payload.game)
    if regra is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Esse jogo não existe")
    if payload.score > regra["teto"]:
        # Placar acima do teto do jogo só chega aqui se o app foi adulterado.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Placar impossível nesse jogo")

    pet = _require_pet(db)
    now = utcnow()
    code = f"game_{payload.game}"
    # O DESCANSO POR RELÓGIO SAIU, e a energia ficou sendo o único freio.
    #
    # Eram dois freios pro mesmo problema, e o de relógio era o pior: ele
    # bloqueava por dois minutos sem nada pra fazer no meio, e não tinha
    # nenhuma relação com o estado do bichinho. A energia diz a mesma coisa de
    # um jeito que se entende olhando a barra — e se acabou, dá pra alimentar e
    # deixar ele descansar, que é jogo, não espera.
    if pet.energy < regra["energia"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{pet.name} está cansado demais pra brincar. Deixe ele descansar ou dê comida.",
        )

    # A alegria acompanha o desempenho, mas em fração do teto — assim os dois
    # jogos rendem parecido mesmo tendo placares de tamanhos bem diferentes.
    aproveitamento = payload.score / regra["teto"] if regra["teto"] else 0
    happiness = int(4 + round(14 * min(1.0, aproveitamento)))
    result = pet_care.touch(
        db, pet, {"happiness": happiness, "energy": -regra["energia"]}, "play", now
    )

    # Toda partida paga, proporcional ao que foi feito. `dedupe_key` continua
    # existindo — não pra limitar por dia, mas pra que o toque duplo no fim da
    # partida não pague duas vezes pela MESMA partida. É a mesma trava de
    # sempre; o que mudou é o que ela identifica.
    moedas = PREMIO_MINIMO + round((PREMIO_MAXIMO - PREMIO_MINIMO) * min(1.0, aproveitamento))
    premio = economy.try_earn(
        db,
        user.id,
        moedas,
        "minigame",
        reference=payload.game,
        note=f"{regra['nome']} — {payload.score} ponto(s)",
        dedupe_key=(
            f"petgame:{payload.game}:{user.id}:{payload.match_id}"
            if payload.match_id
            else f"petgame:{payload.game}:{user.id}:{now.timestamp():.6f}"
        ),
    )

    effect = {**result, "score": payload.score, "duration_ms": payload.duration_ms}
    _log(db, pet, user, "play", code, effect)
    missions.record(db, "pet_game")
    body = _respond(db, pet, {**effect, "coins": moedas if premio else 0})
    if premio:
        publish("wallet", {"balance": economy.balance(db, user.id)}, to_user=user.id)
    return body


@router.post("/cuddle")
def cuddle(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Carinho de graca — com hora marcada.

    Existe de proposito COM descanso de 4 horas: um afago ilimitado seria o
    "botao sem consequencia" que foi descartado na decisao da secao 8.2, e
    esvaziaria o motivo de comprar comida e brinquedo.
    """
    pet = _require_pet(db)
    now = utcnow()
    ready = _cuddle_ready(pet)
    if ready is not None:
        if ready.tzinfo is None:
            ready = ready.replace(tzinfo=now.tzinfo)
        if ready > now:
            minutes = int((ready - now).total_seconds() // 60) + 1
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"{pet.name} já recebeu carinho. Daqui a {minutes} min ele quer de novo.",
            )
    result = pet_care.touch(db, pet, {"happiness": 4}, "pet", now)
    pet.last_petted_at = now
    _log(db, pet, user, "pet", "", result["applied"])
    return _respond(db, pet, result)


@router.post("/accessory")
def accessory(payload: AccessoryIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Veste (ou tira) um acessorio. Posse conferida NO SERVIDOR.

    Esconder o botao na tela nao e seguranca — a mesma regra ja vale pro avatar.
    """
    pet = _require_pet(db)
    worn = dict(pet.accessories or {})
    if not payload.code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Diga qual acessório tirar")

    item = _item(db, payload.code, "acessorio")
    meta = item.item_metadata or {}
    slot = meta.get("slot")
    if not slot:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Esse acessório não tem lugar")

    if worn.get(slot) == item.code:
        worn[slot] = ""  # clicar de novo tira
    else:
        if owns(db, user, item) <= 0:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Vocês não têm {item.name}")
        worn[slot] = item.code
    pet.accessories = worn
    return _respond(db, pet)


@router.post("/mess/{mess_id}/clean")
def clean(mess_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Limpa UMA sujeira. De graca, mas alguem tem que fazer."""
    pet = _require_pet(db)
    mess = db.get(HouseMess, mess_id)
    if mess is None or mess.cleaned_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Essa sujeira já foi limpa")
    mess.cleaned_at = utcnow()
    mess.cleaned_by = user.id
    result = pet_care.touch(db, pet, {"happiness": 2}, "clean")
    _log(db, pet, user, "clean", mess.kind, result["applied"])
    missions.record(db, "pet_clean")
    body = _respond(db, pet, result)
    publish("house", {"reason": "mess"})
    return body
