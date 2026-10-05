import i18n from './index';

/**
 * التنسيق حسب اللغة عبر Intl فقط (لا تنسيق يدوي).
 * الأرقام غربية (0-9) في اللغتين بقرار المستخدم، لذا numberingSystem = latn دائمًا.
 */
const localeOf = (lang = i18n.language) => (lang === 'en' ? 'en-US' : 'ar-IQ');
const NUM = { numberingSystem: 'latn' } as const;

export const fmtNumber = (value: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(localeOf(), { ...NUM, ...opts } as Intl.NumberFormatOptions).format(value);

export const fmtPercent = (ratio: number, digits = 1) =>
  new Intl.NumberFormat(localeOf(), { ...NUM, style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits } as Intl.NumberFormatOptions).format(ratio);

export const fmtDate = (d: Date | number | string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(localeOf(), { ...NUM, ...opts } as Intl.DateTimeFormatOptions).format(new Date(d));

export const fmtTime = (d: Date | number | string, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }) =>
  new Intl.DateTimeFormat(localeOf(), { ...NUM, ...opts } as Intl.DateTimeFormatOptions).format(new Date(d));

/** «قبل 3 ساعات» / «3 hours ago» */
export const fmtRelative = (from: Date | number, now: number = Date.now()) => {
  const diff = (new Date(from).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(localeOf(), { numeric: 'auto', ...NUM } as Intl.RelativeTimeFormatOptions);
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
};

export const fmtList = (items: string[], type: Intl.ListFormatType = 'conjunction') =>
  new Intl.ListFormat(localeOf(), { style: 'long', type }).format(items);

export const collator = () => new Intl.Collator(localeOf(), { numeric: true, sensitivity: 'base' });
