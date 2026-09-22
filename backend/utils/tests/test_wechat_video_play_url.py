"""微信公众号视频页面到可播放地址的解析测试。"""

from urllib.parse import parse_qs, urlsplit
from unittest.mock import Mock, patch

import requests


def test_resolve_wechat_video_page_returns_mp4_url():
    from utils.wechat_video_play_url import resolve_video_play_url

    page = "https://mp.weixin.qq.com/mp/mp/video?vid=abc#fragment"
    media = "https://mpvideo.qpic.cn/example.mp4?auth_key=abc"
    response = Mock()
    response.json.return_value = {
        "video_page_info": {
            "mp_video_trans_info": [{"url": media}],
        }
    }
    with patch("utils.wechat_video_play_url.requests.get", return_value=response) as get:
        assert resolve_video_play_url(page) == media
    request_url = urlsplit(get.call_args.args[0])
    assert request_url.fragment == ""
    assert parse_qs(request_url.query) == {"vid": ["abc"], "f": ["json"]}


def test_resolve_wechat_video_page_without_query_adds_json_parameter():
    from utils.wechat_video_play_url import resolve_video_play_url

    response = Mock()
    response.json.return_value = {
        "video_page_info": {
            "mp_video_trans_info": [
                {"url": "https://mpvideo.qpic.cn/video.mp4?auth_key=abc"}
            ]
        }
    }
    with patch("utils.wechat_video_play_url.requests.get", return_value=response) as get:
        assert resolve_video_play_url("https://mp.weixin.qq.com/mp/mp/video")
    assert get.call_args.args[0] == "https://mp.weixin.qq.com/mp/mp/video?f=json"


def test_resolve_rejects_untrusted_page_without_network_request():
    from utils.wechat_video_play_url import resolve_video_play_url

    with patch(
        "utils.wechat_video_play_url.requests.get",
        side_effect=AssertionError("不应请求不可信地址"),
    ):
        assert resolve_video_play_url("https://evil.example/mp/mp/video") is None
        assert resolve_video_play_url("https://mp.weixin.qq.com.evil.example/mp/mp/video") is None
        assert resolve_video_play_url("https://mp.weixin.qq.com/other") is None


def test_resolve_skips_untrusted_media_candidate():
    from utils.wechat_video_play_url import resolve_video_play_url

    response = Mock()
    response.json.return_value = {
        "video_page_info": {
            "mp_video_trans_info": [
                {"url": "https://evil.example/video.mp4"},
                {"url": "https://mpvideo.qpic.cn/good.mp4?auth_key=abc"},
            ]
        }
    }
    with patch("utils.wechat_video_play_url.requests.get", return_value=response):
        assert resolve_video_play_url("https://mp.weixin.qq.com/mp/mp/video") == (
            "https://mpvideo.qpic.cn/good.mp4?auth_key=abc"
        )


def test_resolve_returns_none_for_missing_media_list():
    from utils.wechat_video_play_url import resolve_video_play_url

    response = Mock()
    response.json.return_value = {"video_page_info": {"mp_video_trans_info": []}}
    with patch("utils.wechat_video_play_url.requests.get", return_value=response):
        assert resolve_video_play_url("https://mp.weixin.qq.com/mp/mp/video") is None


def test_resolve_returns_none_on_upstream_timeout():
    from utils.wechat_video_play_url import resolve_video_play_url

    with patch("utils.wechat_video_play_url.requests.get", side_effect=requests.Timeout):
        assert resolve_video_play_url("https://mp.weixin.qq.com/mp/mp/video") is None


def test_resolve_preserves_existing_direct_https_video():
    from utils.wechat_video_play_url import resolve_video_play_url

    media = "https://cdn.example.com/video.mp4?token=abc"
    with patch(
        "utils.wechat_video_play_url.requests.get",
        side_effect=AssertionError("无需解析直链"),
    ):
        assert resolve_video_play_url(media) == media
