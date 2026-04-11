import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { OrganicBackground, OrganicCard, OrganicChipButton } from '@/components/ui';
import { organicTheme } from '@/constants/theme';
import * as contentApi from '@/services/api/content';
import type { ContentArticle } from '@/types/content';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

const buildArticleHtml = (content: string) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  body {
    margin: 0;
    padding: 0;
    font-size: 15px;
    color: #4A4A4A;
    line-height: 1.75;
    word-wrap: break-word;
    -webkit-text-size-adjust: 100%;
  }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 8px 0;
    border-radius: 8px;
  }
  p { margin: 0 0 12px; }
  a { color: #5B9A8B; text-decoration: none; }
  blockquote {
    margin: 12px 0;
    padding: 8px 16px;
    border-left: 3px solid #5B9A8B;
    background: #FFF9F5;
    color: #7A7A7A;
  }
  table { max-width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 8px; border: 1px solid #e0e0e0; }
</style>
</head>
<body>
${content}
<script>
(function() {
  function sendHeight() {
    var h = document.body.scrollHeight;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h }));
  }
  sendHeight();
  window.addEventListener('load', sendHeight);
  var imgs = document.getElementsByTagName('img');
  for (var i = 0; i < imgs.length; i++) {
    imgs[i].addEventListener('load', sendHeight);
  }
})();
</script>
</body>
</html>`;

export default function ArticleDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const articleId = Number(params.id);
  const [article, setArticle] = useState<ContentArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webViewHeight, setWebViewHeight] = useState(100);

  const fetchDetail = useCallback(async () => {
    if (!articleId) {
      setError('文章 ID 无效');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await contentApi.getArticleDetail(articleId);
      setArticle(detail);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '获取文章失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

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
            <Text style={styles.loadingText}>加载文章中...</Text>
          </View>
        ) : error ? (
          <OrganicCard variant="soft" shadow={false} style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchDetail}>
              <Text style={styles.errorRetry}>重试</Text>
            </TouchableOpacity>
          </OrganicCard>
        ) : article ? (
          <View style={styles.detail}>
            {article.coverUrl ? (
              <Image source={{ uri: article.coverUrl }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <Text style={styles.title}>{article.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{article.author || '匿名作者'}</Text>
              {article.publishDate && <Text style={styles.metaText}>{formatDate(article.publishDate)}</Text>}
            </View>
            {article.category && <OrganicChipButton label={article.category} active onPress={() => undefined} />}
            <View style={{ height: webViewHeight }}>
              <WebView
                originWhitelist={['*']}
                source={{ html: buildArticleHtml(article.content) }}
                scrollEnabled={false}
                style={{ height: webViewHeight }}
                mixedContentMode="compatibility"
                domStorageEnabled
                javaScriptEnabled
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'height' && data.height > 0) {
                      setWebViewHeight(data.height);
                    }
                  } catch { /* ignore non-JSON messages */ }
                }}
              />
            </View>
          </View>
        ) : (
          <OrganicCard variant="soft" shadow={false} style={styles.errorCard}>
            <Text style={styles.errorText}>文章不存在</Text>
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
  cover: {
    width: '100%',
    height: 200,
    borderRadius: organicTheme.shapes.borderRadius.soft,
  },
  coverPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: organicTheme.shapes.borderRadius.soft,
    backgroundColor: organicTheme.colors.primary.soft,
    borderWidth: 1,
    borderColor: organicTheme.colors.border.light,
  },
  title: {
    fontSize: organicTheme.typography.fontSize.lg,
    fontWeight: organicTheme.typography.fontWeight.bold,
    color: organicTheme.colors.text.primary,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    gap: organicTheme.spacing.sm,
  },
  metaText: {
    fontSize: organicTheme.typography.fontSize.xs,
    color: organicTheme.colors.text.secondary,
  },
});
