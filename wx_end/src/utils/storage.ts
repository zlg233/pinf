import Taro from '@tarojs/taro';

export const storage = {
  async getItem(key: string) {
    try {
      const res = await Taro.getStorage({ key });
      return res.data;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    await Taro.setStorage({ key, data: value });
  },
  async removeItem(key: string) {
    await Taro.removeStorage({ key });
  },
};
