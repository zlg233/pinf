import { expect, mock, test } from 'bun:test';

const get = mock(async () => ({
  data: {
    status: 'success',
    data: { id: 42, title: '素材视频', playUrl: 'https://mpvideo.qpic.cn/video.mp4' },
  },
}));

mock.module('../src/services/api/client', () => ({ api: { get } }));
mock.module('@/utils/storage', () => ({
  getCacheWithExpiry: mock(async () => null),
  setCacheWithExpiry: mock(async () => {}),
}));

const { getVideoDetail } = await import('../src/services/api/content');

test('视频详情请求播放地址且返回原始详情数据', async () => {
  const detail = await getVideoDetail(42);

  expect(get).toHaveBeenCalledWith('/content/videos/42', { include_play_url: 1 });
  expect(detail.playUrl).toBe('https://mpvideo.qpic.cn/video.mp4');
});
