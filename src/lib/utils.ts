import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import i18n from '../i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * أرقام بفواصل الآلاف وأرقام غربية في اللغتين (705,021)
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format currency with IQD abbreviation (د.ع)
 */
export function formatIQD(value: number): string {
  return `${formatNumber(value)} ${i18n.t('common:units.iqd')}`;
}

/**
 * Format volume in liters with (لتر)
 */
export function formatLiters(value: number): string {
  return `${formatNumber(value)} ${i18n.t('common:units.liter')}`;
}

/**
 * Get formatted current date in Arabic
 */
export function getArabicDate(): string {
  return new Intl.DateTimeFormat('ar-IQ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

/**
 * Get formatted current time (Baghdad / Karbala timezone)
 */
export function getArabicTime(): string {
  return new Intl.DateTimeFormat('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date());
}

/**
 * Get the current business date (formatted as YYYY/MM/DD).
 * A business day runs from 6:00 AM to 5:59 AM the next day.
 * If the current time is before 6:00 AM, it's considered part of the previous calendar day.
 */
export function getBusinessDate(date: Date = new Date()): string {
  const businessDate = new Date(date.getTime());
  // يوم العمل يبدأ الساعة 7 صباحًا: قبلها يُحسب ضمن اليوم السابق
  if (businessDate.getHours() < 7) {
    businessDate.setDate(businessDate.getDate() - 1);
  }
  
  const year = businessDate.getFullYear();
  const month = String(businessDate.getMonth() + 1).padStart(2, '0');
  const day = String(businessDate.getDate()).padStart(2, '0');
  
  return `${year}/${month}/${day}`;
}
