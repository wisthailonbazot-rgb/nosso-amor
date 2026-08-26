from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import media_store, missions, push
from ..clock import utcnow
from ..db import get_db
from ..models import Message, User
from ..realtime import hub, publish
from ..schemas import moment_iso
from ..security import create_media_token, current_user, partner_of

router = APIRouter(prefix="/api/chat", tags=["chat"])

PAGE = 40

# Figurinhas. O código é o que viaja; o desenho mora no app (`render/stickers.js`).
# Ficam listadas aqui pra que o servidor recuse figurinha inventada — senão dava
# pra mandar qualquer texto e o app tentaria desenhar algo que não existe.
STICKERS = [
    "coracao", "beijo", "abraco", "saudade", "carinha_apaixonada", "dormindo",
    "com_fome", "chateado", "risada", "piscada", "flor", "cafe",
    "bolo", "estrela", "chuva", "sol", "gatinho", "presente",
    "quero_voce", "hoje_tem", "vem_ca", "beijo_pescoco", "debaixo_coberta", "fogo",
    "toma_amor", "uau", "grudinho", "menstruacao", "amo_voce", "cafune",
    "amor_seguro", "amor_protegido", "comemoracao", "acabei",
    "sono_a_dois", "mordida", "meu_dia", "foi_mal",
]


class TextIn(BaseModel):
    content: str = Field(default="", max_length=4000)
    sticker: str = Field(default="", max_length=40)
    reply_to: int | None = None


class ReactIn(BaseModel):
    reaction: str = Field(default="", max_length=10)


def _out(row: Message, media_token: str) -> dict:
    def url(name: str) -> str | None:
        return f"/media/{name}?token={media_token}" if name else None

    return {
        "id": row.id,
        "sender_id": row.sender_id,
        "type": row.type,
        "content": row.content,
        "sticker": row.sticker,
        "media": url(row.media_path),
        "thumb": url(row.media_thumb or row.media_path),
        "duration_ms": row.duration_ms,
        "reply_to": row.reply_to,
        "reaction": row.reaction,
        "read": row.read_at is not None,
        "created_at": moment_iso(row.created_at),
    }


def nao_lidas(db: Session, user_id: int) -> int:
    """Quantas mensagens do outro ainda não foram lidas por este usuário."""
    return (
        db.query(Message)
        .filter(Message.sender_id != user_id, Message.read_at.is_(None))
        .count()
    )


def _notify(db: Session, sender: User, preview: str, message_id: int | None = None) -> None:
    partner = partner_of(db, sender)
    if partner is None:
        return
    # Se o outro está com o app aberto, a mensagem já chegou pelo WebSocket —
    # mandar push também faria o celular tocar com a conversa na tela.
    if hub.is_online(partner.id):
        return
    push.send_to_user(
        db,
        partner.id,
        title=sender.name,
        body=preview,
        url="/chat",
        kind="chat",
        # Uma etiqueta SÓ pra conversa inteira — como no WhatsApp.
        #
        # Já foi das duas formas, e as duas estavam erradas: com tag única e
        # sem contagem, a mensagem nova SUBSTITUÍA a anterior e o dono via uma
        # só; com uma tag por mensagem (`chat-123`), a tela de bloqueio virava
        # uma pilha de avisos separados, que foi a reclamação seguinte.
        #
        # A contagem que resolve o meio-termo NÃO vem daqui: quem sabe quantos
        # avisos estão de fato na tela é o aparelho (o servidor não sabe quais
        # a pessoa já dispensou com o dedo). Ela é somada no service worker,
        # em `agrupar()` — ver `web/public/sw.js`.
        tag="chat",
        badge=nao_lidas(db, partner.id),
    )


@router.get("/unread")
def unread_count(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Só o número de mensagens por ler.

    Existe separado de `GET /api/chat` porque o app precisa desse número no
    ARRANQUE, pra pôr a bolinha na aba e o numerinho no ícone — e carregar o
    histórico inteiro (40 mensagens, com token de mídia) só pra contar seria
    caro em toda abertura do app.
    """
    return {"unread": nao_lidas(db, user.id)}


@router.get("")
def history(
    before: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Página de mensagens, da mais nova pra trás.

    `before` = id da mensagem mais antiga que já está na tela. Paginar por id, e
    não por página numerada, evita repetir ou pular mensagem quando chega uma nova
    no meio da rolagem.
    """
    query = db.query(Message)
    if before:
        query = query.filter(Message.id < before)
    rows = query.order_by(Message.id.desc()).limit(PAGE).all()
    rows.reverse()

    token = create_media_token(user)
    unread = (
        db.query(Message)
        .filter(Message.sender_id != user.id, Message.read_at.is_(None))
        .count()
    )
    return {
        "items": [_out(r, token) for r in rows],
        "has_more": len(rows) == PAGE,
        "unread": unread,
        "stickers": STICKERS,
        "media_token": token,
    }


@router.post("")
def send_text(
    payload: TextIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    content = payload.content.strip()
    if payload.sticker:
        if payload.sticker not in STICKERS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Essa figurinha não existe")
        row = Message(sender_id=user.id, type="sticker", sticker=payload.sticker,
                      reply_to=payload.reply_to)
        preview = "mandou uma figurinha"
    else:
        if not content:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mensagem vazia")
        row = Message(sender_id=user.id, type="text", content=content, reply_to=payload.reply_to)
        preview = content[:120]

    db.add(row)
    db.flush()
    missions.record(db, "chat_send")
    _notify(db, user, preview, row.id)
    db.commit()

    token = create_media_token(user)
    publish("chat", {"message": _out(row, token)})
    return _out(row, token)


@router.post("/image")
def send_image(
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    saved = media_store.save_image(file)
    row = Message(
        sender_id=user.id,
        type="image",
        content=caption.strip()[:500],
        media_path=saved["path"],
        media_thumb=saved["thumb"],
    )
    db.add(row)
    db.flush()
    _notify(db, user, "mandou uma foto", row.id)
    db.commit()

    token = create_media_token(user)
    publish("chat", {"message": _out(row, token)})
    return _out(row, token)


@router.post("/audio")
def send_audio(
    file: UploadFile = File(...),
    duration_ms: int = Form(default=0),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    saved = media_store.save_audio(file, duration_ms)
    row = Message(
        sender_id=user.id,
        type="audio",
        media_path=saved["path"],
        duration_ms=saved["duration_ms"],
    )
    db.add(row)
    db.flush()
    _notify(db, user, "mandou um áudio", row.id)
    db.commit()

    token = create_media_token(user)
    publish("chat", {"message": _out(row, token)})
    return _out(row, token)


@router.post("/read")
def mark_read(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Marca como lida toda mensagem do outro. Só o destinatário marca."""
    now = utcnow()
    count = (
        db.query(Message)
        .filter(Message.sender_id != user.id, Message.read_at.is_(None))
        .update({Message.read_at: now})
    )
    db.commit()
    if count:
        # o remetente precisa saber, pra virar o "visto" na tela dele
        partner = partner_of(db, user)
        if partner:
            publish("chat_read", {"by": user.id}, to_user=partner.id)
    return {"ok": True, "marked": count}


@router.post("/{message_id}/react")
def react(
    message_id: int,
    payload: ReactIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(Message, message_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mensagem não encontrada")
    if row.sender_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reagir à própria mensagem não vale")
    row.reaction = payload.reaction[:10]
    db.commit()
    token = create_media_token(user)
    publish("chat_update", {"message": _out(row, token)})
    return _out(row, token)


@router.delete("/{message_id}")
def delete_message(
    message_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    row = db.get(Message, message_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mensagem não encontrada")
    if row.sender_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só dá pra apagar o que você mandou")
    # o arquivo vai junto: mensagem apagada que deixa a foto no disco é vazamento
    media_store.remove(row.media_path, row.media_thumb)
    db.delete(row)
    db.commit()
    publish("chat_delete", {"id": message_id})
    return {"ok": True}


@router.post("/typing")
def typing(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Avisa o outro que está digitando. Não guarda nada — é só um empurrão."""
    partner = partner_of(db, user)
    if partner:
        publish("typing", {"user_id": user.id}, to_user=partner.id)
    return {"ok": True}
