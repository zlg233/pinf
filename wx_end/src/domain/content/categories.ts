/**
 * 分类的纯逻辑（便于单测，不依赖 Taro）。
 */

import { CONTENT_CATEGORIES, type ContentCategory } from '@/constants/content-categories';

const UNCATEGORIZED = '__uncategorized__';

export const isValidCategory = (value: string): value is ContentCategory =>
  (CONTENT_CATEGORIES as readonly string[]).includes(value);

/** 列表筛选参数：分类与未分类互斥 */
export const buildCategoryQuery = (
  filter: string,
): { category?: string; uncategorized?: number } => {
  if (filter === UNCATEGORIZED) {
    return { uncategorized: 1 };
  }
  const category = filter.trim();
  return category ? { category } : {};
};

/** 仅允许四个枚举值用于写入；空字符串表示清空分类 */
export const normalizeWriteCategory = (value: string): string => {
  const text = value.trim();
  if (!text) return '';
  return isValidCategory(text) ? text : '';
};
