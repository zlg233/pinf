# 自动资料入库本地验收报告

日期：2026-10-24；当前实现仍为独立本地试验。

## 已完成

- 原始压缩包与13份解压文件完整保留；逐份SHA256复核通过。
- 自动扫描inbox，安全解包、分类、质量分流、清洗、分段、真实本地Embedding、缓存、索引快照及报告。
- 提供带令牌认证的异步HTTP任务接口与默认停用的n8n导入模板。
- 未修改业务代码、线上AI功能开关、生产数据库或现有n8n工作流。

## 最终验证结果

- 片段：**1949条，384维**；当前解析器 conservative-layout-v2。跨行条件尽量保留在同一个父段落。
- 13份资料：7份部分处理进入待审核索引，4份未通过当前格式/版面处理条件，2份产品资料排除。
- 新版解析器首次生成1949条向量；随后重复运行仍为1949条，新增Embedding为0，复用11份资料的处理缓存（包括阻断结果）。
- 独立试验目录37项单元测试通过；3个新增模块语法检查通过。
- 真实模型HTTP验证：未认证401；提交202；任务完成succeeded；内部检索有命中；默认正式检索0条。验证后HTTP服务关闭。
- 旧PRE-004～006试验索引仍为170条，索引文件SHA256与此次改动前一致。
- 早期解析器v1曾生成2348条片段；历史报告留作过程记录，以本报告和CURRENT指向的v2快照为准。片段变少是跨行合并后的重新切分，不表示已审核或完成全部资料处理。

## 当前逐文件结果

| 文件 | 当前状态 | 片段数 | 待处理事项 |
| --- | --- | ---: | --- |
| NICU出院高危儿0～3岁生长发育随访管理技术的专家共识 (1).pdf | partial_pending | 56 | possible_columns_need_layout_profile |
| 关于印发早产儿保健工作规范的通知.pdf | partial_pending | 169 | complex_table；sparse_text |
| 国卫办妇幼发〔2017〕9号-早产儿保健工作规范 (1).doc | blocked_quality | 0 | legacy_doc_needs_conversion |
| 新生儿常见呼吸道病毒感染预防的专家建议.pdf | partial_pending | 11 | possible_columns_need_layout_profile |
| 新生儿早期基本保健技术的临床实施建议.pdf | partial_pending | 20 | possible_columns_need_layout_profile |
| 早产临床防治指南 2024.pdf | blocked_quality | 0 | possible_columns_need_layout_profile |
| 早产儿与足月儿1岁内生长速度的比较.pdf | blocked_quality | 0 | possible_columns_need_layout_profile |
| 早产儿保健服务指南.docx | partial_pending | 122 | complex_table |
| 特殊状态儿童预防接种(广东)专家共识.pdf | partial_pending | 17 | possible_columns_need_layout_profile |
| 高危新生儿行为神经发育早期干预专家共识.pdf | blocked_quality | 0 | possible_columns_need_layout_profile |
| 小程序(1).pdf | excluded_product | 0 |  |
| 核心功能架构.pdf | excluded_product | 0 |  |
| 语料库（终版）.docx | partial_pending | 1554 | compiled_corpus_needs_primary_source_alignment；embedded_image |

## 产物位置

- 当前快照：`indexes/20261024T150432Z-a437d0e65103/`。
- `indexes/CURRENT.json`：当前快照指针；每次成功运行后更新。
- `processed/`：保留清洗文本、父段落/定位、片段、向量缓存和校验信息。
- `../outputs/ingestion-http-smoke.json`：最终真实模型HTTP与去重验收证据。
- `../outputs/ingestion-unit-tests.txt`：37项测试结果。
- `catalog/import-manifest.json`：最初收件清单，不代表当前入库状态。

## 还没有完成的部分

1. 本地索引使用SQLite＋NumPy，尚未写入服务器pgvector。n8n模板尚未在用户实例导入运行，需要配置地址、凭据并验证实际版本。
2. 所有片段都是pending。清洗成功不等于医学审核通过；本阶段没有自动批准或正式发布接口。汇编语料还需对应原始来源，产科/住院/居家/随访适用范围还需审核标注。
3. 复杂双栏、表格、图片、流程图、旧DOC需要专用解析或人工处理。当前保守跳过问题页或区块，不承诺资料全文已经完整向量化。
4. PDF断行合并是启发式，跨页条件、段落边界和引用文献仍需人工核对；当前无法据此证明问答具有临床可靠性。上一轮小模型回答遗漏和场景混用的问题没有因入库自动解决。
5. 采用本会话自查与自动化验证；独立代理审阅因额度不可用未执行。

## 后续添加文件

将ZIP/PDF/DOCX放入 `inbox/`，在上级rag-pilot目录运行：

```powershell
.venv/Scripts/python.exe -X utf8 ingestion.py run
```

要由n8n触发，请按 `DEPLOYMENT.md` 启动处理服务、导入模板并配置两个HTTP节点的Header Auth凭据。模板启用后才会自动定时扫描。
