"""
Tests for video API endpoints.
"""
import json
from unittest.mock import Mock, patch

import requests

from flask_jwt_extended import create_access_token

from models import db
from models.video import Video
from models.user import User
from routes.content import content_bp, _CACHE


def _register_blueprint_once(app):
    if "content" not in app.blueprints:
        app.register_blueprint(content_bp, url_prefix="/api")


def _auth_headers(app, user_id):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _ensure_user(app):
    with app.app_context():
        user = User.query.filter_by(phone="13800138099").first()
        if not user:
            user = User(phone="13800138099", name="VideoTester")
            db.session.add(user)
            db.session.commit()
        return user.id


class TestVideoRoutes:
    """Test video API routes."""

    def test_list_videos_empty(self, app, client):
        """空视频列表返回成功。"""
        _register_blueprint_once(app)
        _CACHE.clear()
        uid = _ensure_user(app)
        with app.app_context():
            resp = client.get("/api/content/videos", headers=_auth_headers(app, uid))
            body = json.loads(resp.data)
            assert resp.status_code == 200
            assert body["status"] == "success"
            assert body["data"] == []

    def test_list_videos_returns_data(self, app, client):
        """有视频时返回列表。"""
        _register_blueprint_once(app)
        _CACHE.clear()
        uid = _ensure_user(app)
        with app.app_context():
            video = Video(title="测试视频", description="描述", down_url="https://x.com/v.mp4")
            db.session.add(video)
            db.session.commit()
            vid = video.id

        with app.app_context():
            resp = client.get("/api/content/videos", headers=_auth_headers(app, uid))
            body = json.loads(resp.data)
            assert body["status"] == "success"
            assert len(body["data"]) == 1
            assert body["data"][0]["title"] == "测试视频"

        with app.app_context():
            v = Video.query.get(vid)
            if v:
                db.session.delete(v)
                db.session.commit()

    def test_get_video_detail(self, app, client):
        """获取视频详情。"""
        _register_blueprint_once(app)
        _CACHE.clear()
        uid = _ensure_user(app)
        with app.app_context():
            video = Video(title="详情视频", down_url="https://x.com/v2.mp4")
            db.session.add(video)
            db.session.commit()
            vid = video.id

        with app.app_context():
            resp = client.get(f"/api/content/videos/{vid}", headers=_auth_headers(app, uid))
            body = json.loads(resp.data)
            assert body["status"] == "success"
            assert body["data"]["title"] == "详情视频"

        with app.app_context():
            v = Video.query.get(vid)
            if v:
                db.session.delete(v)
                db.session.commit()

    def test_get_video_detail_not_found(self, app, client):
        """视频不存在返回 404。"""
        _register_blueprint_once(app)
        _CACHE.clear()
        uid = _ensure_user(app)
        with app.app_context():
            resp = client.get("/api/content/videos/99999", headers=_auth_headers(app, uid))
            assert resp.status_code == 404

    def test_get_video_detail_resolves_play_url_when_requested(self, app, client):
        """小程序按需请求时返回 MP4，原始微信页面地址仍保留。"""
        _register_blueprint_once(app)
        uid = _ensure_user(app)
        page = "http://mp.weixin.qq.com/mp/mp/video?vid=abc"
        media = "http://mpvideo.qpic.cn/video.mp4?auth_key=abc"
        with app.app_context():
            video = Video(title="微信素材", down_url=page)
            db.session.add(video)
            db.session.commit()
            video_id = video.id

        response = Mock()
        response.json.return_value = {
            "video_page_info": {"mp_video_trans_info": [{"url": media}]}
        }
        with patch("utils.wechat_video_play_url.requests.get", return_value=response):
            result = client.get(
                f"/api/content/videos/{video_id}?include_play_url=1",
                headers=_auth_headers(app, uid),
            )

        body = result.get_json()
        assert result.status_code == 200
        assert body["data"]["playUrl"] == "https://mpvideo.qpic.cn/video.mp4?auth_key=abc"
        assert body["data"]["downUrl"] == page
        assert result.headers["Cache-Control"] == "no-store"

    def test_get_video_detail_without_opt_in_keeps_original_contract(self, app, client):
        """App 不请求 playUrl 时保持原响应，且不访问微信页面。"""
        _register_blueprint_once(app)
        uid = _ensure_user(app)
        page = "https://mp.weixin.qq.com/mp/mp/video?vid=abc"
        with app.app_context():
            video = Video(title="微信素材", down_url=page)
            db.session.add(video)
            db.session.commit()
            video_id = video.id

        with patch(
            "utils.wechat_video_play_url.requests.get",
            side_effect=AssertionError("不应解析视频地址"),
        ):
            result = client.get(
                f"/api/content/videos/{video_id}", headers=_auth_headers(app, uid)
            )

        assert result.status_code == 200
        assert result.get_json()["data"]["downUrl"] == page
        assert "playUrl" not in result.get_json()["data"]

    def test_get_video_detail_keeps_metadata_when_upstream_times_out(self, app, client):
        """微信页面超时时详情仍可显示，小程序可重试获取播放地址。"""
        _register_blueprint_once(app)
        uid = _ensure_user(app)
        page = "https://mp.weixin.qq.com/mp/mp/video?vid=abc"
        with app.app_context():
            video = Video(title="微信素材", down_url=page)
            db.session.add(video)
            db.session.commit()
            video_id = video.id

        with patch(
            "utils.wechat_video_play_url.requests.get", side_effect=requests.Timeout
        ):
            result = client.get(
                f"/api/content/videos/{video_id}?include_play_url=1",
                headers=_auth_headers(app, uid),
            )

        assert result.status_code == 200
        assert result.get_json()["data"]["title"] == "微信素材"
        assert result.get_json()["data"]["playUrl"] is None
