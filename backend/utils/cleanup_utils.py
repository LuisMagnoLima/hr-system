import os
from datetime import datetime, timedelta
from pymongo import MongoClient
import pytz
from config import MONGO_URI, DB_NAME, UPLOAD_FOLDER

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
#limpa arquivos antigos a cada 10 minutos (para mudar para 3 meses é so colocar days=90)
def limpar_arquivos_antigos():
    tz = pytz.timezone("America/Fortaleza")
    limite = datetime.now(tz) - timedelta(days=1.826)

    docs_antigos = list(db.documents.find({
    "data_envio": {"$lt": limite},
    "protegido_exclusao": {"$ne": True}
    }))

    removidos = 0

    for doc in docs_antigos:
        nome_arquivo = doc.get("arquivo")

        if nome_arquivo:
            caminho_arquivo = os.path.join(UPLOAD_FOLDER, nome_arquivo)

            if os.path.exists(caminho_arquivo):
                try:
                    os.remove(caminho_arquivo)
                except Exception as e:
                    print(f"Erro ao remover arquivo {nome_arquivo}: {e}")
                    continue

        db.documents.delete_one({"_id": doc["_id"]})
        removidos += 1

    print(f"✅ Limpeza concluída. {removidos} arquivo(s) removido(s).")