import { useCallback, useEffect, useRef, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import { keepIfSame } from './keepIfSame';

const LOCAL_EVENT = 'synced-storage-updated';

/** إبلاغ من يقرأ المفتاح عبر useSyncedStorage بأن قيمته تغيّرت في هذا الجهاز (لمن يكتب localStorage مباشرة) */
export const notifySyncedStorage = (key: string) => window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: key }));

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

/**
 * قيمة محفوظة في localStorage تبقى محدّثة حيًّا: من نوافذ أخرى، ومن أجهزة أخرى (المزامنة السحابية)،
 * ومن مكوّنات أخرى في نفس الصفحة. التعديل يُطبَّق دائمًا على أحدث قيمة محفوظة وليس على نسخة قديمة
 * في الذاكرة، فلا يعيد جهاز متأخر ما حذفه جهاز آخر.
 */
export function useSyncedStorage<T>(key: string, fallback: T) {
  const fallbackRef = useRef(fallback);
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    const refresh = () => setValue(keepIfSame(read(key, fallbackRef.current)));
    const onStorage = (e: StorageEvent) => { if (e.key === key) refresh(); };
    const onLocal = (e: Event) => { if ((e as CustomEvent<string>).detail === key) refresh(); };
    const onCloud = (e: Event) => { if ((e as CustomEvent<string[]>).detail?.includes(key)) refresh(); };
    // الصفحة المخفية (Activity) لا تسمع الأحداث: تُعاد القراءة عند ظهورها
    refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener(LOCAL_EVENT, onLocal);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LOCAL_EVENT, onLocal);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
  }, [key]);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    const latest = read(key, fallbackRef.current);
    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(latest) : next;
    localStorage.setItem(key, JSON.stringify(resolved));
    setValue(resolved);
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: key }));
  }, [key]);

  return [value, update] as const;
}
