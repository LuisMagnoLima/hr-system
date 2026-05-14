import os
import uuid

ALLOWED_EXTENSIONS = {"pdf"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_filename():
    return f"{uuid.uuid4()}.pdf"

def save_file(file, upload_folder):
    if not allowed_file(file.filename):
        return None

    filename = generate_filename()
    filepath = os.path.join(upload_folder, filename)

    file.save(filepath)

    return filename