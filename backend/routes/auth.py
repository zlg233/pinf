from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from models import db
from models.user import User
from models.baby import Baby
from models.appointment import Appointment
from models.growth import GrowthRecord
from models.chat import ChatMessage
from models.notification_subscription import NotificationSubscription
from models.device_token import DeviceToken
from models.verification_code import VerificationCode
from utils.wechat import get_wechat_user_info
from utils.wechat_mp import code2session, get_mp_access_token
from utils.auth import validate_request_data, token_required
import re
import requests

auth_bp = Blueprint("auth", __name__)


def validate_phone(phone: str) -> bool:
    """验证手机号格式（中国大陆）"""
    pattern = r'^1[3-9]\d{9}$'
    return bool(re.match(pattern, phone))


def validate_password(password: str) -> bool:
    """密码规则：8-16 位，必须包含字母和数字。"""
    pattern = r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,16}$'
    return bool(re.match(pattern, password))


@auth_bp.route("/auth/phone/code", methods=["POST"])
@validate_request_data(["phone"])
def send_phone_code(data):
    """
    发送手机验证码
    因无第三方短信服务，验证码存储在数据库中
    开发环境下会在响应中返回验证码（生产环境不应返回）
    """
    phone = data["phone"]
    
    # 验证手机号格式
    if not validate_phone(phone):
        return jsonify({"status": "error", "message": "手机号格式不正确"}), 400
    
    # 生成并存储验证码
    code = VerificationCode.create_code(phone, valid_minutes=5)
    
    # 开发环境返回验证码（生产环境应该通过短信发送）
    response_data = {"message": "验证码已发送，5分钟内有效"}
    if __debug__:  # 仅在开发模式下返回
        response_data["code"] = code
        response_data["debug"] = "开发模式：验证码已在响应中返回"
    
    return jsonify({
        "status": "success", 
        "message": "验证码已发送",
        "data": response_data
    })


@auth_bp.route("/auth/phone/login", methods=["POST"])
@validate_request_data([
    {"name": "phone", "type": str},
    {"name": "code", "type": str},
])
def phone_login(data):
    """
    手机号验证码登录
    验证成功后自动注册新用户或登录已有用户
    """
    phone = data["phone"]
    code = data["code"]
    
    # 验证手机号格式
    if not validate_phone(phone):
        return jsonify({"status": "error", "message": "手机号格式不正确"}), 400
    
    # 验证验证码
    if not VerificationCode.verify_code(phone, code):
        return jsonify({"status": "error", "message": "验证码错误或已过期"}), 400

    # 查找或创建用户
    user = User.query.filter_by(phone=phone).first()
    if not user:
        user = User(phone=phone, role="user")
        db.session.add(user)
        db.session.commit()

    # 生成 JWT token (identity 必须是字符串)
    token = create_access_token(identity=str(user.id))
    
    return jsonify({
        "status": "success", 
        "message": "登录成功", 
        "data": {
            "token": token, 
            "user": user.to_dict(),
            "need_set_password": user.password_hash is None,
        }
    })


@auth_bp.route("/auth/password/setup", methods=["POST"])
@validate_request_data([{"name": "password", "type": str}])
@token_required
def setup_password(data, current_user):
    """
    设置登录密码（验证码登录后直接设置）
    """
    password = data["password"]

    if not validate_password(password):
        return jsonify({
            "status": "error",
            "message": "密码需为8-16位字母+数字组合",
        }), 400

    current_user.password_hash = generate_password_hash(password)
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "密码设置成功",
        "data": {"user": current_user.to_dict()},
    })


@auth_bp.route("/auth/profile", methods=["PUT"])
@validate_request_data([{"name": "name", "type": str}])
@token_required
def update_profile(data, current_user):
    """
    更新用户资料（当前仅支持昵称）。
    """
    name = data["name"].strip()

    if not name:
        return jsonify({"status": "error", "message": "昵称不能为空"}), 400
    if len(name) > 50:
        return jsonify({"status": "error", "message": "昵称长度不能超过50个字符"}), 400

    current_user.name = name
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "昵称更新成功",
        "data": {"user": current_user.to_dict()},
    })


@auth_bp.route("/auth/password/login", methods=["POST"])
@validate_request_data([
    {"name": "phone", "type": str},
    {"name": "password", "type": str},
])
def password_login(data):
    """
    手机号 + 密码登录
    """
    phone = data["phone"]
    password = data["password"]

    if not validate_phone(phone):
        return jsonify({"status": "error", "message": "手机号格式不正确"}), 400

    if not validate_password(password):
        return jsonify({"status": "error", "message": "密码需为8-16位字母+数字组合"}), 400

    user = User.query.filter_by(phone=phone).first()
    if not user or not user.password_hash:
        return jsonify({"status": "error", "message": "用户未设置密码，请使用验证码登录"}), 400

    if not check_password_hash(user.password_hash, password):
        return jsonify({"status": "error", "message": "手机号或密码错误"}), 400

    token = create_access_token(identity=str(user.id))

    return jsonify({
        "status": "success",
        "message": "登录成功",
        "data": {
            "token": token,
            "user": user.to_dict(),
            "need_set_password": False,
        },
    })


@auth_bp.route("/auth/wechat", methods=["POST"])
@validate_request_data(["code"])
def wechat_login(data):
    """微信登录（保留，可选）。"""
    code = data["code"]
    info, error = get_wechat_user_info(code)
    if error:
        return jsonify({"status": "error", "message": error}), 400

    openid = info.get("openid")
    user = User.query.filter_by(wx_openid=openid).first()
    if not user:
        user = User(wx_openid=openid, role="user")
        db.session.add(user)
        db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({"status": "success", "message": "登录成功", "data": {"token": token, "user": user.to_dict()}})


@auth_bp.route("/auth/wechat/miniprogram", methods=["POST"])
@validate_request_data(["code"])
def wechat_miniprogram_login(data):
    """微信小程序登录 — 前端 wx.login() 获取 code → 后端换 openid + JWT"""
    code = data["code"]
    result = code2session(code)

    if 'errcode' in result:
        return jsonify({"status": "error", "message": result.get('errmsg', '微信登录失败')}), 400

    openid = result['openid']
    user = User.query.filter_by(wx_openid=openid).first()
    is_new_user = False
    if not user:
        user = User(wx_openid=openid, name=f'微信用户{openid[-4:]}', role="user")
        db.session.add(user)
        db.session.commit()
        is_new_user = True

    token = create_access_token(identity=str(user.id))
    return jsonify({
        "status": "success",
        "message": "登录成功",
        "data": {"token": token, "user": user.to_dict(), "is_new_user": is_new_user}
    })


@auth_bp.route("/auth/wechat/miniprogram/phone", methods=["POST"])
@validate_request_data([
    {"name": "code", "type": str},
    {"name": "openid", "type": str}
])
def wechat_miniprogram_bind_phone(data):
    """微信小程序绑定手机号 — 前端 getPhoneNumber 获取 code → 后端解密手机号"""
    code = data["code"]
    openid = data["openid"]

    access_token = get_mp_access_token()
    url = f'https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={access_token}'
    resp = requests.post(url, json={'code': code}, timeout=10)
    result = resp.json()

    if result.get('errcode', 0) != 0:
        return jsonify({"status": "error", "message": "获取手机号失败"}), 400

    phone_number = result['phone_info']['purePhoneNumber']
    user = User.query.filter_by(wx_openid=openid).first()
    if user:
        user.phone = phone_number
        db.session.commit()

    return jsonify({
        "status": "success",
        "message": "手机号绑定成功",
        "data": {"user": user.to_dict() if user else None}
    })


@auth_bp.route("/auth/account", methods=["DELETE"])
@token_required
def delete_account(current_user):
    """删除用户账号，级联删除所有关联数据（宝宝、预约、生长记录、聊天、设备、订阅）"""
    force = request.args.get("force", "false").lower() == "true"

    uid = current_user.id
    baby_count = Baby.query.filter_by(user_id=uid).count()
    appointment_count = Appointment.query.filter_by(user_id=uid).count()
    growth_count = sum(
        GrowthRecord.query.filter(GrowthRecord.baby_id == b.id).count()
        for b in Baby.query.filter_by(user_id=uid).all()
    )
    chat_count = ChatMessage.query.filter_by(user_id=uid).count()
    sub_count = NotificationSubscription.query.filter_by(user_id=uid).count()
    device_count = DeviceToken.query.filter_by(user_id=uid).count()
    total_related = baby_count + appointment_count + growth_count + chat_count + sub_count + device_count

    if total_related > 0 and not force:
        return jsonify({
            "status": "confirm_required",
            "message": (
                f"删除账号将同时清除以下数据：\n"
                f"• {baby_count} 个宝宝（含其生长记录 {growth_count} 条）\n"
                f"• {appointment_count} 条预约记录\n"
                f"• {chat_count} 条聊天记录\n"
                f"• {sub_count} 条提醒订阅\n"
                f"• {device_count} 个登录设备\n"
                f"共计 {total_related} 条数据，此操作不可恢复，是否确认删除？"
            ),
            "data": {
                "babyCount": baby_count,
                "appointmentCount": appointment_count,
                "growthCount": growth_count,
                "chatCount": chat_count,
                "subCount": sub_count,
                "deviceCount": device_count,
                "totalRelated": total_related,
            }
        }), 409

    try:
        db.session.delete(current_user)
        db.session.commit()
        return jsonify({"status": "success", "message": "账号已删除"})
    except Exception as exc:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"删除失败: {exc}"}), 500
