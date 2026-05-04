import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { InlineDateTimePickerField } from '@/components/ui/InlineDateTimePickerField';
import { OrganicButton } from '@/components/ui/OrganicButton';
import { formatDateString } from '@/utils/ageCalculator';
import { toLocalDateTimePayload } from '@/utils/appointment';
import './AppointmentModal.scss';

type SubmitPayload = {
  clinic: string;
  department: string;
  scheduledAt: string;
  remindAt?: string;
  note?: string;
};

interface AppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  title?: string;
  submitText?: string;
  initialValues?: {
    clinic?: string;
    department?: string;
    scheduledAt?: string;
    remindAt?: string;
    note?: string;
  };
}

const REMINDER_OPTIONS = [
  { value: 'none', label: '不提醒' },
  { value: '15min', label: '提前15分钟' },
  { value: '30min', label: '提前30分钟' },
  { value: '1hour', label: '提前1小时' },
  { value: '1day', label: '提前1天' },
];

const REMINDER_LABELS = REMINDER_OPTIONS.map((o) => o.label);

function getReminderMs(value: string): number {
  switch (value) {
    case '15min':
      return 15 * 60 * 1000;
    case '30min':
      return 30 * 60 * 1000;
    case '1hour':
      return 60 * 60 * 1000;
    case '1day':
      return 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;

function buildDefaultDate() {
  const next = new Date();
  next.setHours(DEFAULT_HOUR, DEFAULT_MINUTE, 0, 0);
  return next;
}

function formatTimeText(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseDateAndTime(dateText: string, timeText: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialValues,
  title = '添加预约',
  submitText = '保存',
}) => {
  const [clinic, setClinic] = useState('');
  const [department, setDepartment] = useState('');
  const [note, setNote] = useState('');
  const [reminderIndex, setReminderIndex] = useState(0);
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [pickerDate, setPickerDate] = useState<Date>(buildDefaultDate);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;

    const base = new Date();
    base.setHours(DEFAULT_HOUR, DEFAULT_MINUTE, 0, 0);

    if (initialValues?.scheduledAt) {
      const parsed = new Date(initialValues.scheduledAt);
      if (!Number.isNaN(parsed.getTime())) {
        base.setTime(parsed.getTime());
      }
    }

    setClinic(initialValues?.clinic || '');
    setDepartment(initialValues?.department || '');
    setNote(initialValues?.note || '');
    setReminderIndex(0);
    setDateText(formatDateString(base));
    setTimeText(formatTimeText(base));
    setPickerDate(base);
    setErrors({});
  }, [initialValues, visible]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!clinic.trim()) nextErrors.clinic = '请输入就诊机构';
    if (!department.trim()) nextErrors.department = '请输入科室或医生';
    if (!parseDateAndTime(dateText, timeText)) {
      nextErrors.scheduledAt = '请输入正确的日期和时间';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const applyPickerDate = (selected?: Date) => {
    if (!selected) return;
    const next = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate(),
      pickerDate.getHours(),
      pickerDate.getMinutes(),
      0,
      0,
    );
    setPickerDate(next);
    setDateText(formatDateString(next));
  };

  const applyPickerTime = (selected?: Date) => {
    if (!selected) return;
    const next = new Date(
      pickerDate.getFullYear(),
      pickerDate.getMonth(),
      pickerDate.getDate(),
      selected.getHours(),
      selected.getMinutes(),
      0,
      0,
    );
    setPickerDate(next);
    setTimeText(formatTimeText(next));
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const scheduled = parseDateAndTime(dateText, timeText);
    if (!scheduled) {
      setErrors((prev) => ({ ...prev, scheduledAt: '请输入正确的日期和时间' }));
      return;
    }

    setLoading(true);
    try {
      const selectedReminder = REMINDER_OPTIONS[reminderIndex];
      const remindMs = getReminderMs(selectedReminder.value);
      const remindAt =
        remindMs > 0
          ? toLocalDateTimePayload(new Date(scheduled.getTime() - remindMs))
          : undefined;

      await onSubmit({
        clinic: clinic.trim(),
        department: department.trim(),
        scheduledAt: toLocalDateTimePayload(scheduled),
        remindAt,
        note: note.trim() || undefined,
      });

      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交失败，请重试';
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title={title} height="auto">
      <ScrollView className="appointment-modal__scroll" scrollY>
        <View className="appointment-modal__form">
          <Input
            label="就诊机构"
            value={clinic}
            onInput={(e) => setClinic(e.detail.value)}
            placeholder="医院 / 社区卫生服务中心"
            required
            error={errors.clinic}
          />
          <Input
            label="科室 / 医生"
            value={department}
            onInput={(e) => setDepartment(e.detail.value)}
            placeholder="例如：儿保科 / 张医生"
            required
            error={errors.department}
          />
          <Input
            label="预约日期"
            value={dateText}
            onInput={(e) => setDateText(e.detail.value)}
            placeholder="YYYY-MM-DD"
            error={errors.scheduledAt}
            helperText="可直接输入，也可使用下方按钮选择"
          />
          <Input
            label="预约时间"
            value={timeText}
            onInput={(e) => setTimeText(e.detail.value)}
            placeholder="HH:mm"
            error={errors.scheduledAt}
          />
          <View className="appointment-modal__datetime-row">
            <InlineDateTimePickerField
              buttonTitle="选择日期"
              mode="date"
              value={pickerDate}
              onConfirm={applyPickerDate}
              containerStyle={{ flex: 1 }}
            />
            <View style={{ width: 8 }} />
            <InlineDateTimePickerField
              buttonTitle="选择时间"
              mode="time"
              value={pickerDate}
              onConfirm={applyPickerTime}
              is24Hour
              containerStyle={{ flex: 1 }}
            />
          </View>

          <View className="appointment-modal__field">
            <Text className="appointment-modal__field-label">提前提醒</Text>
            <Picker
              mode="selector"
              range={REMINDER_LABELS}
              value={reminderIndex}
              onChange={(e) => setReminderIndex(Number(e.detail.value))}
            >
              <View className="appointment-modal__picker-trigger">
                <Text className="appointment-modal__picker-text">
                  {REMINDER_LABELS[reminderIndex]}
                </Text>
                <Text className="appointment-modal__picker-arrow">▼</Text>
              </View>
            </Picker>
          </View>

          <Input
            label="备注"
            value={note}
            onInput={(e) => setNote(e.detail.value)}
            placeholder="需要携带的材料、注意事项等"
          />

          {errors.form ? <Text className="appointment-modal__error">{errors.form}</Text> : null}
          <OrganicButton title={submitText} onPress={handleSubmit} loading={loading} disabled={loading} />
        </View>
      </ScrollView>
    </Modal>
  );
};

export default AppointmentModal;
