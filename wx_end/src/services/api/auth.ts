import { api } from './client';

export interface SendCodeResponse {
  status: string; message: string;
  data: { message: string; code?: string; debug?: string; };
}
export interface LoginResponse {
  status: string; message: string;
  data: { token: string; user: { id: string; phone: string; name?: string; wxOpenid?: string; role: string; createdAt: string; updatedAt: string; needSetPassword?: boolean; }; need_set_password: boolean; };
}

export const sendPhoneCode = async (phone: string) => { const response = await api.post<SendCodeResponse>('/auth/phone/code', { phone }); return response.data; };
export const phoneLogin = async (phone: string, code: string) => { const response = await api.post<LoginResponse>('/auth/phone/login', { phone, code }); return response.data; };
export const passwordLogin = async (phone: string, password: string) => { const response = await api.post<LoginResponse>('/auth/password/login', { phone, password }); return response.data; };
export const setupPassword = async (password: string) => { const response = await api.post<{ status: string; message: string; data: { user: LoginResponse['data']['user'] } }>('/auth/password/setup', { password }); return response.data; };
export const updateProfile = async (name: string) => { const response = await api.put<{ status: string; message: string; data: { user: LoginResponse['data']['user'] } }>('/auth/profile', { name }); return response.data; };
export const wechatLogin = async (code: string) => { const response = await api.post<LoginResponse>('/auth/wechat', { code }); return response.data; };
