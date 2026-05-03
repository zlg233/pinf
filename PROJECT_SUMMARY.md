# 早护通 (pinf) 项目技术文档

> 当前版本: v0.2.3 | 文档更新: 2026-04-29

## 一、项目概述

早护通是一款面向新生儿/早产儿家长的健康管理移动应用，帮助家长记录和追踪宝宝的成长数据、管理复诊预约、获取科普知识，并提供 AI 问答辅助。项目采用前后端分离架构，目前前端基于 React Native + Expo，后端为 Flask API。

> **迁移计划**: 前端后续将从 React Native 迁移至微信小程序，后端 API 层面可基本复用，但推送通知（Expo Push）、部分硬件 API（触觉反馈等）需替换为微信小程序对应能力。

---

## 二、技术栈

### 前端（app_end/）

| 类别 | 技术 | 迁移影响 |
|------|------|----------|
| 框架 | React Native 0.81 + Expo SDK 54 + TypeScript 5.9 | **需重写** → 微信小程序原生/Taro |
| 路由 | Expo Router 6（文件系统路由） | **需替换** → 小程序 tabBar + 页面路由 |
| 状态管理 | Zustand 5 | **可复用**（如用 Taro/uni-app）或替换为小程序全局状态 |
| 网络请求 | Axios（Token 自动注入、401 重试、指数退避） | **可复用**，需适配 wx.request |
| 数据持久化 | AsyncStorage + 内存缓存 | **需替换** → wx.setStorageSync |
| 动画/手势 | Reanimated 4 + Gesture Handler 2 | **需替换** → 小程序动画 API |
| 图表 | react-native-chart-kit | **需替换** → wx-canvas / ECharts 小程序版 |
| 通知 | Expo Notifications（推送 + 触觉反馈） | **需替换** → 微信订阅消息 |
| 设计系统 | 自研 Organic Token 体系（颜色/间距/圆角/阴影） | **可复用**设计规范，需重新实现组件 |
| 包管理 | Bun | → npm/其他 |
| 测试 | Vitest | 可复用测试逻辑，需适配新框架 |

### 后端（backend/）

| 类别 | 技术 |
|------|------|
| 框架 | Flask 2.3.3 + Python 3.11 |
| 数据库 | PostgreSQL + pgvector 向量扩展 |
| ORM | Flask-SQLAlchemy 3.0 |
| 认证 | JWT（Flask-JWT-Extended）+ 手机验证码 + 密码 + 微信登录 |
| 任务调度 | APScheduler（定时同步 + 通知扫描） |
| 实时通知 | PostgreSQL NOTIFY/LISTEN + Expo Push API |
| AI 集成 | n8n Webhook（聊天转发） |
| 内容同步 | 微信公众号 API 增量同步 |
| 包管理 | uv |
| 测试 | pytest + pytest-cov |
| 容器化 | Docker（python:3.11-slim，非 root 运行） |

### 基础设施

| 类别 | 技术 |
|------|------|
| 服务编排 | Docker Compose（backend + n8n + pgvector） |
| 反向代理 | OpenResty |
| CI/CD | Gitea Actions（3 个工作流） |
| 自动化 | n8n（AI 对话 + 工作流自动化） |
| 云端构建 | Expo EAS（Android APK） |
| 官网 | Vue 3 + Vite（webend/） |

---

## 三、项目结构

```
pinf/
├── app_end/                    # 前端应用（React Native + Expo）
│   ├── app/                    # 页面路由（Expo Router）
│   │   ├── (tabs)/             # 底部 Tab 页（首页/课堂/我的）
│   │   ├── appointments/       # 预约管理页面
│   │   ├── class-article/      # 文章详情页
│   │   ├── class-video/        # 视频详情页
│   │   ├── growth/             # 成长记录页面
│   │   ├── _layout.tsx         # 根布局
│   │   ├── login.tsx           # 登录页
│   │   ├── profile.tsx         # 个人资料页
│   │   └── set-password.tsx    # 密码设置页
│   ├── components/             # 组件
│   │   ├── ui/                 # Organic 设计系统组件
│   │   ├── growth/             # 成长相关组件
│   │   ├── home/               # 首页相关组件
│   │   └── (tabs)/             # Tab 栏组件
│   ├── store/                  # Zustand 状态（baby/growth/appointment）
│   ├── services/api/           # Axios API 封装层
│   ├── constants/              # 常量定义
│   ├── contexts/               # React Context
│   ├── domain/                 # 领域逻辑
│   ├── hooks/                  # 自定义 Hooks
│   ├── types/                  # TypeScript 类型定义
│   ├── utils/                  # 工具函数
│   └── assets/                 # 静态资源
│
├── backend/                    # 后端 API（Flask）
│   ├── routes/                 # API 蓝图（8 个领域）
│   │   ├── auth.py             # 认证（登录/注册/微信登录）
│   │   ├── baby.py             # 宝宝管理 CRUD
│   │   ├── growth.py           # 成长数据记录
│   │   ├── appointment.py      # 预约管理
│   │   ├── content.py          # 内容/文章管理
│   │   ├── chat.py             # AI 问答
│   │   ├── notifications.py    # 推送通知
│   │   └── devices.py          # 设备 Token 管理
│   ├── models/                 # 数据模型（11 个）
│   │   ├── user.py             # 用户
│   │   ├── baby.py             # 宝宝
│   │   ├── growth.py           # 成长记录
│   │   ├── appointment.py      # 预约
│   │   ├── content.py          # 内容/文章
│   │   ├── chat.py             # 聊天记录
│   │   ├── device_token.py     # 设备 Token
│   │   ├── notification_subscription.py  # 通知订阅
│   │   ├── sync_state.py       # 同步状态
│   │   ├── verification_code.py # 验证码
│   │   └── video.py            # 视频
│   ├── utils/                  # 工具模块（14 个）
│   │   ├── db_migrations.py    # 数据库迁移（17 步）
│   │   ├── auth.py             # 认证工具
│   │   ├── notification_*.py   # 通知三件套（listener/scheduler/sender）
│   │   ├── wechat*.py          # 微信 API 三件套（公众号/内容同步/同步调度）
│   │   ├── n8n_client.py       # n8n AI 客户端
│   │   └── appointment_status.py # 预约状态机
│   ├── config.py               # 配置
│   ├── app.py                  # 入口
│   └── .env.example            # 环境变量模板
│
├── webend/                     # 官网（Vue 3 + Vite）
│   ├── src/
│   │   ├── composables/        # 组合式函数
│   │   ├── App.vue
│   │   └── main.ts
│   └── vite.config.ts
│
├── tests/                      # 测试
├── docs/                       # 文档
├── docker-compose.yml          # 容器编排
├── CLAUDE.md                   # AI 开发指南
├── AGENTS.md                   # Agent 协作规范
└── version.md                  # 版本号 v0.2.3
```

---

## 四、已实现功能

| 模块 | 功能点 |
|------|--------|
| **用户认证** | 手机验证码登录、密码登录/设置、微信登录、JWT 自动续期 |
| **宝宝管理** | 多宝宝 CRUD、宝宝切换、早产儿信息（预产期/孕周） |
| **成长追踪** | 体重/身高/头围记录、WHO + Fenton 双标准曲线、实际月龄/矫正月龄切换 |
| **预约管理** | 复诊预约 CRUD、状态自动流转（待就诊→已完成/已过期）、时区处理 |
| **AI 问答** | 实时对话、聊天历史、关联宝宝上下文、n8n AI 后端 |
| **内容课堂** | 文章列表/搜索/分类、微信公众号自动同步、本地缓存（1h TTL） |
| **推送通知** | Expo 跨平台推送、预约提醒订阅、双重触发（实时 NOTIFY + 定时扫描兜底）、递进重试（2h→4h→8h→16h） |
| **PWA 支持** | Web 静态导出、Service Worker |

---

## 五、后端 API 模块详情

### 路由蓝图

| 蓝图 | 前缀 | 说明 |
|------|------|------|
| auth | /api/auth | 认证：验证码发送/校验、登录、密码管理、微信登录 |
| baby | /api/baby | 宝宝 CRUD、切换当前宝宝 |
| growth | /api/growth | 成长数据记录与查询、WHO/Fenton 曲线计算 |
| appointment | /api/appointment | 预约 CRUD、状态流转（自动过期/完成） |
| content | /api/content | 文章/视频列表、搜索、分类 |
| chat | /api/chat | AI 对话（转发至 n8n）、聊天历史 |
| notifications | /api/notifications | 推送订阅管理、通知状态查询 |
| devices | /api/devices | 设备 Token 注册与管理 |

### 数据库迁移

自研轻量级迁移系统（`utils/db_migrations.py`），共 17 步迁移，管理所有表结构变更。

---

## 六、开发规范

### 核心开发规则

1. **双阶段开发协议**: 非原子任务必须先方案商议，确认后再编码
2. **UI Token 体系**: 使用 Organic 主题 token（颜色/间距/字号/圆角/阴影），禁止硬编码样式值
3. **图标规范**: IconSymbol + SF Symbol 命名，新增图标需更新映射
4. **交互反馈**: 统一使用 `Feedback` 抽象（`notify/confirm`），禁止直接调用 `Alert.alert`
5. **后端三件套**: 字段变更必须同步修改 `model` + `db_migrations` + `to_dict`
6. **最小验收**: 前端 `bun run lint` + `npx tsc --noEmit`；后端做目标模块语法检查
7. **TDD 开发**: 遵循 RED-GREEN-REFACTOR 循环

### 常用命令

```bash
# 前端
cd app_end && bun install && bun start    # 启动开发
bun run lint && npx tsc --noEmit          # 代码检查

# 后端
cd backend && uv run app.py               # 启动服务
curl http://localhost:5010/api/health      # 健康检查

# Docker
docker compose up -d                       # 启动全部服务
```

---

## 七、部署架构

```
┌─────────────────────────────────────────────────────────┐
│                       用户层                             │
├──────────────────┬──────────────────┬───────────────────┤
│   移动应用        │    Web 应用       │      官网         │
│  (React Native)  │   (Expo Web)     │     (Vue 3)       │
│   app_end/       │    app_end/      │    webend/        │
└────────┬─────────┴────────┬─────────┴─────────┬─────────┘
         │                  │                   │
         └──────────────────┼───────────────────┘
                            │
                   ┌────────▼─────────┐
                   │   OpenResty      │
                   │  (反向代理)       │
                   └────────┬─────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                   │
    ┌────▼─────┐      ┌─────▼──────┐    ┌─────▼──────┐
    │ backend  │      │    n8n     │    │  pgvector  │
    │  :5010   │      │   :5678    │    │   :5432    │
    │ (Flask)  │      │ (自动化)   │    │ (PostgreSQL)│
    └──────────┘      └────────────┘    └────────────┘
```

### CI/CD 工作流

| 工作流 | 用途 |
|--------|------|
| `app-build-local.yml` | 本地 Android APK 构建 |
| `app-build.yml` | Expo EAS 云端构建 |
| `backend-deploy.yml` | 后端部署到服务器（SSH 拉取） |

---

## 八、迁移前瞻：React Native → 微信小程序

> 前端后续计划迁移至微信小程序，以下是各模块的影响评估。

### 可复用（改动小）

| 模块 | 说明 |
|------|------|
| **API 服务层** (`services/api/`) | Axios 封装的请求逻辑可改为 wx.request 封装，Token 管理/重试逻辑基本可移植 |
| **状态管理** (`store/`) | Zustand 逻辑可平移（如使用 Taro），或转为小程序全局 data |
| **类型定义** (`types/`) | TypeScript 类型定义完全可复用 |
| **业务逻辑** (`domain/`, `hooks/`) | 纯逻辑层可复用，需剥离 RN 依赖的部分 |
| **设计 Token** | Organic Token 的颜色/间距/字号规范可直接映射为小程序 WXSS 变量 |
| **后端 API** | 几乎无需改动，仅需替换 Expo Push 为微信订阅消息 |

### 需重写（改动大）

| 模块 | 说明 |
|------|------|
| **UI 组件** (`components/ui/`) | RN 组件需用小程序原生组件或 Taro 组件重写 |
| **页面路由** (`app/`) | Expo Router 文件路由需改为小程序页面配置 |
| **图表** | react-native-chart-kit → ECharts 小程序版或 wx-canvas |
| **动画/手势** | Reanimated + GestureHandler → 小程序 WXS 动画 |
| **推送通知** | Expo Push → 微信订阅消息（需用户主动订阅） |
| **数据持久化** | AsyncStorage → wx.setStorageSync / wx.getStorageSync |
| **导航交互** | RN Navigation → 小程序 wx.navigateTo / tabBar |

### 迁移策略建议

1. **推荐方案**: 使用 **Taro 4** 框架（React 语法 + 小程序输出），可最大化复用现有 React/TypeScript 逻辑层代码
2. **后端先行**: 确保后端 API 文档完善（可考虑补充 Swagger/OpenAPI），前端迁移时直接对接
3. **分模块迁移**: 按登录 → 宝宝管理 → 成长记录 → 预约 → 内容 → AI 问答 的优先级逐步迁移
4. **推送方案**: 需尽早确定微信订阅消息的模板 ID 和审核流程，替代 Expo Push
