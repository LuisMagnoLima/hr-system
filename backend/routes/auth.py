from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from config import MONGO_URI, DB_NAME
from utils.auth_utils import check_password, generate_token
from utils.audit_utils import registrar_auditoria
auth_routes = Blueprint("auth", __name__)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

@auth_routes.route("/login", methods=["POST"])
def login():
    data = request.json

    user = db.users.find_one({"email": data["email"]})

    if user and check_password(data["password"], user["password"]):
        token = generate_token(user)

        registrar_auditoria(
            "login_sucesso",
            user["email"],
            {"role": user.get("role")}
    )

        return jsonify({"token": token})

    registrar_auditoria(
    "login_falhou",
    data.get("email"),
    {
        "motivo": "Credenciais inválidas",
        "email_tentado": data.get("email")
    },
    status="falha"
)

    return jsonify({"error": "Credenciais inválidas"}), 401