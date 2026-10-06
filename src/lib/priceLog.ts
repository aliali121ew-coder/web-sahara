import { useEffect, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import { getProfile } from './session';

/**
 * سجل الأسعار والمشتريات: الملف المرجعي لكل عملية حفظ في جدول «كل الموردين» وأسعار كروت المشتريات.
 * كل تعديل يُضاف هنا (لا يُعدَّل ولا يُحذف)، ويُقارَن الجدولان معه لكشف أي سعر تغيّر بلا عملية مسجّلة.
 * يُزامَن مع السحابة مثل باقي البيانات.
 */
export type PriceLogSource = 'suppliers' | 'purchases';
export type PriceLogAction = 'create' | 'update' | 'delete' | 'reset' | 'snapshot';

export interface PriceLogEntry {
  id: string;
  /** وقت العملية (ISO) */
  at: string;
  /** اسم المستخدم الذي نفّذها */
  by: string;
  source: PriceLogSource;
  action: PriceLogAction;
  /** معرّف السجل/الكارت الذي تخصه العملية (للمقارنة) */
  key: string;
  name: string;
  company?: 'sahara' | 'etihad';
  product?: string;
  density?: string;
  color?: string;
  prevPrice: number | null;
  price: number | null;
  /** الحقول التي تغيّرت في التعديل */
  changes?: string[];
}

export const PRICE_LOG_KEY = 'sahara_price_log_v1';
const SYNC_EVENT = 'sahara-price-log-updated';
const MAX = 3000;

const read = (): PriceLogEntry[] => {
  try {
    const v = JSON.parse(localStorage.getItem(PRICE_LOG_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/** يضيف عملية للسجل (الأحدث أولًا) */
export const logPrice = (e: Omit<PriceLogEntry, 'id' | 'at' | 'by'>) => {
  const p = getProfile();
  const entry: PriceLogEntry = {
    ...e,
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    by: p?.name || p?.username || '',
  };
  try {
    localStorage.setItem(PRICE_LOG_KEY, JSON.stringify([entry, ...read()].slice(0, MAX)));
  } catch { /* امتلاء التخزين: تُتجاهل العملية ولا يتعطل الحفظ */ }
  window.dispatchEvent(new Event(SYNC_EVENT));
};

export const usePriceLog = () => {
  const [log, setLog] = useState<PriceLogEntry[]>(read);
  useEffect(() => {
    const refresh = () => setLog(read());
    const onStorage = (e: StorageEvent) => { if (e.key === PRICE_LOG_KEY) refresh(); };
    // تعديلات من متصفح/جهاز آخر وصلت من السحابة أثناء فتح الصفحة
    const onCloud = (e: Event) => { const keys = (e as CustomEvent<string[]>).detail ?? []; if (keys.includes(PRICE_LOG_KEY)) refresh(); };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
  }, []);
  return log;
};

/** آخر عملية مسجّلة لكل (قسم + معرّف) */
export const lastByKey = (log: PriceLogEntry[]) => {
  const m = new Map<string, PriceLogEntry>();
  for (const e of log) {
    const k = `${e.source}:${e.key}`;
    if (!m.has(k)) m.set(k, e);
  }
  return m;
};
