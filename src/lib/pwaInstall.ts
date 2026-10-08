import { useEffect, useState } from 'react';

/**
 * تثبيت التطبيق على الهاتف:
 * - أندرويد (كروم وما يشبهه): المتصفح يطلق beforeinstallprompt، فنحتفظ به ونعرض زر "تثبيت" خاصًا بنا
 *   (نافذة كروم التلقائية لا تظهر دائمًا).
 * - آيفون/آيباد: لا يوجد طلب تثبيت تلقائي في iOS أبدًا؛ نعرض خطوات "مشاركة ← إضافة إلى الشاشة الرئيسية".
 * يُستورد مبكرًا في main.tsx حتى لا يفوتنا الحدث قبل عرض الواجهة.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** "لاحقًا": لا تُعرض البطاقة مجددًا على هذا الجهاز لمدة أسبوع (لا يُزامَن مع الخادم — راجع cloudSync LOCAL_ONLY) */
export const INSTALL_DISMISS_KEY = 'sahara_install_dismissed_at';
const DISMISS_MS = 7 * 24 * 3600_000;

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** آيفون أو آيباد (آيباد الحديث يعرّف نفسه كـ Mac مع شاشة لمس) */
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

const isTouchDevice = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

const dismissedRecently = () => {
  try {
    return Date.now() - Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0) < DISMISS_MS;
  } catch {
    return false;
  }
};

export const useInstallPrompt = () => {
  const [, rerender] = useState(0);
  const [dismissed, setDismissed] = useState(dismissedRecently);
  useEffect(() => {
    const l = () => rerender(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const ios = isIOS();
  const mode: 'android' | 'ios' | null =
    isStandalone() || !isTouchDevice() ? null : deferred ? 'android' : ios ? 'ios' : null;

  const install = async () => {
    if (!deferred) return;
    const e = deferred;
    deferred = null;
    await e.prompt();
    await e.userChoice.catch(() => undefined);
    notify();
  };
  const dismiss = () => {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch { /* تجاهل */ }
    setDismissed(true);
  };
  return { mode: dismissed ? null : mode, install, dismiss };
};
