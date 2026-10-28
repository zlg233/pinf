"""版面修复的单元测试：按词坐标重建行、识别双栏并分栏读取。

不依赖真实 PDF —— 用合成的 word 字典驱动纯函数，
真实文档的效果由重跑入库后的抽样验证。
"""

import unittest

import ingest_documents as documents


def word(text, x0, x1, top):
    return {"text": text, "x0": x0, "x1": x1, "top": top, "bottom": top + 10}


class WordsToLinesTest(unittest.TestCase):
    def test_同一行按x坐标拼接_中文不加空格(self):
        lines = documents.words_to_lines(
            [word("早产儿", 10, 40, 10), word("出院后", 42, 70, 10), word("随访", 10, 30, 30)]
        )
        self.assertEqual(lines, ["早产儿出院后", "随访"])

    def test_词间有明显空隙时补空格(self):
        lines = documents.words_to_lines([word("SpO2", 10, 30, 10), word("90-95%", 40, 70, 10)])
        self.assertEqual(lines, ["SpO2 90-95%"])

    def test_同一行内乱序的词按x排序(self):
        lines = documents.words_to_lines([word("B", 50, 60, 10), word("A", 10, 20, 10)])
        self.assertEqual(lines, ["A B"])

    def test_空输入返回空列表(self):
        self.assertEqual(documents.words_to_lines([]), [])


class ColumnLayoutTest(unittest.TestCase):
    def _two_column_words(self, width=500):
        words = []
        for row in range(6):
            top = 20 + row * 20
            words.append(word(f"左{row}", 40, 90, top))
            words.append(word(f"右{row}", 300, 350, top))
        return words

    def test_识别双栏并先左后右读取(self):
        lines, two_column = documents.page_lines_from_words(self._two_column_words(), 500)
        self.assertTrue(two_column)
        self.assertEqual(lines[:6], [f"左{i}" for i in range(6)])
        self.assertEqual(lines[6:], [f"右{i}" for i in range(6)])

    def test_单栏按正常顺序读取(self):
        words = [word("第一行", 10, 120, 10), word("第二行", 10, 120, 30)]
        lines, two_column = documents.page_lines_from_words(words, 500)
        self.assertFalse(two_column)
        self.assertEqual(lines, ["第一行", "第二行"])

    def test_跨栏的整行标题不算双栏(self):
        # 标题横跨中线，正文只有左栏 → 视为单栏，避免把标题切两半
        words = [word("这是一个横跨两栏的居中标题", 40, 460, 10)]
        for row in range(6):
            words.append(word(f"左{row}", 40, 90, 40 + row * 20))
        lines, two_column = documents.page_lines_from_words(words, 500)
        self.assertFalse(two_column)
        self.assertEqual(lines[0], "这是一个横跨两栏的居中标题")

    def test_一栏词太少时不误判双栏(self):
        words = [word("正文内容", 10, 200, 10)] + [word(f"右{i}", 300, 340, 20 + i * 20) for i in range(3)]
        lines, two_column = documents.page_lines_from_words(words, 500)
        self.assertFalse(two_column)

    def test_有横跨标题时正文仍按两栏读取(self):
        # 标题横跨整幅（宽>45%），正文左右各 6 个词 → 应识别为双栏，标题排最前
        words = [word("横跨两栏的大标题", 40, 460, 5)]
        for row in range(6):
            top = 40 + row * 20
            words.append(word(f"左{row}", 40, 90, top))
            words.append(word(f"右{row}", 300, 350, top))
        lines, two_column = documents.page_lines_from_words(words, 500)
        self.assertTrue(two_column)
        self.assertEqual(lines[0], "横跨两栏的大标题")
        self.assertEqual(lines[1:7], [f"左{i}" for i in range(6)])
        self.assertEqual(lines[7:], [f"右{i}" for i in range(6)])


class QualityGateTest(unittest.TestCase):
    def test_字形乱码按中文字符占比识别(self):
        garbage = "CDEF /01!!;<=>?@ABC'DE='<FGH !!I=J%(KLJ%(;<=>?J%&'MG N#OP" * 4
        self.assertEqual(documents.text_issue(garbage), "font_mapping")

    def test_扫描件页面按图片数量识别(self):
        # 扫描 PDF 上叠了一层 OCR 文字，字符看着像中文但字词错乱，只能按版面判定
        self.assertTrue(documents.page_is_scan(2264))
        self.assertFalse(documents.page_is_scan(3))
        self.assertFalse(documents.page_is_scan(0))

    def test_正常中文段落不误判(self):
        text = "早产儿出院后应定期随访，矫正月龄按预产期计算，家长不得自行调整用药剂量。" * 3
        self.assertIsNone(documents.text_issue(text))

    def test_极短页面才算稀疏(self):
        short = "统计本年度某机构活产数为分母，其中胎龄＜37周的早产儿数为分子，医疗机构早产儿发生率按此公式计算。"
        self.assertIsNone(documents.text_issue(short))
        self.assertEqual(documents.text_issue("附件1"), "sparse_text")


if __name__ == "__main__":
    unittest.main()
