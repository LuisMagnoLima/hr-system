import os
from dotenv import load_dotenv

load_dotenv()

print("SECRET_KEY:", os.getenv("SECRET_KEY"))
print("MONGO_URI:", os.getenv("MONGO_URI"))
print("DB_NAME:", os.getenv("DB_NAME"))