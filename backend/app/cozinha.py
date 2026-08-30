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
    "alface": {"nome": "alface", "cor": "#7cc45f", "pica": True, "cozinha": None},
    "tomate": {"nome": "tomate", "cor": "#e0553f", "pica": True, "cozinha": PICADO},
    "carne": {"nome": "carne", "cor": "#b5644f", "pica": False, "cozinha": CRU},
    "massa": {"nome": "massa", "cor": "#e8c86a", "pica": False, "cozinha": CRU},
    "pao": {"nome": "pão", "cor": "#d2a05e", "pica": False, "cozinha": None},
}


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
        "nome": "Salada",
        "itens": [("alface", PICADO), ("tomate", PICADO)],
        "pontos": 60,
        "prazo_ms": 55_000,
    },
    "macarrao": {
        "nome": "Macarrão",
        "itens": [("massa", COZIDO), ("tomate", COZIDO)],
        "pontos": 90,
        "prazo_ms": 70_000,
    },
    "hamburguer": {
        "nome": "Hambúrguer",
        "itens": [("pao", CRU), ("carne", COZIDO), ("alface", PICADO)],
        "pontos": 110,
        "prazo_ms": 80_000,
    },
    "casal": {
        "nome": "Prato do casal",
        "itens": [("massa", COZIDO), ("carne", COZIDO), ("tomate", PICADO)],
        "pontos": 150,
        "prazo_ms": 90_000,
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
T_QUEIMAR = 6_500   # depois de cozido, quanto tempo ate estragar
T_LAVAR = 2_200
T_PASSO = 260       # quanto leva pra andar UMA celula
T_SUJAR = 9_000     # depois de entregue, quanto tempo ate o prato voltar sujo

DURACAO_RODADA = 180_000  # 3 minutos
PRATOS = 3                # poucos de propósito: e o que obriga alguem a lavar

# O ritmo dos pedidos APERTA com o tempo: comeca folgado e fecha. E a forma de
# ter "sempre mais tarefa do que mao" (Overcooked) sem despejar tudo no comeco,
# o que so confundiria nos primeiros dez segundos.
PEDIDO_INTERVALO_INICIAL = 11_000
PEDIDO_INTERVALO_FINAL = 6_000
PEDIDOS_SIMULTANEOS = 4

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

LARGURA = 7
ALTURA = 5

# tipo:parametro. "." é chão livre.
# TODA estacao precisa de pelo menos uma celula livre VIZINHA, senao ela e
# inalcancavel — e o jogo nao avisa: o toque simplesmente nao faz nada.
#
# A primeira versao desta planta tinha as duas despensas de canto encostadas em
# outras estacoes dos dois lados, e as duas ficaram mortas. Por isso os cantos de
# cima sao chao, e por isso existe uma verificacao no smoke que varre a planta
# inteira atras disso. Planta e DADO: nivel novo e uma entrada aqui, e seria
# facil demais repetir o erro escrevendo o proximo.
#
# A BANCADA e uma ILHA de duas celulas no meio, e isso e decisao de projeto, nao
# enfeite. Ela e a estacao compartilhada — a peca que a pesquisa aponta como "a
# ideia numero um" do Overcooked —, entao ela e a unica que os DOIS precisam
# conseguir usar ao mesmo tempo.
#
# A primeira versao a encostou na parede da esquerda, entre duas tabuas: sobrou
# UM acesso, e um cozinheiro parado ali trancava o outro fora justamente da
# estacao que existe pra eles se encontrarem. No meio, cada celula da ilha tem
# tres lados livres.
#
# As outras estacoes ficam com um ou dois acessos de proposito: disputar passagem
# na pia e na entrega e o aperto que o genero quer. O que nao pode e a bancada
# ter esse problema.
_PLANTA_1 = [
    ".         d:alface  d:tomate  d:carne   d:pao     d:massa   .",
    "tabua     .         .         .         .         .         panela",
    ".         .         .         bancada   .         .         panela",
    "tabua     .         .         bancada   .         .         pia",
    "lixo      .         .         .         pratos    .         entrega",
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
        "cozinheiros": {
            lado: {
                "col": berco[i][0], "row": berco[i][1],
                # de onde veio e quando chega: é disso, e só disso, que o app
                # tira a posição desenhada. Interpolação, não simulação.
                "de_col": berco[i][0], "de_row": berco[i][1],
                "saiu_ms": inicio, "chega_ms": inicio,
                "mao": None,
                "ocupado_ate_ms": None,   # picando/lavando: não obedece nesse meio
                "estacao_alvo": None,
            }
            for i, lado in enumerate(("p1", "p2"))
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
    """O ritmo dos pedidos, que aperta conforme a rodada anda."""
    andado = (quando - estado["inicio_ms"]) / max(1, DURACAO_RODADA)
    andado = min(1.0, max(0.0, andado))
    return int(
        PEDIDO_INTERVALO_INICIAL
        + (PEDIDO_INTERVALO_FINAL - PEDIDO_INTERVALO_INICIAL) * andado
    )


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

    ocupadas = celulas_ocupadas(estado["estacoes"])
    # A célula do OUTRO também não vale: dois cozinheiros na mesma casa ficariam
    # desenhados um dentro do outro.
    for outro_lado, outro in estado["cozinheiros"].items():
        if outro_lado != lado:
            ocupadas.add((outro["col"], outro["row"]))
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

    resultado = _agir(estado, cozinheiro, estacao, chegada)
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
            codigo: {"nome": r["nome"], "itens": r["itens"], "pontos": r["pontos"]}
            for codigo, r in RECEITAS.items()
        },
        "ingredientes": INGREDIENTES,
        # Os tempos viajam pra tela pra ela desenhar barra sem saber a regra —
        # ela só precisa de um começo e de um fim, e os dois estão no estado.
        "tempos": {"picar": T_PICAR, "cozinhar": T_COZINHAR, "queimar": T_QUEIMAR,
                   "lavar": T_LAVAR, "passo": T_PASSO},
    }
