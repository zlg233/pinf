# 本地自动 RAG 入库实施计划

> 使用 superpowers:executing-plans 在当前会话逐项执行；用 TDD 验证。用户于 2026-10-24 要求继续，按推荐方案 B 推进。

**目标**：新增文件放入 inbox 后，可由一条命令或内部 HTTP 接口自动归档、清洗、分段、向量化、更新本地待审核索引，提供停用的 n8n 导入模板。

**架构**：复用 `pilot.LocalEmbedder`、`chunk_units`、`VectorIndex`，新增资料解析/归档模块、流水线模块和任务服务。原始资料不改写；每次创建完整候选快照，成功后原子切换 CURRENT，失败不覆盖旧快照。第一阶段只实现 pending 索引；正式发布必须另行审核实现，服务不提供自动批准接口。

**技术**：Python 标准库、已有 pdfplumber、NumPy、ONNX；不添加业务依赖或修改业务数据库。

**设计**：`WORKFLOW-PROPOSAL.md`。资料根默认本目录，支持命令行配置。所有开发留在 `test/rag-pilot/`。

## 需要重点覆盖

- ZIP 路径穿越、中文文件名、大小限制及重复投递。
- 字体乱码与纯图片页面不能因“非空”就视为正文；表格/复杂版面隔离。
- 非医学产品材料、待溯源汇编、旧版 DOC 有明确分类与状态。
- 更新、失败重试、并发运行不留下重复或半成品索引；模型参数改变不混用。
- HTTP 未认证、超大请求、未知参数、任务错误、n8n 超时应可追踪且不泄露凭据。

## Task 1：归档与解析

文件：`ingest_documents.py`；测试：`test_ingestion.py`。

- [x] RED：ZIP 穿越/重复/中文名；数字与否定词清洗不变；DOCX 表格阻断；PDF 乱码、低文本密度质量检测。
- [x] 实现 `import_archive(root, archive)`、`scan_inbox(root)`、`extract_document(path)`；原件按哈希验证，输出 units 与 issues。
- [x] GREEN：目标测试通过。

## Task 2：增量流水线与快照

文件：`ingestion.py`；测试：`test_ingestion.py`。

- [x] RED：同一资料重复运行零次新增向量调用；跨文档片段 ID 不冲突；pending 正式检索为零；单文件失败隔离；独占锁。
- [x] 实现 `run_library(root, embedder)`、`current_index(root, embedder)`；指纹包括原文哈希、解析/分段版本和元数据；缓存有效性校验，报告与 CURRENT 原子替换。
- [x] GREEN：目标测试与原14项测试通过。

## Task 3：内部任务服务

文件：`ingestion_service.py`；测试：`test_ingestion_service.py`。

- [x] RED：认证、提交、轮询、并发冲突、失败状态及参数限制。
- [x] 实现仅绑定127.0.0.1的服务，令牌来自环境变量；POST /v1/jobs 只执行固定扫描任务；GET /v1/jobs/{id} 返回任务状态。持久化任务结果并正确关闭服务。
- [x] GREEN：真实本地 HTTP 测试通过。

## Task 4：n8n 模板与运行说明

文件：`n8n-ingestion-workflow.json`、`library/README.md`、`library/DEPLOYMENT.md`。

- [x] 测试模板默认停用、不含密钥、成功/失败分支、轮询最大次数。
- [x] 提供触发→HTTP提交→等待→状态查询→分支→报告模板；n8n凭据与内部服务地址由使用者配置。
- [x] 说明容器网络、资料持久化、模型一致性，以及 pgvector 后续接入边界。

## Task 5：本批真实试跑

- [x] 用13份实际原件和真实384维模型运行；保存每份资料成功、排除、质量阻断等状态与数量。
- [x] 再运行验证缓存/去重；核对13份原件哈希不变，原170片段试验索引不变。
- [x] 执行本试验目录全部单元测试与新增模块语法检查，记录限制；不声称已在用户 n8n 实例运行或已上线。
