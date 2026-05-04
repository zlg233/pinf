import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import type { Baby } from '@/types/baby';
import './BabySwitcher.scss';

interface BabySwitcherProps {
  babies: Baby[];
  currentBabyId?: number | null;
  onSelect: (baby: Baby) => void;
  onAddBaby?: () => void;
}

const BabySwitcher: React.FC<BabySwitcherProps> = ({
  babies,
  currentBabyId,
  onSelect,
  onAddBaby,
}) => {
  return (
    <ScrollView
      scrollX
      className="baby-switcher__scroll"
      enhanced
      showScrollbar={false}
    >
      {babies.map((baby) => {
        const isActive = baby.id === currentBabyId;
        const itemClass = [
          'baby-switcher__item',
          isActive ? 'baby-switcher__item--active' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <View
            key={baby.id}
            className={itemClass}
            onClick={() => onSelect(baby)}
          >
            <View className="baby-switcher__avatar">
              <Text className="baby-switcher__avatar-icon">&#xe031;</Text>
            </View>
            <View className="baby-switcher__info">
              <Text className="baby-switcher__name">{baby.name}</Text>
              <Text className="baby-switcher__age">{baby.gender === '女' ? '小公主' : '小王子'}</Text>
            </View>
          </View>
        );
      })}

      {onAddBaby && (
        <View className="baby-switcher__add" onClick={onAddBaby}>
          <Text className="baby-switcher__add-icon">&#xe001;</Text>
          <Text className="baby-switcher__add-text">添加宝宝</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default BabySwitcher;
