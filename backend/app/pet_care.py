"""O bichinho que da trabalho: decaimento, sujeira, doenca e evolucao.

A decisao registrada no HANDOFF (secao 8.2) e explicita: **nao pode ser um botao
de carinho sem consequencia**. Entao aqui:

  - os quatro atributos caem sozinhos com o tempo, cada especie no seu ritmo;
  - fome ou sujeira no chao derrubam a alegria MAIS RAPIDO (esquecer custa caro);
  - o bichinho SUJA A CASA: a sujeira vira linha em `house_mess`, com comodo e
    celula, e alguem precisa ir la limpar;
  - atributo zerado deixa o bichinho doente, e doente ele nao ganha experiencia
    nenhuma ate ser recuperado. Descuidar custa progressao, nao so carinha triste.

Tudo e funcao do TEMPO DECORRIDO, nunca de sorteio, e por isso a bateria
consegue adiantar o relogio e conferir o numero exato — do mesmo jeito que o
check-in ja e testado em `test_economy.py`.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from . import catalog
from .clock import utcnow
from .models import HouseMess, Pet, Room, RoomLayout

STATS = ("hunger", "happiness", "energy", "hygiene")

# Pontos por hora, no ritmo base (a especie multiplica cada um).
# Barriga cheia dura ~2 dias no ritmo base: pede atencao todo dia, sem virar
# tamagotchi que morre se voce dormir.
BASE_DECAY = {"hunger": 2.0, "hygiene": 1.5, "energy": 1.2, "happiness": 1.4}

# Castigo extra na alegria. E o que transforma "esquecer" em consequencia.
PENALTY_HUNGRY = 1.6      # por hora, com fome abaixo de 30
PENALTY_DIRTY = 1.6       # por hora, com higiene abaixo de 30
PENALTY_PER_MESS = 0.30   # por hora, por sujeira alem de MESS_TOLERANCE
MESS_TOLERANCE = 2

# Energia e a UNICA que volta sozinha, e o motivo e evitar beco sem saida:
# brincar gasta energia e so a almofada devolvia (+30, com 2h de descanso). Um
# bichinho que chegasse a 0 de energia ficaria doente pra sempre, porque nada no
# jogo daria conta de tirar ele de la. Entao energia e DESCANSO: sobe sozinha
# enquanto ele nao esta com fome, e vira orcamento de brincadeira. Com fome, ela
# passa a cair — bicho faminto nao tem pique, e a saida continua sendo alimentar.
ENERGY_RECOVERY = 1.5     # pontos por hora, descansado e alimentado

# O tempo e simulado em fatias de 1 hora (ver `apply_decay`), com teto de 60
# dias por leitura — o suficiente pra tudo zerar, sem um laco gigante no boot.
SLICE_HOURS = 1.0
MAX_CATCHUP_DAYS = 60

LOW = 30                  # abaixo disso o atributo ja e "ruim"
RECOVERED = 40            # so sai de doente quando TUDO passa disso

# Sujeira: uma a cada 9 horas no ritmo base, o dobro se estiver imundo.
MESS_HOURS = 9.0
MESS_CAP = 14             # teto de sujeira por limpar
MESS_KINDS = ("poop", "puddle", "fur", "crumbs")

# Experiencia por cuidado.
XP = {"feed": 3, "play": 6, "bathe": 4, "clean": 2, "pet": 1}
LEVEL_STEP = 60           # o nivel N->N+1 custa 60*N de experiencia
MAX_LEVEL = 20

PET_COOLDOWN_MIN = 240    # carinho de graca so de 4 em 4 horas


# ------------------------------------------------------------------ especie
def species_of(pet: Pet) -> dict:
    """Tracos da especie escolhida. Sem especie, o ritmo base."""
    return catalog.PET_SPECIES_BY_CODE.get(pet.species or "", {})


def _rate(pet: Pet, stat: str) -> float:
    return BASE_DECAY[stat] * float(species_of(pet).get(stat, 1.0))


# ------------------------------------------------------------------ nivel
def level_for(xp: int) -> int:
    """Nivel a partir da experiencia total. Fonte unica: a tela nao recalcula."""
    return level_progress(xp)["level"]


def level_progress(xp: int) -> dict:
    level, spent, need = 1, 0, LEVEL_STEP
    while level < MAX_LEVEL and xp - spent >= need:
        spent += need
        level += 1
        need = LEVEL_STEP * level
    if level >= MAX_LEVEL:
        return {"level": MAX_LEVEL, "into": 0, "need": 0, "ratio": 1.0}
    into = xp - spent
    return {"level": level, "into": into, "need": need, "ratio": round(into / need, 3)}


ADULT_LEVEL = 8           # a partir daqui ele esta formado


def stage_for(level: int) -> str:
    """Como ele aparece no desenho. Evolucao visual, nao so um numero subindo."""
    if level >= ADULT_LEVEL:
        return "adulto"
    if level >= 4:
        return "jovem"
    return "filhote"


def growth_of(xp: int) -> float:
    """Quanto ele ja cresceu, de 0 (filhote recem-adotado) a 1 (adulto).

    O estagio acima da tres degraus, e degrau e o suficiente pra ESCREVER
    "jovem" na tela. Pro DESENHO nao e: com tres degraus, o bichinho passa a
    vida inteira sem mudar e um dia acorda com outro corpo. Aqui a mesma
    progressao vira um numero continuo, e o motor de desenho interpola a
    proporcao (cabeca perde espaco, perna e focinho ganham) a cada nivel.

    E deliberadamente a MESMA fonte do nivel — nao um segundo relogio. Se fosse
    tempo de vida, cuidar bem e largar num canto dariam o mesmo adulto, e a
    evolucao deixaria de ser recompensa.
    """
    progress = level_progress(int(xp or 0))
    level = progress["level"]
    if level >= ADULT_LEVEL:
        return 1.0
    # o quanto falta DENTRO do nivel conta tambem, senao ele cresceria em pulos
    andado = (level - 1) + (progress["ratio"] if progress["need"] else 1.0)
    return round(min(1.0, max(0.0, andado / (ADULT_LEVEL - 1))), 4)


# ------------------------------------------------------------------ sujeira
def pending_mess(db: Session, room_id: int | None = None) -> list[HouseMess]:
    query = db.query(HouseMess).filter(HouseMess.cleaned_at.is_(None))
    if room_id is not None:
        query = query.filter(HouseMess.room_id == room_id)
    return query.order_by(HouseMess.id).all()


def _occupied_cells(db: Session, room: Room) -> set[tuple[int, int]]:
    """Celulas onde nao cabe sujeira: moveis e sujeira que ja esta la."""
    taken: set[tuple[int, int]] = set()
    layout = db.query(RoomLayout).filter(RoomLayout.room_id == room.id).first()
    for item in ((layout.grid_data if layout else None) or {}).get("items", []):
        try:
            col, row = int(item["col"]), int(item["row"])
            width, depth = int(item.get("w", 1)), int(item.get("d", 1))
        except (KeyError, TypeError, ValueError):
            continue
        for r in range(row, row + max(1, depth)):
            for c in range(col, col + max(1, width)):
                taken.add((c, r))
    for mess in pending_mess(db, room.id):
        taken.add((mess.col, mess.row))
    return taken


def _free_cell(db: Session, room: Room, seed: int) -> tuple[int, int] | None:
    """Uma celula livre do comodo.

    O sorteio tem SEMENTE fixa (id do bichinho + quantas sujeiras ja nasceram):
    e aleatorio pra quem joga, mas repetivel no teste. Sorteio de verdade aqui
    deixaria a bateria instavel, e teste instavel acaba sendo ignorado.
    """
    taken = _occupied_cells(db, room)
    free = [
        (c, r)
        for r in range(room.height)
        for c in range(room.width)
        if (c, r) not in taken
    ]
    if not free:
        return None
    return random.Random(seed).choice(free)


def _room_for_mess(db: Session, pet: Pet) -> Room | None:
    """Ele suja ONDE esta. Se aquele comodo estiver trancado, cai na sala."""
    room = db.query(Room).filter(Room.code == (pet.room_code or "sala")).first()
    if room is None or not room.unlocked:
        room = db.query(Room).filter(Room.code == "sala").first()
    return room


def _spawn_mess(db: Session, pet: Pet, count: int, when: datetime) -> int:
    room = _room_for_mess(db, pet)
    if room is None:
        return 0
    born = 0
    for _ in range(count):
        if len(pending_mess(db)) >= MESS_CAP:
            break
        seed = pet.id * 7919 + db.query(HouseMess).count()
        cell = _free_cell(db, room, seed)
        if cell is None:
            break  # comodo lotado: nao empilha sujeira em cima de movel
        kind = MESS_KINDS[seed % len(MESS_KINDS)]
        db.add(
            HouseMess(room_id=room.id, col=cell[0], row=cell[1], kind=kind, created_at=when)
        )
        db.flush()
        born += 1
    return born


# ------------------------------------------------------------------ decaimento
def _decay_slice(db: Session, pet: Pet, residue: dict, hours: float, now: datetime) -> None:
    """Uma fatia curta de tempo. O estado do inicio da FATIA e que manda."""
    hungry = pet.hunger < LOW
    filthy = pet.hygiene < LOW
    mess_now = len(pending_mess(db))

    for stat in STATS:
        drop = _rate(pet, stat) * hours
        if stat == "energy" and not hungry:
            drop = -ENERGY_RECOVERY * hours  # descansando: sobe em vez de cair
        if stat == "happiness":
            if hungry:
                drop += PENALTY_HUNGRY * hours
            if filthy:
                drop += PENALTY_DIRTY * hours
            drop += PENALTY_PER_MESS * max(0, mess_now - MESS_TOLERANCE) * hours

        total = drop + float(residue.get(stat, 0.0))
        # `math.floor`, e nao `int()`: com a energia subindo o total fica
        # NEGATIVO, e `int(-1.4)` daria -1 (arredonda pro zero), guardando -0,4
        # de sobra. A sobra tem que ficar sempre entre 0 e 1 nos dois sentidos.
        whole = math.floor(total)
        raw = getattr(pet, stat) - whole
        value = min(100, max(0, raw))
        setattr(pet, stat, value)
        if raw != value:
            # bateu no teto ou no chao: a sobra viraria credito (ou divida) que
            # nao existe, e o atributo sairia de 100 sem tempo ter passado
            residue[stat] = 0.0
        else:
            # Repare que aqui a sobra e GUARDADA mesmo com o atributo em 100.
            # Zerar neste ponto foi um bug de verdade: o pedaco menor que 1
            # ponto sumia a cada leitura, e um bichinho cheio nunca mais tinha
            # fome — com uma tela perfeitamente normal.
            residue[stat] = round(total - whole, 6)

    # sujeira acumula na mesma fatia, mais rapido se ele estiver imundo
    factor = 2.0 if pet.hygiene < 40 else 1.0
    rate = float(species_of(pet).get("mess_rate", 1.0))
    pet.mess_debt = float(pet.mess_debt or 0.0) + hours / MESS_HOURS * rate * factor


def _settle_mess(db: Session, pet: Pet, now: datetime) -> int:
    """Transforma a divida acumulada em sujeira de verdade, com lugar no comodo."""
    whole = int(pet.mess_debt or 0.0)
    if whole <= 0:
        return 0
    # Teto: voltar de uma viagem de um mes nao pode virar 80 sujeiras de uma
    # vez. Sujou o que cabia; o resto some.
    born = _spawn_mess(db, pet, min(whole, MESS_CAP), now)
    pet.mess_debt = round(float(pet.mess_debt) - whole, 6)
    return born


def apply_decay(db: Session, pet: Pet, now: datetime | None = None) -> dict:
    """Envelhece o bichinho ate agora. Idempotente: chamar duas vezes nao dobra.

    Devolve o que aconteceu no caminho, pra tela poder contar o que ele passou.
    """
    now = now or utcnow()
    report = {"hours": 0.0, "mess_born": 0, "became_sick": False, "recovered": False}
    if not pet.species:
        # sem especie escolhida ainda nao existe bichinho pra passar fome
        pet.last_decay_at = now
        return report

    last = pet.last_decay_at or now
    if last.tzinfo is None:
        last = last.replace(tzinfo=now.tzinfo)
    hours = (now - last).total_seconds() / 3600.0
    # Relogio pra tras (fuso, ajuste de servidor) nao "desdecai": so reancora.
    if hours <= 0:
        pet.last_decay_at = now
        return report
    if hours < 1 / 120:  # menos de 30 segundos: nem mexe, evita ruido
        return report

    report["hours"] = round(hours, 4)
    # Teto no tempo simulado: um banco parado por um ano nao pode virar 8.760
    # voltas de laco no primeiro acesso. Depois de 60 dias tudo ja esta zerado
    # e a sujeira ja bateu no teto — o resto do tempo nao mudaria nada.
    hours = min(hours, 24 * MAX_CATCHUP_DAYS)

    # Por que em FATIAS, e nao numa conta so:
    #
    # O castigo depende do estado ("com fome, a alegria cai mais rapido"), e o
    # estado muda no meio do periodo. Numa conta unica de 30 dias, o bichinho
    # seria julgado pelo estado do primeiro instante — comecou de barriga cheia,
    # entao passaria o mes inteiro sem castigo de fome e com a energia subindo,
    # e voltaria de um mes largado descansado e quase alegre. Fatiando de hora em
    # hora, o momento em que ele FICA com fome e respeitado.
    residue = dict(pet.decay_residue or {})
    remaining = hours
    while remaining > 1e-9:
        step = min(SLICE_HOURS, remaining)
        remaining -= step
        _decay_slice(db, pet, residue, step, now)

    pet.decay_residue = residue
    report["mess_born"] = _settle_mess(db, pet, now)

    was_sick = bool(pet.sick)
    if any(getattr(pet, stat) <= 0 for stat in STATS):
        pet.sick = True
    elif was_sick and all(getattr(pet, stat) >= RECOVERED for stat in STATS):
        pet.sick = False
    report["became_sick"] = bool(pet.sick) and not was_sick
    report["recovered"] = was_sick and not pet.sick

    pet.last_decay_at = now
    return report


def touch(db: Session, pet: Pet, changes: dict, action: str, now: datetime | None = None) -> dict:
    """Aplica o efeito de um cuidado e devolve o que mudou de verdade.

    "De verdade" importa: dar comida com a barriga em 95 nao pode contar como
    +30, senao o item some e o dono nao entende pra onde foi.
    """
    now = now or utcnow()
    applied: dict[str, int] = {}
    for stat, delta in changes.items():
        if stat not in STATS:
            continue
        before = getattr(pet, stat)
        after = max(0, min(100, before + int(delta)))
        if after != before:
            setattr(pet, stat, after)
            applied[stat] = after - before

    gained = 0
    if action in XP and not pet.sick:
        gained = XP[action]
        pet.xp = int(pet.xp or 0) + gained
        pet.level = level_for(pet.xp)
    if pet.sick and all(getattr(pet, s) >= RECOVERED for s in STATS):
        pet.sick = False

    pet.last_interaction_at = now
    return {"applied": applied, "xp": gained}


# ------------------------------------------------------------------ leitura
def mood_of(pet: Pet, mess_count: int) -> str:
    """Uma palavra que resume o estado. A tela desenha a carinha a partir daqui."""
    if not pet.species:
        return "novo"
    if pet.sick:
        return "doente"
    if pet.hunger < LOW:
        return "faminto"
    if pet.hygiene < LOW:
        return "imundo"
    if mess_count > MESS_TOLERANCE + 3:
        return "incomodado"
    if pet.energy < LOW:
        return "sonolento"
    if pet.happiness < LOW:
        return "triste"
    if pet.happiness >= 80 and pet.hunger >= 60:
        return "feliz"
    return "ok"


def hours_until_empty(pet: Pet, stat: str) -> float | None:
    """Quantas horas faltam pra esse atributo zerar, no ritmo atual.

    Devolve None quando o atributo NAO esta caindo — a energia de um bichinho
    alimentado esta subindo, e mostrar "zera em 50h" ali seria mentira na tela.
    """
    if not pet.species:
        return None
    if stat == "energy" and pet.hunger >= LOW:
        return None
    rate = _rate(pet, stat)
    if rate <= 0:
        return None
    return round(getattr(pet, stat) / rate, 1)


def toy_ready_at(pet: Pet, code: str) -> datetime | None:
    raw = (pet.toy_cooldowns or {}).get(code)
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def set_toy_cooldown(pet: Pet, code: str, minutes: int, now: datetime) -> None:
    cooldowns = dict(pet.toy_cooldowns or {})
    cooldowns[code] = (now + timedelta(minutes=max(0, minutes))).isoformat()
    pet.toy_cooldowns = cooldowns
