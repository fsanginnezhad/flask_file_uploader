import os

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from app.files import files_bp
from app.extensions import db
from app.models import File
from app.utils import (
    get_current_user,
    user_upload_dir,
    safe_unique_filename,
    get_extension,
)


@files_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_files():
    user = get_current_user()
    if user is None or not user.is_active:
        return jsonify({"error": "کاربر معتبر نیست"}), 403

    incoming_files = request.files.getlist("files")
    if not incoming_files:
        return jsonify({"error": "هیچ فایلی ارسال نشده است (کلید 'files')"}), 400

    allowed_extensions = user.get_allowed_extensions()
    max_size_bytes = user.get_max_file_size_mb() * 1024 * 1024

    saved = []
    errors = []

    target_dir = user_upload_dir(user.username)

    for f in incoming_files:
        if f.filename == "":
            continue

        ext = get_extension(f.filename)
        if ext not in allowed_extensions:
            errors.append(
                {
                    "filename": f.filename,
                    "error": f"فرمت '.{ext}' مجاز نیست. فرمت‌های مجاز: {', '.join(sorted(allowed_extensions))}",
                }
            )
            continue

        # اندازه‌ی فایل رو بدون نوشتنش روی دیسک چک می‌کنیم
        f.stream.seek(0, os.SEEK_END)
        size_bytes = f.stream.tell()
        f.stream.seek(0)

        if size_bytes > max_size_bytes:
            errors.append(
                {
                    "filename": f.filename,
                    "error": f"حجم فایل بیشتر از حد مجاز ({user.get_max_file_size_mb()} مگابایت) است",
                }
            )
            continue

        stored_name = safe_unique_filename(f.filename)
        full_path = os.path.join(target_dir, stored_name)
        f.save(full_path)

        file_record = File(
            owner_id=user.id,
            original_filename=f.filename,
            stored_filename=stored_name,
            size_bytes=size_bytes,
            uploaded_by_admin=False,
        )
        db.session.add(file_record)
        saved.append(file_record)

    db.session.commit()

    return (
        jsonify(
            {
                "uploaded": [f.to_dict() for f in saved],
                "errors": errors,
            }
        ),
        201 if saved else 400,
    )


@files_bp.route("/my-files", methods=["GET"])
@jwt_required()
def my_files():
    user = get_current_user()
    files = File.query.filter_by(owner_id=user.id).order_by(File.uploaded_at.desc()).all()
    return jsonify({"files": [f.to_dict() for f in files]}), 200
