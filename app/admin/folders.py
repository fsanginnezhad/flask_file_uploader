import os

from flask import request, jsonify, current_app

from app.admin import admin_bp
from app.extensions import db
from app.models import User, File
from app.utils import (
    admin_required,
    get_current_user,
    user_upload_dir,
    safe_unique_filename,
    get_extension,
)


# ---------------------------------------------------------------------------
# لیست پوشه‌ها (هر کاربر = یک پوشه)
# ---------------------------------------------------------------------------


@admin_bp.route("/folders", methods=["GET"])
@admin_required
def list_folders():
    users = User.query.order_by(User.username).all()
    result = []
    for u in users:
        file_count = File.query.filter_by(owner_id=u.id).count()
        result.append(
            {
                "owner_id": u.id,
                "owner_username": u.username,
                "file_count": file_count,
            }
        )
    return jsonify({"folders": result}), 200


@admin_bp.route("/folders/<int:user_id>/files", methods=["GET"])
@admin_required
def list_folder_files(user_id):
    user = User.query.get_or_404(user_id)
    files = File.query.filter_by(owner_id=user.id).order_by(File.uploaded_at.desc()).all()
    return (
        jsonify(
            {
                "owner_username": user.username,
                "files": [f.to_dict() for f in files],
            }
        ),
        200,
    )


# ---------------------------------------------------------------------------
# ویرایش (تغییر نام) و حذف فایل توسط ادمین
# ---------------------------------------------------------------------------


@admin_bp.route("/files/<int:file_id>", methods=["PUT"])
@admin_required
def rename_file(file_id):
    file_record = File.query.get_or_404(file_id)
    data = request.get_json(silent=True) or {}

    new_name = (data.get("original_filename") or "").strip()
    if not new_name:
        return jsonify({"error": "نام جدید فایل الزامی است"}), 400

    # فقط نام نمایشی (original_filename) تغییر می‌کنه، نه نام فایل روی دیسک —
    # این باعث می‌شه نیازی به جابه‌جایی فایل روی دیسک نباشد.
    file_record.original_filename = new_name
    db.session.commit()

    return jsonify({"file": file_record.to_dict()}), 200


@admin_bp.route("/files/<int:file_id>", methods=["DELETE"])
@admin_required
def delete_file(file_id):
    file_record = File.query.get_or_404(file_id)
    owner = User.query.get(file_record.owner_id)

    if owner is not None:
        full_path = os.path.join(
            current_app.config["UPLOAD_FOLDER"], owner.username, file_record.stored_filename
        )
        if os.path.isfile(full_path):
            os.remove(full_path)

    db.session.delete(file_record)
    db.session.commit()

    return jsonify({"message": "فایل با موفقیت حذف شد"}), 200


# ---------------------------------------------------------------------------
# آپلود توسط ادمین — می‌تونه برای خودش یا برای کاربر دیگه آپلود کنه
# ---------------------------------------------------------------------------


@admin_bp.route("/upload", methods=["POST"])
@admin_required
def admin_upload():
    admin_user = get_current_user()

    target_user_id = request.form.get("target_user_id", type=int)
    target_user = User.query.get(target_user_id) if target_user_id else admin_user

    if target_user is None:
        return jsonify({"error": "کاربر مقصد یافت نشد"}), 404

    incoming_files = request.files.getlist("files")
    if not incoming_files:
        return jsonify({"error": "هیچ فایلی ارسال نشده است (کلید 'files')"}), 400

    # ادمین از محدودیت فرمت/حجم کاربر مقصد عبور می‌کنه — چون خودش تصمیم‌گیرنده‌ی نهاییه.
    # اگه ترجیح می‌دی ادمین هم محدود به همون قوانین کاربر مقصد باشه، بگو تا تغییرش بدم.

    target_dir = user_upload_dir(target_user.username)
    saved = []

    for f in incoming_files:
        if f.filename == "":
            continue

        f.stream.seek(0, os.SEEK_END)
        size_bytes = f.stream.tell()
        f.stream.seek(0)

        stored_name = safe_unique_filename(f.filename)
        full_path = os.path.join(target_dir, stored_name)
        f.save(full_path)

        file_record = File(
            owner_id=target_user.id,
            original_filename=f.filename,
            stored_filename=stored_name,
            size_bytes=size_bytes,
            uploaded_by_admin=True,
        )
        db.session.add(file_record)
        saved.append(file_record)

    db.session.commit()

    return jsonify({"uploaded": [f.to_dict() for f in saved]}), 201
