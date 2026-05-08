/**
 * InlineDateTimePickerField 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: @react-native-community/datetimepicker → Taro Picker
 * Platform.OS 检查 → 移除（纯小程序环境）
 * 使用 Taro Picker 的 start/end 替代 maximumDate/minimumDate
 */

import React from 'react';
import { View, Text, Picker } from '@tarojs/components';

/**
 * 将 Date 对象格式化为 YYYY-MM-DD 字符串（Taro date Picker 格式）
 */
function formatDateToPicker(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将 Date 对象格式化为 HH:mm 字符串（Taro time Picker 格式）
 */
function formatTimeToPicker(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

type Props = {
  buttonTitle: string;
  mode: 'date' | 'time';
  value: Date;
  onConfirm: (selected: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  /** Accepted for API compatibility with the RN datetimepicker interface.
   *  Taro/WeChat Picker does not have a native is24Hour prop;
   *  time format follows the system locale instead. */
  is24Hour?: boolean;
  containerStyle?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
};

// 组合按钮样式的触发器样式
const TRIGGER_STYLE: React.CSSProperties = {
  borderWidth: 1.5,
  borderStyle: 'solid',
  borderColor: '#FFB5A7',
  borderRadius: 14,
  padding: '12px 20px',
  minHeight: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  boxSizing: 'border-box',
};
const TRIGGER_TEXT_STYLE: React.CSSProperties = {
  fontSize: 16,
  color: '#FFB5A7',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

export const InlineDateTimePickerField: React.FC<Props> = ({
  buttonTitle,
  mode,
  value,
  onConfirm,
  maximumDate,
  minimumDate,
  containerStyle,
  buttonStyle,
}) => {
  /**
   * Taro Picker 的 onChange 事件处理
   * Taro Picker 仅在用户确认选择后触发，简化了 resolvePickerChange 逻辑
   */
  const handleDateChange = (e: { detail: { value: string } }) => {
    const dateStr = e.detail.value;
    if (dateStr) {
      const selected = new Date(dateStr);
      onConfirm(selected);
    }
  };

  const handleTimeChange = (e: { detail: { value: string } }) => {
    const timeStr = e.detail.value;
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const selected = new Date(value);
      selected.setHours(hours, minutes, 0, 0);
      onConfirm(selected);
    }
  };

  const triggerStyle = { ...TRIGGER_STYLE, ...buttonStyle };

  if (mode === 'date') {
    const pickerValue = formatDateToPicker(value);
    const startStr = minimumDate ? formatDateToPicker(minimumDate) : undefined;
    const endStr = maximumDate ? formatDateToPicker(maximumDate) : undefined;

    return (
      <View style={containerStyle}>
        <Picker
          mode="date"
          value={pickerValue}
          start={startStr}
          end={endStr}
          onChange={handleDateChange}
        >
          <View style={triggerStyle} hoverClass="picker-trigger-hover">
            <Text style={TRIGGER_TEXT_STYLE}>{buttonTitle}</Text>
          </View>
        </Picker>
      </View>
    );
  }

  // mode === 'time'
  const pickerValue = formatTimeToPicker(value);

  return (
    <View style={containerStyle}>
      <Picker
        mode="time"
        value={pickerValue}
        onChange={handleTimeChange}
      >
        <View style={triggerStyle} hoverClass="picker-trigger-hover">
          <Text style={TRIGGER_TEXT_STYLE}>{buttonTitle}</Text>
        </View>
      </Picker>
    </View>
  );
};
