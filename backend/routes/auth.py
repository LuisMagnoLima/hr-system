import re
from flask import Blueprint, request, jsonify, make_response
from config import COOKIE_NAME, COOKIE_SECURE, COOKIE_SAMESITE, TOKEN_HOURS
from utils.auth_utils import check_password, generate_token
from utils.audit_utils import registrar_auditoria
from utils.permission_utils import login_required
from database import get_database

auth_routes = Blueprint("auth", __name__)
db = get_database()
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@auth_routes.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "E-mail e senha devem ser textos"}), 400

    email = email.strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 254 or not 1 <= len(password) <= 256:
        return jsonify({"error": "Credenciais inválidas"}), 401

    user = db.users.find_one({"email": email})
    if user and check_password(password, user["password"]):
        token = generate_token(user)
        registrar_auditoria("login_sucesso", email, {"role": user.get("role")})

        response = make_response(jsonify({
            "msg": "Login realizado com sucesso",
            "user": {
                "email": email,
                "role": user.get("role", "operador"),
                "permissions": user.get("permissions", []),
            },
        }))
        response.set_cookie(
            COOKIE_NAME,
            token,
            max_age=TOKEN_HOURS * 3600,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            path="/",
        )
        return response

    registrar_auditoria("login_falhou", email, {"motivo": "Credenciais inválidas"}, status="falha")
    return jsonify({"error": "Credenciais inválidas"}), 401


@auth_routes.route("/me", methods=["GET"])
@login_required
def me():
    user = request.current_user
    return jsonify({
        "email": user.get("email"),
        "role": user.get("role", "operador"),
        "permissions": user.get("permissions", []),
    })


@auth_routes.route("/logout", methods=["POST"])
def logout():
    response = make_response(jsonify({"msg": "Logout realizado"}))
    response.delete_cookie(COOKIE_NAME, path="/")
    return response
