from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from pymongo import MongoClient
from bson import ObjectId
import pytz

from config import MONGO_URI, DB_NAME
from utils.file_utils import save_file
from utils.audit_utils import registrar_auditoria

doc_routes = Blueprint("documents", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]


@doc_routes.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "Arquivo obrigatório"}), 400

    filename = save_file(file, current_app.config["UPLOAD_FOLDER"])

    if not filename:
        return jsonify({"error": "Apenas PDF permitido"}), 400

    tz = pytz.timezone("America/Fortaleza")
    now = datetime.now(tz)

    doc = {
        "nome": request.form.get("nome"),
        "embalagem": request.form.get("embalagem"),
        "arquivo": filename,
        "anexado_por": request.form.get("usuario"),
        "tipo": request.form.get("tipo"),
        "departamento": request.form.get("departamento"),
        "modulo": request.form.get("modulo"),

        "origem": "gerenciador",
        "protegido_exclusao": False,

        "data_envio": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M")
    }

    db.documents.insert_one(doc)

    registrar_auditoria(
        "upload_documento",
        request.form.get("usuario"),
        {
            "nome": request.form.get("nome"),
            "modulo": request.form.get("modulo"),
            "departamento": request.form.get("departamento"),
            "tipo": request.form.get("tipo"),
            "origem": "gerenciador"
        }
    )

    return jsonify({"msg": "Upload realizado com sucesso"}), 201


@doc_routes.route("/financeiro/upload", methods=["POST"])
def financeiro_upload():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "Arquivo obrigatório"}), 400

    filename = save_file(file, current_app.config["UPLOAD_FOLDER"])

    if not filename:
        return jsonify({"error": "Apenas PDF permitido"}), 400

    tz = pytz.timezone("America/Fortaleza")
    now = datetime.now(tz)

    doc = {
        "nome": request.form.get("nome"),
        "embalagem": request.form.get("embalagem"),
        "arquivo": filename,
        "anexado_por": request.form.get("usuario"),
        "tipo": request.form.get("tipo"),
        "departamento": request.form.get("departamento"),
        "modulo": request.form.get("modulo"),

        "origem": "financeiro",
        "protegido_exclusao": True,

        "data_envio": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M")
    }

    db.documents.insert_one(doc)

    registrar_auditoria(
        "upload_financeiro",
        request.form.get("usuario"),
        {
            "nome": request.form.get("nome"),
            "modulo": request.form.get("modulo"),
            "departamento": request.form.get("departamento"),
            "tipo": request.form.get("tipo"),
            "origem": "financeiro"
        }
    )

    return jsonify({"msg": "Documento financeiro adicionado com sucesso"}), 201


@doc_routes.route("/documents", methods=["GET"])
def list_docs():
    modulo = request.args.get("modulo")
    departamento = request.args.get("departamento")

    filtro = {}

    if modulo:
        filtro["modulo"] = modulo

    if departamento:
        filtro["departamento"] = departamento

    docs = list(db.documents.find(filtro))

    for d in docs:
        d["_id"] = str(d["_id"])

    return jsonify(docs), 200


@doc_routes.route("/documents/<id>", methods=["DELETE"])
def delete_doc(id):
    try:
        doc = db.documents.find_one({"_id": ObjectId(id)})

        if not doc:
            return jsonify({"error": "Documento não encontrado"}), 404

        db.documents.delete_one({"_id": ObjectId(id)})

        registrar_auditoria(
            "delete_documento",
            doc.get("anexado_por"),
            {
                "nome": doc.get("nome"),
                "modulo": doc.get("modulo"),
                "departamento": doc.get("departamento"),
                "tipo": doc.get("tipo"),
                "arquivo": doc.get("arquivo"),
                "origem": doc.get("origem")
            }
        )

        return jsonify({"msg": "Removido com sucesso"}), 200

    except Exception:
        return jsonify({"error": "ID inválido"}), 400


@doc_routes.route("/files/<filename>", methods=["GET"])
def get_file(filename):
    return send_from_directory(
        current_app.config["UPLOAD_FOLDER"],
        filename,
        as_attachment=True
    )


@doc_routes.route("/financeiro", methods=["GET"])
def financeiro():
    docs = list(db.documents.find())

    for d in docs:
        d["_id"] = str(d["_id"])

    return jsonify(docs), 200