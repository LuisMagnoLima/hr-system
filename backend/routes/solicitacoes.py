from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from pymongo import MongoClient
from bson import ObjectId
import pytz
from utils.permission_utils import login_required
from config import MONGO_URI, DB_NAME
from utils.file_utils import save_file
from utils.audit_utils import registrar_auditoria

solicitacoes_routes = Blueprint("solicitacoes", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]


# 🔎 lista usuários que podem receber aquele módulo
@solicitacoes_routes.route("/usuarios-por-permissao", methods=["GET"])
@login_required
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


# 📤 cria solicitação enviada pela Polyana
@solicitacoes_routes.route("/solicitacoes", methods=["POST"])
@login_required
def criar_solicitacao():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "Arquivo obrigatório"}), 400

    filename = save_file(file, current_app.config["UPLOAD_FOLDER"])

    if not filename:
        return jsonify({"error": "Apenas PDF permitido"}), 400

    remetente = request.form.get("remetente")
    destinatario = request.form.get("destinatario")
    nome = request.form.get("nome")
    embalagem = request.form.get("embalagem")
    tipo = request.form.get("tipo")
    modulo = request.form.get("modulo")
    departamento = request.form.get("departamento")

    if not remetente or not destinatario or not nome or not tipo or not modulo or not departamento:
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400

    tz = pytz.timezone("America/Fortaleza")
    now = datetime.now(tz)

    solicitacao = {
        "remetente": remetente,
        "destinatario": destinatario,
        "nome": nome,
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
        "departamento": departamento
    }
)

    return jsonify({"msg": "Solicitação enviada com sucesso"}), 201


# 🔔 lista solicitações pendentes do usuário
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


# ✅ processa solicitação e joga em documents
@solicitacoes_routes.route("/solicitacoes/<id>/processar", methods=["POST"])
@login_required
def processar_solicitacao(id):
    solicitacao = db.solicitacoes.find_one({"_id": ObjectId(id)})

    if not solicitacao:
        return jsonify({"error": "Solicitação não encontrada"}), 404

    tz = pytz.timezone("America/Fortaleza")
    now = datetime.now(tz)

    doc = {
        "nome": solicitacao.get("nome"),
        "embalagem": solicitacao.get("embalagem"),
        "arquivo": solicitacao.get("arquivo"),
        "anexado_por": solicitacao.get("destinatario"),
        "tipo": solicitacao.get("tipo"),
        "departamento": solicitacao.get("departamento"),
        "modulo": solicitacao.get("modulo"),
        "data_envio": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M")
    }

    db.documents.insert_one(doc)
    registrar_auditoria(
    "processar_solicitacao",
    solicitacao.get("destinatario"),
    {
        "remetente": solicitacao.get("remetente"),
        "nome": solicitacao.get("nome"),
        "modulo": solicitacao.get("modulo")
    }
)

    db.solicitacoes.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"status": "concluida"}}
    )

    return jsonify({"msg": "Solicitação processada com sucesso"}), 200