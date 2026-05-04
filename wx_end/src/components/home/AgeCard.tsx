import React from 'react';
import { View, Text } from '@tarojs/components';
import { Tag } from '@/components/ui/Tag';
import './AgeCard.scss';

interface AgeCardProps {
  babyName: string;
  ageText: string;
  detailText?: string;
  badges?: string[];
  actionLabel?: string;
  onAction?: () => void;
}

const AgeCard: React.FC<AgeCardProps> = ({
  babyName,
  ageText,
  detailText,
  badges = [],
  actionLabel,
  onAction,
}) => {
  return (
    <View className="age-card">
      <Text className="age-card__label">宝宝年龄</Text>
      <Text className="age-card__title">{ageText}</Text>
      {detailText && <Text className="age-card__desc">{detailText}</Text>}
      {badges.length > 0 && (
        <View className="age-card__badge-row">
          {badges.map((badge) => (
            <Tag
              key={badge}
              label={badge}
              variant="primary"
              size="small"
              style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 12 }}
              textStyle={{ color: '#FFFFFF', fontWeight: '700' }}
            />
          ))}
        </View>
      )}
      {onAction && (
        <View className="age-card__action" onClick={onAction}>
          <Text className="age-card__action-text">
            {actionLabel ?? `${babyName} 的成长记录`}
          </Text>
        </View>
      )}
    </View>
  );
};

export default AgeCard;
