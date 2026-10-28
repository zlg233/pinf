"""审核回填测试（RED → GREEN）。

不触碰文件系统：工作簿在内存里构造，索引与快照都用内存 SQLite。
覆盖：判定解析、必填校验、未知片段、重复行、approved 快照内容、退出码语义。
"""

import json
import sqlite3
import unittest

from openpyxl import Workbook

from export_review_sheet import HEADERS
from apply_review import (
    DECISION_TO_STATUS,
    build_decisions,
    decide_exit_code,
    parse_review_workbook,
    validate_rows,
    write_approved_snapshot,
)


def make_workbook(rows):
    wb = Workbook()
    ws = wb.active
    ws.title = "待审核清单"
    ws.append(list(HEADERS))
    for row in rows:
        ws.append([row.get(h, "") for h in HEADERS])
    return wb


def row(chunk_id="c1", judgement="", population="", stage="", reviewer="", date="2026-10-28", note=""):
    return {
        "片段ID（勿改）": chunk_id,
        "文档": "早产儿保健服务指南",
        "片段文本": "示例内容",
        "判定": judgement,
        "适用人群": population,
        "护理场景": stage,
        "审核人": reviewer,
        "审核日期": date,
        "修改建议": note,
    }


def make_source(ids=("c1", "c2", "c3")):
    con = sqlite3.connect(":memory:")
    con.execute("CREATE TABLE chunks (id TEXT, metadata TEXT, vector BLOB)")
    for i, cid in enumerate(ids):
        meta = {
            "chunk_id": cid,
            "title": "早产儿保健服务指南",
            "text": f"内容{i}",
            "parent_text": "父段落",
            "locator": "paragraph:1",
        }
        con.execute(
            "INSERT INTO chunks (id, metadata, vector) VALUES (?, ?, ?)",
            (cid, json.dumps(meta, ensure_ascii=False), b"\x00" * 8),
        )
    con.commit()
    return con


class ParseTest(unittest.TestCase):
    def test_解析未填写的行标记为未判定(self):
        wb = make_workbook([row(judgement="")])
        parsed = parse_review_workbook(wb)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["decision"], "")
        self.assertIsNone(DECISION_TO_STATUS.get(parsed[0]["decision"]))

    def test_逐行读取单元格并去掉首尾空白(self):
        wb = make_workbook([row(chunk_id=" c1 ", judgement=" 通过 ", population="早产儿", stage="随访", reviewer="张护士")])
        parsed = parse_review_workbook(wb)[0]
        self.assertEqual(parsed["chunk_id"], "c1")
        self.assertEqual(parsed["decision"], "通过")
        self.assertEqual(parsed["population"], "早产儿")
        self.assertEqual(parsed["reviewer"], "张护士")


class ValidateTest(unittest.TestCase):
    def _validate(self, rows, ids=("c1", "c2", "c3")):
        return validate_rows(rows, set(ids))

    def test_通过必须同时填人群与场景(self):
        rows = [{"row": 2, "chunk_id": "c1", "decision": "通过", "population": "", "care_stage": "", "reviewer": "张", "reviewed_date": ""}]
        errors = self._validate(rows)
        self.assertEqual([e["code"] for e in errors], ["missing_meta", "missing_meta"])

    def test_非法判定值被拒绝(self):
        rows = [{"row": 2, "chunk_id": "c1", "decision": "OK", "population": "早产儿", "care_stage": "随访", "reviewer": "张", "reviewed_date": ""}]
        errors = self._validate(rows)
        self.assertEqual([e["code"] for e in errors], ["invalid_decision"])

    def test_片段ID必须在当前索引里(self):
        rows = [{"row": 2, "chunk_id": "not-exist", "decision": "通过", "population": "早产儿", "care_stage": "随访", "reviewer": "张", "reviewed_date": ""}]
        errors = self._validate(rows)
        self.assertIn("unknown_chunk", [e["code"] for e in errors])

    def test_做出判定必须填审核人(self):
        rows = [{"row": 2, "chunk_id": "c1", "decision": "驳回", "population": "", "care_stage": "", "reviewer": "", "reviewed_date": ""}]
        errors = self._validate(rows)
        self.assertEqual([e["code"] for e in errors], ["missing_reviewer"])

    def test_重复片段ID被拒绝(self):
        rows = [
            {"row": 2, "chunk_id": "c1", "decision": "通过", "population": "早产儿", "care_stage": "随访", "reviewer": "张", "reviewed_date": ""},
            {"row": 3, "chunk_id": "c1", "decision": "驳回", "population": "", "care_stage": "", "reviewer": "张", "reviewed_date": ""},
        ]
        errors = self._validate(rows)
        self.assertIn("duplicate_row", [e["code"] for e in errors])

    def test_日期格式可空但不接受乱填(self):
        rows = [{"row": 2, "chunk_id": "c1", "decision": "驳回", "population": "", "care_stage": "", "reviewer": "张", "reviewed_date": "十月二十八"}]
        errors = self._validate(rows)
        self.assertIn("bad_date", [e["code"] for e in errors])

    def test_拒绝把机器预审当成人工签字(self):
        rows = [
            {"row": 2, "chunk_id": "c1", "decision": "通过", "population": "早产儿", "care_stage": "随访", "reviewer": "AI预审", "reviewed_date": "2026-10-28"},
            {"row": 3, "chunk_id": "c2", "decision": "通过", "population": "早产儿", "care_stage": "随访", "reviewer": "预审助手", "reviewed_date": "2026-10-28"},
            {"row": 4, "chunk_id": "c3", "decision": "通过", "population": "早产儿", "care_stage": "随访", "reviewer": "machine", "reviewed_date": "2026-10-28"},
        ]
        codes = [e["code"] for e in self._validate(rows)]
        self.assertEqual(codes.count("ai_reviewer"), 3)


class DecisionsTest(unittest.TestCase):
    def test_统计四类判定与未判定(self):
        rows = [
            {"row": 2, "chunk_id": "c1", "decision": "通过", "population": "早产儿", "care_stage": "随访", "reviewer": "张", "reviewed_date": "", "note": ""},
            {"row": 3, "chunk_id": "c2", "decision": "驳回", "population": "", "care_stage": "", "reviewer": "张", "reviewed_date": "", "note": "过时"},
            {"row": 4, "chunk_id": "c3", "decision": "", "population": "", "care_stage": "", "reviewer": "", "reviewed_date": "", "note": ""},
        ]
        result = build_decisions(rows, {"run_id": "run-x"})
        self.assertEqual(result["counts"]["approved"], 1)
        self.assertEqual(result["counts"]["rejected"], 1)
        self.assertEqual(result["counts"]["unjudged"], 1)
        self.assertEqual(result["run_id"], "run-x")
        approved = [i for i in result["items"] if i["status"] == "approved"]
        self.assertEqual(approved[0]["chunk_id"], "c1")
        self.assertEqual(approved[0]["population"], "早产儿")

    def test_退出码_零通过或存在错误都算失败(self):
        self.assertEqual(decide_exit_code({"approved": 0}, 0), 4)
        self.assertEqual(decide_exit_code({"approved": 5}, 1), 3)
        self.assertEqual(decide_exit_code({"approved": 5}, 0), 0)


class SnapshotTest(unittest.TestCase):
    def test_快照只写通过项并带上审核字段(self):
        source = make_source()
        target = sqlite3.connect(":memory:")
        decisions = {
            "items": [
                {"chunk_id": "c1", "status": "approved", "reviewer": "张护士", "reviewed_date": "2026-10-28", "note": "OK", "population": "早产儿", "care_stage": "随访"},
                {"chunk_id": "c2", "status": "rejected", "reviewer": "张护士", "reviewed_date": "2026-10-28", "note": "过时", "population": "", "care_stage": ""},
            ]
        }
        written = write_approved_snapshot(source, target, decisions)
        self.assertEqual(written, 1)
        self.assertEqual(target.execute("select count(*) from chunks").fetchone()[0], 1)
        meta = json.loads(target.execute("select metadata from chunks").fetchone()[0])
        self.assertEqual(meta["review_status"], "approved")
        self.assertEqual(meta["reviewed_by"], "张护士")
        self.assertEqual(meta["population"], "早产儿")
        self.assertEqual(meta["care_stage"], "随访")
        target.close()
        source.close()

    def test_快照不写未判定与驳回项(self):
        source = make_source()
        target = sqlite3.connect(":memory:")
        decisions = {"items": [{"chunk_id": "c1", "status": "unjudged", "reviewer": "", "reviewed_date": "", "note": "", "population": "", "care_stage": ""}]}
        self.assertEqual(write_approved_snapshot(source, target, decisions), 0)
        self.assertEqual(target.execute("select count(*) from chunks").fetchone()[0], 0)
        target.close()
        source.close()


if __name__ == "__main__":
    unittest.main()
