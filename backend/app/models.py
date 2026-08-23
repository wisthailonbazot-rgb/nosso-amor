"""Tabelas do app. Sao dois usuarios fixos: nao existe tenant, convite nem pareamento.

Onde o documento do projeto e este arquivo divergem, o motivo esta comentado na
propria tabela.
"""

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .clock import utcnow
from .db import Base


# ------------------------------------------------------------------ pessoas
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)  # login
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(200))
    # Quem registra ciclo. Booleano em vez de role fixo "namorada": o modulo
    # aparece pra quem menstrua, sem o codigo precisar adivinhar quem e quem.
    tracks_cycle: Mapped[bool] = mapped_column(Boolean, default=False)
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AppSetting(Base):
    """Ajustes do casal (data de inicio, privacidade do ciclo, nome do app...).

    Chave/valor em vez de colunas: cada modulo novo guarda o que precisa sem
    exigir migracao de schema.
    """

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PushSubscription(Base):
    """Um aparelho autorizado a receber notificacao.

    Um usuario pode ter varios (celular, tablet, navegador do PC). O endpoint e
    unico: reinstalar o app gera outro e o antigo morre por conta propria.
    """

    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    endpoint: Mapped[str] = mapped_column(Text, unique=True)
    p256dh: Mapped[str] = mapped_column(String(200))
    auth: Mapped[str] = mapped_column(String(100))
    user_agent: Mapped[str] = mapped_column(String(300), default="")
    label: Mapped[str] = mapped_column(String(60), default="")
    failures: Mapped[int] = mapped_column(Integer, default=0)
    last_ok_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped[User] = relationship()


# ------------------------------------------------------------------ ciclo
class CyclePeriod(Base):
    """Uma menstruacao: comeco e fim. E daqui que sai a previsao."""

    __tablename__ = "cycle_periods"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    start_day: Mapped[date] = mapped_column(Date, index=True)
    end_day: Mapped[date | None] = mapped_column(Date, nullable=True)  # nulo = em curso
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "start_day", name="uq_period_start"),)


class CycleDay(Base):
    """O registro do dia: fluxo, sintomas, humor, energia, nota.

    Separado de CyclePeriod porque sintoma existe fora da menstruacao (TPM,
    ovulacao) e porque um registro por dia deixa a edicao idempotente.
    """

    __tablename__ = "cycle_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    flow: Mapped[str] = mapped_column(String(20), default="none")  # none|spotting|light|medium|heavy
    symptoms: Mapped[list] = mapped_column(JSON, default=list)
    mood: Mapped[str] = mapped_column(String(20), default="")
    energy: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1..5
    notes: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_cycle_day"),)


class CyclePrediction(Base):
    """Resultado do calculo, guardado pra nao recalcular a cada abertura de tela
    e pra saber com quantos ciclos aquela previsao foi feita."""

    __tablename__ = "cycle_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    predicted_next_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    fertile_window_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    fertile_window_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    ovulation_day: Mapped[date | None] = mapped_column(Date, nullable=True)
    current_phase: Mapped[str] = mapped_column(String(20), default="")
    cycle_length_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    cycle_length_std: Mapped[float | None] = mapped_column(Float, nullable=True)
    period_length_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    based_on_cycles: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[str] = mapped_column(String(20), default="baixa")
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ------------------------------------------------------------------ economia
class Wallet(Base):
    __tablename__ = "wallets"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    balance: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class WalletTransaction(Base):
    """Extrato. O saldo em `wallets` e cache: a verdade e a soma daqui.

    `dedupe_key` existe pra recompensa que so pode cair uma vez (check-in do dia,
    tarefa diaria, vitoria de uma partida): o banco recusa a segunda tentativa,
    entao dois toques no botao nao viram duas moedas.
    """

    __tablename__ = "wallet_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer)  # sempre positivo
    direction: Mapped[str] = mapped_column(String(10))  # earn|spend
    source: Mapped[str] = mapped_column(String(30))  # daily_checkin|task|minigame|purchase|gift|admin
    reference: Mapped[str] = mapped_column(String(80), default="")
    note: Mapped[str] = mapped_column(String(200), default="")
    balance_after: Mapped[int] = mapped_column(Integer, default=0)
    dedupe_key: Mapped[str | None] = mapped_column(String(120), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class DailyStreak(Base):
    __tablename__ = "daily_streak"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    best_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_checkin_day: Mapped[date | None] = mapped_column(Date, nullable=True)


# ------------------------------------------------------------------ tarefas
class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )  # nulo = qualquer um dos dois
    frequency: Mapped[str] = mapped_column(String(10), default="once")  # once|daily|weekly
    reward_coins: Mapped[int] = mapped_column(Integer, default=10)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TaskCompletion(Base):
    """Conclusao de tarefa por periodo.

    O documento guardava `status` na propria tarefa, mas isso nao sobrevive a
    tarefa diaria/semanal: concluir hoje apagaria o registro de ontem. Aqui cada
    conclusao e uma linha, e `period_key` ("2026-08-23", "2026-W34", "once")
    impede concluir duas vezes o mesmo periodo.
    """

    __tablename__ = "task_completions"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    period_key: Mapped[str] = mapped_column(String(20))
    reward_coins: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("task_id", "period_key", name="uq_task_period"),)


class DailyMission(Base):
    """Objetivo diário compartilhado, avançado por ações reais do jogo."""

    __tablename__ = "daily_missions"

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    code: Mapped[str] = mapped_column(String(50))
    action: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(240), default="")
    goal: Mapped[int] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    reward_coins: Mapped[int] = mapped_column(Integer)
    claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    claimed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("day", "code", name="uq_daily_mission"),)


# ------------------------------------------------------------------ loja
class ShopItem(Base):
    __tablename__ = "shop_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)  # pet|avatar|house
    subcategory: Mapped[str] = mapped_column(String(30), default="")
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(200), default="")
    price: Mapped[int] = mapped_column(Integer, default=0)
    asset_ref: Mapped[str] = mapped_column(String(120), default="")
    item_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    consumable: Mapped[bool] = mapped_column(Boolean, default=False)  # comida some ao usar
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryItem(Base):
    """O que ja foi comprado.

    `user_id` nulo = do casal (mobilia e item de pet sao compartilhados; roupa de
    avatar e de quem comprou).
    """

    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("shop_items.id", ondelete="CASCADE"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    acquired_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    item: Mapped[ShopItem] = relationship()

    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_inventory_owner_item"),)


class Avatar(Base):
    __tablename__ = "avatars"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


# ------------------------------------------------------------------ pet
class Pet(Base):
    """Um pet so, do casal. Linha unica (id=1)."""

    __tablename__ = "pet"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(40), default="")
    species: Mapped[str] = mapped_column(String(30), default="")
    level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    hunger: Mapped[int] = mapped_column(Integer, default=80)  # 0..100, maior = mais saciado
    happiness: Mapped[int] = mapped_column(Integer, default=80)
    energy: Mapped[int] = mapped_column(Integer, default=80)
    hygiene: Mapped[int] = mapped_column(Integer, default=80)
    appearance_config: Mapped[dict] = mapped_column(JSON, default=dict)
    born_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_decay_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_interaction_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # --- Etapa 4: o bichinho que da trabalho
    # Sujeira nao nasce de sorteio: ela ACUMULA em `mess_debt` a cada hora que
    # passa (mais rapido com o bichinho sujo), e cada unidade inteira vira uma
    # linha em `house_mess`. Guardar a divida em vez de sortear e o que deixa o
    # teste conseguir adiantar o relogio e conferir o numero exato.
    mess_debt: Mapped[float] = mapped_column(Float, default=0.0)
    # Sobra fracionaria do decaimento, por atributo.
    #
    # Os atributos sao inteiros na tela ("fome 73"), mas a queda e fracionaria
    # (2,4 pontos por hora). Sem guardar a sobra, cada leitura truncaria o
    # pedaco menor que 1 ponto — e como a tela le o bichinho a toda hora, o
    # bichinho simplesmente PARARIA de ter fome, e ninguem descobriria olhando a
    # tela. Aqui a sobra fica guardada e entra na conta seguinte.
    decay_residue: Mapped[dict] = mapped_column(JSON, default=dict)
    sick: Mapped[bool] = mapped_column(Boolean, default=False)
    # Quando o carinho de graca pode ser dado de novo (senao vira botao sem peso).
    last_petted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Quando cada brinquedo pode ser usado de novo: {"pet_bolinha": "iso..."}
    toy_cooldowns: Mapped[dict] = mapped_column(JSON, default=dict)
    # Acessorios vestidos por encaixe: {"neck": "pet_coleira", "head": ""}
    accessories: Mapped[dict] = mapped_column(JSON, default=dict)
    # Em que comodo ele esta agora (codigo do comodo). Ele suja ONDE esta.
    room_code: Mapped[str] = mapped_column(String(40), default="sala")


class PetInteraction(Base):
    __tablename__ = "pet_interaction_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    pet_id: Mapped[int] = mapped_column(ForeignKey("pet.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(20))  # feed|play|bathe|sleep
    item_code: Mapped[str] = mapped_column(String(60), default="")
    effect: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


# ------------------------------------------------------------------ casa
class Room(Base):
    __tablename__ = "house_rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    width: Mapped[int] = mapped_column(Integer, default=10)
    height: Mapped[int] = mapped_column(Integer, default=10)
    unlock_price: Mapped[int] = mapped_column(Integer, default=0)
    unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    unlocked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # --- Etapa 4: a casa deixou de ser UM comodo e virou uma planta.
    # Cada comodo ocupa um retangulo (plan_x, plan_y, width, height) numa grade
    # unica. Guardar o deslocamento aqui, em vez de desenhar cada comodo numa
    # tela separada, e o que permite parede interna, porta entre comodos e, mais
    # pra frente, o avatar atravessando a casa a pe.
    plan_x: Mapped[int] = mapped_column(Integer, default=0)
    plan_y: Mapped[int] = mapped_column(Integer, default=0)
    # Area de fora (quintal, calcada, rua): sem teto nem parede, chao de grama.
    outdoor: Mapped[bool] = mapped_column(Boolean, default=False)


class RoomLayout(Base):
    """Arranjo de um comodo. Uma linha por comodo.

    `revision` sobe a cada gravacao: quando os dois estao editando juntos, quem
    salvar com revisao velha leva 409 em vez de apagar a mudanca do outro.
    """

    __tablename__ = "house_layout"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("house_rooms.id", ondelete="CASCADE"), unique=True, index=True
    )
    grid_data: Mapped[dict] = mapped_column(JSON, default=dict)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    updated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class HouseMess(Base):
    """Uma sujeira no chao de um comodo.

    Existe como LINHA no banco, e nao como um contador no pet, de proposito: a
    sujeira precisa ter lugar (comodo, celula) pra aparecer no cenario e alguem
    ter que ir ate ela pra limpar. Contador viraria um numero na tela, e a
    decisao registrada e que o bichinho tem que dar trabalho de verdade.
    """

    __tablename__ = "house_mess"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("house_rooms.id", ondelete="CASCADE"), index=True)
    col: Mapped[int] = mapped_column(Integer, default=0)
    row: Mapped[int] = mapped_column(Integer, default=0)
    kind: Mapped[str] = mapped_column(String(20), default="poop")  # poop|puddle|fur|crumbs
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    cleaned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cleaned_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Nao existe UniqueConstraint aqui de proposito: um indice em
    # (room_id, col, row, cleaned_at) NAO impediria duas sujeiras na mesma
    # celula, porque em SQL dois NULL sao considerados diferentes — e sujeira
    # por limpar tem cleaned_at NULO. Seria um indice que parece proteger e nao
    # protege. Quem garante celula livre e `_free_cell` em `pet_care.py`.


# ------------------------------------------------------------------ casal
class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    # text | image | audio | sticker
    type: Mapped[str] = mapped_column(String(10), default="text")
    media_path: Mapped[str] = mapped_column(String(200), default="")
    media_thumb: Mapped[str] = mapped_column(String(200), default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)  # so pra audio
    sticker: Mapped[str] = mapped_column(String(40), default="")
    reply_to: Mapped[int | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL"), nullable=True
    )
    reaction: Mapped[str] = mapped_column(String(10), default="")  # quem recebeu reage
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Moment(Base):
    """Mural de momentos (as "stories" privadas dos dois)."""

    __tablename__ = "moments"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    caption: Mapped[str] = mapped_column(Text, default="")
    media_path: Mapped[str] = mapped_column(String(200), default="")
    media_thumb: Mapped[str] = mapped_column(String(200), default="")
    happened_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    reactions: Mapped[dict] = mapped_column(JSON, default=dict)  # {user_id: "emoji"}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class LoveTap(Base):
    __tablename__ = "love_taps"

    id: Mapped[int] = mapped_column(primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(20))  # heart|kiss|hug|miss|poke
    seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class ImportantDate(Base):
    __tablename__ = "important_dates"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    day: Mapped[date] = mapped_column(Date, index=True)
    repeat_yearly: Mapped[bool] = mapped_column(Boolean, default=True)
    reminder_days_before: Mapped[int] = mapped_column(Integer, default=3)
    emoji: Mapped[str] = mapped_column(String(10), default="")
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ------------------------------------------------------------------ jogos
class MinigameMatch(Base):
    __tablename__ = "minigame_matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_type: Mapped[str] = mapped_column(String(30), index=True)
    status: Mapped[str] = mapped_column(String(20), default="waiting")  # waiting|in_progress|finished
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    player1_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    player2_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    player1_score: Mapped[int] = mapped_column(Integer, default=0)
    player2_score: Mapped[int] = mapped_column(Integer, default=0)
    turn_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    winner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    state: Mapped[dict] = mapped_column(JSON, default=dict)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class QuizQuestion(Base):
    """Banco de perguntas do "quem conhece melhor"."""

    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30), default="geral")
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Notification(Base):
    """Historico do que foi notificado. Serve pra tela de avisos e, principalmente,
    pra nao repetir aviso (lembrete de data, previsao de ciclo, streak em risco)."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(300), default="")
    url: Mapped[str] = mapped_column(String(120), default="/")
    dedupe_key: Mapped[str | None] = mapped_column(String(140), nullable=True, unique=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
