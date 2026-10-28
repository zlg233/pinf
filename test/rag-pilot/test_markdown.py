"""Markdown/纯文本入库的单元测试。

覆盖：段落切分、标题成为章节、表格行保留、md 优先于同名 PDF。
"""

import unittest

import ingest_documents as documents


class MarkdownExtractionTest(unittest.TestCase):
    def test_标题与段落切成单元并记录章节(self):
        text = "# 一、住院前管理\n\n产前应识别早产高危因素。\n\n## 二、随访\n\n出院后按矫正月龄随访。\n"
        units, issues = documents.extract_text_units(text, "笔记.md")
        texts = [u["text"] for u in units]
        self.assertIn("产前应识别早产高危因素。", texts)
        self.assertIn("出院后按矫正月龄随访。", texts)
        # 章节来自最近的标题
        follow = [u for u in units if "矫正月龄" in u["text"]][0]
        self.assertEqual(follow["section"], "二、随访")
        self.assertEqual(issues, [])

    def test_定位符连续且可追溯(self):
        text = "# 适用范围\n\n第一段写在这里。\n\n第二段也写在这里。\n"
        units, _ = documents.extract_text_units(text, "x.md")
        self.assertEqual([u["locator"] for u in units], ["md:1", "md:2", "md:3"])

    def test_去除markdown标记但保留数字与单位(self):
        text = "剂量 **2 mg/kg·d**，[参考](https://example.com) 见表。\n"
        units, _ = documents.extract_text_units(text, "x.md")
        body = units[0]["text"]
        self.assertNotIn("**", body)
        self.assertNotIn("https://example.com", body)
        self.assertIn("2 mg/kg·d", body)

    def test_表格自动拆成逐行单元(self):
        text = "| 月龄 | 随访内容 |\n| --- | --- |\n| 1 月 | 体格测量 |\n"
        units, issues = documents.extract_text_units(text, "x.md")
        self.assertGreaterEqual(len(units), 2)
        self.assertTrue(any("1 月" in u["text"] for u in units))
        self.assertIn("table_in_markdown", [i["reason"] for i in issues])

    def test_空文件不产生单元(self):
        units, _ = documents.extract_text_units("   \n\n", "empty.md")
        self.assertEqual(units, [])


class ManualTextDiscoveryTest(unittest.TestCase):
    def test_raw目录里未登记的手工文本会被收进来(self):
        import tempfile
        from pathlib import Path

        base = Path(__file__).parent / "outputs"
        base.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as tmp:
            root = Path(tmp)
            target = root / "raw/x"
            target.mkdir(parents=True)
            (target / "指南.md").write_text("# 标题\n\n正文内容在这里。\n", encoding="utf-8")
            rows = documents.load_documents(root)
            self.assertEqual([r["raw_path"] for r in rows], ["raw/x/指南.md"])
            self.assertEqual(rows[0]["category"], "clinical_reference_candidate")


class TextReplacementTest(unittest.TestCase):
    def _row(self, path, ext):
        return {"raw_path": path, "extension": ext, "sha256": path * 2}

    def test_同名markdown存在时跳过PDF(self):
        rows = [
            self._row("raw/x/指南.pdf", ".pdf"),
            self._row("raw/x/指南.md", ".md"),
            self._row("raw/x/另一份.pdf", ".pdf"),
        ]
        kept = documents.apply_text_replacements(rows)
        paths = [r["raw_path"] for r in kept]
        self.assertNotIn("raw/x/指南.pdf", paths)
        self.assertIn("raw/x/指南.md", paths)
        self.assertIn("raw/x/另一份.pdf", paths)

    def test_没有替身时PDF照常保留(self):
        rows = [self._row("raw/y/指南.pdf", ".pdf")]
        self.assertEqual(documents.apply_text_replacements(rows), rows)

    def test_文件名带重复后缀也能匹配(self):
        # 下载常见命名：原 PDF 叫「指南 (1).pdf」，人工文本叫「指南.md」
        rows = [
            self._row("raw/z/指南 (1).pdf", ".pdf"),
            self._row("raw/z/指南.md", ".md"),
        ]
        kept = documents.apply_text_replacements(rows)
        self.assertEqual([r["raw_path"] for r in kept], ["raw/z/指南.md"])


if __name__ == "__main__":
    unittest.main()
