import { api } from './client';
import Taro from '@tarojs/taro';
import type { NotificationSubscription } from '@/types/notification';

interface ApiResponse<T> { status: string; message?: string; data: T; }

export const listSubscriptions = async (): Promise<NotificationSubscription[]> => { const res = await api.get<ApiResponse<NotificationSubscription[]>>('/notifications/subscriptions'); return res.data.data; };
export const createSubscription = async (payload: { appointmentId: number; remindTime: string; channel?: string; token?: string }): Promise<NotificationSubscription> => { const res = await api.post<ApiResponse<NotificationSubscription>>('/notifications/subscriptions', payload); return res.data.data; };
export const deleteSubscription = async (id: number): Promise<void> => { await api.delete(`/notifications/subscriptions/${id}`); };
export const testSendSubscription = async (subscriptionId: number): Promise<NotificationSubscription> => { const res = await api.post<ApiResponse<NotificationSubscription>>('/notifications/test-send', { subscriptionId }); return res.data.data; };

// 微信小程序订阅消息授权
export async function requestSubscribeMessage(tmplIds: string[]) {
  return Taro.requestSubscribeMessage({ tmplIds, entityIds: [] });
}

// 小程序订阅授权后记录到后端
export async function subscribeMiniprogram(data: {
  appointment_id: number;
  openid: string;
  remind_time: string;
}) {
  const res = await api.post<ApiResponse<NotificationSubscription>>('/notifications/subscribe/miniprogram', data);
  return res.data;
}
