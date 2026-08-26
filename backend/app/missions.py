"""Missões infinitas: rotação diária determinística e progresso por ações reais."""

import random

from sqlalchemy.orm import Session

from .clock import today, utcnow
from .models import DailyMission


# As recompensas dobraram em 26/08. As cinco missoes do dia sao a MAIOR fonte
# de renda do app — e valiam ~100 Coracoes somadas, quando um sofa custa 300.
# Elas sao tambem a fonte certa pra pesar mais do que as outras: pedem coisas
# que so acontecem se as duas pessoas usarem o app naquele dia, entao nao ha
# como moer sozinho. Ver a conta inteira em `settings_store.py`.
POOL = (
    ("conversa", "chat_send", "Conversa em dia", "Mandem mensagens um para o outro", 4, 36),
    ("carinho", "love_tap", "Lembrei de você", "Mandem cutucadas carinhosas", 2, 32),
    ("comida_pet", "pet_feed", "Barriguinha cheia", "Alimentem o bichinho", 1, 40),
    ("brincar_pet", "pet_play", "Hora de brincar", "Brinquem com o bichinho", 1, 44),
    ("limpar_pet", "pet_clean", "Casa cheirosa", "Limpem uma sujeira do bichinho", 1, 48),
    ("comprar", "shop_buy", "Um mimo pra nós", "Comprem algo na loja", 1, 36),
    ("decorar", "house_save", "Nosso cantinho", "Salvem uma mudança na casa", 1, 40),
    ("presenca", "checkin", "Presentes juntos", "Os dois façam check-in", 2, 52),
    ("jogar_pet", "pet_game", "Dupla de aventureiros", "Terminem uma aventura da bolinha", 1, 44),
)


def ensure_daily(db: Session, day=None) -> list[DailyMission]:
    day = day or today()
    rows = db.query(DailyMission).filter(DailyMission.day == day).order_by(DailyMission.id).all()
    if rows:
        return rows
    picker = random.Random(day.toordinal() * 7919)
    for code, action, title, description, goal, reward in picker.sample(POOL, 5):
        db.add(DailyMission(day=day, code=code, action=action, title=title,
                            description=description, goal=goal, reward_coins=reward))
    db.flush()
    return db.query(DailyMission).filter(DailyMission.day == day).order_by(DailyMission.id).all()


def record(db: Session, action: str, amount: int = 1) -> list[int]:
    """Avança objetivos ativos, mas nunca passa da meta."""
    if amount <= 0:
        return []
    changed = []
    for mission in ensure_daily(db):
        if mission.action == action and not mission.claimed and mission.progress < mission.goal:
            mission.progress = min(mission.goal, mission.progress + amount)
            changed.append(mission.id)
    return changed


def out(row: DailyMission) -> dict:
    return {
        "id": row.id, "code": row.code, "action": row.action, "title": row.title,
        "description": row.description, "goal": row.goal, "progress": row.progress,
        "reward_coins": row.reward_coins, "complete": row.progress >= row.goal,
        "claimed": row.claimed,
    }
