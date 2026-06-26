from datetime import datetime
import os
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from pymongo import MongoClient
from bson import ObjectId
import pytz
from config import MONGO_URI, DB_NAME
from utils.file_utils import save_file
from utils.audit_utils import registrar_auditoria
from utils.permission_utils import login_required, role_required, permission_required
doc_routes = Blueprint("documents", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def agora_fortaleza():
    tz = pytz.timezone("America/Fortaleza")
    return datetime.now(tz)


@doc_routes.route("/upload", methods=["POST"])
@login_required
def upload():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "Arquivo obrigatório"}), 400

    filename = save_file(file, current_app.config["UPLOAD_FOLDER"])

    if not filename:
        return jsonify({"error": "Apenas PDF permitido"}), 400

    now = agora_fortaleza()

    doc = {
        "nome": request.form.get("nome"), # <-- visualizar o nome do documento no banco de dados(evitar duplicidade de nomes)
        "nome_original": file.filename,  # <-- visualizar o nome original do arquivo que foi enviado
        "embalagem": request.form.get("embalagem"),
        "arquivo": filename,
        "anexado_por": request.current_user["email"],
        "tipo": request.form.get("tipo"),
        "departamento": request.form.get("departamento"),
        "modulo": request.form.get("modulo"),

        "origem": "gerenciador",
        "protegido_exclusao": False,

        "confirmado_financeiro": False,
        "confirmado_por": None,
        "data_confirmacao": None,

        "data_envio": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M")
    }

    db.documents.insert_one(doc)

    registrar_auditoria(
        "upload_documento",
        request.current_user["email"],
        {
            "nome": doc["nome"],
            "modulo": doc["modulo"],
            "departamento": doc["departamento"],
            "tipo": doc["tipo"],
            "origem": "gerenciador"
        }
    )

    return jsonify({"msg": "Upload realizado com sucesso"}), 201


@doc_routes.route("/financeiro/upload", methods=["POST"])
@permission_required("financeiro")
def financeiro_upload():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "Arquivo obrigatório"}), 400

    filename = save_file(file, current_app.config["UPLOAD_FOLDER"])

    if not filename:
        return jsonify({"error": "Apenas PDF permitido"}), 400

    now = agora_fortaleza()

    doc = {
        "nome": request.form.get("nome"),
        "nome_original": file.filename,
        "embalagem": request.form.get("embalagem"),
        "arquivo": filename,
        "anexado_por": request.current_user["email"],
        "tipo": request.form.get("tipo"),
        "departamento": request.form.get("departamento"),
        "modulo": request.form.get("modulo"),

        "origem": "financeiro",
        "protegido_exclusao": True,

        "confirmado_financeiro": True,
        "confirmado_por": request.current_user["email"],
        "data_confirmacao": now,

        "data_envio": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M")
    }

    db.documents.insert_one(doc)

    registrar_auditoria(
        "upload_financeiro",
        request.current_user["email"],
        {
            "nome": doc["nome"],
            "modulo": doc["modulo"],
            "departamento": doc["departamento"],
            "tipo": doc["tipo"],
            "origem": "financeiro"
        }
    )

    return jsonify({"msg": "Documento financeiro adicionado com sucesso"}), 201


@doc_routes.route("/documents", methods=["GET"])
@login_required
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


@doc_routes.route("/documents/<id>", methods=["PUT"])
@permission_required("financeiro")
def editar_doc(id):
    try:
        doc_antigo = db.documents.find_one({"_id": ObjectId(id)})

        if not doc_antigo:
            return jsonify({"error": "Documento não encontrado"}), 404

        data = request.json
        usuario = request.current_user["email"]

        novos_dados = {
            "nome": data.get("nome"),
            "embalagem": data.get("embalagem"),
            "tipo": data.get("tipo"),
            "departamento": data.get("departamento"),
            "modulo": data.get("modulo")
        }

        db.documents.update_one(
            {"_id": ObjectId(id)},
            {"$set": novos_dados}
        )

        registrar_auditoria(
            "editar_documento_financeiro",
            usuario,
            {
                "documento_id": id,
                "antes": {
                    "nome": doc_antigo.get("nome"),
                    "embalagem": doc_antigo.get("embalagem"),
                    "tipo": doc_antigo.get("tipo"),
                    "departamento": doc_antigo.get("departamento"),
                    "modulo": doc_antigo.get("modulo")
                },
                "depois": novos_dados
            }
        )

        return jsonify({"msg": "Documento editado com sucesso"}), 200

    except Exception:
        return jsonify({"error": "Erro ao editar documento"}), 400


@doc_routes.route("/documents/<id>/confirmar", methods=["PATCH"])
@permission_required("financeiro")
def confirmar_doc(id):
    try:
        data = request.json
        usuario = request.current_user["email"]
        confirmado = data.get("confirmado", True)

        now = agora_fortaleza()

        campos = {
            "confirmado_financeiro": confirmado,
            "confirmado_por": usuario if confirmado else None,
            "data_confirmacao": now if confirmado else None
        }

        result = db.documents.update_one(
            {"_id": ObjectId(id)},
            {"$set": campos}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Documento não encontrado"}), 404

        registrar_auditoria(
            "confirmar_documento_financeiro" if confirmado else "desconfirmar_documento_financeiro",
            usuario,
            {
                "documento_id": id,
                "confirmado": confirmado
            }
        )

        return jsonify({"msg": "Status de confirmação atualizado"}), 200

    except Exception:
        return jsonify({"error": "Erro ao confirmar documento"}), 400


@doc_routes.route("/documents/<id>", methods=["DELETE"])
@permission_required("financeiro")
def delete_doc(id):
    try:
        usuario = request.current_user["email"]

        doc = db.documents.find_one({"_id": ObjectId(id)})

        if not doc:
            return jsonify({"error": "Documento não encontrado"}), 404

        db.documents.delete_one({"_id": ObjectId(id)})

        registrar_auditoria(
            "delete_documento_financeiro" if usuario else "delete_documento",
            usuario,
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
@login_required
def get_file(filename):
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    caminho_arquivo = os.path.join(upload_folder, filename)

    if not os.path.exists(caminho_arquivo):
        return jsonify({
            "error": "Arquivo não encontrado no servidor."
        }), 404

    return send_from_directory(
        upload_folder,
        filename,
        as_attachment=False
    )


@doc_routes.route("/financeiro", methods=["GET"])
@permission_required("financeiro", "banco_dados")
def financeiro():
    docs = list(db.documents.find())

    for d in docs:
        d["_id"] = str(d["_id"])

    return jsonify(docs), 200