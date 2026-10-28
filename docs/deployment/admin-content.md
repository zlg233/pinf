# 内容管理后台（管理员）部署与使用

日期：2026-10-28
状态：代码已实现并通过测试，**尚未部署**。

## 1. 功能范围

- 小程序「我的」→「内容管理」（仅 `role=admin` 可见）
- 管理文章、视频的出院状态分类：`入院时` / `住院期间` / `出院当天` / `出院后`，可清空为未分类
- 支持搜索、分类筛选、未分类筛选、分页
- 课堂页的文章与视频都支持按这四个分类筛选

## 2. 数据变更

| 变更 | 说明 |
|---|---|
| `videos.category` | 新增列（`VARCHAR(50)`，带索引），NULL = 未分类 |
| 迁移 | `2026_10_28_add_category_to_videos`、`2026_10_28_index_videos_category`，均在应用启动时幂等执行 |
| 存量数据 | 不改动；4 条视频初始为未分类，由管理员在页面里补 |

## 3. 开通管理员

前置：该手机号**已在小程序登录过**（否则数据库里没有账号）。

```bash
docker exec -it pinf-backend-1 python -m utils.set_admin_role --phone 13425082508
# 撤销
docker exec -it pinf-backend-1 python -m utils.set_admin_role --phone 13425082508 --role user
```

- 脚本会打印改前/改后角色，可重复执行
- 改完需要管理员**重新登录**小程序，入口才会出现（登录响应里的 user.role 会被缓存）

## 4. 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/content/articles` | 参数 `page` `per_page` `search` `category` `uncategorized=1` |
| GET | `/api/admin/content/videos` | 同上 |
| PATCH | `/api/admin/content/articles/<id>` | body `{"category":"入院时"}`，空字符串=清空 |
| PATCH | `/api/admin/content/videos/<id>` | 同上 |

- 非 admin → 403；未登录 → 401；分类非法 → 400；id 不存在 → 404
- 请求体里除 `category` 外的字段一律忽略（改不了标题/正文）
- 分类枚举只在后端 `utils/content_categories.py` 与前端 `constants/content-categories.ts` 各定义一次

## 5. 验证清单

1. 管理员登录 → 我的页出现「内容管理」；普通账号没有
2. 未分类筛选：能把 4 条视频筛出来并逐条设置分类
3. 改分类后课堂页筛选立即生效（文章与视频）
4. 普通账号直接调用 `/api/admin/content/articles` → 403
5. 传非法分类（如"出院前"）→ 400，库值不变
6. `pytest`（后端 66 条）与 `bun test`（62 条）通过；`tsc` 无新增错误；`build:weapp` 成功

## 6. 回滚

1. 关闭功能：把管理员账号降回 `user`（脚本 `--role user`），入口消失、接口返回 403
2. 回滚代码：`docker tag pinf-backend:pre-admin pinf-backend` 后重建
3. 保留数据：`videos.category` 可留着不影响旧代码（旧代码不读该列）

## 7. 部署影响

- 后端改动推送 main 会触发 CI 重建 backend，启动时执行两条幂等迁移
- 小程序需重新构建上传（新增页面与入口）
- 不涉及 `.env` 变更；不影响 RAG 与审核相关功能
