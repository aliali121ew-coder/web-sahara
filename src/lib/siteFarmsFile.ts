import i18n from '../i18n';
import { findReportDate } from './reportDate';
import { matchStation, normalizeArabic, pdfLineText, pdfNumbersIn, readPdfPages, siteGroupOf } from './saharaReportFile';
import { FARM_SITES, type FarmRow } from './siteFarmsTypes';

/**
 * قراءة ملفات صفحة "مزارع الموقع" داخل المتصفح (بدون خادم ولا ذكاء اصطناعي):
 * - الكشف اليومي للصحاري: جدول "تفاصيل الكميات في الموقع" (الرصيد السابق، الوارد، المصروف اليومي، الرصيد التراكمي) لكل مزرعة
 * - الملف السنوي لموقع: مصروف المزارع ومصروف المولدات والآليات لكل يوم من السنة
 */

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const t = v.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,،٬\s]/g, '').replace(/٫/g, '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

const has = (text: unknown, label: string) => typeof text === 'string' && normalizeArabic(text).includes(normalizeArabic(label));

const SITE_LIST = [...FARM_SITES] as string[];

/** الموقع الذي ينتمي إليه صف من الكشف (محطة الموقع نفسها أو إحدى مزارعه) */
const siteOfRow = (name: string): string | null => matchStation(name, SITE_LIST) ?? siteGroupOf(name, SITE_LIST);

export interface DailyFarmsResult {
  /** YYYY/MM/DD إن وُجد في الملف */
  date: string | null;
  sites: Record<string, FarmRow[]>;
}

/** تشوّهات معروفة في أسماء PDF (حروف مكررة أو مقطّعة) */
const cleanName = (n: string) => n
  .replace(/مزرعه/g, 'مزرعة').replace(/االول/g, 'الاول').replace(/الثانين/g, 'الثاني')
  .replace(/االمهات/g, 'الامهات').replace(/االجداد/g, 'الاجداد').replace(/الترر? ?بية|الت بية/g, 'التربية');

const pushRow = (out: Record<string, FarmRow[]>, input: FarmRow) => {
  const row = { ...input, name: cleanName(input.name) };
  const site = siteOfRow(row.name);
  if (!site) return;
  const list = (out[site] ??= []);
  // اسم مكرر (رقم المزرعة لم يُقرأ): يُرقَّم حتى لا تُدمج مزرعتان
  let name = row.name, k = 2;
  while (list.some(r => r.name === name)) name = `${row.name} (${k++})`;
  list.push({ ...row, name });
};

const readDailyPdf = async (file: File): Promise<DailyFarmsResult> => {
  const { pages, anyText } = await readPdfPages(file);
  if (!anyText) throw new Error(i18n.t('common:fileImport.scannedPdf'));
  const sites: Record<string, FarmRow[]> = {};
  let found = false;
  for (const lines of pages) {
    const headerIdx = lines.findIndex(l => has(pdfLineText(l), 'موقع الخزان'));
    if (headerIdx < 0) continue;
    found = true;
    // أعمدة الأرقام تُستنتج من الصفوف نفسها (عناوين PDF قد تخرج مدموجة): آخر 4 أرقام في الصف = السابق، الوارد، المصروف، التراكمي
    // من اليمين لليسار، وما زاد على يمينها رقم المزرعة. الصف الناقص خلية يُوزَّع بأقرب عمود
    const body = lines.slice(headerIdx + 1).map(l => ({ l, nums: [...pdfNumbersIn(l)].sort((a, b) => b.cx - a.cx) })).filter(r => r.nums.length);
    const full = body.filter(r => r.nums.length >= 4).map(r => r.nums.slice(-4).map(n => n.cx));
    const median = (arr: number[]) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
    const centers = full.length ? [0, 1, 2, 3].map(k => median(full.map(r => r[k]))) : null;
    for (const { l, nums } of body) {
      const values: (number | null)[] = [null, null, null, null];
      const nameNums: number[] = [];
      if (nums.length >= 4 || !centers) {
        nums.slice(0, Math.max(0, nums.length - 4)).forEach(n => nameNums.push(n.n));
        nums.slice(-4).forEach((n, k) => { values[k] = n.n; });
      } else {
        for (const n of nums) {
          let best = 0;
          centers.forEach((c, k) => { if (Math.abs(c - n.cx) < Math.abs(centers[best] - n.cx)) best = k; });
          if (values[best] === null) values[best] = n.n;
        }
      }
      const words = l.filter(it => toNumber(it.str) === null).sort((a, b) => b.x - a.x).map(it => it.str);
      const name = [...words, ...nameNums.map(String)].join(' ').replace(/\s+/g, ' ').trim();
      if (!name || /مجموع|اجمالي|إجمالي/.test(name)) continue;
      pushRow(sites, { name, previous: values[0], inbound: values[1], consumption: values[2], balance: values[3] });
    }
  }
  if (!found) throw new Error(i18n.t('finance:siteFarms.noTable'));
  const date = findReportDate(pages.flatMap(lines => lines.map(l => [pdfLineText(l), ...l.map(i => i.str)])));
  return { date, sites };
};

const readDailyExcel = async (file: File): Promise<DailyFarmsResult> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sites: Record<string, FarmRow[]> = {};
  const allRows: unknown[][] = [];
  let found = false;
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
    allRows.push(...rows);
    let c: { name: number; prev: number; inb: number; cons: number; cum: number } | null = null;
    for (const row of rows) {
      const nameCol = row.findIndex(x => has(x, 'موقع الخزان'));
      if (nameCol >= 0) {
        const at = (label: string) => row.findIndex(x => has(x, label));
        c = { name: nameCol, prev: at('السابق'), inb: at('الوارد'), cons: at('اليومي'), cum: at('التراكمي') };
        found = true;
        continue;
      }
      if (!c) continue;
      const name = typeof row[c.name] === 'string' ? (row[c.name] as string).trim() : '';
      if (!name || /مجموع|اجمالي|إجمالي/.test(name)) continue;
      const at = (i: number) => (i >= 0 ? toNumber(row[i]) : null);
      pushRow(sites, { name, previous: at(c.prev), inbound: at(c.inb), consumption: at(c.cons), balance: at(c.cum) });
    }
  }
  if (!found) throw new Error(i18n.t('finance:siteFarms.noTable'));
  return { date: findReportDate(allRows), sites };
};

export const readDailyFarmsFile = (file: File): Promise<DailyFarmsResult> =>
  /\.pdf$/i.test(file.name) ? readDailyPdf(file) : readDailyExcel(file);

export interface AnnualYearData {
  year: number;
  f: number[];
  g: number[];
}
export interface AnnualFileResult {
  /** الموقع المستنتج من خلية "محطة ..." (null إن لم يُعرف) */
  site: string | null;
  years: AnnualYearData[];
}

const dayIndex = (d: Date, year: number) => {
  // +12 ساعة: يتفادى انزياح المنطقة الزمنية لخلايا التاريخ
  const t = new Date(d.getTime() + 12 * 3600e3);
  return Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(year, 0, 1)) / 864e5);
};

export const readAnnualFarmsFile = async (file: File): Promise<AnnualFileResult> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const years = new Map<number, AnnualYearData>();
  let site: string | null = null;

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
    // أطول اسم أولًا حتى لا يُلتقط "البياض" من "امهات البياض"
    const bySpecific = [...FARM_SITES].sort((a, b) => b.length - a.length);
    if (!site) {
      for (const row of rows) {
        const cell = row.slice(0, 2).find(x => typeof x === 'string' && has(x, 'محطة'));
        if (typeof cell === 'string') {
          const hit = bySpecific.find(s => has(cell, s));
          if (hit) { site = hit; break; }
        }
      }
    }
    let year: number | null = null;
    let dates: { col: number; d: Date }[] = [];
    for (const row of rows) {
      const filled = row.filter(x => x !== null && x !== '');
      if (filled.length === 1 && typeof filled[0] === 'number' && filled[0] >= 2000 && filled[0] <= 2100) {
        year = filled[0]; dates = [];
        continue;
      }
      if (year === null) continue;
      const dateCells = row.map((x, col) => ({ col, d: x as unknown })).filter((x): x is { col: number; d: Date } => x.d instanceof Date && !isNaN(x.d.getTime()));
      if (dateCells.length >= 28) { dates = dateCells.filter(x => x.d.getFullYear() === year || new Date(x.d.getTime() + 12 * 3600e3).getUTCFullYear() === year); continue; }
      if (!dates.length) continue;
      const label = `${row[0] ?? ''} ${row[1] ?? ''}`;
      const isFarms = has(label, 'مصروف') && has(label, 'المزارع');
      const isGen = has(label, 'مصروف') && (has(label, 'المولدات') || has(label, 'الاليات'));
      if (!isFarms && !isGen) continue;
      const rec = years.get(year) ?? { year, f: Array(366).fill(0), g: Array(366).fill(0) };
      for (const { col, d } of dates) {
        const n = toNumber(row[col]);
        const idx = dayIndex(d, year);
        if (n === null || idx < 0 || idx > 365) continue;
        if (isFarms) rec.f[idx] = n; else rec.g[idx] = n;
      }
      years.set(year, rec);
    }
  }

  const out: AnnualYearData[] = [];
  for (const rec of years.values()) {
    // الأيام المستقبلية (أصفار في آخر السنة) لا تُحفظ
    let n = rec.f.length;
    while (n > 0 && !rec.f[n - 1] && !rec.g[n - 1]) n--;
    if (n === 0) continue;
    out.push({ year: rec.year, f: rec.f.slice(0, n), g: rec.g.slice(0, n) });
  }
  if (!out.length) throw new Error(i18n.t('finance:siteFarms.noAnnual'));
  return { site, years: out.sort((a, b) => a.year - b.year) };
};
