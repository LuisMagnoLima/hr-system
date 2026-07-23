from datetime import datetime
import os
from database import get_database

from bson import ObjectId
from flask import Blueprint, Response, current_app, jsonify, request, send_from_directory
from pymongo import ReturnDocument
import pytz

from utils.audit_utils import registrar_auditoria
from utils.file_utils import save_file
from utils.cleanup_utils import arquivar_documento
from utils.permission_utils import login_required, permission_required


doc_routes = Blueprint("documents", __name__)
db = get_database()

TIPOS_DOCUMENTO = {"ativo", "inativo", "pendente"}
MODULOS_DOCUMENTO = {"notas", "diarias", "admissoes"}
STATUS_DOCUMENTO = {
    "em_elaboracao": "Em elaboração",
    "enviado": "Enviado",
    "em_analise": "Em análise",
    "aprovado": "Aprovado",
    "rejeitado": "Rejeitado",
    "arquivado": "Arquivado",
}
TRANSICOES_STATUS = {
    "em_elaboracao": {"enviado"},
    "enviado": {"em_analise", "rejeitado"},
    "em_analise": {"aprovado", "rejeitado", "enviado"},
    "aprovado": {"arquivado", "em_analise"},
    "rejeitado": {"em_elaboracao", "enviado"},
    "arquivado": set(),
}


def agora_fortaleza():
    return datetime.now(pytz.timezone("America/Fortaleza"))


def gerar_protocolo(ano):
    contador = db.counters.find_one_and_update(
        {"_id": f"protocolo_{ano}"},
        {"$inc": {"sequencia": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"INA-{ano}-{contador['sequencia']:06d}"


def evento_historico(status, usuario, acao, observacao="", data=None):
    return {
        "status": status,
        "status_label": STATUS_DOCUMENTO.get(status, status),
        "acao": acao,
        "observacao": (observacao or "").strip(),
        "usuario": usuario,
        "data": data or agora_fortaleza(),
    }


def normalizar_documento_antigo(documento):
    """Inclui os campos da Fase 2.2 em documentos criados em versões anteriores."""
    alteracoes = {}
    now = documento.get("data_envio") or agora_fortaleza()
    status = documento.get("status") or (
        "aprovado" if documento.get("confirmado_financeiro") else "em_elaboracao"
    )

    if not documento.get("protocolo"):
        alteracoes["protocolo"] = gerar_protocolo(getattr(now, "year", agora_fortaleza().year))
    if not documento.get("status"):
        alteracoes["status"] = status
    if not documento.get("responsavel_atual"):
        alteracoes["responsavel_atual"] = documento.get("anexado_por")
    if not documento.get("ultima_atualizacao"):
        alteracoes["ultima_atualizacao"] = now
    if "observacao" not in documento:
        alteracoes["observacao"] = (documento.get("embalagem") or "").strip()
    if not documento.get("historico"):
        alteracoes["historico"] = [
            evento_historico(
                status,
                documento.get("anexado_por", "sistema"),
                "Documento incorporado ao fluxo documental",
                data=now,
            )
        ]

    if alteracoes:
        db.documents.update_one({"_id": documento["_id"]}, {"$set": alteracoes})
        documento.update(alteracoes)
    return documento


def serializar_documento(documento):
    documento = dict(documento)
    # Nunca envia os bytes do PDF nas respostas JSON.
    documento.pop("arquivo_dados", None)
    documento["_id"] = str(documento["_id"])
    documento["observacao"] = documento.get("observacao") or documento.get("embalagem") or ""
    documento["status_label"] = STATUS_DOCUMENTO.get(
        documento.get("status"), documento.get("status", "")
    )
    for item in documento.get("historico", []):
        item["status_label"] = STATUS_DOCUMENTO.get(item.get("status"), item.get("status", ""))
    return documento


def tipos_permitidos_modulo(modulo):
    return {"ativo", "inativo"} if modulo == "admissoes" else {"ativo", "pendente"}


def usuario_pode_editar_documento(user, documento):
    permissoes = user.get("permissions", [])
    return (
        user.get("role") == "admin"
        or "banco_dados" in permissoes
        or documento.get("modulo") in permissoes
    )


def validar_tipo_por_modulo(tipo, modulo):
    if tipo not in tipos_permitidos_modulo(modulo):
        permitidos = ", ".join(sorted(tipos_permitidos_modulo(modulo)))
        return f"Tipo inválido para este módulo. Permitidos: {permitidos}"
    return None


def validar_metadados_documento(origem):
    nome = (origem.get("nome") or "").strip()
    secretaria = (origem.get("departamento") or origem.get("secretaria") or "").strip().upper()
    tipo = (origem.get("tipo") or "").strip().lower()
    modulo = (origem.get("modulo") or "").strip().lower()

    if not nome:
        return None, "Nome do documento é obrigatório"
    if tipo not in TIPOS_DOCUMENTO:
        return None, "Tipo de documento inválido"
    if modulo not in MODULOS_DOCUMENTO:
        return None, "Módulo inválido"
    erro_tipo_modulo = validar_tipo_por_modulo(tipo, modulo)
    if erro_tipo_modulo:
        return None, erro_tipo_modulo
    if not db.secretarias.find_one({"sigla": secretaria, "ativa": True}):
        return None, "Secretaria inexistente ou inativa"

    return {
        "nome": nome,
        "observacao": (origem.get("observacao") or origem.get("embalagem") or "").strip(),
        "tipo": tipo,
        "departamento": secretaria,
        "secretaria": secretaria,
        "modulo": modulo,
    }, None


def criar_documento(file, metadados, usuario, origem, confirmado=False):
    """Cria o documento e salva o PDF no volume persistente de uploads.

    Os metadados permanecem no MongoDB e o arquivo fica no sistema de arquivos,
    permitindo PDFs grandes sem o limite de 16 MB por documento BSON.
    """
    if not file or not file.filename:
        return None, "Arquivo PDF obrigatório"

    now = agora_fortaleza()
    caminho_relativo, erro = save_file(
        file,
        current_app.config["UPLOAD_FOLDER"],
        metadados.get("departamento", "GERAL"),
        now.year,
        now.month,
    )
    if erro:
        return None, erro

    caminho_absoluto = os.path.join(current_app.config["UPLOAD_FOLDER"], caminho_relativo)
    tamanho = os.path.getsize(caminho_absoluto)
    status_inicial = "aprovado" if confirmado else "em_elaboracao"
    protocolo = gerar_protocolo(now.year)
    nome_original = file.filename

    doc = {
        **metadados,
        "protocolo": protocolo,
        "status": status_inicial,
        "responsavel_atual": usuario,
        "ultima_atualizacao": now,
        "historico": [
            evento_historico(status_inicial, usuario, "Documento criado", data=now)
        ],
        "nome_original": nome_original,
        "arquivo": caminho_relativo,
        "arquivo_nome": nome_original,
        "arquivo_tipo": "application/pdf",
        "arquivo_tamanho": tamanho,
        "anexado_por": usuario,
        "origem": origem,
        "protegido_exclusao": confirmado,
        "confirmado_financeiro": confirmado,
        "confirmado_por": usuario if confirmado else None,
        "data_confirmacao": now if confirmado else None,
        "data_envio": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M"),
    }

    try:
        resultado = db.documents.insert_one(doc)
    except Exception:
        try:
            os.remove(caminho_absoluto)
        except OSError:
            pass
        raise

    doc["_id"] = resultado.inserted_id
    return doc, None


@doc_routes.route("/upload", methods=["POST"])
@login_required
def upload():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Arquivo obrigatório"}), 400

    metadados, erro = validar_metadados_documento(request.form)
    if erro:
        return jsonify({"error": erro}), 400

    usuario = request.current_user["email"]
    doc, erro = criar_documento(
        file,
        metadados,
        usuario,
        "gerenciador",
        confirmado=False,
    )
    if erro:
        return jsonify({"error": erro}), 400

    registrar_auditoria("upload_documento", usuario, {
        "documento_id": str(doc["_id"]),
        "protocolo": doc["protocolo"],
        "nome": doc["nome"],
        "modulo": doc["modulo"],
        "departamento": doc["departamento"],
        "tipo": doc["tipo"],
    })

    return jsonify({
        "msg": "Upload realizado com sucesso",
        "documento_id": str(doc["_id"]),
        "protocolo": doc["protocolo"],
    }), 201


@doc_routes.route("/financeiro/upload", methods=["POST"])
@permission_required("financeiro")
def financeiro_upload():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Arquivo obrigatório"}), 400

    metadados, erro = validar_metadados_documento(request.form)
    if erro:
        return jsonify({"error": erro}), 400

    usuario = request.current_user["email"]
    doc, erro = criar_documento(file, metadados, usuario, "financeiro", confirmado=True)
    if erro:
        return jsonify({"error": erro}), 400

    registrar_auditoria("upload_financeiro", usuario, {
        "documento_id": str(doc["_id"]), "protocolo": doc["protocolo"],
        "nome": doc["nome"], "modulo": doc["modulo"],
        "departamento": doc["departamento"], "tipo": doc["tipo"],
    })
    return jsonify({"msg": "Documento financeiro adicionado com sucesso", "protocolo": doc["protocolo"]}), 201


@doc_routes.route("/documents", methods=["GET"])
@login_required
def list_docs():
    filtro = {}
    for campo in ("modulo", "departamento", "status"):
        valor = request.args.get(campo)
        if valor:
            filtro[campo] = valor.strip().lower() if campo != "departamento" else valor.strip().upper()

    docs = [serializar_documento(normalizar_documento_antigo(d))
            for d in db.documents.find(filtro, {"arquivo_dados": 0}).sort("data_envio", -1)]
    return jsonify(docs), 200


@doc_routes.route("/documents/<id>", methods=["GET"])
@login_required
def obter_doc(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400
    doc = db.documents.find_one({"_id": ObjectId(id)}, {"arquivo_dados": 0})
    if not doc:
        return jsonify({"error": "Documento não encontrado"}), 404
    return jsonify(serializar_documento(normalizar_documento_antigo(doc))), 200


@doc_routes.route("/documents/<id>/pdf", methods=["GET"])
@login_required
def visualizar_pdf(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400

    doc = db.documents.find_one(
        {"_id": ObjectId(id)},
        {
            "arquivo_dados": 1,
            "arquivo_nome": 1,
            "nome_original": 1,
            "arquivo_tipo": 1,
            "arquivo": 1,
            "protocolo": 1,
        },
    )
    if not doc:
        return jsonify({"error": "Documento não encontrado"}), 404

    nome = doc.get("arquivo_nome") or doc.get("nome_original") or "documento.pdf"
    nome_seguro = nome.replace('"', "").replace("\r", "").replace("\n", "")
    caminho_relativo = doc.get("arquivo")

    registrar_auditoria("visualizar_documento", request.current_user["email"], {
        "documento_id": id,
        "protocolo": doc.get("protocolo"),
        "arquivo": nome_seguro,
    })

    if caminho_relativo:
        pasta_base = os.path.realpath(current_app.config["UPLOAD_FOLDER"])
        caminho_absoluto = os.path.realpath(os.path.join(pasta_base, caminho_relativo))
        if caminho_absoluto.startswith(pasta_base + os.sep) and os.path.isfile(caminho_absoluto):
            return send_from_directory(
                os.path.dirname(caminho_absoluto),
                os.path.basename(caminho_absoluto),
                mimetype=doc.get("arquivo_tipo") or "application/pdf",
                as_attachment=False,
                download_name=nome_seguro,
                max_age=0,
            )

    # Compatibilidade com documentos antigos que ainda guardam o PDF no MongoDB.
    dados = doc.get("arquivo_dados")
    if dados is not None:
        return Response(
            bytes(dados),
            status=200,
            mimetype=doc.get("arquivo_tipo") or "application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{nome_seguro}"',
                "Cache-Control": "no-store, private",
                "X-Content-Type-Options": "nosniff",
            },
        )

    return jsonify({"error": "Arquivo PDF não encontrado no armazenamento"}), 404


@doc_routes.route("/documents/<id>/status", methods=["PATCH"])
@login_required
def atualizar_status(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400

    data = request.get_json(silent=True) or {}
    novo_status = (data.get("status") or "").strip().lower()
    observacao = (data.get("observacao") or "").strip()
    responsavel = (data.get("responsavel") or request.current_user["email"]).strip()

    if novo_status not in STATUS_DOCUMENTO:
        return jsonify({"error": "Status inválido"}), 400
    if len(observacao) > 1000:
        return jsonify({"error": "A observação deve ter no máximo 1000 caracteres"}), 400

    doc = db.documents.find_one({"_id": ObjectId(id)})
    if not doc:
        return jsonify({"error": "Documento não encontrado"}), 404
    doc = normalizar_documento_antigo(doc)
    status_atual = doc.get("status", "em_elaboracao")

    if novo_status == status_atual:
        return jsonify({"error": "O documento já está nesse status"}), 400
    if novo_status not in TRANSICOES_STATUS.get(status_atual, set()):
        return jsonify({
            "error": f"Não é possível alterar de {STATUS_DOCUMENTO.get(status_atual)} para {STATUS_DOCUMENTO[novo_status]}"
        }), 400

    user = request.current_user
    permissions = user.get("permissions", [])
    if novo_status in {"aprovado", "arquivado"} and user.get("role") != "admin" and "financeiro" not in permissions:
        return jsonify({"error": "Somente administrador ou financeiro pode aprovar ou arquivar"}), 403

    now = agora_fortaleza()
    evento = evento_historico(
        novo_status, user["email"],
        f"Status alterado de {STATUS_DOCUMENTO.get(status_atual)} para {STATUS_DOCUMENTO[novo_status]}",
        observacao, now,
    )
    campos = {
        "status": novo_status,
        "responsavel_atual": responsavel,
        "ultima_atualizacao": now,
    }
    if novo_status == "aprovado":
        campos.update({"confirmado_financeiro": True, "confirmado_por": user["email"], "data_confirmacao": now})
    elif status_atual == "aprovado" and novo_status != "arquivado":
        campos.update({"confirmado_financeiro": False, "confirmado_por": None, "data_confirmacao": None})

    db.documents.update_one(
        {"_id": ObjectId(id)},
        {"$set": campos, "$push": {"historico": evento}},
    )
    registrar_auditoria("alterar_status_documento", user["email"], {
        "documento_id": id, "protocolo": doc.get("protocolo"),
        "status_anterior": status_atual, "novo_status": novo_status,
        "responsavel": responsavel, "observacao": observacao,
    })
    return jsonify({"msg": "Status atualizado com sucesso", "status": novo_status,
                    "status_label": STATUS_DOCUMENTO[novo_status]}), 200


@doc_routes.route("/documents/<id>", methods=["PUT"])
@login_required
def editar_doc(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400
    doc_antigo = db.documents.find_one({"_id": ObjectId(id)})
    if not doc_antigo:
        return jsonify({"error": "Documento não encontrado"}), 404
    if not usuario_pode_editar_documento(request.current_user, doc_antigo):
        return jsonify({"error": "Você não tem permissão para editar este arquivo"}), 403

    novos_dados, erro = validar_metadados_documento(request.get_json(silent=True) or {})
    if erro:
        return jsonify({"error": erro}), 400
    now = agora_fortaleza()
    evento = evento_historico(doc_antigo.get("status", "em_elaboracao"), request.current_user["email"], "Metadados do documento editados", data=now)
    db.documents.update_one({"_id": ObjectId(id)}, {"$set": {**novos_dados, "ultima_atualizacao": now}, "$push": {"historico": evento}})
    registrar_auditoria("editar_documento", request.current_user["email"], {"documento_id": id, "protocolo": doc_antigo.get("protocolo")})
    return jsonify({"msg": "Documento editado com sucesso"}), 200


@doc_routes.route("/documents/<id>/confirmar", methods=["PATCH"])
@permission_required("financeiro")
def confirmar_doc(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400

    data = request.get_json(silent=True) or {}
    confirmado = data.get("confirmado", True)
    doc = db.documents.find_one({"_id": ObjectId(id)})
    if not doc:
        return jsonify({"error": "Documento não encontrado"}), 404

    doc = normalizar_documento_antigo(doc)
    novo_status = "aprovado" if confirmado else "em_analise"
    now = agora_fortaleza()
    usuario = request.current_user["email"]
    evento = evento_historico(
        novo_status,
        usuario,
        "Documento confirmado pelo financeiro" if confirmado else "Confirmação financeira removida",
        data.get("observacao", ""),
        now,
    )
    campos = {
        "status": novo_status,
        "responsavel_atual": usuario,
        "ultima_atualizacao": now,
        "confirmado_financeiro": confirmado,
        "confirmado_por": usuario if confirmado else None,
        "data_confirmacao": now if confirmado else None,
    }
    db.documents.update_one(
        {"_id": ObjectId(id)},
        {"$set": campos, "$push": {"historico": evento}},
    )
    registrar_auditoria(
        "confirmar_documento_financeiro" if confirmado else "desconfirmar_documento_financeiro",
        usuario,
        {"documento_id": id, "protocolo": doc.get("protocolo"), "confirmado": confirmado},
    )
    return jsonify({"msg": "Status de confirmação atualizado", "status": novo_status}), 200


@doc_routes.route("/documents/<id>", methods=["DELETE"])
@permission_required("financeiro")
def delete_doc(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400
    doc = db.documents.find_one({"_id": ObjectId(id)})
    if not doc:
        return jsonify({"error": "Documento não encontrado"}), 404
    arquivar_documento(doc, request.current_user["email"], motivo="Exclusão manual")
    return jsonify({
        "msg": "Documento movido para Arquivados. Será excluído definitivamente após 6 meses."
    }), 200


@doc_routes.route("/files/<path:filename>", methods=["GET"])
@login_required
def get_file(filename):
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    caminho_arquivo = os.path.join(upload_folder, filename)
    if not os.path.exists(caminho_arquivo):
        return jsonify({"error": "Arquivo não encontrado no servidor."}), 404
    registrar_auditoria("visualizar_documento", request.current_user["email"], {"arquivo": filename})
    return send_from_directory(upload_folder, filename, as_attachment=False)


@doc_routes.route("/financeiro", methods=["GET"])
@permission_required("financeiro", "banco_dados")
def financeiro():
    docs = [serializar_documento(normalizar_documento_antigo(d))
            for d in db.documents.find({}, {"arquivo_dados": 0}).sort("data_envio", -1)]
    return jsonify(docs), 200
