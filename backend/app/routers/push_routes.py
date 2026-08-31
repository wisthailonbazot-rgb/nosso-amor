import logging

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import push
from ..clock import utcnow
from ..config import PUSH_ENABLED, VAPID_PUBLIC_KEY
from ..db import get_db
from ..models import Notification, PushSubscription, User
from ..schemas import PushSubscribeIn, moment_iso
from ..security import current_user

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/status")
def status(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Alimenta a tela de diagnostico do app.

    Existe porque push no iPhone falha de formas silenciosas (app aberto no Safari
    em vez da Tela de Inicio, permissao negada, iOS antigo). A tela mostra em texto
    o que o servidor enxerga daquele aparelho, em vez de deixar voces adivinhando.
    """
    devices = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user.id)
        .order_by(PushSubscription.created_at.desc())
        .all()
    )
    return {
        "push_enabled": PUSH_ENABLED,
        "vapid_public_key": VAPID_PUBLIC_KEY,
        "devices": [
            {
                "id": d.id,
                "label": d.label or "aparelho",
                "user_agent": d.user_agent[:120],
                "failures": d.failures,
                "last_ok_at": moment_iso(d.last_ok_at),
                "created_at": moment_iso(d.created_at),
            }
            for d in devices
        ],
    }


@router.post("/subscribe")
def subscribe(
    payload: PushSubscribeIn,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    agent = request.headers.get("user-agent", "")[:300]
    existing = (
        db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint).first()
    )
    if existing is None:
        existing = PushSubscription(endpoint=payload.endpoint)
        db.add(existing)
    # o mesmo endpoint pode trocar de dono se o outro entrar no mesmo aparelho
    existing.user_id = user.id
    existing.p256dh = payload.p256dh
    existing.auth = payload.auth
    existing.user_agent = agent
    existing.label = payload.label or _guess_label(agent)
    existing.failures = 0
    existing.last_ok_at = utcnow()
    db.commit()
    return {"ok": True, "id": existing.id, "push_enabled": PUSH_ENABLED}


class ResubscribeIn(BaseModel):
    old_endpoint: str = Field(default="", max_length=900)
    endpoint: str = Field(min_length=10, max_length=900)
    p256dh: str = Field(min_length=10, max_length=300)
    auth: str = Field(min_length=4, max_length=300)


@router.post("/resubscribe")
def resubscribe(payload: ResubscribeIn, db: Session = Depends(get_db)) -> dict:
    """O aparelho trocou de endereco de push sozinho, e esta avisando.

    **Sem token de sessao, e nao da pra ser diferente.** Quem chama e o
    `pushsubscriptionchange` do service worker, que roda com o app FECHADO — nao
    ha pagina, nao ha `localStorage` e portanto nao ha token na mao. Se esta
    rota exigisse login, ela nunca poderia ser chamada, que e exatamente a
    situacao que ela existe pra consertar.

    Quem prova a identidade e o `old_endpoint`: e uma URL longa e aleatoria que
    o servico de push (Apple/Google) gerou pra AQUELE aparelho, e so aquele
    aparelho a conhece. Apresentar o endereco antigo registrado e a prova de que
    quem esta falando e o dono dele. Sem `old_endpoint` conhecido nao ha o que
    fazer, e a rota recusa em vez de adivinhar um dono — adivinhar mandaria os
    avisos do casal pro aparelho errado.

    O dono nao muda aqui; so o endereco. E propositalmente idempotente: chamar
    duas vezes com o mesmo par nao cria uma segunda linha.
    """
    velho = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == payload.old_endpoint)
        .first()
        if payload.old_endpoint
        else None
    )
    if velho is None:
        logging.getLogger("push").warning(
            "resubscribe sem endereco antigo conhecido — recusado"
        )
        return {"ok": False, "reason": "aparelho desconhecido"}

    ja = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == payload.endpoint)
        .first()
    )
    if ja is not None and ja.id != velho.id:
        # O endereco novo ja existia (a tela reassinou antes do service worker
        # avisar). Fica com essa linha e apaga a velha, senao o mesmo aparelho
        # apareceria duas vezes e todo aviso sairia em dose dupla.
        ja.user_id = velho.user_id
        ja.p256dh = payload.p256dh
        ja.auth = payload.auth
        ja.failures = 0
        db.delete(velho)
        db.commit()
        return {"ok": True, "id": ja.id}

    velho.endpoint = payload.endpoint
    velho.p256dh = payload.p256dh
    velho.auth = payload.auth
    velho.failures = 0
    velho.last_ok_at = utcnow()
    db.commit()
    logging.getLogger("push").warning("resubscribe ok user=%s", velho.user_id)
    return {"ok": True, "id": velho.id}


@router.post("/unsubscribe")
def unsubscribe(
    payload: dict, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    endpoint = (payload or {}).get("endpoint", "")
    removed = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == endpoint, PushSubscription.user_id == user.id)
        .delete()
    )
    db.commit()
    return {"ok": True, "removed": removed}


@router.post("/test")
def test_push(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    result = push.send_to_user(
        db,
        user.id,
        title="Testando 1, 2, 3",
        body="Se voce esta lendo isso, a notificacao funciona neste aparelho.",
        url="/perfil",
        kind="teste",
    )
    db.commit()
    return result


class AckIn(BaseModel):
    ack: str = Field(default="", max_length=40)
    ok: bool = True
    erro: str = Field(default="", max_length=200)
    modo: str = Field(default="", max_length=40)


@router.post("/ack")
def ack_push(payload: AckIn) -> dict:
    """O service worker conta o que aconteceu com o push que chegou.

    **Sem autenticacao de proposito.** Quem chama e o service worker, que roda
    fora da pagina e nao tem o token da sessao na mao. O que ele manda de volta
    e so o numero aleatorio que veio no proprio push — nao da pra descobrir nada
    com ele, nao identifica ninguem e nao muda nada no banco. E um bilhete de
    diagnostico, e o unico efeito e uma linha no log.

    Existe porque o servidor sozinho nao consegue distinguir tres coisas muito
    diferentes que parecem iguais: a Apple recusou, a Apple aceitou mas o
    aparelho nao acordou, ou o aparelho acordou e nao conseguiu mostrar o aviso.
    """
    logging.getLogger("push").warning(
        "push ACK ack=%s mostrou=%s modo=%s erro=%s",
        payload.ack or "?",
        payload.ok,
        payload.modo or "-",
        payload.erro or "-",
    )
    # E tambem guardado, pra tela de Perfil poder ESPERAR por ele. Antes ia so
    # pro log, e log ninguem le do celular — o app continuava sem conseguir
    # dizer se o aviso chegou a aparecer.
    push.anotar_ack(payload.ack, payload.ok, payload.modo, payload.erro)
    return {"ok": True}


@router.get("/ack/{ack}")
def ver_ack(ack: str, user: User = Depends(current_user)) -> dict:
    """O que se sabe de um envio: o servico aceitou? o aparelho mostrou?

    A tela de Perfil chama isto por alguns segundos depois do teste. E a unica
    forma de separar tres falhas que parecem iguais de fora — o servidor nao
    mandou, o servico de push recusou, ou o aparelho recebeu e nao mostrou.
    """
    registro = push.ver_ack(ack, user.id)
    if registro is None:
        return {"conhecido": False}
    return {"conhecido": True, **registro}


def _guess_label(agent: str) -> str:
    lowered = agent.lower()
    if "iphone" in lowered:
        return "iPhone"
    if "ipad" in lowered:
        return "iPad"
    if "android" in lowered:
        return "Android"
    if "windows" in lowered:
        return "PC"
    return "aparelho"


# ------------------------------------------------------------------ avisos
avisos = APIRouter(prefix="/api/notifications", tags=["push"])


@avisos.get("")
def list_notifications(
    user: User = Depends(current_user), db: Session = Depends(get_db), limit: int = 40
) -> dict:
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .count()
    )
    return {
        "unread": unread,
        "items": [
            {
                "id": n.id,
                "kind": n.kind,
                "title": n.title,
                "body": n.body,
                "url": n.url,
                "read": n.read_at is not None,
                "created_at": moment_iso(n.created_at),
            }
            for n in rows
        ],
    }


@avisos.post("/read")
def mark_read(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    now = utcnow()
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .update({Notification.read_at: now})
    )
    db.commit()
    return {"ok": True, "marked": count}
