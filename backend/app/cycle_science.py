"""O cálculo do ciclo, e de onde vem cada número.

Este arquivo existe para que nenhuma conta aqui seja "achismo". Toda constante tem
fonte, e as fontes viajam pro app (`SOURCES`) para aparecerem na tela — quem usa
consegue conferir de onde saiu a previsão.

O que a literatura diz, e o que isso obriga o código a fazer:

1. **Ciclo normal tem 24 a 38 dias.** (ACOG, Committee Opinion 651 — "Menstruation
   in Girls and Adolescents: Using the Menstrual Cycle as a Vital Sign".) Fora
   dessa faixa o app não diagnostica nada; ele só deixa de fingir precisão e
   sugere conversar com um médico.

2. **A fase lútea NÃO é fixa em 14 dias.** Medindo 612.613 ciclos ovulatórios
   reais, Bull et al. (2019, npj Digital Medicine) encontraram média de 12,4 dias,
   com intervalo de confiança de 7 a 17. Por isso a ovulação estimada aqui usa 13
   dias — entre a média medida e os 14 do ensino clássico — e **a janela fértil é
   mostrada como faixa, nunca como um dia exato**.

3. **A janela fértil tem seis dias e termina no dia da ovulação.** (Wilcox,
   Weinberg & Baird, 1995, New England Journal of Medicine.) A chance por dia sobe
   de cerca de 0,10 cinco dias antes até cerca de 0,33 no dia da ovulação. Depois
   da ovulação ela cai perto de zero.

4. **Calendário não prevê ovulação com segurança.** (Wilcox, Dunson & Baird, 2000,
   BMJ.) Mesmo em ciclos regulares, o dia da ovulação varia muito. É por isso que
   o app diz "estimativa" em toda tela e **avisa, em texto, que isso não serve
   como método anticoncepcional**.

5. **Regularidade é a diferença entre o ciclo mais curto e o mais longo.** (FIGO,
   revisão de 2018 — Munro et al.) Até 7 dias de variação é regular entre 26 e 41
   anos; até 9 dias entre 18-25 e 42-45. Como o app não pergunta idade, usa o
   limite mais folgado (9) para não rotular alguém de irregular sem necessidade.
"""

from __future__ import annotations

import statistics
from datetime import date, timedelta

# ------------------------------------------------------------------ constantes
CYCLE_MIN_NORMAL = 24  # ACOG 651
CYCLE_MAX_NORMAL = 38  # ACOG 651
LUTEAL_DAYS = 13  # entre a média medida (12,4 — Bull 2019) e os 14 clássicos
FERTILE_WINDOW_DAYS = 6  # Wilcox 1995: seis dias terminando no dia da ovulação
REGULARITY_TOLERANCE = 9  # FIGO 2018, limite mais folgado (18-25 e 42-45 anos)
DEFAULT_CYCLE = 28  # só como chute inicial, enquanto não há ciclo registrado
MAX_CYCLES_CONSIDERED = 12  # ciclo de dois anos atrás não descreve o corpo de hoje

SOURCES = [
    {
        "id": "acog651",
        "label": "ACOG — Committee Opinion 651",
        "detail": "Ciclo normal: 24 a 38 dias. Usar o ciclo como sinal vital.",
        "url": "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign",
    },
    {
        "id": "bull2019",
        "label": "Bull et al., 2019 — npj Digital Medicine",
        "detail": "612.613 ciclos reais: fase lútea média de 12,4 dias (7 a 17), não 14 fixos.",
        "url": "https://www.nature.com/articles/s41746-019-0152-7",
    },
    {
        "id": "wilcox1995",
        "label": "Wilcox, Weinberg & Baird, 1995 — NEJM",
        "detail": "A janela fértil tem seis dias e termina no dia da ovulação.",
        "url": "https://www.nejm.org/doi/full/10.1056/NEJM199512073332301",
    },
    {
        "id": "wilcox2000",
        "label": "Wilcox, Dunson & Baird, 2000 — BMJ",
        "detail": "Mesmo em ciclo regular, o dia da ovulação varia muito: calendário é estimativa.",
        "url": "https://www.bmj.com/content/321/7271/1259",
    },
    {
        "id": "figo2018",
        "label": "FIGO — Munro et al., 2018",
        "detail": "Regular = diferença de até 7 dias entre o ciclo mais curto e o mais longo (9 dos 18 aos 25 e dos 42 aos 45).",
        "url": "https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.12666",
    },
]

DISCLAIMER = (
    "Isto é uma estimativa feita a partir dos seus próprios registros — não é "
    "método anticoncepcional e não substitui consulta médica. Mesmo em ciclos "
    "regulares, o dia da ovulação varia bastante (Wilcox 2000)."
)

PHASES = {
    "menstrual": {
        "name": "Menstruação",
        "about": "O corpo está eliminando o revestimento do útero.",
        "energy": "costuma ser o período de menos energia",
        "help": "Bolsa quente, bebida quente, menos compromisso e nada de cobrança.",
    },
    "folicular": {
        "name": "Folicular",
        "about": "Depois da menstruação, o corpo prepara um novo óvulo.",
        "energy": "a energia costuma voltar e subir",
        "help": "Bom momento pra marcar coisa nova, sair, planejar junto.",
    },
    "fertil": {
        "name": "Janela fértil",
        "about": "Os dias em torno da ovulação — a faixa de maior chance de gravidez.",
        "energy": "costuma ser o pico de disposição",
        "help": "Se não é hora de engravidar, é o período que pede mais cuidado.",
    },
    "lutea": {
        "name": "Lútea",
        "about": "Depois da ovulação, até a próxima menstruação.",
        "energy": "a energia costuma cair aos poucos",
        "help": "Paciência, comida boa, carinho sem precisar de motivo.",
    },
    "desconhecida": {
        "name": "Ainda sem dados",
        "about": "Faltam registros pra saber em que fase o ciclo está.",
        "energy": "",
        "help": "Registrar o começo da menstruação já resolve.",
    },
}

SYMPTOMS = [
    "cólica", "dor de cabeça", "dor nas costas", "seios sensíveis", "inchaço",
    "náusea", "espinha", "insônia", "sono demais", "vontade de doce",
    "ansiedade", "irritação", "choro fácil", "sem paciência", "libido alta",
    "libido baixa", "corrimento", "intestino solto", "prisão de ventre",
]

MOODS = ["ótima", "bem", "neutra", "pra baixo", "irritada", "ansiosa", "sensível"]

FLOW_LEVELS = [
    {"code": "none", "label": "nada"},
    {"code": "spotting", "label": "borra"},
    {"code": "light", "label": "leve"},
    {"code": "medium", "label": "médio"},
    {"code": "heavy", "label": "intenso"},
]


# ------------------------------------------------------------------ cálculo
def cycle_lengths(starts: list[date]) -> list[int]:
    """Distância entre inícios de menstruação consecutivos.

    Descarta intervalo absurdo (menos de 15 ou mais de 90 dias): quase sempre é
    registro esquecido ou digitado errado, e um valor desses estraga a média de
    todos os outros.
    """
    ordered = sorted(starts)
    lengths = []
    for previous, current in zip(ordered, ordered[1:]):
        gap = (current - previous).days
        if 15 <= gap <= 90:
            lengths.append(gap)
    return lengths[-MAX_CYCLES_CONSIDERED:]


def analyze(period_starts: list[date], period_ends: dict[date, date], today: date) -> dict:
    """Tudo que o app precisa saber sobre o ciclo, num dicionário só.

    Usa MEDIANA, não média: um ciclo estranho (doença, viagem, estresse) puxa a
    média e desloca a previsão inteira; a mediana ignora o ponto fora da curva.
    """
    starts = sorted(period_starts)
    lengths = cycle_lengths(starts)
    last_start = starts[-1] if starts else None

    result = {
        "has_data": bool(starts),
        "cycles_recorded": len(lengths),
        "last_period_start": last_start,
        "cycle_length": None,
        "cycle_variation": None,
        "period_length": None,
        "predicted_next_start": None,
        "ovulation_day": None,
        "fertile_start": None,
        "fertile_end": None,
        "current_phase": "desconhecida",
        "cycle_day": None,
        "days_until_next": None,
        "confidence": "sem dados",
        "regular": None,
        "warnings": [],
        "sources": ["acog651", "bull2019", "wilcox1995", "wilcox2000", "figo2018"],
    }

    if last_start is None:
        return result

    result["cycle_day"] = (today - last_start).days + 1

    # duração da menstruação, pra saber quando a fase menstrual termina
    durations = [
        (end - start).days + 1
        for start, end in period_ends.items()
        if end >= start and (end - start).days <= 14
    ]
    if durations:
        result["period_length"] = round(statistics.median(durations), 1)

    if not lengths:
        # um registro só: dá pra mostrar o dia do ciclo, mas prever seria invenção
        result["confidence"] = "sem dados"
        result["warnings"].append(
            "Com uma menstruação registrada ainda não dá pra prever a próxima. "
            "A partir de três ciclos a estimativa começa a fazer sentido."
        )
        result["current_phase"] = _phase_without_prediction(result, today, last_start)
        return result

    median_length = int(round(statistics.median(lengths)))
    variation = max(lengths) - min(lengths)
    result["cycle_length"] = median_length
    result["cycle_variation"] = variation

    # FIGO 2018: regular = diferença pequena entre o ciclo mais curto e o mais longo
    result["regular"] = variation <= REGULARITY_TOLERANCE

    predicted = last_start + timedelta(days=median_length)
    # Se a previsão já passou (atraso), continua mostrando a data prevista — o
    # atraso em si é a informação útil, e empurrar a data pra frente esconderia isso.
    result["predicted_next_start"] = predicted
    result["days_until_next"] = (predicted - today).days

    ovulation = predicted - timedelta(days=LUTEAL_DAYS)
    result["ovulation_day"] = ovulation
    result["fertile_start"] = ovulation - timedelta(days=FERTILE_WINDOW_DAYS - 1)
    result["fertile_end"] = ovulation

    result["confidence"] = _confidence(len(lengths), variation)
    result["current_phase"] = _phase(result, today, last_start)
    result["warnings"] = _warnings(median_length, variation, len(lengths), result, today)
    return result


def _confidence(cycles: int, variation: int) -> str:
    """Quantos ciclos e quão constantes.

    "sem dados" é reservado para quando NÃO existe previsão nenhuma. Basta um
    ciclo completo pra já haver uma previsão na tela — e mostrar uma data dizendo
    ao lado "sem dados" seria contraditório: a pessoa lê a data, confia nela, e o
    rótulo que deveria avisar da fragilidade não avisa nada. Com um ciclo, a
    palavra certa é "baixa".

    Variação grande derruba a confiança mesmo com muitos registros: ciclo que
    pula de 24 pra 40 dias não fica previsível por ter histórico longo.
    """
    if cycles < 1:
        return "sem dados"
    if variation > REGULARITY_TOLERANCE:
        return "baixa"
    if cycles < 3:
        return "baixa"
    if cycles < 6:
        return "média"
    return "boa"


def _phase_without_prediction(result: dict, today: date, last_start: date) -> str:
    length = result.get("period_length") or 5
    return "menstrual" if (today - last_start).days < length else "folicular"


def _phase(result: dict, today: date, last_start: date) -> str:
    period_length = result.get("period_length") or 5
    if (today - last_start).days < period_length:
        return "menstrual"
    fertile_start = result["fertile_start"]
    fertile_end = result["fertile_end"]
    if fertile_start and fertile_start <= today <= fertile_end:
        return "fertil"
    if fertile_end and today > fertile_end:
        return "lutea"
    return "folicular"


def _warnings(length: int, variation: int, cycles: int, result: dict, today: date) -> list[str]:
    """Avisos são informativos, nunca diagnóstico — e sempre dizem a fonte."""
    notes = []

    if length < CYCLE_MIN_NORMAL:
        notes.append(
            f"Seus ciclos têm ficado em torno de {length} dias. Abaixo de "
            f"{CYCLE_MIN_NORMAL} dias foge da faixa que o ACOG considera comum — "
            "vale comentar com um médico, sem susto."
        )
    elif length > CYCLE_MAX_NORMAL:
        notes.append(
            f"Seus ciclos têm ficado em torno de {length} dias. Acima de "
            f"{CYCLE_MAX_NORMAL} dias foge da faixa que o ACOG considera comum — "
            "vale comentar com um médico, sem susto."
        )

    if variation > REGULARITY_TOLERANCE:
        notes.append(
            f"A diferença entre seu ciclo mais curto e o mais longo é de {variation} "
            f"dias. Pelo critério da FIGO, acima de {REGULARITY_TOLERANCE} já conta "
            "como irregular — a previsão fica mais grosseira, e é só isso."
        )

    if cycles < 3:
        notes.append(
            "A previsão melhora bastante a partir de três ciclos registrados. "
            "Por enquanto ela é um chute educado."
        )

    predicted = result.get("predicted_next_start")
    if predicted and today > predicted:
        late = (today - predicted).days
        if late >= 1:
            notes.append(
                f"A menstruação está {late} dia{'s' if late > 1 else ''} depois do "
                "previsto. Atraso acontece por muita coisa — estresse, sono, "
                "viagem, doença. Se passar bastante e houver chance de gravidez, "
                "um teste responde."
            )
    return notes


def phase_info(phase: str) -> dict:
    return PHASES.get(phase, PHASES["desconhecida"])


def sources_for(ids: list[str]) -> list[dict]:
    index = {s["id"]: s for s in SOURCES}
    return [index[i] for i in ids if i in index]
