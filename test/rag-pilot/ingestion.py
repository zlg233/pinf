"""Incremental pending-only ingestion; atomically publishes LOCAL index snapshots."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import uuid

import numpy as np

import ingest_documents as docs
import chunking
from pilot import LocalEmbedder, VectorIndex, chunk_units

ROOT = Path(__file__).resolve().parent
VERSION = 'pending-pipeline-v1'


class BusyError(RuntimeError):
    pass


@contextmanager
def library_lock(root):
    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    path = root / '.ingestion.lock'
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise BusyError('Library already locked; inspect owner before removing a stale lock') from exc
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(json.dumps({'pid': os.getpid(), 'created_at': datetime.now(timezone.utc).isoformat()}))
        yield
    finally:
        path.unlink(missing_ok=True)


def _key(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def current_index(root, embedder):
    root = Path(root).resolve()
    pointer = json.loads((root / 'indexes/CURRENT.json').read_text(encoding='utf-8'))
    return VectorIndex(docs.inside(root, pointer['index']), embedder.model_id, embedder.dimension)


def run_library(root, embedder):
    root = Path(root).resolve()
    with library_lock(root):
        scan_issues = docs.scan_inbox(root)
        originals = docs.load_documents(root)
        # Reject tampering before producing or publishing ANY new index.
        for document in originals:
            if docs.digest(docs.inside(root, document['raw_path'])) != document['sha256']:
                raise ValueError('Original hash mismatch: ' + document['document_id'])
        run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:12]
        snapshot = root / 'indexes' / run_id
        snapshot.mkdir(parents=True)
        index = VectorIndex(snapshot / 'vectors.sqlite', embedder.model_id, embedder.dimension)
        report = {'run_id': run_id, 'created_at': datetime.now(timezone.utc).isoformat(),
                  'pipeline_version': VERSION, 'model_id': embedder.model_id, 'dimension': embedder.dimension,
                  'documents': [], 'chunks': 0, 'cached_documents': 0, 'new_embedding_chunks': 0,
                  'scan_issues': scan_issues, 'review_status': 'pending', 'ready_for_production': False,
                  'storage': 'local SQLite + NumPy, not production pgvector'}
        for document in originals:
            path = docs.inside(root, document['raw_path'])
            entry = {'document_id': document['document_id'], 'name': path.name,
                     'raw_path': document['raw_path'], 'sha256': document['sha256'], 'chunks': 0}
            report['documents'].append(entry)
            if document['category'] == 'product_reference':
                entry['status'] = 'excluded_product'
                continue
            fingerprint = _key({'document': document, 'pipeline': VERSION, 'parser': docs.VERSION,
                                'chunker': chunking.CHUNKER_VERSION,
                                'model': embedder.model_id, 'dimension': embedder.dimension, 'max_tokens': 110})
            cache = root / 'processed' / fingerprint
            try:
                cached = False
                if (cache / 'complete.json').exists():
                    complete = json.loads((cache / 'complete.json').read_text(encoding='utf-8'))
                    for name in ('chunks.json', 'vectors.npy'):
                        if docs.digest(cache / name) != complete['sha256'][name]:
                            raise ValueError('Cache hash mismatch; remove only this cache and retry')
                    rows = json.loads((cache / 'chunks.json').read_text(encoding='utf-8'))
                    vectors = np.load(cache / 'vectors.npy', allow_pickle=False)
                    issues = complete['issues']
                    cached = True
                else:
                    units, issues = docs.extract_document(path)
                    metadata = {'source_ids': [document['document_id']], 'canonical_source_id': document.get('canonical_source_id'),
                                'source_url': document.get('source_url'), 'raw_path': document['raw_path'],
                                'document_sha256': document['sha256'], 'title': path.stem, 'review_status': 'pending',
                                'population': document.get('population') or 'unknown',
                                'care_stage': document.get('care_stage') or 'unknown',
                                'category': document['category'], 'pipeline_version': VERSION}
                    if document['category'] == 'compiled_corpus':
                        issues.append({'reason': 'compiled_corpus_needs_primary_source_alignment'})
                    rows = chunk_units([{**u, **metadata} for u in units], embedder.count_tokens, max_tokens=110)
                    for i, row in enumerate(rows):
                        row['chunk_id'] = _key([fingerprint, row['locator'], i, row['text']])
                    vectors = embedder.encode([r['text'] for r in rows]) if rows else np.empty((0, embedder.dimension), dtype=np.float32)
                    if len(rows):
                        # Validate vectors before caching them; the snapshot remains unexposed.
                        if vectors.shape != (len(rows), embedder.dimension) or not np.isfinite(vectors).all() or np.any(np.linalg.norm(vectors, axis=1) == 0):
                            raise ValueError('Model returned invalid embeddings')
                    cache.mkdir(parents=True, exist_ok=True)
                    docs.atomic_json(cache / 'units.json', units)
                    docs.atomic_json(cache / 'chunks.json', rows)
                    np.save(cache / 'vectors.npy', vectors, allow_pickle=False)
                    docs.atomic_json(cache / 'complete.json', {'issues': issues, 'sha256': {name: docs.digest(cache / name) for name in ('chunks.json', 'vectors.npy')}})
                    report['new_embedding_chunks'] += len(rows)
                if rows:
                    index.upsert(rows, vectors)
                entry.update(status='partial_pending' if rows and issues else 'indexed_pending' if rows else 'blocked_quality',
                             chunks=len(rows), issues=issues, cached=cached, fingerprint=fingerprint)
                report['cached_documents'] += int(cached)
            except Exception as exc:
                entry.update(status='failed', error=type(exc).__name__ + ': ' + str(exc))
        report['chunks'] = index.count()
        report['status_counts'] = {s: sum(d['status'] == s for d in report['documents']) for s in sorted({d['status'] for d in report['documents']})}
        docs.atomic_json(snapshot / 'report.json', report)
        lines = ['# 自动入库运行报告', '', f"运行 ID：{run_id}", '',
                 f"本地待审核片段：{report['chunks']}；本次新生成向量：{report['new_embedding_chunks']}；缓存资料：{report['cached_documents']}。",
                 '', '所有片段均为 pending，默认正式检索不可见。尚未写入生产 pgvector 或连接 n8n。', '',
                 '| 文件 | 状态 | 片段 | 质量事项 |', '| --- | --- | ---: | --- |']
        for entry in report['documents']:
            details = '; '.join(sorted({i['reason'] for i in entry.get('issues', [])})) or entry.get('error', '')
            lines.append(f"| {entry['name'].replace('|', '／')} | {entry['status']} | {entry['chunks']} | {details.replace('|', '／')} |")
        if scan_issues:
            lines.extend(['', '## 投递异常', '', '```json', json.dumps(scan_issues, ensure_ascii=False, indent=2), '```'])
        (snapshot / 'REPORT.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
        (root / 'runs').mkdir(exist_ok=True)
        docs.atomic_json(root / 'runs' / (run_id + '.json'), report)
        docs.atomic_json(root / 'indexes/CURRENT.json', {'run_id': run_id, 'index': (snapshot / 'vectors.sqlite').relative_to(root).as_posix(),
                                                       'report': (snapshot / 'REPORT.md').relative_to(root).as_posix(),
                                                       'model_id': embedder.model_id, 'dimension': embedder.dimension})
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT / 'library')
    parser.add_argument('--model-dir', type=Path, default=ROOT / 'models/minilm')
    sub = parser.add_subparsers(dest='command', required=True)
    imp = sub.add_parser('import')
    imp.add_argument('--archive', type=Path, required=True)
    sub.add_parser('run')
    query = sub.add_parser('query')
    query.add_argument('--question', required=True)
    query.add_argument('--allow-pending', action='store_true')
    args = parser.parse_args()
    if args.command == 'import':
        with library_lock(args.root):
            result = docs.import_archive(args.root, args.archive)
    else:
        model = LocalEmbedder(args.model_dir)
        model.dimension = model.manifest['dimension']
        if args.command == 'run':
            result = run_library(args.root, model)
        else:
            result = current_index(args.root, model).search(model.encode([args.question])[0],
                    allow_pending=args.allow_pending, threshold=.4, limit=5)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
