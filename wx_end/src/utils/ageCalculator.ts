/**
 * 年龄计算工具 (Taro/WeChat Mini-Program)
 * 从 React Native 迁移: 纯 TypeScript 逻辑，无平台依赖
 * 支持实际月龄和矫正月龄计算
 */

import type { AgeInfo, Baby } from '@/types/baby';

function calculateMonthsAndDays(fromDate: Date, toDate: Date): { months: number; days: number } {
  let months = 0;
  let current = new Date(fromDate.getTime());
  const target = new Date(toDate.getTime());

  while (true) {
    const nextMonth = new Date(current.getTime());
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    if (nextMonth <= target) {
      months++;
      current = nextMonth;
    } else {
      break;
    }
  }

  const days = Math.floor((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  return { months, days };
}

function formatAge(months: number, days: number): string {
  if (months === 0) return `${days}天`;
  const dayStr = days < 10 ? `0${days}` : `${days}`;
  return `${months}月 ${dayStr}天`;
}

export function calculateBabyAge(baby: Baby, referenceDate: Date = new Date()): AgeInfo {
  const birthday = new Date(baby.birthday);
  const actual = calculateMonthsAndDays(birthday, referenceDate);
  const actualText = formatAge(actual.months, actual.days);
  const isPremature = (baby.gestationalWeeks && baby.gestationalWeeks < 37) || !!baby.dueDate;

  const result: AgeInfo = {
    actualMonths: actual.months,
    actualDays: actual.days,
    actualText,
    isPremature,
  };

  if (isPremature) {
    let correctedBirthday: Date;
    if (baby.dueDate) {
      correctedBirthday = new Date(baby.dueDate);
    } else if (baby.gestationalWeeks) {
      const weeksToAdd = 40 - baby.gestationalWeeks;
      correctedBirthday = new Date(birthday.getTime());
      correctedBirthday.setDate(correctedBirthday.getDate() + weeksToAdd * 7);
    } else {
      correctedBirthday = birthday;
    }

    if (correctedBirthday <= referenceDate) {
      const corrected = calculateMonthsAndDays(correctedBirthday, referenceDate);
      result.correctedMonths = corrected.months;
      result.correctedDays = corrected.days;
      result.correctedText = formatAge(corrected.months, corrected.days);
    } else {
      result.correctedMonths = 0;
      result.correctedDays = 0;
      result.correctedText = '0天';
    }

    if (baby.gestationalWeeks) {
      result.birthGestationalWeeks = baby.gestationalWeeks;
      const actualWeeks = Math.floor(
        (referenceDate.getTime() - birthday.getTime()) / (1000 * 60 * 60 * 24 * 7)
      );
      result.currentCorrectedWeeks = baby.gestationalWeeks + actualWeeks;
    }
  }

  return result;
}

export function formatDetailedAge(ageInfo: AgeInfo): {
  mainText: string;
  detailText?: string;
  badges: Array<{ label: string }>;
} {
  const badges: Array<{ label: string }> = [];

  if (ageInfo.isPremature) {
    if (ageInfo.birthGestationalWeeks) {
      badges.push({ label: `出生 ${ageInfo.birthGestationalWeeks}周` });
    }
    if (ageInfo.currentCorrectedWeeks) {
      badges.push({ label: `矫正 ${ageInfo.currentCorrectedWeeks}周` });
    }
    return {
      mainText: ageInfo.actualText,
      detailText: ageInfo.correctedText ? `矫正月龄：${ageInfo.correctedText}` : undefined,
      badges,
    };
  }

  return { mainText: ageInfo.actualText, badges };
}

export function isValidDateString(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const dayStr = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${monthStr}-${dayStr}`;
}
