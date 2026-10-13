import { useCallback, useEffect, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import { keepIfSame } from './keepIfSame';
import { FARM_SITES, type FarmRow, type FarmSite } from './siteFarmsTypes';

/**
 * بيانات صفحة "مزارع الموقع" (الصحاري): معزولة تمامًا عن باقي الصفحات.
 * عنصران في مجموعة واحدة، كل عنصر يُعرَّف بـ id:
 * - annual: المصروف اليومي لسنة كاملة لموقع (مزارع + مولدات وآليات) من الملف السنوي، مصفوفتان بترتيب أيام السنة
 * - farms: لقطات الكشف اليومي لمزارع موقع في شهر واحد (الرصيد السابق والوارد والمصروف والرصيد لكل مزرعة)
 */
export const SITE_FARMS_KEY = 'sahara_site_farms_v1';
const SYNC_EVENT = 'sahara-site-farms-updated';

export { FARM_SITES };
export type { FarmSite, FarmRow };

export interface AnnualRecord {
  id: string;
  kind: 'annual';
  site: string;
  year: number;
  /** مصروف المزارع لكل يوم (فهرس 0 = 1 كانون الثاني) */
  f: number[];
  /** مصروف المولدات والآليات لكل يوم */
  g: number[];
  savedAt?: string;
}

/** أعمدة أرقام اليوم بترتيب أسماء المزارع في names (null = لا قيمة) */
export interface FarmDayCols {
  p: (number | null)[];
  i: (number | null)[];
  c: (number | null)[];
  b: (number | null)[];
}

export interface FarmsMonthRecord {
  id: string;
  kind: 'farms';
  site: string;
  /** YYYY-MM */
  ym: string;
  names: string[];
  /** يوم الشهر (DD) → أرقام اليوم */
  days: Record<string, FarmDayCols>;
  savedAt?: string;
}

export type SiteFarmsRecord = AnnualRecord | FarmsMonthRecord;


const isRecord = (r: unknown): r is SiteFarmsRecord =>
  !!r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string'
  && ((r as { kind?: unknown }).kind === 'annual' || (r as { kind?: unknown }).kind === 'farms');

export const readSiteFarms = (): SiteFarmsRecord[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(SITE_FARMS_KEY) || 'null');
    return Array.isArray(saved) ? saved.filter(isRecord) : [];
  } catch {
    return [];
  }
};

const write = (records: SiteFarmsRecord[]) => {
  localStorage.setItem(SITE_FARMS_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

const upsert = (rec: SiteFarmsRecord) => {
  const all = readSiteFarms();
  const i = all.findIndex(r => r.id === rec.id);
  if (i >= 0) all[i] = rec; else all.push(rec);
  write(all);
};

/** حفظ سنة كاملة لموقع (تستبدل ما قبلها لنفس الموقع والسنة) */
export const saveAnnual = (site: string, year: number, f: number[], g: number[]) =>
  upsert({ id: `annual|${site}|${year}`, kind: 'annual', site, year, f, g, savedAt: new Date().toISOString() });

/** حفظ لقطة يوم لمزارع موقع داخل سجل شهره (date بصيغة YYYY/MM/DD) */
export const saveFarmsDay = (site: string, date: string, rows: FarmRow[]) => {
  const [y, m, d] = date.split('/');
  const ym = `${y}-${m}`;
  const id = `farms|${site}|${ym}`;
  const existing = readSiteFarms().find((r): r is FarmsMonthRecord => r.id === id && r.kind === 'farms');
  const names = existing ? [...existing.names] : [];
  // ترتيب أعمدة اليوم يتبع names؛ مزرعة جديدة تُضاف في نهايتها
  rows.forEach(r => { if (!names.includes(r.name)) names.push(r.name); });
  const byName = new Map(rows.map(r => [r.name, r]));
  const aligned = (k: 'previous' | 'inbound' | 'consumption' | 'balance') => names.map(n => byName.get(n)?.[k] ?? null);
  const days = { ...(existing?.days ?? {}), [d]: { p: aligned('previous'), i: aligned('inbound'), c: aligned('consumption'), b: aligned('balance') } };
  upsert({ id, kind: 'farms', site, ym, names, days, savedAt: new Date().toISOString() });
};

export const annualFor = (records: SiteFarmsRecord[], site: string, year: number) =>
  records.find((r): r is AnnualRecord => r.kind === 'annual' && r.site === site && r.year === year) ?? null;

export const annualYears = (records: SiteFarmsRecord[], site: string) =>
  records.filter((r): r is AnnualRecord => r.kind === 'annual' && r.site === site).map(r => r.year).sort((a, b) => a - b);

/** تواريخ الكشوف اليومية المحفوظة لموقع (YYYY/MM/DD تصاعديًا) */
export const farmsDates = (records: SiteFarmsRecord[], site: string): string[] => {
  const out: string[] = [];
  for (const r of records) {
    if (r.kind !== 'farms' || r.site !== site) continue;
    for (const d of Object.keys(r.days)) out.push(`${r.ym.replace('-', '/')}/${d}`);
  }
  return out.sort();
};

export const farmsOn = (records: SiteFarmsRecord[], site: string, date: string): FarmRow[] => {
  const [y, m, d] = date.split('/');
  const rec = records.find((r): r is FarmsMonthRecord => r.kind === 'farms' && r.site === site && r.ym === `${y}-${m}`);
  const cols = rec?.days[d];
  if (!rec || !cols) return [];
  return rec.names.map((name, i) => ({
    name,
    previous: cols.p[i] ?? null,
    inbound: cols.i[i] ?? null,
    consumption: cols.c[i] ?? null,
    balance: cols.b[i] ?? null,
  })).filter(r => r.previous !== null || r.balance !== null || r.consumption !== null);
};

/** مزامنة حية بين التبويبات والأجهزة (نفس نمط بقية السجلات) */
export const useSiteFarms = () => {
  const [records, setRecords] = useState<SiteFarmsRecord[]>(readSiteFarms);
  const refresh = useCallback(() => setRecords(keepIfSame(readSiteFarms())), []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === SITE_FARMS_KEY) refresh(); };
    const onCloud = (e: Event) => { if (((e as CustomEvent<string[]>).detail ?? []).includes(SITE_FARMS_KEY)) refresh(); };
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
  return records;
};
