import { useCallback, useState } from 'react';

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

  return [value, set] as const;
}
