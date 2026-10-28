"""预审结果合并的单元测试（不依赖文件系统）。"""

import unittest

from merge_prescreen import build_suggestion_rows, collect_entries, coverage, filter_to_sheet


def entry(chunk_id, doc="文档A", suggestion="通过", reason="ok"):
    return {
        "chunk_id": chunk_id,
        "doc": doc,
        "locator": "md:1",
        "suggestion": suggestion,
        "population": "早产儿",
        "care_stage": "随访",
        "risk_flags": [],
        "reason": reason,
    }


class CollectTest(unittest.TestCase):
    def test_同一片段出现在多个批次时后者覆盖且不重复(self):
        merged = collect_entries([entry("c1", suggestion="待修改"), entry("c1", suggestion="通过"), entry("c2")])
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged["c1"]["suggestion"], "通过")

    def test_忽略没有片段ID的记录(self):
        merged = collect_entries([{"doc": "x"}, entry("c2")])
        self.assertEqual(list(merged), ["c2"])

    def test_简写过程稿可按序号映射回片段ID(self):
        merged = collect_entries(
            [{"seq": 7, "s": "驳回", "p": "不适用", "c": "不适用", "f": ["no_source"], "r": "参考文献"}],
            {7: "c7"},
        )
        # 注意 collect_entries 的第二个位置参数是 seq_map
        self.assertIn("c7", merged)
        self.assertEqual(merged["c7"]["suggestion"], "驳回")
        self.assertEqual(merged["c7"]["risk_flags"], ["no_source"])


class CoverageTest(unittest.TestCase):
    def test_统计各文档覆盖与缺失(self):
        entries = {"c1": entry("c1", doc="A"), "c2": entry("c2", doc="B")}
        sheet_ids = {"c1": "A", "c2": "B", "c3": "B"}
        report = coverage(entries, sheet_ids)
        self.assertEqual(report["total"], 3)
        self.assertEqual(report["covered"], 2)
        self.assertEqual(report["missing"], ["c3"])
        self.assertEqual(report["by_doc"]["B"]["missing"], 1)

    def test_丢弃不在当前清单里的历史记录(self):
        entries = {"c1": entry("c1"), "old": entry("old")}
        kept = filter_to_sheet(entries, {"c1": "A"})
        self.assertEqual(list(kept), ["c1"])


class SuggestionRowsTest(unittest.TestCase):
    def test_判定列留空由人工填写(self):
        rows = build_suggestion_rows(
            [
                {
                    "chunk_id": "c1",
                    "doc": "A",
                    "locator": "md:3",
                    "text": "正文",
                    "suggestion": "通过",
                    "reason": "完整",
                    "risk_flags": ["needs_original_check"],
                    "population": "早产儿",
                    "care_stage": "随访",
                }
            ]
        )
        row = rows[0]
        self.assertEqual(row["序号"], 1)
        self.assertEqual(row["预审建议"], "通过")
        self.assertEqual(row["风险标记"], "needs_original_check")
        self.assertEqual(row["判定"], "")


if __name__ == "__main__":
    unittest.main()
