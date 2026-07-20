import os
import shutil
from datetime import datetime
from database import get_database

import pytz
from bson import ObjectId
from flask import Blueprint, jsonify, current_app

from utils.permission_utils import permission_required
from utils.audit_utils import registrar_auditoria

arquivamentos_routes = Blueprint("arquivamentos", __name__)

db = get_database()


def agora_fortaleza():
    tz = pytz.timezone("America/Fortaleza")
    return datetime.now(tz)


@arquivamentos_routes.route("/arquivamentos", methods=["GET"])
@permission_required("banco_dados")
def listar_arquivamentos():
    docs = list(db.arquivamentos.find())

    for d in docs:
        d["_id"] = str(d["_id"])

    return jsonify(docs), 200


@arquivamentos_routes.route("/arquivamentos/<id>/restaurar", methods=["POST"])
@permission_required("banco_dados")
def restaurar_arquivamento(id):
    arquivado = db.arquivamentos.find_one({"_id": ObjectId(id)})

    if not arquivado:
        return jsonify({"error": "Arquivamento não encontrado"}), 404

    now = agora_fortaleza()

    arquivo = arquivado.get("arquivo")

    if arquivo and arquivo.startswith("arquivados/"):
        nome_arquivo = os.path.basename(arquivo)

        origem = os.path.join(current_app.config["UPLOAD_FOLDER"], arquivo)
        destino_relativo = os.path.join(
            arquivado.get("departamento", "GERAL"),
            str(now.year),
            str(now.month).zfill(2),
            nome_arquivo
        ).replace("\\", "/")

        destino = os.path.join(current_app.config["UPLOAD_FOLDER"], destino_relativo)
        os.makedirs(os.path.dirname(destino), exist_ok=True)

        if os.path.exists(origem):
            shutil.move(origem, destino)
            arquivado["arquivo"] = destino_relativo

    arquivado.pop("_id", None)
    arquivado.pop("data_arquivamento", None)
    arquivado.pop("documento_original_id", None)

    arquivado["status_arquivo"] = "ativo"
    arquivado["data_envio"] = now
    arquivado["dia"] = now.day
    arquivado["mes"] = now.month
    arquivado["ano"] = now.year
    arquivado["hora"] = now.strftime("%H:%M")

    db.documents.insert_one(arquivado)
    db.arquivamentos.delete_one({"_id": ObjectId(id)})

    registrar_auditoria(
        "restaurar_arquivamento",
        "admin",
        {
            "nome": arquivado.get("nome"),
            "arquivo": arquivado.get("arquivo"),
            "departamento": arquivado.get("departamento"),
            "modulo": arquivado.get("modulo")
        }
    )

    return jsonify({"msg": "Documento restaurado com sucesso"}), 200
