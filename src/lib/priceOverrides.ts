import { useCallback, useEffect, useState } from 'react';

/**
 * السعر اليدوي لكروت الأسعار (ضغط مطوّل على الكارت ← تعديل السعر).
 * السعر يُؤخذ تلقائيًا من الوارد، والتعديل اليدوي يبقى فقط حتى أول عملية وارد جديدة:
 * يُحفظ معه "توقيع" الوارد وقت التعديل (عدد الشحنات المسعّرة + آخر تاريخ)، وإذا تغيّر التوقيع يُتجاهل ويعود التلقائي.
 */
export interface PriceOverride {
  price: number;
  /** وقت التعديل (ISO) */
  setAt: string;
  /** توقيع الوارد وقت التعديل */
  baseSig: string;
}

const KEY = 'fuel_price_overrides_v1';
const SYNC_EVENT = 'fuel-price-overrides-updated';

const read = (): Record<string, PriceOverride> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

const write = (v: Record<string, PriceOverride>) => {
  localStorage.setItem(KEY, JSON.stringify(v));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

export const usePriceOverrides = () => {
  const [overrides, setOverrides] = useState<Record<string, PriceOverride>>(read);

  useEffect(() => {
    const refresh = () => setOverrides(read());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) refresh(); };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setOverride = useCallback((id: string, price: number, baseSig: string) => {
    write({ ...read(), [id]: { price, setAt: new Date().toISOString(), baseSig } });
  }, []);

  const clearOverride = useCallback((id: string) => {
    const next = read();
    delete next[id];
    write(next);
  }, []);

  return { overrides, setOverride, clearOverride };
};
