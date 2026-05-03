/**
 * OrganicBackground 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: LinearGradient → CSS linear-gradient, blobs → View + CSS filter: blur()
 * Props 接口保持与 RN 原版一致
 */

import React from 'react';
import { View } from '@tarojs/components';

import './styles/organic-bg.scss';

interface OrganicBackgroundProps {
  children?: React.ReactNode;
  variant?: 'morning' | 'sunset' | 'mint' | 'sky';
}

export const OrganicBackground: React.FC<OrganicBackgroundProps> = ({
  children,
  variant = 'morning',
}) => {
  const containerClass = ['organic-bg', `organic-bg--${variant}`]
    .filter(Boolean)
    .join(' ');

  const gradientClass = `organic-bg__gradient organic-bg__gradient--${variant}`;

  return (
    <View className={containerClass}>
      {/* 主渐变背景 */}
      <View className={gradientClass} />

      {/* 装饰性有机形状 - 左上 */}
      <View className="organic-bg__blob organic-bg__blob--large organic-bg__blob--top-left" />
      <View className="organic-bg__blob organic-bg__blob--small organic-bg__blob--top-left" />

      {/* 装饰性有机形状 - 右下 */}
      <View className="organic-bg__blob organic-bg__blob--large organic-bg__blob--bottom-right" />
      <View className="organic-bg__blob organic-bg__blob--small organic-bg__blob--bottom-right" />

      {/* 内容层 */}
      <View className="organic-bg__content">
        {children}
      </View>
    </View>
  );
};

/**
 * 卡片式有机背景装饰
 */
export const OrganicCardDecoration: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <View className="organic-card-decoration">
      <View className="organic-card-decoration__glow" />
      <View className="organic-card-decoration__content">
        {children}
      </View>
    </View>
  );
};
