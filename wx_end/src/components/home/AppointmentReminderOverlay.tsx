import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { useAuthStore } from '@/store';
import { useBabyStore } from '@/store/babyStore';
import { getAppointmentSummary } from '@/services/api/appointment';
import { formatAppointmentDateTime } from '@/utils/appointment';
import type { AppointmentSummary } from '@/types/appointment';
import './AppointmentReminderOverlay.scss';

const PREVIEW_LIMIT = 3;
const AUTH_PAGES = ['pages/login/index', 'pages/set-password/index'];
const STORAGE_PREFIX = 'appointment_reminder_shown_';

const AppointmentReminderOverlay: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { currentBaby, isLoading: isBabyLoading } = useBabyStore();
  const [summary, setSummary] = useState<AppointmentSummary | null>(null);
  const [visible, setVisible] = useState(false);
  const shownKeyRef = useRef('');

  const currentPage = Taro.useRouter().path || '';
  const isAuthFlow = AUTH_PAGES.some((p) => currentPage.includes(p));
  const routeKey = currentPage;

  useEffect(() => {
    if (isLoading || isBabyLoading || !isAuthenticated || isAuthFlow) {
      shownKeyRef.current = '';
      setVisible(false);
      return;
    }

    const todayKey = `${user?.id ?? 'anonymous'}:${currentBaby?.id ?? 'no-baby'}:${new Date().toDateString()}`;
    if (shownKeyRef.current === todayKey) return;

    let cancelled = false;

    let storedDate = '';
    try {
      storedDate = Taro.getStorageSync(`${STORAGE_PREFIX}${user?.id ?? 'anonymous'}:${currentBaby?.id ?? 'no-baby'}`) as string;
    } catch {
      // key not found, treat as not shown
    }
    if (storedDate === new Date().toDateString()) {
      shownKeyRef.current = todayKey;
      return;
    }

    getAppointmentSummary(currentBaby?.id)
      .then((data) => {
        if (cancelled) return;

        if (data.counts.total <= 0) {
          setSummary(null);
          setVisible(false);
          return;
        }

        shownKeyRef.current = todayKey;
        Taro.setStorageSync(
          `${STORAGE_PREFIX}${user?.id ?? 'anonymous'}:${currentBaby?.id ?? 'no-baby'}`,
          new Date().toDateString(),
        );
        setSummary(data);
        setVisible(true);
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
          setVisible(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentBaby?.id, isAuthenticated, isAuthFlow, isBabyLoading, isLoading, routeKey, user?.id]);

  const previewItems = useMemo(() => {
    if (!summary) return [];
    return [...summary.today, ...summary.upcoming].slice(0, PREVIEW_LIMIT);
  }, [summary]);

  if (!summary || !visible) return null;

  const headerText =
    summary.counts.today > 0
      ? `今天有 ${summary.counts.today} 个预约`
      : `未来 ${summary.windowDays} 天内有 ${summary.counts.upcoming} 个预约`;

  const subText =
    summary.counts.today > 0 && summary.counts.upcoming > 0
      ? `另外还有 ${summary.counts.upcoming} 个预约将在 ${summary.windowDays} 天内到来`
      : '建议尽早确认就诊时间和所需材料';

  const handleClose = () => setVisible(false);

  const handleViewAll = () => {
    setVisible(false);
    Taro.navigateTo({ url: '/pages/appointments/index' });
  };

  return (
    <View className="reminder-overlay">
      <View className="reminder-overlay__backdrop" onClick={handleClose} />
      <View className="reminder-overlay__card">
        <View className="reminder-overlay__header">
          <View className="reminder-overlay__header-copy">
            <View className="reminder-overlay__title-row">
              <Text className="reminder-overlay__icon">📅</Text>
              <Text className="reminder-overlay__title">{headerText}</Text>
            </View>
            <Text className="reminder-overlay__subtitle">{subText}</Text>
          </View>
          <View className="reminder-overlay__close-btn" onClick={handleClose}>
            <Text className="reminder-overlay__close-icon">✕</Text>
          </View>
        </View>

        <View className="reminder-overlay__list">
          {previewItems.map((item) => (
            <View key={item.id} className="reminder-overlay__list-row">
              <View className="reminder-overlay__dot" />
              <View className="reminder-overlay__list-copy">
                <Text className="reminder-overlay__list-title">{item.clinic}</Text>
                <Text className="reminder-overlay__list-meta">
                  {formatAppointmentDateTime(item.scheduledAt)} · {item.department}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="reminder-overlay__actions">
          <OrganicButton title="稍后" variant="ghost" size="small" onPress={handleClose} />
          <OrganicButton title="查看预约" size="small" onPress={handleViewAll} />
        </View>
      </View>
    </View>
  );
};

export default AppointmentReminderOverlay;
