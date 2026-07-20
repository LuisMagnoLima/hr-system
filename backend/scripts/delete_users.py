from database import get_database

db = get_database()

def delete_users   ():
    result = db.users.delete_many({}) 
    # Pra deletar todos os usuarios é so usar {} vazio no lugar de {"role": "operador"}
    print(f"🚨 {result.deleted_count} usuários com a função 'operador' apagados.")

if __name__ == "__main__":
    delete_users()
