"""Notificacao por Web Push (VAPID).

Por que Web Push e nao push nativo: o iPhone dela entra pelo Safari, com o app
adicionado a Tela de Inicio. Desde o iOS 16.4 esse caminho recebe push de verdade,
pelo APNs, sem conta de desenvolvedor Apple, sem AltStore e sem PC ligado. O mesmo
codigo atende o Chrome no Android.

Duas armadilhas do iOS que estao tratadas aqui:

  1. O `aud` do JWT do VAPID tem que ser a ORIGEM do endpoint (https://web.push.apple.com),
     nao a URL inteira. A pywebpush ja faz isso; o que a gente precisa garantir e o
     `sub`, que a Apple exige e recusa se nao for um mailto:/https: real.
  2. Assinatura morta responde 404/410. Se a gente nao apagar, o registro fica pra
     sempre e todo envio futuro perde tempo com ele. Aqui ela e removida na hora.
"""

from __future__ import annotations

import json
import logging
import secrets

from pywebpush import WebPushException, webpush
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .clock import utcnow
from .config import (
    PUSH_ENABLED,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
)
from .models import Notification, PushSubscription

log = logging.getLogger("push")

# Depois de tantas falhas seguidas que nao sao 404/410 (rede, 5xx do provedor),
# a assinatura e considerada perdida. Evita ficar batendo em endpoint zumbi.
MAX_FAILURES = 10


def _send_one(sub: PushSubscription, payload: dict, ttl: int = 43200) -> tuple[bool, bool]:
    """Devolve (entregue, deve_apagar)."""
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=ttl,
        )
        return True, False
    except WebPushException as exc:
        code = getattr(exc.response, "status_code", None)
        if code in (404, 410):
            # o aparelho desinstalou o app ou revogou a permissao
            return False, True
        log.warning("push falhou (%s): %s", code, exc)
        return False, False
    except Exception as exc:  # rede caiu, DNS, etc
        log.warning("push falhou (excecao): %s", exc)
        return False, False


def send_to_user(
    db: Session,
    user_id: int,
    title: str,
    body: str = "",
    url: str = "/",
    kind: str = "geral",
    dedupe_key: str | None = None,
    tag: str | None = None,
    extra: dict | None = None,
) -> dict:
    """Notifica um usuario em todos os aparelhos dele.

    Grava tambem em `notifications`, entao a tela de avisos mostra o que foi
    mandado mesmo quando o push nao chegou (aparelho desligado, permissao negada).
    `dedupe_key` impede o mesmo aviso duas vezes — e o indice unico do banco que
    garante, nao um `if` que perde a corrida.
    """
    record = Notification(
        user_id=user_id, kind=kind, title=title, body=body, url=url, dedupe_key=dedupe_key
    )
    # Ponto de salvamento: aviso repetido nao pode derrubar o que a rota ja gravou.
    # Este `send_to_user` e chamado NO MEIO de operacoes (concluir tarefa, comprar),
    # e um rollback completo aqui desfazia a operacao toda em silencio — com a rota
    # ainda respondendo sucesso.
    try:
        with db.begin_nested():
            db.add(record)
            db.flush()
    except IntegrityError:
        return {"sent": 0, "skipped": "duplicado"}

    if not PUSH_ENABLED:
        return {"sent": 0, "skipped": "push desligado (sem chaves VAPID)"}

    # Bilhete de volta.
    #
    # Do lado do servidor a gente so sabe que a Apple ACEITOU a mensagem — e ela
    # aceita mesmo quando o aviso nunca aparece na tela. Este numero aleatorio vai
    # junto, e o service worker devolve ele em `/api/push/ack` dizendo se
    # conseguiu mostrar. Sem isso, "o servidor mandou e nada chegou" fica sendo
    # chute entre tres suspeitos: envio, aparelho e service worker.
    ack = secrets.token_urlsafe(9)
    payload = {
        "title": title,
        "body": body,
        "url": url,
        "kind": kind,
        "tag": tag or kind,
        "ack": ack,
        **(extra or {}),
    }
    log.info("push saindo user=%s kind=%s ack=%s", user_id, kind, ack)

    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    if not subs:
        log.warning("push sem aparelho registrado (user=%s ack=%s)", user_id, ack)
    sent = 0
    for sub in subs:
        ok, drop = _send_one(sub, payload)
        log.info(
            "push -> %s aceito=%s apagar=%s ack=%s",
            sub.endpoint.split("/")[2] if "/" in sub.endpoint else "?",
            ok,
            drop,
            ack,
        )
        if ok:
            sub.failures = 0
            sub.last_ok_at = utcnow()
            sent += 1
        elif drop:
            db.delete(sub)
        else:
            sub.failures += 1
            if sub.failures >= MAX_FAILURES:
                db.delete(sub)
    db.flush()
    return {"sent": sent, "devices": len(subs)}
