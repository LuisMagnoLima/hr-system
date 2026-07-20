import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
load_dotenv(ROOT_DIR / ".env")

ENV = os.getenv("FLASK_ENV", "development").strip().lower()
IS_PRODUCTION = ENV == "production"

SECRET_KEY = os.getenv("SECRET_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "hr_system").strip()


def _env_int(nome, padrao, minimo=1):
    valor = int(os.getenv(nome, str(padrao)))
    if valor < minimo:
        raise RuntimeError(f"{nome} deve ser maior ou igual a {minimo}")
    return valor


MONGO_SERVER_SELECTION_TIMEOUT_MS = _env_int("MONGO_SERVER_SELECTION_TIMEOUT_MS", 5000)
MONGO_CONNECT_TIMEOUT_MS = _env_int("MONGO_CONNECT_TIMEOUT_MS", 5000)
MONGO_SOCKET_TIMEOUT_MS = _env_int("MONGO_SOCKET_TIMEOUT_MS", 20000)
MONGO_MIN_POOL_SIZE = _env_int("MONGO_MIN_POOL_SIZE", 1, 0)
MONGO_MAX_POOL_SIZE = _env_int("MONGO_MAX_POOL_SIZE", 50)
if MONGO_MIN_POOL_SIZE > MONGO_MAX_POOL_SIZE:
    raise RuntimeError("MONGO_MIN_POOL_SIZE não pode ser maior que MONGO_MAX_POOL_SIZE")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY não configurada no arquivo .env")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI não configurada no arquivo .env")
if len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY deve possuir pelo menos 32 caracteres")

_raw_upload = os.getenv("UPLOAD_FOLDER", "uploads").strip()
_upload_path = Path(_raw_upload)
UPLOAD_FOLDER = str(_upload_path if _upload_path.is_absolute() else (BASE_DIR / _upload_path).resolve())

MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", str(100 * 1024 * 1024)))
if MAX_FILE_SIZE <= 0:
    raise RuntimeError("MAX_FILE_SIZE deve ser maior que zero")

ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5500,http://127.0.0.1:5500"
    ).split(",")
    if origin.strip()
]

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true" if IS_PRODUCTION else "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "Lax").capitalize()
if COOKIE_SAMESITE not in {"Lax", "Strict", "None"}:
    raise RuntimeError("COOKIE_SAMESITE deve ser Lax, Strict ou None")
if COOKIE_SAMESITE == "None" and not COOKIE_SECURE:
    raise RuntimeError("COOKIE_SAMESITE=None exige COOKIE_SECURE=true")

COOKIE_NAME = os.getenv("COOKIE_NAME", "hr_session").strip()
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "8"))
ENABLE_SCHEDULER = os.getenv("ENABLE_SCHEDULER", "false").lower() == "true"
