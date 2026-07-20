import datetime
import bcrypt
import jwt
from config import SECRET_KEY, TOKEN_HOURS


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())


def check_password(password, hashed):
    if isinstance(hashed, str):
        hashed = hashed.encode("utf-8")
    return bcrypt.checkpw(password.encode("utf-8"), hashed)


def generate_token(user):
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user.get("_id", "")),
        "email": user["email"],
        "permissions": user.get("permissions", []),
        "role": user.get("role", "operador"),
        "iat": now,
        "exp": now + datetime.timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
