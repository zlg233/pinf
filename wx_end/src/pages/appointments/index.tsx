/**
 * 预约管理页面 (Taro/WeChat Mini-Program)
 *
 * 组装预约卡片和预约弹窗，按今天/近3天/后续/历史分组展示。
 * 从 React Native 迁移: expo-router useRouter → Taro.useRouter + Taro.navigateBack,
 * RN RefreshControl → ScrollView refresherEnabled,
 * RN IconSymbol → Unicode 文本符号,
 * RN useFeedback() → @/utils/feedback (confirm/notify),
 * RN StyleSheet → SCSS (BEM naming)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';

import AppointmentCard from '@/components/home/AppointmentCard';
import AppointmentModal from '@/components/home/AppointmentModal';
import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { OrganicButton } from '@/components/ui/OrganicButton';

import { useAppointmentStore } from '@/store/appointmentStore';
import { useBabyStore } from '@/store/babyStore';

import { confirm, notify } from '@/utils/feedback';
import { requestSubscribeMessage, subscribeMiniprogram } from '@/services/api/notifications';
import type { Appointment, CreateAppointmentInput, UpdateAppointmentInput } from '@/types/appointment';
import {
  formatAppointmentDateBadge,
  formatAppointmentDateTime,
  getAppointmentEffectiveStatus,
  getAppointmentUrgencyLabel,
  groupAppointments,
} from '@/utils/appointment';

import './index.scss';

const STATUS_META = {
  pending: { label: '待就诊', variant: 'accent' as const },
  completed: { label: '已就诊', variant: 'muted' as const },
  overdue: { label: '已过期', variant: 'primary' as const },
};

type SectionKey = 'today' | 'upcoming' | 'later' | 'past';

const SECTION_TITLE: Record<SectionKey, string> = {
  today: '今天的预约',
  upcoming: '近 3 天预约',
  later: '后续预约',
  past: '历史预约',
};

export default function AppointmentPage() {
  // ── Store ──
  const { appointments, fetch, remove, error, add, update, updateStatus, loading } = useAppointmentStore();
  const { currentBaby } = useBabyStore();

  // ── 内部状态 ──
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── 初始化数据加载 ──
  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  // ── 按当前宝宝过滤 ──
  const filtered = useMemo(() => {
    if (!currentBaby) return appointments;
    return appointments.filter((item) => item.baby?.id === currentBaby.id);
  }, [appointments, currentBaby]);

  // ── 按时间分组 ──
  const grouped = useMemo(() => groupAppointments(filtered, 3), [filtered]);

  // ── 事件处理 ──

  const handleGoBack = () => {
    Taro.navigateBack();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm('确定删除该预约吗？', '删除预约');
    if (!confirmed) return;

    try {
      await remove(id);
      notify('预约已删除');
    } catch {
      notify('删除失败，请重试');
    }
  };

  const handleOpenCreate = () => {
    setEditingAppointment(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item: Appointment) => {
    setEditingAppointment(item);
    setShowModal(true);
  };

  const handleMarkCompleted = async (item: Appointment) => {
    const confirmed = await confirm(
      `确认将"${item.clinic} / ${item.department}"更新为已就诊吗？`,
      '标记已就诊',
    );
    if (!confirmed) return;

    try {
      await updateStatus(item.id, 'completed');
      notify('预约已更新为已就诊');
    } catch {
      notify('状态更新失败，请重试');
    }
  };

  const handleSubmit = async (payload: {
    clinic: string;
    department: string;
    scheduledAt: string;
    remindAt?: string;
    note?: string;
  }) => {
    if (editingAppointment) {
      await update(editingAppointment.id, payload as UpdateAppointmentInput);
      notify('预约已更新');
    } else {
      await add({ ...payload, babyId: currentBaby?.id } as CreateAppointmentInput);
      notify('预约已创建');

      // 创建成功后请求订阅消息授权
      try {
        const tmplIds: string[] = []; // 替换为实际的模板 ID
        if (tmplIds.length > 0) {
          const authResult = await requestSubscribeMessage(tmplIds);
          const accepted = tmplIds.some((id) => authResult[id] === 'accept');
          if (accepted) {
            const openidRes = await Taro.getStorage({ key: 'user.openid' }).catch(() => ({ data: '' }));
            const openid = openidRes.data as string;
            if (openid && payload.remindAt) {
              await subscribeMiniprogram({
                appointment_id: 0, // 新创建的预约 ID 需从 store 获取
                openid,
                remind_time: payload.remindAt,
              }).catch(() => {});
            }
          }
        }
      } catch {
        // 用户拒绝授权，不强制
      }
    }

    setEditingAppointment(null);
    setShowModal(false);
  };

  // ── 渲染分组 ──
  const renderSection = (key: SectionKey, items: Appointment[]) => {
    if (!items.length) return null;

    return (
      <View className="page-appointments__section" key={key}>
        <View className="page-appointments__section-header">
          <Text className="page-appointments__section-title">{SECTION_TITLE[key]}</Text>
          <Text className="page-appointments__section-count">{items.length} 条</Text>
        </View>
        <View className="page-appointments__card-list">
          {items.map((item) => {
            const badge = formatAppointmentDateBadge(item.scheduledAt);
            const effectiveStatus = getAppointmentEffectiveStatus(item);
            const statusMeta = STATUS_META[effectiveStatus];
            const remindText = item.remindAt
              ? `提醒：${formatAppointmentDateTime(item.remindAt)}`
              : '未设置提醒';

            return (
              <OrganicCard key={item.id} shadow>
                <AppointmentCard
                  clinic={item.clinic}
                  department={item.department}
                  dateText={formatAppointmentDateTime(item.scheduledAt)}
                  dateDay={badge.day}
                  dateMonth={badge.month}
                  remindText={remindText}
                  statusLabel={statusMeta.label}
                  statusVariant={statusMeta.variant}
                  actionLabel={effectiveStatus === 'overdue' ? '调整预约时间' : '编辑预约'}
                  onAction={() => handleOpenEdit(item)}
                />
                <View className="page-appointments__card-meta">
                  <Text className="page-appointments__meta-text">
                    紧急程度：{getAppointmentUrgencyLabel(item.scheduledAt, 3)}
                  </Text>
                  {item.baby?.name ? (
                    <Text className="page-appointments__meta-text">宝宝：{item.baby.name}</Text>
                  ) : null}
                  {item.note ? (
                    <Text className="page-appointments__note-text">备注：{item.note}</Text>
                  ) : null}
                </View>
                <View className="page-appointments__action-row">
                  {effectiveStatus !== 'completed' ? (
                    <OrganicButton
                      title="标记已就诊"
                      variant={effectiveStatus === 'overdue' ? 'primary' : 'soft'}
                      size="small"
                      onPress={() => handleMarkCompleted(item)}
                    />
                  ) : null}
                  <OrganicButton
                    title="编辑"
                    variant="soft"
                    size="small"
                    onPress={() => handleOpenEdit(item)}
                  />
                  <OrganicButton
                    title="删除"
                    variant="ghost"
                    size="small"
                    onPress={() => handleDelete(item.id)}
                  />
                </View>
              </OrganicCard>
            );
          })}
        </View>
      </View>
    );
  };

  // ── 渲染 ──
  return (
    <OrganicBackground variant="morning">
      <View className="page-appointments">
        {/* ════ 头部 ════ */}
        <View className="page-appointments__header">
          <View
            className="page-appointments__back-btn"
            onClick={handleGoBack}
            hoverClass="page-appointments__back-btn--pressed"
          >
            <Text className="page-appointments__back-icon">{'\u2039'}</Text>
          </View>
          <Text className="page-appointments__title">预约 / 复诊</Text>
          <View className="page-appointments__placeholder" />
        </View>

        {/* ════ 内容区（含下拉刷新） ════ */}
        <ScrollView
          className="page-appointments__scroll"
          scrollY
          refresherEnabled
          refresherTriggered={isRefreshing}
          onRefresherRefresh={handleRefresh}
        >
          {/* ════ 概要统计卡片 ════ */}
          <OrganicCard shadow>
            <View className="page-appointments__summary-row">
              <View className="page-appointments__summary-item">
                <Text className="page-appointments__summary-label">今天</Text>
                <Text className="page-appointments__summary-value">{grouped.today.length}</Text>
              </View>
              <View className="page-appointments__summary-item">
                <Text className="page-appointments__summary-label">近 3 天</Text>
                <Text className="page-appointments__summary-value">{grouped.upcoming.length}</Text>
              </View>
              <View className="page-appointments__summary-item">
                <Text className="page-appointments__summary-label">全部</Text>
                <Text className="page-appointments__summary-value">{filtered.length}</Text>
              </View>
            </View>
            {currentBaby ? (
              <Text className="page-appointments__summary-hint">当前宝宝：{currentBaby.name}</Text>
            ) : (
              <Text className="page-appointments__summary-hint">当前显示全部预约</Text>
            )}
          </OrganicCard>

          {/* ════ 添加按钮 ════ */}
          <View
            className="page-appointments__add-btn"
            onClick={handleOpenCreate}
            hoverClass="page-appointments__add-btn--pressed"
          >
            <Text className="page-appointments__add-btn-text">+ 添加预约</Text>
          </View>

          {/* ════ 加载状态 ════ */}
          {loading && !filtered.length ? (
            <OrganicCard variant="ghost">
              <View className="page-appointments__empty-box">
                <Text className="page-appointments__loading-spinner">{'\u21BB'}</Text>
                <Text className="page-appointments__loading-text">加载中...</Text>
              </View>
            </OrganicCard>
          ) : null}

          {/* ════ 错误提示 ════ */}
          {error && !loading ? (
            <OrganicCard variant="soft">
              <View className="page-appointments__error-box">
                <Text className="page-appointments__error-text">{error}</Text>
              </View>
            </OrganicCard>
          ) : null}

          {/* ════ 分组列表（有数据时始终渲染，不影响下拉刷新） ════ */}
          {filtered.length > 0 ? (
            <>
              {renderSection('today', grouped.today)}
              {renderSection('upcoming', grouped.upcoming)}
              {renderSection('later', grouped.later)}
              {renderSection('past', grouped.past)}
            </>
          ) : null}

          {/* ════ 空状态（仅当无数据、非加载、无错误时） ════ */}
          {!loading && !filtered.length && !error ? (
            <OrganicCard variant="ghost">
              <View className="page-appointments__empty-box">
                <Text className="page-appointments__empty-icon">{'\u{1F4C6}'}</Text>
                <Text className="page-appointments__empty-text">暂无预约</Text>
                <Text className="page-appointments__empty-subtext">点击上方按钮添加复诊预约</Text>
              </View>
            </OrganicCard>
          ) : null}

          {/* 底部留白 */}
          <View className="page-appointments__bottom-spacer" />
        </ScrollView>

        {/* ════ 预约弹窗 ════ */}
        <AppointmentModal
          visible={showModal}
          onClose={() => {
            setEditingAppointment(null);
            setShowModal(false);
          }}
          onSubmit={handleSubmit}
          initialValues={editingAppointment ?? undefined}
          title={editingAppointment ? '编辑预约' : '添加预约'}
          submitText={editingAppointment ? '保存修改' : '保存预约'}
        />
      </View>
    </OrganicBackground>
  );
}
