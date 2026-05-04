import React from 'react';
import { View, Text } from '@tarojs/components';
import './FloatingActionButton.scss';

interface FloatingActionButtonProps {
  icon?: string;
  label?: string;
  onClick: () => void;
  visible?: boolean;
  style?: Record<string, string>;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon = '+',
  label = '添加',
  onClick,
  visible = true,
  style,
}) => {
  const containerClass = [
    'floating-action-btn',
    !visible ? 'floating-action-btn--hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className={containerClass} style={style} onClick={onClick} hoverClass="floating-action-btn--pressed">
      <Text className="floating-action-btn__icon">{icon}</Text>
      {label && <Text className="floating-action-btn__label">{label}</Text>}
    </View>
  );
};
