import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { STORAGE_KEYS } from '@/services/api/client';

export interface User {
  id: string;
  phone: string;
  name?: string;
  avatar?: string;
  needSetPassword?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needSetPassword: boolean;

  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string, needSetPassword: boolean) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setNeedSetPassword: (needSetPassword: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  needSetPassword: false,

  setUser: (user) => {
    Taro.setStorage({ key: STORAGE_KEYS.USER_PROFILE, data: JSON.stringify(user) }).catch(console.error);
    set({ user, isAuthenticated: !!user });
  },

  setToken: (token) => {
    set({ token, isAuthenticated: !!token });
  },

  login: async (user, token, needSetPassword) => {
    await Taro.setStorage({ key: STORAGE_KEYS.AUTH_TOKEN, data: token });
    await Taro.setStorage({ key: STORAGE_KEYS.USER_PROFILE, data: JSON.stringify(user) });
    await Taro.setStorage({ key: STORAGE_KEYS.NEED_SET_PASSWORD, data: String(needSetPassword) });
    set({ user, token, isAuthenticated: true, needSetPassword });
  },

  logout: async () => {
    await Taro.removeStorage({ key: STORAGE_KEYS.AUTH_TOKEN });
    await Taro.removeStorage({ key: STORAGE_KEYS.USER_PROFILE });
    await Taro.removeStorage({ key: STORAGE_KEYS.NEED_SET_PASSWORD });
    set({ user: null, token: null, isAuthenticated: false, needSetPassword: false });
  },

  initialize: async () => {
    try {
      const tokenRes = await Taro.getStorage({ key: STORAGE_KEYS.AUTH_TOKEN }).catch(() => ({ data: null }));
      const userRes = await Taro.getStorage({ key: STORAGE_KEYS.USER_PROFILE }).catch(() => ({ data: null }));
      const needPwdRes = await Taro.getStorage({ key: STORAGE_KEYS.NEED_SET_PASSWORD }).catch(() => ({ data: null }));

      const storedToken = tokenRes.data as string | null;
      const storedUser: User | null = userRes.data ? JSON.parse(userRes.data as string) : null;
      const storedNeedSetPassword = needPwdRes.data === 'true';

      set({
        token: storedToken,
        user: storedUser,
        isAuthenticated: !!storedToken && !!storedUser,
        needSetPassword: storedNeedSetPassword,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      set({ isLoading: false });
    }
  },

  setNeedSetPassword: (needSetPassword) => {
    Taro.setStorage({ key: STORAGE_KEYS.NEED_SET_PASSWORD, data: String(needSetPassword) }).catch(console.error);
    set({ needSetPassword });
  },
}));

interface AppState {
  isOnline: boolean;
  lastSyncTime: number | null;

  setOnline: (isOnline: boolean) => void;
  updateSyncTime: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnline: true,
  lastSyncTime: null,

  setOnline: (isOnline) => set({ isOnline }),
  updateSyncTime: () => set({ lastSyncTime: Date.now() }),
}));
