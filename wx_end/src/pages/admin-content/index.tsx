import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { OrganicCard } from '@/components/ui/OrganicCard';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { OrganicChipButton } from '@/components/ui/OrganicButton';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { notify } from '@/utils/feedback';
import { useAuthStore } from '@/store';
import { CONTENT_CATEGORIES, CATEGORY_FILTER_OPTIONS } from '@/constants/content-categories';
import { buildCategoryQuery, normalizeWriteCategory } from '@/domain/content/categories';
import * as adminApi from '@/services/api/admin-content';
import type { ContentArticle, ContentPagination, ContentVideo } from '@/types/content';

import './index.scss';

type Tab = 'article' | 'video';

const PAGE_SIZE = 10;

type EditableItem = ContentArticle | ContentVideo;

export default function AdminContentPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('article');
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [videos, setVideos] = useState<ContentVideo[]>([]);
  const [pagination, setPagination] = useState<ContentPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditableItem | null>(null);
  const [draftCategory, setDraftCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const items: EditableItem[] = tab === 'article' ? articles : videos;

  const requestParams = useMemo(
    () => ({
      search: searchQuery || undefined,
      ...buildCategoryQuery(categoryFilter),
    }),
    [searchQuery, categoryFilter],
  );

  const fetchList = useCallback(
    async (options?: { showLoading?: boolean }) => {
      if (!isAdmin) return;
      const { showLoading = true } = options || {};
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const params = { page: 1, per_page: PAGE_SIZE, ...requestParams };
        if (tab === 'article') {
          const res = await adminApi.listAdminArticles(params);
          setArticles(res.data);
          setPagination(res.pagination);
        } else {
          const res = await adminApi.listAdminVideos(params);
          setVideos(res.data);
          setPagination(res.pagination);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || '加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, requestParams, tab],
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearch = useCallback(() => {
    setSearchQuery(searchText.trim());
  }, [searchText]);

  const handleFilterChange = useCallback((value: string) => {
    setCategoryFilter(value);
  }, []);

  const handleTabChange = useCallback((next: Tab) => {
    setTab(next);
    setPagination(null);
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!pagination?.hasNext || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = { page: (pagination.page || 1) + 1, per_page: PAGE_SIZE, ...requestParams };
      if (tab === 'article') {
        const res = await adminApi.listAdminArticles(params);
        setArticles((prev) => [...prev, ...res.data]);
        setPagination(res.pagination);
      } else {
        const res = await adminApi.listAdminVideos(params);
        setVideos((prev) => [...prev, ...res.data]);
        setPagination(res.pagination);
      }
    } catch (err: any) {
      notify(err?.response?.data?.message || '加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, pagination, requestParams, tab]);

  const openEditor = useCallback((item: EditableItem) => {
    setEditing(item);
    setDraftCategory(item.category || '');
  }, []);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setDraftCategory('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    const nextCategory = normalizeWriteCategory(draftCategory);
    if (draftCategory.trim() && !nextCategory) {
      notify('请选择有效分类');
      return;
    }
    setSaving(true);
    try {
      if (tab === 'article') {
        const updated = await adminApi.updateArticleCategory(editing.id, nextCategory);
        setArticles((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, category: updated.category } : item)),
        );
      } else {
        const updated = await adminApi.updateVideoCategory(editing.id, nextCategory);
        setVideos((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, category: updated.category } : item)),
        );
      }
      notify('已更新');
      closeEditor();
    } catch (err: any) {
      notify(err?.response?.data?.message || '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [closeEditor, draftCategory, editing, tab]);

  if (!isAdmin) {
    return (
      <OrganicBackground variant="morning">
        <View className="admin-content">
          <View className="admin-content__header">
            <Text className="admin-content__title">内容管理</Text>
          </View>
          <OrganicCard variant="ghost" shadow={false}>
            <Text className="admin-content__empty">当前账号无管理权限</Text>
          </OrganicCard>
        </View>
      </OrganicBackground>
    );
  }

  return (
    <OrganicBackground variant="morning">
      <ScrollView className="admin-content__scroll" scrollY>
        <View className="admin-content__inner">
          <View className="admin-content__header">
            <Text className="admin-content__title">内容管理</Text>
            <Text className="admin-content__count">共 {pagination?.total ?? 0} 条</Text>
          </View>

          <View className="admin-content__tabs">
            <OrganicChipButton
              label="文章"
              active={tab === 'article'}
              onPress={() => handleTabChange('article')}
            />
            <OrganicChipButton
              label="视频"
              active={tab === 'video'}
              onPress={() => handleTabChange('video')}
            />
          </View>

          <Input
            placeholder="搜索标题"
            value={searchText}
            onInput={(e: { detail: { value: string } }) => setSearchText(e.detail.value)}
            onConfirm={handleSearch}
            confirmType="search"
            leftIcon={'\u{1F50D}'}
          />

          <View className="admin-content__filters">
            {CATEGORY_FILTER_OPTIONS.map((option) => (
              <OrganicChipButton
                key={option.value || 'all'}
                label={option.label}
                active={categoryFilter === option.value}
                onPress={() => handleFilterChange(option.value)}
              />
            ))}
          </View>

          {error && (
            <OrganicCard variant="soft" shadow={false}>
              <View className="admin-content__error">
                <Text className="admin-content__error-text">{error}</Text>
                <Text className="admin-content__retry" onClick={() => fetchList()}>
                  重试
                </Text>
              </View>
            </OrganicCard>
          )}

          {loading ? (
            <Text className="admin-content__loading">加载中...</Text>
          ) : items.length === 0 ? (
            <OrganicCard variant="ghost" shadow={false}>
              <Text className="admin-content__empty">暂无内容</Text>
            </OrganicCard>
          ) : (
            <View className="admin-content__list">
              {items.map((item) => (
                <OrganicCard key={item.id} shadow={false}>
                  <View className="admin-content__item">
                    <View className="admin-content__item-main">
                      <Text className="admin-content__item-title">{item.title}</Text>
                      <View className="admin-content__badge-row">
                        <View className="admin-content__badge">
                          <Text className="admin-content__badge-text">
                            {item.category || '未分类'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View
                      className="admin-content__edit-btn"
                      hoverClass="admin-content__edit-btn--pressed"
                      onClick={() => openEditor(item)}
                    >
                      <Text className="admin-content__edit-text">改分类</Text>
                    </View>
                  </View>
                </OrganicCard>
              ))}
            </View>
          )}

          {pagination?.hasNext && (
            <View className="admin-content__load-more">
              <OrganicButton
                title={loadingMore ? '加载中...' : '加载更多'}
                onPress={handleLoadMore}
                variant="secondary"
                disabled={loadingMore}
              />
            </View>
          )}

          <View className="admin-content__bottom-spacer" />
        </View>
      </ScrollView>

      <Modal visible={!!editing} onClose={closeEditor} title="设置分类">
        <View className="admin-content__modal">
          <Text className="admin-content__modal-title">{editing?.title}</Text>
          <View className="admin-content__filters">
            {CONTENT_CATEGORIES.map((category) => (
              <OrganicChipButton
                key={category}
                label={category}
                active={draftCategory === category}
                onPress={() => setDraftCategory(category)}
              />
            ))}
            <OrganicChipButton
              label="清空分类"
              active={draftCategory === ''}
              onPress={() => setDraftCategory('')}
            />
          </View>
          <Text className="admin-content__hint">
            视频分类将在课堂视频筛选上线后生效
          </Text>
          <OrganicButton
            title={saving ? '保存中...' : '保存'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />
        </View>
      </Modal>
    </OrganicBackground>
  );
}
