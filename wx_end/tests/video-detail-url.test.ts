import { expect, test } from 'bun:test';

test('播放源只使用解析后的地址，不把微信公众号网页交给 Video', async () => {
  const { getPlayableVideoUrl } = await import('../src/pages/video-detail/video-url');
  const video = {
    id: 1,
    title: '袋鼠式护理',
    downUrl: 'https://mp.weixin.qq.com/mp/mp/video?vid=abc',
    playUrl: 'https://mpvideo.qpic.cn/video.mp4?auth_key=abc',
  };

  expect(getPlayableVideoUrl(video)).toBe(video.playUrl);
  expect(getPlayableVideoUrl({ ...video, playUrl: null })).toBe('');
});
