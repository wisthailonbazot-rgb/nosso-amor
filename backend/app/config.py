import os
import sys

# Postgres na VPS (Coolify injeta DATABASE_URL). SQLite so pra rodar local sem banco.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./casal_local.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

IS_PRODUCTION = not DATABASE_URL.startswith("sqlite")

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
TOKEN_DAYS = int(os.getenv("TOKEN_DAYS", "180"))  # app de casal: ninguem quer relogar

if not JWT_SECRET:
    if IS_PRODUCTION:
        # sem segredo, qualquer um forja um token: melhor nao subir
        sys.exit("JWT_SECRET nao definido — recusando iniciar em producao.")
    JWT_SECRET = "dev-only-nao-use-em-producao"
elif IS_PRODUCTION and len(JWT_SECRET) < 32:
    sys.exit("JWT_SECRET curto demais (minimo 32 caracteres).")

# Os dois usuarios fixos. Criados no primeiro boot; depois disso estas variaveis
# so servem pra recriar quem for apagado — senha existente nunca e sobrescrita.
USER_A_SLUG = os.getenv("USER_A_SLUG", "").strip().lower()
USER_A_NAME = os.getenv("USER_A_NAME", "").strip()
USER_A_PASSWORD = os.getenv("USER_A_PASSWORD", "")
USER_B_SLUG = os.getenv("USER_B_SLUG", "").strip().lower()
USER_B_NAME = os.getenv("USER_B_NAME", "").strip()
USER_B_PASSWORD = os.getenv("USER_B_PASSWORD", "")
# Quem registra ciclo. Vale o slug; vazio = ninguem (o modulo fica escondido).
CYCLE_OWNER_SLUG = os.getenv("CYCLE_OWNER_SLUG", "").strip().lower()

# Data em que o casal comecou a namorar, formato YYYY-MM-DD. Alimenta o contador
# de dias juntos. Editavel depois pela tela de perfil (fica no banco).
COUPLE_START_DATE = os.getenv("COUPLE_START_DATE", "").strip()

# Fotos do mural e do chat. Volume de disco no Coolify — nao e efemero.
STORAGE_DIR = os.getenv("STORAGE_DIR", os.path.join(os.path.dirname(__file__), "..", "media"))
STORAGE_DIR = os.path.abspath(STORAGE_DIR)
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "12"))

# Web Push (VAPID). Gere o par uma vez com: python -m app.vapid_keys
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
# O iOS exige um "mailto:" real aqui, senao a Apple recusa a entrega.
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:wisthailonbazot@gmail.com").strip()
PUSH_ENABLED = bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)

# Origens do app. O APK do Capacitor roda em http/https://localhost; o navegador
# usa o proprio endereco do servidor. Nada de "*" com credenciais.
DEFAULT_ORIGINS = [
    "http://localhost",
    "https://localhost",
    "http://localhost:5173",
    "capacitor://localhost",
    "ionic://localhost",
]
_extra = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
CORS_ORIGINS = DEFAULT_ORIGINS + [o for o in _extra if o != "*"]

# Documentacao interativa da API: util em desenvolvimento, desnecessaria em producao.
EXPOSE_DOCS = os.getenv("EXPOSE_DOCS", "0") == "1" or not IS_PRODUCTION

TZ_OFFSET_HOURS = -3  # America/Sao_Paulo
