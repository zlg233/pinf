"""按需从公众号视频页面读取可播放地址。"""

import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests


logger = logging.getLogger(__name__)
WECHAT_PAGE_HOST = "mp.weixin.qq.com"
WECHAT_VIDEO_HOST = "mpvideo.qpic.cn"


def _is_https_host(value, host):
    try:
        parsed = urlsplit(value)
        return (
            parsed.scheme == "https"
            and parsed.hostname == host
            and parsed.port is None
            and parsed.username is None
            and parsed.password is None
        )
    except ValueError:
        return False


def resolve_video_play_url(down_url):
    """返回微信视频临时直链、已有 HTTPS 直链，或 None。"""
    if not down_url or not isinstance(down_url, str):
        return None
    down_url = down_url.strip()
    try:
        page = urlsplit(down_url)
    except ValueError:
        return None
    if page.scheme == "http" and page.hostname == WECHAT_PAGE_HOST:
        down_url = urlunsplit(("https", page.netloc, page.path, page.query, page.fragment))
        page = urlsplit(down_url)
    if page.scheme != "https" or not page.hostname:
        return None
    if page.hostname != WECHAT_PAGE_HOST:
        return down_url if page.path.lower().endswith(".mp4") else None
    if not _is_https_host(down_url, WECHAT_PAGE_HOST) or page.path != "/mp/mp/video":
        return None

    query = [(key, value) for key, value in parse_qsl(page.query) if key != "f"]
    query.append(("f", "json"))
    json_url = urlunsplit(("https", WECHAT_PAGE_HOST, page.path, urlencode(query), ""))
    try:
        response = requests.get(json_url, timeout=(2, 5), allow_redirects=False)
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("微信视频地址解析失败: %s", type(exc).__name__)
        return None

    if not isinstance(payload, dict):
        return None
    page_info = payload.get("video_page_info")
    if not isinstance(page_info, dict):
        return None
    candidates = page_info.get("mp_video_trans_info")
    if not isinstance(candidates, list):
        return None
    for candidate in candidates:
        if isinstance(candidate, dict):
            media_url = candidate.get("url")
            if isinstance(media_url, str) and _is_https_host(media_url, WECHAT_VIDEO_HOST):
                return media_url
    return None
