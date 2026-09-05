from flask import Blueprint

files_bp = Blueprint("files", __name__, url_prefix="/files")

from app.files import routes  # noqa: E402,F401
