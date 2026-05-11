/**
 * 视频详情页 (Taro/WeChat Mini-Program)
 *
 * 微信素材 API 返回的 down_url 为视频页面链接（mp.weixin.qq.com），非直链 .mp4。
 * → 微信页面 URL 用 <WebView> 嵌入（页面自带播放器）
 * → 其他直链 URL 用原生 <Video> 组件播放
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Video, WebView } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import * as contentApi from '@/services/api/content';
import { API_BASE_URL } from '@/services/api/client';
import type { ContentVideo } from '@/types/content';

import './index.scss';

/** 清洗 URL + http → https */
const sanitizeUrl = (url?: string | null): string => {
  if (!url) return '';
  return url
    .trim()
    .replace(/^["“”]+|["“”]+$/g, '')
    .replace(/&quot;/g, '')
    .replace(/&#34;/g, '')
    .replace(/^http:\/\//, 'https://');
};

const isWechatVideoPage = (url?: string | null): boolean =>
  !!url && /mp\.weixin\.qq\.com/.test(url);

export default function VideoDetailPage() {
  // ── 路由参数 ──
  const router = Taro.useRouter();
  const videoId = Number(router.params?.id);

  // ── 状态 ──
  const [video, setVideo] = useState<ContentVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 拉取视频详情 ──
  const fetchDetail = useCallback(async () => {
    if (!videoId) {
      setError('视频 ID 无效');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await contentApi.getVideoDetail(videoId);
      setVideo(detail);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : '获取视频失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleGoBack = () => {
    Taro.navigateBack();
  };

  const handleVideoError = () => {
    setError('视频加载失败');
  };

  const handleWebViewError = () => {
    setError('视频页面加载失败');
  };

  const videoUrl = sanitizeUrl(video?.downUrl);

  // ── 微信视频页面 → WebView 全屏（经后端代理页绕过业务域名白名单）──
  if (video && isWechatVideoPage(video.downUrl)) {
    const watchUrl = `${API_BASE_URL}/content/videos/${videoId}/watch`;
    return (
      <WebView
        src={watchUrl}
        onError={handleWebViewError}
      />
    );
  }

  // ── 非微信页面（直链或加载中/错误）→ 标准布局 ──
  return (
    <OrganicBackground variant="morning">
      <ScrollView className="page-video-detail__scroll" scrollY>
        <View className="page-video-detail__scroll-inner">
        <View className="page-video-detail__scroll-body">
        {/* ════ 头部导航 ════ */}
        <View className="page-video-detail__header">
          <View
            className="page-video-detail__back-btn"
            onClick={handleGoBack}
            hoverClass="page-video-detail__back-btn--pressed"
          >
            <Text className="page-video-detail__back-icon">{'‹'}</Text>
            <Text className="page-video-detail__back-text">返回</Text>
          </View>
        </View>

        {loading ? (
            /* ── 加载中 ── */
            <View className="page-video-detail__loading">
              <View className="page-video-detail__spinner" />
              <Text className="page-video-detail__loading-text">
                加载视频中...
              </Text>
            </View>
          ) : error ? (
            /* ── 错误（含重试） ── */
            <OrganicCard variant="soft" shadow={false} style={{ margin: '16px' }}>
              <View className="page-video-detail__error-content">
                <Text className="page-video-detail__error-text">{error}</Text>
                <View
                  className="page-video-detail__retry-btn"
                  onClick={fetchDetail}
                  hoverClass="page-video-detail__retry-btn--pressed"
                >
                  <Text className="page-video-detail__retry-text">重试</Text>
                </View>
              </View>
            </OrganicCard>
          ) : video ? (
            /* ── 视频内容 ── */
            <View className="page-video-detail__content">
              <Text className="page-video-detail__title">{video.title}</Text>
              {video.description ? (
                <Text className="page-video-detail__description">
                  {video.description}
                </Text>
              ) : null}

              {videoUrl ? (
                <View className="page-video-detail__video-wrapper">
                  <Video
                    src={videoUrl}
                    poster={sanitizeUrl(video.coverUrl) || undefined}
                    className="page-video-detail__video"
                    controls
                    autoplay={false}
                    onError={handleVideoError}
                  />
                </View>
              ) : (
                <OrganicCard variant="soft" shadow={false} style={{ marginTop: '12px' }}>
                  <View className="page-video-detail__error-content">
                    <Text className="page-video-detail__error-text">
                      暂无可播放的视频链接
                    </Text>
                  </View>
                </OrganicCard>
              )}
            </View>
          ) : (
            /* ── 视频不存在 ── */
            <OrganicCard variant="soft" shadow={false} style={{ margin: '16px' }}>
              <View className="page-video-detail__error-content">
                <Text className="page-video-detail__error-text">视频不存在</Text>
              </View>
            </OrganicCard>
          )}

          {/* 底部留白 */}
          <View className="page-video-detail__bottom-spacer" />
        </View>
        </View>
      </ScrollView>
    </OrganicBackground>
  );
}
