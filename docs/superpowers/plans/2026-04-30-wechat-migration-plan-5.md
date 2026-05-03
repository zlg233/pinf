# 计划 5：预约管理 + AI 问答 + 内容浏览（第 9-10 天）

> 时间：每天 3-4 小时（AI 修改 ~2h + 人工审核 ~1.5h）
> 目标：完成剩余 3 个核心页面（预约管理、AI 问答、内容浏览）和详情页面

---

## 第 9 天：预约管理页面 + AI 问答页面（4h）

### 9.1 预约管理页面（AI ~1.5h）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/appointments/index.tsx` | `app_end/app/appointments/index.tsx` | 完整改写 |
| `wx_end/src/pages/appointments/index.scss` | 新建 | 预约页样式 |

**预约页面迁移要点**：
```
- expo-router → Taro.useRouter() + Taro.useDidShow()
- 预约分组显示（今天/近3天/后续/历史）→ 直接复用分组逻辑
- 状态标签（待就诊/已完成/已过期）→ CSS class 切换颜色
- 标记已就诊 → 调用 appointmentStore.updateStatus()
- 订阅提醒 → wx.requestSubscribeMessage（替换 expo-notifications）
- ScrollView → ScrollView
- 下拉刷新 → ScrollView refresherEnabled
- 删除确认 → Taro.showModal
```

**页面结构**：
```jsx
<View className="page-appointments">
  <ScrollView refresherEnabled onRefresherRefresh={onRefresh}>
    {/* 今天 */}
    {todayGroup.length > 0 && <AppointmentGroup title="今天" items={todayGroup} />}
    {/* 近3天 */}
    {nearGroup.length > 0 && <AppointmentGroup title="近3天" items={nearGroup} />}
    {/* 后续 */}
    {futureGroup.length > 0 && <AppointmentGroup title="后续" items={futureGroup} />}
    {/* 历史 */}
    {historyGroup.length > 0 && <AppointmentGroup title="历史" items={historyGroup} />}
    {/* 空状态 */}
    {appointments.length === 0 && <EmptyState />}
  </ScrollView>
  <View className="add-btn" onClick={openCreateModal}>
    + 新建预约
  </View>
</View>
```

**订阅消息适配**（关键差异）：
```typescript
// RN: expo-notifications
await notificationsApi.subscribe(appointmentId, remindTime);

// 微信小程序: wx.requestSubscribeMessage
const { tmplIds } = await Taro.requestSubscribeMessage({
  tmplIds: ['预约提醒模板ID'],
});
// 用户同意后才调用后端订阅接口
```

### 9.2 AI 问答页面（AI ~1.5h）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/qa/index.tsx` | `app_end/app/(tabs)/qa.tsx` | 完整改写 |
| `wx_end/src/pages/qa/index.scss` | 新建 | 问答页样式 |

**AI 问答迁移要点**：
```
- KeyboardAvoidingView → 移除（小程序自动处理，或使用 adjustPosition）
- TextInput 多行 → <Textarea> autoHeight
- ScrollView 消息列表 → <ScrollView scrollY scrollIntoView>
- 自动滚到底部 → scroll-into-view 属性
- 消息气泡 → CSS 样式差异化（用户/AI）
- ActivityIndicator 发送状态 → 自定义 loading
- 会话清空 → Taro.showModal 确认
- 按宝宝分组会话 → 状态管理逻辑复用
```

**消息气泡样式**：
```scss
.msg-user {
  align-self: flex-end;
  background: linear-gradient(135deg, #FFB5A7, #FFCB9C);
  border-radius: 16px 16px 4px 16px;
  color: #4A4A4A;
}
.msg-ai {
  align-self: flex-start;
  background: #FFFFFF;
  border-radius: 16px 16px 16px 4px;
  color: #4A4A4A;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
```

**关键实现**：
```jsx
// 消息发送
const handleSend = async () => {
  if (!inputText.trim()) return;
  // 乐观更新：先显示用户消息
  appendMessage({ role: 'user', content: inputText });
  setInputText('');
  // 调用 API
  try {
    const reply = await chatApi.send(inputText, currentBaby?.id);
    appendMessage({ role: 'assistant', content: reply });
  } catch {
    updateLastMessageStatus('failed');
  }
};
```

### 9.3 人工审核（~1h）

- [ ] 预约管理页面完整渲染（分组显示、状态标签）
- [ ] 预约创建/编辑/删除流程
- [ ] 标记已就诊功能
- [ ] AI 问答页面消息发送和接收
- [ ] 消息气泡样式（用户/AI 差异化）
- [ ] 输入框自适应高度
- [ ] 消息自动滚到底部
- [ ] 会话清空功能

---

## 第 10 天：内容浏览页面 + 详情页面（3.5h）

### 10.1 在线课堂页面（AI ~1h）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/class/index.tsx` | `app_end/app/(tabs)/class.tsx` | 完整改写 |
| `wx_end/src/pages/class/index.scss` | 新建 | 课堂页样式 |

**课堂页迁移要点**：
```
- 文章/视频 Tab 切换 → View + onClick 状态切换
- 搜索功能 → Input + 搜索按钮
- ScrollView + RefreshControl → ScrollView refresherEnabled
- 上拉加载更多 → ScrollView onScrollToLower
- 本地缓存 → Taro.getStorage/setStorage（保持 1 小时 TTL）
- Image 封面 → <Image> 组件
- 分页加载（每页 8 条）→ 逻辑复用
```

**缓存适配**：
```typescript
// RN: AsyncStorage.getItem/setItem
// 小程序:
const cacheKey = `content_${tab}_${page}`;
const cached = Taro.getStorageSync(cacheKey);
if (cached && Date.now() - cached.timestamp < 3600000) {
  return cached.data;
}
```

### 10.2 文章详情页（AI ~40min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/article-detail/index.tsx` | `app_end/app/class-article/[id].tsx` | WebView → rich-text 或 web-view |
| `wx_end/src/pages/article-detail/index.scss` | 新建 | 文章详情样式 |

**文章详情迁移策略**：
```
方案 1（推荐）：使用 <RichText> 组件直接渲染 HTML 内容
  - 优点：渲染快、原生体验
  - 限制：不支持复杂 HTML（script/iframe）
  - 适用：公众号文章通常是图文混排，RichText 足够

方案 2（备选）：使用 <WebView> 组件
  - 优点：完整 HTML 支持
  - 限制：需要业务域名白名单、加载慢
  - 适用：复杂 HTML 或需要 JS 交互的场景
```

**实现（方案 1）**：
```jsx
<View className="page-article-detail">
  <Image src={article.cover_url} className="cover" />
  <View className="article-meta">
    <Text>{article.author}</Text>
    <Text>{article.publish_date}</Text>
  </View>
  <View className="article-title">
    <Text>{article.title}</Text>
  </View>
  <RichText nodes={article.content} />
</View>
```

### 10.3 视频详情页（AI ~40min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/video-detail/index.tsx` | `app_end/app/class-video/[id].tsx` | WebView → <Video> 组件 |
| `wx_end/src/pages/video-detail/index.scss` | 新建 | 视频详情样式 |

**视频详情迁移要点**：
```
- WebView 视频播放 → <Video> 组件（微信原生）
- allowsInlineMediaPlayback → 不需要（Video 组件自带）
- 封面图 → poster 属性
- 视频信息展示 → Text 组件
```

**实现**：
```jsx
<View className="page-video-detail">
  <Video
    src={video.url}
    poster={video.cover_url}
    controls
    autoplay={false}
    className="video-player"
  />
  <View className="video-info">
    <Text className="title">{video.title}</Text>
    <Text className="desc">{video.description}</Text>
  </View>
</View>
```

### 10.4 页面路由配置完善（AI ~15min）

更新 `wx_end/src/app.config.ts`，确保所有页面路由正确：

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/qa/index',
    'pages/class/index',
    'pages/login/index',
    'pages/set-password/index',
    'pages/profile/index',
    'pages/growth/index',
    'pages/appointments/index',
    'pages/article-detail/index',
    'pages/video-detail/index',
  ],
  tabBar: {
    list: [
      { pagePath: 'pages/index/index', text: '首页', iconPath: '...', selectedIconPath: '...' },
      { pagePath: 'pages/qa/index', text: '问答', iconPath: '...', selectedIconPath: '...' },
      { pagePath: 'pages/class/index', text: '课堂', iconPath: '...', selectedIconPath: '...' },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FFF9F5',
    navigationBarTitleText: '早护通',
    navigationBarTextStyle: 'black',
  },
});
```

### 10.5 人工审核（~1.5h）

- [ ] 在线课堂 Tab 切换正常（文章/视频）
- [ ] 搜索功能正常
- [ ] 下拉刷新 + 上拉加载更多正常
- [ ] 文章详情页渲染正确（图文混排）
- [ ] 视频详情页播放正常（播放/暂停/进度条）
- [ ] 内容缓存生效（重复进入页面秒加载）
- [ ] 所有页面间导航跳转正确
- [ ] tabBar 切换正常
- [ ] 前端 10 天迁移的全部页面可正常访问和操作

---

## 本单元交付物

- [x] 预约管理页面（分组显示、状态管理、提醒订阅）
- [x] AI 问答页面（聊天界面、消息发送、会话管理）
- [x] 在线课堂页面（文章/视频 Tab、搜索、分页、缓存）
- [x] 文章详情页（RichText 渲染）
- [x] 视频详情页（Video 组件播放）
- [x] 完整页面路由配置
- [x] **前端迁移全部完成，10 个页面可正常使用**
