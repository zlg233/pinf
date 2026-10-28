# 知识库检索（RAG）部署与回滚

状态：代码已具备，**尚未部署**。上线前必须先在服务器补齐 `.env`，否则任何一次后端发布都会把
`FEATURE_CLASSROOM_VIDEO` 翻回 `true`、并丢掉只存在于容器里的 `WECHAT_MP_*`。

## 1. 组件

| 组件 | 变化 |
|---|---|
| backend | 新增 `models/rag_chunk.py`、`utils/rag.py`、`utils/rag_import.py`；`routes/chat.py` 在转发 n8n 前注入检索资料；新增依赖 numpy / onnxruntime / tokenizers |
| PostgreSQL | 新增一张 `rag_chunks` 表（只存 approved） |
| 模型 | MiniLM int8 ONNX 目录，只读挂载到 `/app/models/minilm` |
| n8n | **不改**（AI Agent 的 chatInput 就是 webhook 的 `body.message`，资料拼进 message 即可） |

## 2. 部署前置（必须，先于任何发布）

1. 服务器 `backend/.env` 补齐并核对（值从**运行中的容器**读取，不要从仓库 `.env` 抄）：
   - `FEATURE_CLASSROOM_VIDEO=false`（审核期）
   - `FEATURE_AI_QA=false`（RAG 验证通过前）
   - `WECHAT_MP_APPID` / `WECHAT_MP_SECRET`
   - `DATABASE_URL=postgresql://...@pgvector:5432/pinf`（不能是 127.0.0.1）
   - `RAG_ENABLED=false`（首次部署先关）
2. 备份：`pg_dump`、`docker inspect` 全量 env、旧镜像打 tag `pinf-backend:pre-rag`。
3. 上传模型到服务器 `./docker/rag-models/minilm/`（manifest.json、tokenizer.json、onnx/model_quantized.onnx），`chmod -R a+rX`（容器以 nobody 运行）。

## 3. 上线顺序

```bash
# 1) 建表（幂等，随应用启动执行迁移）
docker compose up -d backend

# 2) 导入审核通过的片段（approved 快照由本地 apply_review.py 产出）
docker exec -it pinf-backend-1 python -m utils.rag_import \
  --snapshot /app/rag-approved/vectors.sqlite \
  --model-id 'Xenova/paraphrase-multilingual-MiniLM-L12-v2@2c4055b12046f11709e9df2c122e59ffbdc2f900:int8:mean:l2' \
  --dry-run
# 去掉 --dry-run 再执行一次

# 3) 打开检索，但先留 FEATURE_AI_QA=false 做接口验证
#    .env: RAG_ENABLED=true
docker compose up -d --no-deps backend

# 4) 冒烟
curl -s -X POST http://127.0.0.1:5010/api/chat/send \
  -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
  -d '{"content":"早产儿出院后如何随访？"}'

# 5) 通过后再打开小程序入口
#    .env: FEATURE_AI_QA=true
```

## 4. 验证清单

- 表里只有 approved：`select review_status, count(*) from rag_chunks group by 1;` 应只有 `approved`。
- 空库行为：`rag_chunks` 为空时聊天正常返回（无资料注入），不报错。
- 模型缺失：`RAG_MODEL_DIR` 指错时服务仍能启动，聊天正常，日志有降级告警。
- 命中：同一问题在 n8n 执行记录的 chatInput 里能看到「【知识库资料」段落与「【用户问题」。
- 超时：客户端 15s 超时，观察 p95；资料块上限 900 字，避免挤压响应时间。

## 5. 回滚

1. `RAG_ENABLED=false` → `docker compose up -d --no-deps backend`，聊天立即回到原样（检索不再注入）。
2. 需要连表一起撤：`DROP TABLE rag_chunks;`（不影响业务表）。
3. 需要回退代码：`docker tag pinf-backend:pre-rag pinf-backend` 后重建。
