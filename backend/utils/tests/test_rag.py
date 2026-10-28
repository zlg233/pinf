"""RAG 检索链路的单元测试（不依赖模型、数据库与网络）。"""

import json

import numpy as np

from utils.rag import (
    RagService,
    build_context_block,
    inject_context,
    prepare_query_text,
    rank_scores,
)
from utils.rag_import import map_snapshot_rows


class FakeEmbedder:
    def __init__(self, vector):
        self.vector = vector

    def encode(self, text):
        return self.vector


class BrokenEmbedder:
    def encode(self, text):
        raise RuntimeError("model exploded")


class FakeStore:
    def __init__(self, matrix, rows):
        self.matrix = matrix
        self.rows = rows

    def load(self):
        return self.matrix, self.rows


def test_长消息只保留末尾以便命中真问题():
    text = "铺垫" * 300 + "早产儿出院后如何随访？"
    prepared = prepare_query_text(text, max_chars=50)
    assert prepared.endswith("随访？")
    assert len(prepared) == 50


def test_排序按分数降序并过滤阈值():
    scores = np.array([0.4, 0.9, 0.7, 0.55], dtype=np.float32)
    assert rank_scores(scores, top_k=2, min_score=0.5) == [(1, 0.9), (2, 0.7)]


def test_低于阈值不返回():
    assert rank_scores(np.array([0.1, 0.2]), top_k=3, min_score=0.55) == []


def test_空结果不产生上下文():
    assert build_context_block([]) == ""
    assert inject_context("问题", "") == "问题"


def test_上下文带出处且受长度上限约束():
    hits = [
        {
            "content": "早产儿出院后应在出院后 1～2 周内首次随访。",
            "meta": {"title": "规范", "locator": "pdf:5:lines:1-9"},
            "score": 0.8,
        },
        {
            "content": "随访内容包括体格测量与神经发育评估。" * 30,
            "meta": {"title": "指南", "locator": "md:12"},
            "score": 0.7,
        },
    ]
    block = build_context_block(hits, max_chars=400)
    assert "【知识库资料" in block
    assert "《规范》pdf:5:lines:1-9" in block
    assert "【要求】" in block
    assert len(block) <= 460


def test_注入保留用户原话():
    block = "【知识库资料】…"
    assert inject_context("出院后怎么随访", block).endswith("【用户问题】出院后怎么随访")


def test_检索命中按分数返回():
    matrix = np.array([[1.0, 0.0], [0.0, 1.0]], dtype=np.float32)
    rows = [{"content": "相关", "meta": {"title": "A"}}, {"content": "无关", "meta": {"title": "B"}}]
    service = RagService(
        FakeEmbedder(np.array([1.0, 0.0], dtype=np.float32)),
        FakeStore(matrix, rows),
        top_k=1,
        min_score=0.5,
    )
    hits = service.retrieve("随访")
    assert len(hits) == 1
    assert hits[0]["content"] == "相关"


def test_编码失败时降级为空结果():
    service = RagService(BrokenEmbedder(), FakeStore(None, []), top_k=3, min_score=0.5)
    assert service.retrieve("随访") == []


def test_无命中时发送原文():
    service = RagService(
        FakeEmbedder(np.array([1.0, 0.0], dtype=np.float32)),
        FakeStore(None, []),
        top_k=3,
        min_score=0.5,
    )
    message, hits = service.build_payload_message("早产儿怎么随访")
    assert message == "早产儿怎么随访"
    assert hits == []


def test_有命中时把资料拼在原文前():
    matrix = np.array([[1.0, 0.0]], dtype=np.float32)
    rows = [{"content": "应定期随访。", "meta": {"title": "规范", "locator": "pdf:1:lines:1-3"}}]
    service = RagService(
        FakeEmbedder(np.array([1.0, 0.0], dtype=np.float32)),
        FakeStore(matrix, rows),
        top_k=1,
        min_score=0.5,
    )
    message, hits = service.build_payload_message("怎么随访")
    assert "《规范》" in message
    assert message.endswith("【用户问题】怎么随访")
    assert len(hits) == 1


def test_快照行映射跳过坏数据():
    good_vector = np.ones(384, dtype=np.float32).tobytes()
    rows = [
        (
            "c1",
            json.dumps({"text": "正文", "title": "T", "reviewed_by": "张", "reviewed_at": "2026-10-28"}, ensure_ascii=False),
            good_vector,
        ),
        ("c2", json.dumps({"text": "", "title": "T"}, ensure_ascii=False), good_vector),
        ("c3", json.dumps({"text": "坏向量"}, ensure_ascii=False), b"\x00" * 8),
    ]
    records, skipped = map_snapshot_rows(rows, "model-x")
    assert len(records) == 1
    assert skipped == 2
    assert records[0]["id"] == "c1"
    assert records[0]["model_id"] == "model-x"
    assert records[0]["meta"]["title"] == "T"
