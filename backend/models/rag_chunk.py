from datetime import datetime

from . import db


class RagChunk(db.Model):
    """知识库片段：表里只存审核通过的片段。

    embedding 用 float32 字节保存（384 维），检索在进程内做精确余弦；
    数据量到十万级再换 pgvector 的 vector 类型。
    """

    __tablename__ = "rag_chunks"

    id = db.Column(db.Text, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    parent_content = db.Column(db.Text)
    embedding = db.Column(db.LargeBinary, nullable=False)
    meta = db.Column(db.JSON, nullable=False, default=dict)
    model_id = db.Column(db.Text, nullable=False)
    review_status = db.Column(db.Text, nullable=False, default="approved")
    reviewed_by = db.Column(db.Text, nullable=False)
    reviewed_at = db.Column(db.Date, nullable=False)
    imported_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "meta": self.meta or {},
            "modelId": self.model_id,
            "reviewedBy": self.reviewed_by,
            "reviewedAt": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "importedAt": self.imported_at.isoformat() if self.imported_at else None,
        }
