"""知识库无命中时的补充检索。

设计约束：
- 任何失败都返回空列表，绝不影响主问答；
- 只取标题 + 摘要，不透传原始 HTML；
- 权威域名优先排序，避免营销号内容排在前面。
"""

import json
import logging
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
            "query": query,
            "max_results": self.max_results,
            "search_depth": "basic",
            "include_answer": False,
            "include_raw_content": False,
        }

    def normalize(self, body):
        results = (body or {}).get("results") or []
        hits = []
        for item in results:
            content = (item.get("content") or "").strip()
            if not content:
                continue
            hits.append(
                {
                    "title": (item.get("title") or "").strip() or "未命名资料",
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
            return (0 if authoritative else 1, -float(hit.get("score") or 0.0))

        return sorted(hits, key=weight)
