"""小程序订阅消息端点测试"""
from datetime import datetime, timedelta
from unittest.mock import patch

from flask_jwt_extended import create_access_token

from models import db
from models.appointment import Appointment
from models.notification_subscription import NotificationSubscription
from routes.notifications import notifications_bp


def _register_bp(app):
    if "notifications" not in app.blueprints:
        app.register_blueprint(notifications_bp, url_prefix="/api")


def _auth_headers(app, user_id):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


class TestMiniprogramSubscribe:
    """POST /api/notifications/subscribe/miniprogram"""

    def test_subscribe_success(self, client, app, sample_user):
        _register_bp(app)

        with app.app_context():
            apt = Appointment(
                user_id=sample_user.id,
                clinic="Test Clinic",
                department="Pediatrics",
                scheduled_at=datetime.utcnow() + timedelta(days=3),
                status="pending",
            )
            db.session.add(apt)
            db.session.commit()
            apt_id = apt.id

        remind_time = (datetime.utcnow() + timedelta(days=2)).isoformat()
        res = client.post(
            '/api/notifications/subscribe/miniprogram',
            json={
                "appointment_id": apt_id,
                "openid": "test_openid_mp",
                "remind_time": remind_time,
            },
            headers=_auth_headers(app, sample_user.id),
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "success"
        assert data["data"]["channel"] == "wechat_mp"
        assert data["data"]["token"] == "test_openid_mp"

    def test_subscribe_unauthorized(self, client, app):
        _register_bp(app)

        res = client.post(
            '/api/notifications/subscribe/miniprogram',
            json={
                "appointment_id": 1,
                "openid": "test",
                "remind_time": datetime.utcnow().isoformat(),
            },
        )
        assert res.status_code == 401

    def test_subscribe_missing_fields(self, client, app, sample_user):
        _register_bp(app)

        res = client.post(
            '/api/notifications/subscribe/miniprogram',
            json={"appointment_id": 1},
            headers=_auth_headers(app, sample_user.id),
        )
        assert res.status_code == 400


class TestSendMiniprogram:
    """POST /api/notifications/send/miniprogram"""

    def test_send_success(self, client, app, sample_user):
        _register_bp(app)

        with app.app_context():
            apt = Appointment(
                user_id=sample_user.id,
                clinic="Test Clinic",
                department="Pediatrics",
                scheduled_at=datetime.utcnow() + timedelta(days=3),
                status="pending",
            )
            db.session.add(apt)
            db.session.commit()

            sub = NotificationSubscription(
                user_id=sample_user.id,
                appointment_id=apt.id,
                channel="wechat_mp",
                token="test_openid_mp",
                remind_time=datetime.utcnow() + timedelta(days=2),
                status="pending",
            )
            db.session.add(sub)
            db.session.commit()
            sub_id = sub.id

        with patch('routes.notifications.send_subscribe_message') as mock_send:
            mock_send.return_value = {"errcode": 0, "errmsg": "ok"}

            res = client.post(
                '/api/notifications/send/miniprogram',
                json={"subscription_id": sub_id},
            )
            assert res.status_code == 200
            assert res.get_json()["status"] == "success"

    def test_send_invalid_subscription(self, client, app):
        _register_bp(app)

        res = client.post(
            '/api/notifications/send/miniprogram',
            json={"subscription_id": 99999},
        )
        assert res.status_code == 400

    def test_send_missing_subscription_id(self, client, app):
        _register_bp(app)

        res = client.post('/api/notifications/send/miniprogram', json={})
        assert res.status_code == 400
