import os
import uuid
from functools import wraps

import jdatetime
from flask import jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity

from app.models import User


def get_current_user():
    """کاربر جاری رو بر اساس JWT برمی‌گردونه (باید داخل route ای که jwt_required داره صدا زده بشه)."""
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))


def admin_required(fn):
    """مثل jwt_required ولی علاوه بر اون چک می‌کنه کاربر ادمین باشه."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if not claims.get("is_admin"):
            return jsonify({"error": "دسترسی غیرمجاز — این بخش مخصوص ادمین است"}), 403
        return fn(*args, **kwargs)

    return wrapper


def user_upload_dir(username):
    """مسیر پوشه‌ی آپلود مخصوص یک کاربر رو می‌سازه (اگه وجود نداشت، می‌سازه)."""
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], username)
    os.makedirs(path, exist_ok=True)
    return path


def safe_unique_filename(original_filename):
    """
    نام فایل روی دیسک رو بر اساس تاریخ و ساعت شمسی (جلالی) می‌سازه، مثل:
    1403-05-14_14-32-07-482_a91f3c.pdf
    یه پسوند رندوم کوتاه هم اضافه می‌شه تا اگه چند فایل دقیقاً تو یک میلی‌ثانیه
    آپلود بشن (مثلاً چند فایل تو یه درخواست)، تداخل نام پیش نیاد.
    پسوند اصلی فایل حفظ می‌شه.
    """
    ext = ""
    if "." in original_filename:
        ext = "." + original_filename.rsplit(".", 1)[1].lower()

    now = jdatetime.datetime.now()
    timestamp = now.strftime("%Y-%m-%d_%H-%M-%S-%f")[:-3]  # میکروثانیه -> میلی‌ثانیه
    random_suffix = uuid.uuid4().hex[:6]

    return f"{timestamp}_{random_suffix}{ext}"


def get_extension(filename):
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()
