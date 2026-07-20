from datetime import datetime, timezone
import re
from database import get_database

from bson import ObjectId
from flask import Blueprint, jsonify, request
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from utils.audit_utils import registrar_auditoria
from utils.permission_utils import login_required, role_required

secretarias_routes = Blueprint("secretarias", __name__)

db = get_database()

SECRETARIAS_INICIAIS = [
    {"sigla": "SEGOV", "nome": "Secretaria de Estado de Governo"},
    {"sigla": "SEDES", "nome": "Secretaria de Estado do Desenvolvimento Social"},
    {"sigla": "SAF", "nome": "Secretaria de Estado da Agricultura Familiar"},
    {"sigla": "ITERMA", "nome": "Instituto de Colonização e Terras do Maranhão"},
    {"sigla": "AGERP", "nome": "Agência Estadual de Pesquisa Agropecuária e Extensão Rural"},
    {"sigla": "INAGRO", "nome": "Instituto de Agronegócios do Maranhão"},
]


def agora_utc():
    return datetime.now(timezone.utc)


def normalizar_sigla(valor):
    return re.sub(r"\s+", "", (valor or "").strip().upper())


def serializar(secretaria):
    secretaria["_id"] = str(secretaria["_id"])
    return secretaria


def preparar_secretarias():
    """Cria índices e cadastra as secretarias iniciais sem sobrescrever dados existentes."""
    db.secretarias.create_index([("sigla", ASCENDING)], unique=True, name="uq_secretarias_sigla")
    for item in SECRETARIAS_INICIAIS:
        db.secretarias.update_one(
            {"sigla": item["sigla"]},
            {
                "$setOnInsert": {
                    **item,
                    "ativa": True,
                    "criada_em": agora_utc(),
                    "atualizada_em": agora_utc(),
                    "origem": "seed_fase_2_1",
                }
            },
            upsert=True,
        )


@secretarias_routes.get("/secretarias")
@login_required
def listar_secretarias():
    incluir_inativas = request.args.get("incluir_inativas", "false").lower() == "true"
    filtro = {}

    if incluir_inativas:
        if request.current_user.get("role") != "admin":
            return jsonify({"error": "Acesso negado"}), 403
    else:
        filtro["ativa"] = True

    secretarias = [serializar(item) for item in db.secretarias.find(filtro).sort("sigla", ASCENDING)]
    return jsonify(secretarias), 200


@secretarias_routes.post("/admin/secretarias")
@role_required("admin")
def criar_secretaria():
    data = request.get_json(silent=True) or {}
    sigla = normalizar_sigla(data.get("sigla"))
    nome = (data.get("nome") or "").strip()

    if not sigla or not nome:
        return jsonify({"error": "Sigla e nome são obrigatórios"}), 400
    if not re.fullmatch(r"[A-Z0-9_-]{2,20}", sigla):
        return jsonify({"error": "A sigla deve ter de 2 a 20 caracteres, usando letras, números, _ ou -"}), 400

    agora = agora_utc()
    secretaria = {
        "sigla": sigla,
        "nome": nome,
        "ativa": bool(data.get("ativa", True)),
        "criada_em": agora,
        "atualizada_em": agora,
        "criada_por": request.current_user["email"],
    }

    try:
        resultado = db.secretarias.insert_one(secretaria)
    except DuplicateKeyError:
        return jsonify({"error": "Já existe uma secretaria com esta sigla"}), 409

    registrar_auditoria(
        "admin_criar_secretaria",
        request.current_user["email"],
        {"secretaria_id": str(resultado.inserted_id), "sigla": sigla, "nome": nome},
    )

    secretaria["_id"] = str(resultado.inserted_id)
    return jsonify(secretaria), 201


@secretarias_routes.put("/admin/secretarias/<secretaria_id>")
@role_required("admin")
def editar_secretaria(secretaria_id):
    if not ObjectId.is_valid(secretaria_id):
        return jsonify({"error": "ID de secretaria inválido"}), 400

    data = request.get_json(silent=True) or {}
    sigla = normalizar_sigla(data.get("sigla"))
    nome = (data.get("nome") or "").strip()

    if not sigla or not nome:
        return jsonify({"error": "Sigla e nome são obrigatórios"}), 400
    if not re.fullmatch(r"[A-Z0-9_-]{2,20}", sigla):
        return jsonify({"error": "A sigla deve ter de 2 a 20 caracteres, usando letras, números, _ ou -"}), 400

    oid = ObjectId(secretaria_id)
    anterior = db.secretarias.find_one({"_id": oid})
    if not anterior:
        return jsonify({"error": "Secretaria não encontrada"}), 404

    novos_dados = {
        "sigla": sigla,
        "nome": nome,
        "ativa": bool(data.get("ativa", True)),
        "atualizada_em": agora_utc(),
        "atualizada_por": request.current_user["email"],
    }

    try:
        db.secretarias.update_one({"_id": oid}, {"$set": novos_dados})
    except DuplicateKeyError:
        return jsonify({"error": "Já existe uma secretaria com esta sigla"}), 409

    # Mantém os documentos associados quando a sigla é alterada.
    if anterior.get("sigla") != sigla:
        db.documents.update_many(
            {"departamento": anterior.get("sigla")},
            {"$set": {"departamento": sigla, "secretaria": sigla}},
        )

    registrar_auditoria(
        "admin_editar_secretaria",
        request.current_user["email"],
        {
            "secretaria_id": secretaria_id,
            "antes": {"sigla": anterior.get("sigla"), "nome": anterior.get("nome"), "ativa": anterior.get("ativa")},
            "depois": {"sigla": sigla, "nome": nome, "ativa": novos_dados["ativa"]},
        },
    )

    atualizada = db.secretarias.find_one({"_id": oid})
    return jsonify(serializar(atualizada)), 200


@secretarias_routes.delete("/admin/secretarias/<secretaria_id>")
@role_required("admin")
def excluir_secretaria(secretaria_id):
    if not ObjectId.is_valid(secretaria_id):
        return jsonify({"error": "ID de secretaria inválido"}), 400

    oid = ObjectId(secretaria_id)
    secretaria = db.secretarias.find_one({"_id": oid})
    if not secretaria:
        return jsonify({"error": "Secretaria não encontrada"}), 404

    total_documentos = db.documents.count_documents({"departamento": secretaria["sigla"]})
    if total_documentos > 0:
        return jsonify({
            "error": "Esta secretaria possui documentos associados. Inative-a em vez de excluir.",
            "documentos_associados": total_documentos,
        }), 409

    db.secretarias.delete_one({"_id": oid})
    registrar_auditoria(
        "admin_excluir_secretaria",
        request.current_user["email"],
        {"secretaria_id": secretaria_id, "sigla": secretaria.get("sigla"), "nome": secretaria.get("nome")},
    )
    return jsonify({"msg": "Secretaria excluída com sucesso"}), 200
