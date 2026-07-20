from datetime import datetime
from database import get_database

import pytz
from bson import ObjectId
from flask import Blueprint, request, jsonify
from pymongo import ReturnDocument

from utils.audit_utils import registrar_auditoria
from utils.permission_utils import login_required, role_required

solicitacoes_routes = Blueprint("solicitacoes", __name__)

db = get_database()

TZ_FORTALEZA = pytz.timezone("America/Fortaleza")


def agora_fortaleza():
    return datetime.now(TZ_FORTALEZA)


def para_fortaleza(valor):
    """
    Converte datas vindas do MongoDB para o fuso de Fortaleza.

    O MongoDB armazena datas em UTC. Por padrão, o PyMongo pode devolvê-las
    sem tzinfo; nesse caso, tratamos o valor como UTC antes da conversão.
    """
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


@solicitacoes_routes.route("/usuarios-por-permissao", methods=["GET"])
@role_required("solicitante")
def usuarios_por_permissao():
    modulo = (request.args.get("modulo") or "").strip().lower()

    filtro = {"role": {"$ne": "solicitante"}}
    if modulo:
        filtro["permissions"] = modulo

    users = list(db.users.find(
        filtro,
        {"email": 1, "role": 1, "permissions": 1, "_id": 0}
    ).sort("email", 1))

    return jsonify(users), 200


@solicitacoes_routes.route("/solicitacoes", methods=["POST"])
@role_required("solicitante")
def criar_solicitacao():
    data = request.get_json(silent=True) or {}

    remetente = request.current_user["email"]
    destinatario = (data.get("destinatario") or "").strip().lower()
    numero_oficio = (data.get("numero_oficio") or "").strip()
    nome_documento = (data.get("nome_documento") or "").strip()
    interessado = (data.get("interessado") or "").strip()
    secretaria = (data.get("secretaria") or "").strip().upper()
    setor_destino = (data.get("setor_destino") or "").strip()
    observacao = (data.get("observacao") or "").strip()
    modulo = (data.get("modulo") or "").strip().lower()

    if not destinatario or not numero_oficio or not nome_documento or not secretaria or not setor_destino:
        return jsonify({
            "error": "Destinatário, número do ofício, nome do documento, secretaria e setor são obrigatórios"
        }), 400

    if destinatario == remetente:
        return jsonify({"error": "Selecione outro usuário para confirmar o recebimento"}), 400

    if not db.users.find_one({"email": destinatario}):
        return jsonify({"error": "Usuário destinatário não encontrado"}), 404

    secretaria_doc = db.secretarias.find_one({"sigla": secretaria, "ativa": True})
    if not secretaria_doc:
        return jsonify({"error": "Secretaria inexistente ou inativa"}), 400

    now = agora_fortaleza()
    protocolo = gerar_protocolo(now)

    solicitacao = {
        "protocolo": protocolo,
        "numero_oficio": numero_oficio,
        "nome_documento": nome_documento,
        "interessado": interessado or None,
        "remetente": remetente,
        "destinatario": destinatario,
        "secretaria": secretaria,
        "departamento": secretaria,
        "setor_destino": setor_destino,
        "observacao": observacao or None,
        "modulo": modulo or None,
        "status": "pendente_aceite",
        "situacao": "Pendente de Aceite",
        "criado_em": now,
        "dia": now.day,
        "mes": now.month,
        "ano": now.year,
        "hora": now.strftime("%H:%M"),
        "aceito_em": None,
        "aceito_por": None,
    }

    result = db.solicitacoes.insert_one(solicitacao)

    registrar_auditoria(
        "criar_protocolo_recebimento",
        remetente,
        {
            "solicitacao_id": str(result.inserted_id),
            "protocolo": protocolo,
            "numero_oficio": numero_oficio,
            "nome_documento": nome_documento,
            "destinatario": destinatario,
            "secretaria": secretaria,
            "setor_destino": setor_destino,
            "situacao": "Pendente de Aceite",
        }
    )

    return jsonify({
        "msg": "Protocolo de recebimento enviado com sucesso",
        "protocolo": protocolo,
        "situacao": "Pendente de Aceite",
    }), 201


@solicitacoes_routes.route("/solicitacoes", methods=["GET"])
@login_required
def listar_solicitacoes():
    destinatario = (request.args.get("destinatario") or "").strip().lower()

    if not destinatario:
        destinatario = request.current_user["email"]

    if destinatario != request.current_user["email"] and request.current_user.get("role") != "admin":
        return jsonify({"error": "Você não pode consultar notificações de outro usuário"}), 403

    docs = list(db.solicitacoes.find({
        "destinatario": destinatario,
        "status": "pendente_aceite"
    }).sort("criado_em", -1))

    for d in docs:
        d["_id"] = str(d["_id"])
        for campo in ("criado_em", "aceito_em", "atualizado_em", "cancelado_em", "recusado_em", "reencaminhado_em"):
            if d.get(campo):
                d[campo] = data_iso_fortaleza(d[campo])

    return jsonify(docs), 200


@solicitacoes_routes.route("/solicitacoes/<id>/confirmar-recebimento", methods=["POST"])
@login_required
def confirmar_recebimento(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "Identificador inválido"}), 400

    solicitacao = db.solicitacoes.find_one({"_id": ObjectId(id)})
    if not solicitacao:
        return jsonify({"error": "Protocolo não encontrado"}), 404

    usuario = request.current_user["email"]
    if solicitacao.get("destinatario") != usuario:
        return jsonify({"error": "Este protocolo foi direcionado para outro usuário"}), 403

    if solicitacao.get("status") != "pendente_aceite":
        return jsonify({"error": "Este protocolo já teve o aceite confirmado"}), 409

    now = agora_fortaleza()
    update = db.solicitacoes.update_one(
        {"_id": ObjectId(id), "status": "pendente_aceite"},
        {"$set": {
            "status": "aceite_confirmado",
            "situacao": "Aceite Confirmado",
            "aceito_em": now,
            "aceito_por": usuario,
        }}
    )

    if update.modified_count == 0:
        return jsonify({"error": "Não foi possível confirmar o recebimento"}), 409

    registrar_auditoria(
        "confirmar_recebimento_protocolo",
        usuario,
        {
            "solicitacao_id": id,
            "protocolo": solicitacao.get("protocolo"),
            "numero_oficio": solicitacao.get("numero_oficio"),
            "nome_documento": solicitacao.get("nome_documento"),
            "remetente": solicitacao.get("remetente"),
            "secretaria": solicitacao.get("secretaria"),
            "setor_destino": solicitacao.get("setor_destino"),
            "situacao": "Aceite Confirmado",
        }
    )

    return jsonify({
        "msg": "Recebimento confirmado com sucesso",
        "protocolo": solicitacao.get("protocolo"),
        "numero_oficio": solicitacao.get("numero_oficio"),
        "situacao": "Aceite Confirmado",
        "aceito_por": usuario,
        "aceito_em": now.isoformat(),
    }), 200



def _pode_gerenciar_protocolo(doc, usuario_atual):
    """A recepção pode gerenciar apenas o que cadastrou; o administrador pode gerenciar todos."""
    return (
        usuario_atual.get("role") == "admin"
        or doc.get("remetente") == usuario_atual.get("email")
    )


@solicitacoes_routes.route("/solicitacoes/<id>", methods=["PATCH"])
@login_required
def editar_solicitacao(id):
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito à recepção e ao administrador"}), 403

    if not ObjectId.is_valid(id):
        return jsonify({"error": "Identificador inválido"}), 400

    solicitacao = db.solicitacoes.find_one({"_id": ObjectId(id)})
    if not solicitacao:
        return jsonify({"error": "Protocolo não encontrado"}), 404

    if not _pode_gerenciar_protocolo(solicitacao, request.current_user):
        return jsonify({"error": "Você não pode editar este protocolo"}), 403

    if solicitacao.get("status") != "pendente_aceite":
        return jsonify({
            "error": "Somente protocolos pendentes de aceite podem ser editados"
        }), 409

    data = request.get_json(silent=True) or {}

    campos = {
        "numero_oficio": (data.get("numero_oficio") or "").strip(),
        "nome_documento": (data.get("nome_documento") or "").strip(),
        "interessado": (data.get("interessado") or "").strip() or None,
        "secretaria": (data.get("secretaria") or "").strip().upper(),
        "setor_destino": (data.get("setor_destino") or "").strip(),
        "destinatario": (data.get("destinatario") or "").strip().lower(),
        "observacao": (data.get("observacao") or "").strip() or None,
    }

    obrigatorios = (
        "numero_oficio",
        "nome_documento",
        "secretaria",
        "setor_destino",
        "destinatario",
    )
    if any(not campos[campo] for campo in obrigatorios):
        return jsonify({
            "error": "Número do ofício, documento, secretaria, setor e destinatário são obrigatórios"
        }), 400

    if campos["destinatario"] == solicitacao.get("remetente"):
        return jsonify({
            "error": "O destinatário deve ser diferente do usuário que cadastrou"
        }), 400

    if not db.users.find_one({"email": campos["destinatario"]}):
        return jsonify({"error": "Usuário destinatário não encontrado"}), 404

    secretaria_doc = db.secretarias.find_one({
        "sigla": campos["secretaria"],
        "ativa": True,
    })
    if not secretaria_doc:
        return jsonify({"error": "Secretaria inexistente ou inativa"}), 400

    alteracoes = {}
    for campo, novo_valor in campos.items():
        valor_anterior = solicitacao.get(campo)
        if valor_anterior != novo_valor:
            alteracoes[campo] = {
                "anterior": valor_anterior,
                "novo": novo_valor,
            }

    if not alteracoes:
        return jsonify({"msg": "Nenhuma alteração foi identificada"}), 200

    now = agora_fortaleza()
    db.solicitacoes.update_one(
        {"_id": ObjectId(id), "status": "pendente_aceite"},
        {
            "$set": {
                **campos,
                "atualizado_em": now,
                "atualizado_por": request.current_user["email"],
            },
            "$push": {
                "historico_edicoes": {
                    "acao": "Protocolo editado",
                    "usuario": request.current_user["email"],
                    "data_hora": now,
                    "alteracoes": alteracoes,
                    "situacao": "Pendente de Aceite",
                }
            },
        },
    )

    registrar_auditoria(
        "editar_protocolo_recebimento",
        request.current_user["email"],
        {
            "solicitacao_id": id,
            "protocolo": solicitacao.get("protocolo"),
            "alteracoes": alteracoes,
        },
    )

    return jsonify({
        "msg": "Protocolo atualizado com sucesso",
        "protocolo": solicitacao.get("protocolo"),
    }), 200


@solicitacoes_routes.route("/solicitacoes/<id>/cancelar", methods=["POST"])
@login_required
def cancelar_solicitacao(id):
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito à recepção e ao administrador"}), 403

    if not ObjectId.is_valid(id):
        return jsonify({"error": "Identificador inválido"}), 400

    solicitacao = db.solicitacoes.find_one({"_id": ObjectId(id)})
    if not solicitacao:
        return jsonify({"error": "Protocolo não encontrado"}), 404

    if not _pode_gerenciar_protocolo(solicitacao, request.current_user):
        return jsonify({"error": "Você não pode cancelar este protocolo"}), 403

    if solicitacao.get("status") != "pendente_aceite":
        return jsonify({
            "error": "Somente protocolos pendentes de aceite podem ser cancelados"
        }), 409

    data = request.get_json(silent=True) or {}
    justificativa = (data.get("justificativa") or "").strip()

    if len(justificativa) < 5:
        return jsonify({
            "error": "Informe uma justificativa de cancelamento com pelo menos 5 caracteres"
        }), 400

    now = agora_fortaleza()
    resultado = db.solicitacoes.update_one(
        {"_id": ObjectId(id), "status": "pendente_aceite"},
        {
            "$set": {
                "status": "cancelado",
                "situacao": "Cancelado",
                "cancelado_em": now,
                "cancelado_por": request.current_user["email"],
                "justificativa_cancelamento": justificativa,
            },
            "$push": {
                "historico_edicoes": {
                    "acao": "Protocolo cancelado",
                    "usuario": request.current_user["email"],
                    "data_hora": now,
                    "justificativa": justificativa,
                    "situacao": "Cancelado",
                }
            },
        },
    )

    if resultado.modified_count == 0:
        return jsonify({"error": "Não foi possível cancelar o protocolo"}), 409

    registrar_auditoria(
        "cancelar_protocolo_recebimento",
        request.current_user["email"],
        {
            "solicitacao_id": id,
            "protocolo": solicitacao.get("protocolo"),
            "justificativa": justificativa,
            "situacao": "Cancelado",
        },
    )

    return jsonify({
        "msg": "Protocolo cancelado com sucesso",
        "protocolo": solicitacao.get("protocolo"),
        "situacao": "Cancelado",
    }), 200




@solicitacoes_routes.route("/solicitacoes/<id>/recusar", methods=["POST"])
@login_required
def recusar_solicitacao(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "Identificador inválido"}), 400

    solicitacao = db.solicitacoes.find_one({"_id": ObjectId(id)})
    if not solicitacao:
        return jsonify({"error": "Protocolo não encontrado"}), 404

    usuario = request.current_user["email"]
    if solicitacao.get("destinatario") != usuario:
        return jsonify({"error": "Este protocolo foi direcionado para outro usuário"}), 403

    if solicitacao.get("status") != "pendente_aceite":
        return jsonify({"error": "Somente protocolos pendentes podem ser recusados"}), 409

    data = request.get_json(silent=True) or {}
    justificativa = (data.get("justificativa") or "").strip()
    if len(justificativa) < 5:
        return jsonify({"error": "Informe uma justificativa com pelo menos 5 caracteres"}), 400

    now = agora_fortaleza()
    resultado = db.solicitacoes.update_one(
        {"_id": ObjectId(id), "status": "pendente_aceite"},
        {
            "$set": {
                "status": "recusado_destinatario",
                "situacao": "Recusado pelo Destinatário",
                "recusado_em": now,
                "recusado_por": usuario,
                "justificativa_recusa": justificativa,
            },
            "$push": {
                "historico_edicoes": {
                    "acao": "Recebimento recusado",
                    "usuario": usuario,
                    "data_hora": now,
                    "justificativa": justificativa,
                    "situacao": "Recusado pelo Destinatário",
                }
            },
        },
    )
    if resultado.modified_count == 0:
        return jsonify({"error": "Não foi possível recusar o protocolo"}), 409

    registrar_auditoria("recusar_protocolo_recebimento", usuario, {
        "solicitacao_id": id,
        "protocolo": solicitacao.get("protocolo"),
        "numero_oficio": solicitacao.get("numero_oficio"),
        "justificativa": justificativa,
        "situacao": "Recusado pelo Destinatário",
    })

    return jsonify({
        "msg": "Recebimento recusado e devolvido à recepção",
        "protocolo": solicitacao.get("protocolo"),
        "situacao": "Recusado pelo Destinatário",
    }), 200


@solicitacoes_routes.route("/solicitacoes/<id>/reencaminhar", methods=["POST"])
@login_required
def reencaminhar_solicitacao(id):
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito à recepção e ao administrador"}), 403
    if not ObjectId.is_valid(id):
        return jsonify({"error": "Identificador inválido"}), 400

    solicitacao = db.solicitacoes.find_one({"_id": ObjectId(id)})
    if not solicitacao:
        return jsonify({"error": "Protocolo não encontrado"}), 404
    if not _pode_gerenciar_protocolo(solicitacao, request.current_user):
        return jsonify({"error": "Você não pode reencaminhar este protocolo"}), 403
    if solicitacao.get("status") != "recusado_destinatario":
        return jsonify({"error": "Somente protocolos recusados podem ser reencaminhados"}), 409

    data = request.get_json(silent=True) or {}
    novo_destinatario = (data.get("destinatario") or "").strip().lower()
    novo_setor = (data.get("setor_destino") or "").strip()
    secretaria = (data.get("secretaria") or solicitacao.get("secretaria") or "").strip().upper()
    observacao = (data.get("observacao") or solicitacao.get("observacao") or "").strip() or None

    if not novo_destinatario or not novo_setor or not secretaria:
        return jsonify({"error": "Destinatário, secretaria e setor são obrigatórios"}), 400
    if novo_destinatario == solicitacao.get("remetente"):
        return jsonify({"error": "O destinatário deve ser diferente de quem cadastrou"}), 400
    if not db.users.find_one({"email": novo_destinatario}):
        return jsonify({"error": "Usuário destinatário não encontrado"}), 404
    if not db.secretarias.find_one({"sigla": secretaria, "ativa": True}):
        return jsonify({"error": "Secretaria inexistente ou inativa"}), 400

    now = agora_fortaleza()
    usuario = request.current_user["email"]
    destinatario_anterior = solicitacao.get("destinatario")
    setor_anterior = solicitacao.get("setor_destino")
    quantidade = int(solicitacao.get("quantidade_reencaminhamentos") or 0) + 1

    resultado = db.solicitacoes.update_one(
        {"_id": ObjectId(id), "status": "recusado_destinatario"},
        {
            "$set": {
                "status": "pendente_aceite",
                "situacao": "Pendente de Aceite",
                "destinatario": novo_destinatario,
                "setor_destino": novo_setor,
                "secretaria": secretaria,
                "departamento": secretaria,
                "observacao": observacao,
                "reencaminhado_em": now,
                "reencaminhado_por": usuario,
                "quantidade_reencaminhamentos": quantidade,
                "recusado_em": None,
                "recusado_por": None,
                "justificativa_recusa": None,
            },
            "$push": {
                "historico_edicoes": {
                    "acao": "Protocolo corrigido e reencaminhado",
                    "usuario": usuario,
                    "data_hora": now,
                    "situacao": "Pendente de Aceite",
                    "alteracoes": {
                        "destinatario": {"anterior": destinatario_anterior, "novo": novo_destinatario},
                        "setor_destino": {"anterior": setor_anterior, "novo": novo_setor},
                    },
                }
            },
        },
    )
    if resultado.modified_count == 0:
        return jsonify({"error": "Não foi possível reencaminhar o protocolo"}), 409

    registrar_auditoria("reencaminhar_protocolo_recebimento", usuario, {
        "solicitacao_id": id,
        "protocolo": solicitacao.get("protocolo"),
        "destinatario_anterior": destinatario_anterior,
        "novo_destinatario": novo_destinatario,
        "setor_anterior": setor_anterior,
        "novo_setor": novo_setor,
        "quantidade_reencaminhamentos": quantidade,
    })

    return jsonify({
        "msg": "Protocolo corrigido e reencaminhado com sucesso",
        "protocolo": solicitacao.get("protocolo"),
        "situacao": "Pendente de Aceite",
        "quantidade_reencaminhamentos": quantidade,
    }), 200


# Compatibilidade com versões anteriores do frontend.
@solicitacoes_routes.route("/solicitacoes/<id>/processar", methods=["POST"])
@login_required
def processar_solicitacao(id):
    return confirmar_recebimento(id)


def _serializar_solicitacao(doc):
    item = dict(doc)
    item["_id"] = str(item["_id"])
    for campo in ("criado_em", "aceito_em", "atualizado_em", "cancelado_em", "recusado_em", "reencaminhado_em"):
        if item.get(campo):
            item[campo] = data_iso_fortaleza(item[campo])
    return item


def _filtro_controle_protocolos(request_args, usuario_atual):
    filtro = {}

    # A recepção enxerga os protocolos que cadastrou. O administrador pode consultar todos.
    if usuario_atual.get("role") != "admin":
        filtro["remetente"] = usuario_atual["email"]

    protocolo = (request_args.get("protocolo") or "").strip()
    numero_oficio = (request_args.get("numero_oficio") or "").strip()
    interessado = (request_args.get("interessado") or "").strip()
    secretaria = (request_args.get("secretaria") or "").strip().upper()
    setor = (request_args.get("setor") or "").strip()
    cadastrado_por = (request_args.get("cadastrado_por") or "").strip().lower()
    aceito_por = (request_args.get("aceito_por") or "").strip().lower()
    situacao = (request_args.get("situacao") or "").strip().lower()
    data_inicial = (request_args.get("data_inicial") or "").strip()
    data_final = (request_args.get("data_final") or "").strip()

    if protocolo:
        filtro["protocolo"] = {"$regex": protocolo, "$options": "i"}
    if numero_oficio:
        filtro["numero_oficio"] = {"$regex": numero_oficio, "$options": "i"}
    if interessado:
        filtro["interessado"] = {"$regex": interessado, "$options": "i"}
    if secretaria:
        filtro["secretaria"] = secretaria
    if setor:
        filtro["setor_destino"] = {"$regex": setor, "$options": "i"}
    if cadastrado_por and usuario_atual.get("role") == "admin":
        filtro["remetente"] = cadastrado_por
    if aceito_por:
        filtro["aceito_por"] = aceito_por
    if situacao in {"pendente_aceite", "aceite_confirmado", "cancelado", "recusado_destinatario"}:
        filtro["status"] = situacao

    periodo = {}
    tz = TZ_FORTALEZA
    try:
        if data_inicial:
            inicio = tz.localize(datetime.strptime(data_inicial, "%Y-%m-%d"))
            periodo["$gte"] = inicio
        if data_final:
            fim = tz.localize(datetime.strptime(data_final, "%Y-%m-%d").replace(hour=23, minute=59, second=59))
            periodo["$lte"] = fim
    except ValueError:
        raise ValueError("Datas inválidas. Use o formato AAAA-MM-DD")

    if periodo:
        filtro["criado_em"] = periodo

    return filtro


@solicitacoes_routes.route("/controle-protocolos", methods=["GET"])
@login_required
def controle_protocolos():
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito à recepção e ao administrador"}), 403

    try:
        filtro = _filtro_controle_protocolos(request.args, request.current_user)
    except ValueError as erro:
        return jsonify({"error": str(erro)}), 400

    docs = list(db.solicitacoes.find(filtro).sort("criado_em", -1).limit(1000))
    agora = agora_fortaleza()
    pendentes = 0
    confirmados = 0
    cancelados = 0
    recusados = 0
    atrasados = 0

    itens = []
    for doc in docs:
        if doc.get("status") == "pendente_aceite":
            pendentes += 1
            criado = doc.get("criado_em")
            if criado:
                # PyMongo pode devolver datetime sem tzinfo.
                criado = para_fortaleza(criado)
                dias_pendente = max(0, (agora.date() - criado.date()).days)
            else:
                dias_pendente = 0
            doc["dias_pendente"] = dias_pendente
            if dias_pendente >= 2:
                atrasados += 1
        elif doc.get("status") == "aceite_confirmado":
            confirmados += 1
            doc["dias_pendente"] = 0
        elif doc.get("status") == "cancelado":
            cancelados += 1
            doc["dias_pendente"] = 0
        else:
            recusados += 1
            doc["dias_pendente"] = 0
        itens.append(_serializar_solicitacao(doc))

    return jsonify({
        "resumo": {
            "total": len(itens),
            "pendentes_aceite": pendentes,
            "aceites_confirmados": confirmados,
            "cancelados": cancelados,
            "recusados": recusados,
            "pendentes_mais_2_dias": atrasados,
        },
        "protocolos": itens,
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

    doc = db.solicitacoes.find_one(filtro)
    if not doc:
        return jsonify({"error": "Protocolo não encontrado"}), 404

    historico = [{
        "acao": "Protocolo cadastrado e encaminhado",
        "usuario": doc.get("remetente"),
        "data_hora": data_iso_fortaleza(doc.get("criado_em")),
        "situacao": "Pendente de Aceite",
    }]
    for evento in doc.get("historico_edicoes", []):
        historico.append({
            "acao": evento.get("acao"),
            "usuario": evento.get("usuario"),
            "data_hora": data_iso_fortaleza(evento.get("data_hora")),
            "situacao": evento.get("situacao"),
            "justificativa": evento.get("justificativa"),
            "alteracoes": evento.get("alteracoes"),
        })

    if doc.get("aceito_em"):
        historico.append({
            "acao": "Recebimento confirmado",
            "usuario": doc.get("aceito_por"),
            "data_hora": data_iso_fortaleza(doc.get("aceito_em")),
            "situacao": "Aceite Confirmado",
        })

    historico.sort(key=lambda item: item.get("data_hora") or "")

    item = _serializar_solicitacao(doc)
    item["historico"] = historico
    return jsonify(item), 200


@solicitacoes_routes.route("/controle-protocolos/exportar.csv", methods=["GET"])
@login_required
def exportar_controle_protocolos():
    if request.current_user.get("role") not in {"solicitante", "admin"}:
        return jsonify({"error": "Acesso restrito"}), 403

    import csv
    import io
    from flask import Response

    try:
        filtro = _filtro_controle_protocolos(request.args, request.current_user)
    except ValueError as erro:
        return jsonify({"error": str(erro)}), 400

    docs = list(db.solicitacoes.find(filtro).sort("criado_em", -1).limit(5000))
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow([
        "Protocolo", "Numero do oficio", "Nome do documento", "Interessado",
        "Secretaria", "Setor", "Cadastrado por", "Destinatario", "Situacao",
        "Aceito por", "Data de cadastro", "Data do aceite", "Cancelado por", "Data do cancelamento", "Justificativa do cancelamento", "Recusado por", "Data da recusa", "Justificativa da recusa", "Reencaminhamentos"
    ])
    for doc in docs:
        writer.writerow([
            doc.get("protocolo", ""), doc.get("numero_oficio", ""),
            doc.get("nome_documento", ""), doc.get("interessado", ""),
            doc.get("secretaria", ""), doc.get("setor_destino", ""),
            doc.get("remetente", ""), doc.get("destinatario", ""),
            doc.get("situacao", ""), doc.get("aceito_por", ""),
            data_csv_fortaleza(doc.get("criado_em")),
            data_csv_fortaleza(doc.get("aceito_em")),
            doc.get("cancelado_por", ""),
            data_csv_fortaleza(doc.get("cancelado_em")),
            doc.get("justificativa_cancelamento", ""),
            doc.get("recusado_por", ""),
            data_csv_fortaleza(doc.get("recusado_em")),
            doc.get("justificativa_recusa", ""),
            doc.get("quantidade_reencaminhamentos", 0),
        ])

    conteudo = "\ufeff" + buffer.getvalue()
    return Response(
        conteudo,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=controle_protocolos.csv"},
    )
