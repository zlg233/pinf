"""知识库无命中时的补充检索。

设计约束：
- 任何失败都返回空列表，绝不影响主问答；
- 只取标题 + 摘要，不透传原始 HTML；
- 权威域名优先排序，避免营销号内容排在前面。
"""

import html
import json
import logging
import re
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

TAVILY_ENDPOINT = "https://api.tavily.com/search"
CONTENT_LIMIT = 220

AUTHORITATIVE_HOSTS = (
    "nhc.gov.cn",
    "cma.org.cn",
    "cps.org.cn",
    "who.int",
    "cdc.gov.cn",
    "gov.cn",
    "msdmanuals.cn",
    "healthychildren.org",
    "mayoclinic.org",
)

# 商业品牌、计算器工具、电商导购类站点：内容常见营销话术或非医学口径
LOW_QUALITY_HOSTS = (
    "meadjohnson",
    "neofast",
    "jd.com",
    "taobao",
    "tmall",
    "pinduoduo",
    "smzdm",
    "1688.com",
)

PEDIATRIC_HINTS = (
    "早产儿",
    "新生儿",
    "婴儿",
    "宝宝",
    "儿童",
    "幼儿",
    "婴儿期",
    "月龄",
    "儿科",
    "矫正月龄",
    "矫正年龄",
)

ADULT_HINTS = ("成年人", "成人", "adult", "老年人", "老年")

QUERY_SUFFIX = "婴儿 儿童 儿科"

_READ_MORE = re.compile(r"\s*(\.{2,}|…)?\s*(Read more|阅读全文|查看更多).*$", re.I)
_BACKSLASHES = re.compile(r"\\+")
_SPACES = re.compile(r"\s+")
_NAV_PREFIX = re.compile(r"^\s*当前位置[:：][^【\n]{0,120}?\s*(?=【)")
_NAV_PREFIX_PLAIN = re.compile(r"^\s*当前位置[:：][^\n]{0,80}?\s{2,}")
_UI_NOISE = re.compile(r"(文字变小|文字变大|恢复文字大小|打印本页|分享到|字号)[;；]?\)?\s*")
_META_LEAD = re.compile(
    r"^\s*(?:-?\s*发布日期[:：][^\s]{0,40}\s*)?"
    r"(?:-?\s*(?:来源|作者)[:：][^\s]{0,40}\s*)?"
    r"(?:-?\s*分享[:：]?\s*[Xx]?\s*)?"
)


class WebSearchClient:
    def __init__(self, provider="tavily", api_key="", timeout=6, max_results=3, content_limit=CONTENT_LIMIT):
        self.provider = (provider or "").strip().lower()
        self.api_key = (api_key or "").strip()
        self.timeout = max(1, int(timeout))
        self.max_results = max(1, int(max_results))
        self.content_limit = max(40, int(content_limit))

    def available(self):
        return self.provider == "tavily" and bool(self.api_key)

    def search(self, query):
        query = (query or "").strip()
        if not query or not self.available():
            return []
        try:
            request = urllib.request.Request(
                TAVILY_ENDPOINT,
                data=json.dumps(self._payload(query)).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - 补充检索失败必须降级
            logger.warning("补充检索失败，本轮按无资料处理：%s", exc)
            return []
        return self.rank(self.normalize(body))

    def _payload(self, query):
        return {
            "api_key": self.api_key,
            "query": self._augment(query),
            "max_results": self.max_results,
            "search_depth": "basic",
            "include_answer": False,
            "include_raw_content": False,
        }

    def _augment(self, query):
        """问题里没有儿科限定词时补上，避免搜到成人或通用内容。"""
        if any(hint in query for hint in PEDIATRIC_HINTS):
            return query
        return f"{query} {QUERY_SUFFIX}"

    def _clean(self, text):
        """清洗抓取残留：导航前缀、界面按钮、HTML 实体、Read more 尾巴、反斜杠转义。"""
        cleaned = html.unescape(text or "")
        cleaned = cleaned.replace("\xa0", " ")
        cleaned = _NAV_PREFIX.sub("", cleaned)
        cleaned = _NAV_PREFIX_PLAIN.sub("", cleaned)
        cleaned = _UI_NOISE.sub(" ", cleaned)
        cleaned = _META_LEAD.sub("", cleaned)
        cleaned = _READ_MORE.sub("", cleaned)
        cleaned = _BACKSLASHES.sub("", cleaned)
        return _SPACES.sub(" ", cleaned).strip(" -—")

    def _is_adult_only(self, title, content):
        text = f"{title}{content}"
        if not any(hint in text for hint in ADULT_HINTS):
            return False
        return not any(hint in text for hint in PEDIATRIC_HINTS)

    def _strip_leading_title(self, title, content):
        """正文开头重复标题时剥掉，避免《标题》标题 的重复观感。"""
        if title and title != "未命名资料" and content.startswith(title):
            return content[len(title):].lstrip(" -—:：")
        return content

    def normalize(self, body):
        results = (body or {}).get("results") or []
        hits = []
        for item in results:
            title = self._clean(item.get("title") or "") or "未命名资料"
            content = self._clean(item.get("content") or "")
            content = self._strip_leading_title(title, content)
            content = _META_LEAD.sub("", content).strip(" -—")
            if not content or self._is_adult_only(title, content):
                continue
            hits.append(
                {
                    "title": title,
                    "content": content[: self.content_limit],
                    "url": (item.get("url") or "").strip(),
                    "score": float(item.get("score") or 0.0),
                }
            )
            if len(hits) >= self.max_results:
                break
        return hits

    def rank(self, hits):
        def weight(hit):
            url = (hit.get("url") or "").lower()
            authoritative = any(host in url for host in AUTHORITATIVE_HOSTS)
            low_quality = any(host in url for host in LOW_QUALITY_HOSTS)
            return (
                0 if authoritative else 1,
                1 if low_quality else 0,
                -float(hit.get("score") or 0.0),
            )

        return sorted(hits, key=weight)
