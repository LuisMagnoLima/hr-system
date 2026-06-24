from functools import wraps
from flask import request, jsonify
from utils.auth_utils import verify_token


def get_current_user():
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")

    try:
        return verify_token(token)
    except Exception:
        return None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()

        if not user:
            return jsonify({"error": "Token inválido ou ausente"}), 401

        request.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()

            if not user:
                return jsonify({"error": "Token inválido ou ausente"}), 401

            if user.get("role") not in roles:
                return jsonify({"error": "Acesso negado"}), 403

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
                return jsonify({"error": "Token inválido ou ausente"}), 401

            user_permissions = user.get("permissions", [])

            if not any(p in user_permissions for p in permissions):
                return jsonify({"error": "Permissão insuficiente"}), 403

            request.current_user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator