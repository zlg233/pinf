# 自动入库运行与 n8n 接入说明

这是独立本地试验，不会更改已上线的小程序、Flask业务路由、现有AI Agent或聊天记忆表。使用前先读 `README.md` 中的状态含义。

## 本地一条命令

在 `D:\BK\AIProjects\pinf\test\rag-pilot`：

```powershell
.venv/Scripts/python.exe -X utf8 ingestion.py run
```

默认资料根为 `library/`。需要另一个目录时，用全局参数放在子命令前：

```powershell
.venv/Scripts/python.exe -X utf8 ingestion.py --root D:/OtherKnowledge run
```

也可主动导入一个ZIP，原ZIP不改写，副本进入新资料根的 `archives/`：

```powershell
.venv/Scripts/python.exe -X utf8 ingestion.py import --archive 'D:/完整路径/资料.zip'
.venv/Scripts/python.exe -X utf8 ingestion.py run
```

原件内容哈希发生异常时整次任务失败，CURRENT保持不变。单个文件解析失败则记录在报告，其他文件继续；因此“任务成功完成”不代表每个文件都通过，更不代表医学审核通过。完整性错误应先检查原因，不要通过改校验值绕过。

## 给 n8n 调用的任务服务

1. 通过安全方式设置进程环境变量 `RAG_INGESTION_TOKEN`，使用至少24个ASCII字符的随机令牌。令牌不要写进仓库、workflow JSON或聊天。服务没有默认密码。
2. 启动：

```powershell
.venv/Scripts/python.exe -X utf8 ingestion_service.py
```

默认只监听 `127.0.0.1:18592`。访问都要提供 `Authorization: Bearer <令牌>`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/v1/health` | 查看服务状态 |
| POST | `/v1/jobs` | JSON `{"action":"scan"}`，提交固定的资料扫描任务，返回202和job_id |
| GET | `/v1/jobs/{job_id}` | 查看queued/running/succeeded/failed及执行摘要 |

参数不允许指定系统路径或任意命令。并发提交返回409；单个库的文件锁也会阻止多个处理进程同时运行。每个资料根只运行一个任务服务实例。进程重启会把前次未完成任务标记为失败；若进程被强杀留下 `.ingestion.lock`，先核对文件中的PID确实不再运行，再移除该锁，不能自动删除活跃任务的锁。

服务按需加载本地Embedding模型；首次新资料生成向量可能花费数分钟。状态接口采用异步轮询，HTTP提交无需等待整份资料清洗结束。此服务用于受控本地/内网验证，不应直接公开到互联网。

## 导入 n8n 模板

模板：上级目录的 `n8n-ingestion-workflow.json`，默认 `active=false`，无凭据。

1. 在n8n中从文件导入模板，先保留停用状态。
2. 编辑 `Configuration` 的 `service_url`。n8n和处理服务均在同一台非容器机器上时可用 `http://127.0.0.1:18592`；容器场景见下一节。
3. 在n8n Credentials中新建Header Auth：名称 `Authorization`，值为 `Bearer `加上与服务一致的令牌。给 `Submit job` 和 `Job status` 两个HTTP节点选择这一凭据。
4. 手动执行：Manual Trigger → 提交任务 → 等待5秒 → 查询状态 → 成功摘要/失败分支。最多120次状态轮询；超时只停止n8n等待，不取消后台任务。409表示已有任务，需要查看已有任务而不是反复提交。
5. 确认实际n8n版本支持这些节点参数、报告符合预期后，再决定启用定时节点。模板为每小时检查一次，时区 `Asia/Singapore`，可自行调整。

已做JSON结构、连线与凭据缺省检查，并实际验证了Python HTTP任务接口。尚未向用户n8n实例导入执行，不能视为完成n8n运行兼容性验证。HTTP网络异常会让执行报错；任务内的逐文件问题仍需在摘要和详细报告中查看。

## Docker / 服务器阶段

推荐将处理服务作为独立容器，与n8n加入同一内网。n8n用 `http://rag-ingestion:18592`（示例服务名）调用它。处理服务在容器内用 `--host 0.0.0.0`，不必向公网发布18592端口。**容器里的127.0.0.1只代表该容器本身**。

资料根与模型目录分别持久化挂载；inbox可写以接收投递，raw/archives原件只读使用，processed/indexes/runs/catalog为可写产物。首次导入时处理器需创建raw/archives，正式只读原件部署应把归档导入与清洗任务分开配置，不能直接把整个资料根只读挂载后期望能自动解包。本地版本以同一进程执行归档与清洗，因此当前需要资料根可写。

n8n只访问HTTP服务，无需在n8n容器里安装Python、ONNX或模型，不需要打开Execute Command节点。资料根不要与PostgreSQL的PGDATA混用。当前未生成或执行生产Compose覆盖文件，也没有重建任何线上容器。

## 生产 pgvector 尚需完成的工作

当前保存真实的384维向量，后端是SQLite元数据与float32向量，NumPy做精确余弦检索。它验证了自动处理流程，并没有向服务器pgvector写数据。

正式接入应增加独立的文档、版本、片段、审核和向量表，不复用Postgres Chat Memory。需要保留：原件哈希、处理指纹、模型版本、维度、原文定位、父段落、来源、适用人群和护理阶段。文档向量使用 `vector(384)` 之前，先验证服务器扩展版本与向量类型支持；若换Embedding模型必须重新生成整个索引，不能混用相同维度的不同模型。

审核发布必须绑定具体文档版本和片段。审核后才可将通过的片段置为approved并由正式检索读取；不能把文件名“终版”或清洗通过当作审核通过。本地服务刻意没有批准接口。Flask业务模型纳入时，遵循仓库要求同步model、db_migrations、to_dict，并运行迁移与检索验收。

## 复现测试

```powershell
.venv/Scripts/python.exe -X utf8 -m unittest discover -s . -p 'test_*.py' -v
.venv/Scripts/python.exe -X utf8 -m py_compile ingest_documents.py ingestion.py ingestion_service.py
```

测试会临时开启本机随机端口并在结束时关闭；受限环境可能需要允许本机HTTP连接。不会连接线上n8n或外部AI。

## 文档依据

- [n8n HTTP Request认证](https://docs.n8n.io/integrations/builtin/credentials/httprequest/)
- [n8n文件节点与容器挂载](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.readwritefile/)
- [n8n Execute Command运行位置与限制](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executecommand/)
