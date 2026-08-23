"""Data e hora de Brasilia, num lugar so.

Existe por causa de um erro que ja custou caro em outro projeto: "hoje" calculado
em UTC vira o dia seguinte a partir das 21h, e uma coluna DATE que trafega como
instante ("2026-08-22T00:00:00Z") volta pro navegador como 21/08 21:00. Aqui a
regra e unica:

  - dia de calendario e `date`, e viaja no JSON como texto "YYYY-MM-DD";
  - instante e `datetime` com timezone, e viaja como ISO com o offset junto;
  - "hoje" e sempre `today()` daqui, nunca `date.today()` do sistema.
"""

from datetime import date, datetime, timedelta, timezone

from .config import TZ_OFFSET_HOURS

BRT = timezone(timedelta(hours=TZ_OFFSET_HOURS))


def now() -> datetime:
    """Instante atual em Brasilia (consciente de timezone)."""
    return datetime.now(BRT)


def utcnow() -> datetime:
    """Instante atual em UTC — o que vai pras colunas de timestamp."""
    return datetime.now(timezone.utc)


def today() -> date:
    """O dia de calendario que esta valendo em Brasilia agora."""
    return now().date()


def to_brt(moment: datetime) -> datetime:
    """Converte um instante do banco pra Brasilia, assumindo UTC se vier sem tz."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(BRT)


def day_of(moment: datetime) -> date:
    """O dia de calendario brasileiro em que aquele instante caiu."""
    return to_brt(moment).date()


def iso_day(value: date | None) -> str | None:
    """Texto "YYYY-MM-DD" — a unica forma de mandar dia de calendario pro app."""
    return value.isoformat() if value else None


def parse_day(value: str | None) -> date | None:
    """Le "YYYY-MM-DD" vindo do app. Devolve None se nao for uma data valida.

    Devolve None em vez de estourar porque o texto vem de fora: "2026-13-45" passa
    no limite de tamanho do formulario e chegaria aqui. Deixar a excecao subir
    viraria erro 500 — quem manda data errada merece uma recusa limpa, e toda rota
    que usa isto ja trata o None como "data invalida".
    """
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None
