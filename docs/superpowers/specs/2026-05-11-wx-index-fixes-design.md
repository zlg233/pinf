# 微信小程序首页 + 内容详情修复

## 变更范围

3 个独立修复，互不依赖：

### 1. 快捷入口图标

**根因**: `actionItems` 使用 Unicode PUA 码点（``~``），需 iconfont 支持。项目未加载 iconfont，码点无效。

**修复**: 替换为 emoji，复用项目 `ICON_MAP` 的降级模式。

| 入口 | 新图标 |
|------|--------|
| 成长曲线 | 📈 |
| AI 问答 | 💬 |
| 添加预约 | 📅 |
| 内容课堂 | 📚 |

**文件**: `src/pages/index/index.tsx`

### 2. 近期预约标题 + 排序

**根因**: `sortAppointments` 升序排列导致过期预约排在最前，`.slice(0, 3)` 截掉了最新预约。

**修复**:
- 标题 "近期复诊" → "近期预约"，空态文案 "添加复诊预约" → "添加预约"
- `filteredAppointments` 增加过滤：排除 `overdue` + `completed`，仅保留未来待就诊
- 排序保持按 `scheduledAt` 升序（最近预约排最前）

**文件**: `src/pages/index/index.tsx`

### 3. 内容详情 URL 清洗

**根因**: 后端返回的 URL 字段可能带有编码引号（`&quot;` 或字面 `"`），导致 `<Image>` / `<Video>` 将其当作相对路径。

**修复**:
- `cleanHtml`: 增加 HTML 实体解码（`&quot;` `&#34;` 等）和 img src 中引号清洗
- 新增 `sanitizeUrl` 工具函数：trim + 去首尾引号 + 验证 protocol
- 文章页 `coverUrl`、视频页 `downUrl` / `coverUrl` 统一调用 `sanitizeUrl`
- 视频页 scroll-view padding 移到内层 View

**文件**: `src/pages/article-detail/index.tsx`, `src/pages/video-detail/index.tsx`, `src/pages/video-detail/index.scss`

## 验证方式

1. 首页快捷入口 4 个图标肉眼可见
2. 近期预约只显示未来待就诊的前 3 条，过期/已完成不出现
3. 文章详情封面图加载成功，正文 RichText 图片不报 500
4. 视频详情页视频可播放，scroll-view 无 padding 警告
