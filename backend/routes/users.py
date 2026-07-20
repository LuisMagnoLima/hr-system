from flask import Blueprint, request, jsonify
from bson import ObjectId
from database import get_database

from utils.auth_utils import hash_password
from utils.permission_utils import role_required
from utils.audit_utils import registrar_auditoria

users_routes = Blueprint("users", __name__)

db = get_database()


@users_routes.route("/admin/users", methods=["GET"])
@role_required("admin")
def listar_users():
    users = list(db.users.find({}, {"password": 0}))

    for user in users:
        user["_id"] = str(user["_id"])

    return jsonify(users), 200


@users_routes.route("/admin/users", methods=["POST"])
@role_required("admin")
def criar_user():
    data = request.json

    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "operador")
    permissions = data.get("permissions", [])

    if not email or not password:
        return jsonify({"error": "Email e senha são obrigatórios"}), 400

    if db.users.find_one({"email": email}):
        return jsonify({"error": "Usuário já existe"}), 400

    novo_user = {
        "email": email,
        "password": hash_password(password),
        "role": role,
        "permissions": permissions
    }

    db.users.insert_one(novo_user)

    registrar_auditoria(
        "admin_criar_usuario",
        request.current_user["email"],
        {"email": email, "role": role, "permissions": permissions}
    )

    return jsonify({"msg": "Usuário criado com sucesso"}), 201


@users_routes.route("/admin/users/<id>", methods=["PUT"])
@role_required("admin")
def editar_user(id):
    data = request.json

    user = db.users.find_one({"_id": ObjectId(id)})

    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404

    novo_email = data.get("email")
    role = data.get("role")
    permissions = data.get("permissions", [])

    if not novo_email:
        return jsonify({"error": "Email obrigatório"}), 400

    email_existente = db.users.find_one({
        "email": novo_email,
        "_id": {"$ne": ObjectId(id)}
    })

    if email_existente:
        return jsonify({"error": "Este email já está em uso"}), 400

    db.users.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "email": novo_email,
                "role": role,
                "permissions": permissions
            }
        }
    )

    registrar_auditoria(
        "admin_editar_usuario",
        request.current_user["email"],
        {
            "antes": {
                "email": user.get("email"),
                "role": user.get("role"),
                "permissions": user.get("permissions", [])
            },
            "depois": {
                "email": novo_email,
                "role": role,
                "permissions": permissions
            }
        }
    )

    return jsonify({"msg": "Usuário atualizado com sucesso"}), 200


@users_routes.route("/admin/users/<id>/password", methods=["PATCH"])
@role_required("admin")
def alterar_senha_user(id):
    data = request.json
    nova_senha = data.get("password")

    if not nova_senha:
        return jsonify({"error": "Nova senha obrigatória"}), 400

    user = db.users.find_one({"_id": ObjectId(id)})

    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404

    db.users.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"password": hash_password(nova_senha)}}
    )

    registrar_auditoria(
        "admin_alterar_senha_usuario",
        request.current_user["email"],
        {"email": user.get("email")}
    )

    return jsonify({"msg": "Senha alterada com sucesso"}), 200


@users_routes.route("/admin/users/<id>", methods=["DELETE"])
@role_required("admin")
def excluir_user(id):
    user = db.users.find_one({"_id": ObjectId(id)})

    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404

    if user.get("email") == request.current_user["email"]:
        return jsonify({"error": "Você não pode excluir seu próprio usuário"}), 400

    if user.get("role") == "admin":
        total_admins = db.users.count_documents({"role": "admin"})
        if total_admins <= 1:
            return jsonify({"error": "Não é possível excluir o último administrador"}), 400

    db.users.delete_one({"_id": ObjectId(id)})

    registrar_auditoria(
        "admin_excluir_usuario",
        request.current_user["email"],
        {"email": user.get("email"), "role": user.get("role")}
    )

    return jsonify({"msg": "Usuário excluído com sucesso"}), 200
