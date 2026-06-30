from flask import Flask, send_from_directory
from flask_cors import CORS
import os

from config import UPLOAD_FOLDER
from routes.auth import auth_routes
from routes.documents import doc_routes
from routes.solicitacoes import solicitacoes_routes
from apscheduler.schedulers.background import BackgroundScheduler
from utils.cleanup_utils import rotina_arquivamento
from routes.auditoria import auditoria_routes
from config import MONGO_URI
from routes.dashboard import dashboard_routes
from routes.users import users_routes
from routes.arquivamentos import arquivamentos_routes

app = Flask(__name__)
CORS(app)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.register_blueprint(auth_routes)
app.register_blueprint(doc_routes)
app.register_blueprint(solicitacoes_routes)
app.register_blueprint(auditoria_routes)
app.register_blueprint(dashboard_routes)
app.register_blueprint(users_routes)
app.register_blueprint(arquivamentos_routes)

scheduler = BackgroundScheduler()
scheduler.add_job(rotina_arquivamento, "cron", hour=2, minute=0)
scheduler.start()
rotina_arquivamento()
if __name__ == "__main__":
    app.run(debug=False)