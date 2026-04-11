# 小课堂视频模块 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在小课堂页面增加视频分区（Tab 切换 + 搜索混合结果 + 视频播放页），后端新增 Video 模型和 API。

**Architecture:** 后端新建 Video ORM 模型对齐数据库 videos 表，复用 content 蓝图添加视频列表/详情端点；前端列表页增加 Tab 切换（文章/视频），搜索时混合返回两种内容；新建视频播放页用 WebView 加载 down_url。

**Tech Stack:** Python/Flask/SQLAlchemy (后端), React Native/Expo/react-native-webview (前端), pytest (后端测试)

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `backend/models/video.py` | Video ORM 模型 |
| Modify | `backend/models/__init__.py:9` | 注册 Video 模型 |
| Modify | `backend/routes/content.py` | 新增视频列表/详情端点 |
| Modify | `app_end/types/content.ts` | 新增 ContentVideo 接口 |
| Modify | `app_end/services/api/content.ts` | 新增视频 API 函数 |
| Modify | `app_end/app/(tabs)/class.tsx` | Tab 切换 + 搜索混合 + 视频卡片 |
| Create | `app_end/app/class-video/[id].tsx` | 视频播放详情页 |

---

### Task 1: 后端 — Video 模型 + 注册

**Files:**
- Create: `backend/models/video.py`
- Modify: `backend/models/__init__.py`

- [ ] **Step 1: 写 Video 模型测试**

创建 `backend/models/tests/test_video.py`：

```python
"""
Tests for Video model.
"""
from models.video import Video
from models import db


class TestVideoModel:
    """Test Video model."""

    def test_video_to_dict(self, app):
        """Test video to_dict returns expected fields."""
        with app.app_context():
            video = Video(
                title="测试视频",
                description="视频描述",
                down_url="https://example.com/video.mp4",
                name="test.mp4",
            )
            db.session.add(video)
            db.session.commit()

            result = video.to_dict()
            assert result["id"] == video.id
            assert result["title"] == "测试视频"
            assert result["description"] == "视频描述"
            assert result["downUrl"] == "https://example.com/video.mp4"
            assert result["name"] == "test.mp4"
            assert "createdAt" in result

            db.session.delete(video)
            db.session.commit()

    def test_video_to_dict_null_fields(self, app):
        """Test to_dict handles null fields gracefully."""
        with app.app_context():
            video = Video(title="仅标题")
            db.session.add(video)
            db.session.commit()

            result = video.to_dict()
            assert result["title"] == "仅标题"
            assert result["description"] is None
            assert result["downUrl"] is None

            db.session.delete(video)
            db.session.commit()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest models/tests/test_video.py -v -o "addopts="`
Expected: FAIL — `ModuleNotFoundError: No module named 'models.video'`

- [ ] **Step 3: 创建 Video 模型**

创建 `backend/models/video.py`：

```python
from datetime import datetime
from . import db


class Video(db.Model):
    __tablename__ = "videos"

    id = db.Column(db.Integer, primary_key=True)
    media_id = db.Column(db.String(128))
    name = db.Column(db.Text)
    url = db.Column(db.Text)
    title = db.Column(db.Text)
    description = db.Column(db.Text)
    down_url = db.Column(db.Text)
    wechat_update_time = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "downUrl": self.down_url,
            "name": self.name,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
```

- [ ] **Step 4: 注册模型**

在 `backend/models/__init__.py` 第 9 行 `from .content import Article` 之后添加：

```python
from .video import Video
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && uv run pytest models/tests/test_video.py -v -o "addopts="`
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add backend/models/video.py backend/models/__init__.py backend/models/tests/test_video.py
git commit -m "feat: 新增 Video ORM 模型对齐数据库 videos 表"
```

---

### Task 2: 后端 — 视频列表/详情 API 端点

复用 `routes/content.py` 中已有的 `_normalize_page`、`_normalize_per_page`、`_paginate`、缓存模式。

**Files:**
- Modify: `backend/routes/content.py`
- Create: `backend/routes/tests/test_content_video_routes.py`

- [ ] **Step 1: 写 API 测试**

创建 `backend/routes/tests/test_content_video_routes.py`：

```python
"""
Tests for video API endpoints.
"""
import json
from models.video import Video
from models import db


class TestVideoRoutes:
    """Test video API routes."""

    def test_list_videos_empty(self, app, client, sample_user):
        """空视频列表返回成功。"""
        with app.app_context():
            resp = client.get(
                "/api/content/videos",
                headers={"Authorization": f"Bearer {self._get_token(client, app)}"},
            )
            body = json.loads(resp.data)
            assert resp.status_code == 200
            assert body["status"] == "success"
            assert body["data"] == []

    def test_list_videos_returns_data(self, app, client):
        """有视频时返回列表。"""
        with app.app_context():
            video = Video(title="测试视频", description="描述", down_url="https://x.com/v.mp4")
            db.session.add(video)
            db.session.commit()
            token = self._get_token(client, app)
            resp = client.get(
                "/api/content/videos",
                headers={"Authorization": f"Bearer {token}"},
            )
            body = json.loads(resp.data)
            assert body["status"] == "success"
            assert len(body["data"]) == 1
            assert body["data"][0]["title"] == "测试视频"
            db.session.delete(video)
            db.session.commit()

    def test_get_video_detail(self, app, client):
        """获取视频详情。"""
        with app.app_context():
            video = Video(title="详情视频", down_url="https://x.com/v2.mp4")
            db.session.add(video)
            db.session.commit()
            token = self._get_token(client, app)
            resp = client.get(
                f"/api/content/videos/{video.id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            body = json.loads(resp.data)
            assert body["status"] == "success"
            assert body["data"]["title"] == "详情视频"
            db.session.delete(video)
            db.session.commit()

    def test_get_video_detail_not_found(self, app, client):
        """视频不存在返回 404。"""
        with app.app_context():
            token = self._get_token(client, app)
            resp = client.get(
                "/api/content/videos/99999",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 404

    @staticmethod
    def _get_token(client, app):
        """注册并登录获取 JWT token。"""
        from models.user import User
        phone = "13800138099"
        with app.app_context():
            user = User.query.filter_by(phone=phone).first()
            if not user:
                user = User(phone=phone, name="VideoTester")
                db.session.add(user)
                db.session.commit()
            # conftest 中的 app 使用 SQLite，直接用 login 接口
        resp = client.post("/api/auth/login", json={"phone": phone, "code": "123456"})
        body = json.loads(resp.data)
        if body.get("status") == "success" and "data" in body:
            return body["data"].get("access_token", "test-token")
        # fallback: 用 register 获取
        resp = client.post("/api/auth/register", json={"phone": phone, "code": "123456"})
        body = json.loads(resp.data)
        return body.get("data", {}).get("access_token", "test-token")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest routes/tests/test_content_video_routes.py -v -o "addopts="`
Expected: FAIL — 404，端点不存在

- [ ] **Step 3: 添加视频路由**

在 `backend/routes/content.py` 顶部导入区新增：

```python
from models.video import Video
```

在文件末尾（`sync_wechat_articles_to_db` 函数之后）添加：

```python
@content_bp.route("/content/videos", methods=["GET"])
@token_required
def get_videos(current_user):
    page = _normalize_page(request.args.get("page"), 1)
    per_page = _normalize_per_page(request.args.get("per_page"), 10)
    search = (request.args.get("search") or "").strip()
    logger.info(
        "课堂视频列表请求: user_id=%s, page=%s, per_page=%s, search=%s",
        getattr(current_user, "id", "unknown"),
        page,
        per_page,
        search or "-",
    )

    cache_key = f"videos:{page}:{per_page}:{search}"
    cached = _cache_get(cache_key)
    if cached:
        logger.info("课堂视频列表命中缓存: key=%s", cache_key)
        return jsonify(cached)

    query = Video.query
    if search:
        query = query.filter(
            or_(Video.title.ilike(f"%{search}%"), Video.description.ilike(f"%{search}%"))
        )
    query = query.order_by(Video.created_at.desc())

    result = _paginate(query, page, per_page)
    payload = {"status": "success", "data": result["items"], "pagination": result["pagination"]}
    _cache_set(cache_key, payload)
    logger.info("课堂视频列表返回: total=%s, page=%s", result["pagination"]["total"], page)
    return jsonify(payload)


@content_bp.route("/content/videos/<int:video_id>", methods=["GET"])
@token_required
def get_video_detail(current_user, video_id):
    video = Video.query.get(video_id)
    if not video:
        return jsonify({"status": "error", "message": "视频不存在"}), 404
    return jsonify({"status": "success", "data": video.to_dict()})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && uv run pytest routes/tests/test_content_video_routes.py -v -o "addopts="`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add backend/routes/content.py backend/routes/tests/test_content_video_routes.py
git commit -m "feat: 新增视频列表和详情 API 端点"
```

---

### Task 3: 前端 — 类型定义 + API 服务

**Files:**
- Modify: `app_end/types/content.ts`
- Modify: `app_end/services/api/content.ts`

- [ ] **Step 1: 新增 ContentVideo 类型**

在 `app_end/types/content.ts` 末尾追加：

```typescript
export interface ContentVideo {
  id: number;
  title: string;
  description?: string | null;
  downUrl?: string | null;
  name?: string | null;
  createdAt?: string | null;
}
```

- [ ] **Step 2: 新增视频 API 函数**

在 `app_end/services/api/content.ts` 中：

更新导入：
```typescript
import type { ContentArticle, ContentVideo, ContentPagination } from '@/types/content';
```

在文件末尾追加：
```typescript
export const listVideos = async (params?: ContentListParams) => {
  const res = await api.get<ApiListResponse<ContentVideo[]>>('/content/videos', params);
  return res.data;
};

export const getVideoDetail = async (id: number) => {
  const res = await api.get<ApiResponse<ContentVideo>>(`/content/videos/${id}`);
  return res.data.data;
};
```

- [ ] **Step 3: 运行前端检查**

Run: `cd app_end && npx tsc --noEmit 2>&1 | grep -v "vitest/globals" | grep -i "error" | head -5`
Expected: 无实际错误

- [ ] **Step 4: 提交**

```bash
git add app_end/types/content.ts app_end/services/api/content.ts
git commit -m "feat: 新增 ContentVideo 类型和视频 API 函数"
```

---

### Task 4a: 列表页 — Tab 切换 + 视频数据获取

只做 Tab 切换 UI 和视频数据拉取，不涉及搜索混合。

**Files:**
- Modify: `app_end/app/(tabs)/class.tsx`

- [ ] **Step 1: 更新导入和状态**

在 `class.tsx` 顶部：
- 新增导入 `ContentVideo` 类型和 `listVideos` API
- 删除未使用的 `useMemo` 导入（如果 Tab 后不再需要）

```typescript
import * as contentApi from '@/services/api/content';
import type { ContentArticle, ContentPagination, ContentVideo } from '@/types/content';
```

新增状态（在现有状态之后）：
```typescript
const [activeTab, setActiveTab] = useState<'article' | 'video'>('article');
const [videos, setVideos] = useState<ContentVideo[]>([]);
const [videoPagination, setVideoPagination] = useState<ContentPagination | null>(null);
```

删除原来的：
```typescript
const [activeCategory] = useState('');
```

- [ ] **Step 2: 添加 fetchVideos 函数**

在 `fetchContent` 函数之后添加：

```typescript
const fetchVideos = useCallback(
    async (options?: { force?: boolean; showLoading?: boolean }) => {
      const { showLoading = true } = options || {};

      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const videoRes = await contentApi.listVideos({
          page: 1,
          per_page: ARTICLE_PAGE_SIZE,
          search: searchQuery || undefined,
        });
        setVideos(videoRes.data);
        setVideoPagination(videoRes.pagination);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : '获取视频失败';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery]
  );
```

- [ ] **Step 3: 添加 Tab 切换处理函数**

```typescript
const handleTabChange = useCallback(
    (tab: 'article' | 'video') => {
      setActiveTab(tab);
      if (tab === 'article' && articles.length === 0) {
        fetchContent({ force: true });
      } else if (tab === 'video' && videos.length === 0) {
        fetchVideos({ force: true });
      }
    },
    [articles.length, fetchContent, fetchVideos, videos.length]
  );
```

- [ ] **Step 4: 添加 Tab UI**

在搜索框 `<Input>` 组件之后、`{error && ...}` 之前，插入 Tab 按钮：

```tsx
<View style={styles.categoryRow}>
    <OrganicChipButton
      label="文章"
      active={activeTab === 'article'}
      onPress={() => handleTabChange('article')}
    />
    <OrganicChipButton
      label="视频"
      active={activeTab === 'video'}
      onPress={() => handleTabChange('video')}
    />
</View>
```

- [ ] **Step 5: 修改 section header 根据 Tab 显示标题**

将现有的：
```tsx
<Text style={styles.sectionTitle}>精选文章</Text>
```

替换为：
```tsx
<Text style={styles.sectionTitle}>{activeTab === 'article' ? '精选文章' : '精选视频'}</Text>
{articlePagination?.total ? <Text style={styles.sectionMeta}>共 {activeTab === 'article' ? articlePagination.total : videoPagination?.total ?? 0} 条</Text> : null}
```

- [ ] **Step 6: 运行前端检查**

Run: `cd app_end && npx tsc --noEmit 2>&1 | grep -v "vitest/globals" | grep -i "error" | head -5`
Expected: 无实际错误

- [ ] **Step 7: 提交**

```bash
git add app_end/app/(tabs)/class.tsx
git commit -m "feat: 小课堂列表页添加文章/视频 Tab 切换 UI"
```

---

### Task 4b: 列表页 — 视频卡片渲染 + 搜索混合

**Files:**
- Modify: `app_end/app/(tabs)/class.tsx`

- [ ] **Step 1: 定义联合类型和辅助函数**

在组件外部、`buildArticleMeta` 之后添加：

```typescript
type ContentItem =
  | { kind: 'article'; data: ContentArticle }
  | { kind: 'video'; data: ContentVideo };

const isSearchActive = (query: string) => query.trim().length > 0;
```

在组件内部添加混合列表 + 搜索状态：
```typescript
const [mixedItems, setMixedItems] = useState<ContentItem[]>([]);
const [searching, setSearching] = useState(false);
```

- [ ] **Step 2: 添加混合搜索函数**

```typescript
const fetchMixedSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearching(false);
        setMixedItems([]);
        return;
      }
      setSearching(true);
      setLoading(true);
      setError(null);
      try {
        const [articleRes, videoRes] = await Promise.all([
          contentApi.listArticles({ page: 1, per_page: ARTICLE_PAGE_SIZE, search: query }),
          contentApi.listVideos({ page: 1, per_page: ARTICLE_PAGE_SIZE, search: query }),
        ]);
        const items: ContentItem[] = [
          ...articleRes.data.map((a) => ({ kind: 'article' as const, data: a })),
          ...videoRes.data.map((v) => ({ kind: 'video' as const, data: v })),
        ];
        setMixedItems(items);
        setArticles(articleRes.data);
        setArticlePagination(articleRes.pagination);
        setVideos(videoRes.data);
        setVideoPagination(videoRes.pagination);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : '搜索失败';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );
```

- [ ] **Step 3: 修改 handleSearchSubmit**

```typescript
const handleSearchSubmit = useCallback(() => {
    const query = searchText.trim();
    setSearchQuery(query);
    if (query) {
      fetchMixedSearch(query);
    } else {
      setSearching(false);
      setMixedItems([]);
    }
  }, [searchText, fetchMixedSearch]);
```

- [ ] **Step 4: 添加混合项点击处理**

```typescript
const handleItemPress = useCallback(
    (item: ContentItem) => {
      if (item.kind === 'article') {
        router.push(`/class-article/${item.data.id}`);
      } else {
        router.push(`/class-video/${item.data.id}`);
      }
    },
    []
  );
```

- [ ] **Step 5: 替换列表渲染区域**

将现有文章列表渲染区域（从 `{loading && articles.length === 0 ?` 到 `loadMore` 之前）替换为：

```tsx
{(() => {
    const items: ContentItem[] = searching
      ? mixedItems
      : activeTab === 'article'
        ? articles.map((a) => ({ kind: 'article' as const, data: a }))
        : videos.map((v) => ({ kind: 'video' as const, data: v }));
    const isEmpty = !loading && items.length === 0;

    if (loading && items.length === 0) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={organicTheme.colors.primary.main} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      );
    }
    if (isEmpty) {
      return (
        <OrganicCard variant="ghost" shadow={false} style={styles.emptyCard}>
          <Text style={styles.emptyText}>暂无内容</Text>
        </OrganicCard>
      );
    }
    return (
      <View style={styles.articleList}>
        {items.map((item) => (
          <OrganicCard key={`${item.kind}-${item.data.id}`} shadow={false} style={styles.articleCard}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleItemPress(item)} style={styles.articlePressable}>
              {item.kind === 'article' && item.data.coverUrl ? (
                <Image source={{ uri: item.data.coverUrl }} style={styles.articleThumb} resizeMode="cover" />
              ) : (
                <View style={styles.articleThumb}>
                  <IconSymbol
                    name={item.kind === 'video' ? 'play.circle' : 'doc.text'}
                    size={organicTheme.iconSizes.sm}
                    color={organicTheme.colors.primary.main}
                  />
                </View>
              )}
              <View style={styles.articleBody}>
                <Text style={styles.articleTitle} numberOfLines={2}>
                  {item.data.title}
                </Text>
                <Text style={styles.articleMeta} numberOfLines={1}>
                  {item.kind === 'article'
                    ? buildArticleMeta(item.data)
                    : item.data.description || '视频'}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={organicTheme.iconSizes.xs} color={organicTheme.colors.text.tertiary} />
            </TouchableOpacity>
          </OrganicCard>
        ))}
      </View>
    );
})()}
```

删除旧的 `handleArticlePress` 函数（已被 `handleItemPress` 替代）。

- [ ] **Step 6: 运行前端检查**

Run: `cd app_end && npx tsc --noEmit 2>&1 | grep -v "vitest/globals" | grep -i "error" | head -5`
Expected: 无实际错误

- [ ] **Step 7: 提交**

```bash
git add app_end/app/(tabs)/class.tsx
git commit -m "feat: 小课堂支持视频卡片渲染和搜索混合结果"
```

---

### Task 5: 视频播放详情页

布局复用文章详情页模式：返回按钮 + 标题 + 描述 + WebView 加载 `down_url`。

**Files:**
- Create: `app_end/app/class-video/[id].tsx`

- [ ] **Step 1: 创建视频播放页**

创建 `app_end/app/class-video/[id].tsx`：

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { OrganicBackground, OrganicCard } from '@/components/ui';
import { organicTheme } from '@/constants/theme';
import * as contentApi from '@/services/api/content';
import type { ContentVideo } from '@/types/content';

export default function VideoDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const videoId = Number(params.id);
  const [video, setVideo] = useState<ContentVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!videoId) {
      setError('视频 ID 无效');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await contentApi.getVideoDetail(videoId);
      setVideo(detail);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '获取视频失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return (
    <OrganicBackground variant="morning">
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusSpacer} />
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol
              name="chevron.left"
              size={organicTheme.iconSizes.xs}
              color={organicTheme.colors.text.secondary}
            />
            <Text style={styles.backText}>返回</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={organicTheme.colors.primary.main} />
            <Text style={styles.loadingText}>加载视频中...</Text>
          </View>
        ) : error ? (
          <OrganicCard variant="soft" shadow={false} style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchDetail}>
              <Text style={styles.errorRetry}>重试</Text>
            </TouchableOpacity>
          </OrganicCard>
        ) : video ? (
          <View style={styles.detail}>
            <Text style={styles.title}>{video.title}</Text>
            {video.description ? <Text style={styles.description}>{video.description}</Text> : null}
            {video.downUrl ? (
              <View style={styles.videoContainer}>
                <WebView
                  source={{ uri: video.downUrl }}
                  style={styles.webview}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction
                />
              </View>
            ) : (
              <OrganicCard variant="soft" shadow={false} style={styles.errorCard}>
                <Text style={styles.errorText}>暂无可播放的视频链接</Text>
              </OrganicCard>
            )}
          </View>
        ) : (
          <OrganicCard variant="soft" shadow={false} style={styles.errorCard}>
            <Text style={styles.errorText}>视频不存在</Text>
          </OrganicCard>
        )}
      </ScrollView>
    </OrganicBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: organicTheme.spacing.lg,
    paddingBottom: 100,
  },
  statusSpacer: {
    height: 44,
  },
  headerRow: {
    marginBottom: organicTheme.spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: organicTheme.spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: organicTheme.spacing.md,
    paddingVertical: organicTheme.spacing.xs,
    borderRadius: organicTheme.shapes.borderRadius.pill,
    backgroundColor: organicTheme.colors.background.paper,
    borderWidth: 1,
    borderColor: organicTheme.colors.border.light,
  },
  backText: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.text.secondary,
    fontWeight: organicTheme.typography.fontWeight.medium,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: organicTheme.spacing.sm,
    marginTop: organicTheme.spacing.md,
  },
  loadingText: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.text.secondary,
  },
  errorCard: {
    marginTop: organicTheme.spacing.md,
    alignItems: 'center',
    gap: organicTheme.spacing.sm,
  },
  errorText: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.text.primary,
  },
  errorRetry: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.primary.main,
    fontWeight: organicTheme.typography.fontWeight.semibold,
  },
  detail: {
    gap: organicTheme.spacing.md,
  },
  title: {
    fontSize: organicTheme.typography.fontSize.lg,
    fontWeight: organicTheme.typography.fontWeight.bold,
    color: organicTheme.colors.text.primary,
    lineHeight: 28,
  },
  description: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.text.secondary,
    lineHeight: 22,
  },
  videoContainer: {
    width: '100%',
    height: 220,
    borderRadius: organicTheme.shapes.borderRadius.soft,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: organicTheme.colors.border.light,
    backgroundColor: organicTheme.colors.background.paper,
  },
  webview: {
    flex: 1,
  },
});
```

- [ ] **Step 2: 运行前端检查**

Run: `cd app_end && npx tsc --noEmit 2>&1 | grep -v "vitest/globals" | grep -i "error" | head -5`
Expected: 无实际错误

- [ ] **Step 3: 提交**

```bash
git add app_end/app/class-video/[id].tsx
git commit -m "feat: 新增视频播放详情页，WebView 加载微信视频链接"
```

---
