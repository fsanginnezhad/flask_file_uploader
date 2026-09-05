import os
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-key")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(basedir, 'app.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = os.environ.get(
        "UPLOAD_FOLDER", os.path.join(basedir, "uploads")
    )

    # مقادیر پیش‌فرض سراسری — این‌ها فقط "seed" اولیه هستن.
    # مقدار واقعی و قابل تغییر در دیتابیس (جدول GlobalSettings) نگه‌داری می‌شه.
    DEFAULT_MAX_FILE_SIZE_MB = int(os.environ.get("DEFAULT_MAX_FILE_SIZE_MB", 50))
    DEFAULT_ALLOWED_EXTENSIONS = os.environ.get(
        "DEFAULT_ALLOWED_EXTENSIONS", "pdf,png,jpg,jpeg,docx,xlsx,zip"
    )

    # سقف مطلق برای جلوگیری از حمله (صرف نظر از تنظیمات کاربر/سراسری)
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500 MB سقف کلی درخواست
