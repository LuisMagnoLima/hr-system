from datetime import datetime
from flask import request
from pymongo import MongoClient
import pytz

from config import MONGO_URI, DB_NAME

client = MongoClient(MONGO_URI)
db = client[DB_NAME]


def registrar_auditoria(acao, usuario=None, detalhes=None, status="sucesso"):
    tz = pytz.timezone("America/Fortaleza")
    now = datetime.now(tz)

    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if ip and "," in ip:
        ip = ip.split(",")[0].strip()

    log = {
        "acao": acao,
        "usuario": usuario or "desconhecido",
        "status": status,
        "detalhes": detalhes or {},
        "ip": ip,
        "user_agent": request.headers.get("User-Agent"),
        "data_hora": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M")
    }

    db.auditoria.insert_one(log)