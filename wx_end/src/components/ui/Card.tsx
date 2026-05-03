/**
 * Card 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: View with CSS shadow/borderRadius via className
 * Props 接口保持与 RN 原版一致
 */

import React from 'react';
import { View } from '@tarojs/components';
import './styles/card.scss';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const PADDING_MAP: Record<string, number> = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padding = 'lg',
}) => {
  const cardClass = ['card', `card--${variant}`].filter(Boolean).join(' ');

  return (
    <View
      className={cardClass}
      style={{ padding: PADDING_MAP[padding], ...style }}
    >
      {children}
    </View>
  );
};
