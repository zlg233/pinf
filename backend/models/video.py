from datetime import datetime
from . import db


class Video(db.Model):
    __tablename__ = "videos"

    id = db.Column(db.Integer, primary_key=True)
    media_id = db.Column(db.String(128))
    name = db.Column(db.Text)
    url = db.Column(db.Text)
    title = db.Column(db.Text)
    description = db.Column(db.Text)
    down_url = db.Column(db.Text)
    # 出院状态分类：入院时 / 住院期间 / 出院当天 / 出院后；NULL 表示未分类
    category = db.Column(db.String(50), index=True)
    wechat_update_time = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "downUrl": self.down_url,
            "name": self.name,
            "category": self.category,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
