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

    # limite=0 significa carregar todos os registros.
    try:
        limite = int(request.args.get("limite", 100))
    except (TypeError, ValueError):
        return jsonify({"error": "Limite inválido"}), 400

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

    consulta = db.auditoria.find(filtro).sort("data_hora", -1)

    if limite > 0:
        consulta = consulta.limit(limite)

    logs = list(consulta)

    for log in logs:
        log["_id"] = str(log["_id"])

    return jsonify(logs), 200
