import React from 'react';
import { View, Text } from '@tarojs/components';
import { Tag } from '@/components/ui/Tag';
import './AppointmentCard.scss';

interface AppointmentCardProps {
  clinic: string;
  department: string;
  dateText: string;
  dateDay?: string;
  dateMonth?: string;
  remindText?: string;
  statusLabel?: string;
  statusVariant?: 'primary' | 'accent' | 'muted';
  actionLabel?: string;
  onAction?: () => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  clinic,
  department,
  dateText,
  remindText,
  statusLabel = '待就诊',
  statusVariant = 'primary',
  dateDay,
  dateMonth,
  actionLabel = '查看详情',
  onAction,
}) => {
  const tagVariant =
    statusVariant === 'accent'
      ? 'accent'
      : statusVariant === 'muted'
        ? 'muted'
        : 'primary';

  const renderDateDay = dateDay ?? dateText.split('-')[2]?.slice(0, 2) ?? '';
  const renderDateMonth = dateMonth ?? (dateText.split('-')[1] ? `${dateText.split('-')[1]}月` : '');

  return (
    <View className="appointment-card">
      <View className="appointment-card__date-pill">
        <Text className="appointment-card__date-day">{renderDateDay}</Text>
        <Text className="appointment-card__date-month">{renderDateMonth}</Text>
      </View>
      <View className="appointment-card__content">
        <View className="appointment-card__header-row">
          <Text className="appointment-card__title">{clinic}</Text>
          <Tag label={statusLabel} variant={tagVariant} size="small" />
        </View>
        <Text className="appointment-card__subtitle">{department}</Text>
        <View className="appointment-card__meta-row">
          <Text className="appointment-card__meta">{dateText}</Text>
          {remindText && <Text className="appointment-card__meta">{remindText}</Text>}
        </View>
        <View className="appointment-card__action" onClick={onAction ?? (() => {})}>
          <Text className="appointment-card__action-text">{actionLabel}</Text>
        </View>
      </View>
    </View>
  );
};

export default AppointmentCard;
