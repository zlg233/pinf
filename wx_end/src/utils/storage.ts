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

/**
 * 带过期时间的缓存存储（异步）
 * @param key 存储键
 * @param data 要缓存的数据
 * @param ttlMs 过期时间（毫秒），默认 1 小时
 */
export async function setCacheWithExpiry<T>(key: string, data: T, ttlMs = 3600000): Promise<void> {
  try {
    await Taro.setStorage({
      key,
      data: { data, timestamp: Date.now(), ttl: ttlMs },
    });
  } catch (err) {
    console.warn('setCacheWithExpiry failed:', err);
  }
}

/**
 * 获取带过期时间的缓存
 * @param key 存储键
 * @returns 缓存数据，若过期或不存在则返回 null
 */
export async function getCacheWithExpiry<T>(key: string): Promise<T | null> {
  try {
    const res = await Taro.getStorage<{ data: T; timestamp: number; ttl: number }>({ key });
    const cache = res.data;
    if (!cache || Date.now() - cache.timestamp > cache.ttl) {
      if (cache) {
        await Taro.removeStorage({ key }).catch(() => {});
      }
      return null;
    }
    return cache.data;
  } catch {
    return null;
  }
}

/**
 * 生成 CDN 缩略图 URL
 * 使用 Qiniu imageView2 模式缩放，保留原有 URL 结构
 * @param url 原始图片 URL
 * @param width 目标宽度（px），默认 400
 * @returns 缩略图 URL
 */
export function buildThumbUrl(url?: string | null, width = 400): string | undefined {
  if (!url) return undefined;
  // 跳过 data: URI 和已带处理参数的 URL
  if (url.startsWith('data:') || url.includes('?imageView2')) return url;
  return `${url}?imageView2/2/w/${width}`;
}
