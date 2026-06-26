from flask import Blueprint, jsonify
from pymongo import MongoClient
from datetime import datetime

from config import MONGO_URI, DB_NAME
from utils.permission_utils import role_required

dashboard_routes = Blueprint("dashboard", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]


def agrupar_por_campo(campo):
    pipeline = [
        {
            "$group": {
                "_id": f"${campo}",
                "total": {"$sum": 1}
            }
        },
        {
            "$sort": {"total": -1}
        }
    ]

    resultado = list(db.documents.aggregate(pipeline))

    return [
        {
            "nome": item["_id"] or "Não informado",
            "total": item["total"]
        }
        for item in resultado
    ]


def agrupar_por_mes():
    pipeline = [
        {
            "$group": {
                "_id": {
                    "mes": "$mes",
                    "ano": "$ano"
                },
                "total": {"$sum": 1}
            }
        },
        {
            "$sort": {
                "_id.ano": 1,
                "_id.mes": 1
            }
        }
    ]

    meses_nome = {
        1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr",
        5: "Mai", 6: "Jun", 7: "Jul", 8: "Ago",
        9: "Set", 10: "Out", 11: "Nov", 12: "Dez"
    }

    resultado = list(db.documents.aggregate(pipeline))

    return [
        {
            "nome": f"{meses_nome.get(item['_id']['mes'], item['_id']['mes'])}/{item['_id']['ano']}",
            "total": item["total"]
        }
        for item in resultado
    ]


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

    ultimas_acoes = list(
        db.auditoria
        .find({})
        .sort("data_hora", -1)
        .limit(5)
    )

    for log in ultimas_acoes:
        log["_id"] = str(log["_id"])

    return jsonify({
        "total_documentos": total_documentos,
        "documentos_mes": documentos_mes,
        "confirmados": confirmados,
        "pendentes": pendentes,
        "total_usuarios": total_usuarios,
        "por_secretaria": agrupar_por_campo("departamento"),
        "por_modulo": agrupar_por_campo("modulo"),
        "por_mes": agrupar_por_mes(),
        "ultimas_acoes": ultimas_acoes
    })