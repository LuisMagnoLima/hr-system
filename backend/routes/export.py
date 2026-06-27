from flask import Blueprint, send_file
from pymongo import MongoClient
from openpyxl import Workbook
from io import BytesIO

from config import MONGO_URI, DB_NAME
from utils.permission_utils import permission_required

export_routes = Blueprint("export", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]


@export_routes.route("/export/excel", methods=["GET"])
@permission_required("banco_dados", "financeiro")
def exportar_excel():

    docs = list(db.documents.find())

    wb = Workbook()
    ws = wb.active
    ws.title = "Documentos"

    ws.append([
        "Nome",
        "Tipo",
        "Departamento",
        "Módulo",
        "Anexado por",
        "Confirmado",
        "Dia",
        "Mês",
        "Ano",
        "Hora"
    ])

    for doc in docs:
        ws.append([
            doc.get("nome"),
            doc.get("tipo"),
            doc.get("departamento"),
            doc.get("modulo"),
            doc.get("anexado_por"),
            "Sim" if doc.get("confirmado_financeiro") else "Não",
            doc.get("dia"),
            doc.get("mes"),
            doc.get("ano"),
            doc.get("hora")
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        download_name="documentos.xlsx",
        as_attachment=True,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )