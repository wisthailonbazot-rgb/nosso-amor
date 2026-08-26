"""Os jogos do casal — memória (sozinho, mesmo tabuleiro) e batalha naval (a dois).

Os dois já existiam como linha no plano original; o que muda aqui é que eles
são os primeiros jogos que **não** são do bichinho.

Por que os dois usam a mesma tabela (`minigame_matches`): ela já tinha tudo o
que faltava — `state` em JSON, `turn_user_id`, `revision` e os dois jogadores.
Criar tabela nova por jogo espalharia a mesma coisa em dois lugares e a segunda
divergiria da primeira na primeira vez que alguém mexesse numa só.

------------------------------------------------------------------ o ponto de
                                                                    segurança

Na batalha naval, a posição dos navios de quem está do outro lado **nunca sai
do servidor**. É a regra que decide se o jogo funciona ou não: mandar o tabuleiro
inteiro pro app e esconder na tela não esconde nada — basta abrir o painel do
navegador e ler a resposta pra ganhar toda partida. Por isso existe `_vista()`,
que monta uma resposta DIFERENTE pra cada um dos dois: o seu tabuleiro inteiro,
e o do outro apenas nas casas onde você já atirou.

Pela mesma razão o tiro é resolvido aqui, e não no app: o app manda a casa, o
servidor responde o que aconteceu.
"""

from __future__ import annotations

import hashlib
import random

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import economy, missions
from ..clock import today, utcnow
from ..db import get_db
from ..models import MinigameMatch, User
from ..realtime import publish
from ..security import current_user, partner_of

router = APIRouter(prefix="/api/games", tags=["games"])


# TODA partida paga. A primeira do dia paga o cheio; as seguintes, o consolo.
#
# Antes era uma vez por dia e ponto: a partir da segunda partida o jogo não
# valia mais nada em moeda, e o dono reclamou disso com razão — jogo que não
# rende ninguém volta a jogar.
#
# Pagar sempre o valor cheio também não serve: memória e batalha naval não
# gastam energia de bichinho nenhum, então não existe nada segurando a
# repetição, e seria imprimir Coração à vontade. O meio-termo é o valor cair
# depois da primeira: continua sempre valendo alguma coisa (que era o pedido),
# sem virar torneira aberta. Quem separa a primeira das outras é o índice único
# de `dedupe_key` no banco, não um `if`.
#
# Os tres subiram em 26/08 (12/15/3 -> 25/30/8). O motivo esta em
# `settings_store.py`: a renda do dia inteiro nao pagava um movel. Aqui o
# reajuste tem uma razao a mais — o valor do CONSOLO era 3 Coracoes, e 3
# Coracoes por uma partida inteira de batalha naval nao e recompensa, e troco.
# O que faz alguem repetir uma partida e ela valer alguma coisa; a diferenca
# pra primeira do dia continua existindo (8 contra 30), que e o que impede a
# torneira aberta.
PREMIO_MEMORIA = 25
PREMIO_NAVAL = 30
PREMIO_REPETIDO = 8


# ==================================================================== memória
#
# São 8 pares (tabuleiro 4x4). O baralho tem mais assuntos do que cabem numa
# rodada de propósito: o sorteio do dia escolhe quais entram, então o jogo não
# fica sempre igual.
# Estes catorze assuntos foram ESCOLHIDOS OLHANDO, um a um. O gerador (o unico
# modelo gratuito do Pollinations) desenha bem objeto simples e fofo, mas erra o
# assunto com frequencia: pedindo "um coracao vermelho" ele devolveu um bichinho
# nas tres tentativas, e "uma chave" virou um hamster. Ficaram de fora os que
# nao acertaram, os que sairam em foto no meio de um baralho de desenho (o cafe)
# e os que vieram com mao de gente na imagem. Cada nome aqui tem o arquivo
# correspondente em `web/public/cartas/` — e o smoke confere isso, porque carta
# sem arquivo nao da erro nenhum: aparece um quadrado em branco no tabuleiro, e
# duas cartas em branco sao um par que a pessoa nao tem como distinguir.
CARTAS = [
    "balao", "bolo", "cachorro", "camera", "estrela", "flor", "gatinho",
    "guardachuva", "lua", "pipoca", "pizza", "presente", "sol", "sorvete",
]
PARES = 8


def _tabuleiro_do_dia(dia: str) -> list[str]:
    """O mesmo tabuleiro pros dois, sorteado pelo dia.

    Os dois jogam a MESMA distribuição porque a graça é comparar — com
    tabuleiros diferentes, "fiz em 14 tentativas" não quer dizer nada. O sorteio
    sai de um resumo da data, e não de `random` sem semente: assim ele é o mesmo
    nos dois celulares, sem o servidor precisar guardar nada.
    """
    semente = int(hashlib.sha256(f"memoria:{dia}".encode()).hexdigest()[:12], 16)
    sorteio = random.Random(semente)
    escolhidas = sorteio.sample(CARTAS, PARES)
    baralho = escolhidas * 2
    sorteio.shuffle(baralho)
    return baralho


class MemoriaFimIn(BaseModel):
    tentativas: int = Field(ge=PARES, le=400)
    duration_ms: int = Field(ge=1000, le=45 * 60 * 1000)


def _melhores_do_dia(db: Session, dia: str) -> list[dict]:
    linhas = (
        db.query(MinigameMatch)
        .filter(MinigameMatch.game_type == "memoria", MinigameMatch.status == "finished")
        .all()
    )
    por_pessoa: dict[int, dict] = {}
    for linha in linhas:
        estado = linha.state or {}
        if estado.get("dia") != dia:
            continue
        atual = por_pessoa.get(linha.player1_id)
        # Menos tentativas ganha; empatou, o tempo desempata.
        chave = (estado.get("tentativas", 999), estado.get("duration_ms", 10**9))
        if atual is None or chave < (atual["tentativas"], atual["duration_ms"]):
            por_pessoa[linha.player1_id] = {
                "user_id": linha.player1_id,
                "tentativas": estado.get("tentativas", 0),
                "duration_ms": estado.get("duration_ms", 0),
            }
    return sorted(por_pessoa.values(), key=lambda r: (r["tentativas"], r["duration_ms"]))


@router.get("/memoria")
def memoria(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    dia = today().isoformat()
    return {
        "dia": dia,
        "pares": PARES,
        "cartas": _tabuleiro_do_dia(dia),
        "melhores": _melhores_do_dia(db, dia),
        "premio": PREMIO_MEMORIA,
    }


@router.post("/memoria/fim")
def memoria_fim(
    payload: MemoriaFimIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Fim de partida: guarda o resultado e paga, uma vez por dia.

    O placar vem do app, então ele é limitado no schema: menos tentativas do que
    pares é impossível (cada par precisa de pelo menos uma virada de dupla), e
    tempo abaixo de um segundo também. Isso não impede alguém de mandar um
    resultado inventado com o app adulterado — mas o prêmio é por DIA e não por
    resultado, então mentir não rende Coração nenhum a mais. O que estaria em
    jogo seria só quem aparece na frente na lista dos dois, e aí o problema é
    com a namorada, não com o servidor.
    """
    dia = today().isoformat()
    registro = MinigameMatch(
        game_type="memoria",
        status="finished",
        created_by=user.id,
        player1_id=user.id,
        player1_score=max(0, 200 - payload.tentativas),
        winner_id=user.id,
        state={
            "dia": dia,
            "tentativas": payload.tentativas,
            "duration_ms": payload.duration_ms,
        },
        finished_at=utcnow(),
    )
    db.add(registro)
    db.flush()

    premio = economy.try_earn(
        db,
        user.id,
        PREMIO_MEMORIA,
        "minigame",
        reference="memoria",
        note="Jogo da memória — primeira partida do dia",
        dedupe_key=f"memoria:{user.id}:{dia}",
    )
    if premio:
        moedas = PREMIO_MEMORIA
    else:
        # Já pegou a do dia: paga o consolo, com chave por partida (o id da
        # linha que acabou de ser gravada), pra o toque duplo não pagar duas
        # vezes pela mesma partida.
        economy.try_earn(
            db,
            user.id,
            PREMIO_REPETIDO,
            "minigame",
            reference="memoria",
            note="Jogo da memória — mais uma partida",
            dedupe_key=f"memoria-extra:{user.id}:{registro.id}",
        )
        moedas = PREMIO_REPETIDO
    missions.record(db, "pet_game")
    publish("wallet", {"balance": economy.balance(db, user.id)}, to_user=user.id)
    db.commit()
    return {
        "coins": moedas,
        "melhores": _melhores_do_dia(db, dia),
    }


# =============================================================== batalha naval
LADO = 8
# 4 navios, 12 casas. Tabuleiro de 10x10 com 5 navios é o clássico, mas num
# celular de 375 px cada casa ficaria com 30 px e o dedo erraria a vizinha.
FROTA = [4, 3, 3, 2]
TOTAL_DE_CASAS = sum(FROTA)


class NavioIn(BaseModel):
    linha: int = Field(ge=0, le=LADO - 1)
    coluna: int = Field(ge=0, le=LADO - 1)
    tamanho: int = Field(ge=2, le=5)
    horizontal: bool


class FrotaIn(BaseModel):
    navios: list[NavioIn] = Field(min_length=len(FROTA), max_length=len(FROTA))


class TiroIn(BaseModel):
    linha: int = Field(ge=0, le=LADO - 1)
    coluna: int = Field(ge=0, le=LADO - 1)


def _casas(navio: NavioIn) -> list[list[int]]:
    if navio.horizontal:
        return [[navio.linha, navio.coluna + i] for i in range(navio.tamanho)]
    return [[navio.linha + i, navio.coluna] for i in range(navio.tamanho)]


def _validar_frota(navios: list[NavioIn]) -> list[dict]:
    """Confere a frota AQUI, e não na tela.

    A tela também confere, pra dar resposta imediata a quem está posicionando —
    mas a tela é do jogador. Sem esta conferência, bastaria mandar quatro navios
    de tamanho 2 empilhados num canto (ou fora do tabuleiro) pra ficar
    praticamente impossível de afundar.
    """
    if sorted((n.tamanho for n in navios), reverse=True) != sorted(FROTA, reverse=True):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"A frota tem que ser {', '.join(str(t) for t in FROTA)} casas",
        )
    ocupadas: set[tuple[int, int]] = set()
    saida = []
    for navio in navios:
        casas = _casas(navio)
        for linha, coluna in casas:
            if not (0 <= linha < LADO and 0 <= coluna < LADO):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Navio fora do tabuleiro")
            if (linha, coluna) in ocupadas:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dois navios em cima do outro")
            ocupadas.add((linha, coluna))
        saida.append({"tamanho": navio.tamanho, "casas": casas, "atingidas": []})
    return saida


def _partida_aberta(db: Session) -> MinigameMatch | None:
    return (
        db.query(MinigameMatch)
        .filter(MinigameMatch.game_type == "naval", MinigameMatch.status != "finished")
        .order_by(MinigameMatch.id.desc())
        .first()
    )


def _lado(partida: MinigameMatch, user_id: int) -> str:
    return "p1" if partida.player1_id == user_id else "p2"


def _vista(partida: MinigameMatch, user: User, db: Session) -> dict:
    """A partida vista POR ESTE jogador — e só o que ele pode saber.

    O tabuleiro do outro sai daqui apenas nas casas onde este jogador já atirou.
    É este recorte que impede a partida de ser ganha lendo a resposta da API,
    coisa que esconder na tela não impediria.
    """
    estado = partida.state or {}
    meu = _lado(partida, user.id)
    dele = "p2" if meu == "p1" else "p1"
    minha_frota = estado.get(f"frota_{meu}") or []
    frota_dele = estado.get(f"frota_{dele}") or []
    meus_tiros = estado.get(f"tiros_{meu}") or []
    tiros_dele = estado.get(f"tiros_{dele}") or []

    # O que eu enxergo do tabuleiro dele: só as casas em que já atirei.
    dele_por_casa = {}
    for indice, navio in enumerate(frota_dele):
        for casa in navio["casas"]:
            dele_por_casa[tuple(casa)] = indice
    ataque = []
    for linha, coluna in meus_tiros:
        indice = dele_por_casa.get((linha, coluna))
        afundado = (
            indice is not None
            and len(frota_dele[indice]["atingidas"]) >= frota_dele[indice]["tamanho"]
        )
        ataque.append(
            {"linha": linha, "coluna": coluna, "acertou": indice is not None, "afundou": afundado}
        )

    parceiro = partner_of(db, user)
    return {
        "id": partida.id,
        # A REVISAO VIAJA PRA TELA (26/08). Cada jogada incrementa este contador,
        # e o app usa ele pra nunca aplicar uma vista mais VELHA do que a que ja
        # tem. Sem isso ha corrida: o tiro responde com a vista nova e, no mesmo
        # instante, o evento de tempo real faz o app buscar de novo — se as duas
        # respostas voltarem fora de ordem, a tela retrocede e o tabuleiro pisca.
        # Com o numero, a resposta atrasada e simplesmente ignorada.
        "revision": partida.revision,
        "status": partida.status,
        "lado": meu,
        "lado_pronto": bool(minha_frota),
        "outro_pronto": bool(frota_dele),
        "sua_vez": partida.turn_user_id == user.id,
        "vencedor_id": partida.winner_id,
        "sou_o_vencedor": partida.winner_id == user.id if partida.winner_id else None,
        "lado_do_tamanho": LADO,
        "frota_modelo": FROTA,
        "parceiro": {"id": parceiro.id, "name": parceiro.name} if parceiro else None,
        # o meu tabuleiro inteiro: navios onde estão, e onde ELE já acertou
        "meu_tabuleiro": {
            "navios": [
                {"tamanho": n["tamanho"], "casas": n["casas"], "atingidas": n["atingidas"]}
                for n in minha_frota
            ],
            "tiros_recebidos": [{"linha": l, "coluna": c} for l, c in tiros_dele],
        },
        # o dele: SÓ o que eu já descobri atirando
        "meus_tiros": ataque,
        "afundados_meus": sum(
            1 for n in minha_frota if len(n["atingidas"]) >= n["tamanho"]
        ),
        "afundados_dele": sum(
            1 for n in frota_dele if len(n["atingidas"]) >= n["tamanho"]
        ),
        "premio": PREMIO_NAVAL,
    }


def _avisar(partida: MinigameMatch, db: Session) -> None:
    """Empurra a partida pros DOIS — cada um com a sua vista.

    Um evento só com o estado dentro não serviria: o estado é diferente pra cada
    lado, e mandar o mesmo objeto pros dois vazaria os navios de um pro outro.
    Por isso o evento carrega só o id, e cada app volta e busca a SUA vista.
    """
    for uid in (partida.player1_id, partida.player2_id):
        if uid:
            publish("game", {"jogo": "naval", "id": partida.id}, to_user=uid)


@router.get("/naval")
def naval_atual(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    partida = _partida_aberta(db)
    if partida is None:
        return {"partida": None}
    # A partida foi criada pelo outro e ainda não tem segundo jogador: entrar é
    # automático porque só existem duas pessoas no app. Convite não faria
    # sentido aqui — não há mais ninguém pra convidar.
    if partida.player2_id is None and partida.player1_id != user.id:
        partida.player2_id = user.id
        partida.revision += 1
        db.commit()
        _avisar(partida, db)
    if user.id not in (partida.player1_id, partida.player2_id):
        return {"partida": None}
    return {"partida": _vista(partida, user, db)}


@router.post("/naval/nova")
def naval_nova(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Abre uma partida (ou devolve a que já está aberta).

    Devolver a existente em vez de criar outra é de propósito: os dois tocam o
    botão ao mesmo tempo com frequência, e duas partidas abertas deixariam cada
    um num tabuleiro diferente, esperando um adversário que está do outro lado
    fazendo o mesmo.
    """
    aberta = _partida_aberta(db)
    if aberta is not None:
        if aberta.player2_id is None and aberta.player1_id != user.id:
            aberta.player2_id = user.id
            aberta.revision += 1
            db.commit()
            _avisar(aberta, db)
        if user.id in (aberta.player1_id, aberta.player2_id):
            return {"partida": _vista(aberta, user, db)}

    parceiro = partner_of(db, user)
    partida = MinigameMatch(
        game_type="naval",
        status="waiting",
        created_by=user.id,
        player1_id=user.id,
        player2_id=parceiro.id if parceiro else None,
        state={},
    )
    db.add(partida)
    db.commit()
    _avisar(partida, db)
    return {"partida": _vista(partida, user, db)}


@router.post("/naval/{partida_id}/frota")
def naval_frota(
    partida_id: int,
    payload: FrotaIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    partida = db.get(MinigameMatch, partida_id)
    if partida is None or partida.game_type != "naval":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Essa partida não existe")
    if user.id not in (partida.player1_id, partida.player2_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Essa partida não é sua")
    if partida.status == "finished":
        raise HTTPException(status.HTTP_409_CONFLICT, "Essa partida já acabou")

    estado = dict(partida.state or {})
    meu = _lado(partida, user.id)
    if estado.get(f"frota_{meu}"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Sua frota já está posicionada")

    estado[f"frota_{meu}"] = _validar_frota(payload.navios)
    estado.setdefault(f"tiros_{meu}", [])
    # Os dois posicionados: começa, e quem abre é quem criou.
    if estado.get("frota_p1") and estado.get("frota_p2"):
        partida.status = "in_progress"
        partida.turn_user_id = partida.created_by
    partida.state = estado
    partida.revision += 1
    db.commit()
    _avisar(partida, db)
    return {"partida": _vista(partida, user, db)}


@router.post("/naval/{partida_id}/tiro")
def naval_tiro(
    partida_id: int,
    payload: TiroIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Um tiro. Quem decide o que aconteceu é o servidor.

    Acertou, joga de novo (é a regra que todo mundo aqui joga na mão, e é o que
    mantém a partida viva). Errou, passa a vez.
    """
    partida = db.get(MinigameMatch, partida_id)
    if partida is None or partida.game_type != "naval":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Essa partida não existe")
    if user.id not in (partida.player1_id, partida.player2_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Essa partida não é sua")
    if partida.status != "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, "A partida ainda não começou")
    if partida.turn_user_id != user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Espere a sua vez")

    estado = dict(partida.state or {})
    meu = _lado(partida, user.id)
    dele = "p2" if meu == "p1" else "p1"
    meus_tiros = list(estado.get(f"tiros_{meu}") or [])
    if [payload.linha, payload.coluna] in meus_tiros:
        raise HTTPException(status.HTTP_409_CONFLICT, "Você já atirou aí")

    frota_dele = [dict(n, atingidas=list(n["atingidas"])) for n in estado.get(f"frota_{dele}") or []]
    acertou = False
    afundou = False
    for navio in frota_dele:
        if [payload.linha, payload.coluna] in navio["casas"]:
            acertou = True
            navio["atingidas"].append([payload.linha, payload.coluna])
            afundou = len(navio["atingidas"]) >= navio["tamanho"]
            break

    meus_tiros.append([payload.linha, payload.coluna])
    estado[f"tiros_{meu}"] = meus_tiros
    estado[f"frota_{dele}"] = frota_dele

    atingidas = sum(len(n["atingidas"]) for n in frota_dele)
    venceu = atingidas >= TOTAL_DE_CASAS
    ganhou_coracoes = 0
    if venceu:
        partida.status = "finished"
        partida.winner_id = user.id
        partida.finished_at = utcnow()
        partida.turn_user_id = None
        if meu == "p1":
            partida.player1_score += 1
        else:
            partida.player2_score += 1
        premio = economy.try_earn(
            db,
            user.id,
            PREMIO_NAVAL,
            "minigame",
            reference="naval",
            note="Batalha naval — primeira vitória do dia",
            dedupe_key=f"naval:{user.id}:{today().isoformat()}",
        )
        if premio:
            ganhou_coracoes = PREMIO_NAVAL
        else:
            economy.try_earn(
                db,
                user.id,
                PREMIO_REPETIDO,
                "minigame",
                reference="naval",
                note="Batalha naval — mais uma vitória",
                dedupe_key=f"naval-extra:{user.id}:{partida.id}",
            )
            ganhou_coracoes = PREMIO_REPETIDO
        publish("wallet", {"balance": economy.balance(db, user.id)}, to_user=user.id)
        missions.record(db, "pet_game")
    elif not acertou:
        partida.turn_user_id = partida.player2_id if meu == "p1" else partida.player1_id

    partida.state = estado
    partida.revision += 1
    db.commit()
    _avisar(partida, db)
    vista = _vista(partida, user, db)
    return {
        "partida": vista,
        "acertou": acertou,
        "afundou": afundou,
        "venceu": venceu,
        "coins": ganhou_coracoes,
    }


@router.post("/naval/{partida_id}/desistir")
def naval_desistir(
    partida_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Encerra a partida. Serve pra desistir E pra recomeçar de vez.

    Sem isto, uma partida em que alguém posicionou a frota e não voltou mais
    ficaria aberta pra sempre — e `_partida_aberta` devolveria ela pros dois,
    todo dia, sem jeito de sair.
    """
    partida = db.get(MinigameMatch, partida_id)
    if partida is None or partida.game_type != "naval":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Essa partida não existe")
    if user.id not in (partida.player1_id, partida.player2_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Essa partida não é sua")
    if partida.status != "finished":
        partida.status = "finished"
        partida.finished_at = utcnow()
        partida.turn_user_id = None
        # Desistir no meio entrega a vitória pro outro; desistir antes de
        # começar não dá vitória a ninguém (não houve jogo).
        if partida.state and partida.state.get("frota_p1") and partida.state.get("frota_p2"):
            partida.winner_id = (
                partida.player2_id if partida.player1_id == user.id else partida.player1_id
            )
        partida.revision += 1
        db.commit()
        _avisar(partida, db)
    return {"partida": _vista(partida, user, db)}
