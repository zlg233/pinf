---
name: 微信小程序全量迁移
description: 将早护通 React Native 前端完整迁移至微信小程序（Taro 3），14 天完成全部页面和功能迁移 + 后端适配
type: project
---

## 背景

早护通 (pinf) 现有 React Native + Expo 移动端应用，需要新增微信小程序端，实现全量功能迁移。

## 关键决策

- **技术框架**: Taro 3（React 语法，与现有 RN 代码风格一致）
- **项目结构**: 独立项目 `wx_end/`，与 `app_end/` 平级
- **迁移策略**: 薄适配层迁移（方案 A），最大化业务逻辑复用，UI 组件用 Taro 重写
- **微信 AppID**: 已有

## 架构设计

### 项目结构

```
wx_end/
├── src/
│   ├── pages/                    # Taro 页面
│   │   ├── index/                # 首页（Tab）
│   │   ├── qa/                   # AI 问答（Tab）
│   │   ├── class/                # 课堂（Tab）
│   │   ├── login/                # 登录
│   │   ├── set-password/         # 设置密码
│   │   ├── profile/              # 个人中心
│   │   ├── growth/               # 成长曲线
│   │   ├── appointments/         # 预约管理
│   │   ├── article-detail/       # 文章详情
│   │   └── video-detail/         # 视频详情
│   ├── components/               # UI 组件（Taro 重写）
│   │   ├── ui/                   # 基础组件
│   │   ├── home/                 # 首页功能组件
│   │   └── growth/               # 成长相关组件
│   ├── store/                    # Zustand Store（复用 + 存储适配）
│   ├── services/api/             # API 客户端（Taro.request）
│   ├── constants/                # Organic 主题 token（直接复用）
│   ├── types/                    # 类型定义（直接复用）
│   ├── domain/                   # 领域逻辑（直接复用）
│   ├── utils/                    # 工具函数
│   └── app.config.ts             # Taro 配置
├── package.json
├── project.config.json           # 微信小程序配置
└── project.tt.json
```

### 技术映射

| 能力 | React Native | Taro 小程序 |
|------|-------------|------------|
| 路由 | Expo Router | Taro 文件路由 |
| 状态管理 | Zustand + AsyncStorage | Zustand + Taro.getStorage |
| HTTP | Axios | Taro.request |
| UI | RN View/Text | Taro View/Text |
| 图表 | react-native-chart-kit | echarts-for-weixin |
| 渐变 | expo-linear-gradient | CSS linear-gradient |
| 触觉 | expo-haptics | wx.vibrateShort |
| 推送 | expo-notifications | 微信订阅消息 |
| 日期选择 | datetimepicker | Taro Picker |
| 动画 | reanimated | CSS animation |
| 图标 | vector-icons/SF Symbols | 自定义 iconfont |

### 代码复用率

| 层级 | 复用率 |
|------|-------|
| types/ | 100% |
| constants/ | 100% |
| domain/ | 100% |
| store/ | 85% |
| services/api/ | 60% |
| components/ | 20% |
| pages/ | 15% |

## 后端适配

- 新增微信小程序登录端点（wx.login → openid → JWT）
- 新增订阅消息模板注册和发送
- 现有 RESTful API 基本不变
- 图片 URL 域名白名单适配

## 时间规划

14 天 = 10 天前端 + 4 天后端，每 2 天为一个计划单元，共 7 份计划文档。

每天 3-4 小时（含 AI 修改 + 人工审核）。

**Why:** 用户提供的时间约束，需要在两周内完成微信小程序端的全量迁移
**How to apply:** 按 7 个计划单元拆分任务，每个单元包含具体文件级别的修改清单
