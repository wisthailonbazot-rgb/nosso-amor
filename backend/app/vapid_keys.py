"""Gera o par de chaves do Web Push.

    python -m app.vapid_keys

Roda uma vez. A publica vai pro app (e nao e segredo); a privada vai pra variavel
de ambiente do servidor e nao sai de la. Trocar o par derruba TODAS as assinaturas
existentes — os dois teriam que autorizar a notificacao de novo no aparelho.
"""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def generate() -> tuple[str, str]:
    key = ec.generate_private_key(ec.SECP256R1())
    private_raw = key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return _b64(public_raw), _b64(private_raw)


if __name__ == "__main__":
    public, private = generate()
    print("VAPID_PUBLIC_KEY=" + public)
    print("VAPID_PRIVATE_KEY=" + private)
    print()
    print("Guarde as duas no Coolify. A publica tambem vai pro app, via /api/config.")
