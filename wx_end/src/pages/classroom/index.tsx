/**
 * 在线课堂页面 (Taro/WeChat Mini-Program)
 *
 * 文章/视频浏览，支持搜索、缓存、分页加载、下拉刷新。
 * 从 React Native 迁移: expo-router → Taro.navigateTo,
 * RN RefreshControl → ScrollView refresherEnabled,
 * RN AsyncStorage → Taro.getStorageSync/setStorageSync,
 * RN IconSymbol → Unicode 文本符号
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { isVideoEntryEnabled, shouldLeaveClassroom } from '@/domain/features/switches';
import { CONTENT_CATEGORIES } from '@/constants/content-categories';

import './index.scss';

// ── Constants ──

const ARTICLE_PAGE_SIZE = 8;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_STORAGE_KEY = 'content_cache';
const ARTICLE_CATEGORIES = CONTENT_CATEGORIES;

// ── Types ──

type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];
type ArticleCategoryFilter = ArticleCategory | '';

const ARTICLE_CATEGORY_OPTIONS: ReadonlyArray<{
  label: string;
  value: ArticleCategoryFilter;
}> = [
  { label: '全部', value: '' },
  ...ARTICLE_CATEGORIES.map((category) => ({ label: category, value: category })),
];

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

const buildCacheKey = (search: string, tab: string, category: string) =>
  `${search.trim()}|${tab.trim()}|${category.trim()}`;

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
  const { features, loaded: featuresLoaded } = useFeaturesStore();
  // 视频入口：必须开关已从后端加载完成且后端明确开启才可见（个人主体审核要求）
  const videoEnabled = isVideoEntryEnabled(features, featuresLoaded);
  const articleEnabled = features.classroom_article;
  const shouldExit = shouldLeaveClassroom(features, featuresLoaded);

  // 文章与视频都被后端关闭时退回首页。
  // 注意：不能写成 hooks 之前的条件 return，否则开关状态变化会改变 Hook 数量导致白屏。
  useEffect(() => {
    if (shouldExit) {
      Taro.switchTab({ url: '/pages/index/index' });
    }
  }, [shouldExit]);

  // ── State ──
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'article' | 'video'>(
    articleEnabled ? 'article' : 'video'
  );
  const [activeCategory, setActiveCategory] = useState<ArticleCategoryFilter>('');
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

  const previousCategoryRef = useRef<ArticleCategoryFilter>(activeCategory);
  // "只开视频"配置下只自动补拉一次，避免请求失败后 effect 反复重试
  const autoVideoFetchRef = useRef(false);
  const cacheKey = useMemo(
    () => buildCacheKey(searchQuery, activeTab, activeCategory),
    [searchQuery, activeTab, activeCategory],
  );

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
          category: activeCategory || undefined,
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
    [activeCategory, cacheKey, loadCache, saveCache, searchQuery],
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
          category: activeCategory || undefined,
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
    [activeCategory, searchQuery],
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
      if (articleEnabled) {
        promises.push(contentApi.listArticles({
          page: 1,
          per_page: ARTICLE_PAGE_SIZE,
          search: query,
          category: activeCategory || undefined,
        }));
      } else {
        promises.push(Promise.resolve({ data: [], pagination: null }));
      }
      if (videoEnabled) {
        promises.push(
          contentApi.listVideos({
            page: 1,
            per_page: ARTICLE_PAGE_SIZE,
            search: query,
            category: activeCategory || undefined,
          }),
        );
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
  }, [activeCategory, searchText, activeTab, fetchContent, fetchVideos, articleEnabled, videoEnabled]);

  const handleCategoryChange = useCallback(
    (category: ArticleCategoryFilter) => {
      if (category === activeCategory) return;
      setSearching(false);
      setMixedItems([]);
      setSearchText('');
      setSearchQuery('');
      setArticles([]);
      setArticlePagination(null);
      setActiveCategory(category);
    },
    [activeCategory],
  );

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
          category: activeCategory || undefined,
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
          category: activeCategory || undefined,
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
    activeCategory,
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
    if (articleEnabled) {
      fetchContent({ force: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 文章被后端关闭、只开视频时：等开关加载完成后再切到视频 tab
  useEffect(() => {
    if (!featuresLoaded) return;
    if (!articleEnabled && videoEnabled && activeTab !== 'video') {
      setActiveTab('video');
    }
  }, [featuresLoaded, articleEnabled, videoEnabled, activeTab]);

  // "只开视频"配置下补拉一次列表（切 tab 后 deps 变化会再进一次，用 ref 防重复）
  useEffect(() => {
    if (!featuresLoaded || articleEnabled || !videoEnabled) return;
    if (activeTab !== 'video' || autoVideoFetchRef.current) return;
    autoVideoFetchRef.current = true;
    fetchVideos({ force: false });
  }, [featuresLoaded, articleEnabled, videoEnabled, activeTab, fetchVideos]);

  useEffect(() => {
    if (previousCategoryRef.current === activeCategory) return;
    previousCategoryRef.current = activeCategory;
    if (activeTab === 'article') {
      fetchContent({ force: true });
    } else if (activeTab === 'video') {
      fetchVideos({ force: true });
    }
  }, [activeCategory, activeTab, fetchContent, fetchVideos]);

  // ── Derived state ──

  const displayItems: ContentItem[] = searching
    ? mixedItems.filter((item) => {
        if (item.kind === 'article') return articleEnabled;
        if (item.kind === 'video') return videoEnabled;
        return true;
      })
    : activeTab === 'article'
      ? (articleEnabled ? articles.map((a) => ({ kind: 'article' as const, data: a })) : [])
      : (videoEnabled ? videos.map((v) => ({ kind: 'video' as const, data: v })) : []);

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

  // 兜底：文章与视频都被关闭（放在所有 Hook 之后，保持 Hook 数量稳定）
  if (shouldExit) {
    return null;
  }

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
              {articleEnabled && (
                <OrganicChipButton
                  label="文章"
                  active={activeTab === 'article'}
                  onPress={() => handleTabChange('article')}
                />
              )}
              {videoEnabled && (
                <OrganicChipButton
                  label="视频"
                  active={activeTab === 'video'}
                  onPress={() => handleTabChange('video')}
                />
              )}
            </View>

            {/* 文章与视频共用同一套出院状态分类 */}
            {((activeTab === 'article' && articleEnabled) || (activeTab === 'video' && videoEnabled)) && (
              <View className="page-classroom__category-row">
                {ARTICLE_CATEGORY_OPTIONS.map((option) => (
                  <OrganicChipButton
                    key={option.value || 'all'}
                    label={option.label}
                    active={activeCategory === option.value}
                    onPress={() => handleCategoryChange(option.value)}
                  />
                ))}
              </View>
            )}

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
