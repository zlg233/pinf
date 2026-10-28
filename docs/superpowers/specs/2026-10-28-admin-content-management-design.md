# 小程序内容管理后台（视频/文章分类）设计方案

日期：2026-10-28
状态：待用户审查；尚未开始编码。

## 一、目标与范围

给一个管理员账号在**小程序内**提供内容管理能力：把文章和视频归入四种出院状态分类之一。

- 分类枚举：`入院时` / `住院期间` / `出院当天` / `出院后`（单选，允许为空＝未分类）
- 管理对象：`articles`（现有 3 条）、`videos`（现有 4 条）
- 本轮只做「改分类」，**不做**编辑标题/正文、上下架、删除、批量操作
- 课堂页的视频分类筛选**不在本轮**（见"暂不做"）

## 二、已确认决策

| 项 | 决定 |
|---|---|
| 入口位置 | **A 方案**：我的 →「内容管理」独立页面（不进 tabBar） |
| 管理员账号 | 手机号 `13425082508`，`users.role` 置为 `admin` |
| 分类 | 单选，四个值 + 空值（未分类） |
| 视频 | 与文章同一套四分类，同一个管理页面维护 |
| 未分类 | 管理页必须支持「未分类」筛选，便于补齐存量资源 |

## 三、现状核对（2026-10-28 查生产库）

| 项 | 结果 |
|---|---|
| 文章 | 3 条；`category` 列已存在（入院时×2、住院期间×1） |
| 视频 | 4 条；**无 `category` 列** |
| 用户 | 10 个，`role` 全为 `user`，尚无 admin |
| 内容接口 | 全部为 GET，无写接口 |

结论：文章可直接复用，视频需加一列，权限复用现有 `users.role`，无需新表。

## 四、数据模型变更

1. `models/video.py`
   - 新增 `category = db.Column(db.String(50), index=True)`
   - `to_dict()` 增加 `category` 字段（保持前端 camelCase 一致）
2. `utils/db_migrations.py` 新增两条（沿用现有"一条迁移一条 SQL"的写法，幂等）
   - `2026_10_28_add_category_to_videos`：`ALTER TABLE videos ADD COLUMN IF NOT EXISTS category VARCHAR(50)`
   - `2026_10_28_index_videos_category`：`CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category)`
3. 存量数据不迁移：4 条视频 `category` 为 NULL，即"未分类"，由管理员在页面里补。

## 五、分类常量（单一来源）

- 后端新增 `utils/content_categories.py`
  ```python
  CONTENT_CATEGORIES = ("入院时", "住院期间", "出院当天", "出院后")
  ```
- 前端新增 `wx_end/src/constants/content-categories.ts`，导出同一份值 + 下拉选项（含"未分类"用于筛选）。
- 课堂页现有的 `ARTICLE_CATEGORIES` 改为引用该常量，避免两处各写一份。

## 六、权限

- 后端 `utils/auth.py` 新增 `admin_required`：内部先复用 `token_required` 完成 JWT 校验，再判断 `current_user.role == 'admin'`，否则返回 403 `{"status":"error","message":"无权限"}`。
- 权限判断**只在后端**生效；前端隐藏入口仅为体验，不作为安全边界。
- 角色变更后需要重新登录小程序（登录响应里的 `user.role` 会被缓存），在文档中写明。

## 七、接口设计（新增蓝图 `routes/admin_content.py`，前缀 `/api/admin`）

沿用现有响应约定：`{status, data, pagination}`。

| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| GET | `/api/admin/content/articles` | `page` `per_page` `search` `category` `uncategorized=1` | 复用现有分页/搜索口径，额外支持只看未分类 |
| GET | `/api/admin/content/videos` | 同上 | 视频列表 |
| PATCH | `/api/admin/content/articles/<id>` | body `{"category": "入院时"}` | 只改分类 |
| PATCH | `/api/admin/content/videos/<id>` | 同上 | 只改分类 |

**校验规则**
- `category` 只能是四个枚举值或空字符串（空＝清空为未分类）
- 请求体里出现其它字段（如 `title`）→ 忽略，不报错也不写入
- 不存在 id → 404；非 admin → 403；未登录 → 401；分类非法 → 400

**返回**
- PATCH 成功：`{"status":"success","data":{...更新后的 to_dict()}}`
- GET 列表：`data` 为列表，`pagination` 与现有结构一致

## 八、前端

### 入口

`pages/profile/index.tsx`：`user.role === 'admin'` 时，在「修改密码」下方渲染「内容管理」菜单（图标 📚）。

### 新页面 `pages/admin-content/index.tsx`

```
[文章] [视频]        ← Tab，复用 OrganicChipButton
[搜索框]             ← 复用 Input
[全部] [入院时] [住院期间] [出院当天] [出院后] [未分类]   ← 分类筛选
────────────────────
卡片列表（复用 OrganicCard）
  标题 / 当前分类徽标 / 「修改分类」按钮
────────────────────
[加载更多]
```

- 点「修改分类」→ `Modal` + 四个选项 + 「清空分类」+ 取消/保存
- 保存成功：`Feedback.notify('已更新')`，就地更新该条，不整页刷新
- 保存失败：`Feedback.notify(错误信息)`，保持原值
- 空态：`暂无内容` / `未分类下暂无内容`
- 切换 Tab / 搜索 / 分类筛选 → 重置分页重新拉第一页
- 页面 `index.config.ts` 标题「内容管理」

### 复用清单

`OrganicCard`、`OrganicChipButton`、`Input`、`Modal`、`Feedback.notify`、现有 `api` 客户端与 JWT 注入、现有分页结构。

### 新增文件

- `wx_end/src/constants/content-categories.ts`
- `wx_end/src/services/api/admin-content.ts`
- `wx_end/src/domain/content/categories.ts`（纯逻辑：合法值校验、筛选参数拼装，便于单测）
- `wx_end/src/pages/admin-content/index.tsx` + `index.scss` + `index.config.ts`
- `wx_end/tests/content-categories.test.ts`

## 九、测试计划（先写失败用例）

### 后端（pytest，SQLite 内存库）

1. 非 admin 调接口 → 403；未登录 → 401
2. admin 改文章分类 → 200，DB 值变化，其它字段未变
3. admin 改视频分类 → 200（验证新列可用）
4. 非法分类（如 `出院前`）→ 400
5. 空字符串 → 清空为未分类
6. 不存在的 id → 404
7. 列表 `uncategorized=1` 只返回 `category` 为空/NULL 的记录
8. 列表 `category=入院时` 只返回该分类
9. 分页与搜索沿用现有口径（page/per_page 边界）

### 前端（bun test，纯函数）

10. 分类常量与后端一致（四个值 + 顺序）
11. 非法分类被拒（`isValidCategory`）
12. 未分类筛选参数拼装正确（`uncategorized=1` 与 `category=` 互斥）

### 工程验收

- 后端：`pytest`（新增模块 + 全量 53 条基线不回归）
- 前端：`bun test`、`bunx tsc --noEmit`（不允许新增类型错误）、`bun run build:weapp`
- 手工：admin 账号登录看到入口、普通账号看不到；改分类后课堂文章筛选立即生效；视频分类管理可用（课堂视频筛选本轮不生效，文案标注）

## 十、提交拆分

1. `feat(backend): 视频增加分类字段与迁移`
2. `feat(backend): 管理员内容分类接口与权限校验`
3. `feat(wx_end): 新增内容管理页面与管理员入口`
4. `docs: 内容管理后台使用说明`

## 十一、部署与数据变更

- 后端改动推送 `main` 会触发 CI 重建 backend，启动时执行迁移（`IF NOT EXISTS`，幂等）；`.env` 已核对，重建不会翻开关
- **数据变更需单独确认**：把 `13425082508` 的 `role` 改为 `admin`
  - 前置：该手机号必须已注册（先在小程序登录一次）
  - 执行方式：一次性脚本 `python -m utils.set_admin_role --phone 13425082508`（打印改前改后角色，幂等）
- 角色改完需管理员**重新登录**小程序才会出现入口

## 十二、风险与回滚

| 风险 | 处理 |
|---|---|
| 迁移失败 | 单条 `ADD COLUMN IF NOT EXISTS`，失败只影响启动日志，不破坏数据；回滚就 `DROP COLUMN` |
| 误改分类 | 页面二次确认 + 保存前显示目标值；无批量覆盖操作 |
| 权限绕过 | 后端 `admin_required` 强制校验，前端隐藏不作为边界 |
| 视频分类无人使用 | 课堂视频筛选下一批再做，本轮管理页文案注明"分类将在课堂筛选上线后生效" |

## 十三、暂不做（下一批）

1. 课堂页视频 tab 的四分类筛选
2. 批量分类（多选后一键设置）
3. 上下架、编辑标题/正文、删除
4. 文章/视频的排序调整
5. 审核记录（谁在何时改了什么）
