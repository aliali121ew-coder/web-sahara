import { useSyncExternalStore } from 'react';
import { REALTIME_OPEN_EVENT } from './cloudSync';

/**
 * كشف نشر نسخة جديدة: الصفحة تحمل بصمة بنائها (__BUILD_ID__)، وتسأل الخادم /api/version (بلا D1)
 * عند الفتح، وعند عودة اتصال التحديث اللحظي (رفع نسخة جديدة يعيد تشغيل قناته فيعود اتصال كل الأجهزة خلال ثوانٍ)،
 * وعند العودة للتطبيق، واحتياطًا كل 30 دقيقة؛ إن اختلفت البصمة فهناك تحديث، وتحديث الصفحة يجلبه
 * (عامل الخدمة يجلب الصفحة الرئيسية من الشبكة أولًا، وملفات البناء الجديدة بأسماء جديدة).
 */
/** فحص احتياطي نادر إن لم يعد الاتصال اللحظي لسبب ما */
const CHECK_EVERY_MS = 30 * 60 * 1000;

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
  window.addEventListener('online', check);
  window.addEventListener(REALTIME_OPEN_EVENT, check);
};

const subscribe = (l: () => void) => {
  start();
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** هل نُشرت نسخة أحدث من المفتوحة الآن */
export const useAppUpdateAvailable = () => useSyncExternalStore(subscribe, () => available, () => false);

export const applyAppUpdate = () => window.location.reload();

/** شاشة الدخول بلا اتصال لحظي (لا جلسة): فحص أقرب حتى تُلتقط النسخة الجديدة خلال دقائق */
const LOGIN_CHECK_EVERY_MS = 2 * 60 * 1000;

/** فحص دوري أثناء عرض شاشة الدخول، يُرجع دالة الإيقاف */
export const watchAppUpdateOnLogin = () => {
  start();
  const id = window.setInterval(check, LOGIN_CHECK_EVERY_MS);
  return () => window.clearInterval(id);
};
