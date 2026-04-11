import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { OrganicBackground, OrganicCard } from '@/components/ui';
import { organicTheme } from '@/constants/theme';
import * as contentApi from '@/services/api/content';
import type { ContentVideo } from '@/types/content';

export default function VideoDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const videoId = Number(params.id);
  const [video, setVideo] = useState<ContentVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const message = fetchError instanceof Error ? fetchError.message : '获取视频失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return (
    <OrganicBackground variant="morning">
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusSpacer} />
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol
              name="chevron.left"
              size={organicTheme.iconSizes.xs}
              color={organicTheme.colors.text.secondary}
            />
            <Text style={styles.backText}>返回</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={organicTheme.colors.primary.main} />
            <Text style={styles.loadingText}>加载视频中...</Text>
          </View>
        ) : error ? (
          <OrganicCard variant="soft" shadow={false} style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchDetail}>
              <Text style={styles.errorRetry}>重试</Text>
            </TouchableOpacity>
          </OrganicCard>
        ) : video ? (
          <View style={styles.detail}>
            <Text style={styles.title}>{video.title}</Text>
            {video.description ? <Text style={styles.description}>{video.description}</Text> : null}
            {video.downUrl ? (
              <View style={styles.videoContainer}>
                <WebView
                  source={{ uri: video.downUrl }}
                  style={styles.webview}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                  onError={() => setError('视频加载失败')}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={organicTheme.colors.primary.main} />
                      <Text style={styles.loadingText}>视频加载中...</Text>
                    </View>
                  )}
                />
              </View>
            ) : (
              <OrganicCard variant="soft" shadow={false} style={styles.errorCard}>
                <Text style={styles.errorText}>暂无可播放的视频链接</Text>
              </OrganicCard>
            )}
          </View>
        ) : (
          <OrganicCard variant="soft" shadow={false} style={styles.errorCard}>
            <Text style={styles.errorText}>视频不存在</Text>
          </OrganicCard>
        )}
      </ScrollView>
    </OrganicBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: organicTheme.spacing.lg,
    paddingBottom: 100,
  },
  statusSpacer: {
    height: 44,
  },
  headerRow: {
    marginBottom: organicTheme.spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: organicTheme.spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: organicTheme.spacing.md,
    paddingVertical: organicTheme.spacing.xs,
    borderRadius: organicTheme.shapes.borderRadius.pill,
    backgroundColor: organicTheme.colors.background.paper,
    borderWidth: 1,
    borderColor: organicTheme.colors.border.light,
  },
  backText: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.text.secondary,
    fontWeight: organicTheme.typography.fontWeight.medium,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: organicTheme.spacing.sm,
    marginTop: organicTheme.spacing.md,
  },
  loadingText: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.text.secondary,
  },
  errorCard: {
    marginTop: organicTheme.spacing.md,
    alignItems: 'center',
    gap: organicTheme.spacing.sm,
  },
  errorText: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.text.primary,
  },
  errorRetry: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.primary.main,
    fontWeight: organicTheme.typography.fontWeight.semibold,
  },
  detail: {
    gap: organicTheme.spacing.md,
  },
  title: {
    fontSize: organicTheme.typography.fontSize.lg,
    fontWeight: organicTheme.typography.fontWeight.bold,
    color: organicTheme.colors.text.primary,
    lineHeight: 28,
  },
  description: {
    fontSize: organicTheme.typography.fontSize.sm,
    color: organicTheme.colors.text.secondary,
    lineHeight: 22,
  },
  videoContainer: {
    width: '100%',
    height: 220,
    borderRadius: organicTheme.shapes.borderRadius.soft,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: organicTheme.colors.border.light,
    backgroundColor: organicTheme.colors.background.paper,
  },
  webview: {
    flex: 1,
  },
});
