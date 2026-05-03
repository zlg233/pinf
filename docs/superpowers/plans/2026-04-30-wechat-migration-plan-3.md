# 计划 3：首页 + 宝宝管理 + 个人中心（第 5-6 天）

> 时间：每天 3-4 小时（AI 修改 ~2h + 人工审核 ~1.5h）
> 目标：完成首页全部功能组件、宝宝管理流程和个人中心页面

---

## 第 5 天：首页功能组件（4h）

### 5.1 首页子组件重写（AI ~2.5h）

将 `app_end/components/home/` 下的 12 个组件改写为 Taro 版本。

#### 新建文件清单：

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/components/home/BabySwitcher.tsx` | `app_end/components/home/BabySwitcher.tsx` | ScrollView 水平滚动 → ScrollView scrollX |
| `wx_end/src/components/home/AgeCard.tsx` | `app_end/components/home/AgeCard.tsx` | OrganicCard + 纯文本渲染 |
| `wx_end/src/components/home/AppointmentCard.tsx` | `app_end/components/home/AppointmentCard.tsx` | TouchableOpacity → View + hoverClass |
| `wx_end/src/components/home/GrowthCard.tsx` | `app_end/components/home/GrowthCard.tsx` | 数据展示组件，改动小 |
| `wx_end/src/components/home/ContentStrip.tsx` | `app_end/components/home/ContentStrip.tsx` | ScrollView 水平滚动 |
| `wx_end/src/components/home/FloatingActionButton.tsx` | `app_end/components/home/FloatingActionButton.tsx` | 固定定位 → CSS position: fixed |
| `wx_end/src/components/home/ActionGrid.tsx` | `app_end/components/home/ActionGrid.tsx` | 网格布局 → CSS Grid/Flex |
| `wx_end/src/components/home/OrganicHomeScreen.tsx` | `app_end/components/home/OrganicHomeScreen.tsx` | 布局容器，CSS 重写 |

**各组件迁移要点**：

**BabySwitcher.tsx**：
```
- ScrollView horizontal → <ScrollView scrollX>
- TouchableOpacity → View + onClick
- 多宝宝切换逻辑不变（来自 babyStore）
```

**AgeCard.tsx**：
```
- 使用 OrganicCard 组件
- 年龄计算逻辑（实际月龄/矫正月龄）来自 types/baby.ts，直接复用
- 无 RN 特有依赖
```

**AppointmentCard.tsx**：
```
- 预约状态颜色映射 → SCSS class 切换
- onPress → onClick
- 时间格式化逻辑不变
```

**GrowthCard.tsx**：
```
- 数据展示型组件
- 最新成长记录 → 文本展示
- 无复杂 RN 依赖
```

**FloatingActionButton.tsx**：
```
- position: absolute → position: fixed
- expo-haptics → wx.vibrateShort
- Animated 缩放 → CSS :active + transition
```

### 5.2 预约和成长弹窗组件（AI ~50min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/components/home/GrowthRecordModal.tsx` | `app_end/components/home/GrowthRecordModal.tsx` | Modal → 自定义弹窗; DateTimePicker → Picker |
| `wx_end/src/components/home/AppointmentModal.tsx` | `app_end/components/home/AppointmentModal.tsx` | Modal → 自定义弹窗; Pressable → View |
| `wx_end/src/components/home/AppointmentInfoOnceModal.tsx` | `app_end/components/home/AppointmentInfoOnceModal.tsx` | 同上 |
| `wx_end/src/components/home/AppointmentCompletionPrompt.tsx` | `app_end/components/home/AppointmentCompletionPrompt.tsx` | View + 动画 → CSS transition |
| `wx_end/src/components/home/AppointmentReminderOverlay.tsx` | `app_end/components/home/AppointmentReminderOverlay.tsx` | 遮罩层 → View fixed 定位 |

### 5.3 人工审核（~1h）

- [ ] 各组件独立渲染正常
- [ ] BabySwitcher 切换逻辑正确
- [ ] FloatingActionButton 固定定位正确
- [ ] 弹窗组件打开/关闭动画正常
- [ ] 日期选择器在弹窗中正常工作
- [ ] Organic 主题风格一致

---

## 第 6 天：首页页面 + 个人中心（3.5h）

### 6.1 首页页面组装（AI ~1.5h）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/index/index.tsx` | `app_end/app/(tabs)/index.tsx` | 完整改写 |
| `wx_end/src/pages/index/index.scss` | 新建 | 首页样式 |

**首页迁移要点**：
```
- expo-router → Taro 页面生命周期 (useDidShow/useDidHide)
- ScrollView + RefreshControl → <ScrollView refresherEnabled refresherTriggered>
- 问候语逻辑（早上好/中午好/...）→ 直接复用
- 宝宝信息卡片 → BabySwitcher + AgeCard
- 快捷入口 → ActionGrid
- 近期预约 → AppointmentCard 列表
- 成长记录 → GrowthCard
- 下拉刷新 → ScrollView refresherEnabled
- LinearGradient 背景 → CSS gradient
- expo-router navigation → Taro.navigateTo/Taro.switchTab
```

**页面结构**：
```jsx
<View className="page-home">
  <ScrollView
    refresherEnabled
    refresherTriggered={refreshing}
    onRefresherRefresh={onRefresh}
  >
    <OrganicBackground variant="morning">
      <BabySwitcher />
      <AgeCard />
      <ActionGrid />
      <AppointmentCards />
      <GrowthCard />
    </OrganicBackground>
  </ScrollView>
  <FloatingActionButton />
</View>
```

### 6.2 个人中心页面（AI ~40min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/profile/index.tsx` | `app_end/app/profile.tsx` | 完整改写 |
| `wx_end/src/pages/profile/index.scss` | 新建 | 个人中心样式 |

**个人中心迁移要点**：
```
- ScrollView → ScrollView
- TextInput 昵称编辑 → Input 组件
- 菜单项 → View + onClick + 右箭头图标
- 登出功能 → 调用 authStore.logout() + Taro.reLaunch('/pages/login/index')
- expo-router → Taro.navigateTo/useRouter
```

**页面内容**：
- 用户头像/昵称展示
- 昵称编辑
- 修改密码入口
- 关于我们
- 退出登录

### 6.3 图标系统搭建（AI ~30min）

| 新建文件 | 说明 |
|---------|------|
| `wx_end/src/components/ui/IconFont.tsx` | 基于 iconfont 的图标组件 |
| `wx_end/src/assets/fonts/iconfont.ttf` | iconfont 字体文件 |
| `wx_end/src/constants/icon-map.ts` | 图标名称映射（从 icon-symbol-map.ts 转换） |

**图标迁移策略**：
```
- @expo/vector-icons (SF Symbols) → 自定义 iconfont
- IconSymbol 组件 → IconFont 组件
- 从现有 icon-symbol-map.ts 中提取所有使用的图标名称
- 在 iconfont.cn 上创建项目并选择对应图标
- 下载 ttf 文件并配置到小程序 app.config.ts
```

### 6.4 人工审核（~1.5h）

- [ ] 首页完整渲染（问候语、宝宝卡片、快捷入口、预约列表、成长记录）
- [ ] 下拉刷新功能正常
- [ ] 多宝宝切换正常
- [ ] 首页到子页面的导航跳转正常
- [ ] 个人中心页面功能完整（编辑昵称、退出登录）
- [ ] 图标显示正确
- [ ] 整体 UI 还原度 >= 80%
- [ ] 无白屏、无报错

---

## 本单元交付物

- [x] 12 个首页功能组件
- [x] 5 个弹窗/浮层组件
- [x] 首页页面（含下拉刷新、多宝宝切换）
- [x] 个人中心页面
- [x] 图标系统（iconfont）
- [x] 首页完整交互流程可走通
