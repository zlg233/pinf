/**
 * GrowthChartView 成长曲线图表视图
 *
 * 完整的成长曲线展示面板，包含：
 * - 指标切换、标准/范围/月龄模式控制
 * - 评估卡片、诊断卡片
 * - ECharts 折线图（分位线 + 用户数据）
 * - 图例切换、数据点 tooltip
 * - 记录面板、帮助指南、全屏视图
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { EcCanvas } from '@/components/ui/ec-canvas';
import { Modal } from '@/components/ui/Modal';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { buildGrowthCurveModel } from '@/domain/growthCurve/engine';
import { buildChartOption, SERIES_COLORS, METRIC_META } from './chartOptions';
import type { GrowthMetric } from '@/types/growth';
import type { GrowthRecord } from '@/types/growth';
import type { Baby } from '@/types/baby';
import type { AgeType, StandardMode, RangeMode, ChartStandard } from '@/domain/growthCurve/types';
import './GrowthChartView.scss';

// ────────────────────────────── Props ──────────────────────────────

export interface GrowthChartViewProps {
  baby: Baby;
  metric: GrowthMetric;
  records: GrowthRecord[];
  ageType: AgeType;
  onMetricChange: (metric: GrowthMetric) => void;
  onAgeTypeChange?: (ageType: AgeType) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

// ────────────────────────────── 图例配置 ──────────────────────────────

const LEGEND_KEYS = ['p97', 'p85', 'p50', 'p15', 'p3', 'user'] as const;
type LegendKey = (typeof LEGEND_KEYS)[number];

const LEGEND_LABELS: Record<LegendKey, string> = {
  p97: 'P97',
  p85: 'P85',
  p50: 'P50',
  p15: 'P15',
  p3: 'P3',
  user: '用户',
};

const LEGEND_DOT_COLORS: Record<LegendKey, string> = {
  p97: SERIES_COLORS.p97,
  p85: SERIES_COLORS.p85,
  p50: SERIES_COLORS.p50,
  p15: SERIES_COLORS.p15,
  p3: SERIES_COLORS.p3,
  user: SERIES_COLORS.user,
};

// ────────────────────────────── Trend 箭头映射 ──────────────────────────────

const TREND_ARROWS: Record<string, string> = {
  '上升': '\u2191',
  '下降': '\u2193',
  '平稳': '\u2192',
  '数据不足': '-',
  '记录较少': '-',
  '当前标准下无有效点': '-',
};

// Chinese zone/trend → English CSS class suffix
const ZONE_CLASS: Record<string, string> = {
  '正常': 'normal',
  '偏高': 'high',
  '偏低': 'low',
};
const TREND_CLASS: Record<string, string> = {
  '上升': 'up',
  '下降': 'down',
  '平稳': 'stable',
};

// ────────────────────────────── 主组件 ──────────────────────────────

export const GrowthChartView: React.FC<GrowthChartViewProps> = ({
  baby,
  metric,
  records,
  ageType,
  onMetricChange,
  onAgeTypeChange,
  onRefresh,
  loading = false,
}) => {
  // ── 内部状态 ──
  const [standardMode, setStandardMode] = useState<StandardMode>('auto');
  const [manualStandard, setManualStandard] = useState<ChartStandard>('WHO');
  const [rangeMode, setRangeMode] = useState<RangeMode>('smart');
  const [legendSelected, setLegendSelected] = useState<Record<string, boolean>>({
    p97: true,
    p85: true,
    p50: true,
    p15: true,
    p3: true,
    user: true,
  });
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [chartKey, setChartKey] = useState(0);
  const chartInstanceRef = useRef<any>(null);
  const { windowWidth, windowHeight } = Taro.getWindowInfo();

  // ── 从 records 中过滤出当前 metric 的数据 ──
  const metricRecords = useMemo(
    () => records.filter((r) => r.metric === metric),
    [records, metric],
  );

  // ── 计算 GrowthCurveModel ──
  const model = useMemo(() => {
    if (!baby || records.length === 0) return null;
    try {
      return buildGrowthCurveModel({
        baby,
        metric,
        records,
        ageType,
        rangeMode,
        standardMode,
        manualStandard: standardMode === 'manual' ? manualStandard : undefined,
      });
    } catch (e) {
      console.error('[GrowthChartView] buildGrowthCurveModel error:', e);
      return null;
    }
  }, [baby, records, metric, ageType, rangeMode, standardMode, manualStandard]);

  // ── ECharts Option ──
  const chartOption = useMemo(() => {
    if (!model) return null;
    return buildChartOption(model, legendSelected, metric);
  }, [model, legendSelected, metric]);

  // ── 是否早产 & 显示矫正月龄切换（无回调时不显示按钮） ──
  const showAgeTypeSwitch =
    model?.meta.isPremature && model?.meta.standard === 'WHO' && !!onAgeTypeChange;

  // ── 是否 FENTON 标准 → 显示诊断卡片 ──
  const isFenton = model?.meta.standard === 'FENTON';

  // ── 当前指标 meta ──
  const metricMeta = METRIC_META[metric];

  // ── 记录面板数据：当前窗口中用户数据点 ──
  const recordPanelItems = useMemo(() => {
    if (!model) return [];
    const xMin = model.axis.xMin;
    const xMax = model.axis.xMax;
    const unit = model.meta.axisUnit;

    return model.userPoints
      .filter((p) => p.x >= xMin && p.x <= xMax)
      .map((p) => {
        const record = metricRecords.find(
          (r) => r.recordedAt === p.recordedAt,
        );
        const dateStr = record
          ? new Date(record.recordedAt).toLocaleDateString('zh-CN')
          : '';
        const ageLabel =
          unit === 'week' ? `${Math.round(p.x)}周` : `${p.x.toFixed(1)}月`;
        return {
          date: dateStr,
          age: ageLabel,
          value: p.value,
          unit: metricMeta.unit,
          recordedAt: p.recordedAt,
        };
      })
      .reverse(); // 最新在前
  }, [model, metricRecords, metricMeta.unit]);

  // ── 事件处理 ──

  const handleChartInit = useCallback((chart: any) => {
    chartInstanceRef.current = chart;

    // ECharts 图例变化时同步 React 状态
    chart.on('legendselectchanged', (params: any) => {
      const selected = params.selected as Record<string, boolean> | undefined;
      if (!selected) return;
      const newSelected: Record<string, boolean> = {};
      for (const key of LEGEND_KEYS) {
        const label = LEGEND_LABELS[key];
        newSelected[key] = label in selected ? selected[label] : true;
      }
      setLegendSelected(newSelected);
    });
  }, []);

  const handleMetricChange = useCallback(
    (m: GrowthMetric) => {
      onMetricChange(m);
      setTooltipText(null);
    },
    [onMetricChange],
  );

  const handleAgeTypeToggle = useCallback(() => {
    const next: AgeType = ageType === 'actual' ? 'corrected' : 'actual';
    if (onAgeTypeChange) {
      onAgeTypeChange(next);
    } else {
      // 父组件未提供回调时，不改变（保持 controlled）
    }
  }, [ageType, onAgeTypeChange]);

  const handleLegendToggle = useCallback((key: string) => {
    // 通过 ECharts dispatchAction 切换图例，保持 ECharts 为唯一状态源
    const chart = chartInstanceRef.current;
    if (chart) {
      chart.dispatchAction({
        type: 'legendToggleSelect',
        name: LEGEND_LABELS[key],
      });
    } else {
      // 回退：直接更新 React 状态（图表尚未初始化时）
      setLegendSelected((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  }, []);

  const handleChartClick = useCallback((params: any) => {
    if (!params || !params.value) return;
    const xVal = Array.isArray(params.value)
      ? Number(params.value[0]).toFixed(1)
      : '';
    const yVal = Array.isArray(params.value)
      ? Number(params.value[1]).toFixed(2)
      : Number(params.value).toFixed(2);
    const seriesName = params.seriesName || '';
    const xUnit = model?.meta.axisUnit === 'week' ? '周' : '月';
    setTooltipText(
      `${seriesName}: ${yVal} ${metricMeta.unit} (${xVal} ${xUnit})`,
    );
  }, [model, metricMeta.unit]);

  const handleRefresh = useCallback(() => {
    setChartKey((k) => k + 1);
    onRefresh?.();
  }, [onRefresh]);

  const handleZoomIn = useCallback(() => {
    setFullscreenZoom((z) => Math.min(z + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setFullscreenZoom((z) => Math.max(z - 0.25, 0.5));
  }, []);

  // ── 无数据空状态 ──
  if (!baby) {
    return (
      <View className="growth-chart__empty">
        <Text className="growth-chart__empty-icon">{'\u{1F476}'}</Text>
        <Text className="growth-chart__empty-text">请先选择宝宝</Text>
        <Text className="growth-chart__empty-sub">
          在首页选择宝宝后查看成长曲线
        </Text>
      </View>
    );
  }

  // ── 渲染 ──

  return (
    <ScrollView className="growth-chart" scrollY>
      {/* ════ Header ════ */}
      <View className="growth-chart__header">
        <Text className="growth-chart__title">成长曲线</Text>
        <View className="growth-chart__header-actions">
          {/* 帮助 */}
          <View
            className="growth-chart__header-btn"
            onClick={() => setGuideVisible(true)}
            hoverClass="growth-chart__header-btn--pressed"
          >
            <Text>\u2753</Text>
          </View>
          {/* 全屏 */}
          <View
            className="growth-chart__header-btn"
            onClick={() => setFullscreenVisible(true)}
            hoverClass="growth-chart__header-btn--pressed"
          >
            <Text>\u26F6</Text>
          </View>
          {/* 刷新 */}
          <View
            className={`growth-chart__header-btn${loading ? ' growth-chart__header-btn--loading' : ''}`}
            onClick={handleRefresh}
            hoverClass="growth-chart__header-btn--pressed"
          >
            <Text>\u21BB</Text>
          </View>
        </View>
      </View>

      {/* ════ 指标切换 ════ */}
      <View className="growth-chart__metric-row">
        {(['weight', 'height', 'head'] as GrowthMetric[]).map((m) => (
          <View
            key={m}
            className={`growth-chart__metric-chip${metric === m ? ' growth-chart__metric-chip--active' : ''}`}
            onClick={() => handleMetricChange(m)}
            hoverClass="growth-chart__metric-chip--pressed"
          >
            <Text>{METRIC_META[m].label}</Text>
          </View>
        ))}
      </View>

      {/* ════ 模式控制 ════ */}
      <View className="growth-chart__mode-row">
        {/* 标准模式切换 */}
        <View className="growth-chart__mode-toggle">
          {(['auto', 'manual'] as StandardMode[]).map((mode) => (
            <View
              key={mode}
              className={`growth-chart__mode-toggle-btn${standardMode === mode ? ' growth-chart__mode-toggle-btn--active' : ''}`}
              onClick={() => setStandardMode(mode)}
            >
              <Text>{mode === 'auto' ? '自动' : '手动'}</Text>
            </View>
          ))}
        </View>

        {/* 手动模式下的标准选择 */}
        {standardMode === 'manual' && (
          <View className="growth-chart__mode-selector">
            {(['WHO', 'FENTON'] as ChartStandard[]).map((std) => (
              <View
                key={std}
                className={`growth-chart__mode-opt${manualStandard === std ? ' growth-chart__mode-opt--active' : ''}`}
                onClick={() => setManualStandard(std)}
              >
                <Text>{std}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 范围模式 */}
        <View className="growth-chart__mode-toggle">
          {(['smart', 'full'] as RangeMode[]).map((mode) => (
            <View
              key={mode}
              className={`growth-chart__mode-toggle-btn${rangeMode === mode ? ' growth-chart__mode-toggle-btn--active' : ''}`}
              onClick={() => setRangeMode(mode)}
            >
              <Text>{mode === 'smart' ? '自适应' : '全部'}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ════ 月龄类型切换（仅早产 + WHO） ════ */}
      {showAgeTypeSwitch && (
        <View className="growth-chart__age-type-row">
          {(['actual', 'corrected'] as AgeType[]).map((at) => (
            <View
              key={at}
              className={`growth-chart__age-btn${ageType === at ? ' growth-chart__age-btn--active' : ''}`}
              onClick={handleAgeTypeToggle}
            >
              <Text>{at === 'actual' ? '实际月龄' : '矫正月龄'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ════ 说明文字 ════ */}
      {model?.meta.description && (
        <View className="growth-chart__meta">
          <Text className="growth-chart__meta-text">
            {model.meta.description}
          </Text>
        </View>
      )}

      {/* ════ 评估卡片 ════ */}
      {model?.assessment && (
        <OrganicCard variant="gradient" style={{ margin: '0 16px 12px' }}>
          <Text className="growth-chart__assessment-title">
            {metricMeta.label}评估
          </Text>
          <View className="growth-chart__assessment-body">
            {model.assessment.latestPercentile !== null ? (
              <>
                <Text className="growth-chart__assessment-percentile">
                  P{Math.round(model.assessment.latestPercentile)}
                </Text>
                <Text
                  className={`growth-chart__assessment-zone growth-chart__assessment-zone--${ZONE_CLASS[model.assessment.zone || '正常'] || ''}`}
                >
                  {model.assessment.zone || '--'}
                </Text>
              </>
            ) : (
              <Text className="growth-chart__assessment-percentile">--</Text>
            )}
            <Text
              className={`growth-chart__assessment-trend growth-chart__assessment-trend--${TREND_CLASS[model.assessment.trend] || ''}`}
            >
              {TREND_ARROWS[model.assessment.trend] || ''}{' '}
              {model.assessment.trend}
            </Text>
          </View>
        </OrganicCard>
      )}

      {/* ════ 诊断卡片（Fenton） ════ */}
      {isFenton && model?.assessment.diagnostic && (
        <OrganicCard variant="ghost" style={{ margin: '0 16px 12px' }}>
          <Text className="growth-chart__diagnostic-title">
            Fenton 诊断信息
          </Text>
          <View className="growth-chart__diagnostic-items">
            <Text className="growth-chart__diagnostic-item">
              记录总数: {model.assessment.diagnostic.totalRecords}
            </Text>
            <Text className="growth-chart__diagnostic-item">
              有效Fenton点: {model.assessment.diagnostic.validFentonPoints}
            </Text>
            {model.assessment.diagnostic.outOfRangePoints > 0 && (
              <Text className="growth-chart__diagnostic-item">
                超范围: {model.assessment.diagnostic.outOfRangePoints}
              </Text>
            )}
            {model.assessment.diagnostic.missingPMAPoints > 0 && (
              <Text className="growth-chart__diagnostic-item">
                缺PMA: {model.assessment.diagnostic.missingPMAPoints}
              </Text>
            )}
          </View>
        </OrganicCard>
      )}

      {/* ════ 图表区域 ════ */}
      <View className="growth-chart__chart-area">
        {metricRecords.length === 0 ? (
          <View className="growth-chart__empty" style={{ height: 280 }}>
            <Text className="growth-chart__empty-icon">{'\u{1F4CA}'}</Text>
            <Text className="growth-chart__empty-text">暂无{metricMeta.label}数据</Text>
            <Text className="growth-chart__empty-sub">
              记录{metricMeta.label}数据后即可查看成长曲线
            </Text>
          </View>
        ) : (
          <EcCanvas
            key={chartKey}
            option={chartOption}
            width={windowWidth - 32}
            height={280}
            canvasId="growth-chart-ec"
            onClick={handleChartClick}
            onInit={handleChartInit}
          />
        )}
      </View>

      {/* ════ 图例 ════ */}
      <View className="growth-chart__legend">
        {LEGEND_KEYS.map((key) => (
          <View
            key={key}
            className={`growth-chart__legend-chip${legendSelected[key] ? ' growth-chart__legend-chip--active' : ''}`}
            onClick={() => handleLegendToggle(key)}
          >
            <View
              className="growth-chart__legend-dot"
              style={{ backgroundColor: LEGEND_DOT_COLORS[key] }}
            />
            <Text>{LEGEND_LABELS[key]}</Text>
          </View>
        ))}
      </View>

      {/* ════ Tooltip 文本 ════ */}
      {tooltipText && (
        <View className="growth-chart__tooltip">
          <Text className="growth-chart__tooltip-text">{tooltipText}</Text>
        </View>
      )}

      {/* ════ 记录列表 ════ */}
      <OrganicCard variant="soft" style={{ margin: '0 16px' }}>
        <Text className="growth-chart__records-title">
          图表内记录 ({recordPanelItems.length})
        </Text>
        {recordPanelItems.length === 0 ? (
          <Text className="growth-chart__records-empty">
            当前图表范围内无记录
          </Text>
        ) : (
          recordPanelItems.map((item, idx) => (
            <View key={`${item.recordedAt}-${idx}`} className="growth-chart__record-item">
              <View className="growth-chart__record-info">
                <Text className="growth-chart__record-date">{item.date}</Text>
                <Text className="growth-chart__record-age">{item.age}</Text>
              </View>
              <Text className="growth-chart__record-value">
                {item.value} {item.unit}
              </Text>
            </View>
          ))
        )}
      </OrganicCard>

      {/* ════ 帮助指南 Modal ════ */}
      <Modal
        visible={guideVisible}
        onClose={() => setGuideVisible(false)}
        title="图表使用说明"
        height={420}
      >
        <View className="growth-chart__guide">
          <View className="growth-chart__guide-section">
            <Text className="growth-chart__guide-section-title">
              如何阅读成长曲线
            </Text>
            <Text className="growth-chart__guide-text">
              曲线图中的多条曲线代表不同百分位水平。实线为中位线(P50)，
              表示同龄儿童的平均水平。虚线为P3/P15/P85/P97分位线。
              您的宝宝数据以红色圆点连接线显示。
            </Text>
          </View>
          <View className="growth-chart__guide-section">
            <Text className="growth-chart__guide-section-title">
              分位线说明
            </Text>
            {(['p97', 'p85', 'p50', 'p15', 'p3'] as LegendKey[]).slice(0, 5).map((key) => (
              <View key={key} className="growth-chart__guide-legend">
                <View
                  className="growth-chart__guide-line"
                  style={{ backgroundColor: LEGEND_DOT_COLORS[key] }}
                />
                <Text className="growth-chart__guide-text">
                  {LEGEND_LABELS[key]}: {key === 'p50' ? '平均水平' : key === 'p97' ? '偏高' : key === 'p3' ? '偏低' : ''}
                </Text>
              </View>
            ))}
          </View>
          <View className="growth-chart__guide-section">
            <Text className="growth-chart__guide-section-title">
              操作提示
            </Text>
            <Text className="growth-chart__guide-text">
              - 点击数据点查看具体数值{'\n'}
              - 图例可切换显示/隐藏分位线{'\n'}
              - 全屏模式支持缩放查看{'\n'}
              - 自适应模式自动聚焦数据范围
            </Text>
          </View>
        </View>
      </Modal>

      {/* ════ 全屏图表 Modal ════ */}
      {fullscreenVisible && (
        <View className="growth-chart__fullscreen-overlay">
          <View className="growth-chart__fullscreen-header">
            <Text className="growth-chart__fullscreen-title">
              {metricMeta.label}成长曲线 - 全屏
            </Text>
            <View className="growth-chart__fullscreen-actions">
              <View
                className="growth-chart__zoom-btn"
                onClick={handleZoomOut}
              >
                <Text>-</Text>
              </View>
              <View
                className="growth-chart__zoom-btn"
                onClick={handleZoomIn}
              >
                <Text>+</Text>
              </View>
              <View
                className="growth-chart__zoom-btn"
                onClick={() => setFullscreenVisible(false)}
              >
                <Text>\u2716</Text>
              </View>
            </View>
          </View>
          <View className="growth-chart__fullscreen-chart">
            {chartOption ? (
              <ScrollView scrollX style={{ width: '100%' }}>
                <EcCanvas
                  option={chartOption}
                  width={(windowWidth - 32) * fullscreenZoom}
                  height={windowHeight - 120}
                  canvasId="growth-chart-fullscreen"
                  onClick={handleChartClick}
                  onInit={handleChartInit}
                />
              </ScrollView>
            ) : (
              <Text className="growth-chart__empty-text">暂无数据</Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default GrowthChartView;
