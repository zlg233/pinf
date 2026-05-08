import logging

from flask import Blueprint, request, jsonify
from models import db
from models.device_token import DeviceToken
from models.appointment import Appointment
from utils.auth import token_required, validate_request_data

logger = logging.getLogger(__name__)

devices_bp = Blueprint("devices", __name__)


@devices_bp.route("/devices", methods=["GET"])
@token_required
def list_devices(current_user):
    rows = DeviceToken.query.filter_by(user_id=current_user.id).all()
    return jsonify({"status": "success", "data": [r.to_dict() for r in rows]})


@devices_bp.route("/devices", methods=["POST"])
@token_required
@validate_request_data([
    {"name": "token", "type": str},
    {"name": "platform", "type": str},
])
def register_device(current_user, data):
    token = data.get("token")
    platform = data.get("platform")
    existing = DeviceToken.query.filter_by(token=token).first()
    try:
        if existing:
            # update owner or last_seen
            existing.user_id = current_user.id
            existing.platform = platform or existing.platform
            existing.last_seen_at = db.func.now()
            db.session.add(existing)
            db.session.commit()
            return jsonify({"status": "success", "message": "设备已更新", "data": existing.to_dict()})

        d = DeviceToken(user_id=current_user.id, token=token, platform=platform)
        db.session.add(d)
        db.session.commit()
        return jsonify({"status": "success", "message": "设备注册成功", "data": d.to_dict()})
    except Exception as exc:
        db.session.rollback()
        logger.exception("register device failed")
        return jsonify({"status": "error", "message": f"设备注册失败: {exc}"}), 500


@devices_bp.route("/devices/<int:device_id>", methods=["DELETE"])
@token_required
def unregister_device(current_user, device_id):
    d = DeviceToken.query.filter_by(id=device_id, user_id=current_user.id).first()
    if not d:
        return jsonify({"status": "error", "message": "设备未找到或无权限"}), 404
    try:
        db.session.delete(d)
        db.session.commit()
        return jsonify({"status": "success", "message": "设备已注销"})
    except Exception as exc:
        db.session.rollback()
        logger.exception("unregister device failed")
        return jsonify({"status": "error", "message": f"设备注销失败: {exc}"}), 500


@devices_bp.route("/devices/register/miniprogram", methods=["POST"])
@token_required
@validate_request_data([
    {"name": "openid", "type": str},
])
def register_miniprogram_device(current_user, data):
    """注册小程序设备（用于统计和会话管理）"""
    openid = data.get("openid")

    try:
        existing = DeviceToken.query.filter_by(token=openid).first()
        if existing:
            existing.user_id = current_user.id
            existing.platform = "wechat_mp"
            existing.last_seen_at = db.func.now()
            db.session.add(existing)
            db.session.commit()
            return jsonify({"status": "success", "message": "设备已更新", "data": existing.to_dict()})

        device = DeviceToken(
            user_id=current_user.id,
            token=openid,
            platform="wechat_mp",
        )
        db.session.add(device)
        db.session.commit()
        return jsonify({"status": "success", "message": "设备注册成功", "data": device.to_dict()})
    except Exception as exc:
        db.session.rollback()
        logger.exception("register miniprogram device failed")
        return jsonify({"status": "error", "message": f"设备注册失败: {exc}"}), 500
