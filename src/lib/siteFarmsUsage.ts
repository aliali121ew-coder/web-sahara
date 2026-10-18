import { farmsDates, farmsOn, isTankRow, type FarmRow, type SiteFarmsRecord } from './siteFarms';

/**
 * استهلاك المزارع من الكشوف اليومية المحفوظة (كل يوم يُسجَّل عند حفظ كشف رصيد الصحاري):
 * جدول شهر لموقع (مزرعة × يوم) ومجموع كل يوم، وسلسلة أيام مزرعة واحدة لنافذتها.
 * خزان المحطة ليس مزرعة (مصروفه يكرر مصروف المزارع) فلا يدخل في استهلاك المزارع.
 */

/** الأشهر التي فيها كشف يومي للموقع (YYYY-MM، الأحدث أولًا) */
export const usageMonths = (records: SiteFarmsRecord[], site: string): string[] =>
  [...new Set(farmsDates(records, site).map(d => d.slice(0, 7).replace('/', '-')))].sort().reverse();

export interface UsageMonth {
  /** أيام الشهر التي فيها كشف (YYYY/MM/DD تصاعديًا) */
  dates: string[];
  /** المزارع (بترتيب ظهورها في الكشوف) ومصروفها لكل يوم (null = لا رقم في ذلك اليوم) */
  farms: { name: string; days: (number | null)[]; total: number }[];
  /** مجموع مصروف المزارع لكل يوم */
  dayTotals: number[];
  total: number;
}

export const usageMonth = (records: SiteFarmsRecord[], site: string, ym: string): UsageMonth => {
  const prefix = ym.replace('-', '/');
  const dates = farmsDates(records, site).filter(d => d.startsWith(prefix));
  const names: string[] = [];
  const byDay = dates.map(d => {
    const rows = farmsOn(records, site, d).filter(r => !isTankRow(r.name));
    for (const r of rows) if (!names.includes(r.name)) names.push(r.name);
    return new Map(rows.map(r => [r.name, r.consumption]));
  });
  const farms = names.map(name => {
    const days = byDay.map(m => m.get(name) ?? null);
    return { name, days, total: days.reduce<number>((s, v) => s + (v ?? 0), 0) };
  });
  const dayTotals = dates.map((_, i) => farms.reduce((s, f) => s + (f.days[i] ?? 0), 0));
  return { dates, farms, dayTotals, total: dayTotals.reduce((s, v) => s + v, 0) };
};

export interface FarmDay extends FarmRow { date: string }

/** كل أيام مزرعة واحدة في الكشوف (تصاعديًا) */
export const farmSeries = (records: SiteFarmsRecord[], site: string, farm: string): FarmDay[] => {
  const out: FarmDay[] = [];
  for (const date of farmsDates(records, site)) {
    const row = farmsOn(records, site, date).find(r => r.name === farm);
    if (row) out.push({ ...row, date });
  }
  return out;
};

/** ملخص أيام مزرعة: المجموع والمعدل اليومي وأعلى يوم وآخر رصيد */
export const farmSummary = (days: FarmDay[]) => {
  const used = days.filter(d => d.consumption !== null);
  const total = used.reduce((s, d) => s + (d.consumption ?? 0), 0);
  const peak = used.reduce<FarmDay | null>((a, d) => (!a || (d.consumption ?? 0) > (a.consumption ?? 0) ? d : a), null);
  const last = [...days].reverse().find(d => d.balance !== null) ?? null;
  return { total, avg: used.length ? Math.round(total / used.length) : 0, peak, lastBalance: last?.balance ?? null, days: used.length };
};

export interface FarmGroup {
  /** مفتاح الفترة: بداية الأسبوع YYYY/MM/DD أو الشهر YYYY-MM */
  key: string;
  from: string;
  to: string;
  days: number;
  total: number;
  avg: number;
  /** التغيّر عن الفترة السابقة (%)، null لأول فترة أو إن كانت السابقة صفرًا */
  change: number | null;
  lastBalance: number | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (d: string) => { const [y, m, dd] = d.split('/').map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
const fromDate = (t: Date) => `${t.getUTCFullYear()}/${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())}`;
/** بداية الأسبوع (السبت) لتاريخ */
export const weekStart = (d: string) => {
  const t = toDate(d);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 1) % 7));
  return fromDate(t);
};

/** استهلاك المزرعة مجمّعًا أسبوعيًا (السبت–الجمعة) أو شهريًا، الأحدث أولًا */
export const groupFarmDays = (days: FarmDay[], by: 'week' | 'month'): FarmGroup[] => {
  const groups = new Map<string, FarmDay[]>();
  for (const d of days) {
    const key = by === 'week' ? weekStart(d.date) : d.date.slice(0, 7).replace('/', '-');
    const list = groups.get(key);
    if (list) list.push(d); else groups.set(key, [d]);
  }
  const asc = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, list]) => {
    const s = farmSummary(list);
    let from: string, to: string;
    if (by === 'week') {
      const end = toDate(key); end.setUTCDate(end.getUTCDate() + 6);
      from = key; to = fromDate(end);
    } else {
      const [y, m] = key.split('-').map(Number);
      from = `${y}/${pad(m)}/01`; to = `${y}/${pad(m)}/${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
    }
    return { key, from, to, days: s.days, total: s.total, avg: s.avg, lastBalance: s.lastBalance, change: null as number | null };
  });
  asc.forEach((g, i) => {
    const prev = asc[i - 1];
    if (prev && prev.total > 0) g.change = Math.round(((g.total - prev.total) / prev.total) * 1000) / 10;
  });
  return asc.reverse();
};

/** أيام المزرعة بين تاريخين (شاملين)، الأحدث أولًا */
export const farmDaysBetween = (days: FarmDay[], from: string, to: string) =>
  days.filter(d => d.date >= from && d.date <= to).reverse();

/** أيام أسبوع تاريخ (السبت–الجمعة) ومصروف كل مزرعة فيها (null = لا كشف أو لا رقم) — لعمود الرسم الأسبوعي */
export const weekUsage = (records: SiteFarmsRecord[], site: string, date: string) => {
  const start = toDate(weekStart(date));
  const dates = Array.from({ length: 7 }, (_, i) => { const t = new Date(start); t.setUTCDate(t.getUTCDate() + i); return fromDate(t); });
  const recorded = new Set(farmsDates(records, site));
  const byFarm = new Map<string, (number | null)[]>();
  dates.forEach((d, i) => {
    if (!recorded.has(d)) return;
    for (const r of farmsOn(records, site, d)) {
      const list = byFarm.get(r.name) ?? Array<number | null>(7).fill(null);
      list[i] = r.consumption;
      byFarm.set(r.name, list);
    }
  });
  return { dates, byFarm };
};

export interface SiteDayTotals { date: string | null; previous: number; inbound: number; consumption: number; balance: number; farms: number }

/** مجاميع يوم لموقع من الكشف (خزان المحطة + كل المزارع): السابق والوارد والاستهلاك والتراكمي؛ اليوم = آخر كشف إن لم يُحدَّد */
export const siteDayTotals = (records: SiteFarmsRecord[], site: string, date?: string | null): SiteDayTotals => {
  const dates = farmsDates(records, site);
  const day = date && dates.includes(date) ? date : (dates[dates.length - 1] ?? null);
  const rows = day ? farmsOn(records, site, day) : [];
  const sum = (k: 'previous' | 'inbound' | 'consumption' | 'balance') => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
  return { date: day, previous: sum('previous'), inbound: sum('inbound'), consumption: sum('consumption'), balance: sum('balance'), farms: rows.filter(r => !isTankRow(r.name)).length };
};
