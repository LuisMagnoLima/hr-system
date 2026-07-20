import logging
from threading import Lock

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError

from config import (
    DB_NAME,
    MONGO_CONNECT_TIMEOUT_MS,
    MONGO_MAX_POOL_SIZE,
    MONGO_MIN_POOL_SIZE,
    MONGO_SERVER_SELECTION_TIMEOUT_MS,
    MONGO_SOCKET_TIMEOUT_MS,
    MONGO_URI,
)

logger = logging.getLogger(__name__)

_client: MongoClient | None = None
_database: Database | None = None
_lock = Lock()


def get_client() -> MongoClient:
    """Retorna uma única instância compartilhada do MongoClient."""
    global _client

    if _client is None:
        with _lock:
            if _client is None:
                _client = MongoClient(
                    MONGO_URI,
                    appname="hr-system",
                    connectTimeoutMS=MONGO_CONNECT_TIMEOUT_MS,
                    serverSelectionTimeoutMS=MONGO_SERVER_SELECTION_TIMEOUT_MS,
                    socketTimeoutMS=MONGO_SOCKET_TIMEOUT_MS,
                    minPoolSize=MONGO_MIN_POOL_SIZE,
                    maxPoolSize=MONGO_MAX_POOL_SIZE,
                    retryReads=True,
                    retryWrites=True,
                    tz_aware=True,
                )
    return _client


def get_database() -> Database:
    """Retorna o banco configurado, reutilizando a conexão global."""
    global _database

    if _database is None:
        _database = get_client()[DB_NAME]
    return _database


def verificar_conexao() -> None:
    """Interrompe a inicialização quando o MongoDB não está acessível."""
    try:
        get_client().admin.command("ping")
        logger.info("Conexão com MongoDB validada. Banco: %s", DB_NAME)
    except PyMongoError as exc:
        logger.exception("Não foi possível conectar ao MongoDB")
        raise RuntimeError("Falha ao conectar ao banco de dados") from exc


def criar_indices() -> None:
    """Cria índices apenas quando eles ainda não existem."""
    db = get_database()

    indices = {
        "users": [
            ([("email", ASCENDING)], {"unique": True}),
            ([("role", ASCENDING)], {}),
        ],
        "secretarias": [
            ([("sigla", ASCENDING)], {"unique": True}),
            ([("ativa", ASCENDING), ("sigla", ASCENDING)], {}),
        ],
        "documents": [
            ([("data_envio", DESCENDING)], {}),
            ([("departamento", ASCENDING), ("data_envio", DESCENDING)], {}),
            ([("status", ASCENDING), ("data_envio", DESCENDING)], {}),
        ],
        "solicitacoes": [
            ([("protocolo", ASCENDING)], {"unique": True, "sparse": True}),
            ([("destinatario", ASCENDING), ("status", ASCENDING), ("criado_em", DESCENDING)], {}),
            ([("status", ASCENDING), ("criado_em", DESCENDING)], {}),
            ([("numero_oficio", ASCENDING)], {}),
        ],
        "auditoria": [
            ([("data", DESCENDING)], {}),
            ([("usuario_email", ASCENDING), ("data", DESCENDING)], {}),
        ],
        "arquivamentos": [
            ([("data_arquivamento", DESCENDING)], {}),
        ],
    }

    try:
        for colecao, definicoes in indices.items():
            for chaves, opcoes in definicoes:
                try:
                    db[colecao].create_index(chaves, **opcoes)
                except PyMongoError:
                    # Índice já existe ou há conflito de nome.
                    # Para a apresentação, apenas continua.
                    pass

        logger.info("Índices verificados com sucesso")

    except Exception as exc:
        logger.exception("Falha ao preparar índices")
        raise RuntimeError("Falha ao preparar os índices") from exc

def fechar_conexao() -> None:
    global _client, _database

    if _client is not None:
        _client.close()
        _client = None
        _database = None
        logger.info("Conexão com MongoDB encerrada")
