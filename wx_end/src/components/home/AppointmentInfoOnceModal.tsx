import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Modal } from '@/components/ui/Modal';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { useAuthStore } from '@/store';
import { useAppointmentStore } from '@/store/appointmentStore';
import {
  formatAppointmentDateTime,
  getAppointmentEffectiveStatus,
  parseAppointmentDate,
} from '@/utils/appointment';
import './AppointmentInfoOnceModal.scss';

const AUTH_PAGES = ['pages/login/index', 'pages/set-password/index'];
const MAX_ITEMS = 6;

const AppointmentInfoOnceModal: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { appointments, fetch, loading } = useAppointmentStore();
  const [visible, setVisible] = useState(false);
  const shownInSessionRef = useRef(false);

  const currentPage = Taro.useRouter().path || '';
  const isAuthFlow = AUTH_PAGES.some((p) => currentPage.includes(p));

  useEffect(() => {
    if (!isAuthenticated || isAuthFlow) {
      shownInSessionRef.current = false;
      setVisible(false);
      return;
    }

    fetch().catch(() => {});
  }, [fetch, isAuthenticated, isAuthFlow]);

  const pendingAppointments = useMemo(() => {
    return appointments
      .filter((item) => getAppointmentEffectiveStatus(item) === 'pending')
      .sort((a, b) => {
        const left = parseAppointmentDate(a.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const right = parseAppointmentDate(b.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return left - right;
      })
      .slice(0, MAX_ITEMS);
  }, [appointments]);

  const hasOverdueAppointments = useMemo(
    () => appointments.some((item) => getAppointmentEffectiveStatus(item) === 'overdue'),
    [appointments],
  );

  useEffect(() => {
    if (isLoading || loading || !isAuthenticated || isAuthFlow) return;
    if (hasOverdueAppointments) {
      setVisible(false);
      return;
    }
    if (shownInSessionRef.current) return;
    if (!pendingAppointments.length) return;

    shownInSessionRef.current = true;
    setVisible(true);
  }, [hasOverdueAppointments, isAuthenticated, isLoading, isAuthFlow, loading, pendingAppointments]);

  if (hasOverdueAppointments || !pendingAppointments.length) return null;

  return (
    <Modal visible={visible} onClose={() => setVisible(false)}>
      <View className="info-once-modal__content">
        <Text className="info-once-modal__title">近期预约提醒</Text>
        <Text className="info-once-modal__subtitle">以下是你当前待就诊的预约信息</Text>

        <ScrollView className="info-once-modal__list" scrollY>
          <View className="info-once-modal__list-content">
            {pendingAppointments.map((item) => (
              <View key={item.id} className="info-once-modal__row">
                <Text className="info-once-modal__row-title">{item.clinic}</Text>
                <Text className="info-once-modal__row-meta">
                  {formatAppointmentDateTime(item.scheduledAt)} | {item.department}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View className="info-once-modal__action">
          <OrganicButton title="知道了" size="small" onPress={() => setVisible(false)} />
        </View>
      </View>
    </Modal>
  );
};

export default AppointmentInfoOnceModal;
