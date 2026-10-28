# 手动维护公众号视频卡片 Implementation Plan

> **状态：已暂停，未执行（2026-10-27）。** 用户最终决定保留小程序内视频播放，改用后端开关隐藏视频入口，实施方案见 `docs/superpowers/specs/2026-10-27-miniprogram-review-remediation-design.md` 的「修复二」。本计划保留作为后续备选，**不要按此执行**。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 1Panel 手动维护公众号内容，小程序视频栏目自动读取并以现有风格显示可跳转卡片。

**Architecture:** 使用外置 JSON 文件和只读目录挂载，不新增数据库表或管理后台。Flask 校验并提供分页列表，Taro 复用现有卡片与反馈，通过官方原生接口打开公众号页面。

**Tech Stack:** 现有 Flask/Python、Taro 3.6.38/React/TypeScript、Organic UI、Bun 测试、pytest、Docker Compose。

**Spec:** `docs/superpowers/specs/2026-10-27-manual-official-video-cards-design.md`

## Global Constraints

- 当前仅制定计划；用户审阅确认后实施。本计划建议在当前会话依次执行，不默认派发子任务。
- 复用现有依赖和组件，不安装新前端框架，不把 `webend` 展示站改造成 CMS。
- 配置格式 `version=1`，最多 200 条、文件最大 1 MiB；字段限制以 Spec 为准。
- 公众号跳转使用 `wx.openOfficialAccountArticle`，仅在用户点击处理内直接调用。
- 工程基础库为 `3.17.3`，接口最低要求为 `3.4.8`。
- 用户取消不报错；不支持和失败分别使用 Spec 指定文案及现有 `notify`。
- 新接口沿用 JWT；不新增公开写接口，不把手机号验证码登录升级成管理权限。
- 不改数据库结构，不改 `updatedb`，不把发表链接写进 `url/down_url`。
- 首条范例为用户已提供的“袋鼠式护理（本科室）”及对应链接。
- 保留现有用户改动，尤其 `.gitignore`、`backend/uv.lock`、未跟踪的 `app_end/project.config.json` 和 `test/`。
- 下列提交均为计划中的功能提交，不代表已实施；不自动部署或提审。

## Review Focus

- 1Panel 保存到一半产生无效 JSON：Task 1 测试保留最近有效版本，冷启动返回 503。
- 开关写成字符串 `"false"`、重复 ID、临时或仿冒链接：Task 1 验证整份拒绝，不发布部分内容。
- 有效配置将某项下架：Task 2、Task 4 验证下一次拉取立即移除，不复用一小时缓存。
- 复制链接含签名参数、查询字符串和片段：Task 1、Task 3 验证原值被保留并准确交给微信。
- 同步或功能开关变化：Task 4、Task 5 验证小程序仍无素材播放请求，手动配置不受同步容器维护影响。

## 文件与接口边界

新增：
- `backend/utils/official_video_catalog.py`：配置格式校验、最近有效版本、校验 CLI。
- `backend/routes/official_videos.py`：分页只读接口，独立于旧视频播放接口。
- `backend/utils/tests/test_official_video_catalog.py`。
- `backend/routes/tests/test_official_video_routes.py`。
- `wx_end/src/utils/open-official-article.ts`：原生文章接口适配和错误反馈。
- `wx_end/src/pages/classroom/official-video-state.ts`：目录版本变化和翻页合并的纯逻辑。
- `wx_end/tests/open-official-article.test.ts`。
- `wx_end/tests/official-video-api.test.ts`。
- `wx_end/tests/classroom-official-videos.test.ts`。
- `deploy/official-videos.example.json`。
- `docs/deployment/manual-official-video-cards.md`。

修改：
- `backend/config.py`、`backend/app.py`：配置路径和蓝图注册。
- `wx_end/src/types/content.ts`、`wx_end/src/services/api/content.ts`：新卡片类型和请求。
- `wx_end/src/pages/classroom/index.tsx`、必要的 `index.scss`：列表及点击。
- `wx_end/src/pages/index/index.tsx`：核对首页课堂入口是否仍进入正确栏目。
- `wx_end/src/app.config.ts`、`wx_end/project.config.json`：解除播放页注册并设置基础库。
- `docker-compose.yml`：外置目录只读挂载。

移除仅属于旧小程序播放路径的页面、URL 工具及失去对应功能的测试：`wx_end/src/pages/video-detail/`、`wx_end/tests/video-detail-url.test.ts`。旧 `content-api.test.ts` 的播放请求测试随小程序接口移除调整，后端及 App 视频测试保留。

### Task 0：恢复可用的官方文章跳转验证

**范围：** 当前临时项目 `C:/Users/21598/AppData/Local/Temp/pinf-material-link-probe-bdd0b2f9/`，不改产品功能。

**接口：** 只使用一个普通计数按钮和一个已发表文章按钮；成功标准是真机打开已提供的文章，而非 mock 返回成功。

- [ ] 保存当前 `@swc/runtime/_type_of.js` 缺失错误作为失败证据，确认页面脚本加载情况。
- [ ] 将临时页改为纯 ES5 写法、关闭该临时项目的 ES6 转换，避免自动生成未打包的 SWC 依赖；不要改安全设置或关闭域名校验。
- [ ] 将 Node 验证脚本移出预览包；编译后先验证普通计数按钮能从 0 变成 1，再测试文章按钮。
- [ ] 手机验证打开 `https://mp.weixin.qq.com/s/ZZo7Wlyjx-vHjOS6aVvFEw`、播放和返回；记录实际结果。如未通过，查明平台限制后再确定产品点击实现，不把失败伪装成成功。

### Task 1：配置校验与最近有效版本

**Files:** 新增 `backend/utils/official_video_catalog.py`、对应 utils 测试及 `deploy/official-videos.example.json`。

**Interfaces:**
- `validate_catalog(payload: object) -> list[dict]`：返回完整、规范化的记录列表；错误抛 `CatalogValidationError`。
- `CatalogSnapshot`：包含 `items: list[dict]` 和 `revision: str` 的快照类型。
- `OfficialVideoCatalog(path: str).read() -> CatalogSnapshot`：返回最近有效完整列表及规范化内容 SHA-256 版本值；无有效版本抛 `CatalogUnavailableError`。
- 字典规范化键：`id/title/articleUrl/coverUrl/description/enabled`；缺省可选字符串为空，`enabled=false`。
- 模块 CLI：`uv run python -m utils.official_video_catalog --check <path>`，只读，退出码表达校验结果。

- [ ] RED：编写有效单条、空目录、全部禁用、非法主机/协议/端口/素材页/临时链接、重复记录、字符串布尔值、字段和大小边界测试；断言已给定文章地址原样保留。
- [ ] RED：编写“先有效再损坏返回旧版本”“有效下架后返回禁用版本”“冷启动损坏或缺失抛不可用”的行为测试，使用临时文件，不连接微信或数据库。
- [ ] 运行 `cd backend; uv run pytest utils/tests/test_official_video_catalog.py -q`，确认因缺失目标模块/行为而失败。
- [ ] GREEN：使用标准库 JSON、URL 解析和文件读取实现；整体校验成功才替换快照，使用进程内锁保护快照读写；日志给出字段位置，不打印整份配置。
- [ ] GREEN：实现 CLI，验证失败返回非零退出码；写入首条已知内容范例，不猜测封面。
- [ ] 重跑目标测试并运行范例校验，均通过后提交 `feat: add validated official video catalog`。

### Task 2：后端只读列表

**Files:** 新增 `backend/routes/official_videos.py`、对应 route 测试；修改 `backend/config.py`、`backend/app.py`。

**Interfaces:**
- `Config.OFFICIAL_VIDEO_CONFIG_PATH` 从同名环境变量读取，默认空值；未配置且没有有效版本视为不可用。
- 每个 Flask 应用通过 `app.extensions` 保存自己的 `OfficialVideoCatalog` 实例，不跨测试或应用共享。
- `GET /api/content/official-videos?page=1&per_page=10&search=`；蓝图注册到现有 `/api` 前缀。
- 200 响应：`{status:'success', data: OfficialVideoCard[], revision:string, pagination:{page,perPage,total,pages,hasNext,hasPrev}}`；只列启用项，按原数组顺序。
- 未授权 401；配置不可用 503，文案“内容暂时无法加载，请稍后重试”；成功响应 `Cache-Control: no-store`。

- [ ] RED：编写 JWT 拒绝、仅返回启用项、搜索标题/简介、分页顺序、空列表和缺配置 503 测试。
- [ ] RED：同一应用先请求启用项，再修改文件下架，第二次请求断言列表和总数立即更新；断言没有访问旧视频地址解析或微信 API。
- [ ] 运行 `cd backend; uv run pytest routes/tests/test_official_video_routes.py -q`，确认目标接口缺失而失败。
- [ ] GREEN：复用现有 `token_required` 及分页响应约定，但不调用旧 `_CACHE`；捕获配置异常并明确返回 503，避免被认证装饰器统一转换成 401。
- [ ] 运行两个新测试模块和 `routes/tests/test_content_video_routes.py`，确保新接口通过、旧 App 视频接口行为保留；目标模块语法检查通过后提交 `feat: expose official video card catalog`。

### Task 3：小程序数据接口与微信文章适配

**Files:** 修改 `wx_end/src/types/content.ts`、`services/api/content.ts`；新增文章适配工具和上述两份测试。

**Interfaces:**
- `OfficialVideoCard`：`id: string; title: string; articleUrl: string; coverUrl: string; description: string`。
- `OfficialVideoListResponse`：现有分页响应形状加 `revision: string`，`data` 为 `OfficialVideoCard[]`。
- `listOfficialVideos(params?: ContentListParams): Promise<OfficialVideoListResponse>`：请求 `/content/official-videos`，不写入或读取旧一小时列表缓存。
- `openOfficialArticle(articleUrl: string): void`：直接调用原生微信对象，支持旧 Taro 未暴露该新方法的情况；类型声明局限在适配文件，不引入新依赖。
- 可测试工厂 `createOfficialArticleOpener(nativeApi: OfficialArticleApi, notifyFn: (message: string) => void): (articleUrl: string) => void`；默认实现使用原生对象及现有 `notify`。

- [ ] RED：请求测试断言准确路径、分页和搜索参数，连续两次调用均实际请求，不调用缓存或 `include_play_url`。
- [ ] RED：适配器测试断言传入地址原样到达 API、取消不报错、缺少接口和失败使用 Spec 指定文案；未触发点击函数时不调用 API。
- [ ] 运行 `cd wx_end; bun test tests/official-video-api.test.ts tests/open-official-article.test.ts` 并确认缺失行为失败。
- [ ] GREEN：实现类型、请求和适配器，保留平台回调结构；不要用测试成功回调代替真机结论。
- [ ] 重跑测试通过后提交 `feat: add official article navigation adapter`。

### Task 4：原风格卡片接入及移除内置播放

**Files:** 修改课堂、首页必要关联、页面注册、工程基础库配置；移除旧小程序播放页及过时客户端函数/测试。

**Interfaces:**
- 视频栏目的数据项使用 `OfficialVideoCard`，文章栏目数据结构不变。卡片 `onClick` 直接调用 Task 3 的 `openOfficialArticle(item.articleUrl)`。
- 在 `official-video-state.ts` 定义 `OfficialVideoListState = { items: OfficialVideoCard[]; pagination: ContentPagination | null; revision: string | null }`。
- `applyOfficialVideoPage(previous: OfficialVideoListState, incoming: OfficialVideoListResponse, mode: 'replace' | 'append'): { state: OfficialVideoListState; reloadFirstPage: boolean }`。
- `replace` 完整替换；相同版本 `append` 按 ID 保序合并，重复 ID 使用新值；版本不同的 `append` 清空当前快照并返回 `reloadFirstPage=true`，调用方立即拉第一页，不拼接旧版本卡片。

- [ ] RED：在 `classroom-official-videos.test.ts` 测试替换后旧的已下架项消失、相同版本去重合并、不同版本翻页触发重新加载；不以源码字符串扫描替代行为测试。
- [ ] 运行 `cd wx_end; bun test tests/classroom-official-videos.test.ts`，确认目标模块或行为缺失导致失败。
- [ ] GREEN：实现纯合并函数并接入视频分页流程；请求失败不调用替换逻辑。仅整理本次视频逻辑，不重构整页。
- [ ] GREEN：复用卡片样式、刷新控件、搜索和分页；封面可为空并支持图片错误占位；标签为“在公众号观看”。首次显示、`useDidShow` 和下拉刷新统一读取新数据，避免同时重复触发首次拉取。
- [ ] GREEN：替换混合搜索中旧视频源；移除旧播放器、URL 工具、详情页注册及小程序播放地址请求；更新对应过时测试。保留功能开关控制栏目可见性，但任何值都不恢复原生播放。
- [ ] 保持页面 Hook 调用顺序固定：将当前位于 Hook 之前的功能关闭条件导航移入 effect，避免功能开关加载后条件返回导致 Hook 数量变化；在修改后的课堂页验证开关变化不崩溃。
- [ ] GREEN：公共工程基础库设为 `3.17.3`，核对首页和旧分享/详情路径无法进入播放器。
- [ ] 运行 `cd wx_end; bun test`、现有 ESLint（`bunx eslint src --ext .ts,.tsx`）、`bunx tsc --noEmit`、`bun run build:weapp`。原有无关失败要记录并区分，不擅自扩展修复。
- [ ] 在开发者工具检查构建包、正常文章栏目和新卡片；手机复测点击/取消/返回。通过后提交 `feat: show official video cards in classroom`。

### Task 5：目录挂载与维护指引

**Files:** 修改 `docker-compose.yml`；新增 `docs/deployment/manual-official-video-cards.md`。

**Interfaces:** 挂载 `${PINF_CONTENT_DIR:-../pinf-content}:/app/content-config:ro`；容器环境变量 `OFFICIAL_VIDEO_CONFIG_PATH=/app/content-config/official-videos.json`。范例来自 Task 1。

- [ ] 文档给出首次准备外置目录、复制范例、只读校验、部署后端、构建上传小程序的步骤。所有新建内容位于明确目录，部署命令不删除数据库或重启无关容器。
- [ ] 文档给出每次在 1Panel 录入标题/地址、可选封面/简介、保存并校验、下架、调整顺序、备份恢复的操作；更新时不需要重新构建容器或小程序。
- [ ] 通过 `docker compose config --quiet` 校验配置，不输出现有敏感环境变量；若本地缺少部署环境文件，明确记录该验证尚未完成，不临时伪造生产配置。
- [ ] 经用户授权的部署环境中验证目录只读挂载、原子替换文件后下一次请求生效、重启后正确加载、无效文件的保留/503 行为；确认 `updatedb` 同步不触碰外置文件。
- [ ] 部署前备份有效配置，写明回退到上一后端/小程序版本及配置备份的步骤；不把回退描述为删除用户数据。
- [ ] 提交 `docs: document manual official video maintenance`（含 Compose 配置）。

## 最终验收与交接

- [ ] 初始仅显示“袋鼠式护理（本科室）”一张已配置卡片，标题和链接匹配。
- [ ] 修改标题、新增、下架、排序后，进入/返回课堂或下拉刷新取得最新数据，无需发版。
- [ ] 材料库原有其他三条未发表内容不会被自动当作可跳转入口。
- [ ] JSON 错误不会覆盖已加载有效目录；冷启动缺配置正确提示异常。
- [ ] 用户端没有小程序播放器、MP4 解析请求或后台写权限。
- [ ] 真机通过已发表页面打开、播放和返回；审核符合性仍由平台复审确认。
- [ ] 所有计划内功能按任务提交，保留用户原有工作区改动；执行过程中每项都记录实际验证结果。
