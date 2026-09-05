from flask import render_template

from app.main import main_bp


@main_bp.after_request
def add_no_cache_headers(response):
    """
    این صفحات وضعیت لاگین/نقش کاربر رو نشون می‌دن، پس نباید مرورگر نسخه‌ی
    کش‌شده (مخصوصاً از bfcache موقع زدن دکمه‌ی back) رو دوباره نشون بده.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response


@main_bp.route("/", methods=["GET"])
def login_page():
    return render_template("login.html")


@main_bp.route("/upload", methods=["GET"])
def upload_page():
    return render_template("upload.html")


@main_bp.route("/panel", methods=["GET"])
def admin_panel_page():
    # چک ادمین‌بودن سمت کلاینت (JS) انجام می‌شه؛ همه‌ی endpoint های API
    # زیر /admin هم مستقل و سمت سرور با admin_required محافظت شدن.
    return render_template("admin.html")
