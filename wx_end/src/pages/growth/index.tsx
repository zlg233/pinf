/**
 * 成长曲线页面 (Taro/WeChat Mini-Program)
 *
 * 组装成长曲线图表和记录列表的完整成长跟踪页面。
 * 从 React Native 迁移: expo-router useRouter → Taro.useRouter,
 * RN RefreshControl → ScrollView refresherEnabled,
 * RN IconSymbol → Unicode 文本符号
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { GrowthChartView } from '@/components/growth/GrowthChartView';
import { GrowthRecordList } from '@/components/growth/GrowthRecordList';
import GrowthRecordModal from '@/components/home/GrowthRecordModal';
import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';

import { useBabyStore } from '@/store/babyStore';
import { useGrowthStore } from '@/store/growthStore';
import { useAuthStore } from '@/store';

import type { GrowthMetric } from '@/types/growth';
import type { CreateGrowthInput } from '@/types/growth';

import './index.scss';

type ViewMode = 'chart' | 'list';

export default function GrowthPage() {
  // ── 路由参数 ──
  const router = Taro.useRouter();
  const babyIdFromRoute = router.params?.babyId
    ? Number(router.params.babyId)
    : undefined;

  // ── Store ──
  const { currentBaby, initialize, selectBaby } = useBabyStore();
  const {
    records,
    fetch: fetchGrowth,
    add: addGrowth,
    update: updateGrowth,
    remove: removeGrowth,
    loading,
  } = useGrowthStore();

  const { isAuthenticated } = useAuthStore();

  // ── 内部状态 ──
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [metric, setMetric] = useState<GrowthMetric>('weight');
  const [ageType, setAgeType] = useState<'actual' | 'corrected'>('actual');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── 初始化：确保有 baby 数据 ──
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!currentBaby && babyIdFromRoute) {
      initialize().then(() => {
        selectBaby(babyIdFromRoute);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 当 currentBaby 变化时获取成长数据 ──
  useEffect(() => {
    if (currentBaby?.id) {
      fetchGrowth(currentBaby.id).catch(() => {});
    }
  }, [currentBaby?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 当前宝宝的成长记录 ──
  const currentRecords = currentBaby?.id
    ? records[currentBaby.id] || []
    : [];

  // ── 是否早产（用于显示矫正月龄切换） ──
  const isPremature = currentBaby
    ? (currentBaby.gestationalWeeks != null && currentBaby.gestationalWeeks < 37) ||
      !!currentBaby.dueDate
    : false;

  // ── 事件处理 ──

  const handleSubmit = async (payloads: CreateGrowthInput[]) => {
    if (!currentBaby?.id) return;
    await addGrowth(currentBaby.id, payloads);
    setShowModal(false);
  };

  const handleUpdateRecord = async (
    id: number,
    data: Partial<CreateGrowthInput>,
  ) => {
    await updateGrowth(id, data);
  };

  const handleDeleteRecord = async (id: number) => {
    if (!currentBaby?.id) return;
    await removeGrowth(id, currentBaby.id);
  };

  const handleRefresh = async () => {
    if (!currentBaby?.id) return;
    setIsRefreshing(true);
    try {
      await fetchGrowth(currentBaby.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGoBack = () => {
    Taro.navigateBack();
  };

  // ── 渲染 ──
  return (
    <OrganicBackground variant="morning">
      <ScrollView
        className="page-growth__scroll"
        scrollY
        refresherEnabled
        refresherTriggered={isRefreshing}
        onRefresherRefresh={handleRefresh}
      >
        <View className="page-growth__scroll-inner">
        {/* ════ 头部 ════ */}
        <View className="page-growth__header">
        <View
          className="page-growth__back-btn"
          onClick={handleGoBack}
          hoverClass="page-growth__back-btn--pressed"
        >
          <Text className="page-growth__back-icon">{'\u2039'}</Text>
        </View>
        <Text className="page-growth__title">成长曲线</Text>
        <View
          className="page-growth__refresh-btn"
          onClick={handleRefresh}
          hoverClass="page-growth__refresh-btn--pressed"
        >
          <Text className="page-growth__refresh-icon">{'\u21BB'}</Text>
        </View>
      </View>

        {!currentBaby ? (
          <View className="page-growth__center">
            <Text className="page-growth__center-icon">{'\u{1F476}'}</Text>
            <Text className="page-growth__center-text">
              请先添加或选择宝宝
            </Text>
          </View>
        ) : (
          <>
            {/* ════ 宝宝信息卡片 ════ */}
            <OrganicCard
              variant="default"
              style={{ margin: '16px 16px 0' }}
            >
              <Text className="page-growth__baby-name">
                {currentBaby.name}
              </Text>
              <Text className="page-growth__baby-meta">
                {currentBaby.gender === '男' ? '男宝宝' : '女宝宝'}
                {isPremature ? ' \u2022 早产儿' : ''}
              </Text>
            </OrganicCard>

            {/* ════ 视图切换 ════ */}
            <View className="page-growth__view-switch">
              <View
                className={`page-growth__view-tab${viewMode === 'chart' ? ' page-growth__view-tab--active' : ''}`}
                onClick={() => setViewMode('chart')}
                hoverClass="page-growth__view-tab--pressed"
              >
                <Text
                  className={`page-growth__view-tab-icon${viewMode === 'chart' ? ' page-growth__view-tab-icon--active' : ''}`}
                >
                  {'\u{1F4CA}'}
                </Text>
                <Text
                  className={`page-growth__view-tab-text${viewMode === 'chart' ? ' page-growth__view-tab-text--active' : ''}`}
                >
                  曲线图
                </Text>
              </View>
              <View
                className={`page-growth__view-tab${viewMode === 'list' ? ' page-growth__view-tab--active' : ''}`}
                onClick={() => setViewMode('list')}
                hoverClass="page-growth__view-tab--pressed"
              >
                <Text
                  className={`page-growth__view-tab-icon${viewMode === 'list' ? ' page-growth__view-tab-icon--active' : ''}`}
                >
                  {'\u{1F4CB}'}
                </Text>
                <Text
                  className={`page-growth__view-tab-text${viewMode === 'list' ? ' page-growth__view-tab-text--active' : ''}`}
                >
                  记录列表
                </Text>
              </View>
            </View>

            {/* ════ 内容：曲线图 / 记录列表 ════ */}
            {viewMode === 'chart' ? (
              <GrowthChartView
                baby={currentBaby}
                metric={metric}
                records={currentRecords}
                ageType={ageType}
                onMetricChange={setMetric}
                onAgeTypeChange={isPremature ? setAgeType : undefined}
                loading={loading}
                onRefresh={handleRefresh}
              />
            ) : (
              <GrowthRecordList
                records={currentRecords}
                loading={loading}
                onUpdate={handleUpdateRecord}
                onDelete={handleDeleteRecord}
                onRefresh={handleRefresh}
              />
            )}

            {/* ════ 添加记录按钮 ════ */}
            <View
              className="page-growth__add-btn"
              onClick={() => setShowModal(true)}
              hoverClass="page-growth__add-btn--pressed"
            >
              <Text className="page-growth__add-btn-text">
                + 添加成长记录
              </Text>
            </View>

            {/* 底部留白 */}
            <View className="page-growth__bottom-spacer" />
          </>
        )}
        </View>
      </ScrollView>

      {/* ════ 添加记录弹窗 ════ */}
      <GrowthRecordModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
      />
    </OrganicBackground>
  );
}
