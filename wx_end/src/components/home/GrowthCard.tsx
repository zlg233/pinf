import React, { useMemo, useState } from 'react';
import { View, Text } from '@tarojs/components';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { Button } from '@/components/ui/Button';
import type { GrowthRecord, GrowthMetric } from '@/types/growth';
import './GrowthCard.scss';

interface GrowthCardProps {
  records: GrowthRecord[];
  loading?: boolean;
  error?: string | null;
  onAdd: () => void;
  onRefresh?: () => void;
}

const metricMeta: Record<GrowthMetric, { label: string; unit: string }> = {
  weight: { label: '体重', unit: 'kg' },
  height: { label: '身高', unit: 'cm' },
  head: { label: '头围', unit: 'cm' },
};

const MAX_BARS = 6;

const GrowthCard: React.FC<GrowthCardProps> = ({ records, loading, error, onAdd, onRefresh }) => {
  const [metric, setMetric] = useState<GrowthMetric>('weight');

  const filtered = useMemo(() => {
    const list = records
      .filter((item) => item.metric === metric)
      .sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );
    return list.slice(-MAX_BARS);
  }, [metric, records]);

  const chartData = useMemo(() => {
    if (filtered.length === 0) return [];
    const values = filtered.map((r) => r.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    return filtered.map((item) => {
      const barHeight = ((item.value - min) / range) * 0.8 + 0.2;
      const date = new Date(item.recordedAt);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      return {
        height: barHeight,
        value: item.value,
        label,
      };
    });
  }, [filtered]);

  const renderChart = () => {
    if (loading) {
      return (
        <View className="growth-card__center-box">
          <Text className="growth-card__loading-text">加载中...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="growth-card__center-box">
          <Text className="growth-card__error-text">{error}</Text>
          {onRefresh && (
            <View onClick={onRefresh}>
              <Text className="growth-card__retry">重试</Text>
            </View>
          )}
        </View>
      );
    }

    if (filtered.length === 0) {
      return (
        <View className="growth-card__center-box">
          <Text className="growth-card__muted-text">暂无该指标的记录</Text>
          <Button title="添加记录" onPress={onAdd} size="small" variant="primary" />
        </View>
      );
    }

    return (
      <View className="growth-card__chart-area">
        <View className="growth-card__grid-line growth-card__grid-line--top" />
        <View className="growth-card__grid-line growth-card__grid-line--middle" />
        <View className="growth-card__grid-line growth-card__grid-line--bottom" />

        <View className="growth-card__bars">
          {chartData.map((point, index) => (
            <View key={index} className="growth-card__bar-wrapper">
              <View
                className="growth-card__bar"
                style={{ height: `${point.height * 100}%` }}
              />
              <Text className="growth-card__bar-label">{point.label}</Text>
            </View>
          ))}
        </View>

        <View className="growth-card__legend">
          <Text className="growth-card__legend-text">
            {metricMeta[metric].label}（{metricMeta[metric].unit}）
          </Text>
          <Text className="growth-card__legend-text">最近 {filtered.length} 条</Text>
        </View>
      </View>
    );
  };

  return (
    <OrganicCard variant="default" shadow={false}>
      <View className="growth-card__header">
        <Text className="growth-card__title">成长记录</Text>
        <View className="growth-card__metric-switch">
          {(Object.keys(metricMeta) as GrowthMetric[]).map((key) => {
            const active = metric === key;
            const chipClass = [
              'growth-card__metric-chip',
              active ? 'growth-card__metric-chip--active' : '',
            ]
              .filter(Boolean)
              .join(' ');
            const textClass = [
              'growth-card__metric-chip-text',
              active ? 'growth-card__metric-chip-text--active' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <View
                key={key}
                className={chipClass}
                onClick={() => setMetric(key)}
              >
                <Text className={textClass}>{metricMeta[key].label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {renderChart()}

      <View className="growth-card__footer">
        <Button title="添加记录" onPress={onAdd} variant="primary" size="medium" />
      </View>
    </OrganicCard>
  );
};

export default GrowthCard;
