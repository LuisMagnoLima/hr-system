import os
import uuid
from werkzeug.utils import secure_filename
ALLOWED_EXTENSIONS={"pdf"}
def allowed_file(filename):
    return "." in filename and filename.rsplit(".",1)[1].lower() in ALLOWED_EXTENSIONS
def generate_filename(original_filename):
    return f"{uuid.uuid4()}.{original_filename.rsplit('.',1)[1].lower()}"
def save_file(file, upload_folder, departamento, ano, mes):
    if not allowed_file(file.filename): return None
    dep=secure_filename(departamento or 'GERAL')
    pasta=os.path.join(upload_folder,dep,str(ano),str(mes).zfill(2))
    os.makedirs(pasta,exist_ok=True)
    nome=generate_filename(file.filename)
    file.save(os.path.join(pasta,nome))
    return os.path.join(dep,str(ano),str(mes).zfill(2),nome).replace('\\','/')
