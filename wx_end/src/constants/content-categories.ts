/**
 * 出院状态分类（与后端 utils/content_categories.py 保持一致）。
 *
 * 课堂筛选与内容管理页共用这一份，避免两处各写一份。
 */

export const CONTENT_CATEGORIES = ['入院时', '住院期间', '出院当天', '出院后'] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

/** 管理页筛选额外需要一个"未分类"选项 */
export const CATEGORY_FILTER_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: '全部', value: '' },
  ...CONTENT_CATEGORIES.map((category) => ({ label: category, value: category })),
  { label: '未分类', value: '__uncategorized__' },
];
