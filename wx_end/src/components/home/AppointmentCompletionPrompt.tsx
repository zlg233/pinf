import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, useDidHide } from '@tarojs/taro';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store';
import { useAppointmentStore } from '@/store/appointmentStore';
import { notify } from '@/utils/feedback';
import { getAppointmentEffectiveStatus } from '@/utils/appointment';
import type { Appointment } from '@/types/appointment';
import './AppointmentCompletionPrompt.scss';

const AUTH_PAGES = ['pages/login/index', 'pages/set-password/index'];
const REFRESH_INTERVAL_MS = 60 * 1000;
const PROMPT_DELAY_MS = 400;

const AppointmentCompletionPrompt: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { appointments, fetch, updateStatus, clear } = useAppointmentStore();
  const promptedIdsRef = useRef<Set<number>>(new Set());
  const promptInFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const currentPage = Taro.useRouter().path || '';
  const isAuthFlow = AUTH_PAGES.some((p) => currentPage.includes(p));
  const routeKey = currentPage;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || isAuthFlow) {
      promptedIdsRef.current.clear();
      promptInFlightRef.current = false;
      setActiveAppointment(null);
      clear();
    }
  }, [clear, isAuthenticated, isAuthFlow, isLoading]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || isAuthFlow) return;

    fetch({ silent: true }).catch(() => {});
  }, [fetch, isAuthenticated, isAuthFlow, isLoading, routeKey]);

  useDidShow(() => {
    if (!isAuthenticated || isAuthFlow) return;

    timerRef.current = setInterval(() => {
      fetch({ silent: true }).catch(() => {});
    }, REFRESH_INTERVAL_MS);
  });

  useDidHide(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  useEffect(() => {
    if (isLoading || !isAuthenticated || isAuthFlow) return;
    if (promptInFlightRef.current || activeAppointment) return;

    const now = new Date();
    const overdueItems = appointments.filter(
      (item) => getAppointmentEffectiveStatus(item, now) === 'overdue',
    );
    const nextOverdue = overdueItems.find((item) => !promptedIdsRef.current.has(item.id)) ?? null;

    if (!nextOverdue) return;

    promptInFlightRef.current = true;

    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;

      promptedIdsRef.current.add(nextOverdue.id);
      setActiveAppointment(nextOverdue);
    }, PROMPT_DELAY_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      if (!activeAppointment) {
        promptInFlightRef.current = false;
      }
    };
  }, [activeAppointment, appointments, isAuthenticated, isAuthFlow, isLoading, routeKey]);

  const closePrompt = () => {
    setActiveAppointment(null);
    promptInFlightRef.current = false;
  };

  const handleDismiss = async () => {
    if (!activeAppointment || actionLoading) return;

    setActionLoading(true);
    try {
      if (activeAppointment.status === 'pending') {
        await updateStatus(activeAppointment.id, 'overdue');
      }
      closePrompt();
    } catch {
      promptedIdsRef.current.delete(activeAppointment.id);
      notify('更新就诊状态失败，请重试');
      closePrompt();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleted = async () => {
    if (!activeAppointment || actionLoading) return;

    setActionLoading(true);
    try {
      await updateStatus(activeAppointment.id, 'completed');
      notify('已标记为已就诊');
      closePrompt();
    } catch {
      promptedIdsRef.current.delete(activeAppointment.id);
      notify('更新就诊状态失败，请重试');
      closePrompt();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal visible={!!activeAppointment} onClose={handleDismiss}>
      <View className="appointment-prompt__card">
        <Text className="appointment-prompt__title">预约时间已过</Text>
        <Text className="appointment-prompt__message">
          {activeAppointment
            ? `"${activeAppointment.clinic} / ${activeAppointment.department}"已超过预约时间，是否已完成就诊？`
            : ''}
        </Text>
        <View className="appointment-prompt__actions">
          <View
            className="appointment-prompt__button appointment-prompt__button--secondary"
            onClick={handleDismiss}
          >
            <Text className="appointment-prompt__button-text--secondary">稍后处理</Text>
          </View>
          <View
            className="appointment-prompt__button appointment-prompt__button--primary"
            onClick={handleCompleted}
          >
            <Text className="appointment-prompt__button-text--primary">已就诊</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AppointmentCompletionPrompt;
