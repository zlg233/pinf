# 计划 7：后端 API 适配 + 集成测试 + 全局打磨（第 13-14 天）

> 时间：每天 3-4 小时（AI 修改 ~2h + 人工审核 ~1.5h）
> 目标：完成后端剩余适配、全流程集成测试、UI 打磨和性能优化

---

## 第 13 天：API 适配 + 集成测试（4h）

### 13.1 API 响应格式审查（AI ~30min）

审查所有 API 端点，确保返回格式对小程序友好：

**检查清单**：
- [ ] 所有图片 URL 使用 HTTPS（小程序强制要求）
- [ ] 日期时间格式统一（ISO 8601）
- [ ] 错误消息中文友好
- [ ] 分页参数和返回格式一致

**可能需要修改的文件**：
- `backend/routes/content.py` — 文章/视频封面 URL 检查
- `backend/models/content.py` — `to_dict()` 确保 URL 完整

### 13.2 设备管理适配（AI ~30min）

**修改文件**：`backend/routes/devices.py`

新增小程序设备注册：

```python
@devices_bp.route('/register/miniprogram', methods=['POST'])
@token_required
def register_miniprogram_device():
    """注册小程序设备（用于统计和会话管理）"""
    user = get_current_user()
    data = request.json

    device = DeviceToken(
        user_id=user.id,
        token=data.get('openid', ''),
        platform='wechat_mp'
    )
    db.session.add(device)
    db.session.commit()

    return jsonify({'status': 'success'})
```

**修改文件**：`backend/models/device_token.py`

确保 `platform` 字段支持 `'wechat_mp'` 值。

### 13.3 CORS 和域名白名单（AI ~20min）

**修改文件**：`backend/app.py` 或 CORS 配置

确保后端 API 允许小程序域名访问：

```python
# 微信小程序请求不涉及 CORS，但需要确认：
# 1. API 域名在小程序后台的"服务器域名"中配置
# 2. 所有图片资源域名在"downloadFile 合法域名"中配置
```

### 13.4 前端 API 基础 URL 配置（AI ~20min）

**修改文件**：`wx_end/src/services/api/client.ts`

```typescript
// 小程序环境配置
const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://backend.pinf.top/api'
  : 'http://localhost:5010/api';

// 注意：开发环境需要在微信开发者工具中
// 勾选"不校验合法域名"才能访问 localhost
```

### 13.5 全流程集成测试（AI ~1.5h）

按用户场景逐一测试：

#### 测试场景 1：新用户注册流程
```
1. 打开小程序 → 登录页
2. 点击"微信一键登录" → 获取 code
3. 后端换 token → 新用户（无手机号）
4. 引导绑定手机号
5. 进入首页 → 创建宝宝
6. 完成注册
```

#### 测试场景 2：日常使用流程
```
1. 登录 → 首页
2. 查看宝宝信息 → 切换宝宝
3. 添加成长记录 → 查看成长曲线
4. 创建预约 → 订阅提醒
5. AI 问答 → 发送消息
6. 浏览文章/视频 → 查看详情
```

#### 测试场景 3：预约提醒流程
```
1. 创建预约 → 请求订阅消息授权
2. 用户同意 → 后端记录订阅
3. 定时任务触发 → 发送订阅消息
4. 用户点击消息 → 跳转到预约详情
```

### 13.6 人工审核（~1.5h）

- [ ] 所有 API 端点返回格式正确
- [ ] 图片 URL 全部 HTTPS
- [ ] 设备注册正常
- [ ] 全流程测试场景通过
- [ ] 错误场景处理正确（网络异常、token 过期、参数错误）
- [ ] 无控制台错误或警告

---

## 第 14 天：UI 打磨 + 性能优化 + 最终验收（3.5h）

### 14.1 UI 细节打磨（AI ~1h）

逐页面对比 RN 版本，修复视觉差异：

| 页面 | 打磨要点 |
|------|---------|
| 登录页 | 输入框间距、按钮圆角、渐变背景 |
| 首页 | 卡片阴影、图标对齐、间距统一 |
| 成长曲线 | 图表颜色、轴标签、图例样式 |
| AI 问答 | 消息气泡圆角、时间戳格式 |
| 课堂页 | 搜索框样式、卡片封面比例 |
| 预约页 | 状态颜色、分组标题样式 |

**可能修改的文件**：
- `wx_end/src/pages/*/index.scss` — 各页面样式微调
- `wx_end/src/components/ui/styles/variables.scss` — 全局 token 微调

### 14.2 性能优化（AI ~40min）

#### 图片优化
```typescript
// 使用 Taro Image 组件的 lazy-load
<Image src={coverUrl} lazyLoad mode="aspectFill" />

// 小图片使用 CDN 缩略图
const thumbUrl = `${coverUrl}?imageView2/2/w/400`;
```

#### 列表渲染优化
```jsx
// 使用 ScrollView 的 scroll-into-view 替代全量渲染
<ScrollView
  scrollY
  scrollIntoView={scrollTarget}
  scrollWithAnimation
>
  {items.map(item => (
    <View key={item.id} id={`item-${item.id}`}>
      ...
    </View>
  ))}
</ScrollView>
```

#### 缓存策略
```typescript
// 静态数据缓存（文章列表、视频列表）
// 使用 Taro.setStorage 带过期时间
async function setCacheWithExpiry(key, data, ttlMs = 3600000) {
  await Taro.setStorage({
    key,
    data: { data, timestamp: Date.now(), ttl: ttlMs }
  });
}
```

### 14.3 小程序配置完善（AI ~20min）

**修改文件**：`wx_end/project.config.json`

```json
{
  "miniprogramRoot": "dist/",
  "setting": {
    "es6": true,
    "enhance": true,
    "compileHotReLoad": true,
    "urlCheck": true,
    "minified": true
  },
  "appid": "你的小程序AppID",
  "condition": {}
}
```

**修改文件**：`wx_end/src/app.config.ts`

最终确认所有配置项正确。

### 14.4 构建和预发布检查（AI ~30min）

```bash
# 构建生产版本
cd wx_end && npm run build:weapp

# 检查项：
# 1. 构建无错误
# 2. 包大小 < 2MB（单包限制）
# 3. 无未使用的依赖
# 4. 图片资源已压缩
# 5. 所有页面在 app.config.ts 中注册
```

### 14.5 最终验收（人工 ~1.5h）

#### 功能验收
- [ ] 登录/登出流程完整
- [ ] 宝宝 CRUD 完整
- [ ] 成长记录 CRUD + 图表展示
- [ ] 预约 CRUD + 订阅消息
- [ ] AI 问答消息收发
- [ ] 文章/视频浏览 + 详情
- [ ] 个人中心功能

#### UI 验收
- [ ] Organic 主题风格一致（珊瑚粉主色、圆润形状）
- [ ] 所有页面无白屏、无布局错乱
- [ ] 加载状态有反馈（loading、骨架屏）
- [ ] 错误状态有提示（Toast、Modal）

#### 性能验收
- [ ] 首屏加载 < 3s
- [ ] 页面切换流畅
- [ ] 列表滚动无卡顿
- [ ] 图片懒加载生效

#### 小程序规范
- [ ] 无 alert/prompt/confirm（使用 Toast/Modal）
- [ ] 无未授权的 API 调用
- [ ] 域名白名单配置完整
- [ ] 无违反微信小程序审核规范的内容

---

## 本单元交付物

- [x] 后端 API 完全适配小程序
- [x] 全流程集成测试通过
- [x] UI 打磨完成（还原度 >= 85%）
- [x] 性能优化完成
- [x] 生产构建成功
- [x] 最终验收通过
- [x] **项目可提交微信审核**

---

## 总交付物清单

| 计划单元 | 天数 | 交付内容 |
|---------|------|---------|
| 计划 1 | 1-2 | Taro 项目框架 + API 客户端 + Store + 工具函数 |
| 计划 2 | 3-4 | UI 组件库 + 登录/设置密码页 + 认证流程 |
| 计划 3 | 5-6 | 首页全部功能组件 + 个人中心 + 图标系统 |
| 计划 4 | 7-8 | 成长曲线图表 + 记录管理 + 预约弹窗 |
| 计划 5 | 9-10 | 预约管理 + AI 问答 + 内容浏览 + 详情页 |
| 计划 6 | 11-12 | 微信登录 + 手机号绑定 + 订阅消息 |
| 计划 7 | 13-14 | API 适配 + 集成测试 + UI 打磨 + 最终验收 |
