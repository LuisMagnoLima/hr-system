import os
import shutil
from datetime import datetime, timezone

import pytz
from bson import ObjectId
from bson.binary import Binary
from flask import Blueprint, jsonify, current_app, request

from database import get_database
from utils.permission_utils import permission_required, role_required
from utils.audit_utils import registrar_auditoria
from utils.cleanup_utils import adicionar_meses, excluir_arquivamento_definitivamente

arquivamentos_routes = Blueprint("arquivamentos", __name__)

db = get_database()
FORTALEZA_TZ = pytz.timezone("America/Fortaleza")


def agora_fortaleza():
    return datetime.now(FORTALEZA_TZ)


def _datetime_fortaleza(valor):
    """Normaliza datas do MongoDB para Fortaleza.

    O PyMongo normalmente devolve datetimes sem tzinfo (UTC). Comparar essas
    datas com datetime timezone-aware causava o erro 500 na listagem.
    """
    if not isinstance(valor, datetime):
        return valor
    if valor.tzinfo is None:
        valor = valor.replace(tzinfo=timezone.utc)
    return valor.astimezone(FORTALEZA_TZ)


def _serializar_bson(valor):
    """Converte recursivamente tipos BSON/Python para JSON seguro."""
    if isinstance(valor, ObjectId):
        return str(valor)
    if isinstance(valor, datetime):
        return _datetime_fortaleza(valor).isoformat()
    if isinstance(valor, (bytes, bytearray, Binary)):
        # O conteúdo binário do PDF nunca deve ser retornado nessa listagem.
        return None
    if isinstance(valor, dict):
        return {
            chave: _serializar_bson(conteudo)
            for chave, conteudo in valor.items()
            if chave != "arquivo_dados"
        }
    if isinstance(valor, (list, tuple)):
        return [_serializar_bson(item) for item in valor]
    return valor


@arquivamentos_routes.route("/arquivamentos", methods=["GET"])
@permission_required("banco_dados")
def listar_arquivamentos():
    try:
        # Exclui possíveis PDFs antigos salvos como Binary dentro do MongoDB.
        docs = list(
            db.arquivamentos
            .find({}, {"arquivo_dados": 0})
            .sort("data_arquivamento", -1)
        )

        now = agora_fortaleza()
        resposta = []

        for documento in docs:
            data_arquivamento = _datetime_fortaleza(documento.get("data_arquivamento"))
            data_exclusao = _datetime_fortaleza(documento.get("data_exclusao_definitiva"))

            if not data_exclusao and data_arquivamento:
                data_exclusao = adicionar_meses(data_arquivamento, 6)

            documento["data_arquivamento"] = data_arquivamento
            documento["data_exclusao_definitiva"] = data_exclusao
            documento["segundos_restantes"] = (
                max(0, int((data_exclusao - now).total_seconds()))
                if data_exclusao else None
            )
            resposta.append(_serializar_bson(documento))

        return jsonify(resposta), 200
    except Exception as exc:
        current_app.logger.exception("Erro ao listar documentos arquivados")
        return jsonify({
            "error": "Não foi possível carregar os documentos arquivados.",
            "details": str(exc) if current_app.debug else None,
        }), 500


@arquivamentos_routes.route("/arquivamentos/<id>/restaurar", methods=["POST"])
@permission_required("banco_dados")
def restaurar_arquivamento(id):
    if not ObjectId.is_valid(id):
        return jsonify({"error": "ID inválido"}), 400

    object_id = ObjectId(id)
    arquivado = db.arquivamentos.find_one({"_id": object_id})

    if not arquivado:
        return jsonify({"error": "Arquivamento não encontrado"}), 404

    now = agora_fortaleza()
    arquivo = arquivado.get("arquivo")

    try:
        if arquivo and arquivo.startswith("arquivados/"):
            nome_arquivo = os.path.basename(arquivo)
            pasta_upload = current_app.config["UPLOAD_FOLDER"]
            origem = os.path.realpath(os.path.join(pasta_upload, arquivo))
            destino_relativo = os.path.join(
                arquivado.get("departamento", "GERAL"),
                str(now.year),
                str(now.month).zfill(2),
                nome_arquivo,
            ).replace("\\", "/")
            destino = os.path.realpath(os.path.join(pasta_upload, destino_relativo))

            # Garante que origem e destino permaneçam dentro da pasta de uploads.
            pasta_base = os.path.realpath(pasta_upload)
            if not origem.startswith(pasta_base + os.sep) or not destino.startswith(pasta_base + os.sep):
                return jsonify({"error": "Caminho de arquivo inválido"}), 400

            os.makedirs(os.path.dirname(destino), exist_ok=True)
            if os.path.isfile(origem):
                if os.path.exists(destino):
                    raiz, extensao = os.path.splitext(destino)
                    destino = f"{raiz}_{object_id}{extensao}"
                    destino_relativo = os.path.relpath(destino, pasta_base).replace("\\", "/")
                shutil.move(origem, destino)
                arquivado["arquivo"] = destino_relativo

        documento_restaurado = dict(arquivado)
        for campo in (
            "data_arquivamento",
            "documento_original_id",
            "data_exclusao_definitiva",
            "motivo_arquivamento",
            "arquivado_por",
            "segundos_restantes",
        ):
            documento_restaurado.pop(campo, None)

        # Reutiliza o mesmo _id. Como ele foi removido de documents no arquivamento,
        # isso preserva referências e evita criar um documento duplicado.
        documento_restaurado["_id"] = object_id
        documento_restaurado["status"] = (
            "aprovado" if documento_restaurado.get("confirmado_financeiro") else "em_elaboracao"
        )
        documento_restaurado["status_arquivo"] = "ativo"
        documento_restaurado["data_envio"] = now
        documento_restaurado["dia"] = now.day
        documento_restaurado["mes"] = now.month
        documento_restaurado["ano"] = now.year
        documento_restaurado["hora"] = now.strftime("%H:%M")

        # Só remove dos arquivados depois que a restauração foi persistida.
        db.documents.replace_one({"_id": object_id}, documento_restaurado, upsert=True)
        db.arquivamentos.delete_one({"_id": object_id})

        registrar_auditoria(
            "restaurar_arquivamento",
            request.current_user["email"],
            {
                "documento_id": id,
                "nome": documento_restaurado.get("nome"),
                "arquivo": documento_restaurado.get("arquivo"),
                "departamento": documento_restaurado.get("departamento"),
                "modulo": documento_restaurado.get("modulo"),
            },
        )

        return jsonify({"msg": "Documento restaurado com sucesso"}), 200
    except Exception as exc:
        current_app.logger.exception("Erro ao restaurar documento arquivado %s", id)
        return jsonify({
            "error": "Não foi possível restaurar o documento.",
            "details": str(exc) if current_app.debug else None,
        }), 500


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
        current_app.logger.exception("Erro ao excluir arquivo físico arquivado %s", id)
        return jsonify({"error": "Não foi possível apagar o arquivo físico"}), 500

    return jsonify({"msg": "Documento excluído definitivamente"}), 200
