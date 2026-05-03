import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type { Baby, CreateBabyInput, UpdateBabyInput } from '@/types/baby';
import * as babyApi from '@/services/api/baby';

const STORAGE_KEY_BABIES_LIST = 'babies.list';
const STORAGE_KEY_CURRENT_BABY_ID = 'babies.currentId';

interface BabyState {
  babies: Baby[];
  currentBaby: Baby | null;
  isLoading: boolean;
  error: string | null;

  fetchBabies: () => Promise<void>;
  selectBaby: (babyId: number) => void;
  createBaby: (data: CreateBabyInput) => Promise<Baby>;
  updateBaby: (id: number, data: UpdateBabyInput) => Promise<Baby>;
  deleteBaby: (id: number) => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;

  _syncToStorage: () => Promise<void>;
  _loadFromStorage: () => Promise<void>;
}

export const useBabyStore = create<BabyState>((set: any, get: any) => ({
  babies: [],
  currentBaby: null,
  isLoading: false,
  error: null,

  fetchBabies: async () => {
    set({ isLoading: true, error: null });
    try {
      const babies = await babyApi.getBabies();
      set({ babies, isLoading: false });

      await get()._syncToStorage();

      const { currentBaby } = get();
      if (!currentBaby && babies.length > 0) {
        get().selectBaby(babies[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取宝宝列表失败';
      set({ error: message, isLoading: false });
      console.error('Failed to fetch babies:', error);

      await get()._loadFromStorage();
    }
  },

  selectBaby: (babyId: number) => {
    const { babies } = get();
    const baby = babies.find((b: Baby) => b.id === babyId);
    if (baby) {
      set({ currentBaby: baby });
      Taro.setStorage({ key: STORAGE_KEY_CURRENT_BABY_ID, data: String(babyId) }).catch(console.error);
    }
  },

  createBaby: async (data: CreateBabyInput) => {
    set({ isLoading: true, error: null });
    try {
      const newBaby = await babyApi.createBaby(data);

      const babies = [newBaby, ...get().babies];
      set({ babies, isLoading: false });

      get().selectBaby(newBaby.id);

      await get()._syncToStorage();

      return newBaby;
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建宝宝失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateBaby: async (id: number, data: UpdateBabyInput) => {
    set({ isLoading: true, error: null });
    try {
      const updatedBaby = await babyApi.updateBaby(id, data);

      const babies = get().babies.map((b: Baby) => (b.id === id ? updatedBaby : b));
      set({ babies, isLoading: false });

      if (get().currentBaby?.id === id) {
        set({ currentBaby: updatedBaby });
      }

      await get()._syncToStorage();

      return updatedBaby;
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新宝宝失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteBaby: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await babyApi.deleteBaby(id);

      const babies = get().babies.filter((b: Baby) => b.id !== id);
      set({ babies, isLoading: false });

      if (get().currentBaby?.id === id) {
        if (babies.length > 0) {
          get().selectBaby(babies[0].id);
        } else {
          set({ currentBaby: null });
        }
      }

      await get()._syncToStorage();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除宝宝失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  initialize: async () => {
    await get()._loadFromStorage();

    await get().fetchBabies();
  },

  clearError: () => set({ error: null }),

  _syncToStorage: async () => {
    try {
      const { babies } = get();
      await Taro.setStorage({ key: STORAGE_KEY_BABIES_LIST, data: JSON.stringify(babies) });
    } catch (error) {
      console.error('Failed to sync babies to storage:', error);
    }
  },

  _loadFromStorage: async () => {
    try {
      const babiesRes = await Taro.getStorage({ key: STORAGE_KEY_BABIES_LIST }).catch(() => ({ data: null }));
      const currentIdRes = await Taro.getStorage({ key: STORAGE_KEY_CURRENT_BABY_ID }).catch(() => ({ data: null }));

      const babies: Baby[] = babiesRes.data ? JSON.parse(babiesRes.data as string) : [];
      const currentId = currentIdRes.data ? parseInt(currentIdRes.data as string, 10) : null;

      set({ babies });

      if (currentId && babies.length > 0) {
        const baby = babies.find((b: Baby) => b.id === currentId);
        if (baby) {
          set({ currentBaby: baby });
        } else if (babies.length > 0) {
          set({ currentBaby: babies[0] });
        }
      } else if (babies.length > 0) {
        set({ currentBaby: babies[0] });
      }
    } catch (error) {
      console.error('Failed to load babies from storage:', error);
    }
  },
}));
