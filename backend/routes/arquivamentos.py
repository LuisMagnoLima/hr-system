import os
import shutil
from datetime import datetime
from database import get_database

import pytz
from bson import ObjectId
from flask import Blueprint, jsonify, current_app, request

from utils.permission_utils import permission_required, role_required
from utils.audit_utils import registrar_auditoria
from utils.cleanup_utils import adicionar_meses, excluir_arquivamento_definitivamente

arquivamentos_routes = Blueprint("arquivamentos", __name__)

db = get_database()


def agora_fortaleza():
    tz = pytz.timezone("America/Fortaleza")
    return datetime.now(tz)


@arquivamentos_routes.route("/arquivamentos", methods=["GET"])
@permission_required("banco_dados")
def listar_arquivamentos():
    docs = list(db.arquivamentos.find().sort("data_arquivamento", -1))

    now = agora_fortaleza()
    for d in docs:
        if not d.get("data_exclusao_definitiva") and d.get("data_arquivamento"):
            d["data_exclusao_definitiva"] = adicionar_meses(d["data_arquivamento"], 6)
        expira = d.get("data_exclusao_definitiva")
        d["segundos_restantes"] = max(0, int((expira - now).total_seconds())) if expira else None
        d["_id"] = str(d["_id"])

    return jsonify(docs), 200


@arquivamentos_routes.route("/arquivamentos/<id>/restaurar", methods=["POST"])
@permission_required("banco_dados")
def restaurar_arquivamento(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400

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
    arquivado.pop("data_exclusao_definitiva", None)
    arquivado.pop("motivo_arquivamento", None)
    arquivado.pop("arquivado_por", None)

    arquivado["status"] = "aprovado" if arquivado.get("confirmado_financeiro") else "em_elaboracao"
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
        request.current_user["email"],
        {
            "nome": arquivado.get("nome"),
            "arquivo": arquivado.get("arquivo"),
            "departamento": arquivado.get("departamento"),
            "modulo": arquivado.get("modulo")
        }
    )

    return jsonify({"msg": "Documento restaurado com sucesso"}), 200


@arquivamentos_routes.route("/arquivamentos/<id>", methods=["DELETE"])
@role_required("admin")
def excluir_arquivamento(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400

    arquivado = db.arquivamentos.find_one({"_id": ObjectId(id)})
    if not arquivado:
        return jsonify({"error": "Arquivamento não encontrado"}), 404

    try:
        excluir_arquivamento_definitivamente(
            arquivado,
            request.current_user["email"],
        )
    except OSError:
        return jsonify({"error": "Não foi possível apagar o arquivo físico"}), 500

    return jsonify({"msg": "Documento excluído definitivamente"}), 200
