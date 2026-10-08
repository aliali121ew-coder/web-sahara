/**
 * وضع الأجهزة الضعيفة: يُفعَّل قبل أول عرض (يُستورد أولًا في main.tsx) ويضيف الصنف perf-lite إلى <html>،
 * فتُطفأ تأثيرات الزجاج والنبض المستمر (راجع نهاية index.css) لتبقى الحركة والتمرير سلسة.
 * يُفعَّل عند: طلب النظام تقليل الحركة، أو معالج بـ 4 أنوية فأقل، أو ذاكرة 4GB فأقل، أو وضع توفير البيانات.
 */
const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

export const isLowEndDevice = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  || (nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4)
  || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4)
  || nav.connection?.saveData === true;

if (isLowEndDevice()) document.documentElement.classList.add('perf-lite');
