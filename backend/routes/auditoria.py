from math import ceil

from flask import Blueprint, request, jsonify
from utils.permission_utils import role_required
from database import get_database


auditoria_routes = Blueprint("auditoria", __name__)
db = get_database()


@auditoria_routes.route("/auditoria", methods=["GET"])
@role_required("admin")
def listar_auditoria():
    usuario = (request.args.get("usuario") or "").strip()
    acao = (request.args.get("acao") or "").strip()
    data = (request.args.get("data") or "").strip()

    try:
        limite = int(request.args.get("limite", 100))
        pagina = max(1, int(request.args.get("pagina", 1)))
    except (TypeError, ValueError):
        return jsonify({"error": "Parâmetros de paginação inválidos"}), 400

    limites_permitidos = {0, 100, 300, 500, 1000}
    if limite not in limites_permitidos:
        return jsonify({
            "error": "Limite inválido. Use 0, 100, 300, 500 ou 1000."
        }), 400

    filtro = {}

    if usuario:
        filtro["usuario"] = {"$regex": usuario, "$options": "i"}

    if acao:
        filtro["acao"] = acao

    if data:
        try:
            ano, mes, dia = (int(valor) for valor in data.split("-"))
            filtro.update({"ano": ano, "mes": mes, "dia": dia})
        except (TypeError, ValueError):
            return jsonify({"error": "Data inválida. Use o formato AAAA-MM-DD."}), 400

    total = db.auditoria.count_documents(filtro)
    consulta = db.auditoria.find(filtro).sort("data_hora", -1)

    if limite > 0:
        total_paginas = max(1, ceil(total / limite)) if total else 1
        pagina = min(pagina, total_paginas)
        consulta = consulta.skip((pagina - 1) * limite).limit(limite)
    else:
        total_paginas = 1
        pagina = 1

    logs = list(consulta)

    for log in logs:
        log["_id"] = str(log["_id"])

    inicio = 0 if total == 0 else ((pagina - 1) * limite + 1 if limite > 0 else 1)
    fim = min(pagina * limite, total) if limite > 0 else total

    return jsonify({
        "logs": logs,
        "pagina": pagina,
        "limite": limite,
        "total": total,
        "total_paginas": total_paginas,
        "inicio": inicio,
        "fim": fim,
    }), 200
