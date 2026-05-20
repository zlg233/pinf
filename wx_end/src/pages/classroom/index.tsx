/**
 * 在线课堂页面 (Taro/WeChat Mini-Program)
 *
 * 文章/视频浏览，支持搜索、缓存、分页加载、下拉刷新。
 * 从 React Native 迁移: expo-router → Taro.navigateTo,
 * RN RefreshControl → ScrollView refresherEnabled,
 * RN AsyncStorage → Taro.getStorageSync/setStorageSync,
 * RN IconSymbol → Unicode 文本符号
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { OrganicChipButton } from '@/components/ui/OrganicButton';
import { Input } from '@/components/ui/Input';
import { useFeaturesStore } from '@/store/features';

import * as contentApi from '@/services/api/content';
import type { ContentArticle, ContentPagination, ContentVideo } from '@/types/content';

import './index.scss';

// ── Constants ──

const ARTICLE_PAGE_SIZE = 8;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_STORAGE_KEY = 'content_cache';

// ── Types ──

type ContentCache = {
  key: string;
  cachedAt: number;
  articles: ContentArticle[];
  articlePagination: ContentPagination | null;
};

type ContentItem =
  | { kind: 'article'; data: ContentArticle }
  | { kind: 'video'; data: ContentVideo };

// ── Helpers ──

const buildCacheKey = (search: string, tab: string) => `${search.trim()}|${tab.trim()}`;

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const buildArticleMeta = (article: ContentArticle) => {
  const date = formatDate(article.publishDate);
  const author = article.author?.trim() || '匿名作者';
  return date ? `${author} · ${date}` : author;
};

// ── Page Component ──

export default function ClassroomPage() {
  // ── Features ──
  const { features } = useFeaturesStore();

  // ── State ──
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'article' | 'video'>(
    features.classroom_article ? 'article' : 'video'
  );
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [articlePagination, setArticlePagination] = useState<ContentPagination | null>(null);
  const [videos, setVideos] = useState<ContentVideo[]>([]);
  const [videoPagination, setVideoPagination] = useState<ContentPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mixedItems, setMixedItems] = useState<ContentItem[]>([]);
  const [searching, setSearching] = useState(false);

  const cacheKey = useMemo(() => buildCacheKey(searchQuery, activeTab), [searchQuery, activeTab]);

  // ── Cache ──

  const loadCache = useCallback(async () => {
    try {
      const raw = Taro.getStorageSync(CACHE_STORAGE_KEY);
      if (!raw) return false;
      const cache: ContentCache = JSON.parse(raw);
      if (cache.key !== cacheKey) return false;
      if (Date.now() - cache.cachedAt > CACHE_TTL_MS) return false;
      setArticles(cache.articles);
      setArticlePagination(cache.articlePagination);
      return true;
    } catch {
      return false;
    }
  }, [cacheKey]);

  const saveCache = useCallback(async (payload: ContentCache) => {
    try {
      Taro.setStorageSync(CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch (cacheError) {
      console.warn('Failed to save content cache:', cacheError);
    }
  }, []);

  // ── Data fetching ──

  const fetchContent = useCallback(
    async (options?: { force?: boolean; showLoading?: boolean }) => {
      const { force = false, showLoading = true } = options || {};
      if (!force) {
        const cached = await loadCache();
        if (cached) return;
      }

      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const articleRes = await contentApi.listArticles({
          page: 1,
          per_page: ARTICLE_PAGE_SIZE,
          search: searchQuery || undefined,
        });

        setArticles(articleRes.data);
        setArticlePagination(articleRes.pagination);

        await saveCache({
          key: cacheKey,
          cachedAt: Date.now(),
          articles: articleRes.data,
          articlePagination: articleRes.pagination,
        });
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : '获取内容失败';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [cacheKey, loadCache, saveCache, searchQuery],
  );

  const fetchVideos = useCallback(
    async (options?: { force?: boolean; showLoading?: boolean }) => {
      const { showLoading = true } = options || {};

      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const videoRes = await contentApi.listVideos({
          page: 1,
          per_page: ARTICLE_PAGE_SIZE,
          search: searchQuery || undefined,
        });
        setVideos(videoRes.data);
        setVideoPagination(videoRes.pagination);
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : '获取视频失败';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery],
  );

  // ── Event handlers ──

  const refreshByTab = useCallback(
    async (options?: { force?: boolean; showLoading?: boolean }) => {
      if (activeTab === 'article') {
        await fetchContent(options);
      } else {
        await fetchVideos(options);
      }
    },
    [activeTab, fetchContent, fetchVideos],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshByTab({ force: true, showLoading: false });
    } finally {
      setRefreshing(false);
    }
  }, [refreshByTab]);

  const handleSearchSubmit = useCallback(() => {
    const query = searchText.trim();
    setSearchQuery(query);
    if (query) {
      setSearching(true);
      setLoading(true);
      setError(null);

      const promises: Promise<any>[] = [];
      if (features.classroom_article) {
        promises.push(contentApi.listArticles({ page: 1, per_page: ARTICLE_PAGE_SIZE, search: query }));
      } else {
        promises.push(Promise.resolve({ data: [], pagination: null }));
      }
      if (features.classroom_video) {
        promises.push(contentApi.listVideos({ page: 1, per_page: ARTICLE_PAGE_SIZE, search: query }));
      } else {
        promises.push(Promise.resolve({ data: [], pagination: null }));
      }

      Promise.all(promises)
        .then(([articleRes, videoRes]) => {
          const items: ContentItem[] = [
            ...articleRes.data.map((a: any) => ({ kind: 'article' as const, data: a })),
            ...videoRes.data.map((v: any) => ({ kind: 'video' as const, data: v })),
          ];
          setMixedItems(items);
          setArticles(articleRes.data);
          setArticlePagination(articleRes.pagination);
          setVideos(videoRes.data);
          setVideoPagination(videoRes.pagination);
        })
        .catch((fetchError) => {
          const message =
            fetchError instanceof Error ? fetchError.message : '搜索失败';
          setError(message);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setSearching(false);
      setMixedItems([]);
      if (activeTab === 'article') {
        fetchContent({ force: true });
      } else {
        fetchVideos({ force: true });
      }
    }
  }, [searchText, activeTab, fetchContent, fetchVideos, features.classroom_article, features.classroom_video]);

  const handleTabChange = useCallback(
    (tab: 'article' | 'video') => {
      setActiveTab(tab);
      setSearching(false);
      setMixedItems([]);
      setSearchText('');
      setSearchQuery('');
      if (tab === 'article' && articles.length === 0) {
        fetchContent({ force: true });
      } else if (tab === 'video' && videos.length === 0) {
        fetchVideos({ force: true });
      }
    },
    [articles.length, fetchContent, fetchVideos, videos.length],
  );

  const handleItemPress = useCallback((item: ContentItem) => {
    if (item.kind === 'article') {
      Taro.navigateTo({ url: `/pages/article-detail/index?id=${item.data.id}` });
    } else {
      Taro.navigateTo({ url: `/pages/video-detail/index?id=${item.data.id}` });
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    const pagination = activeTab === 'article' ? articlePagination : videoPagination;
    if (!pagination?.hasNext || loadingMore) return;
    const nextPage = (pagination.page || 1) + 1;
    setLoadingMore(true);
    try {
      if (activeTab === 'article') {
        const articleRes = await contentApi.listArticles({
          page: nextPage,
          per_page: ARTICLE_PAGE_SIZE,
          search: searchQuery || undefined,
        });
        const merged = [...articles, ...articleRes.data];
        setArticles(merged);
        setArticlePagination(articleRes.pagination);
        await saveCache({
          key: cacheKey,
          cachedAt: Date.now(),
          articles: merged,
          articlePagination: articleRes.pagination,
        });
      } else {
        const videoRes = await contentApi.listVideos({
          page: nextPage,
          per_page: ARTICLE_PAGE_SIZE,
          search: searchQuery || undefined,
        });
        setVideos([...videos, ...videoRes.data]);
        setVideoPagination(videoRes.pagination);
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : '加载更多失败';
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeTab,
    articlePagination,
    articles,
    cacheKey,
    loadingMore,
    saveCache,
    searchQuery,
    videoPagination,
    videos,
  ]);

  // ── Bootstrap ──

  useEffect(() => {
    if (features.classroom_article) {
      fetchContent({ force: false });
    } else if (features.classroom_video) {
      fetchVideos({ force: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived state ──

  const displayItems: ContentItem[] = searching
    ? mixedItems.filter((item) => {
        if (item.kind === 'article') return features.classroom_article;
        if (item.kind === 'video') return features.classroom_video;
        return true;
      })
    : activeTab === 'article'
      ? (features.classroom_article ? articles.map((a) => ({ kind: 'article' as const, data: a })) : [])
      : (features.classroom_video ? videos.map((v) => ({ kind: 'video' as const, data: v })) : []);

  const isEmpty = !loading && displayItems.length === 0;
  const total =
    activeTab === 'article'
      ? articlePagination?.total ?? 0
      : videoPagination?.total ?? 0;
  const hasNext =
    !searching &&
    (activeTab === 'article'
      ? articlePagination?.hasNext
      : videoPagination?.hasNext);

  // ── Render ──

  return (
    <OrganicBackground variant="morning">
      <ScrollView
        className="page-classroom__scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
      >
        <View className="page-classroom__inner">
            {/* ──── Title row ──── */}
            <View className="page-classroom__status-spacer" />
            <View className="page-classroom__title-row">
              <Text className="page-classroom__title">在线课堂</Text>
              <View
                className="page-classroom__refresh-btn"
                onClick={handleRefresh}
                hoverClass="page-classroom__refresh-btn--pressed"
              >
                <Text className="page-classroom__refresh-icon">{'\u{21BB}'}</Text>
                <Text className="page-classroom__refresh-text">刷新</Text>
              </View>
            </View>

            {/* ──── Search ──── */}
            <Input
              placeholder="搜索文章"
              containerStyle={{ marginTop: '12px', marginBottom: '4px' }}
              value={searchText}
              onInput={(e: { detail: { value: string } }) =>
                setSearchText(e.detail.value)
              }
              onConfirm={handleSearchSubmit}
              confirmType="search"
              leftIcon={'\u{1F50D}'}
            />

            {/* ──── Tab switches ──── */}
            <View className="page-classroom__category-row">
              {features.classroom_article && (
                <OrganicChipButton
                  label="文章"
                  active={activeTab === 'article'}
                  onPress={() => handleTabChange('article')}
                />
              )}
              {features.classroom_video && (
                <OrganicChipButton
                  label="视频"
                  active={activeTab === 'video'}
                  onPress={() => handleTabChange('video')}
                />
              )}
            </View>

            {/* ──── Error banner ──── */}
            {error && (
              <OrganicCard
                variant="soft"
                shadow={false}
                style={{ marginTop: '12px', paddingTop: 8, paddingBottom: 8 }}
              >
                <View className="page-classroom__error-banner">
                  <Text className="page-classroom__error-text">{error}</Text>
                  <View
                    onClick={() => refreshByTab({ force: true })}
                    hoverClass="page-classroom__retry-btn--pressed"
                  >
                    <Text className="page-classroom__error-retry">重试</Text>
                  </View>
                </View>
              </OrganicCard>
            )}

            {/* ──── Section header ──── */}
            <View className="page-classroom__section-header">
              <Text className="page-classroom__section-title">
                {activeTab === 'article' ? '精选文章' : '精选视频'}
              </Text>
              <Text className="page-classroom__section-meta">
                共 {total} 条
              </Text>
            </View>

            {/* ──── Content: loading / empty / list ──── */}
            {loading && displayItems.length === 0 ? (
              <View className="page-classroom__loading-row">
                <View className="page-classroom__spinner" />
                <Text className="page-classroom__loading-text">加载中...</Text>
              </View>
            ) : isEmpty ? (
              <OrganicCard variant="ghost" shadow={false} style={{ marginTop: '8px' }}>
                <Text className="page-classroom__empty-text">暂无内容</Text>
              </OrganicCard>
            ) : (
              <View className="page-classroom__article-list">
                {displayItems.map((item) => (
                  <OrganicCard
                    key={`${item.kind}-${item.data.id}`}
                    shadow={false}
                    style={{ paddingTop: 8, paddingBottom: 8 }}
                  >
                    <View
                      className="page-classroom__article-pressable"
                      onClick={() => handleItemPress(item)}
                      hoverClass="page-classroom__article-pressable--pressed"
                    >
                      {/* Thumbnail */}
                      {item.kind === 'article' && item.data.coverUrl ? (
                        <Image
                          src={item.data.coverUrl}
                          className="page-classroom__article-thumb"
                          mode="aspectFill"
                          lazyLoad
                        />
                      ) : (
                        <View className="page-classroom__article-thumb page-classroom__thumb-center">
                          <Text className="page-classroom__thumb-icon">
                            {item.kind === 'video' ? '\u{25B6}' : '\u{1F4D6}'}
                          </Text>
                        </View>
                      )}

                      {/* Body */}
                      <View className="page-classroom__article-body">
                        <Text className="page-classroom__article-title">
                          {item.data.title}
                        </Text>
                        <Text className="page-classroom__article-meta">
                          {item.kind === 'article'
                            ? buildArticleMeta(item.data)
                            : item.data.description || '视频'}
                        </Text>
                      </View>

                      {/* Arrow */}
                      <Text className="page-classroom__article-arrow">{'\u{203A}'}</Text>
                    </View>
                  </OrganicCard>
                ))}
              </View>
            )}

            {/* ──── Load more ──── */}
            {hasNext && (
              <View className="page-classroom__load-more">
                <OrganicButton
                  title={loadingMore ? '加载中...' : '加载更多'}
                  onPress={handleLoadMore}
                  variant="secondary"
                  disabled={loadingMore}
                  style={{ minWidth: 140 }}
                />
              </View>
            )}

            {/* bottom safe-area spacer */}
            <View className="page-classroom__bottom-spacer" />
        </View>
      </ScrollView>
    </OrganicBackground>
  );
}
