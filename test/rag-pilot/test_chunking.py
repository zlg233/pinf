"""分块规则的单元测试：优先句子边界，绝不静默截断。"""

import unittest

import chunking

SENTENCE_END = "。！？；"


def char_tokens(text):
    return len(text)


class SplitTest(unittest.TestCase):
    def test_切句保留标点(self):
        parts = chunking.split_sentences("第一句。第二句！第三句？")
        self.assertEqual(parts, ["第一句。", "第二句！", "第三句？"])

    def test_末尾残句单独成句(self):
        self.assertEqual(chunking.split_sentences("完整句。半句"), ["完整句。", "半句"])


class ChunkTextTest(unittest.TestCase):
    def test_按句子装箱_每块都以句末标点结束(self):
        text = "第一句说明条件。第二句保留限制。第三句提供上下文。第四句收尾。"
        pieces = chunking.chunk_text(text, char_tokens, max_tokens=12)
        self.assertGreater(len(pieces), 1)
        self.assertEqual("".join(p for p, _ in pieces), text)
        for piece, kind in pieces:
            self.assertLessEqual(len(piece), 12)
            self.assertNotEqual(kind, "hard")
            self.assertIn(piece[-1], SENTENCE_END)

    def test_单句过长时退到分句标点(self):
        text = "甲项内容，乙项内容，丙项内容，丁项内容。"
        pieces = chunking.chunk_text(text, char_tokens, max_tokens=10)
        joined = "".join(p for p, _ in pieces)
        self.assertEqual(joined, text)
        self.assertTrue(all(kind != "hard" for _, kind in pieces))
        for piece, _ in pieces:
            self.assertIn(piece[-1], "。，")

    def test_不得不硬切时明确标记(self):
        text = "这是一个非常非常长的句子没有任何标点符号可以借助只能硬切分处理"
        pieces = chunking.chunk_text(text, char_tokens, max_tokens=8)
        self.assertEqual("".join(p for p, _ in pieces), text)
        self.assertTrue(any(kind == "hard" for _, kind in pieces))
        for piece, _ in pieces:
            self.assertLessEqual(len(piece), 8)

    def test_不丢字不重复(self):
        text = "甲。乙。丙。" * 20
        pieces = chunking.chunk_text(text, char_tokens, max_tokens=15)
        self.assertEqual("".join(p for p, _ in pieces), text)


class ChunkUnitsTest(unittest.TestCase):
    def test_保留父段落与切分标记(self):
        units = [{"text": "第一句。第二句。第三句。", "pdf_page": 3, "section": "定义"}]
        rows = chunking.chunk_units(units, char_tokens, max_tokens=10)
        self.assertTrue(all(row["parent_text"] == units[0]["text"] for row in rows))
        self.assertTrue(all(row["split_kind"] in {"sentence", "clause", "hard"} for row in rows))
        self.assertEqual(len({row["chunk_id"] for row in rows}), len(rows))

    def test_片段内容拼回等于原文(self):
        units = [{"text": "甲项内容。乙项内容。丙项内容。丁项内容。", "pdf_page": 2}]
        rows = chunking.chunk_units(units, char_tokens, max_tokens=12)
        self.assertEqual("".join(row["text"] for row in rows), units[0]["text"])
        self.assertTrue(all(row["embedding_tokens"] <= 12 for row in rows))


if __name__ == "__main__":
    unittest.main()
