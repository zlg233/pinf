# 小课堂视频模块设计

## 背景

小课堂目前只有文章列表。数据库 `videos` 表已有视频数据（4条），但后端无 ORM 模型和 API，前端无展示入口。需要在现有小课堂页面增加视频分区，并统一搜索。

## 数据库现状

**videos 表字段：**
- `id` (integer PK)
- `media_id` (varchar 128) — 微信媒体 ID
- `name` (text) — 文件名
- `url` (text) — 原始 URL（当前为空）
- `title` (text) — 标题
- `description` (text) — 描述
- `down_url` (text) — 微信视频播放链接
- `wechat_update_time` (timestamp)
- `created_at` / `updated_at` (timestamp)

**articles 表：** 3 条，content 已存完整 HTML，模型完整无需改动。

**无 expo-av 依赖**，视频播放使用 WebView 打开 `down_url`。

## 目标

1. 后端新增 Video 模型和视频列表/详情 API
2. 小课堂页面顶部增加 Tab 切换（文章 / 视频）
3. 搜索同时搜文章和视频，混合返回结果
4. 新建视频播放详情页，WebView 加载 `down_url`

## 设计

### 1. 后端

#### 1.1 新建 `models/video.py`

```python
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

#### 1.2 注册模型 `models/__init__.py`

添加 `from .video import Video`

#### 1.3 扩展 `routes/content.py`

新增端点：

- `GET /api/content/videos` — 视频列表（分页 + 搜索 title/description）
- `GET /api/content/videos/<id>` — 视频详情

搜索逻辑复用文章列表模式（`ilike` 模糊匹配）。

### 2. 前端

#### 2.1 类型定义 `types/content.ts`

新增：
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

#### 2.2 API 服务 `services/api/content.ts`

新增 `listVideos()` 和 `getVideoDetail()`。

#### 2.3 小课堂列表页 `class.tsx`

**Tab 切换：**
- 搜索框下方放两个 `OrganicChipButton`：文章 / 视频
- `activeCategory` 状态改为 `'article'` | `'video'`，默认 `'article'`
- 复用已有的 `categoryRow` 样式和位置

**统一搜索：**
- 搜索时同时调用 `listArticles` 和 `listVideos`
- 搜索结果混合展示：文章和视频都出现在同一列表中
- 通过卡片样式区分：文章显示封面图+作者，视频显示播放图标+描述

**混合结果展示：**
- 文章卡片：现有样式不变（左封面图 + 右标题/元数据）
- 视频卡片：左侧播放图标占位 + 右侧标题/描述
- 点击跳转不同页面：文章 → `/class-article/[id]`，视频 → `/class-video/[id]`

**非搜索模式：**
- Tab 切换时只显示对应类型的内容（文章 Tab 只显示文章，视频 Tab 只显示视频）
- 搜索模式下忽略 Tab，混合展示

#### 2.4 视频播放页 `class-video/[id].tsx`（新建）

- 复用文章详情页布局：返回按钮 + 标题 + 描述 + WebView 播放
- WebView 加载 `down_url`（微信视频链接）
- 使用内嵌 WebView（`source={{ uri }}`），非全屏

### 3. 涉及文件清单

| 操作 | 文件 |
|------|------|
| Create | `backend/models/video.py` |
| Modify | `backend/models/__init__.py` |
| Modify | `backend/routes/content.py` |
| Modify | `app_end/types/content.ts` |
| Modify | `app_end/services/api/content.ts` |
| Modify | `app_end/app/(tabs)/class.tsx` |
| Create | `app_end/app/class-video/[id].tsx` |

### 4. 不做的事情

- 不安装 expo-av（用 WebView 播放）
- 不删除微信同步代码（保留）
- 不修改 articles 模型（已完整）
- 不实现视频上传/管理（只读）

### 5. 验收标准

1. 后端 `/api/content/videos` 返回视频列表，支持分页和搜索
2. 小课堂页面有 文章/视频 Tab 切换
3. 搜索同时返回文章和视频混合结果
4. 点击视频进入播放页，WebView 加载视频链接
5. `bun run lint` + `npx tsc --noEmit` 通过
