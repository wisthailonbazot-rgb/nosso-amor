"""Cozinha do Amor — as rotas.

A mecânica inteira mora em `app/cozinha.py`; aqui fica só a casca: quem pode
mandar em qual cozinheiro, quando a partida paga e como os dois celulares ficam
sabendo que mexeu.

--------------------------------------------------------------- as três regras

1. **Toda leitura e toda ação chamam `avancar()` primeiro.** Não existe laço
   rodando no servidor: pedido vence, panela queima e a rodada acaba porque a
   conta é feita na hora de olhar. Esquecer essa chamada em uma rota nova faria o
   jogo congelar só naquele caminho, o que é péssimo de achar.

2. **A vista é IGUAL pros dois.** Ao contrário da batalha naval, aqui não há nada
   a esconder: os dois olham a mesma cozinha. Por isso o evento de tempo real
   podia até carregar o estado — mas continua carregando só "mexeu, vem buscar",
   porque o estado tem prazo dentro e um estado atrasado num evento seria pior do
   que uma busca a mais.

3. **A rodada paga uma vez, e quem paga é o banco.** O prêmio sai na primeira
   leitura em que a rodada aparece acabada; quem impede o pagamento dobrado é o
   índice único de `dedupe_key`, e não um `if ja_pagou` — que perderia a corrida
   com os dois celulares lendo ao mesmo tempo no fim da rodada.
"""

from __future__ import annotations

import copy
import random
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from .. import cozinha as jogo
from .. import economy, missions
from ..clock import today, utcnow
from ..db import get_db
from ..models import MinigameMatch, User
from ..realtime import publish
from ..security import current_user, partner_of

router = APIRouter(prefix="/api/games", tags=["games"])

# Mesma escala dos outros jogos (ver `games.py`): a primeira do dia paga o
# cheio, as seguintes pagam o consolo. A cozinha vale um pouco mais que a naval
# porque uma rodada leva 3 minutos de atenção inteira.
PREMIO_COZINHA = 35
PREMIO_REPETIDO = 8


def _partida_aberta(db: Session, user: User) -> MinigameMatch | None:
    """A partida em andamento DESTE jogador.

    Diferente da naval, aqui o filtro é por jogador: uma partida solo dele não
    pode aparecer pra ela. Solo e a dois convivem na mesma tabela, e é o
    `player2_id` que separa as duas.
    """
    return (
        db.query(MinigameMatch)
        .filter(
            MinigameMatch.game_type == "cozinha",
            MinigameMatch.status != "finished",
            (MinigameMatch.player1_id == user.id) | (MinigameMatch.player2_id == user.id),
        )
        .order_by(MinigameMatch.id.desc())
        .first()
    )


# Por quanto tempo um resultado ainda espera ser lido. Mesma janela da naval, e
# pelo mesmo motivo: resultado de ontem nao e noticia, e as rodadas que ja
# existiam no banco nao tem a marca de "visto".
RESULTADO_VALE_POR = timedelta(hours=6)


def _resultado_pendente(db: Session, user: User) -> MinigameMatch | None:
    """A ultima rodada que ACABOU e que este jogador ainda nao fechou.

    ------------------------------------------- a MESMA armadilha, pela segunda vez

    Este jogo caiu exatamente no defeito que a batalha naval acabou de sair (ver
    HANDOFF 9.29), e vale registrar porque ele nao parece um defeito: parece o
    filtro certo.

    `_partida_aberta` filtra `status != "finished"`, e e o filtro certo pra
    decidir "posso abrir outra rodada?". Mas ele tambem respondia o `GET`. Entao,
    no instante em que a rodada acabava:

      - o proprio encerramento publica o evento de tempo real;
      - o app volta a buscar (que e o desenho correto: o evento so diz "mexeu");
      - a busca volta vazia, e a tela de resultado — com os pontos e os
        Coracoes — sumia antes de qualquer um ler.

    **Medido no navegador:** tocar em "Encerrar o expediente" com 73 pontos
    voltava direto pro cartao de comecar, sem mostrar nada.

    A licao, e ela e a razao deste comentario existir: **"o filtro de abrir" e "o
    filtro de mostrar" sao perguntas diferentes**, e usar um pelo outro apaga o
    fim do jogo. Quem tira o resultado da tela tem que ser o jogador.
    """
    ultima = (
        db.query(MinigameMatch)
        .filter(
            MinigameMatch.game_type == "cozinha",
            MinigameMatch.status == "finished",
            (MinigameMatch.player1_id == user.id) | (MinigameMatch.player2_id == user.id),
        )
        .order_by(MinigameMatch.id.desc())
        .first()
    )
    if ultima is None:
        return None
    if (ultima.state or {}).get(f"visto_{_lado(ultima, user.id)}"):
        return None
    fim = ultima.finished_at
    if fim is not None:
        # O instante volta do banco SEM fuso (coluna `DateTime` simples) e
        # `utcnow()` tem fuso. Subtrair um do outro estoura — a convencao do
        # projeto esta em `clock.to_brt`: instante do banco e UTC sem etiqueta.
        if fim.tzinfo is None:
            fim = fim.replace(tzinfo=timezone.utc)
        if utcnow() - fim > RESULTADO_VALE_POR:
            return None
    return ultima


def _fechar_resultado(db: Session, user: User) -> None:
    """Marca o resultado pendente como lido. Comecar outra rodada e ter lido."""
    pendente = _resultado_pendente(db, user)
    if pendente is None:
        return
    estado = _ler(pendente)
    estado[f"visto_{_lado(pendente, user.id)}"] = True
    pendente.state = estado
    flag_modified(pendente, "state")
    db.commit()


def _ler(partida: MinigameMatch) -> dict:
    """O estado da partida, numa cópia FUNDA. E a cópia funda é obrigatória.

    ------------------------------------------------------ o que aconteceu aqui

    A primeira versão fazia `dict(partida.state)`, que é cópia RASA: os
    dicionários de dentro (cozinheiros, estações, pedidos) continuavam sendo os
    MESMOS objetos que o ORM carregou. Mexer neles mexia no valor carregado
    também — então, na hora de gravar, o valor "novo" e o valor "antigo" eram a
    mesma coisa, o SQLAlchemy não via mudança nenhuma e **nada era gravado**.

    E falhava calada, do pior jeito possível: a resposta daquele pedido saía
    certa (ela é montada do estado em memória), então na tela o cozinheiro pegava
    a alface. No pedido seguinte a partida voltava do banco como estava antes, e
    o jogo inteiro reiniciava a cada toque.

    > **Medido:** três toques seguidos na despensa. Nos três a resposta trouxe
    > `mao = alface`; nas três o banco trouxe `mao = None`. Era pra o segundo
    > toque ser recusado por mão cheia, e foi essa recusa que não veio que
    > entregou o defeito.

    Com a cópia funda o estado carregado fica intacto, o novo é de verdade
    diferente, e `flag_modified` (em `_responder`) tira qualquer dúvida sobre o
    flush. A batalha naval nunca teve esse problema porque ela já copiava à mão
    as partes que mexia — aqui o estado é fundo demais pra confiar nisso.
    """
    return copy.deepcopy(partida.state or {})


def _lado(partida: MinigameMatch, user_id: int) -> str:
    return "p1" if partida.player1_id == user_id else "p2"


def _pega(db: Session, partida_id: int, user: User) -> MinigameMatch:
    partida = db.get(MinigameMatch, partida_id)
    if partida is None or partida.game_type != "cozinha":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Essa partida não existe")
    if user.id not in (partida.player1_id, partida.player2_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Essa partida não é sua")
    return partida


def _fechar(partida: MinigameMatch, estado: dict, db: Session, user: User) -> int:
    """Encerra a rodada no banco e paga, uma vez.

    Devolve quanto ESTE jogador ganhou agora (0 se ele já tinha recebido, ou se a
    rodada não rendeu ponto nenhum).
    """
    if partida.status != "finished":
        partida.status = "finished"
        partida.finished_at = utcnow()
        partida.player1_score = estado["pontos"]

    if estado["pontos"] <= 0:
        return 0

    # A `dedupe_key` da primeira do dia é por DIA; a das seguintes é por PARTIDA.
    # É essa diferença que faz a segunda rodada do dia pagar o consolo em vez de
    # nada — e o índice único é quem decide, não um `if`.
    ganho = 0
    if economy.try_earn(
        db, user.id, PREMIO_COZINHA, "minigame",
        reference="cozinha", note="Cozinha do Amor — primeira rodada do dia",
        dedupe_key=f"cozinha:{user.id}:{today().isoformat()}",
    ):
        ganho = PREMIO_COZINHA
    elif economy.try_earn(
        db, user.id, PREMIO_REPETIDO, "minigame",
        reference="cozinha", note="Cozinha do Amor — mais uma rodada",
        dedupe_key=f"cozinha-extra:{user.id}:{partida.id}",
    ):
        ganho = PREMIO_REPETIDO

    if ganho:
        publish("wallet", {"balance": economy.balance(db, user.id)}, to_user=user.id)
        missions.record(db, "pet_game")
    return ganho


def _avisar(partida: MinigameMatch) -> None:
    for uid in (partida.player1_id, partida.player2_id):
        if uid:
            publish("game", {"jogo": "cozinha", "id": partida.id}, to_user=uid)


def _responder(partida: MinigameMatch, estado: dict, db: Session, user: User,
               agora: int, extra: dict | None = None) -> dict:
    """Avança, grava, paga se acabou, e devolve a vista. O caminho de saída de todas as rotas."""
    jogo.avancar(estado, agora)
    ganho = _fechar(partida, estado, db, user) if estado["acabou"] else 0

    # -------------------------------------------- so grava se algo MUDOU mesmo
    #
    # Antes, toda leitura gravava: o GET avancava o estado, incrementava a
    # revisao e dava commit — mesmo quando nada tinha acontecido. Com a busca
    # agendada da tela mais os eventos de tempo real, isso vira escrita
    # constante, e no SQLite da bancada deu `database is locked` de verdade.
    #
    # A comparacao so e possivel porque `_ler` faz copia FUNDA: o valor
    # carregado fica intacto, entao da pra perguntar se o novo difere dele.
    #
    # `db.new or db.dirty` cobre o resto: se `_fechar` mexeu no status ou a
    # economia criou linha de extrato, grava de qualquer jeito.
    if estado != partida.state:
        partida.state = estado
        # Dizer explicitamente que o JSON mudou. Com a cópia funda a atribuição
        # já bastaria, mas este é o defeito que reinicia a partida a cada toque
        # **sem dar erro nenhum** — e ele custou uma sessão inteira pra aparecer.
        flag_modified(partida, "state")
        partida.revision += 1
    if db.new or db.dirty or db.deleted:
        db.commit()
    vista = jogo.vista(estado, _lado(partida, user.id), agora)
    vista["id"] = partida.id
    vista["premio_ganho"] = ganho
    vista["premio_cheio"] = PREMIO_COZINHA
    parceiro = partner_of(db, user)
    vista["parceiro"] = {"id": parceiro.id, "name": parceiro.name} if parceiro else None
    if extra:
        vista.update(extra)
    return {"partida": vista}


class NovaIn(BaseModel):
    solo: bool = True


class AcaoIn(BaseModel):
    # "auto" só vale sozinho: é o app dizendo "escolha você quem atende".
    lado: str = Field(pattern="^(p1|p2|auto)$")
    estacao: int = Field(ge=0, le=200)


@router.get("/cozinha")
def cozinha_atual(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    # PRIMEIRO o resultado que ainda nao foi lido, e so depois a rodada em
    # andamento. A ordem e o conserto — ver `_resultado_pendente`.
    pendente = _resultado_pendente(db, user)
    if pendente is not None:
        return _responder(pendente, _ler(pendente), db, user, jogo.agora_ms())
    partida = _partida_aberta(db, user)
    if partida is None:
        return {"partida": None, "premio_cheio": PREMIO_COZINHA,
                "receitas": {c: {"nome": r["nome"], "itens": r["itens"], "pontos": r["pontos"]}
                             for c, r in jogo.RECEITAS.items()},
                "ingredientes": jogo.INGREDIENTES}
    estado = _ler(partida)
    if not estado:
        return {"partida": None, "premio_cheio": PREMIO_COZINHA}
    # Entrar é automático numa partida a dois que ainda não tem o segundo: só
    # existem duas pessoas no app, então convite não faria sentido.
    if not estado.get("solo") and partida.player2_id is None and partida.player1_id != user.id:
        partida.player2_id = user.id
        db.commit()
        _avisar(partida)
    return _responder(partida, estado, db, user, jogo.agora_ms())


@router.post("/cozinha/nova")
def cozinha_nova(
    payload: NovaIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Abre uma rodada. Devolve a que já estiver aberta, em vez de criar outra.

    Os dois tocam o botão ao mesmo tempo com frequência, e duas partidas abertas
    deixariam cada um numa cozinha diferente esperando um parceiro que está do
    outro lado fazendo o mesmo. Mesma decisão da batalha naval.
    """
    # Comecar outra rodada e ter lido o resultado da anterior.
    _fechar_resultado(db, user)
    aberta = _partida_aberta(db, user)
    if aberta is not None:
        return _responder(aberta, _ler(aberta), db, user, jogo.agora_ms())

    parceiro = partner_of(db, user)
    agora = jogo.agora_ms()
    estado = jogo.nova_partida(
        nivel=1, solo=payload.solo, semente=random.randrange(1, 10**6), inicio_ms=agora
    )
    partida = MinigameMatch(
        game_type="cozinha",
        status="in_progress",
        created_by=user.id,
        player1_id=user.id,
        # Solo NÃO tem segundo jogador. Sem isso a partida solo dele apareceria
        # como partida aberta pra ela, e ela cairia dentro de uma rodada que não
        # é dela — os dois mexendo nos mesmos dois cozinheiros.
        player2_id=None if payload.solo else (parceiro.id if parceiro else None),
        state=estado,
    )
    db.add(partida)
    db.commit()
    if not payload.solo:
        _avisar(partida)
    return _responder(partida, estado, db, user, agora)


@router.post("/cozinha/{partida_id}/acao")
def cozinha_acao(
    partida_id: int,
    payload: AcaoIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Manda um cozinheiro até uma estação e age lá."""
    partida = _pega(db, partida_id, user)
    estado = _ler(partida)
    agora = jogo.agora_ms()
    # Avançar ANTES de julgar a jogada. Sem isso, um pedido já vencido ainda
    # contaria como aberto e a panela esquecida ainda não teria queimado — o
    # jogador seria premiado por ter demorado.
    jogo.avancar(estado, agora)

    if estado.get("acabou"):
        return _responder(partida, estado, db, user, agora, {"recusado": "A rodada acabou"})

    # Sozinho, os dois cozinheiros são seus (foi assim que o Overcooked resolveu
    # o modo de um jogador, e é o que mantém o jogo sendo sobre dividir tarefa).
    # A dois, cada um só manda no seu — senão daria pra jogar pelos dois lados.
    if not estado.get("solo"):
        if payload.lado == "auto":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A dois, cada um manda no seu")
        if payload.lado != _lado(partida, user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Esse cozinheiro é do outro")

    try:
        if payload.lado == "auto":
            _, resultado = jogo.mandar_auto(estado, payload.estacao, agora)
        else:
            resultado = jogo.mandar(estado, payload.lado, payload.estacao, agora)
    except jogo.Recusado as erro:
        # Jogada que não vale NÃO é erro de servidor: é o jogo respondendo "não
        # dá". Devolver 4xx faria a tela pintar vermelho de erro a cada toque
        # errado, num jogo em que tocar errado é parte de jogar. Vem junto com o
        # estado, que o app precisa de qualquer forma.
        return _responder(partida, estado, db, user, agora, {"recusado": str(erro)})

    resposta = _responder(partida, estado, db, user, agora, {"resultado": resultado})
    if not estado.get("solo"):
        _avisar(partida)
    return resposta


@router.post("/cozinha/{partida_id}/desistir")
def cozinha_desistir(
    partida_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Encerra a rodada agora. Serve pra sair e pra destravar uma partida esquecida.

    Sem isto, uma rodada aberta e abandonada ficaria voltando pro jogador todo
    dia — e como `_partida_aberta` só olha partidas não terminadas, não haveria
    jeito de sair dela.
    """
    partida = _pega(db, partida_id, user)
    estado = _ler(partida)
    agora = jogo.agora_ms()
    jogo.avancar(estado, agora)
    # Encerrar por desistência PAGA o que a rodada rendeu até aqui: os pontos
    # foram feitos de verdade. O que não se pode é encerrar e reabrir pra somar
    # de novo — e disso cuida a `dedupe_key`.
    estado["acabou"] = True
    estado["fim_ms"] = min(estado.get("fim_ms", agora), agora)
    resposta = _responder(partida, estado, db, user, agora)
    _avisar(partida)
    return resposta


@router.post("/cozinha/{partida_id}/visto")
def cozinha_visto(
    partida_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """"Ja li o resultado, pode tirar da tela."

    Quem fecha a tela de fim e o jogador, e nao o servidor — ver
    `_resultado_pendente`. Numa rodada a dois a marca e por LADO, porque os dois
    chegam nessa tela em momentos diferentes.
    """
    partida = _pega(db, partida_id, user)
    if partida.status != "finished":
        raise HTTPException(status.HTTP_409_CONFLICT, "Essa rodada ainda nao acabou")
    estado = _ler(partida)
    estado[f"visto_{_lado(partida, user.id)}"] = True
    partida.state = estado
    flag_modified(partida, "state")
    db.commit()
    return {"partida": None}
