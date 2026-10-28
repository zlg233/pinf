/**
 * 内容管理接口（仅管理员可用）。
 *
 * 后端 /api/admin/content/* 会校验 role=admin，前端隐藏入口只是体验。
 */

import { api } from './client';
import type { ContentArticle, ContentPagination, ContentVideo } from '@/types/content';

export interface AdminListParams {
  page?: number;
  per_page?: number;
  search?: string;
  category?: string;
  uncategorized?: number;
}

interface AdminListResponse<T> {
  status: string;
  message?: string;
  data: T;
  pagination: ContentPagination;
  categories?: string[];
}

interface AdminItemResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export const listAdminArticles = async (params?: AdminListParams) => {
  const res = await api.get<AdminListResponse<ContentArticle[]>>('/admin/content/articles', params);
  return res.data;
};

export const listAdminVideos = async (params?: AdminListParams) => {
  const res = await api.get<AdminListResponse<ContentVideo[]>>('/admin/content/videos', params);
  return res.data;
};

export const updateArticleCategory = async (id: number, category: string) => {
  const res = await api.patch<AdminItemResponse<ContentArticle>>(
    `/admin/content/articles/${id}`,
    { category },
  );
  return res.data.data;
};

export const updateVideoCategory = async (id: number, category: string) => {
  const res = await api.patch<AdminItemResponse<ContentVideo>>(
    `/admin/content/videos/${id}`,
    { category },
  );
  return res.data.data;
};
