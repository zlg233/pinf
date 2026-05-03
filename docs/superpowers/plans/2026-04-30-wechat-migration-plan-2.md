# 计划 2：核心 UI 组件 + 登录流程（第 3-4 天）

> 时间：每天 3-4 小时（AI 修改 ~2h + 人工审核 ~1.5h）
> 目标：完成基础 UI 组件库重写 + 登录/设置密码页面，实现完整的认证流程

---

## 第 3 天：基础 UI 组件重写（3.5h）

### 3.1 基础组件重写（AI ~2h）

将 `app_end/components/ui/` 中的核心组件改写为 Taro 版本。保持 props 接口不变，内部用 Taro 组件实现。

#### 新建文件清单：

| 新建文件 | 源参考 | RN → Taro 关键变更 |
|---------|--------|-------------------|
| `wx_end/src/components/ui/Button.tsx` | `app_end/components/ui/Button.tsx` | TouchableOpacity → View + onClick; ActivityIndicator → 自定义 Loading |
| `wx_end/src/components/ui/Input.tsx` | `app_end/components/ui/Input.tsx` | TextInput → Taro Input; placeholderTextColor → CSS |
| `wx_end/src/components/ui/Card.tsx` | `app_end/components/ui/Card.tsx` | View + CSS shadow/borderRadius |
| `wx_end/src/components/ui/Tag.tsx` | `app_end/components/ui/Tag.tsx` | View + Text，纯 CSS |
| `wx_end/src/components/ui/OrganicButton.tsx` | `app_end/components/ui/OrganicButton.tsx` | Animated → CSS transform; LinearGradient → CSS gradient |
| `wx_end/src/components/ui/OrganicCard.tsx` | `app_end/components/ui/OrganicCard.tsx` | Animated → CSS :active; TouchableOpacity → View + onClick |
| `wx_end/src/components/ui/OrganicBackground.tsx` | `app_end/components/ui/OrganicBackground.tsx` | LinearGradient → CSS linear-gradient |
| `wx_end/src/components/ui/OrganicChipButton.tsx` | `app_end/components/ui/OrganicChipButton.tsx` | TouchableOpacity → View + onClick |

#### 每个组件的迁移要点：

**Button.tsx**：
```
- TouchableOpacity → <View hoverClass="button-hover" onClick={onPress}>
- ActivityIndicator → <View className="loading-spinner">
- StyleSheet.create → SCSS modules 或 CSS
```

**Input.tsx**：
```
- TextInput → <Input> (Taro 组件)
- placeholderTextColor → CSS ::placeholder color
- onFocus/onBlur → 支持（Taro Input 自带）
- 右侧图标按钮 → View + onClick 包裹
```

**OrganicButton.tsx**：
```
- react-native-reanimated Animated → CSS transition + transform: scale()
- onPressIn/onPressOut 缩放动画 → CSS :active { transform: scale(0.96) }
- LinearGradient → CSS background: linear-gradient(...)
- expo-haptics → wx.vibrateShort({ type: 'light' })
```

**OrganicCard.tsx**：
```
- Animated 按压反馈 → CSS :active { transform: scale(0.98) }
- backdropFilter (仅 Web) → 不需要，小程序不支持
- StyleSheet.absoluteFillObject → CSS position: absolute; inset: 0
```

**OrganicBackground.tsx**：
```
- LinearGradient → CSS background: linear-gradient(to bottom, color1, color2, color3)
- StyleSheet.absoluteFillObject → CSS position: fixed; top:0; left:0; right:0; bottom:0
```

### 3.2 组件样式文件（AI ~30min）

创建 `wx_end/src/components/ui/styles/` 目录，将 StyleSheet.create 转为 SCSS：

| 新建文件 | 内容 |
|---------|------|
| `wx_end/src/components/ui/styles/variables.scss` | Organic token 映射为 SCSS 变量 |
| `wx_end/src/components/ui/styles/mixins.scss` | 常用 mixin（shadow, gradient, radius） |
| `wx_end/src/components/ui/styles/button.scss` | 按钮样式 |
| `wx_end/src/components/ui/styles/input.scss` | 输入框样式 |
| `wx_end/src/components/ui/styles/card.scss` | 卡片样式 |

### 3.3 人工审核（~1h）

- [ ] 每个组件在微信开发者工具中渲染正确
- [ ] Organic 主题颜色、圆角、阴影效果一致
- [ ] 按钮点击反馈（缩放动画）正常
- [ ] 输入框聚焦/失焦样式正确
- [ ] 渐变背景显示正确
- [ ] 无 TypeScript 编译错误

---

## 第 4 天：弹窗组件 + 登录流程（4h）

### 4.1 Modal 弹窗组件（AI ~45min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/components/ui/Modal.tsx` | `app_end/components/ui/Modal.tsx` | RN Modal → View + CSS fixed 定位 + opacity 动画 |
| `wx_end/src/components/ui/modalAnimation.ts` | `app_end/components/ui/modalAnimation.ts` | Animated.timing → CSS transition |
| `wx_end/src/components/ui/modalLayout.ts` | `app_end/components/ui/modalLayout.ts` | Dimensions.get → Taro.getSystemInfoSync() |

**Modal 迁移要点**：
```
- React Native Modal → 自定义 View 蒙层 + 内容区域
- 动画：Animated.spring → CSS transition: transform 0.3s ease-out
- 关闭：TouchableOpacity 蒙层 → View + onClick 蒙层
- Dimensions → Taro.getSystemInfoSync().windowHeight
```

### 4.2 日期选择器组件（AI ~30min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/components/ui/InlineDateTimePickerField.tsx` | `app_end/components/ui/InlineDateTimePickerField.tsx` | DateTimePicker → Taro Picker mode="date"/"time" |
| `wx_end/src/components/ui/dateTimeFieldState.ts` | `app_end/components/ui/dateTimeFieldState.ts` | 逻辑不变，纯 TS |
| `wx_end/src/components/ui/BabyForm.tsx` | `app_end/components/ui/BabyForm.tsx` | ScrollView → ScrollView; DateTimePicker → Taro Picker |

**日期选择器迁移要点**：
```
- @react-native-community/datetimepicker → <Picker mode="date">
- Platform.OS 判断 → 移除，小程序只有一种表现
- 显示模式 (spinner/default) → 移除
```

### 4.3 登录页面（AI ~1h）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/login/index.tsx` | `app_end/app/login.tsx` | 完整改写，使用新的 UI 组件 |
| `wx_end/src/pages/login/index.scss` | 新建 | 登录页样式 |

**登录页迁移要点**：
```
- KeyboardAvoidingView → 移除，小程序自动处理键盘避让
- TextInput → <Input> 组件
- 验证码倒计时 → 逻辑不变
- 表单验证 → 逻辑不变
-expo-router navigation → Taro.useRouter() / Taro.navigateTo()
- 开发模式验证码显示 → 保留
```

### 4.4 设置密码页面（AI ~30min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/set-password/index.tsx` | `app_end/app/set-password.tsx` | KeyboardAvoidingView → 移除 |
| `wx_end/src/pages/set-password/index.scss` | 新建 | 设置密码页样式 |

### 4.5 认证流程联调（AI ~30min）

- 确认 `wx_end/src/pages/login/index.tsx` 能正确调用 `authApi.sendPhoneCode/phoneLogin`
- 确认 token 存储和读取正常
- 确认登录成功后跳转到首页
- 在 `app.config.ts` 中将 login 设为非 tabBar 页面

### 4.6 人工审核（~1.5h）

- [ ] 登录页 UI 还原度 >= 85%（颜色、布局、字体）
- [ ] 验证码登录流程完整：输入手机号 → 发送验证码 → 输入验证码 → 登录
- [ ] 密码登录流程完整：切换到密码模式 → 输入手机号和密码 → 登录
- [ ] 设置密码流程完整
- [ ] 登录后 token 正确存储
- [ ] 错误提示正确显示（Toast）
- [ ] 微信开发者工具中无控制台错误

---

## 本单元交付物

- [x] 8 个基础 UI 组件（Button, Input, Card, Tag, OrganicButton, OrganicCard, OrganicBackground, OrganicChipButton）
- [x] Modal 弹窗组件
- [x] 日期选择器组件 + BabyForm
- [x] SCSS 样式体系（变量、mixin、组件样式）
- [x] 登录页面（验证码/密码双模式）
- [x] 设置密码页面
- [x] 完整认证流程可走通
