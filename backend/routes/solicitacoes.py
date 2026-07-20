from datetime import datetime
import csv
import io

import pytz
from bson import ObjectId
from flask import Blueprint, Response, jsonify, request
from pymongo import ReturnDocument

from database import get_database
from utils.audit_utils import registrar_auditoria
from utils.permission_utils import login_required, role_required


solicitacoes_routes = Blueprint("solicitacoes", __name__)
db = get_database()

TZ_FORTALEZA = pytz.timezone("America/Fortaleza")


def agora_fortaleza():
    return datetime.now(TZ_FORTALEZA)


def para_fortaleza(valor):
    if not valor:
        return None

    if valor.tzinfo is None:
        valor = pytz.UTC.localize(valor)

    return valor.astimezone(TZ_FORTALEZA)


def data_iso_fortaleza(valor):
    convertido = para_fortaleza(valor)
    return convertido.isoformat() if convertido else None


def data_csv_fortaleza(valor):
    convertido = para_fortaleza(valor)
    return convertido.strftime("%d/%m/%Y %H:%M") if convertido else ""


def gerar_protocolo(now):
    chave = f"protocolo_recebimento_{now.year}"

    contador = db.contadores.find_one_and_update(
        {"_id": chave},
        {"$inc": {"sequencia": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    return f"PRT-{now.year}-{contador['sequencia']:06d}"


def serializar(doc):
    item = dict(doc)
    item["_id"] = str(item["_id"])

    for campo in ("criado_em", "atualizado_em"):
        if item.get(campo):
            item[campo] = data_iso_fortaleza(item[campo])

    return item


def pode_gerenciar(doc, usuario):
    return (
        usuario.get("role") == "admin"
        or doc.get("remetente") == usuario.get("email")
    )


@solicitacoes_routes.route("/solicitacoes", methods=["POST"])
@role_required("solicitante")
def criar_solicitacao():
    dados = request.get_json(silent=True) or {}
    numero_oficio = (dados.get("numero_oficio") or "").strip()

    if not numero_oficio:
        return jsonify({"error": "Número do ofício é obrigatório"}), 400

    now = agora_fortaleza()
    remetente = request.current_user["email"]
    protocolo = gerar_protocolo(now)

    documento = {
        "protocolo": protocolo,
        "numero_oficio": numero_oficio,
        "remetente": remetente,
        "status": "registrado",
        "situacao": "Registrado",
        "criado_em": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M"),
    }

    resultado = db.solicitacoes.insert_one(documento)

    registrar_auditoria(
        "criar_protocolo_oficio",
        remetente,
        {
            "solicitacao_id": str(resultado.inserted_id),
            "protocolo": protocolo,
            "numero_oficio": numero_oficio,
            "situacao": "Registrado",
        },
    )

    return jsonify({
        "msg": "Protocolo criado com sucesso",
        "protocolo": protocolo,
        "numero_oficio": numero_oficio,
        "situacao": "Registrado",
    }), 201


# Mantida apenas para não quebrar páginas antigas.
@solicitacoes_routes.route("/solicitacoes", methods=["GET"])
@login_required
def listar_solicitacoes():
    return jsonify([]), 200


@solicitacoes_routes.route("/solicitacoes/<id>", methods=["PATCH"])
@login_required
def editar_solicitacao(id):
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito à recepção e ao administrador"}), 403

    if not ObjectId.is_valid(id):
        return jsonify({"error": "Identificador inválido"}), 400

    filtro = {"_id": ObjectId(id)}
    documento = db.solicitacoes.find_one(filtro)

    if not documento:
        return jsonify({"error": "Protocolo não encontrado"}), 404

    if not pode_gerenciar(documento, request.current_user):
        return jsonify({"error": "Você não pode editar este protocolo"}), 403

    dados = request.get_json(silent=True) or {}
    numero_oficio = (dados.get("numero_oficio") or "").strip()

    if not numero_oficio:
        return jsonify({"error": "Número do ofício é obrigatório"}), 400

    if numero_oficio == documento.get("numero_oficio"):
        return jsonify({"msg": "Nenhuma alteração foi identificada"}), 200

    now = agora_fortaleza()

    db.solicitacoes.update_one(
        filtro,
        {
            "$set": {
                "numero_oficio": numero_oficio,
                "atualizado_em": now,
                "atualizado_por": request.current_user["email"],
            }
        },
    )

    registrar_auditoria(
        "editar_protocolo_oficio",
        request.current_user["email"],
        {
            "solicitacao_id": id,
            "protocolo": documento.get("protocolo"),
            "numero_anterior": documento.get("numero_oficio"),
            "numero_novo": numero_oficio,
        },
    )

    return jsonify({
        "msg": "Número do ofício atualizado com sucesso",
        "protocolo": documento.get("protocolo"),
        "numero_oficio": numero_oficio,
    }), 200


def criar_filtro(args, usuario):
    filtro = {}

    if usuario.get("role") != "admin":
        filtro["remetente"] = usuario["email"]

    protocolo = (args.get("protocolo") or "").strip()
    numero_oficio = (args.get("numero_oficio") or "").strip()
    data_inicial = (args.get("data_inicial") or "").strip()
    data_final = (args.get("data_final") or "").strip()

    if protocolo:
        filtro["protocolo"] = {"$regex": protocolo, "$options": "i"}

    if numero_oficio:
        filtro["numero_oficio"] = {"$regex": numero_oficio, "$options": "i"}

    periodo = {}

    try:
        if data_inicial:
            periodo["$gte"] = TZ_FORTALEZA.localize(
                datetime.strptime(data_inicial, "%Y-%m-%d")
            )

        if data_final:
            periodo["$lte"] = TZ_FORTALEZA.localize(
                datetime.strptime(data_final, "%Y-%m-%d").replace(
                    hour=23,
                    minute=59,
                    second=59,
                )
            )
    except ValueError as erro:
        raise ValueError("Datas inválidas. Use o formato AAAA-MM-DD") from erro

    if periodo:
        filtro["criado_em"] = periodo

    return filtro


@solicitacoes_routes.route("/controle-protocolos", methods=["GET"])
@login_required
def controle_protocolos():
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito à recepção e ao administrador"}), 403

    try:
        filtro = criar_filtro(request.args, request.current_user)
    except ValueError as erro:
        return jsonify({"error": str(erro)}), 400

    documentos = list(
        db.solicitacoes.find(filtro).sort("criado_em", -1).limit(1000)
    )

    return jsonify({
        "resumo": {"total": len(documentos)},
        "protocolos": [serializar(documento) for documento in documentos],
    }), 200


@solicitacoes_routes.route("/controle-protocolos/<id>", methods=["GET"])
@login_required
def detalhe_controle_protocolo(id):
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito"}), 403

    if not ObjectId.is_valid(id):
        return jsonify({"error": "Identificador inválido"}), 400

    filtro = {"_id": ObjectId(id)}

    if request.current_user.get("role") != "admin":
        filtro["remetente"] = request.current_user["email"]

    documento = db.solicitacoes.find_one(filtro)

    if not documento:
        return jsonify({"error": "Protocolo não encontrado"}), 404

    return jsonify(serializar(documento)), 200


@solicitacoes_routes.route("/controle-protocolos/exportar.csv", methods=["GET"])
@login_required
def exportar_controle_protocolos():
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito"}), 403

    try:
        filtro = criar_filtro(request.args, request.current_user)
    except ValueError as erro:
        return jsonify({"error": str(erro)}), 400

    documentos = list(
        db.solicitacoes.find(filtro).sort("criado_em", -1).limit(5000)
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")

    writer.writerow([
        "Protocolo",
        "Numero do oficio",
        "Cadastrado por",
        "Data de cadastro",
    ])

    for documento in documentos:
        writer.writerow([
            documento.get("protocolo", ""),
            documento.get("numero_oficio", ""),
            documento.get("remetente", ""),
            data_csv_fortaleza(documento.get("criado_em")),
        ])

    conteudo = "\ufeff" + buffer.getvalue()

    return Response(
        conteudo,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=controle_protocolos.csv"
        },
    )


# Rotas antigas desativadas de forma explícita.
@solicitacoes_routes.route(
    "/solicitacoes/<id>/confirmar-recebimento",
    methods=["POST"],
)
@solicitacoes_routes.route("/solicitacoes/<id>/recusar", methods=["POST"])
@solicitacoes_routes.route("/solicitacoes/<id>/reencaminhar", methods=["POST"])
@solicitacoes_routes.route("/solicitacoes/<id>/processar", methods=["POST"])
@login_required
def fluxo_antigo_desativado(id):
    return jsonify({
        "error": (
            "O fluxo de aceite foi desativado. "
            "O sistema registra somente o número do ofício."
        )
    }), 410
