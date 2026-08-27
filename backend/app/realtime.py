"""Tempo real por WebSocket: chat, presenca, jogos, casa.

Substitui o Supabase Realtime do documento. Sao duas pessoas num processo so, entao
a lista de conexoes vive na memoria — sem Redis, sem broker, sem container extra.

Isso cobra um preco explicito: **o servidor tem que rodar com UM worker**. Com dois
processos uvicorn, quem estivesse conectado no worker A nao receberia o evento
publicado no worker B, e o chat pareceria mudo pra um dos dois. O Dockerfile sobe
com um worker de proposito; se um dia isso mudar, aqui vira Redis pub/sub.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

from .clock import utcnow

log = logging.getLogger("realtime")


class Hub:
    def __init__(self) -> None:
        self._by_user: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        # Rotas `def` do FastAPI rodam em worker thread. Nessa thread nao existe
        # running loop; o publish antigo virava no-op e o chat so aparecia apos
        # atualizar. O WebSocket registra aqui o loop dono das conexoes.
        self._loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        self._loop = asyncio.get_running_loop()
        await ws.accept()
        async with self._lock:
            self._by_user.setdefault(user_id, set()).add(ws)
        await self.broadcast_presence()

    async def disconnect(self, user_id: int, ws: WebSocket) -> None:
        async with self._lock:
            sockets = self._by_user.get(user_id)
            if sockets:
                sockets.discard(ws)
                if not sockets:
                    self._by_user.pop(user_id, None)
        await self.broadcast_presence()

    def online_users(self) -> list[int]:
        return sorted(self._by_user.keys())

    def is_online(self, user_id: int) -> bool:
        return user_id in self._by_user

    async def send_to(self, user_id: int, event: str, data: Any = None) -> int:
        payload = {"event": event, "data": data, "at": utcnow().isoformat()}
        dead: list[WebSocket] = []
        sockets = list(self._by_user.get(user_id, ()))
        for ws in sockets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(user_id, ws)
        return len(sockets) - len(dead)

    async def send_to_all(self, event: str, data: Any = None) -> int:
        total = 0
        for user_id in list(self._by_user.keys()):
            total += await self.send_to(user_id, event, data)
        return total

    async def send_to_all_per_user(self, event: str, build) -> int:
        """Como `send_to_all`, mas o dado e MONTADO PRA CADA PESSOA.

        Existe por causa da midia. A URL de um audio ou de uma foto carrega um
        token que pertence a QUEM VAI LER — e o evento ao vivo era montado uma
        vez, com o token de quem ENVIOU, e mandado igual pros dois. Quem recebia
        ficava com um endereco emprestado: enquanto o token do outro valia, o
        arquivo abria; quando vencia, o audio parava de tocar so pra quem
        recebeu, e continuava tocando pra quem mandou. Um defeito assimetrico,
        que e o pior tipo de achar.

        Recarregar a tela consertava (a leitura normal monta o token certo), o
        que deixava o rastro ainda mais confuso.
        """
        total = 0
        for user_id in list(self._by_user.keys()):
            total += await self.send_to(user_id, event, build(user_id))
        return total

    async def broadcast_presence(self) -> None:
        await self.send_to_all("presence", {"online": self.online_users()})

    def schedule(self, event: str, data: Any = None, to_user: int | None = None) -> bool:
        """Entrega no loop do servidor mesmo quando chamada de worker thread."""
        loop = self._loop
        if loop is None or loop.is_closed():
            return False
        coroutine = self.send_to_all(event, data) if to_user is None else self.send_to(to_user, event, data)
        try:
            asyncio.run_coroutine_threadsafe(coroutine, loop)
            return True
        except RuntimeError:
            coroutine.close()
            return False


hub = Hub()


def publish_por_pessoa(event: str, build) -> None:
    """Publica um evento cujo conteudo muda conforme quem le.

    `build(user_id)` devolve o dado daquela pessoa. Ver
    `Hub.send_to_all_per_user` para o motivo de isso existir.
    """
    loop = hub._loop
    if loop is None or loop.is_closed():
        return
    coroutine = hub.send_to_all_per_user(event, build)
    try:
        asyncio.run_coroutine_threadsafe(coroutine, loop)
    except RuntimeError:
        coroutine.close()


def publish(event: str, data: Any = None, to_user: int | None = None) -> None:
    """Publica de dentro de uma rota normal (sincrona).

    Rota HTTP e funcao sync; o hub e async. Em vez de espalhar `await` por todo
    router, agenda a entrega no loop que ja esta rodando. Se nao houver loop
    (script, teste, job fora do servidor), simplesmente nao publica — o dado ja
    esta no banco e a tela pega no proximo carregamento.
    """
    hub.schedule(event, data, to_user)
