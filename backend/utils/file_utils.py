import os
import uuid
from pathlib import Path
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"pdf"}
PDF_SIGNATURE = b"%PDF-"


def allowed_file(filename):
    return bool(filename and "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS)


def validate_pdf(file_storage):
    if not file_storage or not allowed_file(file_storage.filename):
        return False, "Apenas arquivos PDF são permitidos"

    mime = (file_storage.mimetype or "").lower()
    if mime not in {"application/pdf", "application/x-pdf", "application/octet-stream"}:
        return False, "O tipo do arquivo não corresponde a um PDF"

    stream = file_storage.stream
    position = stream.tell()
    signature = stream.read(5)
    stream.seek(position)
    if signature != PDF_SIGNATURE:
        return False, "O conteúdo do arquivo não é um PDF válido"

    return True, None


def generate_filename():
    return f"{uuid.uuid4().hex}.pdf"


def save_file(file_storage, upload_folder, departamento, ano, mes):
    valido, erro = validate_pdf(file_storage)
    if not valido:
        return None, erro

    dep = secure_filename(str(departamento or "GERAL")).upper() or "GERAL"
    pasta_base = Path(upload_folder).resolve()
    pasta = (pasta_base / dep / str(int(ano)) / str(int(mes)).zfill(2)).resolve()

    if pasta_base != pasta and pasta_base not in pasta.parents:
        return None, "Destino de arquivo inválido"

    pasta.mkdir(parents=True, exist_ok=True)
    nome = generate_filename()
    destino = pasta / nome
    file_storage.save(destino)

    if not destino.exists() or destino.stat().st_size == 0:
        destino.unlink(missing_ok=True)
        return None, "O arquivo enviado está vazio"

    relativo = destino.relative_to(pasta_base).as_posix()
    return relativo, None
