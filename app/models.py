from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    display_name = db.Column(db.String(120), nullable=True)  # نام نمایشی فارسی — اگه خالی باشه، username نشون داده می‌شه
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # اگه None باشه یعنی از تنظیمات سراسری استفاده می‌شه (GlobalSettings)
    max_file_size_mb = db.Column(db.Integer, nullable=True)
    # رشته‌ی جدا شده با کاما، مثل "pdf,png,docx" — اگه None باشه یعنی از پیش‌فرض سراسری استفاده می‌شه
    allowed_extensions = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    files = db.relationship(
        "File", backref="owner", lazy=True, cascade="all, delete-orphan"
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_max_file_size_mb(self):
        if self.max_file_size_mb is not None:
            return self.max_file_size_mb
        return GlobalSettings.get().default_max_file_size_mb

    def get_allowed_extensions(self):
        """برمی‌گردونه یک set از پسوندهای مجاز (بدون نقطه، حروف کوچک)."""
        raw = self.allowed_extensions
        if raw is None:
            raw = GlobalSettings.get().default_allowed_extensions
        return {ext.strip().lower().lstrip(".") for ext in raw.split(",") if ext.strip()}

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name,
            "effective_display_name": self.display_name or self.username,
            "is_admin": self.is_admin,
            "is_active": self.is_active,
            "max_file_size_mb": self.max_file_size_mb,
            "allowed_extensions": self.allowed_extensions,
            "effective_max_file_size_mb": self.get_max_file_size_mb(),
            "effective_allowed_extensions": sorted(self.get_allowed_extensions()),
            "created_at": self.created_at.isoformat(),
        }


class GlobalSettings(db.Model):
    """جدول تنظیمات سراسری — همیشه فقط یک رکورد (singleton) داره."""

    __tablename__ = "global_settings"

    id = db.Column(db.Integer, primary_key=True)
    default_max_file_size_mb = db.Column(db.Integer, nullable=False, default=50)
    default_allowed_extensions = db.Column(
        db.String(500), nullable=False, default="pdf,png,jpg,jpeg,docx,xlsx,zip"
    )

    @classmethod
    def get(cls):
        settings = cls.query.first()
        if settings is None:
            # اگه به هر دلیلی seed نشده بود، یه رکورد پیش‌فرض بساز
            from flask import current_app

            settings = cls(
                default_max_file_size_mb=current_app.config["DEFAULT_MAX_FILE_SIZE_MB"],
                default_allowed_extensions=current_app.config["DEFAULT_ALLOWED_EXTENSIONS"],
            )
            db.session.add(settings)
            db.session.commit()
        return settings

    def to_dict(self):
        return {
            "default_max_file_size_mb": self.default_max_file_size_mb,
            "default_allowed_extensions": self.default_allowed_extensions,
        }


class File(db.Model):
    __tablename__ = "files"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)  # نام واقعی روی دیسک
    size_bytes = db.Column(db.Integer, nullable=False)

    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    uploaded_by_admin = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "owner_username": self.owner.username if self.owner else None,
            "original_filename": self.original_filename,
            "stored_filename": self.stored_filename,
            "size_bytes": self.size_bytes,
            "uploaded_at": self.uploaded_at.isoformat(),
            "uploaded_by_admin": self.uploaded_by_admin,
        }
