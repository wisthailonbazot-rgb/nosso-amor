"""Sobe a API local com SQLite e os dois usuarios de teste.

    python dev_server.py     ->  http://localhost:8020

Serve tambem o app buildado (backend/app/static), igual ao que roda na VPS.
As chaves VAPID de desenvolvimento sao fixas de proposito: assim a assinatura de
push do navegador sobrevive entre reinicios enquanto voce testa.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # roda de qualquer pasta

os.environ.setdefault("DATABASE_URL", f"sqlite:///{os.path.join(HERE, 'casal_local.db')}")
os.environ.setdefault("JWT_SECRET", "dev-secret-local-nao-vai-pra-producao")
os.environ.setdefault("STORAGE_DIR", os.path.join(HERE, "media"))
os.environ.setdefault("USER_A_SLUG", "ele")
os.environ.setdefault("USER_A_NAME", "Ele")
os.environ.setdefault("USER_A_PASSWORD", "senha123")
os.environ.setdefault("USER_B_SLUG", "ela")
os.environ.setdefault("USER_B_NAME", "Ela")
os.environ.setdefault("USER_B_PASSWORD", "senha123")
os.environ.setdefault("CYCLE_OWNER_SLUG", "ela")
os.environ.setdefault("COUPLE_START_DATE", "2025-02-14")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost")
os.environ.setdefault("VAPID_PUBLIC_KEY", "BC-x5D2hkOPf6CYXbh2jci3gUmgxCQZFivBGr3syI4Gl99Cb71iMiMrrgDjvP4SSerPh_c_wr94fP0bn9hv1XF0")
os.environ.setdefault("VAPID_PRIVATE_KEY", "6n2vpHX47v90DXB-9Lmc68Bg7LgmJ6OrJ_-0lFGAPyI")

import uvicorn  # noqa: E402

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8020"))
    # Rede local de propósito: permite validar o APK no Android e abrir no iPhone
    # enquanto ainda não existe a URL HTTPS da VPS.
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
