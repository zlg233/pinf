"""校验人工/工具转换出来的 Markdown，入库前先自检。

用法：
    python validate_markdown.py 文件.md [更多文件/目录...]
    python validate_markdown.py --json report.json 文件.md

退出码：0 = 无错误（可能有告警）；2 = 有错误，需要修。
"""

import argparse
import json
import re
import sys
from pathlib import Path

METADATA_PREFIXES = (
    ">",
    "作者",
    "通信作者",
    "关键词",
    "中图分类号",
    "文献标识码",
    "文章编号",
    "doi",
    "DOI",
    "网络首发",
    "基金",
    "收稿",
    "引用",
    "编辑",
    "执笔",
    "*通信作者",
    "E-mail",
)

SENTENCE_END = "。！？；：…”」』）)"
NOISE_PATTERNS = [
    re.compile(r"^第\s*\d+\s*页$"),
    re.compile(r"扫码(阅读|查看)"),
    re.compile(r"^(下载|版权所有|Copyright|PDF下载)"),
    re.compile(r"^[\-—]?\s*\d{1,4}\s*[\-—]?$"),
]
URL_ONLY = re.compile(r"^https?://\S+$")
REFERENCE_ITEM = re.compile(r"^\[\d+\]")
CAPTION = re.compile(r"^(Tab\.?|Table|Fig\.?|图|表)\s*\d", re.IGNORECASE)
NOTE_PREFIXES = ("注：", "注:", "†", "＊", "*")
HEADING = re.compile(r"^#{1,6}\s+\S")
TABLE_ROW = re.compile(r"^\s*\|")
TABLE_SEP = re.compile(r"^\s*\|?[\s:|-]+\|?\s*$")

LONG_PARAGRAPH_CHARS = 400
SHORT_PARAGRAPH_CHARS = 10


def split_blocks(text):
    """按空行切段，返回 [(起始行号, 段落文本)]。"""
    blocks = []
    buffer, start = [], None
    for number, line in enumerate(text.splitlines(), 1):
        if line.strip():
            if start is None:
                start = number
            buffer.append(line.rstrip())
        elif buffer:
            blocks.append((start, "\n".join(buffer)))
            buffer, start = [], None
    if buffer:
        blocks.append((start, "\n".join(buffer)))
    return blocks


def _is_metadata(paragraph):
    stripped = paragraph.lstrip()
    return stripped.startswith(METADATA_PREFIXES)


def paragraph_stats(blocks):
    stats = {"headings": 0, "tables": 0, "metadata": 0, "body": 0, "chars": 0}
    for _, text in blocks:
        stats["chars"] += len(text)
        stripped = text.lstrip()
        if HEADING.match(stripped):
            stats["headings"] += 1
        elif stripped.startswith("|"):
            stats["tables"] += 1
        elif _is_metadata(stripped):
            stats["metadata"] += 1
        else:
            stats["body"] += 1
    return stats


def check_tables(lines):
    """检查管道表的列数是否与表头一致。"""
    issues = []
    index = 0
    while index < len(lines):
        if not TABLE_ROW.match(lines[index]):
            index += 1
            continue

        header = lines[index]
        block_start = index
        rows = []
        while index < len(lines) and TABLE_ROW.match(lines[index]):
            rows.append(lines[index])
            index += 1

        def cells(row):
            return [c for c in row.strip().strip("|").split("|")]

        header_cells = len(cells(header))
        if len(rows) < 2 or not TABLE_SEP.match(rows[1]):
            issues.append(
                {
                    "level": "error",
                    "code": "table_missing_separator",
                    "line": block_start + 1,
                    "message": "表格缺少 | --- | 分隔行",
                }
            )
            continue
        for offset, row in enumerate(rows[2:], start=2):
            if len(cells(row)) != header_cells:
                issues.append(
                    {
                        "level": "error",
                        "code": "table_column_mismatch",
                        "line": block_start + offset + 1,
                        "message": f"列数与表头不一致（表头 {header_cells} 列，本行 {len(cells(row))} 列）",
                    }
                )
    return issues


def find_problems(blocks):
    """返回问题列表：level=error 会让退出码非 0，warning 只提示。"""
    if not blocks:
        return [
            {
                "level": "error",
                "code": "empty_document",
                "line": 0,
                "message": "文件没有正文",
            }
        ]

    problems = []
    seen = {}

    for line, text in blocks:
        stripped = text.lstrip()
        if HEADING.match(stripped):
            continue
        if stripped.startswith("|"):
            continue
        if _is_metadata(stripped) or REFERENCE_ITEM.match(stripped):
            continue
        # 表题、表注、英文题注不是句子，不做"未闭合"判断
        if CAPTION.match(stripped) or stripped.startswith(NOTE_PREFIXES):
            continue

        single_line = text.strip()
        if URL_ONLY.match(single_line):
            problems.append(
                {"level": "warning", "code": "url_only", "line": line, "message": "纯链接行，入库会变成噪声"}
            )
        if any(pattern.search(single_line) for pattern in NOISE_PATTERNS):
            problems.append(
                {"level": "warning", "code": "page_noise", "line": line, "message": "疑似页眉页脚/页码/扫码提示"}
            )
            continue

        # 很短的标签行（作者单位、栏目名等）本来就不以句号结尾，不算截断；
        # 25 字以上的无标点段落仍按截断提示，便于发现 PDF 翻页切句
        ascii_heavy = sum(1 for ch in single_line if ord(ch) < 128) / max(1, len(single_line)) > 0.6
        label_like = len(single_line) <= 24 and not re.search(r"[。！？，、；：]", single_line)
        label_like = label_like or ascii_heavy
        if (
            len(single_line) >= SHORT_PARAGRAPH_CHARS
            and not label_like
            and not single_line.rstrip().endswith(tuple(SENTENCE_END))
        ):
            problems.append(
                {
                    "level": "warning",
                    "code": "sentence_not_closed",
                    "line": line,
                    "message": "段落没有以句末标点结束，可能是截断",
                    "sample": single_line[-40:],
                }
            )
        if len(single_line) < SHORT_PARAGRAPH_CHARS:
            problems.append(
                {
                    "level": "warning",
                    "code": "short_paragraph",
                    "line": line,
                    "message": f"段落过短（{len(single_line)} 字）",
                    "sample": single_line,
                }
            )
        if len(single_line) > LONG_PARAGRAPH_CHARS:
            problems.append(
                {
                    "level": "warning",
                    "code": "long_paragraph",
                    "line": line,
                    "message": f"段落 {len(single_line)} 字，入库会被切成多块",
                }
            )

        key = single_line[:80]
        if key in seen:
            problems.append(
                {
                    "level": "warning",
                    "code": "duplicate_paragraph",
                    "line": line,
                    "message": f"与第 {seen[key]} 行内容重复",
                }
            )
        else:
            seen[key] = line

    stats = paragraph_stats(blocks)
    if stats["headings"] == 0:
        problems.append(
            {"level": "warning", "code": "no_headings", "line": 0, "message": "没有 # 标题，章节信息会丢失"}
        )

    # 表格校验需要逐行看，段落块会把整张表合成一行
    raw_lines = [line for _, text in blocks for line in text.splitlines()]
    problems.extend(check_tables(raw_lines))
    return problems


def validate_file(path, min_body=1):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    blocks = split_blocks(text)
    stats = paragraph_stats(blocks)
    problems = find_problems(blocks)

    errors = [p for p in problems if p["level"] == "error"]
    warnings = [p for p in problems if p["level"] == "warning"]
    if stats["body"] < min_body and not any(p["code"] == "empty_document" for p in problems):
        warnings.append(
            {
                "level": "warning",
                "code": "few_body_paragraphs",
                "line": 0,
                "message": f"正文段落只有 {stats['body']} 段",
            }
        )

    return {
        "file": str(path),
        "stats": stats,
        "errors": len(errors),
        "warnings": len(warnings),
        "problems": problems,
    }


def iter_files(paths):
    for raw in paths:
        path = Path(raw)
        if path.is_dir():
            yield from sorted(path.glob("*.md"))
        elif path.suffix.lower() in {".md", ".txt"}:
            yield path


def main(argv=None):
    parser = argparse.ArgumentParser(description="校验 Markdown 转换质量")
    parser.add_argument("paths", nargs="+", help="md 文件或目录")
    parser.add_argument("--json", help="把结果写到 JSON 文件")
    parser.add_argument("--min-body", type=int, default=1, help="至少多少段正文")
    parser.add_argument("--max-print", type=int, default=8, help="每个文件最多打印多少条问题")
    args = parser.parse_args(argv)

    files = list(iter_files(args.paths))
    if not files:
        print("没有找到 .md 文件", file=sys.stderr)
        return 2

    results = []
    failed = 0
    for path in files:
        result = validate_file(path, min_body=args.min_body)
        results.append(result)
        stats = result["stats"]
        flag = "FAIL" if result["errors"] else ("WARN" if result["warnings"] else "OK  ")
        print(
            f"[{flag}] {path.name}  段落 {stats['body']} / 标题 {stats['headings']} / "
            f"表格 {stats['tables']} / 字数 {stats['chars']}  "
            f"错误 {result['errors']} 告警 {result['warnings']}"
        )
        if result["errors"]:
            failed += 1
        for problem in result["problems"][: args.max_print]:
            print(f"    {problem['level']:<7} 行{problem['line']:<5} {problem['code']}: {problem['message']}")
        if len(result["problems"]) > args.max_print:
            print(f"    ……还有 {len(result['problems']) - args.max_print} 条")

    if args.json:
        Path(args.json).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n报告已写入 {args.json}")

    return 2 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
