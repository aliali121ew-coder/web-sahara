import { useCallback, useEffect, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';

/**
 * كارت يدوي بالكامل (كاز محطات): لا يرتبط بأي وارد أو سجل، ويُدخل السعر والكمية والتاريخ للعرض فقط.
 * يُحفظ في المتصفح بنفس أسلوب تعديل الأسعار اليدوي.
 */
export interface ManualFuelCard {
  price: number;
  /** السعر قبل آخر تعديل (لحساب نسبة التغير) */
  previousPrice: number;
  volume: number;
  /** yyyy/mm/dd */
  date: string;
}

const KEY = 'fuel_manual_cards_v1';
const SYNC_EVENT = 'fuel-manual-cards-updated';

const read = (): Record<string, ManualFuelCard> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

const write = (v: Record<string, ManualFuelCard>) => {
  localStorage.setItem(KEY, JSON.stringify(v));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

export const useManualFuelCards = () => {
  const [cards, setCards] = useState<Record<string, ManualFuelCard>>(read);

  useEffect(() => {
    const refresh = () => setCards(read());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) refresh(); };
    // تعديلات من متصفح/جهاز آخر وصلت من السحابة أثناء فتح الصفحة
    const onCloud = (e: Event) => { const keys = (e as CustomEvent<string[]>).detail ?? []; if (keys.includes(KEY)) refresh(); };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
  }, []);

  /** يحفظ القيم الجديدة؛ إن تغيّر السعر يصير القديم "السابق" */
  const saveCard = useCallback((id: string, next: { price: number; volume: number; date: string }, fallbackPrice: number) => {
    const all = read();
    const prev = all[id];
    const oldPrice = prev?.price ?? fallbackPrice;
    all[id] = {
      ...next,
      previousPrice: next.price !== oldPrice ? oldPrice : prev?.previousPrice ?? oldPrice,
    };
    write(all);
  }, []);

  return { cards, saveCard };
};
