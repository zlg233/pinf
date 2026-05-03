# 计划 1：项目初始化 + 基础层搭建（第 1-2 天）

> 时间：每天 3-4 小时（AI 修改 ~2h + 人工审核 ~1.5h）
> 目标：初始化 Taro 项目，搭建可运行的基础框架，完成非 UI 层的代码迁移

---

## 第 1 天：项目初始化 + 代码复用（3.5h）

### 1.1 初始化 Taro 项目（AI ~40min）

```bash
# 在 d:\pinf 根目录下
npx @tarojs/cli init wx_end
# 选择：React + TypeScript + Sass
```

**生成文件**：
- `wx_end/package.json`
- `wx_end/tsconfig.json`
- `wx_end/babel.config.js`
- `wx_end/src/app.config.ts`
- `wx_end/src/app.tsx`

**配置修改**：
- `wx_end/src/app.config.ts` — 配置 tabBar（首页/问答/课堂）、页面路由、窗口样式
- `wx_end/project.config.json` — 填入微信 AppID，设置 es6 转 es5、增强编译
- `wx_end/project.tt.json` — 开发者工具配置

### 1.2 安装核心依赖（AI ~15min）

```bash
cd wx_end
npm install zustand echarts echarts-for-weixin
npm install -D @tarojs/cli @tarojs/components @tarojs/runtime @tarojs/taro @tarojs/plugin-platform-weapp
```

### 1.3 复用层迁移（AI ~45min）

直接从 `app_end/` 复制以下目录到 `wx_end/src/`（无需修改）：

| 源文件 | 目标位置 | 说明 |
|--------|---------|------|
| `app_end/types/*.ts` | `wx_end/src/types/` | 类型定义，100% 复用 |
| `app_end/constants/tokens.ts` | `wx_end/src/constants/tokens.ts` | 基础设计 token |
| `app_end/constants/organic-tokens.ts` | `wx_end/src/constants/organic-tokens.ts` | Organic 主题 |
| `app_end/constants/theme.ts` | `wx_end/src/constants/theme.ts` | 主题导出 |
| `app_end/domain/growthCurve/*` | `wx_end/src/domain/growthCurve/` | 生长曲线计算引擎 |

**具体操作**：
- 复制 `app_end/types/` 全部 5 个文件（baby.ts, growth.ts, appointment.ts, chat.ts, content.ts）
- 复制 `app_end/constants/` 全部 3 个文件
- 复制 `app_end/domain/growthCurve/` 全部文件（engine.ts, config.ts, types.ts, assessment.ts, axis.ts, age.ts, standardResolver.ts）
- 复制 `app_end/utils/feedback.ts`（Feedback 抽象层）

### 1.4 人工审核（~1.5h）

- [ ] 确认 Taro 项目能正常 `npm run dev:weapp` 编译
- [ ] 微信开发者工具能打开 `dist/` 目录
- [ ] 检查复制文件的 import 路径是否正确
- [ ] 确认 `app.config.ts` 中 tabBar 和页面路由配置正确
- [ ] 验证 TypeScript 编译无报错

---

## 第 2 天：API 客户端 + 状态管理适配（3.5h）

### 2.1 API 客户端重写（AI ~1h）

**新建文件**：`wx_end/src/services/api/client.ts`

将 `app_end/services/api/client.ts`（Axios + AsyncStorage）改写为 Taro.request 封装：

```typescript
// 关键变更：
// - axios → Taro.request
// - AsyncStorage → Taro.getStorage/Taro.setStorage
// - expo-constants → 直接硬编码或环境变量
// - 拦截器逻辑用 Taro.request 的 beforeRequest/afterResponse 模式
```

**保持一致的接口**：
- `tokenManager.setToken/getToken/clearToken/isAuthenticated`
- 401 自动登出逻辑
- 网络错误重试策略
- 请求/响应拦截

**新建文件**：`wx_end/src/services/api/index.ts`（统一导出）

### 2.2 API 服务层迁移（AI ~50min）

逐个改写 API 服务文件（接口签名不变，HTTP 层替换为新的 client）：

| 新建文件 | 源参考 | 改动要点 |
|---------|--------|---------|
| `wx_end/src/services/api/auth.ts` | `app_end/services/api/auth.ts` | 保持接口，替换底层调用 |
| `wx_end/src/services/api/baby.ts` | `app_end/services/api/baby.ts` | 同上 |
| `wx_end/src/services/api/growth.ts` | `app_end/services/api/growth.ts` | 同上 |
| `wx_end/src/services/api/appointment.ts` | `app_end/services/api/appointment.ts` | 同上 |
| `wx_end/src/services/api/content.ts` | `app_end/services/api/content.ts` | 同上 |
| `wx_end/src/services/api/chat.ts` | `app_end/services/api/chat.ts` | 同上 |
| `wx_end/src/services/api/notifications.ts` | `app_end/services/api/notifications.ts` | 适配小程序订阅消息 |
| `wx_end/src/services/api/devices.ts` | `app_end/services/api/devices.ts` | 适配小程序设备注册 |

### 2.3 Store 层适配（AI ~40min）

将 Zustand Store 从 `app_end/store/` 迁移，替换 AsyncStorage 为 Taro 存储层：

| 新建文件 | 源参考 | 改动要点 |
|---------|--------|---------|
| `wx_end/src/store/index.ts` | `app_end/store/index.ts` | AsyncStorage → Taro.getStorage/setStorage |
| `wx_end/src/store/babyStore.ts` | `app_end/store/babyStore.ts` | 同上 + 本地缓存适配 |
| `wx_end/src/store/growthStore.ts` | `app_end/store/growthStore.ts` | 无存储依赖，基本不变 |
| `wx_end/src/store/appointmentStore.ts` | `app_end/store/appointmentStore.ts` | AsyncStorage → Taro 存储 + 推送适配 |

**关键适配**：创建 `wx_end/src/utils/storage.ts` 统一存储接口：

```typescript
// 封装 Taro.getStorage/Taro.setStorage 为 AsyncStorage 兼容接口
export const storage = {
  getItem: (key: string) => Taro.getStorage({ key }),
  setItem: (key: string, value: string) => Taro.setStorage({ key, data: value }),
  removeItem: (key: string) => Taro.removeStorage({ key }),
};
```

### 2.4 工具函数迁移（AI ~15min）

| 新建文件 | 源参考 | 改动要点 |
|---------|--------|---------|
| `wx_end/src/utils/feedback.ts` | `app_end/utils/feedback.ts` | Taro.showToast/Taro.showModal 替代 Alert |
| `wx_end/src/utils/format.ts` | 复用现有 | 无需修改 |

### 2.5 人工审核（~1.5h）

- [ ] API 客户端能正确发起请求和接收响应
- [ ] tokenManager 能正确存储和读取 token
- [ ] 所有 Store 能正常初始化
- [ ] 登录 API 调用测试通过（可用 Postman 或微信开发者工具 Network 面板验证）
- [ ] TypeScript 编译无报错
- [ ] 存储层读写正常

---

## 本单元交付物

- [x] 可编译运行的 Taro 项目框架
- [x] 完整的类型定义、主题 token、领域逻辑
- [x] API 客户端 + 8 个 API 服务模块
- [x] 4 个 Zustand Store
- [x] 工具函数
- [x] 微信开发者工具能正常打开预览
