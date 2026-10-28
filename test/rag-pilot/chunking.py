"""分块：按句子边界装箱，避免把一句话切成两半。

规则：
1. 先按句末标点（。！？；!?;）切句，再贪心装箱到 token 上限；
2. 单句超上限时，退到分句标点（，、：,:）继续装箱；
3. 连分句都超上限才硬切，并标记 split_kind=hard，供审核时优先检查；
4. 每块的文本末尾尽量停在标点，不切断词。
"""

import hashlib
import re

SENTENCE_END = "。！？；!?;"
CLAUSE_END = "，、：,:"
# 指纹里带上版本，改规则后旧缓存自动失效
CHUNKER_VERSION = "sentence-v1"


def split_sentences(text):
    """切句，保留标点；末尾无标点的残句单独成句。"""
    out, buf = [], ""
    for ch in text:
        buf += ch
        if ch in SENTENCE_END:
            out.append(buf)
            buf = ""
    if buf:
        out.append(buf)
    return [s for s in out if s.strip()]


def split_clauses(sentence):
    """把一句话再按逗号等分句标点切片。"""
    out, buf = [], ""
    for ch in sentence:
        buf += ch
        if ch in SENTENCE_END or ch in CLAUSE_END:
            out.append(buf)
            buf = ""
    if buf:
        out.append(buf)
    return [s for s in out if s.strip()]


def hard_split(text, count_tokens, max_tokens):
    """二分找不超预算的最长前缀，只在万不得已时用。"""
    pieces, remaining = [], text
    while remaining:
        if count_tokens(remaining) <= max_tokens:
            pieces.append(remaining)
            break
        low, high = 1, len(remaining)
        while low < high:
            mid = (low + high + 1) // 2
            if count_tokens(remaining[:mid]) <= max_tokens:
                low = mid
            else:
                high = mid - 1
        pieces.append(remaining[:low])
        remaining = remaining[low:]
    return pieces


def _ends_sentence(piece):
    stripped = piece.rstrip()
    return bool(stripped) and stripped[-1] in SENTENCE_END


def chunk_text(text, count_tokens, max_tokens=110):
    """返回 [(片段文本, 切分方式)]，切分方式为 sentence / clause / hard。"""
    if max_tokens < 1:
        raise ValueError("max_tokens must be positive")
    result = []
    current = ""

    def flush():
        nonlocal current
        if current.strip():
            result.append(current)
            current = ""

    for sentence in split_sentences(text):
        if count_tokens(current + sentence) <= max_tokens:
            current += sentence
            continue
        flush()
        if count_tokens(sentence) <= max_tokens:
            current = sentence
            continue
        for clause in split_clauses(sentence):
            if count_tokens(current + clause) <= max_tokens:
                current += clause
                continue
            flush()
            if count_tokens(clause) <= max_tokens:
                current = clause
                continue
            for piece in hard_split(clause, count_tokens, max_tokens):
                result.append(piece)
    flush()

    annotated = []
    for piece in result:
        if _ends_sentence(piece):
            kind = "sentence"
        elif piece.rstrip()[-1:] in CLAUSE_END:
            kind = "clause"
        elif len(split_sentences(piece)) > 1:
            kind = "sentence"
        else:
            kind = "hard"
        annotated.append((piece, kind))
    return annotated


def _chunk_id(unit_text, piece, index):
    return hashlib.sha256((unit_text + "|" + str(index) + "|" + piece).encode("utf-8")).hexdigest()[:24]


def chunk_units(units, count_tokens, max_tokens=110):
    """把抽取单元切成检索片段；保留父段落与切分方式，便于审核。"""
    result = []
    for unit in units:
        text = unit["text"]
        pieces = chunk_text(text, count_tokens, max_tokens)
        for index, (piece, kind) in enumerate(pieces):
            result.append(
                {
                    **unit,
                    "text": piece,
                    "parent_text": text,
                    "chunk_id": _chunk_id(text, piece, index),
                    "embedding_tokens": count_tokens(piece),
                    "split_kind": kind,
                }
            )
    return result
