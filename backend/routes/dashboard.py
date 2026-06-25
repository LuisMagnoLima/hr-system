from flask import Blueprint, jsonify
from pymongo import MongoClient
from datetime import datetime

from config import MONGO_URI, DB_NAME
from utils.permission_utils import role_required

dashboard_routes = Blueprint("dashboard", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]


@dashboard_routes.route("/dashboard", methods=["GET"])
@role_required("admin")
def dashboard():

    agora = datetime.now()

    total_documentos = db.documents.count_documents({})

    documentos_mes = db.documents.count_documents({
        "mes": agora.month,
        "ano": agora.year
    })

    confirmados = db.documents.count_documents({
        "confirmado_financeiro": True
    })

    pendentes = db.documents.count_documents({
        "$or": [
            {"confirmado_financeiro": False},
            {"confirmado_financeiro": {"$exists": False}}
        ]
    })

    total_usuarios = db.users.count_documents({})

    return jsonify({
        "total_documentos": total_documentos,
        "documentos_mes": documentos_mes,
        "confirmados": confirmados,
        "pendentes": pendentes,
        "total_usuarios": total_usuarios
    })