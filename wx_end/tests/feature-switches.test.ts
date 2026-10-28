import { expect, test } from 'bun:test';

const { isVideoEntryEnabled, isVideoDetailBlocked, shouldLeaveClassroom } = await import(
  '../src/domain/features/switches'
);

const flags = (overrides: Partial<{ ai_qa: boolean; classroom_video: boolean; classroom_article: boolean }> = {}) => ({
  ai_qa: true,
  classroom_video: true,
  classroom_article: true,
  ...overrides,
});

test('开关未加载完成时不显示视频入口，即使默认值为 true', () => {
  expect(isVideoEntryEnabled(flags({ classroom_video: true }), false)).toBe(false);
});

test('后端关闭视频后视频入口不可见', () => {
  expect(isVideoEntryEnabled(flags({ classroom_video: false }), true)).toBe(false);
});

test('后端开启视频且开关已加载时视频入口可见', () => {
  expect(isVideoEntryEnabled(flags({ classroom_video: true }), true)).toBe(true);
});

test('视频详情页在开关未加载或后端关闭时一律拦死', () => {
  expect(isVideoDetailBlocked(flags({ classroom_video: true }), false)).toBe(true);
  expect(isVideoDetailBlocked(flags({ classroom_video: false }), true)).toBe(true);
  expect(isVideoDetailBlocked(flags({ classroom_video: true }), true)).toBe(false);
});

test('只有文章和视频都被后端关闭且开关已加载时才退出课堂', () => {
  expect(
    shouldLeaveClassroom(flags({ classroom_article: false, classroom_video: false }), true),
  ).toBe(true);
  expect(
    shouldLeaveClassroom(flags({ classroom_article: false, classroom_video: false }), false),
  ).toBe(false);
  expect(
    shouldLeaveClassroom(flags({ classroom_article: true, classroom_video: false }), true),
  ).toBe(false);
});
