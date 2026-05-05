/**
 * GrowthRecordList 成长记录列表组件 (Taro/WeChat Mini-Program)
 *
 * 显示按指标分组的成长记录，支持编辑和删除操作。
 * 从 React Native 迁移：RN ScrollView → Taro ScrollView,
 * RN Modal + DateTimePicker → Modal + InlineDateTimePickerField,
 * RN Alert → confirm() from @/utils/feedback
 */

import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { InlineDateTimePickerField } from '@/components/ui/InlineDateTimePickerField';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { notify, confirm } from '@/utils/feedback';
import type { GrowthRecord, GrowthMetric } from '@/types/growth';
import './GrowthRecordList.scss';

// ────────────────────────────── Props ──────────────────────────────

export interface GrowthRecordListProps {
  records: GrowthRecord[];
  loading?: boolean;
  onUpdate?: (id: number, data: Partial<GrowthRecord>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onRefresh?: () => void;
}

// ────────────────────────────── 指标元信息 ──────────────────────────────

const METRIC_META: Record<GrowthMetric, { label: string; unit: string }> = {
  weight: { label: '体重', unit: 'kg' },
  height: { label: '身高', unit: 'cm' },
  head: { label: '头围', unit: 'cm' },
};

const METRICS: GrowthMetric[] = ['weight', 'height', 'head'];

// ────────────────────────────── 日期格式化 ──────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalNoonIso(date: Date): string {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized.toISOString();
}

// ────────────────────────────── 主组件 ──────────────────────────────

export const GrowthRecordList: React.FC<GrowthRecordListProps> = ({
  records,
  loading = false,
  onUpdate,
  onDelete,
  onRefresh,
}) => {
  // 编辑弹窗状态
  const [editingRecord, setEditingRecord] = useState<GrowthRecord | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);

  // ── 按指标分组，每组按日期降序 ──
  const groupedRecords = React.useMemo(() => {
    const groups: Record<GrowthMetric, GrowthRecord[]> = {
      weight: [],
      height: [],
      head: [],
    };
    records.forEach((r) => {
      groups[r.metric].push(r);
    });
    for (const key of METRICS) {
      groups[key].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
    }
    return groups;
  }, [records]);

  // ── 打开编辑弹窗 ──
  const handleEdit = (record: GrowthRecord) => {
    setEditingRecord(record);
    setEditValue(String(record.value));
    setEditNote(record.note || '');
    setEditDate(new Date(record.recordedAt));
    setEditModalVisible(true);
  };

  // ── 删除确认 → 执行删除 ──
  const handleDelete = async (record: GrowthRecord) => {
    const ok = await confirm(
      `确定要删除这条${METRIC_META[record.metric].label}记录吗？`,
      '删除记录',
    );
    if (!ok) return;
    await onDelete?.(record.id);
  };

  // ── 提交编辑 ──
  const handleSubmitEdit = async () => {
    if (!editingRecord || !onUpdate) return;

    const numValue = parseFloat(editValue);
    if (isNaN(numValue) || numValue <= 0) {
      notify('请输入有效的数值');
      return;
    }

    setSubmitting(true);
    try {
      await onUpdate(editingRecord.id, {
        value: numValue,
        note: editNote.trim() || undefined,
        recordedAt: toLocalNoonIso(editDate),
      });
      setEditModalVisible(false);
      setEditingRecord(null);
      setEditValue('');
      setEditNote('');
    } catch {
      notify('更新记录失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 渲染 ──
  return (
    <View className="grl">
      {/* ════ 头部 ════ */}
      <View className="grl__header">
        <Text className="grl__title">成长记录</Text>
        {onRefresh && (
          <View
            className="grl__refresh-btn"
            onClick={onRefresh}
            hoverClass="grl__refresh-btn--pressed"
          >
            <Text className="grl__refresh-text">
              {loading ? '加载中...' : '刷新'}
            </Text>
          </View>
        )}
      </View>

      {/* ════ 加载中 ════ */}
      {loading && (
        <View className="grl__center">
          <View className="grl__spinner" />
          <Text className="grl__loading-text">加载记录...</Text>
        </View>
      )}

      {/* ════ 空状态 ════ */}
      {!loading && records.length === 0 && (
        <View className="grl__center">
          <Text className="grl__empty-icon">{'\u{1F4CB}'}</Text>
          <Text className="grl__empty-text">暂无成长记录</Text>
          <Text className="grl__empty-hint">
            点击下方"添加记录"开始记录宝宝成长
          </Text>
        </View>
      )}

      {/* ════ 记录列表 ════ */}
      {!loading && records.length > 0 && (
        <ScrollView className="grl__scroll" scrollY>
          {METRICS.map((metric) => {
            const metricRecords = groupedRecords[metric];
            if (metricRecords.length === 0) return null;

            return (
              <View key={metric} className="grl__section">
                <View className="grl__section-header">
                  <Text className="grl__section-title">
                    {METRIC_META[metric].label} ({metricRecords.length}条)
                  </Text>
                </View>

                {metricRecords.map((record) => (
                  <View key={record.id} className="grl__card">
                    <View className="grl__card-main">
                      <View className="grl__card-info">
                        <View className="grl__card-value-row">
                          <Text className="grl__card-value">
                            {record.value}
                            <Text className="grl__card-unit">
                              {' '}
                              {METRIC_META[metric].unit}
                            </Text>
                          </Text>
                          <Text className="grl__card-date">
                            {formatDate(record.recordedAt)}
                          </Text>
                        </View>
                        {record.note && (
                          <Text className="grl__card-note">{record.note}</Text>
                        )}
                      </View>

                      <View className="grl__card-actions">
                        <View
                          className="grl__action-btn"
                          onClick={() => handleEdit(record)}
                          hoverClass="grl__action-btn--pressed"
                        >
                          <Text className="grl__action-btn-text">编辑</Text>
                        </View>
                        <View
                          className="grl__action-btn grl__action-btn--delete"
                          onClick={() => handleDelete(record)}
                          hoverClass="grl__action-btn--pressed"
                        >
                          <Text className="grl__action-btn-text grl__action-btn-text--delete">
                            删除
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ════ 编辑弹窗 ════ */}
      <Modal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title={`编辑${editingRecord ? METRIC_META[editingRecord.metric].label : ''}记录`}
        height="auto"
      >
        <View className="grl__edit-form">
          <Input
            label={editingRecord ? METRIC_META[editingRecord.metric].label : '数值'}
            value={editValue}
            onInput={(e) => setEditValue(e.detail.value)}
            placeholder="请输入数值"
            type="digit"
          />

          <View className="grl__edit-date-row">
            <Text className="grl__edit-label">记录日期</Text>
            <InlineDateTimePickerField
              buttonTitle={formatDate(editDate.toISOString())}
              mode="date"
              value={editDate}
              maximumDate={new Date()}
              onConfirm={(selected) => {
                const next = new Date(editDate);
                next.setFullYear(
                  selected.getFullYear(),
                  selected.getMonth(),
                  selected.getDate(),
                );
                setEditDate(next);
              }}
            />
          </View>

          <Input
            label="备注"
            value={editNote}
            onInput={(e) => setEditNote(e.detail.value)}
            placeholder="备注信息（选填）"
          />

          <View className="grl__edit-actions">
            <OrganicButton
              title="取消"
              variant="ghost"
              onPress={() => setEditModalVisible(false)}
              size="medium"
            />
            <OrganicButton
              title="保存"
              onPress={handleSubmitEdit}
              loading={submitting}
              disabled={submitting}
              size="medium"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default GrowthRecordList;
