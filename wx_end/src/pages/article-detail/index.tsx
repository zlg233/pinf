/**
 * 文章详情页 (Taro/WeChat Mini-Program)
 *
 * 从 React Native 迁移: useLocalSearchParams → Taro.useRouter().params,
 * RN WebView HTML 渲染 → Taro <RichText nodes={htmlContent}>,
 * RN ActivityIndicator → CSS spinner,
 * RN StyleSheet → SCSS + BEM + 主题变量
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, RichText } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';

import * as contentApi from '@/services/api/content';
import type { ContentArticle } from '@/types/content';

import './index.scss';

/**
 * 格式化日期为 YYYY-MM-DD
 */
const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

/**
 * 清洗 HTML 内容：修复 &amp; 实体，确保图片 URL 正确
 */
const cleanHtml = (content: string): string => {
  return content.replace(/&amp;/g, '&');
};

export default function ArticleDetailPage() {
  // ── 路由参数 ──
  const router = Taro.useRouter();
  const articleId = router.params?.id ? Number(router.params.id) : 0;

  // ── 状态 ──
  const [article, setArticle] = useState<ContentArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 数据获取 ──
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
      const message =
        fetchError instanceof Error ? fetchError.message : '获取文章失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ── 返回 ──
  const handleBack = () => {
    Taro.navigateBack();
  };

  // ── 渲染 ──
  return (
    <OrganicBackground variant="morning">
      <ScrollView
        className="page-article-detail__scroll"
        scrollY
        enhanced
        showScrollbar={false}
      >
        <View className="page-article-detail__scroll-inner">
        {/* ════ 头部 ════ */}
        <View className="page-article-detail__header">
          <View
            className="page-article-detail__back-btn"
            onClick={handleBack}
            hoverClass="page-article-detail__back-btn--pressed"
          >
            <Text className="page-article-detail__back-icon">{'\u2039'}</Text>
            <Text className="page-article-detail__back-text">返回</Text>
          </View>
        </View>

          {/* ── 加载状态 ── */}
          {loading ? (
            <View className="page-article-detail__loading">
              <View className="page-article-detail__spinner" />
              <Text className="page-article-detail__loading-text">
                加载文章中...
              </Text>
            </View>
          ) : /* ── 错误状态（含重试） ── */
          error ? (
            <OrganicCard variant="soft" shadow={false}>
              <View className="page-article-detail__error">
                <Text className="page-article-detail__error-text">{error}</Text>
                <View
                  className="page-article-detail__retry-btn"
                  onClick={fetchDetail}
                  hoverClass="page-article-detail__retry-btn--pressed"
                >
                  <Text className="page-article-detail__retry-text">重试</Text>
                </View>
              </View>
            </OrganicCard>
          ) : /* ── 文章内容 ── */
          article ? (
            <View className="page-article-detail__article">
              {/* 封面图 */}
              {article.coverUrl ? (
                <Image
                  className="page-article-detail__cover"
                  src={article.coverUrl}
                  mode="aspectFill"
                  lazyLoad
                />
              ) : (
                <View className="page-article-detail__cover-placeholder" />
              )}

              {/* 标题 */}
              <Text className="page-article-detail__title">
                {article.title}
              </Text>

              {/* 元信息 */}
              <View className="page-article-detail__meta">
                <Text className="page-article-detail__meta-text">
                  {article.author || '匿名作者'}
                </Text>
                {article.publishDate && (
                  <Text className="page-article-detail__meta-text">
                    {' '}
                    {'\u2022'}{' '}
                    {formatDate(article.publishDate)}
                  </Text>
                )}
              </View>

              {/* 分类标签 */}
              {article.category && (
                <View className="page-article-detail__category">
                  <Text className="page-article-detail__category-text">
                    {article.category}
                  </Text>
                </View>
              )}

              {/* 文章正文（RichText 渲染 HTML） */}
              <View className="page-article-detail__body">
                <RichText nodes={cleanHtml(article.content)} />
              </View>

              {/* 底部留白 */}
              <View className="page-article-detail__bottom-spacer" />
            </View>
          ) : (
            /* ── 文章不存在 ── */
            <OrganicCard variant="soft" shadow={false}>
              <View className="page-article-detail__error">
                <Text className="page-article-detail__error-text">
                  文章不存在
                </Text>
              </View>
            </OrganicCard>
          )}
        </View>
      </ScrollView>
    </OrganicBackground>
  );
}
