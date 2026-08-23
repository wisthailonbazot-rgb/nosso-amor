"""Chave de periodo pra recompensa que se repete.

Uma tarefa diaria pode ser concluida uma vez por DIA; a semanal, uma vez por
SEMANA. Em vez de comparar datas na mao em cada rota (e errar em virada de ano),
o periodo vira um texto e o indice unico do banco faz o resto.

A semana comeca na segunda (padrao ISO, que e como as pessoas contam aqui), e o
ano da chave e o ano ISO — sem isso, 31/12/2026 e 01/01/2027 cairiam em semanas
com o mesmo numero e a tarefa nao poderia ser feita nos dois.
"""

from datetime import date


def key_for(frequency: str, day: date) -> str:
    if frequency == "daily":
        return day.isoformat()
    if frequency == "weekly":
        iso_year, iso_week, _ = day.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    return "once"


def label_for(frequency: str) -> str:
    return {"daily": "hoje", "weekly": "esta semana"}.get(frequency, "")
