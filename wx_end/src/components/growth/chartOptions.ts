/**
 * 成长曲线图表配置
 *
 * 将 domain engine 输出的 GrowthCurveModel 转换为 ECharts option 格式。
 * 替代原先 react-native-chart-kit LineChart 的配置方式。
 */

import type { EChartsOption } from '@/utils/echarts';
import type { GrowthCurveModel, AxisUnit } from '@/domain/growthCurve/types';
import type { GrowthMetric } from '@/types/growth';

// ────────────────────────────── 常量 ──────────────────────────────

/** 各分位线颜色（与 RN 版保持一致） */
export const SERIES_COLORS: Record<string, string> = {
  p97: 'rgba(229, 115, 115, 0.7)',
  p85: 'rgba(255, 183, 77, 0.7)',
  p50: 'rgba(107, 154, 196, 1)',
  p15: 'rgba(129, 199, 132, 0.7)',
  p3: 'rgba(229, 115, 115, 0.7)',
  user: 'rgba(255, 107, 107, 1)',
};

/** 指标中文名 */
export const METRIC_META: Record<GrowthMetric, { label: string; unit: string }> = {
  weight: { label: '体重', unit: 'kg' },
  height: { label: '身高', unit: 'cm' },
  head: { label: '头围', unit: 'cm' },
};

/** 图例名称 */
const LEGEND_NAMES: Record<string, string> = {
  p97: 'P97',
  p85: 'P85',
  p50: 'P50',
  p15: 'P15',
  p3: 'P3',
  user: '用户',
};

// ────────────────────────────── 工具 ──────────────────────────────

/**
 * 构建稀疏的 x 轴标签数组
 * 数据点过多时只显示部分标签避免拥挤
 */
export function buildSparseLabels(
  xValues: number[],
  unit: AxisUnit = 'month',
  maxVisible: number = 8,
): string[] {
  if (xValues.length === 0) return [];

  if (xValues.length <= maxVisible) {
    return xValues.map((x) => formatAge(x, unit));
  }

  const step = Math.max(1, Math.floor(xValues.length / maxVisible));
  return xValues.map((x, i) => (i % step === 0 ? formatAge(x, unit) : ''));
}

function formatAge(x: number, unit: AxisUnit): string {
  if (unit === 'week') return `${Math.round(x)}w`;
  return `${Math.round(x)}m`;
}

// ────────────────────────────── 主构建函数 ──────────────────────────────

/**
 * 将 GrowthCurveModel 转换为 ECharts 图表配置
 *
 * 为每条分位线（P3 / P15 / P50 / P85 / P97）和用户数据线生成 series，
 * 同时配置坐标轴、图例、tooltip、dataZoom 等。
 *
 * @param model           - 领域引擎输出的完整曲线模型
 * @param legendSelected  - 各系列显隐状态（key: 系列名, value: 是否显示）
 * @param metric          - 当前指标
 * @returns               - ECharts option
 */
export function buildChartOption(
  model: GrowthCurveModel,
  legendSelected: Record<string, boolean>,
  metric: GrowthMetric,
): EChartsOption {
  const { axis, standardPoints, userPoints, meta } = model;
  const metricInfo = METRIC_META[metric];
  const unit = meta.axisUnit;

  // ── 系列数据 ──

  const series: any[] = [];
  const percentileKeys = ['p3', 'p15', 'p50', 'p85', 'p97'] as const;

  for (const key of percentileKeys) {
    const isMedian = key === 'p50';
    series.push({
      name: LEGEND_NAMES[key],
      type: 'line',
      data: standardPoints.map((p) => [p.x, p[key]]),
      smooth: true,
      symbol: 'none',
      lineStyle: {
        width: isMedian ? 2.5 : 1.5,
        color: SERIES_COLORS[key],
        type: isMedian ? 'solid' as const : 'dashed' as const,
      },
      itemStyle: { color: SERIES_COLORS[key] },
      // 禁用渐进渲染（微信小程序 Canvas 2D 不支持）
      progressive: 0,
    });
  }

  // 用户数据线
  if (userPoints.length > 0) {
    const lastPoint = userPoints[userPoints.length - 1];
    series.push({
      name: LEGEND_NAMES.user,
      type: 'line',
      data: userPoints.map((p) => [p.x, p.value]),
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        width: 2.5,
        color: SERIES_COLORS.user,
      },
      itemStyle: {
        color: SERIES_COLORS.user,
        borderColor: '#fff',
        borderWidth: 1,
      },
      // 标记最近的数据点（使用显式坐标而非 type: 'max'）
      markPoint: {
        data: [
          {
            coord: [lastPoint.x, lastPoint.value],
            name: '最新',
            symbol: 'pin',
            symbolSize: 35,
            label: { show: false },
          },
        ],
      },
      progressive: 0,
    });
  }

  // ── ECharts Option ──

  const option: EChartsOption = {
    color: Object.values(SERIES_COLORS),
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params: any) => {
        if (!params || !Array.isArray(params)) return '';
        const lines = params
          .filter((p: any) => p.value !== null && p.value !== undefined)
          .map((p: any) => {
            const val = Array.isArray(p.value) ? p.value[1] : p.value;
            return `${p.marker} ${p.seriesName}: ${Number(val).toFixed(2)} ${metricInfo.unit}`;
          });
        if (lines.length === 0) return '';
        const xVal = Array.isArray(params[0].value)
          ? Number(params[0].value[0]).toFixed(1)
          : '';
        const xUnit = unit === 'week' ? '周' : '月';
        return `<strong>${xVal} ${xUnit}</strong><br/>${lines.join('<br/>')}`;
      },
    },
    legend: {
      data: Object.values(LEGEND_NAMES),
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 8,
      textStyle: {
        fontSize: 11,
        color: '#4A4A4A',
      },
    },
    grid: {
      left: 48,
      right: 16,
      top: 16,
      bottom: 48,
    },
    xAxis: {
      type: 'value',
      min: axis.xMin,
      max: axis.xMax,
      name: unit === 'week' ? '周龄 (周)' : '月龄 (月)',
      nameTextStyle: {
        fontSize: 11,
        color: '#7A7A7A',
      },
      axisLabel: {
        fontSize: 10,
        color: '#7A7A7A',
        formatter: (val: number) => {
          return unit === 'week' ? `${Math.round(val)}w` : `${Math.round(val)}m`;
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(74, 74, 74, 0.06)',
        },
      },
    },
    yAxis: {
      type: 'value',
      min: axis.yMin,
      max: axis.yMax,
      name: metricInfo.unit,
      nameTextStyle: {
        fontSize: 11,
        color: '#7A7A7A',
      },
      axisLabel: {
        fontSize: 10,
        color: '#7A7A7A',
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(74, 74, 74, 0.06)',
        },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        minValueSpan: 1,
      },
    ],
    series,
  };

  return option;
}
