import os

from flask import Flask, jsonify

from app.config import Config, basedir
from app.extensions import db, jwt


def create_app(config_class=Config):
    app = Flask(
        __name__,
        template_folder=os.path.join(basedir, "templates"),
        static_folder=os.path.join(basedir, "static"),
        static_url_path="/static",
    )
    app.config.from_object(config_class)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)

    from app.auth import auth_bp
    from app.files import files_bp
    from app.admin import admin_bp
    from app.main import main_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(main_bp)

    with app.app_context():
        db.create_all()
        _seed_global_settings(app)

    _register_error_handlers(app)
    _register_cli_commands(app)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"}), 200

    return app


def _register_cli_commands(app):
    """
    چون سیستم ثبت‌نام عمومی نداریم، اولین کاربر ادمین باید از طریق ترمینال ساخته بشه:
        flask create-admin <username> <password>
    """
    import click
    from app.models import User

    @app.cli.command("create-admin")
    @click.argument("username")
    @click.argument("password")
    def create_admin(username, password):
        if User.query.filter_by(username=username).first():
            click.echo(f"خطا: کاربری با نام '{username}' از قبل وجود دارد.")
            return

        if len(password) < 6:
            click.echo("خطا: رمز عبور باید حداقل ۶ کاراکتر باشد.")
            return

        user = User(username=username, is_admin=True)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        click.echo(f"کاربر ادمین '{username}' با موفقیت ساخته شد.")


def _seed_global_settings(app):
    from app.models import GlobalSettings

    if GlobalSettings.query.first() is None:
        settings = GlobalSettings(
            default_max_file_size_mb=app.config["DEFAULT_MAX_FILE_SIZE_MB"],
            default_allowed_extensions=app.config["DEFAULT_ALLOWED_EXTENSIONS"],
        )
        db.session.add(settings)
        db.session.commit()


def _register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "یافت نشد"}), 404

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "حجم درخواست بیشتر از حد مجاز است"}), 413

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "خطای داخلی سرور"}), 500
