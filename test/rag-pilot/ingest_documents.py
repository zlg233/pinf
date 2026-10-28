"""Original-file registry and conservative extractors for the local RAG workspace."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import uuid
import xml.etree.ElementTree as ET
import zipfile

VERSION = 'conservative-layout-v5'
# 宽于整幅 45% 的词视为横跨两栏的标题/页眉
WIDE_LINE_RATIO = 0.45
# 单页图片数量超过该值，视为扫描件（文字层通常是 OCR 结果，字词错乱不可信）
SCAN_IMAGE_THRESHOLD = 50
# 人工整理的文本源；存在同名文件时优先于 PDF
MD_SUFFIXES = {'.md', '.txt'}
MAX_BYTES = 300 * 1024 * 1024
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def inside(root, relative):
    root = Path(root).resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or path == root:
        raise ValueError('Path outside configured library')
    return path


def classify(name):
    if re.search(r'核心功能架构|小程序(?:\(\d+\))?\.', name):
        return 'product_reference'
    if '语料库' in name:
        return 'compiled_corpus'
    return 'clinical_reference_candidate'


def record(root, path):
    sha = digest(path)
    return {'document_id': 'DOC-' + sha[:16], 'raw_path': path.relative_to(root).as_posix(),
            'bytes': path.stat().st_size, 'sha256': sha, 'extension': path.suffix.lower(),
            'category': classify(path.name), 'review_status': 'pending', 'source_url': None,
            'canonical_source_id': None, 'population': None, 'care_stage': None}


def _register(root, key, manifest):
    path = root / 'catalog/registry.json'
    registry = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    registry[key] = manifest
    atomic_json(path, registry)


def import_archive(root, archive):
    root, archive = Path(root).resolve(), Path(archive).resolve()
    if archive.stat().st_size > MAX_BYTES:
        raise ValueError('Archive exceeds size budget')
    sha = digest(archive)
    legacy_path = root / 'catalog/import-manifest.json'
    if legacy_path.exists():
        legacy = json.loads(legacy_path.read_text(encoding='utf-8'))
        if legacy.get('archive_sha256') == sha:
            return legacy
    batch = 'zip-' + sha[:16]
    raw = root / 'raw' / batch
    with zipfile.ZipFile(archive) as z:
        infos = z.infolist()
        if len(infos) > 500 or sum(i.file_size for i in infos) > MAX_BYTES:
            raise ValueError('Expanded archive exceeds size budget')
        entries, names = [], set()
        for info in infos:
            name = info.filename
            if not info.flag_bits & 0x800:
                try:
                    name = name.encode('cp437').decode('gb18030')
                except UnicodeError:
                    pass
            rel = PurePosixPath(name.replace('\\', '/'))
            if rel.is_absolute() or '..' in rel.parts or not rel.parts:
                raise ValueError('Unsafe archive entry')
            for part in rel.parts:
                if (any(c in part for c in ':<>"|?*') or part.endswith((' ', '.')) or
                        re.match(r'(?i)^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', part)):
                    raise ValueError('Unsafe archive filename')
            target = inside(raw, rel.as_posix())
            key = str(target).casefold()
            if key in names or stat.S_ISLNK(info.external_attr >> 16) or info.flag_bits & 1:
                raise ValueError('Duplicate, linked or encrypted archive member')
            names.add(key)
            entries.append((info, target))
        # Validate all paths BEFORE writing; verify CRC before registering the batch.
        if z.testzip() is not None:
            raise ValueError('Archive CRC mismatch')
        archive_copy = root / 'archives' / (sha + '.zip')
        archive_copy.parent.mkdir(parents=True, exist_ok=True)
        if archive_copy.exists():
            if digest(archive_copy) != sha:
                raise ValueError('Archived ZIP was modified')
        else:
            shutil.copyfile(archive, archive_copy)
        rows = []
        for info, target in entries:
            if info.is_dir():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            content = z.read(info)
            if target.exists():
                if digest(target) != hashlib.sha256(content).hexdigest():
                    raise ValueError('Original file was modified')
            else:
                with target.open('xb') as stream:
                    stream.write(content)
            rows.append(record(root, target))
    result = {'batch_id': batch, 'archive_sha256': sha, 'documents': rows}
    _register(root, archive.name, result)
    return result


def scan_inbox(root):
    root = Path(root).resolve()
    inbox = root / 'inbox'
    inbox.mkdir(parents=True, exist_ok=True)
    problems = []
    registry_path = root / 'catalog/registry.json'
    known = json.loads(registry_path.read_text(encoding='utf-8')) if registry_path.exists() else {}
    known_hashes = {m.get('archive_sha256') for m in known.values()}
    legacy = root / 'catalog/import-manifest.json'
    if legacy.exists():
        known_hashes.add(json.loads(legacy.read_text(encoding='utf-8')).get('archive_sha256'))
    for path in sorted(inbox.iterdir()):
        if path.is_dir() or path.suffix.lower() not in {'.zip', '.pdf', '.docx', '.doc', '.md', '.txt'}:
            continue
        try:
            if path.is_symlink() or not path.resolve().is_relative_to(inbox.resolve()):
                raise ValueError('Linked inbox entry')
            if path.stat().st_size > MAX_BYTES:
                raise ValueError('Input exceeds size budget')
            sha = digest(path)
            if path.suffix.lower() == '.zip':
                if sha not in known_hashes:
                    imported = import_archive(root, path)
                    known_hashes.add(imported['archive_sha256'])
            else:
                target = root / 'raw' / ('file-' + sha[:16]) / path.name
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists():
                    shutil.copyfile(path, target)
                if digest(target) != sha:
                    raise ValueError('Original file was modified')
                _register(root, path.name, {'batch_id': 'file-' + sha[:16], 'documents': [record(root, target)]})
        except Exception as exc:
            problems.append({'input': path.name, 'reason': type(exc).__name__ + ': ' + str(exc)})
    return problems


def discover_manual_texts(root, rows):
    """把 raw/ 下未登记过的人工整理文本（.md/.txt）补进清单。

    这些文件不走 ZIP 归档流程，放在参考文献目录旁即可被收录；
    同名 PDF 会在 apply_text_replacements 里被跳过。
    """
    known = {row.get('sha256') for row in rows}
    raw = Path(root).resolve() / 'raw'
    if not raw.exists():
        return rows
    extra = []
    for path in sorted(raw.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in MD_SUFFIXES:
            continue
        sha = digest(path)
        if sha in known:
            continue
        known.add(sha)
        extra.append(record(root, path))
    return rows + extra


def load_documents(root):
    root = Path(root).resolve()
    rows = []
    legacy = root / 'catalog/import-manifest.json'
    if legacy.exists():
        rows.extend(json.loads(legacy.read_text(encoding='utf-8'))['documents'])
    registry = root / 'catalog/registry.json'
    if registry.exists():
        for manifest in json.loads(registry.read_text(encoding='utf-8')).values():
            rows.extend(manifest['documents'])
    unique = {}
    for row in rows:
        unique.setdefault(row['sha256'], row)
    # 补收 raw/ 下人工整理的文本，再按"同名文本优先"过滤 PDF
    collected = discover_manual_texts(root, list(unique.values()))
    return apply_text_replacements(collected)


def clean_text(text):
    # Preserve units, decimal points, denial and medical conditions; no LLM rewriting.
    return re.sub(r'[ \t\u3000]+', ' ', text.replace('\x00', '')).strip()


def page_is_scan(image_count):
    """扫描件判定：整页由成百上千个图片对象拼成，文字层多为不可信 OCR。"""
    return image_count > SCAN_IMAGE_THRESHOLD


def _cjk_ratio(text):
    if not text:
        return 0.0
    cjk = sum(1 for ch in text if '\u4e00' <= ch <= '\u9fff')
    return cjk / len(text)


def text_issue(text):
    if not text.strip():
        return 'needs_ocr'
    if len(re.findall(r'/G[0-9a-fA-F]{2,}', text)) > 3 or text.count('\ufffd') > 2:
        return 'font_mapping'
    # 字体没有 ToUnicode 时，抽出来的是西里尔/拉丁乱码而不是 /Gxx 字形名，
    # 用中文字符占比兜底：长页面里几乎没有汉字就判定为字形映射失败。
    if len(text) >= 100 and _cjk_ratio(text) < 0.15:
        return 'font_mapping'
    if len(re.sub(r'\s', '', text)) < 40:
        return 'sparse_text'
    return None


def _unit(text, locator, page=None, section='待审核章节'):
    return {'text': text, 'locator': locator, 'pdf_page': page, 'pdf_page_end': page,
            'printed_page': None, 'section': section, 'layout_status': 'pending_review'}


def _strip_markdown(block):
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', block)   # [文字](链接) → 文字
    text = re.sub(r'[*_`]+', '', text)
    text = re.sub(r'^\s*[-+]\s+', '', text, flags=re.M)     # 无序列表标记
    return clean_text(text)


def extract_text_units(text, filename=''):
    """Markdown/纯文本 → 单元。标题记为章节，空行分段，表格行原样保留。"""
    units, issues = [], []
    section = '待审核章节'
    counter = 0
    for raw in re.split(r'\n\s*\n', text):
        block = raw.strip()
        if not block:
            continue
        if block.startswith('#'):
            heading = clean_text(block.lstrip('#').strip())
            if heading:
                section = heading
                counter += 1
                units.append(_unit(heading, f'md:{counter}', None, section))
            continue
        body = _strip_markdown(block)
        if len(re.sub(r'\s', '', body)) < 5:
            continue
        if block.lstrip().startswith('|'):
            # 表格按行成单元：整张表塞进一个片段既超长又容易被从中间切开
            issues.append({'reason': 'table_in_markdown', 'locator': f'md:{counter + 1}'})
            for line in block.splitlines():
                row = line.strip()
                if not row:
                    continue
                counter += 1
                units.append(_unit(row, f'md:{counter}', None, section))
            continue
        counter += 1
        units.append(_unit(body, f'md:{counter}', None, section))
    return units, issues


def _normalized_stem(stem):
    """归一化文件名，便于人工文本与原 PDF 对上。

    去掉浏览器重复后缀「 (1)」、空格/下划线/连字符，以及「版/篇」这类版本后缀，
    这样「早产临床防治指南_2024版.md」也能匹配「早产临床防治指南 2024.pdf」。
    """
    normalized = re.sub(r'\s*\(\d+\)$', '', stem)
    normalized = re.sub(r'[\s_\-]+', '', normalized)
    normalized = re.sub(r'[版篇]$', '', normalized)
    return normalized


def apply_text_replacements(rows):
    """同名 .md/.txt 存在时跳过对应 PDF，避免同一文献入库两次。"""
    text_keys = set()
    for row in rows:
        if row.get('extension') in MD_SUFFIXES:
            path = PurePosixPath(row['raw_path'])
            text_keys.add((path.parent.as_posix(), _normalized_stem(path.stem)))
    kept = []
    for row in rows:
        path = PurePosixPath(row['raw_path'])
        if row.get('extension') == '.pdf' and (path.parent.as_posix(), _normalized_stem(path.stem)) in text_keys:
            continue
        kept.append(row)
    return kept


def words_to_lines(words, tolerance=3.0, gap=3.0):
    """按词坐标重建行：同一行（top 相近）内按 x 排序，明显空隙补一个空格。"""
    if not words:
        return []
    rows = []
    for item in sorted(words, key=lambda w: (w['top'], w['x0'])):
        for row in rows:
            if abs(row['top'] - item['top']) <= tolerance:
                row['words'].append(item)
                row['top'] = min(row['top'], item['top'])
                break
        else:
            rows.append({'top': item['top'], 'words': [item]})

    lines = []
    for row in sorted(rows, key=lambda r: r['top']):
        text, previous = '', None
        for item in sorted(row['words'], key=lambda w: w['x0']):
            if previous is not None and item['x0'] - previous['x1'] > gap:
                text += ' '
            text += item['text']
            previous = item
        lines.append(text)
    return lines


def page_lines_from_words(words, width, min_words=6, crossing_limit=0.2):
    """识别双栏并先左后右读取；返回 (行列表, 是否双栏)。

    横跨整幅的标题/页眉单独成行排在最前，不参与左右分栏，
    这样双栏正文页不会因为一个居中标题就被判成单栏。
    """
    if not words:
        return [], False

    middle = width / 2
    left, right, spanning = [], [], []
    for item in words:
        if item['x1'] - item['x0'] > width * WIDE_LINE_RATIO:
            # 横跨整幅的标题/页眉，单独成行放到最前面，不算进任何一栏
            spanning.append(item)
        elif item['x1'] < middle - 6:
            left.append(item)
        elif item['x0'] > middle + 6:
            right.append(item)
        else:
            (left if (item['x0'] + item['x1']) / 2 < middle else right).append(item)

    if len(left) >= min_words and len(right) >= min_words:
        return words_to_lines(spanning) + words_to_lines(left) + words_to_lines(right), True
    return words_to_lines(words), False


HEADING_PATTERN = r'^(?:[一二三四五六七八九十]+、|[（(][一二三四五六七八九十]+[）)]|\d+[.．、])'
MAX_BLOCK_CHARS = 240


def merge_blocks(entries, max_chars=MAX_BLOCK_CHARS):
    """把 [(页, 行号, 文本)] 合并成段落块，跨页不再切断句子。

    - 标题行开始新块；
    - 句子结束且块已够长时才切块，因此一个句子不会因为翻页被劈开；
    - 返回的块带起止页与行号，供追溯原文位置。
    """
    blocks, pending, size = [], [], 0

    def flush():
        nonlocal size
        if pending:
            page_start, line_start = pending[0][0], pending[0][1]
            page_end, line_end = pending[-1][0], pending[-1][1]
            blocks.append(
                {
                    'text': '\n'.join(item[2] for item in pending),
                    'page_start': page_start,
                    'page_end': page_end,
                    'line_start': line_start,
                    'line_end': line_end,
                }
            )
            pending.clear()
            size = 0

    for page, line_no, text in entries:
        pending.append((page, line_no, text))
        size += len(text)
        # 只在"句子结束 + 够长"时切块；不按编号行切，避免把（二）…这种条款从中间劈开
        if size >= max_chars and re.search(r'[。！？；!?;][”）)]?$', text):
            flush()
    flush()
    return blocks


def block_locator(block):
    if block['page_start'] == block['page_end']:
        return f"pdf:{block['page_start']}:lines:{block['line_start']}-{block['line_end']}"
    return f"pdf:{block['page_start']}-{block['page_end']}:lines:{block['line_start']}-{block['line_end']}"


def paragraph_blocks(lines):
    """Keep wrapped conditions together; page boundaries still need human review."""
    blocks, pending = [], []

    def flush():
        if pending:
            blocks.append({'text': '\n'.join(t for _, t in pending),
                           'line_start': pending[0][0], 'line_end': pending[-1][0]})
            pending.clear()

    heading = HEADING_PATTERN
    for number, raw in enumerate(lines, 1):
        text = clean_text(raw)
        if not text:
            continue
        if re.match(heading, text):
            flush()
        pending.append((number, text))
        if re.search(r'[。！？][”）)]?$', text):
            flush()
    flush()
    return blocks


def extract_document(path):
    path = Path(path)
    units, issues = [], []
    if path.suffix.lower() in MD_SUFFIXES:
        return extract_text_units(path.read_text(encoding='utf-8', errors='replace'), path.name)
    if path.suffix.lower() == '.doc':
        return [], [{'reason': 'legacy_doc_needs_conversion'}]
    if path.suffix.lower() == '.docx':
        with zipfile.ZipFile(path) as archive:
            if sum(i.file_size for i in archive.infolist()) > MAX_BYTES:
                raise ValueError('Expanded DOCX exceeds budget')
            tree = ET.fromstring(archive.read('word/document.xml'))
        if tree.findall('.//w:ins', NS) or tree.findall('.//w:del', NS):
            return [], [{'reason': 'tracked_changes_need_review'}]
        body = tree.find('w:body', NS)
        for number, element in enumerate(body, 1):
            if element.tag == '{' + NS['w'] + '}tbl':
                issues.append({'reason': 'complex_table', 'locator': f'block:{number}'})
                continue
            if element.tag != '{' + NS['w'] + '}p':
                continue
            text = clean_text(''.join(n.text or '' for n in element.findall('.//w:t', NS)))
            if element.findall('.//w:drawing', NS):
                issues.append({'reason': 'embedded_image', 'locator': f'paragraph:{number}'})
            if text:
                units.append(_unit(text, f'paragraph:{number}'))
        return units, issues
    if path.suffix.lower() != '.pdf':
        return [], [{'reason': 'unsupported_format'}]
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) > 500:
            raise ValueError('PDF exceeds page budget')
        # 先按词坐标重建每一页的行（双栏则先左后右），再统一去页眉页脚
        page_lines, page_flags = [], []
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=2, y_tolerance=3)
            lines, two_column = page_lines_from_words(words, page.width)
            if not lines:
                lines = (page.extract_text(x_tolerance=2, y_tolerance=3) or '').splitlines()
            page_lines.append(lines)
            page_flags.append(two_column)

        edges = Counter()
        for lines in page_lines:
            edges.update(set(lines[:2] + lines[-2:]))
        repeated = {s for s, n in edges.items() if n >= max(3, len(pdf.pages) * .6)}

        entries = []
        for number, (page, lines) in enumerate(zip(pdf.pages, page_lines), 1):
            text = '\n'.join(lines)
            if page_is_scan(len(page.images)):
                issues.append({'reason': 'needs_ocr', 'pdf_page': number})
                continue
            reason = text_issue(text)
            if reason:
                # 字形未映射或扫描页无法还原，保留问题记录但不出片段
                issues.append({'reason': reason, 'pdf_page': number})
                continue
            if page_flags[number - 1]:
                issues.append({'reason': 'two_column_split', 'pdf_page': number})
            if page.find_tables():
                # 表格仍保留文本，但行列关系可能错位；标记出来供人工判断，不再整页丢弃
                issues.append({'reason': 'complex_table', 'pdf_page': number})
            cleaned = ['' if line in repeated or re.fullmatch(r'\s*[-—]?\s*\d+\s*[-—]?\s*', line) else line for line in lines]
            entries.extend((number, index, line) for index, line in enumerate(cleaned, 1) if line)

        # 跨页合并：一句话不会因为翻页被劈成两半
        for block in merge_blocks(entries):
            units.append(_unit(block['text'], block_locator(block), block['page_start']))
    return units, issues
