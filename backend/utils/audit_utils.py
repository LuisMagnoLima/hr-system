from datetime import datetime
import logging
from database import get_database

import pytz
from flask import has_request_context, request


logger = logging.getLogger(__name__)
db = get_database()


def registrar_auditoria(acao, usuario=None, detalhes=None, status="sucesso"):
    tz = pytz.timezone("America/Fortaleza")
    now = datetime.now(tz)
    ip = None
    user_agent = None

    if has_request_context():
        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        if ip and "," in ip:
            ip = ip.split(",")[0].strip()
        user_agent = request.headers.get("User-Agent")

    log = {
        "acao": str(acao),
        "usuario": usuario or "sistema",
        "status": status,
        "detalhes": detalhes or {},
        "ip": ip,
        "user_agent": user_agent,
        "data_hora": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M"),
    }
    try:
        db.auditoria.insert_one(log)
    except Exception as exc:
        logger.warning("Falha ao registrar auditoria: %s", exc)
