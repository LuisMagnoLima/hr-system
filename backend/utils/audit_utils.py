from datetime import datetime
from pymongo import MongoClient
from flask import request
import pytz

from config import MONGO_URI, DB_NAME

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def registrar_auditoria(acao, usuario=None, detalhes=None):
    tz = pytz.timezone("America/Fortaleza")
    now = datetime.now(tz)

    registro = {
        "acao": acao,
        "usuario": usuario or "anonimo",
        "detalhes": detalhes or {},
        "ip": request.headers.get("X-Forwarded-For", request.remote_addr),
        "user_agent": request.headers.get("User-Agent"),
        "data_hora": now,
        "hora": now.strftime("%H:%M:%S"),
        "dia": now.day,
        "mes": now.month,
        "ano": now.year
    }

    db.auditoria.insert_one(registro)