"""文章正文归一化的管线测试：模型回落、接口输出、同步入库。"""

from flask_jwt_extended import create_access_token

from models import db
from models.content import Article
from models.user import User
from routes.content import content_bp, _CACHE
from utils.wechat_content_sync import _upsert_article_from_news

MESSY_HTML = (
    '<section style="font-size:16px;letter-spacing:1px">'
    '<p>正文</p>'
    '<img data-src="https://mmbiz.qpic.cn/a/640?wx_fmt=png" data-w="1080" style="width:1080px">'
    "</section>"
)


def _register(app):
    if "content" not in app.blueprints:
        app.register_blueprint(content_bp, url_prefix="/api")
    _CACHE.clear()


def _make_user(app, phone="13100000001"):
    with app.app_context():
        user = User(phone=phone, name="tester")
        db.session.add(user)
        db.session.commit()
        return user.id


def _headers(app, user_id):
    with app.app_context():
        return {"Authorization": f"Bearer {create_access_token(identity=str(user_id))}"}


class TestModelFallback:
    def test_没有归一化结果时回退原文(self, app):
        with app.app_context():
            article = Article(title="t", content=MESSY_HTML)
            db.session.add(article)
            db.session.commit()
            assert article.to_dict()["content"] == MESSY_HTML

    def test_有归一化结果时优先返回(self, app):
        with app.app_context():
            article = Article(title="t", content=MESSY_HTML, content_normalized="<p>干净</p>")
            db.session.add(article)
            db.session.commit()
            assert article.to_dict()["content"] == "<p>干净</p>"


class TestSyncNormalizes:
    def test_同步入库时写入归一化结果(self, app):
        news_item = {
            "title": "测试文章",
            "content": MESSY_HTML,
            "url": "https://mp.weixin.qq.com/s/abc",
            "author": "公众号",
            "create_time": 1700000000,
        }
        with app.app_context():
            _upsert_article_from_news(news_item)
            db.session.commit()
            article = Article.query.filter_by(title="测试文章").first()
            assert article.content == MESSY_HTML, "原文必须保留"
            assert article.content_normalized
            assert "width:100%" in article.content_normalized
            assert "1080" not in article.content_normalized


class TestApiReturnsNormalized:
    def test_文章详情接口返回归一化正文(self, app, client):
        _register(app)
        uid = _make_user(app)
        with app.app_context():
            article = Article(
                title="接口测试",
                content=MESSY_HTML,
                content_normalized='<p>已归一化</p><img style="width:100%">',
            )
            db.session.add(article)
            db.session.commit()
            article_id = article.id

        resp = client.get(f"/api/content/articles/{article_id}", headers=_headers(app, uid))
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["data"]["content"] == '<p>已归一化</p><img style="width:100%">'
