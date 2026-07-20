import os
import shutil
from datetime import datetime, timedelta
import pytz
from utils.audit_utils import registrar_auditoria
from config import UPLOAD_FOLDER
from database import get_database

db = get_database()

tz = pytz.timezone("America/Fortaleza")


def agora():
    return datetime.now(tz)


def arquivar_documentos_antigos():
    """
    Move documentos com mais de 5 anos para a coleção arquivamentos
    e move o PDF para a pasta uploads/arquivados.
    """
    limite_arquivamento = agora() - timedelta(days=5 * 365)

    docs_antigos = list(db.documents.find({
        "data_envio": {"$lt": limite_arquivamento},
        "protegido_exclusao": {"$ne": True}
    }))

    arquivados = 0

    pasta_arquivados = os.path.join(UPLOAD_FOLDER, "arquivados")
    os.makedirs(pasta_arquivados, exist_ok=True)

    for doc in docs_antigos:
        arquivo = doc.get("arquivo")

        if arquivo:
            origem = os.path.join(UPLOAD_FOLDER, arquivo)
            destino = os.path.join(pasta_arquivados, os.path.basename(arquivo))

            if os.path.exists(origem):
                shutil.move(origem, destino)
                doc["arquivo"] = f"arquivados/{os.path.basename(arquivo)}"

        doc["status_arquivo"] = "arquivado"
        doc["data_arquivamento"] = agora()
        doc["documento_original_id"] = str(doc["_id"])

        db.arquivamentos.insert_one(doc)
        db.documents.delete_one({"_id": doc["_id"]})
        registrar_auditoria(
        "arquivar_documento",
         "sistema",
            {
        "nome": doc.get("nome"),
        "arquivo": doc.get("arquivo"),
        "departamento": doc.get("departamento"),
        "modulo": doc.get("modulo")
         }
)

        arquivados += 1

    print(f"📦 Arquivamento concluído. {arquivados} documento(s) arquivado(s).")


def excluir_arquivamentos_expirados():
    """
    Apaga definitivamente documentos arquivados há mais de 6 meses.
    """
    limite_exclusao = agora() - timedelta(days=180)

    docs_expirados = list(db.arquivamentos.find({
        "data_arquivamento": {"$lt": limite_exclusao}
    }))

    removidos = 0

    for doc in docs_expirados:
        arquivo = doc.get("arquivo")

        if arquivo:
            caminho = os.path.join(UPLOAD_FOLDER, arquivo)

            if os.path.exists(caminho):
                try:
                    os.remove(caminho)
                except Exception as e:
                    print(f"Erro ao remover arquivo arquivado {arquivo}: {e}")
                    continue

        db.arquivamentos.delete_one({"_id": doc["_id"]})

        registrar_auditoria(
    "excluir_arquivamento_definitivo",
    "sistema",
    {
        "nome": doc.get("nome"),
        "arquivo": doc.get("arquivo"),
        "departamento": doc.get("departamento"),
        "modulo": doc.get("modulo")
    }
)
        removidos += 1

    print(f"🗑️ Exclusão definitiva concluída. {removidos} arquivamento(s) removido(s).")


def rotina_arquivamento():
    arquivar_documentos_antigos()
    excluir_arquivamentos_expirados()
