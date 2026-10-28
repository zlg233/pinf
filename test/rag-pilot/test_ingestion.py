"""Behavior checks for the isolated ingestion pipeline; no external AI calls."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

import numpy as np

import ingest_documents as documents
import ingestion


def write_docx(path, text='不得自行调整剂量，温度36.5℃。', table=False):
    extra = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>不能丢失表格关联</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' if table else ''
    xml = ('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
           '<w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p>' + extra + '</w:body></w:document>')
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('word/document.xml', xml)


class TestArchiveAndExtraction(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent / 'outputs')
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def test_rejects_traversal_before_writing_any_original(self):
        archive = self.root / 'bad.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('正常.txt', 'first')
            z.writestr('../outside.txt', 'bad')
        with self.assertRaises(ValueError):
            documents.import_archive(self.root / 'library', archive)
        self.assertFalse((self.root / 'library/raw').exists())

    def test_import_preserves_chinese_name_and_reimport_does_not_duplicate(self):
        archive = self.root / '资料.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('早产儿/指南.docx', b'original')
        one = documents.import_archive(self.root / 'library', archive)
        two = documents.import_archive(self.root / 'library', archive)
        self.assertEqual(one['batch_id'], two['batch_id'])
        path = self.root / 'library' / one['documents'][0]['raw_path']
        self.assertEqual(path.name, '指南.docx')
        self.assertEqual(path.read_bytes(), b'original')
        self.assertEqual(len(list((self.root / 'library/raw').rglob('*.docx'))), 1)

    def test_docx_preserves_clinical_numbers_and_denial_without_guessing_page(self):
        path = self.root / '指南.docx'
        write_docx(path)
        units, issues = documents.extract_document(path)
        self.assertEqual(units[0]['text'], '不得自行调整剂量，温度36.5℃。')
        self.assertIsNone(units[0]['pdf_page'])
        self.assertEqual(units[0]['locator'], 'paragraph:1')
        self.assertEqual(issues, [])

    def test_docx_table_is_reported_and_not_flattened_into_paragraphs(self):
        path = self.root / '指南.docx'
        write_docx(path, table=True)
        units, issues = documents.extract_document(path)
        self.assertEqual(len(units), 1)
        self.assertNotIn('不能丢失', units[0]['text'])
        self.assertIn('complex_table', [i['reason'] for i in issues])

    def test_quality_gate_catches_glyph_names_and_empty_scans(self):
        self.assertEqual(documents.text_issue('/G21/G22/G23/G24' * 30), 'font_mapping')
        self.assertEqual(documents.text_issue(''), 'needs_ocr')
        self.assertIsNone(documents.text_issue('早产儿出院后应定期随访，家长不得自行调整用药。' * 10))

    def test_pdf_wrapped_sentence_keeps_exception_in_same_parent_context(self):
        blocks = documents.paragraph_blocks(['一、适用范围', '通常按要求进行评估，如有特殊', '情况应单独评估。', '二、随访安排', '按计划随访。'])
        self.assertEqual(blocks[0]['text'], '一、适用范围\n通常按要求进行评估，如有特殊\n情况应单独评估。')
        self.assertEqual(blocks[0]['line_start'], 1)
        self.assertEqual(blocks[0]['line_end'], 3)
        self.assertEqual(blocks[1]['text'], '二、随访安排\n按计划随访。')


class CountingEmbedder:
    """Cheap deterministic test double ONLY for the expensive model boundary."""
    model_id = 'test-only-embedding'
    dimension = 3

    def __init__(self):
        self.encoded = 0

    def count_tokens(self, text):
        return len(text) + 2

    def encode(self, texts):
        self.encoded += len(texts)
        return np.array([[1., 0., 0.] for _ in texts], dtype=np.float32)


class TestPipeline(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent / 'outputs')
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        (self.root / 'inbox').mkdir()
        self.model = CountingEmbedder()

    def add_doc(self, name='指南.docx', text='不得自行调整剂量。'):
        path = self.root / 'inbox' / name
        write_docx(path, text)
        return path

    def test_repeated_scan_reuses_embeddings_and_pending_is_not_formal_knowledge(self):
        self.add_doc()
        first = ingestion.run_library(self.root, self.model)
        second = ingestion.run_library(self.root, self.model)
        self.assertEqual(first['chunks'], 1)
        self.assertEqual(second['chunks'], 1)
        self.assertEqual(self.model.encoded, 1)
        self.assertEqual(second['cached_documents'], 1)
        index = ingestion.current_index(self.root, self.model)
        self.assertEqual(index.search([1., 0., 0.]), [])
        self.assertEqual(len(index.search([1., 0., 0.], allow_pending=True)), 1)

    def test_identical_text_in_distinct_documents_has_distinct_chunk_ids(self):
        self.add_doc('甲.docx')
        self.add_doc('乙.docx', '不得自行调整剂量。 ')
        report = ingestion.run_library(self.root, self.model)
        self.assertEqual(report['chunks'], 2)
        hits = ingestion.current_index(self.root, self.model).search([1., 0., 0.], allow_pending=True)
        self.assertEqual(len({h['chunk_id'] for h in hits}), 2)

    def test_product_material_is_archived_but_excluded(self):
        self.add_doc('核心功能架构.docx')
        report = ingestion.run_library(self.root, self.model)
        self.assertEqual(report['chunks'], 0)
        self.assertEqual(report['documents'][0]['status'], 'excluded_product')

    def test_bad_file_does_not_prevent_good_file_import(self):
        self.add_doc()
        (self.root / 'inbox' / '坏文件.docx').write_bytes(b'not a zip')
        report = ingestion.run_library(self.root, self.model)
        self.assertEqual(report['chunks'], 1)
        self.assertEqual(sum(d['status'] == 'failed' for d in report['documents']), 1)

    def test_updated_archive_replaces_old_version_without_resurrecting_archived_copy(self):
        archive = self.root / 'inbox' / '资料.zip'
        for sentence in ('旧版内容，不得继续使用。', '新版内容，应核对适用条件。'):
            doc = self.root / '临时.docx'
            write_docx(doc, sentence)
            with zipfile.ZipFile(archive, 'w') as z:
                z.write(doc, '指南.docx')
            ingestion.run_library(self.root, self.model)
        ingestion.run_library(self.root, self.model)
        hits = ingestion.current_index(self.root, self.model).search([1., 0., 0.], allow_pending=True)
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]['text'], '新版内容，应核对适用条件。')

    def test_updating_one_inbox_file_removes_old_chunks_from_current_index(self):
        path = self.add_doc(text='旧的资料内容。')
        ingestion.run_library(self.root, self.model)
        write_docx(path, '更新后的资料内容，保留原文。')
        result = ingestion.run_library(self.root, self.model)
        self.assertEqual(result['chunks'], 1)
        hit = ingestion.current_index(self.root, self.model).search([1., 0., 0.], allow_pending=True)[0]
        self.assertEqual(hit['text'], '更新后的资料内容，保留原文。')

    def test_catalog_cannot_auto_approve_medical_material(self):
        self.add_doc()
        ingestion.run_library(self.root, self.model)
        path = self.root / 'catalog/registry.json'
        catalog = json.loads(path.read_text(encoding='utf-8'))
        next(iter(catalog.values()))['documents'][0]['review_status'] = 'approved'
        path.write_text(json.dumps(catalog, ensure_ascii=False), encoding='utf-8')
        ingestion.run_library(self.root, self.model)
        self.assertEqual(ingestion.current_index(self.root, self.model).search([1., 0., 0.]), [])

    def test_lock_rejects_another_run_and_releases_after_exit(self):
        with ingestion.library_lock(self.root):
            with self.assertRaises(ingestion.BusyError):
                ingestion.run_library(self.root, self.model)
        self.add_doc()
        self.assertEqual(ingestion.run_library(self.root, self.model)['chunks'], 1)

    def test_changed_source_cannot_be_silently_ingested_with_old_hash(self):
        self.add_doc()
        ingestion.run_library(self.root, self.model)
        catalog = documents.load_documents(self.root)
        (self.root / catalog[0]['raw_path']).write_bytes(b'tampered')
        with self.assertRaises(ValueError):
            ingestion.run_library(self.root, self.model)
        self.assertEqual(ingestion.current_index(self.root, self.model).count(), 1)


if __name__ == '__main__':
    unittest.main()
