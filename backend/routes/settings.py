from flask import Blueprint, jsonify
from config import Config

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings/features", methods=["GET"])
def get_features():
    """返回前端功能开关状态，供前端控制页面/入口可见性"""
    return jsonify({
        "status": "success",
        "data": {
            "ai_qa": Config.FEATURE_AI_QA,
            "classroom_video": Config.FEATURE_CLASSROOM_VIDEO,
            "classroom_article": Config.FEATURE_CLASSROOM_ARTICLE,
        }
    })
