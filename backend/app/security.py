import hashlib
import hmac
import os
import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .clock import utcnow
from .config import JWT_ALGORITHM, JWT_SECRET, TOKEN_DAYS
from .db import get_db
from .models import User

_ITERATIONS = 240_000
bearer = HTTPBearer(auto_error=False)

# Hash descartavel usado quando o usuario nao existe: o login gasta o mesmo tempo
# com login valido e invalido, senao da pra descobrir quem tem conta pelo relogio.
_DUMMY_HASH = f"pbkdf2_sha256${_ITERATIONS}${'00' * 16}${'00' * 32}"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
    except (ValueError, AttributeError):
        return False
    return hmac.compare_digest(dk.hex(), hash_hex)


def burn_password_time() -> None:
    """Queima o mesmo tempo de um verify_password real."""
    verify_password("nao-existe", _DUMMY_HASH)


# ---------------------------------------------------------------- tokens
def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "slug": user.slug,
        "ver": user.token_version,  # trocar a senha invalida os tokens antigos
        "typ": "session",
        "exp": utcnow() + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# De quanto em quanto tempo o token de midia PODE mudar.
#
# Ver `create_media_token` logo abaixo: o vencimento e arredondado pra cima ate a
# proxima marca destas, e e isso que faz duas leituras seguidas devolverem o
# MESMO token, byte por byte.
MEDIA_TOKEN_JANELA_MIN = 60


def create_media_token(user: User, minutes: int = 120) -> str:
    """Token curto pra carregar foto em <img src>.

    A tag <img> nao manda header de autenticacao, entao o token precisa ir na URL
    — e URL vaza (historico, log de proxy, print de tela). Por isso este token nao
    e o da sessao: ele so abre arquivo de midia, nao abre a API.

    ------------------------------------------- por que o vencimento e arredondado

    Porque a URL de midia e DUAS COISAS ao mesmo tempo: a identidade do arquivo
    (o caminho) e a credencial pra abrir (o token). Enquanto o vencimento era
    `agora + 120min`, ele mudava a cada segundo — e com ele o token, e com o
    token a URL inteira. Duas leituras da mesma conversa devolviam enderecos
    diferentes para a MESMA mensagem.

    Do lado do app isso nao e detalhe: o `<audio src>` recebia um valor novo,
    e trocar o `src` faz o navegador ABORTAR e recarregar o elemento. O audio
    que a outra pessoa mandou parava no meio, ou nem comecava — e a conversa
    se re-sincroniza a cada evento do WebSocket, a cada volta pro app e a cada
    reconexao. Depois que a reconexao ficou mais agressiva (secao 9.13), isso
    passou a acontecer o tempo todo. Valia igual pras FOTOS, que eram baixadas
    de novo a cada sincronizacao.

    Arredondando o vencimento pra proxima marca de `MEDIA_TOKEN_JANELA_MIN`, o
    payload fica identico entre leituras seguidas — e JWT com a mesma carga e a
    mesma chave da o mesmo texto. A identidade volta a ser estavel; o token
    continua curto (entre 1 e 2 horas de vida) e continua abrindo so midia.
    """
    janela = MEDIA_TOKEN_JANELA_MIN * 60
    vence = utcnow() + timedelta(minutes=minutes)
    # Pra cima, nunca pra baixo: arredondar pra baixo poderia entregar um token
    # ja vencido pra quem pedisse em cima da marca.
    carimbo = int(vence.timestamp())
    carimbo = -(-carimbo // janela) * janela
    payload = {
        "sub": str(user.id),
        "ver": user.token_version,
        "typ": "media",
        "exp": datetime.fromtimestamp(carimbo, tz=timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessao expirada, entre de novo")


def user_from_token(db: Session, token: str | None, expected_type: str = "session") -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Entre de novo")
    payload = _decode(token)

    if payload.get("typ") != expected_type:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalido para esta operacao")

    user = db.get(User, int(payload["sub"]))
    if user is None or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inativo")
    if payload.get("ver") != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessao encerrada, entre de novo")
    return user


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    return user_from_token(db, creds.credentials if creds else None)


def partner_of(db: Session, user: User) -> User | None:
    """O outro. Sao dois usuarios fixos, entao "o outro" e literalmente o que sobra."""
    return db.query(User).filter(User.id != user.id, User.active.is_(True)).first()


# ---------------------------------------------------------------- forca bruta
class LoginThrottle:
    """Trava tentativa de senha por login e por IP.

    Sem isso, um bot testa senha a noite inteira contra um endereco publico.
    Guardado em memoria: reinicio do container zera, o que e aceitavel aqui —
    o objetivo e cortar a enxurrada, nao manter historico forense.
    """

    def __init__(self, limit: int = 8, window_seconds: int = 900, block_seconds: int = 900):
        self.limit = limit
        self.window = window_seconds
        self.block = block_seconds
        self._hits: dict[str, list[float]] = {}
        self._blocked: dict[str, float] = {}

    def _clean(self, key: str, now: float) -> None:
        self._hits[key] = [t for t in self._hits.get(key, []) if now - t < self.window]
        if not self._hits[key]:
            self._hits.pop(key, None)

    def check(self, keys: list[str]) -> None:
        now = time.time()
        for key in keys:
            until = self._blocked.get(key)
            if until and until > now:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    f"Muitas tentativas. Tente de novo em {int((until - now) / 60) + 1} min.",
                )
            if until:
                self._blocked.pop(key, None)

    def fail(self, keys: list[str]) -> None:
        now = time.time()
        for key in keys:
            self._clean(key, now)
            self._hits.setdefault(key, []).append(now)
            if len(self._hits[key]) >= self.limit:
                self._blocked[key] = now + self.block
                self._hits.pop(key, None)

    def reset(self, keys: list[str]) -> None:
        for key in keys:
            self._hits.pop(key, None)
            self._blocked.pop(key, None)


login_throttle = LoginThrottle()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"
