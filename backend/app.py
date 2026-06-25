from flask import Flask, send_from_directory
from flask_cors import CORS
import os

from config import UPLOAD_FOLDER
from routes.auth import auth_routes
from routes.documents import doc_routes
from routes.solicitacoes import solicitacoes_routes
from apscheduler.schedulers.background import BackgroundScheduler
from utils.cleanup_utils import limpar_arquivos_antigos
from routes.auditoria import auditoria_routes
from config import MONGO_URI
from routes.dashboard import dashboard_routes
app = Flask(__name__)
CORS(app)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.register_blueprint(auth_routes)
app.register_blueprint(doc_routes)
app.register_blueprint(solicitacoes_routes)
app.register_blueprint(auditoria_routes)
app.register_blueprint(dashboard_routes)
@app.route("/files/<filename>")
def get_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True)

scheduler = BackgroundScheduler()
#checa a cada 10 minutos por arquivos antigos (para mudar para horas é so colocar hours= 1, para 3 meses days=90)
#está ligada ao cleanup_utils.py, onde tem a função de limpar arquivos antigos
scheduler.add_job(limpar_arquivos_antigos, "interval", days=1.826)
scheduler.start()

if __name__ == "__main__":
    app.run(debug=True)