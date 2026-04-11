"""
Tests for wechat_content_sync helper functions.
"""
from utils.wechat_content_sync import _pick_content


class TestPickContent:
    """Test _pick_content function."""

    def test_returns_html_when_content_present(self):
        """优先返回完整 HTML 内容。"""
        news_item = {
            "content": "<p>这是完整文章内容</p><img src='x.jpg'/>",
            "digest": "这是摘要",
        }
        assert _pick_content(news_item) == "<p>这是完整文章内容</p><img src='x.jpg'/>"

    def test_falls_back_to_digest_when_no_content(self):
        """content 为空时降级到 digest。"""
        news_item = {"content": "", "digest": "只有摘要"}
        assert _pick_content(news_item) == "只有摘要"

    def test_falls_back_to_digest_when_content_missing(self):
        """content 字段不存在时降级到 digest。"""
        news_item = {"digest": "只有摘要"}
        assert _pick_content(news_item) == "只有摘要"

    def test_returns_default_when_both_empty(self):
        """content 和 digest 都为空时返回默认文本。"""
        assert _pick_content({}) == "暂无内容"
        assert _pick_content({"content": "  ", "digest": ""}) == "暂无内容"
