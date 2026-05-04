import React from 'react';
import { View, Text } from '@tarojs/components';
import './ActionGrid.scss';

interface ActionItem {
  id: string;
  title: string;
  icon: string;
  tint?: string;
  onClick?: () => void;
}

interface ActionGridProps {
  items: ActionItem[];
}

export const ActionGrid: React.FC<ActionGridProps> = ({ items }) => {
  return (
    <View className="action-grid">
      {items.map((item) => (
        <View
          key={item.id}
          className="action-grid__item"
          style={{ backgroundColor: item.tint ?? '#FFF0EC' }}
          onClick={item.onClick}
          hoverClass="action-grid__item--pressed"
        >
          <View className="action-grid__icon-wrap">
            <Text className="action-grid__icon">{item.icon}</Text>
          </View>
          <Text className="action-grid__title">{item.title}</Text>
        </View>
      ))}
    </View>
  );
};
