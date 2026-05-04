import React from 'react';
import { Text } from '@tarojs/components';
import { ICON_MAP, type IconName } from '@/constants/icon-map';

interface IconFontProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  onClick?: () => void;
}

export const IconFont: React.FC<IconFontProps> = ({
  name,
  size = 24,
  color,
  className,
  onClick,
}) => {
  const char = ICON_MAP[name];

  const style: React.CSSProperties = {
    fontSize: size,
    lineHeight: size,
    ...(color ? { color } : {}),
  };

  return (
    <Text
      className={className}
      style={style}
      onClick={onClick}
    >
      {char || name}
    </Text>
  );
};

export type { IconFontProps, IconName };
