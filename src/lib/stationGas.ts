import { useCallback, useEffect, useState } from 'react';
import type { InboundDelivery } from '../types';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import { keepIfSame } from './keepIfSame';
import { getProfile } from './session';
import { deliverySupplier, indexDeliveries, deliveriesFromIndex, supplierKey } from './archiveSuppliers';
import { deliveryDay } from './inboundPrice';

/**
 * كارت «كاز محطات» (صفحة الأسعار): يُختار له مجهز أو أكثر من أرشيف وارد الصحاري، ويأخذ سعره وكميته
 * من أحدث يوم وارد بين المختارين، ومن المجهزين الذين وردوا في ذلك اليوم فقط
 * (كميات اليوم تُجمع، والسعر متوسط موزون بالكمية مثل كروت الأرشيف).
 * يتحدّث تلقائيًا مع كل وارد جديد للمجهزين المختارين، وكل تغيّر يُحفظ في سجل خاص بالكارت للمقارنة.
 */

/** آخر يوم وارد لمجهز واحد */
export interface StationGasPart {
  name: string;
  date: string;
  qty: number;
  /** متوسط سعر اللتر في ذلك اليوم (0 = بلا سعر) */
  price: number;
}

export interface StationGasLive {
  parts: StationGasPart[];
  price: number;
  volume: number;
  date: string;
  /** توقيع يتغيّر مع أي تغيّر في المجهزين أو آخر واردهم */
  sig: string;
}

/** حالة الكارت المحفوظة (تُزامَن مع الخادم) */
export interface StationGasState {
  suppliers: string[];
  price: number;
  previousPrice: number;
  volume: number;
  date: string;
  sig: string;
}

export interface StationGasLogEntry {
  id: string;
  at: string;
  by: string;
  /** select = تغيير المجهزين يدويًا، auto = وارد جديد */
  reason: 'select' | 'auto';
  suppliers: string[];
  parts: StationGasPart[];
  price: number;
  prevPrice: number | null;
  volume: number;
  date: string;
}

export const STATION_GAS_KEY = 'sahara_station_gas_v1';
export const STATION_GAS_LOG_KEY = 'sahara_station_gas_log_v1';
const SYNC_EVENT = 'sahara-station-gas-updated';
const MAX_LOG = 1000;

const round1 = (v: number) => Math.round(v * 10) / 10;
const qtyOf = (d: InboundDelivery) => Number(d.receivedQuantity ?? d.volumeLiters) || 0;
const priceOfD = (d: InboundDelivery) => Number(d.productPrice ?? d.pricePerLiter) || 0;
const valid = (d: InboundDelivery) => d.status !== 'ملغي' && qtyOf(d) > 0;

/** آخر يوم وارد لمجهز: مجموع كميات ذلك اليوم، وسعره متوسط موزون بكميات الشحنات المسعّرة */
const lastDayOf = (list: InboundDelivery[], name: string): StationGasPart | null => {
  const ds = list.filter(valid);
  if (!ds.length) return null;
  const date = ds.map(deliveryDay).sort().pop()!;
  const day = ds.filter(d => deliveryDay(d) === date);
  const qty = day.reduce((a, d) => a + qtyOf(d), 0);
  const priced = day.filter(d => priceOfD(d) > 0);
  const pq = priced.reduce((a, d) => a + qtyOf(d), 0);
  const price = pq ? round1(priced.reduce((a, d) => a + qtyOf(d) * priceOfD(d), 0) / pq) : 0;
  return { name, date, qty, price };
};

/** مجهزو أرشيف الصحاري مع آخر يوم وارد لكل منهم (الأحدث أولًا) — قائمة الاختيار */
export const stationGasOptions = (sahara: InboundDelivery[]): StationGasPart[] => {
  const out: StationGasPart[] = [];
  for (const [key, list] of indexDeliveries(sahara)) {
    if (!key || key === '_' || key === '-') continue;
    const freq = new Map<string, number>();
    list.forEach(d => { const n = deliverySupplier(d).replace(/\s+/g, ' ').trim(); if (n) freq.set(n, (freq.get(n) ?? 0) + 1); });
    const name = [...freq].sort((a, b) => b[1] - a[1])[0]?.[0];
    const part = name ? lastDayOf(list, name) : null;
    if (part) out.push(part);
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
};

/**
 * أجزاء الكارت: أحدث يوم وارد بين المجهزين المختارين، ومن ورد في ذلك اليوم فقط
 * (مجهز آخر وارده أقدم لا يُجمع مع اليوم الأحدث)
 */
export const latestDayParts = (parts: StationGasPart[]) => {
  const date = parts.map(p => p.date).sort().pop() ?? '';
  return parts.filter(p => p.date === date);
};

/** قيم الكارت من المجهزين المختارين: أحدث يوم وارد بينهم، الكمية مجموع وارد ذلك اليوم والسعر متوسطه الموزون */
export const stationGasLive = (sahara: InboundDelivery[], suppliers: string[]): StationGasLive | null => {
  if (!suppliers.length) return null;
  const idx = indexDeliveries(sahara);
  const parts = latestDayParts(suppliers.map(n => lastDayOf(deliveriesFromIndex(idx, n), n)).filter((p): p is StationGasPart => !!p));
  const volume = parts.reduce((a, p) => a + p.qty, 0);
  const priced = parts.filter(p => p.price > 0);
  const pq = priced.reduce((a, p) => a + p.qty, 0);
  const price = pq ? round1(priced.reduce((a, p) => a + p.qty * p.price, 0) / pq) : 0;
  const date = parts.map(p => p.date).sort().pop() ?? '';
  const sig = [...suppliers].map(supplierKey).sort().join('+') + '|' + parts.map(p => `${p.date}:${p.qty}:${p.price}`).join(',');
  return { parts, price, volume, date, sig };
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
export const readStationGas = (): StationGasState | null => {
  const v = readJson<StationGasState | null>(STATION_GAS_KEY, null);
  return v && Array.isArray(v.suppliers) ? v : null;
};
export const readStationGasLog = (): StationGasLogEntry[] => {
  const v = readJson<StationGasLogEntry[]>(STATION_GAS_LOG_KEY, []);
  return Array.isArray(v) ? v : [];
};

/**
 * يحفظ قيم الكارت الجديدة ويضيف عملية للسجل، فقط إن تغيّر التوقيع عن المحفوظ
 * (عدة أجزاء من الصفحة قد تستدعيه معًا: القراءة من التخزين مباشرة تمنع التكرار)
 */
export const applyStationGas = (suppliers: string[], live: StationGasLive | null, reason: 'select' | 'auto'): boolean => {
  const old = readStationGas();
  const sig = live?.sig ?? `${suppliers.join('+')}|`;
  if (old && old.sig === sig && old.suppliers.join('|') === suppliers.join('|')) return false;
  const price = live?.price ?? 0;
  const oldPrice = old?.price ?? 0;
  const next: StationGasState = {
    suppliers,
    price,
    previousPrice: oldPrice && oldPrice !== price ? oldPrice : old?.previousPrice ?? price,
    volume: live?.volume ?? 0,
    date: live?.date ?? '',
    sig,
  };
  const p = getProfile();
  const entry: StationGasLogEntry = {
    id: `sg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    by: p?.name || p?.username || '',
    reason,
    suppliers,
    parts: live?.parts ?? [],
    price,
    prevPrice: old ? oldPrice : null,
    volume: next.volume,
    date: next.date,
  };
  try {
    localStorage.setItem(STATION_GAS_KEY, JSON.stringify(next));
    localStorage.setItem(STATION_GAS_LOG_KEY, JSON.stringify([entry, ...readStationGasLog()].slice(0, MAX_LOG)));
  } catch { /* امتلاء التخزين: لا يتعطل العرض */ }
  window.dispatchEvent(new Event(SYNC_EVENT));
  return true;
};

/** يفرّغ سجل الكارت الخاص (قيم الكارت الحالية تبقى) */
export const clearStationGasLog = () => {
  try {
    localStorage.setItem(STATION_GAS_LOG_KEY, '[]');
  } catch { /* لا يتعطل العرض */ }
  window.dispatchEvent(new Event(SYNC_EVENT));
};

/** قراءة حية لحالة الكارت وسجله (تبويبات وأجهزة أخرى) */
export const useStationGas = () => {
  const [state, setState] = useState<StationGasState | null>(readStationGas);
  const [log, setLog] = useState<StationGasLogEntry[]>(readStationGasLog);
  const refresh = useCallback(() => {
    setState(keepIfSame(readStationGas()));
    setLog(keepIfSame(readStationGasLog()));
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === STATION_GAS_KEY || e.key === STATION_GAS_LOG_KEY) refresh(); };
    const onCloud = (e: Event) => { const keys = (e as CustomEvent<string[]>).detail ?? []; if (keys.includes(STATION_GAS_KEY) || keys.includes(STATION_GAS_LOG_KEY)) refresh(); };
    // الصفحة المخفية لا تسمع الأحداث: تُعاد القراءة عند ظهورها
    refresh();
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
  }, [refresh]);
  return { state, log };
};
