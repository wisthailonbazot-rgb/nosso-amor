"""Guarda arquivo que veio do celular: foto do mural, foto do chat, áudio.

Regras que existem por motivo, não por costume:

  - **O nome do arquivo é inventado aqui, nunca aproveitado do cliente.** Nome
    vindo de fora pode conter `../`, pode ser `.php`, pode colidir com outro. O
    nome gerado é aleatório e a extensão sai do tipo detectado, não do que o
    navegador disse.
  - **O tipo é conferido pelos primeiros bytes**, não pelo `Content-Type`. O
    cabeçalho é escrito pelo cliente e mente de graça.
  - **Foto é reduzida antes de guardar.** Celular manda 4 MB por foto; o app
    mostra num quadrado de 400 px. Guardar o original enche o disco da VPS sem
    ninguém ver diferença.
"""

from __future__ import annotations

import io
import os
import secrets
from datetime import datetime

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from .config import MAX_UPLOAD_MB, STORAGE_DIR

MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024
IMAGE_MAX_SIDE = 1280  # o suficiente pra ver bem em tela de celular
THUMB_MAX_SIDE = 400

# Assinaturas de arquivo (os primeiros bytes). É isto que decide o tipo.
AUDIO_SIGNATURES = {
    b"OggS": "ogg",
    b"\x1aE\xdf\xa3": "webm",  # matroska/webm — o que o Chrome grava
    b"ID3": "mp3",
    b"RIFF": "wav",
}


def _random_name(extension: str) -> str:
    stamp = datetime.now().strftime("%Y%m")
    return f"{stamp}_{secrets.token_urlsafe(12)}.{extension}"


def _read_limited(upload: UploadFile) -> bytes:
    """Lê no máximo o limite + 1 byte: se vier mais, recusa sem carregar tudo."""
    data = upload.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Arquivo grande demais (máximo {MAX_UPLOAD_MB} MB).",
        )
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Arquivo vazio")
    return data


def save_image(upload: UploadFile) -> dict:
    """Guarda uma foto, já reduzida, e devolve o nome dela e o da miniatura."""
    data = _read_limited(upload)
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Isso não é uma imagem válida")

    # Foto de celular vem com orientação nos metadados; sem girar, ela aparece
    # deitada. E converter pra RGB evita quebrar ao salvar PNG com transparência.
    from PIL import ImageOps

    image = ImageOps.exif_transpose(image)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    os.makedirs(STORAGE_DIR, exist_ok=True)
    name = _random_name("jpg")
    thumb_name = f"thumb_{name}"

    full = image.copy()
    full.thumbnail((IMAGE_MAX_SIDE, IMAGE_MAX_SIDE), Image.LANCZOS)
    full.save(os.path.join(STORAGE_DIR, name), "JPEG", quality=86, optimize=True)

    thumb = image.copy()
    thumb.thumbnail((THUMB_MAX_SIDE, THUMB_MAX_SIDE), Image.LANCZOS)
    thumb.save(os.path.join(STORAGE_DIR, thumb_name), "JPEG", quality=80, optimize=True)

    return {"path": name, "thumb": thumb_name, "width": full.width, "height": full.height}


def probe_audio(upload: UploadFile) -> dict:
    """Confere um audio pelo mesmo caminho do envio, mas NAO grava em disco.

    Alimenta o diagnostico do Perfil. A conferencia tem que ser a mesma do
    `save_audio` — um teste que valida diferente do caminho de verdade mente, e
    mentir aqui e pior do que nao ter teste: mandaria procurar o defeito no
    lugar errado.
    """
    data = _read_limited(upload)
    extension = _detect_audio(data)
    if extension is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Formato de áudio não reconhecido (os primeiros bytes não batem com "
            "webm, ogg, mp3, wav nem m4a).",
        )
    return {"tipo": extension, "bytes": len(data)}


def _detect_audio(data: bytes) -> str | None:
    """O tipo pelos primeiros bytes. Uma fonte so, usada pelos dois caminhos."""
    for signature, ext in AUDIO_SIGNATURES.items():
        if data.startswith(signature):
            return ext
    # o MediaRecorder do Safari grava MP4/AAC, que comeca com "....ftyp"
    if len(data) > 12 and data[4:8] == b"ftyp":
        return "m4a"
    return None


def save_audio(upload: UploadFile, duration_ms: int = 0) -> dict:
    """Guarda um áudio de recado, conferindo o tipo pelos primeiros bytes."""
    data = _read_limited(upload)

    extension = _detect_audio(data)
    if extension is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Formato de áudio não reconhecido"
        )

    os.makedirs(STORAGE_DIR, exist_ok=True)
    name = _random_name(extension)
    with open(os.path.join(STORAGE_DIR, name), "wb") as handle:
        handle.write(data)
    return {"path": name, "duration_ms": max(0, int(duration_ms)), "bytes": len(data)}


def remove(*names: str) -> None:
    """Apaga arquivo da pasta de mídia, ignorando o que não existe mais."""
    for name in names:
        if not name:
            continue
        candidate = os.path.normpath(os.path.join(STORAGE_DIR, name))
        if candidate.startswith(STORAGE_DIR) and os.path.isfile(candidate):
            try:
                os.remove(candidate)
            except OSError:
                pass
