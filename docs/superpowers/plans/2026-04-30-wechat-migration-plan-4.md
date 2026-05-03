# 计划 4：成长曲线 + 成长记录管理（第 7-8 天）

> 时间：每天 3-4 小时（AI 修改 ~2h + 人工审核 ~1.5h）
> 目标：完成最复杂的成长曲线图表页面和成长记录 CRUD 功能

---

## 第 7 天：图表系统 + 曲线页面（4h）

### 7.1 ECharts for 微信小程序集成（AI ~50min）

| 新建文件 | 说明 |
|---------|------|
| `wx_end/src/components/ui/ec-canvas.tsx` | ECharts 小程序画布组件封装 |
| `wx_end/src/utils/echarts.ts` | ECharts 初始化工具 |
| `wx_end/src/components/ui/ec-canvas.scss` | 画布样式 |

**集成步骤**：
```
1. 安装 echarts + echarts-for-weixin
2. 创建 ec-canvas 自定义组件（Taro 版本）
3. 配置 ECharts 初始化（使用 canvas 2d 模式）
4. 封装 useEChart hook（初始化、设置选项、更新数据）
```

**ec-canvas 组件核心实现**：
```jsx
import { useEffect, useRef } from 'react';
import { Canvas, View } from '@tarojs/components';
import * as echarts from 'echarts/core';

// 自定义组件模式，支持 Taro 的 Canvas 2D
```

### 7.2 成长曲线配置转换（AI ~40min）

将 `react-native-chart-kit` 的 LineChart 配置转换为 ECharts option。

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/components/growth/chartOptions.ts` | `app_end/components/growth/chartPresentation.ts` | chart-kit config → ECharts option |
| `wx_end/src/components/growth/GrowthChart.tsx` | `app_end/components/growth/GrowthChart.tsx` | LineChart → ec-canvas + ECharts |
| `wx_end/src/components/growth/GrowthChartView.tsx` | `app_end/components/growth/GrowthChartView.tsx` | 容器组件改写 |

**chart-kit → ECharts 映射**：
```
react-native-chart-kit:
  data: { labels, datasets: [{ data, color }] }
  width, height, chartConfig: { color, strokeWidth, decimalPlaces, propsForDots }

ECharts option:
  xAxis: { data: labels }
  yAxis: {}
  series: [{ data, type: 'line', smooth: true, lineStyle, itemStyle }]
  grid: { left, right, top, bottom }
```

**GrowthChart.tsx 迁移要点**：
```
- LineChart → ec-canvas 组件 + ECharts option
- useWindowDimensions → Taro.getSystemInfoSync().windowWidth
- 缩放功能 → ECharts dataZoom 组件
- 全屏模式 → 页面全屏 + ECharts resize
- 数据插值 → 使用 domain/growthCurve/ 中的逻辑（已复用）
- 图例切换 → ECharts legend 组件
```

### 7.3 成长记录列表组件（AI ~30min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/components/growth/GrowthRecordList.tsx` | `app_end/components/growth/GrowthRecordList.tsx` | Modal → 自定义弹窗; DateTimePicker → Picker |
| `wx_end/src/components/growth/index.ts` | `app_end/components/growth/index.ts` | 导出调整 |

**GrowthRecordList 迁移要点**：
```
- ScrollView → ScrollView
- Modal 编辑弹窗 → 自定义弹窗组件
- DateTimePicker → <Picker mode="date">
- 删除确认 → Taro.showModal
- 记录列表 → map + View 列表项
```

### 7.4 成长曲线页面组装（AI ~1h）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/pages/growth/index.tsx` | `app_end/app/growth/index.tsx` | 完整改写 |
| `wx_end/src/pages/growth/index.scss` | 新建 | 成长页样式 |

**页面迁移要点**：
```
- expo-router → Taro.useRouter() 获取 babyId 参数
- 图表/列表双视图切换 → View + 状态切换
- 体重/身高/头围 Tab → View + onClick 切换指标
- 实际月龄/矫正月龄切换 → 状态切换
- ScrollView + RefreshControl → ScrollView refresherEnabled
- 添加记录 → 打开 GrowthRecordModal
- 使用 growthStore 的 fetch/add/update/remove
```

**页面结构**：
```jsx
<View className="page-growth">
  <View className="metric-tabs">
    {/* 体重/身高/头围 切换 */}
  </View>
  <View className="age-toggle">
    {/* 实际月龄/矫正月龄 */}
  </View>
  <View className="view-toggle">
    {/* 图表/列表 切换 */}
  </View>
  <ScrollView>
    {viewMode === 'chart' ? <GrowthChartView /> : <GrowthRecordList />}
  </ScrollView>
  <GrowthRecordModal />
</View>
```

### 7.5 人工审核（~1h）

- [ ] ECharts 在小程序 canvas 中正常渲染
- [ ] 生长曲线数据展示正确（对比 WHO 标准）
- [ ] 体重/身高/头围指标切换正常
- [ ] 实际月龄/矫正月龄切换正常
- [ ] 图表/列表视图切换正常
- [ ] 下拉刷新功能正常
- [ ] 添加/编辑/删除成长记录流程完整
- [ ] 矫正月龄计算正确（早产儿场景）

---

## 第 8 天：成长记录弹窗 + 预约提醒组件（3h）

### 8.1 GrowthRecordModal 完善（AI ~40min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/components/home/GrowthRecordModal.tsx` | `app_end/components/home/GrowthRecordModal.tsx` | 完善表单交互 |

**弹窗功能清单**：
- [x] 指标选择（体重/身高/头围）
- [x] 数值输入 + 单位显示
- [x] 日期选择（Picker mode="date"）
- [x] 备注输入
- [x] 表单验证
- [x] 提交/取消

### 8.2 预约相关弹窗组件完善（AI ~50min）

| 新建文件 | 源参考 | 关键变更 |
|---------|--------|---------|
| `wx_end/src/components/home/AppointmentModal.tsx` | `app_end/components/home/AppointmentModal.tsx` | 完善预约表单 |
| `wx_end/src/components/home/AppointmentInfoOnceModal.tsx` | `app_end/components/home/AppointmentInfoOnceModal.tsx` | 引导弹窗 |
| `wx_end/src/components/home/AppointmentCompletionPrompt.tsx` | `app_end/components/home/AppointmentCompletionPrompt.tsx` | 完成提醒 |

**AppointmentModal 表单字段**：
```
- 医院名称：Input
- 科室：Input
- 预约时间：Picker mode="date" + Picker mode="time"
- 提醒时间：Picker mode="date" + Picker mode="time"
- 备注：Textarea
- 关联宝宝：Picker（从 babyStore 获取列表）
```

### 8.3 集成测试 + Bug 修复（AI ~30min）

- 成长记录：创建 → 查看图表 → 编辑 → 删除 完整流程
- 预约：创建 → 查看列表 → 标记完成 → 删除 完整流程
- 数据一致性：确认 Store 和 API 数据同步

### 8.4 人工审核（~1h）

- [ ] GrowthRecordModal 弹窗打开/关闭正常
- [ ] 预约创建表单完整可用
- [ ] 日期选择器在弹窗中正常弹出
- [ ] 表单验证（必填项、数值范围）正常
- [ ] 提交后数据正确更新到列表
- [ ] 成长曲线数据与记录列表一致
- [ ] 无内存泄漏（弹窗关闭后数据清理）

---

## 本单元交付物

- [x] ECharts 小程序集成（ec-canvas 组件）
- [x] 成长曲线图表页面（体重/身高/头围）
- [x] 成长记录列表组件
- [x] 成长记录 CRUD 弹窗
- [x] 预约创建/编辑弹窗完善
- [x] 实际月龄/矫正月龄切换
- [x] 图表/列表双视图切换
