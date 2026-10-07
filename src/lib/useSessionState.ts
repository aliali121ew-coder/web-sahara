import { useCallback, useEffect, useState } from 'react';

const EVENT = 'sahara-session-state';

/**
 * حالة واجهة تبقى بعد تحديث الصفحة (F5) في نفس النافذة، مثل التبويب أو الصفحة الفرعية المفتوحة.
 * تُحفظ في sessionStorage فلا تُزامَن مع الخادم ولا تنتقل لأجهزة أخرى.
 */
export function useSessionState<T>(key: string, initial: T) {
  const storageKey = `sahara_view_${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved !== null ? (JSON.parse(saved) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* تجاهل */
      }
    },
    [storageKey]
  );

  // تغييرها من مكان آخر (setSessionValue) يصل للمكوّن حتى لو كان مفتوحًا ومحفوظًا في الخلفية
  useEffect(() => {
    const on = (e: Event) => {
      const { key: k, value: v } = (e as CustomEvent<{ key: string; value: T }>).detail;
      if (k === key) setValue(v);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [key]);

  return [value, set] as const;
}

/** تعيين حالة جلسة من خارج المكوّن (مثل الانتقال لتبويب معيّن في صفحة أخرى) */
export function setSessionValue<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(`sahara_view_${key}`, JSON.stringify(value));
  } catch {
    /* تجاهل */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { key, value } }));
}
