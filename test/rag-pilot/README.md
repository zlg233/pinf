# PRE-004～006 独立 RAG 技术试验

后续新增的13份资料归档和自动入库流程位于 `library/`，运行入口为 `ingestion.py`，本地任务接口为 `ingestion_service.py`，n8n导入模板为 `n8n-ingestion-workflow.json`。请先看 `library/README.md` 和 `library/REPORT.md`。下文保留最初PRE-004～006试验说明；两轮索引独立，不会覆盖旧170条试验数据。

此目录是一次本地试验，不是已上线的护理问答系统。业务代码、数据库和 n8n 工作流均不依赖此目录。

## 试验范围

- 来源：国家卫生计生委公报 2017 年第 02 期（总号 163）。
- 文件：`raw/nhc-2017-02-bulletin.pdf`，完整公报 116 页。
- 官方原文：<https://www.nhc.gov.cn/ewebeditor/uploadfile/2017/07/20170711102129596.pdf>。
- PDF 第 103 页包含通知（PRE-005），104～106 页包含规范（PRE-004），106～110 页包含附件 1《早产儿保健服务指南》（PRE-006）。这些共用来源编号 `NHC-2017-009`，不把三个目录条目复制成三份相同正文。
- PDF 第 111 页为年龄分组表，112 页为横置流程图。保留原图供人工核对，不将普通文字抽取结果自动向量化。
- 103 页上半部分是其他政策，113 页起是下一份文件，均不进入语料。

资料尚未进行临床审核，均标记为 `pending`。内部检索试验必须显式使用 `allow_pending=True`；默认正式检索返回零条。2017 年原文的存在不代表所有建议仍是当前适用标准。

## 文件与目录

| 路径 | 用途 |
| --- | --- |
| `pilot.py` | 按版面提取、切分、本地 ONNX 向量化、SQLite 向量存储和余弦检索 |
| `test_pilot.py` | 来源边界、双栏顺序、重复导入、模型隔离、审核过滤与引用校验测试 |
| `run_e2e.py` | 中文检索用例，以及可选的本地生成模型回答 |
| `download_models.py` | 从模型发布者仓库下载固定版本，分段续传，校验大小和 SHA256 |
| `raw/` | 官方 PDF 与页面核对图 |
| `models/` | 本地模型与版本记录 |
| `runtime/` | 官方 llama.cpp CPU 运行包和下载片段 |
| `outputs/` | 提取文本、片段、向量索引、测试报告 |

大文件和输出已在本目录的 `.gitignore` 中排除，原始文件和试验结果仍保存在本地。

## 本地运行（PowerShell，在本目录）

```powershell
uv venv .venv --python 3.13
uv pip install --python .venv/Scripts/python.exe -r requirements.txt
.venv/Scripts/python.exe -X utf8 download_models.py
.venv/Scripts/python.exe -X utf8 -m unittest discover -s . -p 'test_*.py' -v
.venv/Scripts/python.exe -X utf8 pilot.py build
.venv/Scripts/python.exe -X utf8 run_e2e.py --generate
```

自行输入问题查看命中的原文（`--allow-pending` 仅用于本次内部试验）：

```powershell
.venv/Scripts/python.exe -X utf8 pilot.py query --question '早产儿出院后如何随访？' --allow-pending
```

原文尚未下载时先执行：

```powershell
New-Item -ItemType Directory -Path raw -Force
curl.exe -L --fail --output raw/nhc-2017-02-bulletin.pdf https://www.nhc.gov.cn/ewebeditor/uploadfile/2017/07/20170711102129596.pdf
```

## 看懂 RAG 的每一步

1. **原文和来源**：公报是证据，Excel 是目录。页码从 1 开始；报告同时记录 PDF 页和印刷页。
2. **正文整理**：双栏按左栏到右栏读取；第 106 页有上下两个双栏区，分别读取。先保留完整父段落，再切分检索片段。
3. **向量**：使用 `Xenova/paraphrase-multilingual-MiniLM-L12-v2` 的量化 ONNX 导出，产生 384 维向量。版本和校验值保存在 `models/minilm/manifest.json`。
4. **长度控制**：使用同一分词器测量长度，每片段最多 110 tokens，模型上限 128；超过上限报错，不静默截断。查询也用同一个模型。
5. **检索**：SQLite 保存元数据和 float32 向量，NumPy 做精确余弦检索。这个小样本不需要近似检索索引；此版本尚未写入服务器 pgvector。
6. **补充上下文**：短片段用于检索，完整父段落供生成模型阅读，减少把适用条件截断的风险。
7. **生成回答**：使用 `Qwen/Qwen2.5-0.5B-Instruct-GGUF` Q4_K_M 与官方 llama.cpp CPU 程序。只在测试期间监听 `127.0.0.1:18591`，测试结束关闭进程。
8. **出处与不足**：引用来自实际命中的元数据；空证据不调用生成模型；虚构引用编号、缺少引用和截断输出被拒绝。对模型是否忠实表达原文仍需人工核对，引用有效不能证明答案内容完全正确。
9. **人群约束**：首轮发现老年人用药问题会误命中早产儿血糖内容，增加了显式成人/老年人群的实验级规则过滤。报告同时保留裸向量检索分数与过滤后的结果，不把规则的改善算作模型能力提升。该规则无法覆盖全部跨人群或复杂医学问题。

## 如何读报告

`outputs/REPORT.md` 是主要阅读入口；`outputs/e2e-report.json` 保留每道题的完整命中结果与实际回答状态。

- 检索通过要求前五条结果命中预先指定的原文页，且包含预先指定的原文证据要点，不等同于临床答案正确。
- 0.4 相似度阈值是试验参数，没有经过临床可靠性校准。
- 小模型只用于流程验证，不能据此认定具备上线质量。
- 用例没有覆盖临床诊疗、个体化剂量、全部连续对话及生产并发。
- n8n 联调和服务器 pgvector 导入不在这次离线试验中执行；后续须沿用相同模型配置或重新向量化。
