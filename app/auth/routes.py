from flask import request, jsonify
from flask_jwt_extended import create_access_token

from app.auth import auth_bp
from app.models import User


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "نام کاربری و رمز عبور الزامی است"}), 400

    user = User.query.filter_by(username=username).first()

    if user is None or not user.check_password(password):
        return jsonify({"error": "نام کاربری یا رمز عبور اشتباه است"}), 401

    if not user.is_active:
        return jsonify({"error": "حساب کاربری غیرفعال شده است"}), 403

    # identity رو رشته می‌ذاریم (استاندارد jwt-extended)، claim اضافه برای is_admin
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"is_admin": user.is_admin, "username": user.username},
    )

    return jsonify({"access_token": access_token, "user": user.to_dict()}), 200
