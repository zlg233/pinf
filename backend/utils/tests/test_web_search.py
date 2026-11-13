"""补充检索客户端的单元测试（不触网）。"""

import json
import urllib.error

from utils import web_search


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_未配置密钥时不可用():
    client = web_search.WebSearchClient(provider="tavily", api_key="")
    assert client.available() is False
    assert client.search("早产儿头围") == []


def test_解析结果并保留标题摘要(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout=None):
        captured["url"] = request.full_url
        captured["body"] = json.loads(request.data.decode())
        captured["timeout"] = timeout
        return FakeResponse(
            {
                "results": [
                    {
                        "title": "头围监测",
                        "content": "早产儿头围应结合矫正月龄评估。",
                        "url": "https://example.org/a",
                    },
                    {"title": "", "content": "", "url": ""},
                ]
            }
        )

    monkeypatch.setattr(web_search.urllib.request, "urlopen", fake_urlopen)
    client = web_search.WebSearchClient(provider="tavily", api_key="k", max_results=3)
    hits = client.search("早产儿头围多少正常")

    assert len(hits) == 1
    assert hits[0]["title"] == "头围监测"
    assert "矫正月龄" in hits[0]["content"]
    assert captured["body"]["query"] == "早产儿头围多少正常"
    assert captured["body"]["api_key"] == "k"
    assert captured["timeout"] == client.timeout


def test_请求异常时静默降级(monkeypatch):
    def boom(*args, **kwargs):
        raise urllib.error.URLError("timeout")

    monkeypatch.setattr(web_search.urllib.request, "urlopen", boom)
    client = web_search.WebSearchClient(provider="tavily", api_key="k")
    assert client.search("早产儿头围") == []


def test_非200状态码静默降级(monkeypatch):
    def boom(*args, **kwargs):
        raise urllib.error.HTTPError("u", 429, "rate limited", {}, None)

    monkeypatch.setattr(web_search.urllib.request, "urlopen", boom)
    client = web_search.WebSearchClient(provider="tavily", api_key="k")
    assert client.search("早产儿头围") == []


def test_未知provider直接返回空():
    client = web_search.WebSearchClient(provider="unknown", api_key="k")
    assert client.search("早产儿头围") == []


def test_权威域名优先排序():
    client = web_search.WebSearchClient(provider="tavily", api_key="k")
    ranked = client.rank(
        [
            {"title": "自媒体", "content": "a", "url": "https://weibo.com/x"},
            {"title": "国家卫健委", "content": "b", "url": "https://www.nhc.gov.cn/yzygj/s7653/202001/x.shtml"},
        ]
    )
    assert ranked[0]["title"] == "国家卫健委"


def test_结果条数与摘要长度受限():
    client = web_search.WebSearchClient(provider="tavily", api_key="k", max_results=1)
    hits = client.normalize(
        {
            "results": [
                {"title": "A", "content": "字" * 2000, "url": "https://a.example"},
                {"title": "B", "content": "b", "url": "https://b.example"},
            ]
        }
    )
    assert len(hits) == 1
    assert len(hits[0]["content"]) <= client.content_limit
