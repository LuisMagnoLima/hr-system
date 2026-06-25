from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from config import MONGO_URI, DB_NAME
from utils.permission_utils import role_required
auditoria_routes = Blueprint("auditoria", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

@auditoria_routes.route("/auditoria", methods=["GET"])
@role_required("admin")
def listar_auditoria():
    usuario = request.args.get("usuario")
    acao = request.args.get("acao")

    filtro = {}

    if usuario:
        filtro["usuario"] = usuario

    if acao:
        filtro["acao"] = acao

    logs = list(
        db.auditoria
        .find(filtro)
        .sort("data_hora", -1)
        .limit(300)
    )

    for log in logs:
        log["_id"] = str(log["_id"])

    return jsonify(logs), 300