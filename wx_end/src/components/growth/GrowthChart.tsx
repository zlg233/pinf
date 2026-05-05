/**
 * GrowthChart 成长曲线图表（精简封装）
 *
 * 对 GrowthChartView 的简单封装，提供一致的 API 入口。
 * 可直接在页面中作为独立组件使用。
 */

import React from 'react';
import { GrowthChartView, type GrowthChartViewProps } from './GrowthChartView';

export const GrowthChart: React.FC<GrowthChartViewProps> = (props) => {
  return <GrowthChartView {...props} />;
};

export type { GrowthChartViewProps } from './GrowthChartView';
