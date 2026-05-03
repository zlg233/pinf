/**
 * Button 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: TouchableOpacity → View + hoverClass, ActivityIndicator → CSS spinner
 * Props 接口保持与 RN 原版一致
 */

import React from 'react';
import { View, Text } from '@tarojs/components';
import './styles/button.scss';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  textStyle?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const buttonClass = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    isDisabled ? 'btn--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const textClass = [
    'btn__text',
    `btn__text--${size}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View
      className={buttonClass}
      hoverClass="button-hover"
      onClick={isDisabled ? undefined : onPress}
      style={style}
    >
      {loading ? (
        <View className="btn__loading" />
      ) : (
        <View className="btn__content">
          {icon && <View className="btn__icon">{icon}</View>}
          <Text className={textClass} style={textStyle}>
            {title}
          </Text>
        </View>
      )}
    </View>
  );
};
