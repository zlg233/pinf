/**
 * OrganicCard 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: Animated scale → CSS :active + transition, LinearGradient → CSS linear-gradient
 * Props 接口保持与 RN 原版一致
 */

import React from 'react';
import { View, Text } from '@tarojs/components';

import './styles/organic-card.scss';

interface OrganicCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'gradient' | 'glass' | 'soft' | 'ghost';
  onPress?: () => void;
  style?: React.CSSProperties;
  shadow?: boolean;
  contentFill?: boolean;
}

export const OrganicCard: React.FC<OrganicCardProps> = ({
  children,
  variant = 'default',
  onPress,
  style,
  shadow = true,
  contentFill = false,
}) => {
  const cardClass = [
    'organic-card',
    `organic-card--${variant}`,
    shadow ? 'organic-card--shadow' : '',
    onPress ? 'organic-card--pressable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const contentClass = [
    'organic-card__content',
    contentFill ? 'organic-card__content--fill' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const overlayClass = {
    gradient: 'organic-card__overlay--gradient',
    glass: 'organic-card__overlay--glass',
    soft: 'organic-card__overlay--soft',
    ghost: 'organic-card__overlay--ghost',
  }[variant];

  const overlays: React.ReactNode[] = [];
  if (overlayClass && variant !== 'ghost') {
    overlays.push(<View key={variant} className={`organic-card__overlay ${overlayClass}`} />);
  }

  const normalizedChildren = React.Children.toArray(children).filter((child) => {
    return typeof child !== 'string' || child.trim().length > 0;
  });

  const cardContent = (
    <>
      {overlays}
      <View className={contentClass}>{normalizedChildren}</View>
    </>
  );

  if (onPress) {
    return (
      <View
        className={cardClass}
        hoverClass="organic-card--pressed"
        onClick={onPress}
        style={style}
      >
        {cardContent}
      </View>
    );
  }

  return (
    <View className={cardClass} style={style}>
      {cardContent}
    </View>
  );
};

/**
 * 简洁的卡片标题组件
 */
export const OrganicCardHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => {
  return (
    <View className="organic-card-header">
      <View className="organic-card-header__text">
        <Text className="organic-card-header__title">{title}</Text>
        {subtitle && <Text className="organic-card-header__subtitle">{subtitle}</Text>}
      </View>
      {action && <View className="organic-card-header__action">{action}</View>}
    </View>
  );
};
