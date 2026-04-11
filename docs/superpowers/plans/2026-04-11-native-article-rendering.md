# 小课堂文章原生渲染 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将微信 API 返回的完整 HTML 存入数据库，前端详情页用 WebView 原生渲染，废弃 source_url 展示。

**Architecture:** 后端修改 `_pick_content()` 优先存储完整 HTML；前端详情页用内嵌 WebView 替换 Text 渲染 content，移除 source_url 链接卡片；列表页改为始终跳转详情页。

**Tech Stack:** Python/Flask (后端), React Native + Expo + react-native-webview 13.15.0 (前端), pytest (后端测试)

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `backend/utils/tests/test_wechat_content_sync.py` | 后端 `_pick_content` 单元测试 |
| Modify | `backend/utils/wechat_content_sync.py:79-86` | 修改 `_pick_content()` 优先取完整 HTML |
| Modify | `app_end/app/(tabs)/class.tsx:136-156` | 列表页始终跳转详情页 |
| Modify | `app_end/app/class-article/[id].tsx` | WebView 渲染 HTML + 移除 source_url 卡片 |

---

### Task 1: 后端 `_pick_content()` 改造 — 存储完整 HTML

**Files:**
- Create: `backend/utils/tests/test_wechat_content_sync.py`
- Modify: `backend/utils/wechat_content_sync.py:79-86`

- [ ] **Step 1: 写失败测试**

创建 `backend/utils/tests/test_wechat_content_sync.py`：

```python
"""
Tests for wechat_content_sync helper functions.
"""
from utils.wechat_content_sync import _pick_content


class TestPickContent:
    """Test _pick_content function."""

    def test_returns_html_when_content_present(self):
        """优先返回完整 HTML 内容。"""
        news_item = {
            "content": "<p>这是完整文章内容</p><img src='x.jpg'/>",
            "digest": "这是摘要",
        }
        assert _pick_content(news_item) == "<p>这是完整文章内容</p><img src='x.jpg'/>"

    def test_falls_back_to_digest_when_no_content(self):
        """content 为空时降级到 digest。"""
        news_item = {"content": "", "digest": "只有摘要"}
        assert _pick_content(news_item) == "只有摘要"

    def test_falls_back_to_digest_when_content_missing(self):
        """content 字段不存在时降级到 digest。"""
        news_item = {"digest": "只有摘要"}
        assert _pick_content(news_item) == "只有摘要"

    def test_returns_default_when_both_empty(self):
        """content 和 digest 都为空时返回默认文本。"""
        assert _pick_content({}) == "暂无内容"
        assert _pick_content({"content": "  ", "digest": ""}) == "暂无内容"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest utils/tests/test_wechat_content_sync.py -v`
Expected: `test_returns_html_when_content_present` FAIL — 当前 `_pick_content` 只取 digest，不取 content

- [ ] **Step 3: 修改 `_pick_content()` 实现**

修改 `backend/utils/wechat_content_sync.py:79-86`，替换为：

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

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && uv run pytest utils/tests/test_wechat_content_sync.py -v`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add backend/utils/tests/test_wechat_content_sync.py backend/utils/wechat_content_sync.py
git commit -m "feat: _pick_content 优先存储微信文章完整 HTML"
```

---

### Task 2: 列表页 — 始终跳转详情页

当前列表页 `handleArticlePress` 会先尝试用 `sourceUrl` 打开 WebView，失败才跳详情页。现在应始终跳详情页。

**Files:**
- Modify: `app_end/app/(tabs)/class.tsx:136-156`

- [ ] **Step 1: 删除 sourceUrl 跳转逻辑**

将 `class.tsx:136-156` 的 `handleOpenSourceUrl` 和 `handleArticlePress` 替换为：

```typescript
const handleArticlePress = useCallback(
    (article: ContentArticle) => {
      router.push(`/class-article/${article.id}`);
    },
    []
  );
```

同时删除 `handleOpenSourceUrl` 函数（第 136-146 行）和 `buildWebviewRoute` 导入（第 21 行）：

```typescript
// 删除这行导入
import { buildWebviewRoute } from '@/utils/open-external-url';
```

- [ ] **Step 2: 运行前端检查**

Run: `cd app_end && bun run lint && npx tsc --noEmit`
Expected: PASS，无类型错误

- [ ] **Step 3: 提交**

```bash
git add app_end/app/(tabs)/class.tsx
git commit -m "refactor: 列表页始终跳转文章详情页，移除 sourceUrl 跳转"
```

---

### Task 3: 详情页 — WebView 渲染 HTML + 移除 source_url 卡片

核心改动：用 `<WebView>` 内嵌渲染 HTML 替换 `<Text>`，移除"文章链接"卡片。

**Files:**
- Modify: `app_end/app/class-article/[id].tsx`

**关键设计决策：**
- WebView 内嵌在 ScrollView 中，需要动态计算高度（注入 JS 获取 `scrollHeight`）
- 注入 CSS 让图片自适应宽度、文字颜色匹配 Organic 主题
- `scrollEnabled={false}` 禁用 WebView 内部滚动，由外层 ScrollView 控制

- [ ] **Step 1: 更新导入**

在 `class-article/[id].tsx` 顶部：
- 新增导入：`import { WebView } from 'react-native-webview';`
- 删除导入：`import { buildWebviewRoute } from '@/utils/open-external-url';`
- 删除导入中未使用的 `useCallback`（`handleOpenSource` 删除后不再需要）— 如果 `fetchDetail` 仍用 `useCallback` 则保留

- [ ] **Step 2: 新增 WebView 高度状态和 HTML 构建函数**

在组件内 `fetchDetail` 之后添加：

```typescript
const [webViewHeight, setWebViewHeight] = useState(100);
```

在组件外部（`formatDate` 之后）添加 HTML 构建辅助函数：

```typescript
const buildArticleHtml = (content: string) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  body {
    margin: 0;
    padding: 0;
    font-size: 15px;
    color: #4A4A4A;
    line-height: 1.75;
    word-wrap: break-word;
    -webkit-text-size-adjust: 100%;
  }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 8px 0;
    border-radius: 8px;
  }
  p { margin: 0 0 12px; }
  a { color: #5B9A8B; text-decoration: none; }
  blockquote {
    margin: 12px 0;
    padding: 8px 16px;
    border-left: 3px solid #5B9A8B;
    background: #FFF9F5;
    color: #7A7A7A;
  }
  table { max-width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 8px; border: 1px solid #e0e0e0; }
</style>
</head>
<body>
${content}
<script>
(function() {
  function sendHeight() {
    var h = document.body.scrollHeight;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h }));
  }
  sendHeight();
  window.addEventListener('load', sendHeight);
  var imgs = document.getElementsByTagName('img');
  for (var i = 0; i < imgs.length; i++) {
    imgs[i].addEventListener('load', sendHeight);
  }
})();
</script>
</body>
</html>`;
```

- [ ] **Step 3: 删除 handleOpenSource 函数**

删除整个 `handleOpenSource` 回调（原第 51-62 行）。

- [ ] **Step 4: 替换 content 渲染区域**

在 JSX 中，将：

```tsx
{article.sourceUrl && (
  <OrganicCard variant="ghost" shadow={false} style={styles.linkCard}>
    <Text style={styles.linkLabel}>文章链接</Text>
    <TouchableOpacity onPress={handleOpenSource}>
      <Text style={styles.linkValue} numberOfLines={2}>
        {article.sourceUrl}
      </Text>
    </TouchableOpacity>
  </OrganicCard>
)}
<Text style={styles.contentText}>{article.content}</Text>
```

替换为：

```tsx
<View style={{ height: webViewHeight }}>
  <WebView
    originWhitelist={['*']}
    source={{ html: buildArticleHtml(article.content) }}
    scrollEnabled={false}
    style={{ height: webViewHeight }}
    onMessage={(event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'height' && data.height > 0) {
          setWebViewHeight(data.height);
        }
      } catch { /* ignore non-JSON messages */ }
    }}
  />
</View>
```

- [ ] **Step 5: 清理样式**

删除不再使用的样式：

```typescript
// 删除这些样式
linkCard: { ... },
linkLabel: { ... },
linkValue: { ... },
contentText: { ... },
```

- [ ] **Step 6: 运行前端检查**

Run: `cd app_end && bun run lint && npx tsc --noEmit`
Expected: PASS，无类型错误

- [ ] **Step 7: 提交**

```bash
git add app_end/app/class-article/[id].tsx
git commit -m "feat: 详情页用 WebView 渲染 HTML 文章内容，移除 sourceUrl 卡片"
```

---
