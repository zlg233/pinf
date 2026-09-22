import { api } from './client';
import { getCacheWithExpiry, setCacheWithExpiry } from '@/utils/storage';
import type { ContentArticle, ContentVideo, ContentPagination } from '@/types/content';

interface ApiListResponse<T> { status: string; message?: string; data: T; pagination: ContentPagination; }
interface ApiResponse<T> { status: string; message?: string; data: T; }
export interface ContentListParams { page?: number; per_page?: number; search?: string; category?: string; }

/** 生成 RESTful GET 缓存的键 */
function buildCacheKey(endpoint: string, params?: ContentListParams): string {
  if (!params) return `cache:${endpoint}`;
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('&');
  return `cache:${endpoint}?${qs}`;
}

/** 内容列表缓存 TTL：1 小时 */
const LIST_CACHE_TTL = 3600000;

export const listArticles = async (params?: ContentListParams) => {
  const cacheKey = buildCacheKey('/content/articles', params);
  const cached = await getCacheWithExpiry<ApiListResponse<ContentArticle[]>>(cacheKey);
  if (cached) return cached;
  const res = await api.get<ApiListResponse<ContentArticle[]>>('/content/articles', params);
  await setCacheWithExpiry(cacheKey, res.data, LIST_CACHE_TTL);
  return res.data;
};

export const getArticleDetail = async (id: number) => {
  const res = await api.get<ApiResponse<ContentArticle>>(`/content/articles/${id}`);
  return res.data.data;
};

export const listVideos = async (params?: ContentListParams) => {
  const cacheKey = buildCacheKey('/content/videos', params);
  const cached = await getCacheWithExpiry<ApiListResponse<ContentVideo[]>>(cacheKey);
  if (cached) return cached;
  const res = await api.get<ApiListResponse<ContentVideo[]>>('/content/videos', params);
  await setCacheWithExpiry(cacheKey, res.data, LIST_CACHE_TTL);
  return res.data;
};

export const getVideoDetail = async (id: number) => {
  const res = await api.get<ApiResponse<ContentVideo>>(`/content/videos/${id}`, {
    include_play_url: 1,
  });
  return res.data.data;
};
