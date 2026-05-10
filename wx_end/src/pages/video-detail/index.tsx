/**
 * 视频详情页 (Taro/WeChat Mini-Program)
 *
 * 从 React Native 迁移: expo-router useLocalSearchParams -> Taro.useRouter,
 * RN WebView video -> Taro <Video> 组件 (微信原生),
 * RN ActivityIndicator -> CSS spinner, RN TouchableOpacity -> View + onClick + hoverClass
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Video } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import * as contentApi from '@/services/api/content';
import type { ContentVideo } from '@/types/content';

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

  // ── 事件处理 ──

  const handleGoBack = () => {
    Taro.navigateBack();
  };

  const handleVideoError = () => {
    setError('视频加载失败');
  };

  // ── 渲染 ──
  return (
    <OrganicBackground variant="morning">
      <ScrollView className="page-video-detail__scroll" scrollY>
        <View className="page-video-detail__scroll-inner">
        {/* ════ 头部导航 ════ */}
        <View className="page-video-detail__header">
          <View
            className="page-video-detail__back-btn"
            onClick={handleGoBack}
            hoverClass="page-video-detail__back-btn--pressed"
          >
            <Text className="page-video-detail__back-icon">{'\u2039'}</Text>
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

              {video.downUrl ? (
                <View className="page-video-detail__video-wrapper">
                  <Video
                    src={video.downUrl}
                    poster={video.coverUrl || undefined}
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
      </ScrollView>
    </OrganicBackground>
  );
}
