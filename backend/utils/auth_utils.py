import jwt
import datetime
import bcrypt
from config import SECRET_KEY

def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed)

def generate_token(user):
    payload = {
        "email": user["email"],
        "permissions": user["permissions"],
        "role": user.get("role", "operador"),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])