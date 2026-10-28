"""把 approved 快照（SQLite）导入 PostgreSQL 的 rag_chunks。

只导入审核通过的片段；快照里出现异常数据（空正文、向量长度不对）跳过并计数，
不阻断其余行。默认不删除库中已存在的其它片段，`--prune` 时才清理快照之外的旧行。
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

import numpy as np

DIMENSION = 384


def decode_vector(raw_hex_or_bytes, dimension=DIMENSION):
    """把快照里的向量还原成 float32 字节；长度不符返回 None。"""
    if raw_hex_or_bytes is None:
        return None
    if isinstance(raw_hex_or_bytes, memoryview):
        raw = raw_hex_or_bytes.tobytes()
    elif isinstance(raw_hex_or_bytes, (bytes, bytearray)):
        raw = bytes(raw_hex_or_bytes)
    else:
        return None
    array = np.frombuffer(raw, dtype=np.float32)
    if array.size != dimension:
        return None
    return array.astype(np.float32).tobytes()


def map_snapshot_rows(rows, model_id):
    """rows: [(chunk_id, metadata_json, vector_bytes)] → 待入库记录。"""
    records, skipped = [], 0
    for chunk_id, metadata_json, vector in rows:
        try:
            meta = json.loads(metadata_json) if isinstance(metadata_json, str) else dict(metadata_json)
        except (TypeError, ValueError):
            skipped += 1
            continue
        content = (meta.get("text") or "").strip()
        embedding = decode_vector(vector)
        if not content or embedding is None:
            skipped += 1
            continue
        records.append(
            {
                "id": chunk_id or meta.get("chunk_id"),
                "content": content,
                "parent_content": meta.get("parent_text"),
                "embedding": embedding,
                "meta": {
                    key: meta.get(key)
                    for key in (
                        "title",
                        "locator",
                        "pdf_page",
                        "section",
                        "population",
                        "care_stage",
                        "source_url",
                        "document_sha256",
                        "canonical_source_id",
                    )
                },
                "model_id": model_id or meta.get("model_id") or "",
                "reviewed_by": meta.get("reviewed_by") or "",
                "reviewed_at": meta.get("reviewed_at") or meta.get("reviewed_at"),
            }
        )
    return records, skipped


def read_snapshot(snapshot_path):
    path = Path(snapshot_path)
    if path.is_dir():
        path = path / "vectors.sqlite"
    con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        return con.execute("SELECT id, metadata, vector FROM chunks").fetchall()
    finally:
        con.close()


UPSERT_SQL = """
INSERT INTO rag_chunks (id, content, parent_content, embedding, meta, model_id,
                        review_status, reviewed_by, reviewed_at)
VALUES (:id, :content, :parent_content, :embedding, :meta, :model_id,
        'approved', :reviewed_by, :reviewed_at)
ON CONFLICT (id) DO UPDATE SET
    content = EXCLUDED.content,
    parent_content = EXCLUDED.parent_content,
    embedding = EXCLUDED.embedding,
    meta = EXCLUDED.meta,
    model_id = EXCLUDED.model_id,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    imported_at = now()
"""


def import_records(connection, records):
    from sqlalchemy import text

    payload = []
    for record in records:
        payload.append(
            {
                **record,
                "meta": json.dumps(record["meta"], ensure_ascii=False),
            }
        )
    if not payload:
        return 0
    connection.execute(text(UPSERT_SQL), payload)
    return len(payload)


def main(argv=None):
    parser = argparse.ArgumentParser(description="导入 approved 片段到 rag_chunks")
    parser.add_argument("--snapshot", required=True, help="approved-*/vectors.sqlite 或其目录")
    parser.add_argument("--model-id", required=True, help="与建库一致的模型标识")
    parser.add_argument("--prune", action="store_true", help="删除快照之外的历史片段")
    parser.add_argument("--dry-run", action="store_true", help="只统计，不入库")
    args = parser.parse_args(argv)

    rows = read_snapshot(args.snapshot)
    records, skipped = map_snapshot_rows(rows, args.model_id)
    print(f"快照 {len(rows)} 行，可导入 {len(records)} 条，跳过 {skipped} 条")
    if not records:
        print("没有可导入的记录，退出", file=sys.stderr)
        return 4
    if args.dry_run:
        return 0

    from app import create_app  # 延迟导入，避免测试环境加载整站
    from models import db

    app = create_app()
    with app.app_context():
        imported = import_records(db.session, records)
        if args.prune:
            ids = [record["id"] for record in records]
            db.session.execute(
                db.text("DELETE FROM rag_chunks WHERE NOT (id = ANY(:ids))"),
                {"ids": ids},
            )
        db.session.commit()
        print(f"已导入 {imported} 条")
    return 0


if __name__ == "__main__":
    sys.exit(main())
