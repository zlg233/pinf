"""管理员内容分类接口的测试。

覆盖：权限、改分类、非法值、清空、404、未分类筛选、视频列表按分类过滤。
"""

import json

from flask_jwt_extended import create_access_token

from models import db
from models.content import Article
from models.user import User
from models.video import Video
from routes.admin_content import admin_content_bp
from routes.content import content_bp, _CACHE


def _register(app):
    if "admin_content" not in app.blueprints:
        app.register_blueprint(admin_content_bp, url_prefix="/api")
    if "content" not in app.blueprints:
        app.register_blueprint(content_bp, url_prefix="/api")
    _CACHE.clear()


def _make_user(app, phone, role="user"):
    with app.app_context():
        user = User(phone=phone, name=phone, role=role)
        db.session.add(user)
        db.session.commit()
        return user.id


def _headers(app, user_id):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _make_article(app, title="测试文章", category=None):
    with app.app_context():
        article = Article(title=title, content="正文", category=category)
        db.session.add(article)
        db.session.commit()
        return article.id


def _make_video(app, title="测试视频", category=None):
    with app.app_context():
        video = Video(title=title, description="描述", category=category)
        db.session.add(video)
        db.session.commit()
        return video.id


class TestAdminAuth:
    def test_未登录返回401(self, app, client):
        _register(app)
        article_id = _make_article(app)
        resp = client.patch(f"/api/admin/content/articles/{article_id}", json={"category": "入院时"})
        assert resp.status_code == 401

    def test_普通用户返回403(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000001", "user")
        article_id = _make_article(app)
        resp = client.patch(
            f"/api/admin/content/articles/{article_id}",
            json={"category": "入院时"},
            headers=_headers(app, uid),
        )
        assert resp.status_code == 403
        with app.app_context():
            assert Article.query.get(article_id).category is None


class TestAdminUpdateArticle:
    def test_管理员可以修改文章分类(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000002", "admin")
        article_id = _make_article(app)
        resp = client.patch(
            f"/api/admin/content/articles/{article_id}",
            json={"category": "出院后"},
            headers=_headers(app, uid),
        )
        assert resp.status_code == 200
        body = json.loads(resp.data)
        assert body["status"] == "success"
        assert body["data"]["category"] == "出院后"
        with app.app_context():
            assert Article.query.get(article_id).category == "出院后"

    def test_非法分类返回400(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000003", "admin")
        article_id = _make_article(app)
        resp = client.patch(
            f"/api/admin/content/articles/{article_id}",
            json={"category": "出院前"},
            headers=_headers(app, uid),
        )
        assert resp.status_code == 400
        with app.app_context():
            assert Article.query.get(article_id).category is None

    def test_空字符串表示清空分类(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000004", "admin")
        article_id = _make_article(app, category="入院时")
        resp = client.patch(
            f"/api/admin/content/articles/{article_id}",
            json={"category": ""},
            headers=_headers(app, uid),
        )
        assert resp.status_code == 200
        with app.app_context():
            assert Article.query.get(article_id).category is None

    def test_缺少category字段返回400且不改数据(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000013", "admin")
        article_id = _make_article(app, category="入院时")
        resp = client.patch(
            f"/api/admin/content/articles/{article_id}",
            json={},
            headers=_headers(app, uid),
        )
        assert resp.status_code == 400
        with app.app_context():
            assert Article.query.get(article_id).category == "入院时"

    def test_不存在的文章返回404(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000005", "admin")
        resp = client.patch(
            "/api/admin/content/articles/999999",
            json={"category": "入院时"},
            headers=_headers(app, uid),
        )
        assert resp.status_code == 404

    def test_请求体夹带其它字段被忽略(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000006", "admin")
        article_id = _make_article(app, title="原标题")
        resp = client.patch(
            f"/api/admin/content/articles/{article_id}",
            json={"category": "随访" if False else "住院期间", "title": "改标题"},
            headers=_headers(app, uid),
        )
        assert resp.status_code == 200
        with app.app_context():
            article = Article.query.get(article_id)
            assert article.category == "住院期间"
            assert article.title == "原标题"


class TestAdminUpdateVideo:
    def test_管理员可以修改视频分类(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000007", "admin")
        video_id = _make_video(app)
        resp = client.patch(
            f"/api/admin/content/videos/{video_id}",
            json={"category": "住院期间"},
            headers=_headers(app, uid),
        )
        assert resp.status_code == 200
        with app.app_context():
            assert Video.query.get(video_id).category == "住院期间"


class TestAdminList:
    def test_未分类筛选只返回空分类(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000008", "admin")
        _make_article(app, title="有分类", category="入院时")
        _make_article(app, title="没分类")
        resp = client.get("/api/admin/content/articles?uncategorized=1", headers=_headers(app, uid))
        body = json.loads(resp.data)
        assert resp.status_code == 200
        assert [item["title"] for item in body["data"]] == ["没分类"]

    def test_按分类筛选(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000009", "admin")
        _make_article(app, title="入院文章", category="入院时")
        _make_article(app, title="出院文章", category="出院后")
        resp = client.get("/api/admin/content/articles?category=出院后", headers=_headers(app, uid))
        body = json.loads(resp.data)
        assert [item["title"] for item in body["data"]] == ["出院文章"]

    def test_管理端列表包含分页信息(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000010", "admin")
        for index in range(3):
            _make_article(app, title=f"文章{index}")
        resp = client.get("/api/admin/content/articles?page=1&per_page=2", headers=_headers(app, uid))
        body = json.loads(resp.data)
        assert len(body["data"]) == 2
        assert body["pagination"]["total"] == 3
        assert body["pagination"]["hasNext"] is True


class TestPublicVideoFilter:
    def test_视频列表支持按分类筛选(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000011", "user")
        _make_video(app, title="入院视频", category="入院时")
        _make_video(app, title="出院视频", category="出院后")
        resp = client.get(
            "/api/content/videos?category=出院后",
            headers=_headers(app, uid),
        )
        body = json.loads(resp.data)
        assert [item["title"] for item in body["data"]] == ["出院视频"]

    def test_视频列表不带分类时返回全部(self, app, client):
        _register(app)
        uid = _make_user(app, "13000000012", "user")
        _make_video(app, title="入院视频", category="入院时")
        _make_video(app, title="未分类视频")
        resp = client.get("/api/content/videos", headers=_headers(app, uid))
        body = json.loads(resp.data)
        assert len(body["data"]) == 2
