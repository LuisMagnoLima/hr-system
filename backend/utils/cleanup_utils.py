import calendar
import os
import shutil
from datetime import datetime

import pytz

from config import UPLOAD_FOLDER
from database import get_database
from utils.audit_utils import registrar_auditoria


db = get_database()
tz = pytz.timezone("America/Fortaleza")


def agora():
    return datetime.now(tz)


def adicionar_meses(data, meses):
    indice = data.month - 1 + meses
    ano = data.year + indice // 12
    mes = indice % 12 + 1
    dia = min(data.day, calendar.monthrange(ano, mes)[1])
    return data.replace(year=ano, month=mes, day=dia)


def subtrair_anos(data, anos):
    try:
        return data.replace(year=data.year - anos)
    except ValueError:
        return data.replace(year=data.year - anos, month=2, day=28)


def arquivar_documento(doc, usuario="sistema", motivo="Prazo de retenção de 5 anos concluído"):
    """Move um documento ativo para Arquivados sem apagar o PDF."""
    pasta_arquivados = os.path.join(UPLOAD_FOLDER, "arquivados")
    os.makedirs(pasta_arquivados, exist_ok=True)

    documento = dict(doc)
    arquivo = documento.get("arquivo")

    if arquivo and not arquivo.startswith("arquivados/"):
        origem = os.path.realpath(os.path.join(UPLOAD_FOLDER, arquivo))
        nome_base = os.path.basename(arquivo)
        destino = os.path.join(pasta_arquivados, nome_base)

        # Evita sobrescrever um arquivo com o mesmo nome.
        if os.path.exists(destino) and os.path.realpath(destino) != origem:
            raiz, ext = os.path.splitext(nome_base)
            destino = os.path.join(pasta_arquivados, f"{raiz}_{documento['_id']}{ext}")

        if os.path.isfile(origem):
            shutil.move(origem, destino)
            documento["arquivo"] = f"arquivados/{os.path.basename(destino)}"

    data_arquivamento = agora()
    documento["status"] = "arquivado"
    documento["status_arquivo"] = "arquivado"
    documento["data_arquivamento"] = data_arquivamento
    documento["data_exclusao_definitiva"] = adicionar_meses(data_arquivamento, 6)
    documento["documento_original_id"] = str(documento["_id"])
    documento["motivo_arquivamento"] = motivo
    documento["arquivado_por"] = usuario

    db.arquivamentos.replace_one({"_id": documento["_id"]}, documento, upsert=True)
    db.documents.delete_one({"_id": documento["_id"]})

    registrar_auditoria("arquivar_documento", usuario, {
        "documento_id": str(documento["_id"]),
        "nome": documento.get("nome"),
        "arquivo": documento.get("arquivo"),
        "departamento": documento.get("departamento"),
        "modulo": documento.get("modulo"),
        "motivo": motivo,
        "exclusao_definitiva_em": documento["data_exclusao_definitiva"].isoformat(),
    })
    return documento


def arquivar_documentos_antigos():
    """Move para Arquivados os documentos cuja data de envio completou 5 anos."""
    limite_arquivamento = subtrair_anos(agora(), 5)
    docs_antigos = list(db.documents.find({
        "data_envio": {"$lte": limite_arquivamento},
    }))

    for doc in docs_antigos:
        arquivar_documento(doc)

    print(f"Arquivamento concluído. {len(docs_antigos)} documento(s) arquivado(s).")


def excluir_arquivamento_definitivamente(doc, usuario="sistema"):
    """Apaga o PDF e os metadados de um item já arquivado."""
    arquivo = doc.get("arquivo")
    if arquivo:
        pasta_base = os.path.realpath(UPLOAD_FOLDER)
        caminho = os.path.realpath(os.path.join(pasta_base, arquivo))
        if caminho.startswith(pasta_base + os.sep) and os.path.isfile(caminho):
            os.remove(caminho)

    db.arquivamentos.delete_one({"_id": doc["_id"]})
    registrar_auditoria("excluir_arquivamento_definitivo", usuario, {
        "documento_id": str(doc["_id"]),
        "nome": doc.get("nome"),
        "arquivo": doc.get("arquivo"),
        "departamento": doc.get("departamento"),
        "modulo": doc.get("modulo"),
    })


def excluir_arquivamentos_expirados():
    """Apaga definitivamente itens que completaram 6 meses em Arquivados."""
    now = agora()
    docs_expirados = list(db.arquivamentos.find({
        "$or": [
            {"data_exclusao_definitiva": {"$lte": now}},
            {
                "data_exclusao_definitiva": {"$exists": False},
                "data_arquivamento": {"$lte": adicionar_meses(now, -6)},
            },
        ]
    }))

    removidos = 0
    for doc in docs_expirados:
        try:
            excluir_arquivamento_definitivamente(doc)
            removidos += 1
        except Exception as exc:
            print(f"Erro ao excluir arquivamento {doc.get('_id')}: {exc}")

    print(f"Exclusão definitiva concluída. {removidos} arquivamento(s) removido(s).")


def rotina_arquivamento():
    arquivar_documentos_antigos()
    excluir_arquivamentos_expirados()
