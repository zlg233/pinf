/**
 * AI 问答页面 (Taro/WeChat Mini-Program)
 *
 * 从 React Native 迁移：
 * - KeyboardAvoidingView -> 移除（小程序自动处理）
 * - RN TextInput 多行 -> Taro <Textarea> autoHeight
 * - RN ScrollView + ref.scrollToEnd -> scroll-into-view 属性
 * - ActivityIndicator -> 自定义 CSS spinner
 * - Reanimated 动画 -> CSS transition/animation
 * - useFeedback context -> @/utils/feedback（confirm/notify）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { OrganicBackground } from '@/components/ui/OrganicBackground';
import { getChatHistory, sendChatMessage, clearChatHistory } from '@/services/api/chat';
import { useAuthStore } from '@/store';
import { useBabyStore } from '@/store/babyStore';
import { confirm, notify } from '@/utils/feedback';

import type { ChatHistoryItem, ChatMessage } from '@/types/chat';

import './index.scss';

// ── 常量 ──

const HISTORY_PAGE_SIZE = 100;
const LOCAL_GREETING_ID = -1;

// ── 类型 ──

interface UiMessage extends ChatMessage {
  pending?: boolean;
  localOnly?: boolean;
}

// ── 工具函数 ──

const createGreetingMessage = (): UiMessage => ({
  id: LOCAL_GREETING_ID,
  messageId: 'local-greeting',
  role: 'ai',
  content: '你好，我是育儿问答助手。你可以直接输入问题，我会尽快回复。',
  timestamp: 0,
  status: 'sent',
  localOnly: true,
});

const createOptimisticMessage = (content: string): UiMessage => ({
  id: -Date.now(),
  messageId: `local-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
  role: 'user',
  content,
  timestamp: Date.now(),
  status: 'sent',
  pending: true,
  localOnly: true,
});

const toHistoryPayload = (messages: UiMessage[]): ChatHistoryItem[] =>
  messages
    .filter((item) => !item.localOnly && !item.pending)
    .slice(-20)
    .map((item) => ({
      role: item.role,
      content: item.content,
      timestamp: item.timestamp,
      messageId: item.messageId,
    }));

const sortByTimestamp = (messages: UiMessage[]) =>
  [...messages].sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return a.id - b.id;
    }
    return a.timestamp - b.timestamp;
  });

const formatTime = (timestamp: number) => {
  if (timestamp <= 0) return '';
  const date = new Date(timestamp);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
};

// ── 页面组件 ──

export default function QAPage() {
  const { currentBaby } = useBabyStore();
  const { user } = useAuthStore();

  const [messages, setMessages] = useState<UiMessage[]>([createGreetingMessage()]);
  const [draft, setDraft] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formError, setFormError] = useState('');

  const babyId = currentBaby?.id;
  const headerSubtitle = useMemo(
    () => (currentBaby ? `${currentBaby.name} 的会话` : '通用会话'),
    [currentBaby],
  );
  const userDisplayName = useMemo(() => user?.name?.trim() || '我', [user?.name]);

  // ── 加载历史记录 ──

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setFormError('');
    try {
      const { messages: history } = await getChatHistory({
        page: 1,
        per_page: HISTORY_PAGE_SIZE,
        babyId,
      });

      if (history.length === 0) {
        setMessages([createGreetingMessage()]);
      } else {
        setMessages(sortByTimestamp(history as UiMessage[]));
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || '加载聊天记录失败，请稍后重试';
      setFormError(message);
      setMessages([createGreetingMessage()]);
      notify(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [babyId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── 发送消息（乐观更新） ──

  const handleSend = async () => {
    if (isSending) return;

    const content = draft.trim();
    if (!content) {
      setFormError('请输入问题后再发送');
      return;
    }

    setFormError('');
    setDraft('');
    Taro.hideKeyboard();

    // 乐观创建用户消息，立即显示
    const optimisticMessage = createOptimisticMessage(content);
    setMessages((prev) => sortByTimestamp([...prev, optimisticMessage]));
    setIsSending(true);

    try {
      const data = await sendChatMessage({
        content,
        babyId,
        messageId: optimisticMessage.messageId,
        history: toHistoryPayload(messages),
      });

      // 替换乐观消息为真实消息，追加 AI 回复
      setMessages((prev) => {
        const next = prev.filter(
          (item) => item.messageId !== optimisticMessage.messageId,
        );
        next.push(data.userMessage as UiMessage);
        next.push(data.aiMessage as UiMessage);
        return sortByTimestamp(next);
      });
    } catch (error: any) {
      // 标记用户消息为失败状态
      const message = error?.response?.data?.message || '发送失败，请稍后重试';
      setMessages((prev) =>
        prev.map((item) =>
          item.messageId === optimisticMessage.messageId
            ? { ...item, pending: false, status: 'failed' }
            : item,
        ),
      );
      setFormError(message);
      notify(message);
    } finally {
      setIsSending(false);
    }
  };

  // ── 清空会话 ──

  const handleClearHistory = async () => {
    if (isSending || isLoadingHistory) return;

    const confirmed = await confirm('清空后将无法恢复该会话内容。', '清空当前会话？');
    if (!confirmed) return;

    try {
      await clearChatHistory({ babyId });
      setMessages([createGreetingMessage()]);
      setFormError('');
      notify('会话已清空');
    } catch (error: any) {
      const message = error?.response?.data?.message || '清空失败，请稍后重试';
      setFormError(message);
      notify(message);
    }
  };

  // ── 事件处理 ──

  const handleGoBack = () => {
    Taro.navigateBack();
  };

  const handleDraftInput = (e: any) => {
    const text = e.detail.value;
    setDraft(text);
    if (formError) setFormError('');
  };

  // ── 计算属性 ──

  const canSend = draft.trim().length > 0 && !isSending && !isLoadingHistory;
  const lastMessageId =
    messages.length > 0 ? messages[messages.length - 1].messageId : '';
  const scrollTargetId = lastMessageId ? `msg-${lastMessageId}` : '';

  // ── 消息气泡渲染 ──

  const renderMessageBubble = (message: UiMessage, index: number) => {
    const isUser = message.role === 'user';
    const isFailed = message.status === 'failed';

    return (
      <View
        key={`${message.messageId}-${message.id}`}
        id={`msg-${message.messageId}`}
        className={`page-qa__message-row${isUser ? ' page-qa__message-row--user' : ''}`}
      >
        {/* 头像 */}
        <View
          className={`page-qa__avatar${isUser ? ' page-qa__avatar--user' : ' page-qa__avatar--ai'}`}
        >
          <Text className="page-qa__avatar-icon">
            {isUser ? '\u{1F464}' : '\u2600\uFE0F'}
          </Text>
        </View>

        {/* 消息主体 */}
        <View
          className={`page-qa__message-main${isUser ? ' page-qa__message-main--user' : ''}`}
        >
          {/* 气泡 */}
          <View
            className={`page-qa__bubble${isUser ? ' page-qa__bubble--user' : ' page-qa__bubble--ai'}${isFailed ? ' page-qa__bubble--failed' : ''}`}
          >
            <Text
              className={`page-qa__bubble-text${isUser ? ' page-qa__bubble-text--user' : ' page-qa__bubble-text--ai'}`}
            >
              {message.content}
            </Text>
          </View>

          {/* 元信息：时间 + 状态 */}
          <View
            className={`page-qa__meta-row${isUser ? ' page-qa__meta-row--user' : ''}`}
          >
            <Text className="page-qa__time-text">
              {formatTime(message.timestamp)}
            </Text>
            {message.pending && (
              <View className="page-qa__pending-container">
                <View className="page-qa__spinner" />
                <Text className="page-qa__pending-text">发送中</Text>
              </View>
            )}
            {isFailed && (
              <Text className="page-qa__failed-text">发送失败</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── 渲染 ──

  return (
    <OrganicBackground variant="morning">
      <View className="page-qa">
        {/* ═══════════════════════════════════════════
            头部
            ═══════════════════════════════════════════ */}
        <View className="page-qa__header">
          <View
            className="page-qa__back-btn"
            onClick={handleGoBack}
            hoverClass="page-qa__back-btn--pressed"
          >
            <Text className="page-qa__back-icon">{'\u2039'}</Text>
          </View>
          <View className="page-qa__header-info">
            <Text className="page-qa__title">智能育儿问答</Text>
            <Text className="page-qa__subtitle">
              {headerSubtitle} &middot; 当前用户：{userDisplayName}
            </Text>
          </View>
          <View
            className={`page-qa__clear-btn${isSending || isLoadingHistory ? ' page-qa__clear-btn--disabled' : ''}`}
            onClick={handleClearHistory}
            hoverClass="page-qa__clear-btn--pressed"
          >
            <Text className="page-qa__clear-btn-text">清空</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════
            聊天区域
            ═══════════════════════════════════════════ */}
        <View className="page-qa__chat-card">
          {isLoadingHistory ? (
            /* ---- 加载状态 ---- */
            <View className="page-qa__center-state">
              <View className="page-qa__loading-icon-wrap">
                <View className="page-qa__spinner page-qa__spinner--large" />
              </View>
              <Text className="page-qa__state-text">正在加载会话...</Text>
              <Text className="page-qa__state-subtext">正在获取聊天记录</Text>
            </View>
          ) : messages.length <= 1 ? (
            /* ---- 空状态 / 问候语 ---- */
            <View className="page-qa__center-state">
              <View className="page-qa__empty-icon-wrap">
                <Text className="page-qa__empty-icon">{'\u{1F44B}'}</Text>
              </View>
              <Text className="page-qa__empty-title">开始你的育儿问答</Text>
              <Text className="page-qa__empty-subtext">
                输入关于宝宝喂养、护理、发育等问题{'\n'}AI
                助手会为你提供专业建议
              </Text>
            </View>
          ) : (
            /* ---- 消息列表 ---- */
            <ScrollView
              className="page-qa__chat-scroll"
              scrollY
              scrollIntoView={scrollTargetId}
              scrollWithAnimation
            >
              <View className="page-qa__chat-content">
                {messages.map((message, index) =>
                  renderMessageBubble(message, index),
                )}
              </View>
            </ScrollView>
          )}
        </View>

        {/* ═══════════════════════════════════════════
            输入区域
            ═══════════════════════════════════════════ */}
        <View className="page-qa__composer">
          <View className="page-qa__input-row">
            <Textarea
              value={draft}
              onInput={handleDraftInput}
              placeholder="输入你的问题..."
              placeholderClass="page-qa__textarea-placeholder"
              autoHeight
              maxlength={-1}
              className="page-qa__textarea"
            />
            <View
              className={`page-qa__send-btn${!canSend ? ' page-qa__send-btn--disabled' : ''}`}
              onClick={canSend ? handleSend : undefined}
              hoverClass={canSend ? 'page-qa__send-btn--pressed' : undefined}
            >
              {isSending ? (
                <View className="page-qa__spinner page-qa__spinner--white" />
              ) : (
                <Text className="page-qa__send-icon">{'\u{1F4E8}'}</Text>
              )}
            </View>
          </View>

          {/* 错误 / 提示文字 */}
          <View className="page-qa__composer-footer">
            <Text
              className={`page-qa__helper-text${formError ? ' page-qa__helper-text--error' : ''}`}
            >
              {formError}
            </Text>
          </View>
        </View>
      </View>
    </OrganicBackground>
  );
}
