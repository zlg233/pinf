"""微信小程序登录端点测试"""
from unittest.mock import patch

from routes.auth import auth_bp


def _register_auth_bp(app):
    if "auth" not in app.blueprints:
        app.register_blueprint(auth_bp, url_prefix="/api")


class TestWechatMiniprogramLogin:
    """POST /api/auth/wechat/miniprogram"""

    def test_login_creates_new_user(self, client, app):
        _register_auth_bp(app)

        with patch('routes.auth.code2session') as mock_cs:
            mock_cs.return_value = {"openid": "test_openid_12345", "session_key": "sk"}

            res = client.post('/api/auth/wechat/miniprogram', json={"code": "test_code"})
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "success"
            assert "token" in data["data"]
            assert data["data"]["is_new_user"] is True
            assert data["data"]["user"]["wxOpenid"] == "test_openid_12345"

    def test_login_returns_existing_user(self, client, app):
        _register_auth_bp(app)

        with patch('routes.auth.code2session') as mock_cs:
            mock_cs.return_value = {"openid": "test_openid_12345", "session_key": "sk"}

            res1 = client.post('/api/auth/wechat/miniprogram', json={"code": "code1"})
            assert res1.get_json()["data"]["is_new_user"] is True

            res2 = client.post('/api/auth/wechat/miniprogram', json={"code": "code2"})
            assert res2.status_code == 200
            assert res2.get_json()["data"]["is_new_user"] is False

    def test_login_wechat_api_error(self, client, app):
        _register_auth_bp(app)

        with patch('routes.auth.code2session') as mock_cs:
            mock_cs.return_value = {"errcode": 40029, "errmsg": "invalid code"}

            res = client.post('/api/auth/wechat/miniprogram', json={"code": "bad_code"})
            assert res.status_code == 400
            assert res.get_json()["status"] == "error"

    def test_login_missing_code(self, client, app):
        _register_auth_bp(app)

        res = client.post('/api/auth/wechat/miniprogram', json={})
        assert res.status_code == 400


class TestWechatMiniprogramPhone:
    """POST /api/auth/wechat/miniprogram/phone"""

    def test_bind_phone_success(self, client, app):
        _register_auth_bp(app)

        with patch('routes.auth.code2session') as mock_cs:
            mock_cs.return_value = {"openid": "test_openid_67890", "session_key": "sk"}
            client.post('/api/auth/wechat/miniprogram', json={"code": "code1"})

        with patch('routes.auth.get_mp_access_token') as mock_token, \
             patch('routes.auth.requests.post') as mock_post:
            mock_token.return_value = "test_access_token"
            mock_post.return_value.json.return_value = {
                "errcode": 0,
                "errmsg": "ok",
                "phone_info": {"purePhoneNumber": "13800138000"}
            }

            res = client.post('/api/auth/wechat/miniprogram/phone', json={
                "code": "phone_code",
                "openid": "test_openid_67890"
            })
            assert res.status_code == 200
            assert res.get_json()["status"] == "success"
            assert res.get_json()["data"]["user"]["phone"] == "13800138000"

    def test_bind_phone_user_not_found(self, client, app):
        _register_auth_bp(app)

        with patch('routes.auth.get_mp_access_token') as mock_token, \
             patch('routes.auth.requests.post') as mock_post:
            mock_token.return_value = "test_token"
            mock_post.return_value.json.return_value = {
                "errcode": 0,
                "errmsg": "ok",
                "phone_info": {"purePhoneNumber": "13800138000"}
            }

            res = client.post('/api/auth/wechat/miniprogram/phone', json={
                "code": "phone_code",
                "openid": "nonexistent"
            })
            assert res.status_code == 200
            assert res.get_json()["data"]["user"] is None
