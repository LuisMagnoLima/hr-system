import os

# 📍 caminho base do projeto
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 🔐 pega variáveis de ambiente (se não existir, usa padrão)
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")

# 🌐 conexão com Mongo (local ou servidor)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

# 🗄️ nome do banco
DB_NAME = os.getenv("DB_NAME", "hr-system")

# 📂 pasta de uploads
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

# 📦 tamanho máximo (5MB)
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 5 * 1024 * 1024))