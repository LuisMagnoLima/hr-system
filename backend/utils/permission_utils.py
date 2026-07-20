from functools import wraps
from database import get_database

from bson import ObjectId
from flask import jsonify, request

from config import COOKIE_NAME
from utils.audit_utils import registrar_auditoria
from utils.auth_utils import verify_token

db = get_database()


def get_current_user():
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
    if not token:
        return None

    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id or not ObjectId.is_valid(user_id):
            return None
        user = db.users.find_one({"_id": ObjectId(user_id)}, {"password": 0})
        if not user:
            return None
        user["_id"] = str(user["_id"])
        return user
    except Exception:
        return None


def _negado(motivo, status):
    registrar_auditoria(
        "tentativa_acesso_negado",
        "anonimo",
        {"rota": request.path, "metodo": request.method, "motivo": motivo},
        status="falha",
    )
    return jsonify({"error": motivo}), status


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return _negado("Sessão inválida ou expirada", 401)
        request.current_user = user
        return fn(*args, **kwargs)
    return wrapper


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return _negado("Sessão inválida ou expirada", 401)
            if user.get("role") not in roles:
                return _negado("Acesso negado", 403)
            request.current_user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def permission_required(*permissions):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return _negado("Sessão inválida ou expirada", 401)
            user_permissions = user.get("permissions", [])
            if user.get("role") != "admin" and not any(p in user_permissions for p in permissions):
                return _negado("Permissão insuficiente", 403)
            request.current_user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator
