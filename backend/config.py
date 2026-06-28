import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# sobe uma pasta: backend -> raiz do projeto
ROOT_DIR = os.path.dirname(BASE_DIR)

# carrega o .env da raiz
load_dotenv(os.path.join(ROOT_DIR, ".env"))

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 1073741824))