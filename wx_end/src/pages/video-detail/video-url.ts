import type { ContentVideo } from '@/types/content';

/** 清洗 URL + http → https */
export const sanitizeUrl = (url?: string | null): string => {
  if (!url) return '';
  return url
    .trim()
    .replace(/^["""]+|["""]+$/g, '')
    .replace(/&quot;/g, '')
    .replace(/&#34;/g, '')
    .replace(/^http:\/\//, 'https://');
};

/** 微信网页地址不能作为原生 Video 的播放源。 */
export const getPlayableVideoUrl = (video: ContentVideo | null): string =>
  sanitizeUrl(video?.playUrl);
