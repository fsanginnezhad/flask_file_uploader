from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

from app.admin import admin_bp
from app.extensions import db
from app.models import User, GlobalSettings
from app.utils import admin_required


# ---------------------------------------------------------------------------
# مدیریت کاربران
# ---------------------------------------------------------------------------


@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    users = User.query.order_by(User.id).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200


@admin_bp.route("/users", methods=["POST"])
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    is_admin = bool(data.get("is_admin", False))

    if not username or not password:
        return jsonify({"error": "نام کاربری و رمز عبور الزامی است"}), 400

    if len(password) < 6:
        return jsonify({"error": "رمز عبور باید حداقل ۶ کاراکتر باشد"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "این نام کاربری قبلاً استفاده شده است"}), 409

    user = User(username=username, is_admin=is_admin)
    user.set_password(password)

    if (data.get("display_name") or "").strip():
        user.display_name = data["display_name"].strip()

    # تنظیمات اختصاصی اختیاری هنگام ساخت
    if "max_file_size_mb" in data and data["max_file_size_mb"] is not None:
        user.max_file_size_mb = int(data["max_file_size_mb"])
    if "allowed_extensions" in data and data["allowed_extensions"]:
        user.allowed_extensions = _normalize_extensions(data["allowed_extensions"])

    db.session.add(user)
    db.session.commit()

    return jsonify({"user": user.to_dict()}), 201


@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    if "username" in data and data["username"].strip():
        new_username = data["username"].strip()
        if new_username != user.username and User.query.filter_by(username=new_username).first():
            return jsonify({"error": "این نام کاربری قبلاً استفاده شده است"}), 409
        user.username = new_username

    if "display_name" in data:
        value = (data["display_name"] or "").strip()
        user.display_name = value or None

    if "password" in data and data["password"]:
        if len(data["password"]) < 6:
            return jsonify({"error": "رمز عبور باید حداقل ۶ کاراکتر باشد"}), 400
        user.set_password(data["password"])

    if "is_active" in data:
        user.is_active = bool(data["is_active"])

    if "max_file_size_mb" in data:
        # مقدار null یعنی برگشت به پیش‌فرض سراسری
        user.max_file_size_mb = (
            int(data["max_file_size_mb"]) if data["max_file_size_mb"] is not None else None
        )

    if "allowed_extensions" in data:
        user.allowed_extensions = (
            _normalize_extensions(data["allowed_extensions"])
            if data["allowed_extensions"]
            else None
        )

    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id):
    current_user_id = int(get_jwt_identity())
    if user_id == current_user_id:
        return jsonify({"error": "نمی‌توانید حساب خودتان را حذف کنید"}), 400

    user = User.query.get_or_404(user_id)

    # پوشه‌ی فایل‌های کاربر رو هم حذف می‌کنیم
    _delete_user_folder(user.username)

    db.session.delete(user)  # به خاطر cascade، رکوردهای File هم حذف می‌شن
    db.session.commit()

    return jsonify({"message": "کاربر با موفقیت حذف شد"}), 200


@admin_bp.route("/users/<int:user_id>/promote", methods=["PATCH"])
@admin_required
def toggle_admin(user_id):
    current_user_id = int(get_jwt_identity())
    if user_id == current_user_id:
        return jsonify({"error": "نمی‌توانید نقش ادمین بودن خودتان را تغییر دهید"}), 400

    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    if "is_admin" in data:
        user.is_admin = bool(data["is_admin"])
    else:
        user.is_admin = not user.is_admin  # اگه مقدار داده نشد، toggle می‌کنیم

    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


# ---------------------------------------------------------------------------
# تنظیمات سراسری (پیش‌فرض حجم و فرمت فایل)
# ---------------------------------------------------------------------------


@admin_bp.route("/settings", methods=["GET"])
@admin_required
def get_global_settings():
    return jsonify({"settings": GlobalSettings.get().to_dict()}), 200


@admin_bp.route("/settings", methods=["PUT"])
@admin_required
def update_global_settings():
    settings = GlobalSettings.get()
    data = request.get_json(silent=True) or {}

    if "default_max_file_size_mb" in data:
        settings.default_max_file_size_mb = int(data["default_max_file_size_mb"])

    if "default_allowed_extensions" in data:
        settings.default_allowed_extensions = _normalize_extensions(
            data["default_allowed_extensions"]
        )

    db.session.commit()
    return jsonify({"settings": settings.to_dict()}), 200


def _normalize_extensions(value):
    """
    ورودی می‌تونه رشته‌ی جدا شده با کاما باشه یا یک لیست.
    خروجی همیشه یک رشته‌ی نرمال‌شده و جدا شده با کاماست (بدون نقطه، حروف کوچک).
    """
    if isinstance(value, list):
        parts = value
    else:
        parts = str(value).split(",")
    cleaned = sorted({p.strip().lower().lstrip(".") for p in parts if p.strip()})
    return ",".join(cleaned)


def _delete_user_folder(username):
    import os
    import shutil
    from flask import current_app

    path = os.path.join(current_app.config["UPLOAD_FOLDER"], username)
    if os.path.isdir(path):
        shutil.rmtree(path)


# پایین‌تر بخش مدیریت پوشه‌ها و فایل‌ها اضافه می‌شود
from app.admin import folders  # noqa: E402,F401
