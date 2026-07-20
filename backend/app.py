import atexit
import logging
import os
import re

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from config import ALLOWED_ORIGINS, ENABLE_SCHEDULER, ENV, MAX_FILE_SIZE, UPLOAD_FOLDER
from database import criar_indices, fechar_conexao, verificar_conexao
from routes.arquivamentos import arquivamentos_routes
from routes.auditoria import auditoria_routes
from routes.auth import auth_routes
from routes.dashboard import dashboard_routes
from routes.documents import doc_routes
from routes.solicitacoes import solicitacoes_routes
from routes.secretarias import preparar_secretarias, secretarias_routes
from routes.users import users_routes
from utils.cleanup_utils import rotina_arquivamento

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.config.update(
        UPLOAD_FOLDER=UPLOAD_FOLDER,
        MAX_CONTENT_LENGTH=MAX_FILE_SIZE,
        JSON_SORT_KEYS=False,
    )
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    if ENV == "development":
        cors_origins = [
            re.compile(r"^http://localhost:\d+$"),
            re.compile(r"^http://127\.0\.0\.1:\d+$"),
        ]
    else:
        cors_origins = ALLOWED_ORIGINS

    CORS(
        app,
        origins=cors_origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        max_age=600,
    )

    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["300 per 15 minutes"],
        storage_uri="memory://",
    )

    for blueprint in (
        auth_routes, doc_routes, solicitacoes_routes, auditoria_routes,
        dashboard_routes, users_routes, arquivamentos_routes, secretarias_routes,
    ):
        app.register_blueprint(blueprint)

    limiter.limit("10 per minute")(app.view_functions["auth.login"])

    verificar_conexao()
    criar_indices()
    preparar_secretarias()

    @app.get("/health")
    def health():
        verificar_conexao()
        return jsonify({"status": "ok", "environment": ENV, "database": "connected"}), 200

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if response.mimetype == "application/json":
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(413)
    def arquivo_grande(_error):
        limite_mb = MAX_FILE_SIZE // (1024 * 1024)
        return jsonify({"error": f"Arquivo excede o limite de {limite_mb} MB"}), 413

    @app.errorhandler(429)
    def muitas_requisicoes(_error):
        return jsonify({"error": "Muitas tentativas. Aguarde e tente novamente."}), 429

    @app.errorhandler(HTTPException)
    def erro_http(error):
        return jsonify({"error": error.description}), error.code

    @app.errorhandler(Exception)
    def erro_inesperado(error):
        logger.exception("Erro não tratado: %s", error)
        return jsonify({"error": "Erro interno do servidor"}), 500

    if ENABLE_SCHEDULER:
        scheduler = BackgroundScheduler(timezone="America/Fortaleza")
        scheduler.add_job(rotina_arquivamento, "cron", hour=2, minute=0,
                          misfire_grace_time=86400, max_instances=1, coalesce=True)
        scheduler.start()
        atexit.register(lambda: scheduler.shutdown(wait=False))

    atexit.register(fechar_conexao)
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
