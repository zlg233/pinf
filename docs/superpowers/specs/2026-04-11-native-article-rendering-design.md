# 小课堂文章内容原生渲染设计

## 背景

小课堂模块当前通过微信 API 同步公众号文章，但 `_pick_content()` 只存储了 `digest`（几十字摘要），完整 HTML 内容被丢弃。前端详情页用 `<Text>` 渲染纯文本摘要，用户需点击 `source_url` 跳转微信阅读全文。

**问题：**
1. `source_url` 可能与实际文章不匹配，跳转体验不可靠
2. 用户无法在 App 内阅读完整文章
3. 微信 API 已返回完整 HTML，但未使用

## 目标

- 将微信 API 返回的完整 HTML 存入数据库 `content` 字段
- 前端详情页用 WebView 原生渲染 HTML，不再跳转外部链接
- 废弃 `source_url` 的展示（保留字段）

## 方案选择

**方案 A（已选定）：详情页内嵌 WebView**

改动最少（3 个文件），复用现有组件，样式还原度最高。

## 设计细节

### 1. 后端改动

**文件：** `backend/utils/wechat_content_sync.py`

修改 `_pick_content()` 函数，优先取完整 HTML：

```python
def _pick_content(news_item):
    html = (news_item.get("content") or "").strip()
    if html:
        return html
    digest = (news_item.get("digest") or "").strip()
    if digest:
        return digest
    return "暂无内容"
```

**无需修改其他后端文件：**
- `models/content.py` — `content` 字段已是 `db.Text`，足以存储 HTML
- `routes/content.py` — `to_dict()` 已返回 `content`
- `wechat_official.py` — API 调用逻辑不变

**数据迁移：** 需执行一次 `POST /api/content/wechat/sync` 带 `force_full=true` 全量同步，刷新已有文章的 content。

### 2. 前端改动

**文件：** `app_end/app/class-article/[id].tsx`

#### 2.1 WebView 渲染 content

替换 `<Text style={styles.contentText}>{article.content}</Text>` 为 WebView 组件：

- 使用 `react-native-webview`（Expo 内置）
- `source={{ html: wrappedHtml }}` 加载 HTML
- 注入基础 CSS 确保：图片自适应宽度、文字颜色/字号匹配 Organic 主题、合理 padding
- WebView 高度自适应：注入 JS 获取 `document.body.scrollHeight`，通过 `onMessage` 回调更新容器高度

#### 2.2 移除 source_url 展示

- 删除"文章链接"卡片（`linkCard` 区块）
- 删除 `handleOpenSource` 函数
- 删除 `buildWebviewRoute` 导入（如无其他引用）
- 保留 `source_url` 在类型定义和 API 层（不删除字段）

#### 2.3 保留的 UI 元素

- 封面图（coverUrl）
- 文章标题
- 作者 + 发布日期元数据行
- 分类标签（OrganicChipButton）
- 返回按钮

### 3. 涉及文件清单

| 文件 | 改动类型 |
|------|---------|
| `backend/utils/wechat_content_sync.py` | 修改 `_pick_content()` |
| `app_end/app/class-article/[id].tsx` | WebView 替换 Text + 移除链接卡片 |

### 4. 不做的事情

- 不删除 `source_url` 数据库字段（保留用于追溯）
- 不实现离线缓存图片（可渐进增加）
- 不修改列表页 `class.tsx`（列表显示的是标题 + digest 不受影响）
- 不修改 API 接口格式

### 5. 验收标准

1. 后端全量同步后，数据库 `content` 字段存储完整 HTML
2. 前端详情页用 WebView 渲染 HTML，样式正常（图片自适应、文字可读）
3. 不再显示"文章链接"卡片
4. 列表页功能不受影响
5. `bun run lint` + `npx tsc --noEmit` 通过
