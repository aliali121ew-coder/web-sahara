import { useSyncExternalStore } from 'react';

/**
 * كشف نشر نسخة جديدة: الصفحة تحمل بصمة بنائها (__BUILD_ID__)، وتسأل الخادم /api/version
 * عند الفتح وكل دقيقتين وعند العودة للتطبيق؛ إن اختلفت البصمة فهناك تحديث، وتحديث الصفحة يجلبه
 * (عامل الخدمة يجلب الصفحة الرئيسية من الشبكة أولًا، وملفات البناء الجديدة بأسماء جديدة).
 */
const CHECK_EVERY_MS = 2 * 60 * 1000;

let available = false;
const listeners = new Set<() => void>();
let started = false;
let checking = false;

const check = async () => {
  if (available || checking || !navigator.onLine) return;
  checking = true;
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (build && build !== __BUILD_ID__) {
      available = true;
      listeners.forEach(l => l());
    }
  } catch {
    // بلا اتصال: يُعاد الفحص لاحقًا
  } finally {
    checking = false;
  }
};

const start = () => {
  if (started) return;
  started = true;
  check();
  window.setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
};

const subscribe = (l: () => void) => {
  start();
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** هل نُشرت نسخة أحدث من المفتوحة الآن */
export const useAppUpdateAvailable = () => useSyncExternalStore(subscribe, () => available, () => false);

export const applyAppUpdate = () => window.location.reload();
