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
    "economy": {
        "checkin_base": 15,
        "checkin_streak_bonus": 2,
        "checkin_streak_cap": 30,
        "minigame_win": 25,
        "minigame_draw": 10,
        "minigame_loss": 5,
    },
    # Decaimento do pet, em pontos por hora.
    "pet_decay": {"hunger": 3.0, "happiness": 2.0, "energy": 2.5, "hygiene": 1.5},
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
