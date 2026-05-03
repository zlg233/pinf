/**
 * OrganicButton 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: Animated.spring → CSS :active + transition,
 * LinearGradient → CSS background: linear-gradient, ActivityIndicator → CSS spinner
 * Props 接口保持与 RN 原版一致
 */

import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './styles/organic-button.scss';

interface OrganicButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'soft';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const OrganicButton: React.FC<OrganicButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  style,
  icon,
  iconPosition = 'left',
}) => {
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) return;
    Taro.vibrateShort({ type: 'light' }).catch(() => {});
    onPress();
  };

  const buttonClass = [
    'organic-btn',
    `organic-btn--${variant}`,
    `organic-btn--${size}`,
    isDisabled ? 'organic-btn--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const textClass = [
    'organic-btn__text',
    `organic-btn__text--${size}`,
    isDisabled ? 'organic-btn__text--disabled' : '',
    (variant === 'primary' || variant === 'secondary') && !isDisabled ? 'organic-btn__text--light' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderContent = () => {
    if (loading) {
      const spinnerClass = [
        'organic-btn__spinner',
        (variant === 'primary' || variant === 'secondary') && !isDisabled
          ? 'organic-btn__spinner--light'
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      return <View className={spinnerClass} />;
    }

    return (
      <View className="organic-btn__content">
        {icon && iconPosition === 'left' && (
          <View className="organic-btn__icon organic-btn__icon--left">{icon}</View>
        )}
        <Text className={textClass}>{title}</Text>
        {icon && iconPosition === 'right' && (
          <View className="organic-btn__icon organic-btn__icon--right">{icon}</View>
        )}
      </View>
    );
  };

  return (
    <View
      className={buttonClass}
      hoverClass="organic-btn--pressed"
      onClick={handlePress}
      style={style}
    >
      {renderContent()}
    </View>
  );
};

/**
 * 胶囊标签按钮
 */
export const OrganicChipButton: React.FC<{
  label: string;
  active?: boolean;
  onPress: () => void;
}> = ({ label, active = false, onPress }) => {
  const chipClass = ['organic-chip-btn', active ? 'organic-chip-btn--active' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <View className={chipClass} hoverClass="organic-chip-btn--pressed" onClick={onPress}>
      <Text className={`organic-chip-btn__text${active ? ' organic-chip-btn__text--active' : ''}`}>
        {label}
      </Text>
    </View>
  );
};
