"""Leitura/escrita dos ajustes do casal.

Tudo mora em `app_settings` como chave -> JSON. Os defaults ficam aqui, num lugar
so, pra tela nunca receber `null` e ter que adivinhar o que fazer.
"""

from sqlalchemy.orm import Session

from .models import AppSetting

DEFAULTS: dict[str, dict] = {
    # Contador de dias juntos.
    "couple": {"start_date": "", "name": "Nosso app"},
    # O que o parceiro ve do ciclo. Decidido por quem registra, na tela de ciclo.
    #   resumo   = fase atual, previsao e a dica de "como ajudar" (padrao)
    #   completo = tudo, inclusive sintomas e notas
    #   nada     = o modulo some pro parceiro
    "cycle_privacy": {"share": "resumo"},
    # Economia: quanto rende cada coisa.
    #
    # Os numeros subiram em 26/08 porque a conta do dia nao fechava. Medida com
    # os valores antigos, uma pessoa tirava ~90 Coracoes por dia jogando tudo o
    # que da pra jogar — e so a comida do bichinho comia ~60 deles (a fome caia
    # 3 pontos por hora, 72 por dia, e a racao dava 30 por 25 moedas). Sobravam
    # uns 30: um sofa de 300 levava dez dias. O jogo virou trabalho.
    #
    # O conserto nao e "aumentar um numero": e mexer nos DOIS lados da conta —
    # a renda subiu e o custo de manutencao desceu (ver `pet_decay` logo abaixo
    # e os precos de comida em `catalog.py`). Aumentar so a renda deixaria a
    # manutencao comendo a mesma fatia, que era o defeito.
    "economy": {
        "checkin_base": 25,
        "checkin_streak_bonus": 3,
        "checkin_streak_cap": 30,
        "minigame_win": 25,
        "minigame_draw": 10,
        "minigame_loss": 5,
    },
    # Decaimento do pet, em pontos por hora.
    #
    # A fome caiu de 3,0 para 2,0. Nao e "deixar o bichinho mais facil": 3,0 por
    # hora significa 72 pontos por DIA, e a unica forma de repor 72 pontos era
    # comprando comida — ou seja, a fome era um imposto diario sobre a renda,
    # nao um cuidado. Com 2,0 ele continua ficando com fome se for esquecido
    # (48 pontos por dia; largado dois dias, chega a zero e adoece), so que dá
    # pra cuidar dele E juntar dinheiro pra casa no mesmo dia.
    "pet_decay": {"hunger": 2.0, "happiness": 2.0, "energy": 2.5, "hygiene": 1.5},
}


def get(db: Session, key: str) -> dict:
    row = db.get(AppSetting, key)
    base = dict(DEFAULTS.get(key, {}))
    if row and isinstance(row.value, dict):
        base.update(row.value)
    return base


def put(db: Session, key: str, patch: dict) -> dict:
    row = db.get(AppSetting, key)
    if row is None:
        row = AppSetting(key=key, value={})
        db.add(row)
        db.flush()
    merged = dict(row.value or {})
    merged.update(patch)
    row.value = merged
    # JSON mutavel: sem o flag_modified o SQLAlchemy nao percebe a troca do dict
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(row, "value")
    db.flush()
    return get(db, key)
