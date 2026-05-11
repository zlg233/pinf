import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { Modal } from '@/components/ui/Modal';
import { BabyForm } from '@/components/ui/BabyForm';
import { FloatingActionButton } from '@/components/home/FloatingActionButton';
import { ActionGrid } from '@/components/home/ActionGrid';
import GrowthRecordModal from '@/components/home/GrowthRecordModal';
import AppointmentModal from '@/components/home/AppointmentModal';
import AppointmentInfoOnceModal from '@/components/home/AppointmentInfoOnceModal';

import { useBabyStore } from '@/store/babyStore';
import { useGrowthStore } from '@/store/growthStore';
import { useAppointmentStore } from '@/store/appointmentStore';
import { useAuthStore } from '@/store';
import { calculateBabyAge, formatDetailedAge } from '@/utils/ageCalculator';
import { formatAppointmentDateBadge, getAppointmentEffectiveStatus } from '@/utils/appointment';
import { notify } from '@/utils/feedback';
import type { CreateBabyInput, UpdateBabyInput } from '@/types/baby';

import './index.scss';

function getBgVariant(): 'morning' | 'sunset' | 'mint' | 'sky' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'sky';
  if (hour >= 18 && hour < 22) return 'sunset';
  return 'mint';
}

interface Greeting {
  text: string;
  subtext: string;
}

function getGreeting(): Greeting {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { text: '早上好', subtext: '又是陪伴宝宝成长的一天' };
  }
  if (hour >= 12 && hour < 14) {
    return { text: '中午好', subtext: '记得宝宝该午休了哦' };
  }
  if (hour >= 14 && hour < 18) {
    return { text: '下午好', subtext: '下午时光，陪伴宝宝玩耍' };
  }
  if (hour >= 18 && hour < 22) {
    return { text: '晚上好', subtext: '夜晚时光，给宝宝讲个故事' };
  }
  return { text: '夜深了', subtext: '注意休息，宝宝也需要睡眠' };
}

export default function Index() {
  // ========== Store Hooks ==========
  const {
    babies,
    currentBaby,
    fetchBabies,
    initialize,
    createBaby,
    updateBaby,
    selectBaby,
    isLoading: babyLoading,
    error: babyError,
  } = useBabyStore();

  const {
    records,
    fetch: fetchGrowth,
    add: addGrowth,
  } = useGrowthStore();

  const {
    appointments,
    loading: appointmentLoading,
    error: appointmentError,
    fetch: fetchAppointments,
    add: addAppointment,
  } = useAppointmentStore();

  const { isAuthenticated } = useAuthStore();

  // ========== Modal States ==========
  const [showBabyForm, setShowBabyForm] = useState(false);
  const [showBabyList, setShowBabyList] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingBabyId, setEditingBabyId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  // ========== Greeting ==========
  const [greeting, setGreeting] = useState<Greeting>(() => getGreeting());

  useEffect(() => {
    const timer = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // ========== Data Loading ==========
  useDidShow(() => {
    if (isAuthenticated) {
      initialize().catch(() => {});
      fetchAppointments().catch(() => {});
    }
  });

  useEffect(() => {
    if (currentBaby?.id) {
      fetchGrowth(currentBaby.id).catch(() => {});
    }
  }, [currentBaby?.id, fetchGrowth]);

  // ========== Analytics ==========
  const ageInfo = currentBaby ? calculateBabyAge(currentBaby) : null;
  const ageDisplay = ageInfo ? formatDetailedAge(ageInfo) : null;
  const currentGrowth = currentBaby?.id ? records[currentBaby.id] || [] : [];

  const filteredAppointments = useMemo(() => {
    const list = currentBaby
      ? appointments.filter((item) => item.baby?.id === currentBaby.id)
      : appointments;
    // 只展示待就诊的未来预约，按预约日期倒序（最近的排最前）
    return list
      .filter((item) => item.status !== 'completed' && item.status !== 'overdue')
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [appointments, currentBaby]);

  const editingBaby = editingBabyId
    ? babies.find((baby) => baby.id === editingBabyId)
    : undefined;

  // ========== Handlers ==========
  const handleCreateBaby = async (data: CreateBabyInput | UpdateBabyInput) => {
    try {
      await createBaby(data as CreateBabyInput);
      notify('宝宝信息已保存');
    } catch {
      notify('保存失败，请重试');
    }
  };

  const handleUpdateBaby = async (data: CreateBabyInput | UpdateBabyInput) => {
    if (!editingBabyId) return;
    try {
      await updateBaby(editingBabyId, data);
      notify('宝宝信息已更新');
    } catch {
      notify('更新失败，请重试');
    }
  };

  const handleAddGrowth = async (payloads: Parameters<typeof addGrowth>[1]) => {
    if (!currentBaby?.id) return;
    await addGrowth(currentBaby.id, payloads);
    setShowGrowthModal(false);
  };

  const handleAddAppointment = async (payload: any) => {
    await addAppointment({ ...payload, babyId: currentBaby?.id });
    setShowAppointmentModal(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchBabies();
      if (currentBaby?.id) {
        await fetchGrowth(currentBaby.id);
      }
      await fetchAppointments();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBabySwitcherPress = () => {
    setShowBabyList(true);
  };

  const handleOpenCreateForm = () => {
    setFormMode('create');
    setEditingBabyId(null);
    setShowBabyForm(true);
  };

  const handleRequestCreateBaby = () => {
    setShowBabyList(false);
    setTimeout(() => {
      handleOpenCreateForm();
    }, 300);
  };

  // ========== Action Items ==========
  const actionItems = [
    {
      id: 'growth',
      title: '成长曲线',
      icon: '📈',
      onClick: () => Taro.navigateTo({ url: '/pages/growth/index' }),
    },
    {
      id: 'qa',
      title: 'AI 问答',
      icon: '💬',
      onClick: () => Taro.navigateTo({ url: '/pages/qa/index' }),
    },
    {
      id: 'appointment',
      title: '添加预约',
      icon: '📅',
      onClick: () => setShowAppointmentModal(true),
    },
    {
      id: 'classroom',
      title: '内容课堂',
      icon: '📚',
      onClick: () => Taro.switchTab({ url: '/pages/classroom/index' }),
    },
  ];

  // ========== Render ==========
  return (
    <OrganicBackground variant={getBgVariant()}>
      <ScrollView
        scrollY
        className="index__scroll"
        refresherEnabled
        refresherTriggered={isRefreshing}
        onRefresherRefresh={handleRefresh}
      >
        <View className="index__scroll-inner">
        {/* Greeting Section */}
        <View className="index__greeting">
          <Text className="index__greeting-text">{greeting.text}</Text>
          <Text className="index__greeting-subtext">{greeting.subtext}</Text>
        </View>

        {/* Baby Card or Loading/Error/Add */}
        {babyLoading && !isRefreshing ? (
          <View className="index__loading-container">
            <Text className="index__loading-text">加载中...</Text>
          </View>
        ) : babyError ? (
          <OrganicCard variant="soft" style={{ marginBottom: '20px' }}>
            <Text className="index__error-text">{babyError}</Text>
            <View onClick={() => fetchBabies()}>
              <Text className="index__retry-text">重试</Text>
            </View>
          </OrganicCard>
        ) : currentBaby && ageDisplay ? (
          <OrganicCard shadow style={{ marginBottom: '20px' }} onPress={handleBabySwitcherPress}>
            <View className="index__baby-card">
              <View className="index__baby-info">
                <View className="index__baby-avatar">
                  <Text className="index__baby-avatar-text">
                    {currentBaby.name.charAt(0)}
                  </Text>
                </View>
                <View className="index__baby-details">
                  <Text className="index__baby-name">{currentBaby.name}</Text>
                  <Text className="index__baby-age">{ageDisplay.mainText}</Text>
                  {ageDisplay.detailText && (
                    <Text className="index__baby-meta">{ageDisplay.detailText}</Text>
                  )}
                </View>
              </View>
              <View className="index__switch-indicator">
                <Text className="index__switch-text">管理</Text>
                <Text className="index__switch-arrow">{'>'}</Text>
              </View>
            </View>

            {ageDisplay.badges && ageDisplay.badges.length > 0 && (
              <View className="index__badges-container">
                {ageDisplay.badges.map((badge, index) => (
                  <View key={index} className="index__badge">
                    <Text className="index__badge-text">{badge.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </OrganicCard>
        ) : (
          <OrganicCard shadow style={{ marginBottom: '20px' }} onPress={handleOpenCreateForm}>
            <View className="index__add-baby-content">
              <View className="index__add-baby-icon">
                <Text className="index__add-baby-icon-text">+</Text>
              </View>
              <View className="index__add-baby-text">
                <Text className="index__add-baby-title">添加宝宝</Text>
                <Text className="index__add-baby-subtitle">开始记录美好时光</Text>
              </View>
            </View>
          </OrganicCard>
        )}

        {/* Action Grid */}
        <View className="index__section-header">
          <Text className="index__section-title">快捷入口</Text>
        </View>
        <ActionGrid items={actionItems} />

        {/* Recent Appointments */}
        <View className="index__section-header" style={{ marginTop: '16px' }}>
          <Text className="index__section-title">近期预约</Text>
          <View
            onClick={() => Taro.navigateTo({ url: '/pages/appointments/index' })}
            hoverClass="index__section-link--pressed"
          >
            <Text className="index__section-link">查看更多 ›</Text>
          </View>
        </View>

        {appointmentLoading ? (
          <View className="index__loading-container">
            <Text className="index__loading-text">加载预约中...</Text>
          </View>
        ) : appointmentError ? (
          <OrganicCard variant="soft">
            <Text className="index__error-text">{appointmentError}</Text>
            <View onClick={() => fetchAppointments()}>
              <Text className="index__retry-text">重试</Text>
            </View>
          </OrganicCard>
        ) : filteredAppointments.length === 0 ? (
          <OrganicCard variant="ghost">
            <View className="index__empty-content">
              <Text className="index__empty-text">暂无预约</Text>
              <Text className="index__empty-subtext">点击快捷入口添加预约</Text>
            </View>
          </OrganicCard>
        ) : (
          filteredAppointments.slice(0, 3).map((item) => {
            const badge = formatAppointmentDateBadge(item.scheduledAt);
            const effectiveStatus = getAppointmentEffectiveStatus(item);
            const statusLabel =
              effectiveStatus === 'pending'
                ? '待就诊'
                : effectiveStatus === 'completed'
                  ? '已完成'
                  : '已过期';

            return (
              <OrganicCard key={item.id} shadow style={{ marginBottom: '12px' }} onPress={() => Taro.navigateTo({ url: '/pages/appointments/index' })}>
                <View className="index__appointment-content">
                  <View className="index__appointment-date">
                    <Text className="index__appointment-day">{badge.day}</Text>
                    <Text className="index__appointment-month">{badge.month}</Text>
                  </View>
                  <View className="index__appointment-info">
                    <Text className="index__appointment-clinic">{item.clinic}</Text>
                    <Text className="index__appointment-department">{item.department}</Text>
                  </View>
                  <View
                    className={`index__status-badge ${
                      effectiveStatus === 'pending'
                        ? 'index__status-badge--pending'
                        : effectiveStatus === 'completed'
                          ? 'index__status-badge--completed'
                          : 'index__status-badge--expired'
                    }`}
                  >
                    <Text className="index__status-text">{statusLabel}</Text>
                  </View>
                </View>
              </OrganicCard>
            );
          })
        )}

        {/* Growth Record Preview */}
        <View className="index__section-header" style={{ marginTop: '16px' }}>
          <Text className="index__section-title">成长记录</Text>
          <View
            onClick={() => Taro.navigateTo({ url: '/pages/growth/index' })}
            hoverClass="index__section-link--pressed"
          >
            <Text className="index__section-link">查看更多 ›</Text>
          </View>
        </View>

        {currentGrowth.length > 0 ? (
          <OrganicCard
            shadow
            style={{ marginBottom: '20px' }}
            onPress={() => Taro.navigateTo({ url: '/pages/growth/index' })}
          >
            <View className="index__growth-preview">
              <Text className="index__growth-preview-title">最近记录</Text>
              <View className="index__growth-metrics">
                {(['weight', 'height', 'head'] as const).map((metric) => {
                  const metricRecords = currentGrowth.filter(
                    (r) => r.metric === metric
                  );
                  if (metricRecords.length === 0) return null;
                  const latest = metricRecords[metricRecords.length - 1];
                  const metricNames = {
                    weight: '体重',
                    height: '身高',
                    head: '头围',
                  };
                  const units = { weight: 'kg', height: 'cm', head: 'cm' };

                  return (
                    <View key={metric} className="index__growth-metric">
                      <Text className="index__growth-metric-label">
                        {metricNames[metric]}
                      </Text>
                      <Text className="index__growth-metric-value">
                        {latest.value}
                        <Text className="index__growth-metric-unit">
                          {' '}
                          {units[metric]}
                        </Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </OrganicCard>
        ) : (
          <OrganicCard variant="ghost">
            <View className="index__empty-content">
              <Text className="index__empty-text">暂无成长记录</Text>
              <Text className="index__empty-subtext">点击右下角 + 添加第一条记录</Text>
            </View>
          </OrganicCard>
        )}

        {/* Content Classroom */}
        <View className="index__section-header">
          <Text className="index__section-title">内容课堂</Text>
        </View>

        <OrganicCard shadow>
          <View
            className="index__classroom-item"
            onClick={() => Taro.switchTab({ url: '/pages/classroom/index' })}
          >
            <View className="index__classroom-tag">
              <Text className="index__classroom-tag-text">课堂</Text>
            </View>
            <Text className="index__classroom-title">
              查看最新课堂内容与文章
            </Text>
          </View>
        </OrganicCard>

        <View className="index__bottom-spacer" />
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingActionButton onClick={() => setShowGrowthModal(true)} />

      {/* Modals */}
      <GrowthRecordModal
        visible={showGrowthModal}
        onClose={() => setShowGrowthModal(false)}
        onSubmit={handleAddGrowth}
      />
      <AppointmentModal
        visible={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        onSubmit={handleAddAppointment}
      />
      <AppointmentInfoOnceModal />
      {showBabyForm && (
        <BabyForm
          visible={showBabyForm}
          onClose={() => setShowBabyForm(false)}
          onSubmit={formMode === 'create' ? handleCreateBaby : handleUpdateBaby}
          mode={formMode}
          initialData={editingBaby}
        />
      )}
      <Modal
        visible={showBabyList}
        onClose={() => setShowBabyList(false)}
        title="选择宝宝"
        height="auto"
        position="top"
      >
        <View className="index__baby-list-content">
          {babies.map((baby) => (
            <View
              key={baby.id}
              className={`index__baby-list-item ${
                currentBaby?.id === baby.id
                  ? 'index__baby-list-item--active'
                  : ''
              }`}
              onClick={() => {
                selectBaby(baby.id);
                setShowBabyList(false);
              }}
            >
              <Text className="index__baby-list-name">{baby.name}</Text>
              {currentBaby?.id === baby.id && (
                <Text className="index__baby-list-check">{'✓'}</Text>
              )}
            </View>
          ))}
          <View
            className="index__baby-list-add"
            onClick={handleRequestCreateBaby}
          >
            <Text className="index__baby-list-add-text">+ 添加宝宝</Text>
          </View>
        </View>
      </Modal>
    </OrganicBackground>
  );
}
