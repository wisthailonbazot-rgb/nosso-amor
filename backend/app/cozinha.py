"""Cozinha do Amor — o catálogo e a simulação.

O projeto inteiro, com as fontes da pesquisa, está em `docs/jogo-cozinha.md`.
Aqui fica só o que o código precisa saber, e o porquê das escolhas que doem.

------------------------------------------------------------------- o princípio

**Nada nesta partida acontece por um relógio rodando.** Tudo o que está em
andamento carrega a hora em que TERMINA, e `avancar()` aplica de uma vez tudo o
que venceu desde a última olhada.

Isso não é economia de processo: é o que torna o jogo possível a dois sem um
laço de tempo real. Como todo prazo está no estado, o app não precisa saber
nenhuma regra — ele desenha uma barra andando entre duas horas conhecidas. Quem
decide que a panela queimou é só este arquivo.

> Se o app também soubesse a regra, seriam **dois donos pro mesmo fato**, que é o
> defeito mais caro da história deste projeto (o prompt com dois donos, o chão do
> bichinho com dois números, a segunda grade da batalha naval). Aqui ele foi
> evitado por desenho, e não por disciplina.

É o mesmo mecanismo do bichinho, que decai por tempo decorrido em vez de por
timer — então não há nada novo pra manter.

--------------------------------------------------------------------- o tempo

Tudo em **milissegundos de relógio de parede** (`utcnow()` em ms). Não é dia de
calendário, então a regra do `YYYY-MM-DD` (armadilha 1 do HANDOFF) não se aplica:
aqui o que importa é duração, e duração é a mesma em qualquer fuso.
"""

from __future__ import annotations

import copy
import random
from datetime import datetime, timezone

# ============================================================ os ingredientes
#
# O caminho de cada um é curto de proposito: cru -> picado -> cozido. A
# dificuldade do jogo vem de quantos caminhos correm ao MESMO TEMPO, e nao de
# decorar combinacao — foi a licao da analise do Overcooked, onde a receita e
# sempre simples e o aperto vem da fila.

CRU = "cru"
PICADO = "picado"
COZIDO = "cozido"
QUEIMADO = "queimado"

INGREDIENTES = {
    # `pica`: da pra picar? `cozinha`: da pra cozinhar (e a partir de que estado)
    # `g`: genero, so pra a DICA sair em portugues certo ("a alface picada", e
    # nao "o alface picado"). Texto torto tira a confianca de quem le a dica.
    "alface": {"nome": "alface", "g": "f", "cor": "#7cc45f", "pica": True, "cozinha": None},
    "tomate": {"nome": "tomate", "g": "m", "cor": "#e0553f", "pica": True, "cozinha": PICADO},
    "carne": {"nome": "carne", "g": "f", "cor": "#b5644f", "pica": False, "cozinha": CRU},
    "massa": {"nome": "massa", "g": "f", "cor": "#e8c86a", "pica": False, "cozinha": CRU},
    "pao": {"nome": "pão", "g": "m", "cor": "#d2a05e", "pica": False, "cozinha": None},
}


def _o(chave: str) -> str:
    """"o" ou "a", conforme o ingrediente."""
    return "a" if INGREDIENTES.get(chave, {}).get("g") == "f" else "o"


def _concorda(palavra: str, genero: str) -> str:
    """"picado" -> "picada" quando o dono da palavra e feminino."""
    if genero == "f" and palavra.endswith("o"):
        return palavra[:-1] + "a"
    return palavra


def _passo(ingrediente: str, estado: str) -> str | None:
    """O próximo estado possível, ou None se aquele ingrediente já está pronto.

    Uma função só pra os dois lados (tábua e panela) perguntarem a mesma coisa —
    a alternativa seria a tábua ter a lista dela e a panela a dela, e as duas
    envelhecerem em direções diferentes.
    """
    receita = INGREDIENTES.get(ingrediente)
    if receita is None:
        return None
    if estado == CRU and receita["pica"]:
        return PICADO
    if receita["cozinha"] == estado:
        return COZIDO
    return None


# =================================================================== receitas
#
# A comparacao e por MULTICONJUNTO (a mesma coisa duas vezes conta duas vezes) e
# a ORDEM NAO IMPORTA — montar salada tomate-primeiro ou alface-primeiro da no
# mesmo. Exigir ordem seria dificuldade de decoreba, nao de cozinha.

RECEITAS = {
    "salada": {
        "nome": "Salada", "g": "f",
        "itens": [("alface", PICADO), ("tomate", PICADO)],
        "pontos": 60,
        "prazo_ms": 90_000,
    },
    "macarrao": {
        "nome": "Macarrão", "g": "m",
        "itens": [("massa", COZIDO), ("tomate", COZIDO)],
        "pontos": 90,
        "prazo_ms": 120_000,
    },
    "hamburguer": {
        "nome": "Hambúrguer", "g": "m",
        "itens": [("pao", CRU), ("carne", COZIDO), ("alface", PICADO)],
        "pontos": 110,
        "prazo_ms": 120_000,
    },
    "casal": {
        "nome": "Prato do casal", "g": "m",
        "itens": [("massa", COZIDO), ("carne", COZIDO), ("tomate", PICADO)],
        "pontos": 150,
        "prazo_ms": 145_000,
    },
}


def _chave(itens) -> tuple:
    """Assinatura de um conjunto de ingredientes, pra comparar prato com pedido.

    Ordenar é o que torna a comparação independente da ordem de montagem. É uma
    tupla (e não um `set`) porque repetição conta: dois tomates não são um.
    """
    return tuple(sorted((i["ing"], i["estado"]) for i in itens))


RECEITA_POR_CHAVE = {
    tuple(sorted(r["itens"])): codigo for codigo, r in RECEITAS.items()
}

# O que pode ir num prato: exatamente os pares (ingrediente, estado) que ALGUMA
# receita pede. Nem um a mais, nem um a menos.
#
# A primeira versao desta regra era "so entra o que nao tem mais preparo pela
# frente", e ela estava ERRADA — o tomate picado ainda pode ir pra panela, entao
# ela recusava justamente o ingrediente da salada. O jogo ficava impossivel de
# terminar e a mensagem dizia "isso nao vai junto", que nao ajuda ninguem.
#
# Tirar a lista das receitas, em vez de escrever a mao, e o que faz ela continuar
# certa quando alguem acrescentar um prato: nao existe segunda lista pra
# envelhecer em direcao diferente.
MONTAVEIS = {par for r in RECEITAS.values() for par in r["itens"]}


# ==================================================================== tempos
#
# Todos em milissegundos. Estes numeros sao o EQUILIBRIO do jogo, e o lugar de
# mexer quando o dono disser "ta facil" ou "ta impossivel".

T_PICAR = 2_600
T_COZINHAR = 7_000
# Subiu de 6,5 s pra 12 s a pedido do dono ("aumente um pouquinho o tempo para
# queimar"). 6,5 s obrigava a ficar ao lado da panela, e ai cozinhar deixava de
# ser "ponha e va fazer outra coisa" — que e justamente o que da ritmo ao jogo.
# Com 12 s da pra picar um ingrediente inteiro (2,6 s) e atravessar a cozinha
# antes de estragar.
T_QUEIMAR = 12_000  # depois de cozido, quanto tempo ate estragar
T_LAVAR = 2_200
T_PASSO = 260       # quanto leva pra andar UMA celula
T_SUJAR = 9_000     # depois de entregue, quanto tempo ate o prato voltar sujo

DURACAO_RODADA = 180_000  # 3 minutos
PRATOS = 3                # poucos de propósito: e o que obriga alguem a lavar

# O ritmo dos pedidos APERTA com o tempo: comeca folgado e fecha. E a forma de
# ter "sempre mais tarefa do que mao" (Overcooked) sem despejar tudo no comeco,
# o que so confundiria nos primeiros dez segundos.
#
# ------------------------------------------------- por que estes numeros mudaram
#
# O dono jogou e disse: *"o tempo para executar cada receita e bem curto, nunca
# da tempo de fazer"*. Medi antes de mexer, e ele estava certo — mas a causa nao
# era o prazo de cada pedido, era a FILA.
#
# Uma receita isolada leva de 11 s (salada) a 27 s (prato do casal), com prazos
# de 55 a 90 s: folga de sobra. So que os pedidos chegavam a cada 6 a 11 s, e um
# cozinheiro sozinho serve um a cada ~22 s. A fila crescia mais rapido do que
# qualquer pessoa consegue servir, e ai TODO pedido parecia curto — porque quando
# se chegava nele, ele ja estava acabando.
#
# > **Medido, jogando PERFEITO pela propria dica** (o teto do que da pra fazer):
# > sozinho entregava 3 ou 4 e **perdia 4 ou 5** por rodada. Uma pessoa de
# > verdade faz pior que isso.
#
# Duas mudancas, e a segunda e a que importa:
#
#  1. os prazos subiram (~+45%), porque um pedido tem que sobreviver na fila
#     enquanto o anterior e feito;
#  2. o intervalo entre pedidos passou a depender de QUANTAS MAOS existem. Antes
#     era o mesmo pra um e pra dois, o que fazia o modo sozinho ser
#     matematicamente impossivel enquanto o modo a dois era so dificil.
PEDIDO_INTERVALO_INICIAL = 26_000
PEDIDO_INTERVALO_FINAL = 19_000
PEDIDOS_SIMULTANEOS = 3

# Quanto o intervalo estica quando ha um cozinheiro so. Metade das maos nao pede
# o dobro do tempo (da pra adiantar uma coisa enquanto outra cozinha), mas pede
# bem mais do que nada — este numero saiu de medir, nao de chutar.
FOLGA_SOZINHO = 1.8

PONTOS_PERDIDO = -25   # deixou vencer
PONTOS_ERRADO = -15    # entregou o prato errado
# Errado dói menos que perdido de propósito: entregar errado é uma tentativa que
# deu errado, e punir tentativa faz jogar defensivo. Deixar vencer é não ter ido.


# ==================================================================== a planta
#
# A cozinha e um retangulo de celulas. As estacoes ocupam celulas e NAO se anda
# em cima delas; o cozinheiro fica numa celula livre VIZINHA e age dali. E o
# jeito do genero, e e o que faz a distancia importar.
#
# A planta e DADO, entao nivel novo e uma entrada nova aqui — nao codigo novo.

LARGURA = 8
ALTURA = 5

# tipo:parametro. "." é chão livre.
# TODA estacao precisa de pelo menos uma celula livre VIZINHA, senao ela e
# inalcancavel — e o jogo nao avisa: o toque simplesmente nao faz nada. A
# primeira planta tinha duas despensas de canto assim, e o smoke passou a varrer
# isso.
#
# ---------------------------------------------- por que a BANCADA saiu do meio
#
# Ela era uma ilha em (3,2)/(3,3), e o dono reclamou: *"a bancada ta na frente
# dos outros objetos, coloque ela em outro lugar que nao atrapalhe"*. Ele esta
# certo, e o motivo e da projecao: em isometrico quem tem col+row maior e
# desenhado DEPOIS, entao qualquer coisa no meio do chao cobre um pedaco do que
# esta atras dela. Uma ilha no centro e a pior posicao possivel — ela tampa
# justamente a fileira de despensas e o canto do fogao.
#
# Agora ela mora na parede da esquerda (0,1) e (0,2), encostada, sem nada atras.
# O chao do meio ficou inteiramente livre, que e onde os cozinheiros andam.
#
# Isso so ficou possivel porque os cozinheiros deixaram de se bloquear (ver
# `mandar`): antes, uma bancada com um acesso so podia ser trancada pelo outro
# boneco, e por isso ela precisava de tres lados livres.
_PLANTA_1 = [
    ".         d:alface  d:tomate  d:carne   d:pao     d:massa   .         .",
    "tabua     .         .         .         .         .         .         panela",
    "pia       .         bancada   .         bancada   .         .         panela",
    "tabua     .         .         .         .         .         .         .",
    "lixo      .         .         pratos    .         entrega   .         .",
]

NIVEIS = {
    1: {
        "nome": "Cozinha do Amor",
        "planta": _PLANTA_1,
        "cardapio": ["salada", "macarrao", "hamburguer", "casal"],
    },
}


def montar_estacoes(nivel: int) -> list[dict]:
    """Lê a planta e devolve as estações, cada uma com a célula dela."""
    linhas = NIVEIS[nivel]["planta"]
    estacoes = []
    for row, linha in enumerate(linhas):
        for col, celula in enumerate(linha.split()):
            if celula == ".":
                continue
            tipo, _, param = celula.partition(":")
            estacoes.append({
                "id": len(estacoes),
                "tipo": tipo,
                "ing": param or None,
                "col": col,
                "row": row,
                # o que está em cima dela (item ou prato), e o prazo do que ela
                # está fazendo. `fim_ms` nulo = parada.
                "item": None,
                # o par do `mao_antes` do cozinheiro: o que estava aqui antes, e
                # a hora em que o novo passa a valer.
                "item_antes": None,
                "item_ms": None,
                "fim_ms": None,
                "fase": None,   # "picando" | "cozinhando" | "lavando"
            })
    return estacoes


def celulas_ocupadas(estacoes: list[dict]) -> set:
    return {(e["col"], e["row"]) for e in estacoes}


def _vizinhas_livres(estacao: dict, ocupadas: set) -> list[tuple[int, int]]:
    """As células de onde dá pra usar esta estação."""
    saida = []
    for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c, r = estacao["col"] + dc, estacao["row"] + dr
        if 0 <= c < LARGURA and 0 <= r < ALTURA and (c, r) not in ocupadas:
            saida.append((c, r))
    return saida


def _distancia(a: tuple[int, int], b: tuple[int, int]) -> int:
    """Quarteirão, e não linha reta: o cozinheiro anda em cruz, não na diagonal."""
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


# =================================================================== a partida

def agora_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def nova_partida(nivel: int, solo: bool, semente: int, inicio_ms: int | None = None) -> dict:
    inicio = inicio_ms if inicio_ms is not None else agora_ms()
    estacoes = montar_estacoes(nivel)
    ocupadas = celulas_ocupadas(estacoes)
    # Os dois cozinheiros nascem em cantos opostos do chão livre. Nascer juntos
    # faria os dois correrem pro mesmo lado nos primeiros segundos.
    livres = sorted(
        (c, r)
        for r in range(ALTURA) for c in range(LARGURA)
        if (c, r) not in ocupadas
    )
    berco = [livres[0], livres[-1]] if len(livres) >= 2 else [(1, 1), (1, 1)]
    return {
        "nivel": nivel,
        "solo": solo,
        "semente": semente,
        "inicio_ms": inicio,
        "fim_ms": inicio + DURACAO_RODADA,
        "estacoes": estacoes,
        # SOZINHO tem UM cozinheiro, e nao dois.
        #
        # A ideia de dois vinha do proprio Overcooked (a pesquisa em
        # `docs/jogo-cozinha.md` conta), e no papel ela preserva a mecanica de
        # dividir tarefa. Na pratica, com os dois na mao de uma pessoa so, o
        # dono relatou o contrario: *"o jogo fica com dois bonecos mesmo jogando
        # sozinho, o que buga muitas vezes o sistema, um boneco atrapalha o
        # outro"*.
        #
        # Faz sentido: dividir tarefa entre duas pessoas e cooperacao; dividir
        # entre dois bonecos que a MESMA pessoa comanda e so contabilidade. O
        # ganho era teorico e o atrito era real, entao vale o que quem joga viu.
        # A dois continua com um cozinheiro pra cada, que e onde a mecanica
        # sempre fez sentido.
        "cozinheiros": {
            lado: {
                "col": berco[i][0], "row": berco[i][1],
                # de onde veio e quando chega: é disso, e só disso, que o app
                # tira a posição desenhada. Interpolação, não simulação.
                "de_col": berco[i][0], "de_row": berco[i][1],
                "saiu_ms": inicio, "chega_ms": inicio,
                "mao": None,
                # o que a mão tinha ANTES da jogada em curso, e quando o novo
                # passa a valer. É o que impede o item de aparecer na mão dele
                # enquanto ele ainda está a caminho. Ver `mandar`.
                "mao_antes": None,
                "mao_ms": None,
                "ocupado_ate_ms": None,   # picando/lavando: não obedece nesse meio
                "estacao_alvo": None,
            }
            for i, lado in enumerate(("p1",) if solo else ("p1", "p2"))
        },
        # Pratos limpos disponíveis na pilha; os sujos viram estação `pia`.
        "pratos_limpos": PRATOS,
        "pratos_sujos": [],   # lista de horas em que cada um VOLTA sujo
        "pedidos": [],
        "proximo_id": 1,
        "proximo_pedido_ms": inicio + 2_000,
        "pontos": 0,
        "entregues": 0,
        "perdidos": 0,
        "errados": 0,
        "acabou": False,
        # O que aconteceu desde a última olhada, pro app tocar som e piscar.
        # Não é estado: é recado, e some na leitura seguinte.
        "avisos": [],
    }


def _sortear_receita(estado: dict) -> str:
    """Sorteio preso à semente + ao número do pedido.

    Preso, e não `random` solto, por um motivo prático: assim a mesma partida
    reproduz igual num teste. O servidor é o dono do sorteio de qualquer forma —
    o app nunca sorteia nada.
    """
    cardapio = NIVEIS[estado["nivel"]]["cardapio"]
    sorteio = random.Random(estado["semente"] * 1000 + estado["proximo_id"])
    return sorteio.choice(cardapio)


def _proximo_evento(estado: dict) -> int | None:
    """A hora do próximo acontecimento pendente, ou None se não há nenhum.

    Existe porque os eventos deste jogo **encadeiam**: cozinhar termina e já
    marca a hora de queimar; um pedido nasce e depois vence; um pedido que vence
    abre vaga pro próximo nascer.
    """
    prazos = []
    for estacao in estado["estacoes"]:
        if estacao["fim_ms"] is not None:
            prazos.append(estacao["fim_ms"])
    prazos.extend(estado["pratos_sujos"])
    for pedido in estado["pedidos"]:
        if not pedido["entregue"]:
            prazos.append(pedido["vence_ms"])
    if not estado["acabou"]:
        prazos.append(estado["proximo_pedido_ms"])
        prazos.append(estado["fim_ms"])
    return min(prazos) if prazos else None


def avancar(estado: dict, agora: int) -> dict:
    """Aplica TUDO o que venceu entre a última olhada e `agora`.

    É a única função que muda o estado por causa do tempo. Ela é chamada no
    começo de toda leitura e de toda ação — então pedido vence, panela queima e a
    rodada acaba mesmo que ninguém encoste no celular, porque a conta é feita na
    hora de olhar.

    -------------------------------------------------- por que é um LAÇO, e não
                                                        uma varredura

    A primeira versão varria os prazos uma vez, comparando cada um com `agora`.
    Ela estava errada, e de um jeito que só aparece quando alguém larga o
    celular — que é justamente o caso que este desenho existe pra cobrir:

    - a panela que terminava de cozinhar marcava o prazo de queimar a partir de
      `agora`, e não da hora em que ela **de fato** ficou pronta. Voltar depois
      de um minuto encontrava a comida cozida e o cronômetro do estrago
      recomeçando do zero: **ficar longe protegia a comida**;
    - os pedidos criados no fim da varredura não passavam pela conferência de
      vencimento, que já tinha rodado. Eles só eram cobrados na chamada
      SEGUINTE — então o placar dependia de **quantas vezes** alguém olhou, e não
      do tempo que passou. Medido: duas chamadas seguidas com o mesmo `agora`
      davam 0 e depois −100 pontos.

    Agora ela caminha pelos acontecimentos **em ordem de hora**, aplicando cada
    um no instante exato dele. Com isso `avancar` fica idempotente no tempo
    (chamar de novo com o mesmo `agora` não muda nada) e o resultado passa a
    depender só do relógio — nunca da frequência com que se olha.
    """
    avisos = []

    # O teto é rede de segurança contra um evento que se reagende no mesmo
    # instante: em vez de travar o servidor num laço infinito, ele para. Numa
    # rodada de 3 minutos os acontecimentos possíveis são algumas dezenas.
    for _ in range(2000):
        quando = _proximo_evento(estado)
        if quando is None or quando > agora:
            break
        # Nunca antes do início da rodada: um prazo herdado de um estado
        # estranho não pode fazer a simulação andar pra trás.
        _aplicar(estado, max(quando, estado["inicio_ms"]), avisos)

    # -------------------------------------------------------- os cozinheiros
    #
    # Chegar e se soltar NÃO encadeiam com nada (ninguém agenda outra coisa a
    # partir deles), então continuam sendo varredura simples contra `agora`.
    for cozinheiro in estado["cozinheiros"].values():
        if cozinheiro["chega_ms"] <= agora:
            # chegou: a posição de partida passa a ser a de chegada, senão o app
            # continuaria desenhando o caminho antigo pra sempre
            cozinheiro["de_col"] = cozinheiro["col"]
            cozinheiro["de_row"] = cozinheiro["row"]
        if cozinheiro["ocupado_ate_ms"] is not None and cozinheiro["ocupado_ate_ms"] <= agora:
            cozinheiro["ocupado_ate_ms"] = None
        # a foto do "antes" so vale ate a chegada; depois ela vira lixo no estado
        if cozinheiro.get("mao_ms") is not None and cozinheiro["mao_ms"] <= agora:
            cozinheiro["mao_ms"] = None
            cozinheiro["mao_antes"] = None
    for estacao in estado["estacoes"]:
        if estacao.get("item_ms") is not None and estacao["item_ms"] <= agora:
            estacao["item_ms"] = None
            estacao["item_antes"] = None

    estado["avisos"] = avisos
    return estado


def _aplicar(estado: dict, quando: int, avisos: list) -> None:
    """Aplica tudo o que vence exatamente em `quando`.

    Sempre no instante do evento, e nunca em `agora`: é isso que faz o prazo de
    queimar contar a partir da hora em que a comida ficou pronta.
    """
    # --------------------------------------------------------------- estações
    for estacao in estado["estacoes"]:
        if estacao["fim_ms"] is None or estacao["fim_ms"] > quando:
            continue
        item = estacao["item"]
        if estacao["fase"] == "picando" and item:
            item["estado"] = PICADO
            estacao["fase"] = None
            estacao["fim_ms"] = None
            avisos.append({"tipo": "picou", "col": estacao["col"], "row": estacao["row"]})
        elif estacao["fase"] == "cozinhando" and item:
            item["estado"] = COZIDO
            # A hora de QUEIMAR já é marcada aqui, a partir de `quando`. É o que
            # permite ao app desenhar a barra vermelha sem saber a regra: ele só
            # conhece um começo e um fim.
            estacao["fase"] = "queimando"
            estacao["fim_ms"] = quando + T_QUEIMAR
            avisos.append({"tipo": "cozinhou", "col": estacao["col"], "row": estacao["row"]})
        elif estacao["fase"] == "queimando" and item:
            item["estado"] = QUEIMADO
            estacao["fase"] = None
            estacao["fim_ms"] = None
            avisos.append({"tipo": "queimou", "col": estacao["col"], "row": estacao["row"]})
        elif estacao["fase"] == "lavando":
            estacao["fase"] = None
            estacao["fim_ms"] = None
            estado["pratos_limpos"] += 1
            avisos.append({"tipo": "lavou", "col": estacao["col"], "row": estacao["row"]})
        else:
            estacao["fase"] = None
            estacao["fim_ms"] = None

    # -------------------------------------------------- pratos voltando sujos
    ainda = []
    for volta_ms in estado["pratos_sujos"]:
        if volta_ms <= quando:
            _empilhar_sujo(estado)
            avisos.append({"tipo": "sujou"})
        else:
            ainda.append(volta_ms)
    estado["pratos_sujos"] = ainda

    # ----------------------------------------------------- pedidos que vencem
    for pedido in estado["pedidos"]:
        if pedido["entregue"] or pedido["vence_ms"] > quando:
            continue
        pedido["entregue"] = True
        pedido["perdido"] = True
        estado["pontos"] += PONTOS_PERDIDO
        estado["perdidos"] += 1
        avisos.append({"tipo": "perdeu", "receita": pedido["receita"]})

    # ------------------------------------------------------ o gongo da rodada
    if not estado["acabou"] and quando >= estado["fim_ms"]:
        estado["acabou"] = True
        # Pedido que ainda estava aberto na hora do gongo NÃO conta como perdido:
        # não deu tempo, e cobrar por isso puniria quem jogou até o fim.
        for pedido in estado["pedidos"]:
            if not pedido["entregue"]:
                pedido["entregue"] = True
                pedido["expirou_no_fim"] = True
        avisos.append({"tipo": "fim"})
        return

    # ------------------------------------------------------ pedidos que nascem
    if estado["acabou"] or estado["proximo_pedido_ms"] > quando:
        return
    abertos = sum(1 for p in estado["pedidos"] if not p["entregue"])
    if abertos < PEDIDOS_SIMULTANEOS:
        codigo = _sortear_receita(estado)
        estado["pedidos"].append({
            "id": estado["proximo_id"],
            "receita": codigo,
            "nasce_ms": quando,
            "vence_ms": quando + RECEITAS[codigo]["prazo_ms"],
            "entregue": False,
            "perdido": False,
        })
        estado["proximo_id"] += 1
    # O relógio do próximo pedido anda mesmo com a fila cheia — senão ele ficaria
    # parado no passado e o laço giraria sem fim.
    estado["proximo_pedido_ms"] = quando + _intervalo(estado, quando)



def _intervalo(estado: dict, quando: int) -> int:
    """O ritmo dos pedidos: aperta com o tempo, e afrouxa se ha uma mao so."""
    andado = (quando - estado["inicio_ms"]) / max(1, DURACAO_RODADA)
    andado = min(1.0, max(0.0, andado))
    base = (
        PEDIDO_INTERVALO_INICIAL
        + (PEDIDO_INTERVALO_FINAL - PEDIDO_INTERVALO_INICIAL) * andado
    )
    # A conta e pelo numero de cozinheiros, e nao pela marca `solo`: se um dia
    # existir uma cozinha de tres, ela se ajusta sozinha.
    if len(estado.get("cozinheiros") or {}) < 2:
        base *= FOLGA_SOZINHO
    return int(base)


def _empilhar_sujo(estado: dict) -> None:
    """Põe mais um prato sujo na pia."""
    for estacao in estado["estacoes"]:
        if estacao["tipo"] == "pia":
            estacao["sujos"] = estacao.get("sujos", 0) + 1
            return


# ===================================================================== a ação
#
# UM gesto so resolve tudo, como no original: o que acontece depende do que o
# cozinheiro tem na mao e do que tem na estacao. Pegar, largar, picar, cozinhar,
# montar, entregar e lavar sao o mesmo toque.


class Recusado(Exception):
    """A jogada não vale. A mensagem é pra pessoa, não pro log."""


def mandar(estado: dict, lado: str, estacao_id: int, agora: int) -> dict:
    """Manda um cozinheiro até uma estação e age lá.

    Andar leva tempo, mas a AÇÃO é resolvida agora, no mesmo pedido. Guardar a
    ação pra aplicar quando ele chegasse exigiria um segundo tipo de coisa
    pendente no estado — e, pior, a estação poderia mudar no caminho, o que faria
    o jogo desobedecer sem explicar por quê.

    O preço de resolver agora é que a ação vale a partir do INSTANTE DA CHEGADA:
    tudo o que ela agenda (picar, cozinhar) começa a contar dali. Então o
    resultado é o mesmo, e o app pode desenhar o caminho inteiro sabendo o fim.
    """
    # As DUAS condicoes. A marca `acabou` e posta por `avancar`, e as rotas sempre
    # avancam antes — mas a funcao tambem e chamada direto (pela bateria, e por
    # quem escrever a proxima rota). Comparar o relogio aqui e o que garante que
    # ninguem entregue um prato depois do gongo por ter pulado o `avancar`.
    if estado["acabou"] or agora >= estado["fim_ms"]:
        raise Recusado("A rodada acabou")
    cozinheiro = estado["cozinheiros"].get(lado)
    if cozinheiro is None:
        raise Recusado("Esse cozinheiro não existe")
    if cozinheiro["ocupado_ate_ms"] is not None:
        raise Recusado("Ele está ocupado")
    estacao = next((e for e in estado["estacoes"] if e["id"] == estacao_id), None)
    if estacao is None:
        raise Recusado("Essa estação não existe")

    # Os cozinheiros NAO se bloqueiam mais, e isso e conserto de defeito.
    #
    # A celula do outro entrava aqui como ocupada, "pra dois nao ficarem
    # desenhados um dentro do outro". O preco era alto demais: uma estacao com um
    # acesso so ficava TRANCADA enquanto o outro estivesse parado ali, o toque
    # era recusado com "nao da pra chegar", e de fora parecia o jogo travando.
    # Foi o que o dono viu: *"um boneco atrapalha o outro"*.
    #
    # Numa cozinha apertada, dois corpos passam um pelo outro — e o desenho
    # resolve o resto: quando os dois caem na mesma celula, cada um e deslocado
    # meio corpo pro lado (ver `desenharCozinheiro`). Estacao inalcancavel e
    # defeito; dois bonecos encostados e so aperto, que e o que o jogo quer.
    ocupadas = celulas_ocupadas(estado["estacoes"])
    vizinhas = _vizinhas_livres(estacao, ocupadas)
    if not vizinhas:
        raise Recusado("Não dá pra chegar nessa estação agora")

    origem = (cozinheiro["col"], cozinheiro["row"])
    destino = min(vizinhas, key=lambda c: (_distancia(origem, c), c))
    passos = _distancia(origem, destino)
    # Ele só começa a andar quando terminar de chegar onde já estava indo.
    partida = max(agora, cozinheiro["chega_ms"])
    chegada = partida + passos * T_PASSO

    cozinheiro["de_col"], cozinheiro["de_row"] = origem
    cozinheiro["col"], cozinheiro["row"] = destino
    cozinheiro["saiu_ms"] = partida
    cozinheiro["chega_ms"] = chegada
    cozinheiro["estacao_alvo"] = estacao_id

    # ------------------------------------------ o que MUDA so aparece na chegada
    #
    # A acao e resolvida agora, mas ela so acontece de verdade quando ele chega.
    # Sem marcar isso, a tela mostrava o efeito na hora do toque: o dono viu
    # *"o objeto que o cozinheiro pega aparece na mao dele enquanto ele ta indo
    # pegar"* — e sao TRES casos do mesmo defeito, nao um:
    #
    #   - ele anda ate a despensa ja segurando o que ainda vai pegar;
    #   - o tomate SOME da tabua no instante do toque, e ele ainda esta longe;
    #   - o que ele carrega POUSA no balcao antes de ele chegar la.
    #
    # A correcao guarda o estado ANTERIOR junto com a hora em que o novo passa a
    # valer. A tela desenha o antigo ate a chegada e o novo depois — e isso
    # continua sendo interpolacao, nao simulacao: ela recebe os dois lados e uma
    # hora, e nao decide nada.
    #
    # A foto e funda porque montar no prato altera o prato POR DENTRO (a lista de
    # ingredientes cresce), e uma comparacao rasa nao veria a diferenca.
    antes_mao = copy.deepcopy(cozinheiro["mao"])
    antes_itens = {e["id"]: copy.deepcopy(e["item"]) for e in estado["estacoes"]}

    resultado = _agir(estado, cozinheiro, estacao, chegada)

    if cozinheiro["mao"] != antes_mao:
        cozinheiro["mao_antes"] = antes_mao
        cozinheiro["mao_ms"] = chegada
    for e in estado["estacoes"]:
        if e["item"] != antes_itens[e["id"]]:
            e["item_antes"] = antes_itens[e["id"]]
            e["item_ms"] = chegada

    resultado["chega_ms"] = chegada
    return resultado


def mandar_auto(estado: dict, estacao_id: int, agora: int) -> tuple[str, dict]:
    """Sozinho: o SERVIDOR escolhe qual cozinheiro atende. Devolve (lado, resultado).

    ------------------------------------------------------- por que aqui, e não na tela

    A primeira versão escolhia na tela, pela regra "o livre mais perto". Ela
    parece razoável e está errada, e o erro apareceu jogando: com um cozinheiro
    segurando a alface, tocar na bancada mandava o OUTRO — que chegava de mão
    vazia e **pegava o prato** em vez de montar. Medido: o prato saía da bancada
    e a salada nunca era montada.

    O motivo é fundo. Pra escolher certo é preciso saber o que cada gesto FAZ, e
    isso é regra do jogo. A tela não sabe as regras de propósito (é o princípio
    deste jogo inteiro: um dono só pra cada fato), então ela também não tem como
    escolher direito — qualquer palpite dela seria uma segunda cópia das regras,
    envelhecendo em separado.

    Aqui a escolha é feita **experimentando**: para cada cozinheiro, do mais
    perto pro mais longe, a jogada é simulada numa cópia do estado; o primeiro
    que consegue é quem vai de verdade. Nada é duplicado — quem julga é a mesma
    `mandar` de sempre.

    Quando nenhum consegue, vale a recusa do mais perto: é a explicação que faz
    sentido pra quem tocou ("a mão está ocupada", "não há prato limpo").
    """
    estacao = next((e for e in estado["estacoes"] if e["id"] == estacao_id), None)
    if estacao is None:
        raise Recusado("Essa estação não existe")

    alvo = (estacao["col"], estacao["row"])

    def prioridade(lado: str):
        c = estado["cozinheiros"][lado]
        # QUEM ESTA CARREGANDO VEM PRIMEIRO, e essa e a parte que importa.
        #
        # Um item na mao e uma intencao ja em andamento: quem pegou a alface
        # esta indo levar a alface a algum lugar. Sem esta preferencia, o de
        # maos vazias — que quase sempre esta mais perto, porque nao andou —
        # chegava antes e fazia OUTRA coisa: na bancada ele PEGAVA o prato em
        # vez de deixar o outro montar. Foi assim que a salada nunca era montada.
        #
        # E note que isto NAO e uma regra do jogo escondida aqui: e uma ordem de
        # tentativa. Quem julga se a jogada vale continua sendo `mandar`, e se o
        # que carrega nao conseguir, o de maos vazias e tentado logo em seguida.
        return (0 if c["mao"] else 1, _distancia((c["col"], c["row"]), alvo))

    ordem = sorted(estado["cozinheiros"], key=prioridade)
    primeira_recusa = None
    for lado in ordem:
        ensaio = copy.deepcopy(estado)
        try:
            mandar(ensaio, lado, estacao_id, agora)
        except Recusado as erro:
            if primeira_recusa is None:
                primeira_recusa = erro
            continue
        # Deu certo no ensaio: refaz no estado de verdade. Refazer (em vez de
        # copiar o ensaio de volta) mantém UM caminho de escrita — o mesmo de
        # sempre —, então não há como o ensaio e o real divergirem.
        return lado, mandar(estado, lado, estacao_id, agora)
    raise primeira_recusa or Recusado("Nenhum cozinheiro pode fazer isso agora")


def _agir(estado: dict, cozinheiro: dict, estacao: dict, quando: int) -> dict:
    """O gesto único, resolvido pelo par (o que está na mão, o que tem na estação)."""
    mao = cozinheiro["mao"]
    tipo = estacao["tipo"]

    # ------------------------------------------------------------- despensa
    if tipo == "d":
        if mao is not None:
            raise Recusado("A mão está ocupada")
        cozinheiro["mao"] = {"ing": estacao["ing"], "estado": CRU}
        return {"som": "pegar"}

    # ---------------------------------------------------------------- pratos
    if tipo == "pratos":
        if mao is not None:
            raise Recusado("A mão está ocupada")
        if estado["pratos_limpos"] <= 0:
            raise Recusado("Não há prato limpo — alguém precisa lavar")
        estado["pratos_limpos"] -= 1
        cozinheiro["mao"] = {"ing": "prato", "estado": "limpo", "montado": []}
        return {"som": "prato"}

    # ------------------------------------------------------------------- pia
    if tipo == "pia":
        if mao is not None:
            raise Recusado("Largue o que está na mão pra lavar")
        if estacao.get("sujos", 0) <= 0:
            raise Recusado("Não há prato sujo")
        if estacao["fim_ms"] is not None:
            raise Recusado("Já tem prato sendo lavado")
        estacao["sujos"] -= 1
        estacao["fase"] = "lavando"
        estacao["fim_ms"] = quando + T_LAVAR
        # Lavar OCUPA o cozinheiro. É o que dá peso à escolha de ir lavar: quem
        # está na pia não está cozinhando, e é daí que vem metade do aperto.
        cozinheiro["ocupado_ate_ms"] = quando + T_LAVAR
        return {"som": "lavar"}

    # ------------------------------------------------------------------ lixo
    if tipo == "lixo":
        if mao is None:
            raise Recusado("A mão está vazia")
        if mao["ing"] == "prato":
            raise Recusado("Prato não vai no lixo")
        cozinheiro["mao"] = None
        return {"som": "lixo"}

    # --------------------------------------------------------------- entrega
    if tipo == "entrega":
        if mao is None or mao["ing"] != "prato":
            raise Recusado("Só prato montado vai pra entrega")
        return _entregar(estado, cozinheiro, quando)

    # -------------------------------------------- tábua, panela e bancada
    #
    # As tres compartilham o mesmo par de gestos (largar / pegar); o que muda e
    # o que a estacao FAZ com o que recebeu.
    if estacao["fim_ms"] is not None and estacao["fase"] in ("picando", "lavando"):
        raise Recusado("Espere terminar")

    if mao is None:
        if estacao["item"] is None:
            raise Recusado("Não há nada aqui")
        cozinheiro["mao"] = estacao["item"]
        estacao["item"] = None
        estacao["fase"] = None
        estacao["fim_ms"] = None
        return {"som": "pegar"}

    # tem coisa na mão: ou monta no que está lá, ou larga
    if estacao["item"] is not None:
        montado = _montar(mao, estacao["item"])
        if montado is None:
            raise Recusado("Isso não vai junto")
        # o prato fica com quem estava segurando o prato
        if mao["ing"] == "prato":
            estacao["item"] = None
        else:
            cozinheiro["mao"] = None
            estacao["item"] = montado
        estacao["fase"] = None
        estacao["fim_ms"] = None
        return {"som": "montar"}

    # estação vazia: larga, e ela começa a trabalhar se souber
    if mao["ing"] == "prato" and tipo in ("tabua", "panela"):
        raise Recusado("Prato não vai na tábua nem na panela")
    estacao["item"] = mao
    cozinheiro["mao"] = None

    if tipo == "tabua":
        if _passo(estacao["item"]["ing"], estacao["item"]["estado"]) != PICADO:
            raise Recusado("Isso não se pica")
        estacao["fase"] = "picando"
        estacao["fim_ms"] = quando + T_PICAR
        # Picar ocupa; cozinhar não. É a diferença entre as duas estações, e é o
        # que faz a panela ser um lugar onde dá pra esquecer a comida.
        cozinheiro["ocupado_ate_ms"] = quando + T_PICAR
        return {"som": "picar"}

    if tipo == "panela":
        if _passo(estacao["item"]["ing"], estacao["item"]["estado"]) != COZIDO:
            raise Recusado("Isso não se cozinha assim")
        estacao["fase"] = "cozinhando"
        estacao["fim_ms"] = quando + T_COZINHAR
        return {"som": "panela"}

    return {"som": "largar"}


def _montar(a: dict, b: dict) -> dict | None:
    """Junta duas coisas, se der. Uma delas TEM que ser um prato."""
    prato, item = (a, b) if a["ing"] == "prato" else (b, a)
    if prato["ing"] != "prato" or item["ing"] == "prato":
        return None
    if prato["estado"] != "limpo":
        return None
    # Só entra o que alguma receita pede naquele estado (ver `MONTAVEIS`). É isso
    # que impede montar tudo cru e entregar, sem impedir os estados intermediários
    # que as receitas REALMENTE usam — o tomate picado da salada é um deles.
    if (item["ing"], item["estado"]) not in MONTAVEIS:
        return None
    if len(prato["montado"]) >= 4:
        return None
    prato["montado"] = [*prato["montado"], {"ing": item["ing"], "estado": item["estado"]}]
    return prato


def _entregar(estado: dict, cozinheiro: dict, quando: int) -> dict:
    prato = cozinheiro["mao"]
    if not prato["montado"]:
        raise Recusado("O prato está vazio")
    chave = _chave(prato["montado"])
    codigo = RECEITA_POR_CHAVE.get(chave)

    # O pedido ATENDIDO é o mais perto de vencer entre os que pedem este prato.
    # Faz diferença de verdade: entregar salada com dois pedidos de salada na
    # fila deve salvar o que está acabando, e não o que acabou de chegar.
    alvo = None
    if codigo:
        candidatos = [
            p for p in estado["pedidos"]
            if not p["entregue"] and p["receita"] == codigo
        ]
        if candidatos:
            alvo = min(candidatos, key=lambda p: p["vence_ms"])

    cozinheiro["mao"] = None
    # O prato vai pra pia daqui a pouco, tenha dado certo ou não. São poucos
    # pratos, e é essa volta que obriga alguém a largar a panela e ir lavar.
    estado["pratos_sujos"].append(quando + T_SUJAR)

    if alvo is None:
        estado["pontos"] += PONTOS_ERRADO
        estado["errados"] += 1
        return {"som": "errado", "entregue": False}

    alvo["entregue"] = True
    alvo["entregue_ms"] = quando
    receita = RECEITAS[codigo]
    # Vale mais quanto mais tempo sobrou: até metade a mais, caindo até o valor
    # cheio na hora do prazo. Nunca vale MENOS que o valor cheio — a pressa é
    # prêmio, e não punição pra quem entregou em cima da hora.
    sobra = max(0, alvo["vence_ms"] - quando) / max(1, receita["prazo_ms"])
    ganho = int(round(receita["pontos"] * (1 + 0.5 * sobra)))
    estado["pontos"] += ganho
    estado["entregues"] += 1
    return {"som": "entregue", "entregue": True, "pontos": ganho, "receita": codigo}


# ==================================================================== a DICA
#
# Por que ela existe: o dono jogou a primeira versao e nao conseguiu. *"Nao deu
# pra entender o que e pra fazer."* Silhueta e nome resolvem "o que e cada
# coisa"; nao resolvem "e agora?".
#
# Entao o servidor responde "e agora?" apontando UMA estacao e dizendo a frase.
# Aqui, e nao na tela, pelo mesmo motivo de sempre: pra saber qual e o proximo
# passo e preciso conhecer as receitas e o que cada gesto faz — e isso e regra do
# jogo, que tem um dono so.
#
# Ela e uma SUGESTAO, e nao um trilho: nada obriga a segui-la, e quem ja sabe
# jogar simplesmente ignora. Da pra desligar na tela.


def _conteudo_dos_pratos(estado: dict) -> list[tuple[dict, dict | None]]:
    """Todo prato em jogo, com onde ele esta (estacao ou None se esta numa mao)."""
    saida = []
    for estacao in estado["estacoes"]:
        item = estacao["item"]
        if item and item.get("ing") == "prato":
            saida.append((item, estacao))
    for cozinheiro in estado["cozinheiros"].values():
        mao = cozinheiro["mao"]
        if mao and mao.get("ing") == "prato":
            saida.append((mao, None))
    return saida


def _falta(precisa: list, tem: list) -> list:
    """O que ainda falta, contando repeticao (dois tomates nao sao um)."""
    restante = list(tem)
    faltando = []
    for par in precisa:
        if par in restante:
            restante.remove(par)
        else:
            faltando.append(par)
    return faltando


def _onde_esta(estado: dict, ing: str, preparo: str):
    """Acha um ingrediente NESSE ponto de preparo. Devolve (estacao, mao_de_quem)."""
    for estacao in estado["estacoes"]:
        item = estacao["item"]
        if item and item.get("ing") == ing and item.get("estado") == preparo:
            # Numa panela que ja esta contando pra queimar ele ainda serve, e e
            # justamente o caso mais urgente de ir buscar.
            return estacao, None
    for lado, cozinheiro in estado["cozinheiros"].items():
        mao = cozinheiro["mao"]
        if mao and mao.get("ing") == ing and mao.get("estado") == preparo:
            return None, lado
    return None, None


def _quem_livre(estado: dict, estacao) -> str | None:
    """O cozinheiro de MAO VAZIA mais perto de uma estacao.

    Existe porque a dica precisa dizer QUEM, e nao so onde. Sem isso ela mentia:
    "Pegue o tomate picado" era atendido pelo cozinheiro que estava com o PRATO
    na mao (a escolha automatica prefere quem carrega algo), e chegar na tabua
    com um prato nao pega o tomate — MONTA o tomate no prato. Num macarrao, que
    quer tomate cozido, isso sujava o prato com um ingrediente errado e o jogo
    entrava em espiral: o prato deixava de servir e a dica mandava pegar outro.

    Medido seguindo a propria dica: prato[1] -> prato[2] com tomate picado
    dentro, e dali em diante "Pegue um prato" pra sempre.
    """
    livres = [
        lado for lado, c in estado["cozinheiros"].items() if c["mao"] is None
    ]
    if not livres:
        return None
    if estacao is None:
        return livres[0]
    alvo = (estacao["col"], estacao["row"])
    return min(
        livres,
        key=lambda lado: _distancia(
            (estado["cozinheiros"][lado]["col"], estado["cozinheiros"][lado]["row"]), alvo
        ),
    )


def _quem_segura(estado: dict, ing: str, preparo: str | None = None) -> str | None:
    """Quem esta com este item na mao."""
    for lado, c in estado["cozinheiros"].items():
        mao = c["mao"]
        if mao and mao.get("ing") == ing and (preparo is None or mao.get("estado") == preparo):
            return lado
    return None


def _primeira(estado: dict, tipo: str, vazia: bool | None = None):
    for estacao in estado["estacoes"]:
        if estacao["tipo"] != tipo:
            continue
        if vazia is True and estacao["item"] is not None:
            continue
        if vazia is False and estacao["item"] is None:
            continue
        return estacao
    return None


def proxima_dica(estado: dict) -> dict | None:
    """A proxima jogada util, pro pedido mais urgente. `None` se nao houver.

    Esta casca faz uma coisa so, e ela importa no modo SOZINHO: se o cozinheiro
    que a dica indicou estiver OCUPADO (picando, lavando), ela vira uma dica de
    espera em vez de um convite ao toque.

    Sem isso a dica pedia uma jogada que seria recusada com "ele esta ocupado" —
    e com um cozinheiro so isso acontece o tempo todo, porque enquanto ele pica
    nao ha mais ninguem pra fazer nada. Dica recusada e o pior tipo de dica: quem
    esta perdido toca, nao acontece nada, e conclui que o jogo travou.

    Da pra olhar `ocupado_ate_ms` sem o relogio porque `avancar` roda antes de
    toda leitura e ja limpou os prazos vencidos: se ainda tem valor, ele esta
    ocupado AGORA.
    """
    dica = _dica_bruta(estado)
    if dica is None or dica.get("esperar"):
        return dica
    lado = dica.get("lado")
    if lado and estado["cozinheiros"].get(lado, {}).get("ocupado_ate_ms") is not None:
        return {**dica, "esperar": True, "texto": f"{dica['texto']} (espere ele terminar)"}
    return dica


def _dica_bruta(estado: dict) -> dict | None:
    """O planejador. `proxima_dica` e quem trata do cozinheiro ocupado."""
    if estado.get("acabou"):
        return None
    abertos = [p for p in estado["pedidos"] if not p["entregue"]]
    if not abertos:
        return None
    # ------------------------------------------ PRIMEIRO: tirar o que queimou
    #
    # Antes de qualquer receita. Comida queimada nao serve pra nada E entope a
    # ferramenta: com as duas panelas ocupadas por carvao, nao ha o que cozinhar
    # e o jogo trava sem dizer por que.
    #
    # Foi assim que este caso apareceu: seguindo a propria dica, a massa queimava,
    # a panela ficava presa, e a dica entrava em LACO mandando cozinhar de novo
    # uma massa que nao tinha onde ir. Quem esta aprendendo trava exatamente ai.
    for lado, cozinheiro in estado["cozinheiros"].items():
        mao = cozinheiro["mao"]
        if mao and mao.get("estado") == QUEIMADO:
            lixo = _primeira(estado, "lixo")
            return {"estacao": lixo["id"] if lixo else None, "lado": lado,
                    "texto": "Jogue o queimado no lixo", "urgente": True}
    for estacao in estado["estacoes"]:
        item = estacao["item"]
        if item and item.get("estado") == QUEIMADO:
            livre = _quem_livre(estado, estacao)
            if livre is None:
                # Ninguem com a mao vazia. Mandar tocar assim seria RECUSADO
                # ("isso nao vai junto": chegar com algo na mao tenta MONTAR, nao
                # pegar) — e a dica ficava repetindo uma jogada impossivel.
                return {**_dica_largar(estado, {"receita": None}), "urgente": True}
            return {"estacao": estacao["id"], "lado": livre,
                    "texto": "Queimou — tire da panela", "urgente": True}

    pedido = min(abertos, key=lambda p: p["vence_ms"])
    receita = RECEITAS[pedido["receita"]]
    precisa = [tuple(par) for par in receita["itens"]]
    nome_prato = receita["nome"]
    g_prato = receita.get("g", "m")
    art_prato = "a" if g_prato == "f" else "o"

    # ------------------------------------------------- que prato estamos montando
    #
    # O que ja tem MAIS coisa certa dentro. Um prato com coisa que nao entra
    # nesta receita nao serve pra ela, e e ignorado.
    melhor, onde_melhor, dentro_melhor = None, None, []
    for prato, estacao in _conteudo_dos_pratos(estado):
        dentro = [(i["ing"], i["estado"]) for i in prato.get("montado", [])]
        if _falta(dentro, precisa):        # tem coisa que a receita nao pede
            continue
        if melhor is None or len(dentro) > len(dentro_melhor):
            melhor, onde_melhor, dentro_melhor = prato, estacao, dentro

    faltando = _falta(precisa, dentro_melhor)

    # ------------------------------------------------------------- sem prato
    #
    # O PRATO E O ULTIMO PASSO, e nao o primeiro. Esta ordem mudou quando o modo
    # sozinho passou a ter UM cozinheiro, e o motivo e a regra mais basica do
    # jogo: uma coisa por vez na mao.
    #
    # Com o prato na mao, uma pessoa sozinha nao consegue buscar mais nada — e a
    # dica entrava em laco mandando "pegue a alface na despensa" com a mao
    # ocupada, recusado, pra sempre. Medido nas quatro receitas: 60 toques, zero
    # entregas.
    #
    # Preparando tudo primeiro, os ingredientes ficam esperando nas tabuas e
    # panelas; so entao vale a pena pegar o prato e passar recolhendo. Funciona
    # igual com um ou com dois.
    if melhor is None:
        pendente = next(
            (par for par in faltando if _onde_esta(estado, par[0], par[1]) == (None, None)),
            None,
        )
        if pendente is not None:
            return _dica_preparar(estado, pedido, pendente[0], pendente[1])

        pia = _primeira(estado, "pia")
        if estado["pratos_limpos"] <= 0:
            if pia is not None and pia.get("sujos", 0) > 0:
                return {"estacao": pia["id"], "lado": _quem_livre(estado, pia),
                        "texto": "Lave um prato na pia",
                        "receita": pedido["receita"]}
            return {"estacao": None, "esperar": True,
                    "texto": "Sem prato limpo — espere um voltar da pia",
                    "receita": pedido["receita"]}
        pilha = _primeira(estado, "pratos")
        livre = _quem_livre(estado, pilha)
        if livre is None:
            # Ninguem com a mao vazia: largue o que estiver segurando primeiro.
            return _dica_largar(estado, pedido)
        return {"estacao": pilha["id"] if pilha else None, "lado": livre,
                "texto": f"Pegue um prato para {art_prato} {nome_prato.lower()}",
                "receita": pedido["receita"]}

    # ----------------------------------------------------------- prato pronto
    if not faltando:
        pronto = _concorda("pronto", g_prato)
        if onde_melhor is not None:
            return {"estacao": onde_melhor["id"],
                    "lado": _quem_livre(estado, onde_melhor),
                    "texto": f"{nome_prato} {pronto} — pegue o prato",
                    "receita": pedido["receita"]}
        entrega = _primeira(estado, "entrega")
        return {"estacao": entrega["id"] if entrega else None,
                "lado": _quem_segura(estado, "prato"),
                "texto": f"{nome_prato} {pronto} — leve para a entrega",
                "receita": pedido["receita"]}

    ing, preparo = faltando[0]
    dados = INGREDIENTES.get(ing, {})
    nome = dados.get("nome", ing)
    g = dados.get("g", "m")
    art = _o(ing)

    # -------------------------- o ingrediente ja esta no ponto: juntar ao prato
    #
    # Aqui importa QUEM esta com o que, e essa foi a parte que eu errei duas
    # vezes. Montar acontece quando um prato encontra um ingrediente — tanto faz
    # qual dos dois esta na mao. Entao sao tres arranjos, e cada um pede uma
    # frase diferente:
    #
    #   prato na mao + ingrediente na estacao  -> LEVE O PRATO ate o ingrediente
    #   prato na estacao + ingrediente na mao  -> leve o ingrediente ate o prato
    #   os dois na mao                         -> largue o prato primeiro
    #
    # A primeira versao so conhecia o segundo arranjo. Como a dica manda pegar um
    # prato logo no comeco (e nunca manda largar), o prato ficava na mao pra
    # sempre e o jogo NUNCA chegava no arranjo que ela sabia tratar: ela mandava
    # "junte ao prato" apontando pra uma bancada vazia, o ingrediente era largado
    # la, e a dica seguinte mandava pegar de novo. Laco infinito, medido nas
    # quatro receitas.
    prato_na_mao = onde_melhor is None
    quem_tem_prato = _quem_segura(estado, "prato") if prato_na_mao else None
    estacao, mao = _onde_esta(estado, ing, preparo)

    if estacao is not None:
        if prato_na_mao and quem_tem_prato:
            return {"estacao": estacao["id"], "lado": quem_tem_prato,
                    "texto": f"Leve o prato até {art} {nome} {_concorda(preparo, g)}",
                    "receita": pedido["receita"]}
        livre = _quem_livre(estado, estacao)
        if livre is None:
            return _dica_largar(estado, pedido)
        return {"estacao": estacao["id"], "lado": livre,
                "texto": f"Pegue {art} {nome} {_concorda(preparo, g)}",
                "receita": pedido["receita"]}

    if mao is not None:
        if onde_melhor is not None:
            return {"estacao": onde_melhor["id"], "lado": mao,
                    "texto": f"Junte {art} {nome} ao prato", "receita": pedido["receita"]}
        # os dois estao em maos: alguem tem que largar, e o prato e o que espera
        banca = _primeira(estado, "bancada", vazia=True)
        return {"estacao": banca["id"] if banca else None, "lado": quem_tem_prato,
                "texto": "Largue o prato na bancada", "receita": pedido["receita"]}

    return _dica_preparar(estado, pedido, ing, preparo)


def _dica_largar(estado: dict, pedido: dict) -> dict:
    """Ninguem com a mao vazia: largue o que estiver segurando.

    E a saida obrigatoria do modo sozinho. Com uma mao so, qualquer passo que
    precise pegar algo esbarra no que ja esta na mao — e sem esta dica o jogo
    parecia travado, mandando pegar uma coisa que nao tinha como ser pega.
    """
    lado = next((l for l, c in estado["cozinheiros"].items() if c["mao"]), None)
    mao = estado["cozinheiros"][lado]["mao"] if lado else None

    # Onde LARGAR de verdade. Uma bancada ocupada nao serve: chegar nela com algo
    # na mao tenta MONTAR, e a jogada seria recusada — a dica estaria mandando
    # fazer o impossivel, que e o pior tipo de dica.
    #
    # O que queimou vai pro lixo, e nao pra bancada: largar carvao num balcao so
    # entope mais um lugar.
    if mao and mao.get("estado") == QUEIMADO:
        lixo = _primeira(estado, "lixo")
        return {"estacao": lixo["id"] if lixo else None, "lado": lado,
                "texto": "Jogue o queimado no lixo", "receita": pedido.get("receita")}

    destino = (
        _primeira(estado, "bancada", vazia=True)
        or _primeira(estado, "tabua", vazia=True)
        or _primeira(estado, "panela", vazia=True)
    )
    if destino is None:
        return {"estacao": None, "esperar": True,
                "texto": "Sem espaço livre — termine algo antes",
                "receita": pedido.get("receita")}
    onde = {"bancada": "na bancada", "tabua": "na tábua", "panela": "na panela"}[destino["tipo"]]
    o_que = "o prato" if mao and mao.get("ing") == "prato" else "o que está na mão"
    return {"estacao": destino["id"], "lado": lado,
            "texto": f"Largue {o_que} {onde}", "receita": pedido.get("receita")}


def _dica_preparar(estado: dict, pedido: dict, ing: str, preparo: str) -> dict:
    """Como chegar num ingrediente NESTE ponto de preparo.

    Anda pra tras na cadeia (cozido <- picado <- cru) ate achar onde ele esta, e
    aponta a ferramenta que da o proximo passo. Quando nao acha nenhum, manda
    buscar na despensa.
    """
    dados = INGREDIENTES.get(ing, {})
    nome = dados.get("nome", ing)
    art = _o(ing)

    cadeia = [CRU]
    if dados.get("pica"):
        cadeia.append(PICADO)
    cadeia.append(COZIDO)
    anterior = None
    for etapa in cadeia:
        if etapa == preparo:
            break
        anterior = etapa

    while anterior is not None:
        estacao, mao = _onde_esta(estado, ing, anterior)
        ferramenta = "tabua" if _passo(ing, anterior) == PICADO else "panela"
        rotulo = "pique" if ferramenta == "tabua" else "cozinhe"
        if mao is not None:
            livre = _primeira(estado, ferramenta, vazia=True)
            if livre is None:
                onde = "A tábua" if ferramenta == "tabua" else "A panela"
                banca = _primeira(estado, "bancada", vazia=True)
                return {"estacao": banca["id"] if banca else None, "lado": mao,
                        "texto": f"{onde} está ocupada — largue {art} {nome} na bancada",
                        "receita": pedido["receita"]}
            return {"estacao": livre["id"], "lado": mao,
                    "texto": f"{rotulo.capitalize()} {art} {nome}",
                    "receita": pedido["receita"]}
        if estacao is not None:
            if estacao["tipo"] == ferramenta and estacao["fase"]:
                # `esperar` marca a dica que NAO e pra tocar: tocar numa panela
                # cozinhando TIRA a comida de dentro (de proposito — e assim que
                # se salva algo antes de queimar), entao seguir esta dica ao pe da
                # letra desfaria o proprio trabalho.
                return {"estacao": estacao["id"], "esperar": True,
                        "texto": f"{art.upper()} {nome} está quase — espere",
                        "receita": pedido["receita"]}
            # -------------------------------------------- NAO pegue sem ter onde por
            #
            # Este `if` conserta um PING-PONG que travava a rodada inteira. Sem
            # ele, com as duas panelas ocupadas, a dica alternava pra sempre:
            #
            #   "A panela esta ocupada — largue a carne na bancada"
            #   "Pegue a carne para cozinhar"     <- pega de volta
            #   "A panela esta ocupada — largue a carne na bancada"
            #   ...
            #
            # Medido numa rodada a dois: 20 toques em 1 segundo de jogo, zero
            # entregas na rodada. Quem esta seguindo a dica ficaria fazendo isso
            # ate o gongo.
            #
            # Se nao ha ferramenta livre, o certo e ESPERAR uma vagar — e nao
            # ficar carregando o ingrediente de um lado pro outro.
            vaga = _primeira(estado, ferramenta, vazia=True)
            if vaga is None:
                ocupada = _primeira(estado, ferramenta)
                onde = "A tábua" if ferramenta == "tabua" else "A panela"
                return {"estacao": ocupada["id"] if ocupada else None, "esperar": True,
                        "texto": f"{onde} está ocupada — espere vagar",
                        "receita": pedido["receita"]}
            livre = _quem_livre(estado, estacao)
            if livre is None:
                return _dica_largar(estado, pedido)
            infinitivo = "picar" if ferramenta == "tabua" else "cozinhar"
            return {"estacao": estacao["id"], "lado": livre,
                    "texto": f"Pegue {art} {nome} para {infinitivo}",
                    "receita": pedido["receita"]}
        indice = cadeia.index(anterior)
        anterior = cadeia[indice - 1] if indice > 0 else None

    despensa = next((e for e in estado["estacoes"] if e["tipo"] == "d" and e["ing"] == ing), None)
    livre = _quem_livre(estado, despensa)
    if livre is None:
        return _dica_largar(estado, pedido)
    return {"estacao": despensa["id"] if despensa else None, "lado": livre,
            "texto": f"Pegue {art} {nome} na despensa", "receita": pedido["receita"]}


# ================================================================ o que a tela vê
#
# A vista e IGUAL pros dois — ao contrario da batalha naval, aqui nao ha nada a
# esconder: os dois olham a mesma cozinha. O que muda e so qual cozinheiro e o
# "seu", e isso e um campo, nao um recorte.

def vista(estado: dict, lado: str, agora: int) -> dict:
    return {
        "agora_ms": agora,
        "inicio_ms": estado["inicio_ms"],
        "fim_ms": estado["fim_ms"],
        "acabou": estado["acabou"],
        "solo": estado["solo"],
        "nivel": estado["nivel"],
        "largura": LARGURA,
        "altura": ALTURA,
        "meu_lado": lado,
        "estacoes": estado["estacoes"],
        "cozinheiros": estado["cozinheiros"],
        "pratos_limpos": estado["pratos_limpos"],
        "pedidos": [p for p in estado["pedidos"] if not p["entregue"]],
        "pontos": estado["pontos"],
        "entregues": estado["entregues"],
        "perdidos": estado["perdidos"],
        "errados": estado["errados"],
        "avisos": estado["avisos"],
        "receitas": {
            codigo: {
                "nome": r["nome"],
                "itens": r["itens"],
                # O texto de cada ingrediente vem PRONTO daqui, ja concordado
                # ("a alface picada", "o tomate picado"). A tela nao monta essa
                # frase: genero e concordancia sao dados do catalogo, e deixar a
                # tela juntar as partes criaria um segundo dono da regra — que
                # foi como a comanda acabou escrevendo "alface picado".
                "rotulos": [
                    f'{INGREDIENTES[ing]["nome"]} {_concorda(estado_ing, INGREDIENTES[ing].get("g", "m"))}'
                    for ing, estado_ing in r["itens"]
                ],
                "pontos": r["pontos"],
            }
            for codigo, r in RECEITAS.items()
        },
        "ingredientes": INGREDIENTES,
        # Os tempos viajam pra tela pra ela desenhar barra sem saber a regra —
        # ela só precisa de um começo e de um fim, e os dois estão no estado.
        "tempos": {"picar": T_PICAR, "cozinhar": T_COZINHAR, "queimar": T_QUEIMAR,
                   "lavar": T_LAVAR, "passo": T_PASSO},
        # "e agora?" — a proxima jogada util, calculada AQUI porque depende das
        # receitas e do que cada gesto faz. Ver `proxima_dica`.
        "dica": proxima_dica(estado),
    }
