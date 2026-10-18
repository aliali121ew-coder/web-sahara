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
