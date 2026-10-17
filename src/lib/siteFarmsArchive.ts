import { FARM_SITES, annualFor, farmsDates, farmsOn, isTankRow, type SiteFarmsRecord } from './siteFarms';

/**
 * أرشيف مزارع الموقع (تقارير الصحاري): جدول يومي لكل موقع، وملف Excel لكل شهر منتهٍ.
 * كل شيء من سجلات صفحة مزارع الموقع المحفوظة (الملف السنوي + مزارع كشف رصيد الصحاري) — بلا رفع ولا طلبات للخادم.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const dayIndex = (y: number, m: number, d: number) => (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5;

export interface ArchiveDay {
  /** YYYY/MM/DD */
  date: string;
  /** من الملف السنوي (null = اليوم غير مسجّل فيه) */
  f: number | null;
  g: number | null;
  total: number | null;
  /** من كشف رصيد الصحاري: مجموع المصروف اليومي والرصيد التراكمي للمزارع (بلا خزانات المحطات) */
  consumption: number | null;
  balance: number | null;
  farms: number;
}

/** الأشهر التي فيها بيانات لأي موقع (YYYY-MM، الأحدث أولًا) */
export const archiveMonths = (records: SiteFarmsRecord[]): string[] => {
  const set = new Set<string>();
  for (const r of records) {
    if (r.kind === 'farms') {
      if (Object.keys(r.days).length) set.add(r.ym);
      continue;
    }
    for (let m = 1; m <= 12; m++) if (r.f.length > dayIndex(r.year, m, 1)) set.add(`${r.year}-${pad(m)}`);
  }
  return [...set].sort().reverse();
};

/** أيام شهر لموقع: مصروف الملف السنوي وأرقام مزارع الكشف اليومي */
export const monthRows = (records: SiteFarmsRecord[], site: string, ym: string): ArchiveDay[] => {
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const annual = annualFor(records, site, y);
  const daily = new Set(farmsDates(records, site));
  const out: ArchiveDay[] = [];
  for (let d = 1; d <= days; d++) {
    const i = dayIndex(y, m, d);
    const date = `${y}/${pad(m)}/${pad(d)}`;
    const inAnnual = !!annual && i < annual.f.length;
    const farms = daily.has(date) ? farmsOn(records, site, date).filter(r => !isTankRow(r.name)) : [];
    if (!inAnnual && !farms.length) continue;
    const f = inAnnual ? annual!.f[i] || 0 : null;
    const g = inAnnual ? annual!.g[i] || 0 : null;
    out.push({
      date, f, g, total: inAnnual ? f! + g! : null,
      consumption: farms.length ? farms.reduce((s, r) => s + (r.consumption ?? 0), 0) : null,
      balance: farms.length ? farms.reduce((s, r) => s + (r.balance ?? 0), 0) : null,
      farms: farms.length,
    });
  }
  return out;
};

/** ملفات الأرشيف: شهر يُصدَّر ملفه بعد انتهائه (الشهر الجاري يظهر في الجدول فقط) */
export const closedMonths = (records: SiteFarmsRecord[], today = new Date()) => {
  const current = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  return archiveMonths(records).filter(ym => ym < current);
};

export interface MonthSheetLabels {
  summary: string; farms: string;
  date: string; site: string; farm: string;
  farmsUse: string; genUse: string; total: string; reportUse: string; balance: string;
  previous: string; inbound: string; consumption: string;
}

type Cell = string | number | null;

/** أوراق ملف الشهر: ملخص يومي لكل موقع، وتفاصيل المزارع من الكشوف اليومية */
export const monthSheets = (records: SiteFarmsRecord[], ym: string, L: MonthSheetLabels): { name: string; rows: Cell[][] }[] => {
  const summary: Cell[][] = [[L.date, L.site, L.farmsUse, L.genUse, L.total, L.reportUse, L.balance]];
  const farms: Cell[][] = [[L.date, L.site, L.farm, L.previous, L.inbound, L.consumption, L.balance]];
  for (const site of FARM_SITES) {
    for (const r of monthRows(records, site, ym)) {
      summary.push([r.date, site, r.f, r.g, r.total, r.consumption, r.balance]);
      if (!r.farms) continue;
      for (const row of farmsOn(records, site, r.date)) farms.push([r.date, site, row.name, row.previous, row.inbound, row.consumption, row.balance]);
    }
  }
  return [{ name: L.summary, rows: summary }, { name: L.farms, rows: farms }];
};
