from datetime import datetime

import pytz
from bson import ObjectId
from flask import Blueprint, request, jsonify, current_app
from pymongo import MongoClient

from config import MONGO_URI, DB_NAME
from utils.file_utils import save_file
from utils.audit_utils import registrar_auditoria
from utils.permission_utils import login_required, role_required

solicitacoes_routes = Blueprint("solicitacoes", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]


def agora_fortaleza():
    tz = pytz.timezone("America/Fortaleza")
    return datetime.now(tz)


@solicitacoes_routes.route("/usuarios-por-permissao", methods=["GET"])
@role_required("solicitante")
def usuarios_por_permissao():
    modulo = request.args.get("modulo")

    if not modulo:
        return jsonify({"error": "Módulo é obrigatório"}), 400

    users = list(db.users.find(
        {
            "permissions": modulo,
            "role": {"$ne": "solicitante"}
        },
        {"email": 1, "_id": 0}
    ))

    return jsonify(users), 200


@solicitacoes_routes.route("/solicitacoes", methods=["POST"])
@role_required("solicitante")
def criar_solicitacao():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "Arquivo obrigatório"}), 400

    remetente = request.current_user["email"]
    destinatario = request.form.get("destinatario")
    nome = request.form.get("nome")
    embalagem = request.form.get("embalagem")
    tipo = request.form.get("tipo")
    modulo = request.form.get("modulo")
    departamento = request.form.get("departamento")

    if not remetente or not destinatario or not nome or not tipo or not modulo or not departamento:
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400

    now = agora_fortaleza()

    filename = save_file(
        file,
        current_app.config["UPLOAD_FOLDER"],
        departamento,
        now.year,
        now.month
    )

    if not filename:
        return jsonify({"error": "Apenas PDF permitido"}), 400

    solicitacao = {
        "remetente": remetente,
        "destinatario": destinatario,
        "nome": nome,
        "nome_original": file.filename,
        "embalagem": embalagem,
        "tipo": tipo,
        "modulo": modulo,
        "departamento": departamento,
        "arquivo": filename,
        "status": "pendente",
        "criado_em": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M")
    }

    db.solicitacoes.insert_one(solicitacao)

    registrar_auditoria(
        "criar_solicitacao",
        remetente,
        {
            "destinatario": destinatario,
            "nome": nome,
            "modulo": modulo,
            "departamento": departamento,
            "arquivo": filename
        }
    )

    return jsonify({"msg": "Solicitação enviada com sucesso"}), 201


@solicitacoes_routes.route("/solicitacoes", methods=["GET"])
@login_required
def listar_solicitacoes():
    destinatario = request.args.get("destinatario")

    if not destinatario:
        return jsonify({"error": "Destinatário é obrigatório"}), 400

    docs = list(db.solicitacoes.find({
        "destinatario": destinatario,
        "status": "pendente"
    }))

    for d in docs:
        d["_id"] = str(d["_id"])

    return jsonify(docs), 200


@solicitacoes_routes.route("/solicitacoes/<id>/processar", methods=["POST"])
@login_required
def processar_solicitacao(id):
    try:
        solicitacao = db.solicitacoes.find_one({"_id": ObjectId(id)})

        if not solicitacao:
            return jsonify({"error": "Solicitação não encontrada"}), 404

        now = agora_fortaleza()

        doc = {
            "nome": solicitacao.get("nome"),
            "nome_original": solicitacao.get("nome_original"),
            "embalagem": solicitacao.get("embalagem"),
            "arquivo": solicitacao.get("arquivo"),
            "anexado_por": request.current_user["email"],
            "tipo": solicitacao.get("tipo"),
            "departamento": solicitacao.get("departamento"),
            "modulo": solicitacao.get("modulo"),

            "origem": "solicitacao",
            "protegido_exclusao": False,

            "confirmado_financeiro": False,
            "confirmado_por": None,
            "data_confirmacao": None,

            "solicitado_por": solicitacao.get("remetente"),
            "processado_por": request.current_user["email"],

            "data_envio": now,
            "dia": now.day,
            "mes": now.month,
            "ano": now.year,
            "hora": now.strftime("%H:%M")
        }

        db.documents.insert_one(doc)

        registrar_auditoria(
            "processar_solicitacao",
            request.current_user["email"],
            {
                "remetente": solicitacao.get("remetente"),
                "nome": solicitacao.get("nome"),
                "modulo": solicitacao.get("modulo"),
                "departamento": solicitacao.get("departamento"),
                "arquivo": solicitacao.get("arquivo")
            }
        )

        db.solicitacoes.update_one(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "status": "concluida",
                    "processado_em": now,
                    "processado_por": request.current_user["email"]
                }
            }
        )

        return jsonify({"msg": "Solicitação processada com sucesso"}), 200

    except Exception as e:
        print("Erro ao processar solicitação:", e)
        return jsonify({"error": "Erro ao processar solicitação"}), 500