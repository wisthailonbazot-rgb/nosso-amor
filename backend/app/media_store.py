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
import json
import os
import secrets
import shutil
import subprocess
from datetime import datetime

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from .config import (
    MAX_UPLOAD_MB,
    MAX_VIDEO_SECONDS,
    MAX_VIDEO_UPLOAD_MB,
    STORAGE_DIR,
)

MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_VIDEO_BYTES = MAX_VIDEO_UPLOAD_MB * 1024 * 1024
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


def _copy_video_limited(upload: UploadFile, destination: str) -> tuple[bytes, int]:
    """Copia vídeo em blocos; um upload de 80 MB não vira 80 MB de RAM."""
    total = 0
    first = b""
    try:
        with open(destination, "wb") as handle:
            while True:
                chunk = upload.file.read(1024 * 1024)
                if not chunk:
                    break
                if not first:
                    first = chunk[:64]
                total += len(chunk)
                if total > MAX_VIDEO_BYTES:
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"Vídeo grande demais (máximo {MAX_VIDEO_UPLOAD_MB} MB).",
                    )
                handle.write(chunk)
    except Exception:
        try:
            os.remove(destination)
        except OSError:
            pass
        raise
    if not total:
        try:
            os.remove(destination)
        except OSError:
            pass
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Arquivo vazio")
    return first, total


def _detect_video(data: bytes) -> str | None:
    if data.startswith(b"\x1aE\xdf\xa3"):
        return "webm"
    if data.startswith(b"OggS"):
        return "ogv"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return "mov"
    return None


def _video_command(command: list[str], timeout: int) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "O vídeo demorou demais para preparar. Envie um trecho menor.",
        ) from exc


def _probe_video(path: str) -> dict:
    probe = shutil.which("ffprobe")
    if not probe:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Conversor de vídeo indisponível")
    result = _video_command(
        [
            probe, "-v", "error", "-show_entries", "format=duration:stream=codec_type",
            "-of", "json", path,
        ],
        25,
    )
    if result.returncode:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Isso não é um vídeo válido")
    try:
        info = json.loads(result.stdout)
        duration = float(info.get("format", {}).get("duration") or 0)
        has_video = any(stream.get("codec_type") == "video" for stream in info.get("streams", []))
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não consegui ler esse vídeo") from exc
    if not has_video or duration <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "O arquivo não contém vídeo")
    if duration > MAX_VIDEO_SECONDS + 0.05:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"O vídeo pode ter no máximo {MAX_VIDEO_SECONDS} segundos.",
        )
    return {"duration": duration}


def save_video(upload: UploadFile) -> dict:
    """Normaliza vídeo de iPhone/Android para MP4 H.264/AAC reproduzível nos dois.

    Guardar o MOV original repetiria o defeito antigo do áudio: o envio funciona,
    mas o aparelho do outro não conhece o codec escolhido pela câmera. A saída é
    sempre H.264 Main, 720p, 30 fps, áudio AAC e índice no começo do arquivo.
    """
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Conversor de vídeo indisponível")

    os.makedirs(STORAGE_DIR, exist_ok=True)
    token = secrets.token_urlsafe(12)
    source = os.path.join(STORAGE_DIR, f".{token}.upload")
    name = _random_name("mp4")
    thumb_name = f"thumb_{os.path.splitext(name)[0]}.jpg"
    output = os.path.join(STORAGE_DIR, name)
    thumb = os.path.join(STORAGE_DIR, thumb_name)

    try:
        header, input_bytes = _copy_video_limited(upload, source)
        if _detect_video(header) is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Formato de vídeo não reconhecido")
        info = _probe_video(source)

        result = _video_command(
            [
                ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                "-i", source,
                "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1",
                "-vf", (
                    "fps=30,scale=w='min(1280,iw)':h='min(1280,ih)':"
                    "force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p"
                ),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
                "-profile:v", "main", "-level", "3.1",
                "-c:a", "aac", "-b:a", "96k", "-ac", "2",
                "-movflags", "+faststart", output,
            ],
            180,
        )
        if result.returncode or not os.path.isfile(output) or os.path.getsize(output) == 0:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Não consegui preparar esse vídeo. Tente gravar um trecho novo.",
            )

        cover = _video_command(
            [
                ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                "-ss", "0.05", "-i", output, "-frames:v", "1",
                "-vf", "scale=640:640:force_original_aspect_ratio=decrease", thumb,
            ],
            35,
        )
        if cover.returncode or not os.path.isfile(thumb):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Não consegui criar a capa do vídeo")

        return {
            "path": name,
            "thumb": thumb_name,
            "duration_ms": max(1, round(info["duration"] * 1000)),
            "bytes": os.path.getsize(output),
            "input_bytes": input_bytes,
        }
    except Exception:
        for candidate in (output, thumb):
            try:
                os.remove(candidate)
            except OSError:
                pass
        raise
    finally:
        try:
            os.remove(source)
        except OSError:
            pass


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
