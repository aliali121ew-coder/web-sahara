import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';

/**
 * السجل اليومي للنفط الأسود — المصدر المركزي لبيانات النفط الأسود.
 * كل يوم: الكمية السابقة (= حالية اليوم الذي قبله) + الوارد − الاستهلاك = الكمية الحالية.
 * الوارد والاستهلاك ومتوسط الاستهلاك تُدخل يدويًا، والباقي يُحسب.
 * الصفحات المرتبطة (بطاقات النفط الأسود، التقارير، كشف الخزانات) تقرأ من هنا.
 */
export interface BlackOilRecord {
  id: string;
  date: string; // YYYY/MM/DD
  inbound: number;
  consumption: number;
  /** متوسط الاستهلاك اليومي المعتمد وقت الإدخال */
  avgDaily: number;
  /** سعر شراء اللتر لهذا اليوم (د.ع) — يُربط بكارت الأسعار وصفحة المشتريات */
  price?: number | null;
  /** الكمية السابقة يدويًا (لأول سجل = الرصيد الافتتاحي، أو لتصحيح رصيد) */
  previousOverride?: number | null;
  /** صورة مناسيب كل الخزانات وقت الحفظ { tankId: levelMeters } لطباعة كشف الجرد كما كان */
  tanksSnapshot?: Record<string, number>;
  /** وقت الحفظ (ISO) */
  savedAt?: string;
  /** تفصيل مواقع التخزين (الاتحاد: موقع الريان، موقع السكر) — الإجماليات أعلاه = مجموعها */
  sites?: Record<string, BlackOilSiteEntry>;
  /** حقل قديم (قبل إدخال الاستهلاك يدويًا) يُحوَّل تلقائيًا */
  current?: number;
}

/** قيم موقع تخزين في يوم */
export interface BlackOilSiteEntry {
  inbound: number;
  consumption: number;
  /** الرصيد الحقيقي بالخزانات (من التقرير) — إن وُجد يكون هو الكمية الحالية للموقع */
  actual: number | null;
  /** مستوى الفارغ الحالي */
  empty?: number | null;
}

/** صف موقع محسوب للعرض */
export interface ComputedSiteRow {
  key: string;
  name: string;
  previous: number;
  inbound: number;
  consumption: number;
  current: number;
  empty: number | null;
  pct: number | null;
  /** الفرق = الرصيد الحقيقي − (السابقة + الوارد − الاستهلاك): سالب = نقص، موجب = زيادة */
  diff: number;
  /** السعة = الرصيد الحقيقي + الفراغ (من التقرير) */
  capacity: number | null;
}

export interface ComputedBlackOilRecord extends BlackOilRecord {
  previous: number;
  current: number;
  pct: number | null;
  siteRows: ComputedSiteRow[];
  /** الفرق بين الرصيد الحقيقي والمحسوب لليوم (مجموع المواقع) */
  diff: number;
}

/** مواقع تخزين النفط الأسود لكل شركة (بترتيب العرض)، وكلمات مطابقتها في ملف التقرير */
export const BLACK_OIL_SITES: Record<BlackOilCompany, { key: string; name: string; words: string[] }[]> = {
  etihad: [
    { key: 'rayyan', name: 'موقع الريان', words: ['ريان'] },
    { key: 'sukkar', name: 'موقع السكر', words: ['سكر'] }
  ],
  // الصحاري: "موقف الصحاري" في نفس ملف التقرير اليومي
  sahara: [{ key: 'sahara', name: 'موقع الصحاري', words: ['صحاري'] }]
};
const siteName = (key: string) => Object.values(BLACK_OIL_SITES).flat().find(s => s.key === key)?.name ?? key;

/** الشركة صاحبة السجل: لكل شركة سجل نفط أسود مستقل */
export type BlackOilCompany = 'etihad' | 'sahara';

const STORAGE_KEYS: Record<BlackOilCompany, string> = {
  etihad: 'etihad_black_oil_daily_ledger_v1',
  sahara: 'sahara_black_oil_daily_ledger_v1'
};
const AVG_KEYS: Record<BlackOilCompany, string> = {
  etihad: 'etihad_black_oil_avg_daily_v1',
  sahara: 'sahara_black_oil_avg_daily_v1'
};
const SYNC_EVENT = 'black-oil-ledger-updated';
export const DEFAULT_BLACK_OIL_AVG_DAILY = 520000;

/** قسم النفط الأسود لكل شركة في منظومة الخزانات */
export const BLACK_OIL_SECTION_KEYS: Record<BlackOilCompany, string> = {
  etihad: 'etihad-black-oil',
  sahara: 'sahara-gas-8'
};

export const readBlackOilRecords = (company: BlackOilCompany = 'etihad'): BlackOilRecord[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS[company]) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

/** الحساب بالترتيب الزمني (تصاعدي) */
export const computeBlackOil = (records: BlackOilRecord[]): ComputedBlackOilRecord[] => {
  const asc = [...records].sort((a, b) => a.date.localeCompare(b.date));
  let prevCurrent = 0;
  const prevSite: Record<string, number> = {};
  return asc.map(r => {
    const previous = r.previousOverride ?? prevCurrent;
    const available = previous + (r.inbound || 0);
    // سجلات قديمة كانت تحفظ الحالية بدل الاستهلاك
    const consumption = typeof r.consumption === 'number' ? r.consumption : Math.max(0, available - (r.current ?? available));
    // مواقع التخزين: الكمية الحالية = الرصيد الحقيقي بالخزانات، والسابقة = حالية نفس الموقع في اليوم الذي قبله
    const siteRows: ComputedSiteRow[] = Object.entries(r.sites || {}).map(([key, s]) => {
      const cur = s.actual ?? (prevSite[key] ?? 0) + s.inbound - s.consumption;
      const prev = prevSite[key] ?? cur - s.inbound + s.consumption;
      const avail = prev + s.inbound;
      prevSite[key] = cur;
      const empty = s.empty ?? null;
      return {
        key, name: siteName(key), previous: prev, inbound: s.inbound, consumption: s.consumption, current: cur, empty,
        pct: avail > 0 ? (s.consumption / avail) * 100 : null,
        diff: cur - (avail - s.consumption),
        capacity: empty !== null ? cur + empty : null
      };
    });
    const allActual = siteRows.length > 0 && Object.values(r.sites || {}).every(s => s.actual !== null && s.actual !== undefined);
    const current = allActual ? siteRows.reduce((a, s) => a + s.current, 0) : available - consumption;
    prevCurrent = current;
    return {
      ...r,
      consumption,
      avgDaily: r.avgDaily || DEFAULT_BLACK_OIL_AVG_DAILY,
      previous,
      current,
      pct: available > 0 ? (consumption / available) * 100 : null,
      siteRows,
      diff: current - (available - consumption)
    };
  });
};

/** متوسط الاستهلاك المعتمد = آخر قيمة أُدخلت في السجل */
export const getBlackOilAvgDaily = (company: BlackOilCompany = 'etihad'): number => {
  const last = computeBlackOil(readBlackOilRecords(company)).pop();
  if (last?.avgDaily) return last.avgDaily;
  const v = Number(localStorage.getItem(AVG_KEYS[company]));
  return v > 0 ? v : DEFAULT_BLACK_OIL_AVG_DAILY;
};

const writeRecords = (company: BlackOilCompany, records: BlackOilRecord[]) => {
  localStorage.setItem(STORAGE_KEYS[company], JSON.stringify(records));
  const last = computeBlackOil(records).pop();
  if (last) localStorage.setItem(AVG_KEYS[company], String(last.avgDaily));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

/** قراءة/كتابة السجل مع مزامنة حية بين كل الصفحات */
export const useBlackOilLedger = (company: BlackOilCompany = 'etihad') => {
  const [records, setRecords] = useState<BlackOilRecord[]>(() => readBlackOilRecords(company));

  useEffect(() => {
    const refresh = () => setRecords(readBlackOilRecords(company));
    refresh();
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEYS[company]) refresh(); };
    // تعديلات من متصفح/جهاز آخر وصلت من السحابة أثناء فتح الصفحة
    const onCloud = (e: Event) => { const keys = (e as CustomEvent<string[]>).detail ?? []; if (keys.includes(STORAGE_KEYS[company])) refresh(); };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
  }, [company]);

  const update = useCallback((fn: (prev: BlackOilRecord[]) => BlackOilRecord[]) => {
    writeRecords(company, fn(readBlackOilRecords(company)));
  }, [company]);

  const computed = useMemo(() => computeBlackOil(records), [records]);
  const latest = computed.length ? computed[computed.length - 1] : null;
  const avgDaily = latest?.avgDaily ?? getBlackOilAvgDaily(company);
  const balance = latest?.current ?? 0;
  const coverageDays = avgDaily > 0 ? Math.floor(balance / avgDaily) : 0;

  return { records, computed, latest, balance, avgDaily, coverageDays, update };
};
