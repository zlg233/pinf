"""Markdown 校验器测试：转换完先自检，避免入库后返工。"""

import unittest

from validate_markdown import (
    check_tables,
    find_problems,
    paragraph_stats,
    split_blocks,
)

GOOD = """> 标题：示例指南
> 期刊：中国儿童保健杂志 2021;29(8):809-814

# 一、适用范围

本指南适用于出生胎龄小于 37 周的早产儿。随访应按矫正月龄进行。

## 二、随访

| 月龄 | 随访内容 |
| --- | --- |
| 1 月 | 体格测量 |

出院后 1～2 周完成首次随访。
"""


class SplitTest(unittest.TestCase):
    def test_按空行切段并去掉空段(self):
        blocks = split_blocks("第一段。\n\n第二段。\n\n\n")
        self.assertEqual([b[1] for b in blocks], ["第一段。", "第二段。"])

    def test_段落带行号(self):
        blocks = split_blocks("甲。\n\n乙。")
        self.assertEqual(blocks[0][0], 1)
        self.assertEqual(blocks[1][0], 3)


class StatsTest(unittest.TestCase):
    def test_统计段落标题表格(self):
        stats = paragraph_stats(split_blocks(GOOD))
        self.assertEqual(stats["headings"], 2)
        # 表格按"块"计数：整张表是一个段落块
        self.assertEqual(stats["tables"], 1)
        self.assertEqual(stats["metadata"], 1)
        self.assertGreaterEqual(stats["body"], 2)


class TableTest(unittest.TestCase):
    def test_正常表格无问题(self):
        self.assertEqual(check_tables(GOOD.splitlines()), [])

    def test_列数不一致会报错(self):
        bad = "| 月龄 | 内容 |\n| --- | --- |\n| 1 月 | 测量 | 多余 |"
        issues = check_tables(bad.splitlines())
        self.assertTrue(any(i["code"] == "table_column_mismatch" for i in issues))


class ProblemTest(unittest.TestCase):
    def _codes(self, text):
        return [i["code"] for i in find_problems(split_blocks(text))]

    def test_正常文档没有错误(self):
        problems = find_problems(split_blocks(GOOD))
        errors = [p for p in problems if p["level"] == "error"]
        self.assertEqual(errors, [])

    def test_元信息行不算句子未闭合(self):
        codes = self._codes("> 标题：示例\n\n作者：张三\n\n通信作者：李四，E-mail: a@b.com\n")
        self.assertNotIn("sentence_not_closed", codes)

    def test_句子未闭合会告警(self):
        fragment = "这一句没有写完所以被截断，后面应该还有内容但是转换到这里就停下了"
        codes = self._codes("# 标题\n\n" + fragment + "\n")
        self.assertIn("sentence_not_closed", codes)

    def test_短的作者单位行不算截断(self):
        codes = self._codes("# 标题\n\n中国医师协会儿科医师分会\n\n正文完整的一句话。\n")
        self.assertNotIn("sentence_not_closed", codes)

    def test_页眉页脚与扫码噪声会告警(self):
        codes = self._codes("# 标题\n\n第 3 页\n\n扫码阅读电子版\n\n正文一句完整的话。\n")
        self.assertIn("page_noise", codes)

    def test_纯链接行会告警(self):
        codes = self._codes("# 标题\n\nhttps://example.com/a/b\n")
        self.assertIn("url_only", codes)

    def test_重复段落会告警(self):
        codes = self._codes("# 标题\n\n同一段内容重复出现。\n\n同一段内容重复出现。\n")
        self.assertIn("duplicate_paragraph", codes)

    def test_超长段落会告警(self):
        long_para = "这是一句很长的话。" * 80
        codes = self._codes("# 标题\n\n" + long_para + "\n")
        self.assertIn("long_paragraph", codes)

    def test_空文档报错(self):
        problems = find_problems([])
        self.assertTrue(any(p["code"] == "empty_document" and p["level"] == "error" for p in problems))


if __name__ == "__main__":
    unittest.main()
