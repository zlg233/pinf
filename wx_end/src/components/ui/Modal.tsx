/**
 * Modal 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: RN Modal → 自定义 View overlay, RN Animated → CSS transition
 * Props 接口保持与 RN 原版一致
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './styles/modal.scss';

const TRANSITION_DURATION = 300; // ms, 与 CSS transition 匹配

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: number | 'auto';
  containerStyle?: React.CSSProperties;
  position?: 'bottom' | 'top';
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  height = 'auto',
  containerStyle,
  position = 'bottom',
}) => {
  const systemInfo = Taro.getSystemInfoSync();
  const screenHeight = systemInfo.windowHeight;

  const [mounted, setMounted] = useState(false);
  const [animatingIn, setAnimatingIn] = useState(false);

  // 控制挂载与动画状态
  useEffect(() => {
    if (visible && !mounted) {
      setMounted(true);
      // 下一帧触发进入动画
      requestAnimationFrame(() => {
        setAnimatingIn(true);
      });
    } else if (!visible && mounted) {
      setAnimatingIn(false);
      // 等待过渡动画完成后卸载
      const timer = setTimeout(() => {
        setMounted(false);
      }, TRANSITION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [visible, mounted]);

  // 计算高度样式
  const isAutoHeight = height === 'auto';
  const contentHeightStyle: React.CSSProperties = isAutoHeight
    ? { minHeight: 200, maxHeight: screenHeight * 0.85 }
    : { height: typeof height === 'number' ? height : screenHeight * 0.85 };

  // 构建 overlay class
  const overlayClass = [
    'modal__overlay',
    position === 'top' ? 'modal__overlay--top' : 'modal__overlay--bottom',
    animatingIn ? 'modal__overlay--visible' : 'modal__overlay--hidden',
  ]
    .filter(Boolean)
    .join(' ');

  // 构建 content class
  const hiddenClass = position === 'top' ? 'modal__content--hidden-top' : 'modal__content--hidden-bottom';
  const contentClass = [
    'modal__content',
    position === 'top' ? 'modal__content--top' : '',
    animatingIn ? 'modal__content--visible' : hiddenClass,
  ]
    .filter(Boolean)
    .join(' ');

  // 渲染子元素
  const renderChildren = useCallback(() => {
    // Taro 版本简化：直接渲染子元素，由 CSS 处理布局
    return children;
  }, [children]);

  if (!mounted) {
    return null;
  }

  return (
    <View className={overlayClass}>
      {/* 点击背景关闭 */}
      <View className="modal__backdrop" onClick={onClose} />

      {/* 弹窗内容区域 */}
      <View
        className={contentClass}
        style={{ ...contentHeightStyle, ...containerStyle }}
      >
        {/* 标题栏 */}
        {title && (
          <View className="modal__header">
            <Text className="modal__title">{title}</Text>
            <View className="modal__close-button" onClick={onClose}>
              <Text className="modal__close-icon">✕</Text>
            </View>
          </View>
        )}

        {/* 内容区 */}
        <View className={`modal__body${!isAutoHeight ? ' modal__body--fill' : ''}`}>
          {renderChildren()}
        </View>
      </View>
    </View>
  );
};
