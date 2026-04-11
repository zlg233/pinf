"""
Tests for Video model.
"""
from models.video import Video
from models import db


class TestVideoModel:
    """Test Video model."""

    def test_video_to_dict(self, app):
        """Test video to_dict returns expected fields."""
        with app.app_context():
            video = Video(
                title="测试视频",
                description="视频描述",
                down_url="https://example.com/video.mp4",
                name="test.mp4",
            )
            db.session.add(video)
            db.session.commit()

            result = video.to_dict()
            assert result["id"] == video.id
            assert result["title"] == "测试视频"
            assert result["description"] == "视频描述"
            assert result["downUrl"] == "https://example.com/video.mp4"
            assert result["name"] == "test.mp4"
            assert "createdAt" in result

            db.session.delete(video)
            db.session.commit()

    def test_video_to_dict_null_fields(self, app):
        """Test to_dict handles null fields gracefully."""
        with app.app_context():
            video = Video(title="仅标题")
            db.session.add(video)
            db.session.commit()

            result = video.to_dict()
            assert result["title"] == "仅标题"
            assert result["description"] is None
            assert result["downUrl"] is None

            db.session.delete(video)
            db.session.commit()
