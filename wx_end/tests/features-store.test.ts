import { beforeEach, expect, mock, test } from 'bun:test';

let response: any = {
  data: { status: 'success', data: { ai_qa: true, classroom_video: false, classroom_article: true } },
};
let shouldFail = false;

const get = mock(async () => {
  if (shouldFail) {
    throw new Error('network down');
  }
  return response;
});

mock.module('../src/services/api/client', () => ({ api: { get } }));

const { useFeaturesStore } = await import('../src/store/features');

// 模块加载时的原始默认值，用于验证真正的出厂状态，而不是测试自己塞进去的值
const initialFeatures = { ...useFeaturesStore.getState().features };

const reset = () => {
  useFeaturesStore.setState({ features: { ...initialFeatures }, loaded: false });
};

beforeEach(() => {
  shouldFail = false;
  reset();
});

test('未发起请求前视频默认关闭、文章默认开启', () => {
  expect(initialFeatures.classroom_video).toBe(false);
  expect(initialFeatures.classroom_article).toBe(true);
});

test('后端返回关闭时保持关闭', async () => {
  await useFeaturesStore.getState().fetchFeatures();
  const { features, loaded } = useFeaturesStore.getState();
  expect(loaded).toBe(true);
  expect(features.classroom_video).toBe(false);
});

test('接口失败时视频保持关闭，文章仍可用', async () => {
  shouldFail = true;
  await useFeaturesStore.getState().fetchFeatures();
  const { features, loaded } = useFeaturesStore.getState();
  expect(loaded).toBe(true);
  expect(features.classroom_video).toBe(false);
  expect(features.classroom_article).toBe(true);
});

test('后端返回开启时跟随后端', async () => {
  response = {
    data: { status: 'success', data: { ai_qa: true, classroom_video: true, classroom_article: true } },
  };
  await useFeaturesStore.getState().fetchFeatures();
  expect(useFeaturesStore.getState().features.classroom_video).toBe(true);
});

test('接口失败不得把已关闭的视频打开', async () => {
  shouldFail = true;
  await useFeaturesStore.getState().fetchFeatures();
  expect(useFeaturesStore.getState().features.classroom_video).not.toBe(true);
});
