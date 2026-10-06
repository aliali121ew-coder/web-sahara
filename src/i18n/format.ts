import i18n from './index';

/**
 * التنسيق حسب اللغة عبر Intl فقط (لا تنسيق يدوي).
 * الأرقام غربية (0-9) في اللغتين بقرار المستخدم، لذا numberingSystem = latn دائمًا.
 */
const localeOf = (lang = i18n.language) => (lang === 'en' ? 'en-US' : 'ar-IQ');
const NUM = { numberingSystem: 'latn' } as const;

// إنشاء Intl.*Format مكلف (قد يتجاوز نصف ملّي ثانية)؛ يُعاد استخدام المنسّق لنفس اللغة والخيارات.
// هذا يجعل الجداول والرسوم ذات المئات من التواريخ والأرقام أسرع بكثير.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
const numFmt = (opts: Intl.NumberFormatOptions) => {
  const key = `n|${localeOf()}|${JSON.stringify(opts)}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) { f = new Intl.NumberFormat(localeOf(), { ...NUM, ...opts } as Intl.NumberFormatOptions); cache.set(key, f); }
  return f;
};
const dateFmt = (opts: Intl.DateTimeFormatOptions) => {
  const key = `d|${localeOf()}|${JSON.stringify(opts)}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) { f = new Intl.DateTimeFormat(localeOf(), { ...NUM, ...opts } as Intl.DateTimeFormatOptions); cache.set(key, f); }
  return f;
};

export const fmtNumber = (value: number, opts: Intl.NumberFormatOptions = {}) => numFmt(opts).format(value);

export const fmtPercent = (ratio: number, digits = 1) =>
  numFmt({ style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ratio);

export const fmtDate = (d: Date | number | string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  dateFmt(opts).format(new Date(d));

export const fmtTime = (d: Date | number | string, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }) =>
  dateFmt(opts).format(new Date(d));

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

/** عنوان يوم لتجميع القوائم: «اليوم» / «أمس» / «الأحد، 5 تشرين الأول 2026» */
export const fmtDayLabel = (ts: number | Date) => {
  const d = new Date(ts);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(d) - start(new Date())) / 86400000);
  if (days === 0 || days === -1) {
    const s = new Intl.RelativeTimeFormat(localeOf(), { numeric: 'auto', ...NUM } as Intl.RelativeTimeFormatOptions).format(days, 'day');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
