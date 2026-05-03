/**
 * Input 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: TextInput → Taro Input, placeholderTextColor → CSS placeholderClass
 * Props 接口保持与 RN 原版一致
 */

import React, { useState } from 'react';
import { View, Text, Input as TaroInput } from '@tarojs/components';
import './styles/input.scss';

interface InputProps {
  // Taro Input props (commonly used)
  value?: string;
  placeholder?: string;
  placeholderStyle?: string;
  placeholderClass?: string;
  disabled?: boolean;
  maxlength?: number;
  type?: 'text' | 'number' | 'idcard' | 'digit';
  password?: boolean;
  focus?: boolean;
  confirmType?: 'send' | 'search' | 'next' | 'go' | 'done';
  onInput?: (e: any) => void;
  onFocus?: (e: any) => void;
  onBlur?: (e: any) => void;
  onConfirm?: (e: any) => void;
  style?: React.CSSProperties;
  className?: string;

  // Custom props (from RN original)
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  required,
  style,
  className,
  onFocus,
  onBlur,
  ...inputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const renderIcon = (icon: React.ReactNode) => {
    if (typeof icon === 'string' || typeof icon === 'number') {
      return <Text className="input__icon-text">{icon}</Text>;
    }
    return icon;
  };

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const wrapperClass = [
    'input__wrapper',
    isFocused ? 'input__wrapper--focused' : '',
    error ? 'input__wrapper--error' : '',
    inputProps.disabled ? 'input__wrapper--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputFieldClass = [
    'input__field',
    leftIcon ? 'input__field--with-left-icon' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className="input__container" style={containerStyle}>
      {label && (
        <Text className="input__label">
          {label}
          {required && <Text className="input__required"> *</Text>}
        </Text>
      )}

      <View className={wrapperClass}>
        {leftIcon && <View className="input__left-icon">{renderIcon(leftIcon)}</View>}

        <TaroInput
          {...inputProps}
          className={inputFieldClass}
          placeholderClass="input__placeholder"
          style={style}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {rightIcon && <View className="input__right-icon">{renderIcon(rightIcon)}</View>}
      </View>

      {error ? (
        <Text className="input__error-text">{error}</Text>
      ) : helperText ? (
        <Text className="input__helper-text">{helperText}</Text>
      ) : null}
    </View>
  );
};
