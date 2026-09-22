/**
 * 视频详情页 (Taro/WeChat Mini-Program)
 *
 * 微信素材的 downUrl 是网页地址；详情接口按需返回可播放的 playUrl。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Video } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import * as contentApi from '@/services/api/content';
import type { ContentVideo } from '@/types/content';
import { getPlayableVideoUrl, sanitizeUrl } from './video-url';

import './index.scss';

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

  const handleVideoError = (e: any) => {
    console.error('Video error:', e);
    setError('视频加载失败，请检查网络连接');
  };

  const videoUrl = getPlayableVideoUrl(video);

  // ── 渲染 ──
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
                    showFullscreenBtn
                    showPlayBtn
                    showCenterPlayBtn
                    onError={handleVideoError}
                  />
                </View>
              ) : (
                <OrganicCard variant="soft" shadow={false} style={{ marginTop: '12px' }}>
                  <View className="page-video-detail__error-content">
                    <Text className="page-video-detail__error-text">
                      暂时无法播放视频，请重试
                    </Text>
                    <View
                      className="page-video-detail__retry-btn"
                      onClick={fetchDetail}
                    >
                      <Text className="page-video-detail__retry-text">重试</Text>
                    </View>
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
