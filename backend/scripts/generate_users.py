from utils.auth_utils import hash_password
from database import get_database

db = get_database()

users = [
    {
        "email": "arthur@inagro.com",
        "password": "arthur123",
        "permissions": ["banco_dados", "notas", "diarias", "admissoes"],
        "role": "admin"
    },
    {
        "email": "fernanda@inagro.com",
        "password": "fernanda123",
        "permissions": ["financeiro"],
        "role": "operador"
    },
    {
        "email": "fernanda@inagronotas.com",
        "password": "fernanda123",
        "permissions": ["notas"],
        "role": "operador"
    },
    {
        "email": "polyane@inagro.com",
        "password": "polyane123",
        "permissions": ["notas", "diarias", "admissoes"],
        "role": "solicitante"
    },
     {
        "email": "polyane@inagronotas.com",
        "password": "polyane123",
        "permissions": ["notas"],
        "role": "operador"
    },
    {
        "email": "bruno@inagro.com",
        "password": "bruno123",
        "permissions": ["diarias", "admissoes"],
        "role": "operador"
    },
      {
        "email": "rh@inagro.com",
        "password": "rh123",
        "permissions": ["notas","diarias", "admissoes"],
        "role": "operador"
    },
    {
        "email": "alex@inagro.com",
        "password": "alex123",
        "permissions": ["notas"],
        "role": "operador"
    },
    {
        "email": "helena@inagro.com",
        "password": "helena123",
        "permissions": ["diarias"],
        "role": "operador"
    },
    {
        "email": "natalia@inagro.com",
        "password": "natalia123",
        "permissions": ["diarias"],
        "role": "operador"
    }
]

for user in users:
    existente = db.users.find_one({"email": user["email"]})

    if existente:
        db.users.update_one(
            {"email": user["email"]},
            {
                "$set": {
                    "permissions": user["permissions"],
                    "role": user["role"]
                }
            }
        )
    else:
        db.users.insert_one({
            "email": user["email"],
            "password": hash_password(user["password"]),
            "permissions": user["permissions"],
            "role": user["role"]
        })
print("✅ Usuários criados/atualizados com segurança!")
