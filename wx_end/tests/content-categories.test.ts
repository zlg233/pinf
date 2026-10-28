import { expect, test } from 'bun:test';

const { CONTENT_CATEGORIES, CATEGORY_FILTER_OPTIONS } = await import(
  '../src/constants/content-categories'
);
const { buildCategoryQuery, isValidCategory, normalizeWriteCategory } = await import(
  '../src/domain/content/categories'
);

test('分类常量是固定四个且顺序稳定', () => {
  expect(CONTENT_CATEGORIES).toEqual(['入院时', '住院期间', '出院当天', '出院后']);
});

test('筛选下拉包含全部与未分类', () => {
  const values = CATEGORY_FILTER_OPTIONS.map((item: { value: string }) => item.value);
  expect(values).toContain('');
  expect(values).toContain('__uncategorized__');
  expect(values).toContain('出院后');
});

test('未分类筛选与分类筛选互斥', () => {
  expect(buildCategoryQuery('__uncategorized__')).toEqual({ uncategorized: 1 });
  expect(buildCategoryQuery('入院时')).toEqual({ category: '入院时' });
  expect(buildCategoryQuery('')).toEqual({});
});

test('非法分类不被接受', () => {
  expect(isValidCategory('出院前')).toBe(false);
  expect(isValidCategory('入院时')).toBe(true);
  expect(normalizeWriteCategory('出院前')).toBe('');
  expect(normalizeWriteCategory('  出院后 ')).toBe('出院后');
  expect(normalizeWriteCategory('')).toBe('');
});
