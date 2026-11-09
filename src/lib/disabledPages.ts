import { useSyncExternalStore } from 'react';
import { sanitizeDisabled } from './permCatalog';

/**
 * الصفحات الموقوفة من «إدارة النظام»: تصل مع حالة البيانات من الخادم وتُحفظ على الجهاز (لا تُزامَن)،
 * فتختفي الصفحة من القائمة عند كل الحسابات ومنها مدير النظام، ولا تُحمَّل بياناتها.
 */
export const DISABLED_PAGES_KEY = 'sahara_disabled_pages';
const EVENT = 'sahara:disabled-pages';

let cache: string[] | null = null;

export const getDisabledPages = (): string[] => {
  if (cache) return cache;
  try { cache = sanitizeDisabled(JSON.parse(localStorage.getItem(DISABLED_PAGES_KEY) || '[]')); } catch { cache = []; }
  return cache;
};

export const setDisabledPages = (list: unknown) => {
  const next = sanitizeDisabled(list);
  if (next.join(',') === getDisabledPages().join(',')) return;
  cache = next;
  try { localStorage.setItem(DISABLED_PAGES_KEY, JSON.stringify(next)); } catch { /* المساحة ممتلئة: تبقى في الذاكرة */ }
  window.dispatchEvent(new Event(EVENT));
};

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export const useDisabledPages = () => useSyncExternalStore(subscribe, getDisabledPages, getDisabledPages);
