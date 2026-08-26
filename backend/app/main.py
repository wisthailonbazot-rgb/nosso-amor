import os

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import migrations, seed
from .clock import utcnow
from .config import CORS_ORIGINS, EXPOSE_DOCS, STORAGE_DIR
from .db import Base, SessionLocal, engine, get_db
from .realtime import hub
from .routers import auth as auth_router
from .routers import avatar, chat, couple, cycle, house, pet, push_routes, shop, tasks, wallet
from .security import user_from_token

app = FastAPI(
    title="App do Casal",
    version="0.1.0",
    # a documentacao interativa expoe o mapa inteiro da API; fica desligada em producao
    docs_url="/docs" if EXPOSE_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if EXPOSE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,  # o app manda o token no header, nunca em cookie
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # o service worker so pode ser servido da raiz, senao nao controla o app inteiro
    if request.url.path.endswith("sw.js"):
        response.headers["Cache-Control"] = "no-cache"
        response.headers["Service-Worker-Allowed"] = "/"

    # ------------------------------------------------------------ cache
    #
    # O index.html NAO PODE ser guardado, e os arquivos de /assets podem ser
    # guardados pra sempre. Nao e afinacao de desempenho: e o que impede o app
    # de parar de abrir.
    #
    # O nome do arquivo em /assets e um resumo do conteudo (index-ABC123.js), e
    # cada deploy apaga os antigos. O index.html e o unico lugar que diz QUAL
    # deles carregar. Servido sem `Cache-Control`, como estava, o navegador
    # aplica cache por adivinhacao — e o iPhone e o mais agressivo nisso,
    # principalmente aberto pela Tela de Inicio. Resultado: o aparelho guardava
    # um index.html velho, que apontava pra um bundle que o deploy seguinte ja
    # tinha apagado. O HTML carregava, o script dava 404 e o app abria EM
    # BRANCO — sem erro visivel, e so no celular, porque no computador eu
    # recarregava forcado o tempo todo.
    #
    # Como o nome do arquivo de /assets muda quando o conteudo muda, guardar ele
    # pra sempre e seguro: versao nova e outro nome, nunca o mesmo.
    caminho = request.url.path
    if caminho.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif caminho.startswith("/api") or caminho.startswith("/media"):
        pass  # a API ja decide sozinha; midia tem token na URL
    elif not caminho.endswith("sw.js"):
        # o resto e a casca do app (index.html, manifesto, icones)
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response


for module in (auth_router, push_routes, wallet, tasks, shop, avatar, cycle, chat, couple, pet, house):
    app.include_router(module.router)
app.include_router(push_routes.avisos)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    applied = migrations.run(engine)
    if applied:
        print(f"[migracao] colunas adicionadas: {', '.join(applied)}")

    os.makedirs(STORAGE_DIR, exist_ok=True)

    db = SessionLocal()
    try:
        seed.run(db)
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "at": utcnow().isoformat()}


# ------------------------------------------------------------------ tempo real
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = "") -> None:
    """Canal unico do app.

    O token vai na query porque a API de WebSocket do navegador nao deixa mandar
    header. E o mesmo token da sessao, e a conexao e wss:// em producao — nao
    trafega em claro. O `?token=` fica no log do proxy, o que e aceitavel aqui:
    sao dois usuarios e o servidor e nosso.
    """
    db: Session = SessionLocal()
    try:
        user = user_from_token(db, token or None)
    except HTTPException:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        db.close()
        return

    user_id = user.id
    user.last_seen_at = utcnow()
    db.commit()
    db.close()

    await hub.connect(user_id, ws)
    try:
        while True:
            # o cliente so manda ping; tudo que importa vem do servidor
            await ws.receive_text()
            await ws.send_json({"event": "pong", "data": None})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await hub.disconnect(user_id, ws)
        closing = SessionLocal()
        try:
            person = closing.get(type(user), user_id)
            if person is not None:
                person.last_seen_at = utcnow()
                closing.commit()
        finally:
            closing.close()


# ------------------------------------------------------------------ midia
@app.get("/media/{name}")
def media(name: str, token: str = "", db: Session = Depends(get_db)):
    """Foto do chat e do mural.

    Exige token de midia na URL porque <img src> nao manda header. O token de midia
    nao abre a API — ver `security.create_media_token`.
    """
    user_from_token(db, token or None, expected_type="media")
    candidate = os.path.normpath(os.path.join(STORAGE_DIR, name))
    # normpath + prefixo: impede que "../../etc/passwd" saia da pasta de midia
    if not candidate.startswith(STORAGE_DIR) or not os.path.isfile(candidate):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Arquivo nao encontrado")
    return FileResponse(candidate)


# ------------------------------------------------------------------ o app
# O mesmo build roda no navegador e dentro do APK.
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # Rota de API que nao existe tem que dar 404, nao a pagina do app.
        #
        # Sem isto, chamar um endpoint errado (ou um que ainda nao subiu no deploy)
        # devolve o HTML do app com status 200; o app tenta ler aquilo como dados,
        # nao consegue, e quebra numa tela branca com erro que nao diz nada. Ja
        # aconteceu aqui: o servidor estava com o codigo velho e a tela inicial
        # morreu com "Cannot read properties of undefined".
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Rota não existe: /{full_path}")

        candidate = os.path.normpath(os.path.join(STATIC_DIR, full_path))
        if full_path and candidate.startswith(STATIC_DIR) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
