/**
 * Tag 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: View + Text, pure CSS styling
 * Props 接口保持与 RN 原版一致
 */

import React from 'react';
import { View, Text } from '@tarojs/components';
import './styles/tag.scss';

interface TagProps {
  label: string;
  variant?: 'default' | 'primary' | 'accent' | 'muted';
  size?: 'small' | 'medium';
  style?: React.CSSProperties;
  textStyle?: React.CSSProperties;
}

export const Tag: React.FC<TagProps> = ({
  label,
  variant = 'default',
  size = 'small',
  style,
  textStyle,
}) => {
  const tagClass = ['tag', `tag--${variant}`, `tag--${size}`]
    .filter(Boolean)
    .join(' ');

  const textClass = ['tag__text']
    .filter(Boolean)
    .join(' ');

  return (
    <View className={tagClass} style={style}>
      <Text className={textClass} style={textStyle}>
        {label}
      </Text>
    </View>
  );
};
