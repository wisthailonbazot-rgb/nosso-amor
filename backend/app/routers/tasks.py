from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import economy, missions, periods, push
from ..clock import today, utcnow
from ..db import get_db
from ..models import DailyMission, Task, TaskCompletion, User, WalletTransaction
from ..realtime import publish
from ..schemas import moment_iso
from ..security import current_user, partner_of

router = APIRouter(prefix="/api/tasks", tags=["tarefas"])

FREQUENCIES = ("once", "daily", "weekly")
MAX_REWARD = 200  # teto de recompensa: sem isso da pra criar tarefa de 1 milhao


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    assigned_to: int | None = None
    frequency: str = "once"
    reward_coins: int = Field(default=10, ge=0, le=MAX_REWARD)


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    assigned_to: int | None = None
    frequency: str | None = None
    reward_coins: int | None = Field(default=None, ge=0, le=MAX_REWARD)
    active: bool | None = None


def _validate(frequency: str, assigned_to: int | None, db: Session) -> None:
    if frequency not in FREQUENCIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Frequência inválida")
    if assigned_to is not None and db.get(User, assigned_to) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Essa pessoa não existe")


def _task_out(task: Task, done_by: TaskCompletion | None, users: dict[int, User]) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "assigned_to": task.assigned_to,
        "assigned_name": users[task.assigned_to].name if task.assigned_to in users else None,
        "frequency": task.frequency,
        "period_label": periods.label_for(task.frequency),
        "reward_coins": task.reward_coins,
        "active": task.active,
        "done": done_by is not None,
        "done_by": done_by.user_id if done_by else None,
        "done_by_name": users[done_by.user_id].name if done_by and done_by.user_id in users else None,
        "done_at": moment_iso(done_by.completed_at) if done_by else None,
    }


@router.get("")
def list_tasks(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    day = today()
    daily = missions.ensure_daily(db, day)
    db.commit()
    users = {u.id: u for u in db.query(User).all()}
    tasks = db.query(Task).filter(Task.active.is_(True)).order_by(Task.id).all()

    # Uma consulta so pra todas as conclusoes do periodo corrente de cada tarefa.
    wanted = {(t.id, periods.key_for(t.frequency, day)) for t in tasks}
    done_map: dict[tuple[int, str], TaskCompletion] = {}
    if wanted:
        rows = (
            db.query(TaskCompletion)
            .filter(TaskCompletion.task_id.in_([t.id for t in tasks]))
            .all()
        )
        for row in rows:
            if (row.task_id, row.period_key) in wanted:
                done_map[(row.task_id, row.period_key)] = row

    items = [
        _task_out(t, done_map.get((t.id, periods.key_for(t.frequency, day))), users) for t in tasks
    ]
    # tarefa unica ja concluida sai da lista: nao ha o que fazer com ela
    items = [i for i in items if not (i["frequency"] == "once" and i["done"])]

    mine = [i for i in items if i["assigned_to"] in (None, user.id)]
    claimed_total = db.query(DailyMission).filter(DailyMission.claimed.is_(True)).count()
    return {
        "items": items,
        "pending_for_me": sum(1 for i in mine if not i["done"]),
        "coins_available": sum(i["reward_coins"] for i in mine if not i["done"]),
        "daily_missions": [missions.out(m) for m in daily],
        "mission_day": day.isoformat(),
        "progression": {
            "level": 1 + claimed_total // 5,
            "claimed_total": claimed_total,
            "in_level": claimed_total % 5,
            "next_level_at": 5,
        },
    }


@router.post("/daily/{mission_id}/claim")
def claim_daily_mission(
    mission_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    mission = db.get(DailyMission, mission_id)
    if mission is None or mission.day != today():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Missão do dia não encontrada")
    if mission.progress < mission.goal:
        raise HTTPException(status.HTTP_409_CONFLICT, "Essa missão ainda não terminou")
    if mission.claimed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Essa recompensa já foi recebida")

    users = db.query(User).filter(User.active.is_(True)).all()
    paid = {}
    for person in users:
        tx = economy.try_earn(
            db, person.id, mission.reward_coins, "task", reference=f"mission:{mission.id}",
            note=mission.title, dedupe_key=f"mission:{mission.id}:user:{person.id}",
        )
        paid[person.id] = tx.amount if tx else 0
    mission.claimed = True
    mission.claimed_by = user.id
    mission.claimed_at = utcnow()
    db.commit()
    for person in users:
        publish("wallet", {"balance": economy.balance(db, person.id)}, to_user=person.id)
    publish("tasks", {"reason": "mission_claimed", "mission_id": mission.id})
    return {"ok": True, "earned_each": mission.reward_coins,
            "balance": economy.balance(db, user.id), "paid": paid}


@router.get("/done")
def list_done(user: User = Depends(current_user), db: Session = Depends(get_db), limit: int = 40) -> dict:
    users = {u.id: u for u in db.query(User).all()}
    rows = (
        db.query(TaskCompletion)
        .order_by(TaskCompletion.completed_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    tasks = {t.id: t for t in db.query(Task).all()}
    return {
        "items": [
            {
                "id": r.id,
                "task_title": tasks[r.task_id].title if r.task_id in tasks else "(apagada)",
                "user_name": users[r.user_id].name if r.user_id in users else "?",
                "reward_coins": r.reward_coins,
                "completed_at": moment_iso(r.completed_at),
            }
            for r in rows
        ]
    }


@router.post("")
def create_task(
    payload: TaskIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    _validate(payload.frequency, payload.assigned_to, db)
    task = Task(
        title=payload.title.strip(),
        description=payload.description.strip(),
        assigned_to=payload.assigned_to,
        frequency=payload.frequency,
        reward_coins=payload.reward_coins,
        created_by=user.id,
    )
    db.add(task)
    db.flush()

    partner = partner_of(db, user)
    if partner and payload.assigned_to == partner.id:
        push.send_to_user(
            db,
            partner.id,
            title="Nova tarefa pra você",
            body=f"{user.name}: {task.title}",
            url="/tarefas",
            kind="tarefa",
        )
    db.commit()
    publish("tasks", {"reason": "created"})
    users = {u.id: u for u in db.query(User).all()}
    return _task_out(task, None, users)


@router.patch("/{task_id}")
def edit_task(
    task_id: int,
    payload: TaskPatch,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarefa não encontrada")
    data = payload.model_dump(exclude_unset=True)
    _validate(data.get("frequency", task.frequency), data.get("assigned_to", task.assigned_to), db)
    for field, value in data.items():
        setattr(task, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    publish("tasks", {"reason": "updated"})
    users = {u.id: u for u in db.query(User).all()}
    return _task_out(task, None, users)


@router.delete("/{task_id}")
def delete_task(
    task_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarefa não encontrada")
    # desativa em vez de apagar: apagar levaria junto o historico de conclusoes,
    # e com ele a explicacao de moedas que ja foram pagas
    task.active = False
    db.commit()
    publish("tasks", {"reason": "deleted"})
    return {"ok": True}


@router.post("/{task_id}/complete")
def complete_task(
    task_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    task = db.get(Task, task_id)
    if task is None or not task.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarefa não encontrada")
    if task.assigned_to is not None and task.assigned_to != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Essa tarefa é da outra pessoa")

    period = periods.key_for(task.frequency, today())
    completion = TaskCompletion(
        task_id=task.id, user_id=user.id, period_key=period, reward_coins=task.reward_coins
    )
    db.add(completion)
    try:
        db.flush()  # indice unico (task_id, period_key) barra a repeticao
    except Exception:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Essa tarefa já foi concluída {periods.label_for(task.frequency) or 'antes'}.",
        )

    earned = 0
    if task.reward_coins > 0:
        tx = economy.try_earn(
            db,
            user.id,
            task.reward_coins,
            "task",
            reference=str(task.id),
            note=task.title,
            dedupe_key=f"task:{task.id}:{period}",
        )
        earned = tx.amount if tx else 0

    partner = partner_of(db, user)
    if partner:
        push.send_to_user(
            db,
            partner.id,
            title="Tarefa concluída",
            body=f"{user.name} fez: {task.title}",
            url="/tarefas",
            kind="tarefa",
            dedupe_key=f"task-done:{task.id}:{period}",
        )
    db.commit()

    new_balance = economy.balance(db, user.id)
    publish("wallet", {"balance": new_balance}, to_user=user.id)
    publish("tasks", {"reason": "completed", "task_id": task.id})
    return {"ok": True, "earned": earned, "balance": new_balance}


@router.post("/{task_id}/undo")
def undo_task(
    task_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    """Desfaz a conclusao do periodo corrente e devolve as moedas.

    Sem isso, um toque errado numa tarefa de 50 moedas seria dinheiro criado do
    nada e sem volta. A devolucao entra como GASTO no extrato — o saldo continua
    batendo com a soma das linhas, e nenhuma linha e apagada.
    """
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarefa não encontrada")
    period = periods.key_for(task.frequency, today())
    completion = (
        db.query(TaskCompletion)
        .filter(TaskCompletion.task_id == task.id, TaskCompletion.period_key == period)
        .first()
    )
    if completion is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Essa tarefa não está concluída")
    if completion.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Quem concluiu foi a outra pessoa")

    refund = completion.reward_coins
    if refund > economy.balance(db, user.id):
        # devolver mais do que a pessoa tem deixaria saldo negativo; melhor explicar
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Você já gastou essas moedas. Precisa de {refund} para desfazer.",
        )

    if refund > 0:
        economy.spend(
            db,
            user.id,
            refund,
            "task",
            reference=str(task.id),
            note=f"desfez: {task.title}",
        )
        # Libera a chave anti-duplicidade sem apagar a linha do extrato: sem isso,
        # concluir de novo no mesmo periodo nao pagaria nada (o banco recusaria a
        # chave repetida em silencio) e a tarefa ficaria "feita de graca".
        original = (
            db.query(WalletTransaction)
            .filter(WalletTransaction.dedupe_key == f"task:{task.id}:{period}")
            .first()
        )
        if original is not None:
            original.dedupe_key = f"task:{task.id}:{period}:desfeita:{original.id}"

    db.delete(completion)
    db.commit()

    new_balance = economy.balance(db, user.id)
    publish("wallet", {"balance": new_balance}, to_user=user.id)
    publish("tasks", {"reason": "undone", "task_id": task.id})
    return {"ok": True, "refunded": refund, "balance": new_balance}
