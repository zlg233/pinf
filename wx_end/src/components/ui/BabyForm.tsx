/**
 * BabyForm 组件 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: DateTimePicker → Taro Picker, TouchableOpacity → View + onClick
 * Platform.OS 检查 → 移除（纯小程序环境）
 * StyleSheet.create → 内联样式
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import type { Baby, CreateBabyInput, UpdateBabyInput } from '@/types/baby';
import { formatDateString, isValidDateString } from '@/utils/ageCalculator';

interface BabyFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBabyInput | UpdateBabyInput) => Promise<void>;
  initialData?: Baby;
  mode?: 'create' | 'edit';
}

// 内联样式常量（对应 RN StyleSheet.create 的值）
const styles = {
  scrollView: {
    height: '100%',
  } as React.CSSProperties,
  inputContainer: {
    marginBottom: 16,
  } as React.CSSProperties,
  label: {
    fontSize: 13,
    color: '#7A7A7A',
    marginBottom: 8,
    fontWeight: 500,
  } as React.CSSProperties,
  required: {
    color: '#D64545',
  } as React.CSSProperties,
  errorText: {
    fontSize: 12,
    color: '#D64545',
    marginTop: 4,
  } as React.CSSProperties,
  genderRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  } as React.CSSProperties,
  genderButton: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(74, 74, 74, 0.18)',
    borderRadius: 14,
    paddingTop: 10,
    paddingBottom: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  } as React.CSSProperties,
  genderButtonActive: {
    borderColor: '#FFB5A7',
    backgroundColor: '#FFF0EC',
  } as React.CSSProperties,
  genderText: {
    fontSize: 15,
    color: '#7A7A7A',
  } as React.CSSProperties,
  genderTextActive: {
    color: '#FFB5A7',
    fontWeight: 700,
  } as React.CSSProperties,
  pickerTrigger: {
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: '#FFB5A7',
    borderRadius: 14,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 20,
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  } as React.CSSProperties,
  pickerText: {
    fontSize: 16,
    color: '#FFB5A7',
    fontWeight: 600,
  } as React.CSSProperties,
  pickerPlaceholder: {
    fontSize: 16,
    color: '#999999',
    fontWeight: 600,
  } as React.CSSProperties,
  submitError: {
    textAlign: 'center',
    marginBottom: 16,
  } as React.CSSProperties,
  submitButton: {
    marginTop: 16,
    marginBottom: 32,
  } as React.CSSProperties,
};

export const BabyForm: React.FC<BabyFormProps> = ({
  visible,
  onClose,
  onSubmit,
  initialData,
  mode = 'create',
}) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'男' | '女' | ''>('');
  const [birthday, setBirthday] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [gestationalWeeks, setGestationalWeeks] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 用于 Taro Picker 的默认日期值
  const defaultDateStr = formatDateString(new Date());

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      if (initialData) {
        setName(initialData.name);
        setGender(initialData.gender || '');
        setBirthday(initialData.birthday);
        setDueDate(initialData.dueDate || '');
        setGestationalWeeks(
          initialData.gestationalWeeks !== undefined && initialData.gestationalWeeks !== null
            ? String(initialData.gestationalWeeks)
            : ''
        );
        setNote(initialData.note || '');
      } else {
        setName('');
        setGender('');
        setBirthday('');
        setDueDate('');
        setGestationalWeeks('');
        setNote('');
      }
      setErrors({});
    }
  }, [visible, initialData]);

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '请输入宝宝姓名';
    }

    if (!gender) {
      newErrors.gender = '请选择宝宝性别';
    }

    if (!birthday) {
      newErrors.birthday = '请选择出生日期';
    } else if (!isValidDateString(birthday)) {
      newErrors.birthday = '日期格式错误';
    }

    if (dueDate && !isValidDateString(dueDate)) {
      newErrors.dueDate = '预产期格式错误';
    }

    if (gestationalWeeks.trim()) {
      const week = Number(gestationalWeeks);
      if (Number.isNaN(week) || week < 20 || week > 45) {
        newErrors.gestationalWeeks = '孕周需在 20-45 周之间';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const parsedGestationalWeeks = gestationalWeeks.trim()
        ? Number(gestationalWeeks.trim())
        : undefined;

      const data: CreateBabyInput | UpdateBabyInput = {
        name: name.trim(),
        gender: gender as '男' | '女',
        birthday,
        dueDate: dueDate || undefined,
        gestationalWeeks: parsedGestationalWeeks,
        note: note.trim() || undefined,
      };

      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Failed to submit baby form:', error);
      setErrors({ submit: '操作失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  // 处理性别点击
  const handleGenderSelect = (value: '男' | '女') => {
    setGender(value);
    if (errors.gender) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.gender;
        return next;
      });
    }
  };

  // 处理生日选择
  const handleBirthdayChange = (e: { detail: { value: string } }) => {
    const selected = e.detail.value;
    if (selected) {
      setBirthday(selected);
      if (errors.birthday) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.birthday;
          return next;
        });
      }
    }
  };

  // 处理预产期选择
  const handleDueDateChange = (e: { detail: { value: string } }) => {
    const selected = e.detail.value;
    if (selected) {
      setDueDate(selected);
      if (errors.dueDate) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.dueDate;
          return next;
        });
      }
    }
  };

  // 性别按钮渲染
  const renderGenderButton = (item: '男' | '女') => {
    const isActive = gender === item;
    return (
      <View
        key={item}
        style={{
          ...styles.genderButton,
          ...(isActive ? styles.genderButtonActive : {}),
        }}
        hoverClass="gender-btn-hover"
        onClick={() => handleGenderSelect(item)}
      >
        <Text
          style={{
            ...styles.genderText,
            ...(isActive ? styles.genderTextActive : {}),
          }}
        >
          {item}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={mode === 'create' ? '添加宝宝信息' : '编辑宝宝信息'}
    >
      <ScrollView
        style={styles.scrollView}
        scrollY
        className="baby-form__scroll"
      >
        {/* 宝宝姓名 */}
        <Input
          label="宝宝姓名"
          value={name}
          onInput={(e) => setName(e.detail.value)}
          placeholder="请输入宝宝姓名"
          error={errors.name}
          required
          maxlength={20}
          containerStyle={styles.inputContainer}
        />

        {/* 性别选择 */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            性别<Text style={styles.required}> *</Text>
          </Text>
          <View style={styles.genderRow}>
            {renderGenderButton('男')}
            {renderGenderButton('女')}
          </View>
          {errors.gender && (
            <Text style={styles.errorText}>{errors.gender}</Text>
          )}
        </View>

        {/* 出生日期 */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            出生日期<Text style={styles.required}> *</Text>
          </Text>
          <Picker
            mode="date"
            value={birthday || defaultDateStr}
            onChange={handleBirthdayChange}
          >
            <View style={styles.pickerTrigger} hoverClass="picker-trigger-hover">
              <Text style={birthday ? styles.pickerText : styles.pickerPlaceholder}>
                {birthday || '请选择出生日期'}
              </Text>
            </View>
          </Picker>
          {errors.birthday && (
            <Text style={styles.errorText}>{errors.birthday}</Text>
          )}
        </View>

        {/* 预产期 */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>预产期</Text>
          <Picker
            mode="date"
            value={dueDate || defaultDateStr}
            onChange={handleDueDateChange}
          >
            <View style={styles.pickerTrigger} hoverClass="picker-trigger-hover">
              <Text style={dueDate ? styles.pickerText : styles.pickerPlaceholder}>
                {dueDate || '请选择预产期'}
              </Text>
            </View>
          </Picker>
          {errors.dueDate && (
            <Text style={styles.errorText}>{errors.dueDate}</Text>
          )}
        </View>

        {/* 出生孕周 */}
        <Input
          label="出生孕周（周）"
          value={gestationalWeeks}
          onInput={(e) => setGestationalWeeks(e.detail.value)}
          placeholder="如 34，选填"
          type="digit"
          maxlength={2}
          error={errors.gestationalWeeks}
          containerStyle={styles.inputContainer}
        />

        {/* 备注 */}
        <Input
          label="备注"
          value={note}
          onInput={(e) => setNote(e.detail.value)}
          placeholder="选填"
          containerStyle={styles.inputContainer}
        />

        {/* 提交错误 */}
        {errors.submit && (
          <Text style={{ ...styles.errorText, ...styles.submitError }}>
            {errors.submit}
          </Text>
        )}

        {/* 提交按钮 */}
        <Button
          title={mode === 'create' ? '保存并同步' : '保存修改'}
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        />
      </ScrollView>
    </Modal>
  );
};
