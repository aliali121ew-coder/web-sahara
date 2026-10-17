import type { Workbook, Worksheet } from 'exceljs';
import { farmsOn, isTankRow, type SiteFarmsRecord } from './siteFarms';
import { monthReport, type ArchiveDay } from './siteFarmsArchive';

/**
 * ملف Excel الشهري لأرشيف مزارع الموقع بتنسيق احترافي (exceljs):
 * ورقة ملخص للمواقع، وورقة لكل موقع فيها أيامه (مع المجموع والمعدل وأعلى يوم)، وورقة تفاصيل المزارع.
 */

export interface MonthExportLabels {
  title: string;
  company: string;
  month: string;
  exportedAt: string;
  summarySheet: string;
  farmsSheet: string;
  site: string;
  days: string;
  farmsUse: string;
  genUse: string;
  total: string;
  avg: string;
  peak: string;
  reportUse: string;
  balance: string;
  date: string;
  weekday: string;
  farm: string;
  previous: string;
  inbound: string;
  consumption: string;
  totalRow: string;
  avgRow: string;
  peakNote: string;
  weekdays: string[];
}

const C = {
  brand: 'FF0F5E4B',
  brandLight: 'FFE7F5EF',
  head: 'FF1D576A',
  zebra: 'FFF6F8FA',
  border: 'FFD5DCE3',
  total: 'FFDDF1E8',
  peak: 'FFFFF1CC',
  muted: 'FF64748B',
  white: 'FFFFFFFF',
};
const NUM = '#,##0';
const FONT = 'Tahoma';
const thin = { style: 'thin' as const, color: { argb: C.border } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

const sum = (rows: ArchiveDay[], k: 'f' | 'g' | 'consumption') => {
  const v = rows.filter(r => r[k] !== null);
  return v.length ? v.reduce((s, r) => s + (r[k] ?? 0), 0) : null;
};
/** اليوم بالاسم (الأحد…السبت) لتاريخ YYYY/MM/DD */
export const weekdayOf = (date: string, names: string[]) => {
  const [y, m, d] = date.split('/').map(Number);
  return names[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
};

const newSheet = (wb: Workbook, name: string, widths: number[]) => {
  const ws = wb.addWorksheet(name.slice(0, 31), {
    views: [{ rightToLeft: true, showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  ws.columns = widths.map(width => ({ width }));
  return ws;
};

/** شريط العنوان (صفان) فوق الجدول */
const banner = (ws: Worksheet, cols: number, title: string, sub: string) => {
  ws.mergeCells(1, 1, 1, cols);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 15, bold: true, color: { argb: C.white } };
  t.fill = fill(C.brand);
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;
  ws.mergeCells(2, 1, 2, cols);
  const s = ws.getCell(2, 1);
  s.value = sub;
  s.font = { name: FONT, size: 10, color: { argb: C.brand } };
  s.fill = fill(C.brandLight);
  s.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;
};

const header = (ws: Worksheet, rowNo: number, labels: string[]) => {
  const row = ws.getRow(rowNo);
  labels.forEach((l, i) => {
    const c = row.getCell(i + 1);
    c.value = l;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
    c.fill = fill(C.head);
    c.border = box;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row.height = 30;
};

type Val = string | number | null;
const dataRow = (ws: Worksheet, rowNo: number, values: Val[], opts: { zebra?: boolean; bg?: string; bold?: boolean; numFrom?: number } = {}) => {
  const row = ws.getRow(rowNo);
  values.forEach((v, i) => {
    const c = row.getCell(i + 1);
    c.value = v ?? '—';
    const isNum = typeof v === 'number';
    c.numFmt = isNum ? NUM : '@';
    c.font = { name: FONT, size: 10, bold: !!opts.bold, color: v === null ? { argb: C.muted } : undefined };
    c.border = box;
    c.alignment = { horizontal: isNum || v === null ? 'center' : 'right', vertical: 'middle' };
    const bg = opts.bg ?? (opts.zebra ? C.zebra : null);
    if (bg) c.fill = fill(bg);
  });
  row.height = 20;
};

export const buildMonthWorkbook = async (records: SiteFarmsRecord[], ym: string, L: MonthExportLabels, only?: string | null, now = new Date()): Promise<ArrayBuffer> => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = L.company;
  wb.created = now;
  const pad = (n: number) => String(n).padStart(2, '0');
  const sub = `${L.company} — ${L.exportedAt}: ${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
  const sites = monthReport(records, ym, only);

  // ── الملخص: سطر لكل موقع ──
  const sumCols = [L.site, L.days, L.farmsUse, L.genUse, L.total, L.avg, L.peak, L.reportUse, L.balance];
  const ws = newSheet(wb, L.summarySheet, [16, 11, 16, 18, 16, 15, 24, 18, 18]);
  banner(ws, sumCols.length, `${L.title} — ${L.month}`, sub);
  header(ws, 4, sumCols);
  let r = 5;
  const tot = { days: 0, f: 0, g: 0, total: 0, rep: 0, bal: 0, hasRep: false, hasBal: false };
  sites.forEach(({ site, rows, f, g, total, report: rep, lastBalance: lastBal, avg, peak }, i) => {
    dataRow(ws, r++, [
      site, rows.length, f, g, total, avg,
      peak ? `${peak.date.slice(5)}  (${Math.round(peak.total ?? 0).toLocaleString('en-US')})` : null,
      rep, lastBal,
    ], { zebra: i % 2 === 1 });
    ws.getCell(r - 1, 1).font = { name: FONT, size: 10, bold: true, color: { argb: C.head } };
    tot.days += rows.length; tot.f += f ?? 0; tot.g += g ?? 0; tot.total += total ?? 0;
    if (rep !== null) { tot.rep += rep; tot.hasRep = true; }
    if (lastBal !== null) { tot.bal += lastBal; tot.hasBal = true; }
  });
  dataRow(ws, r, [L.totalRow, tot.days, tot.f, tot.g, tot.total, null, null, tot.hasRep ? tot.rep : null, tot.hasBal ? tot.bal : null], { bg: C.total, bold: true });
  ws.views = [{ rightToLeft: true, showGridLines: false, state: 'frozen', ySplit: 4 }];

  // ── ورقة لكل موقع ──
  for (const { site, rows, total: totT, peak, hasReport } of sites) {
    const cols = [L.date, L.weekday, L.farmsUse, L.genUse, L.total, ...(hasReport ? [L.reportUse, L.balance] : [])];
    const s = newSheet(wb, site, [14, 12, 16, 18, 16, ...(hasReport ? [18, 18] : [])]);
    banner(s, cols.length, `${site} — ${L.month}`, sub);
    header(s, 4, cols);
    let n = 5;
    rows.forEach((x, i) => {
      dataRow(s, n++, [x.date, weekdayOf(x.date, L.weekdays), x.f, x.g, x.total, ...(hasReport ? [x.consumption, x.balance] : [])],
        { zebra: i % 2 === 1, bg: x === peak ? C.peak : undefined });
      s.getCell(n - 1, 5).font = { name: FONT, size: 10, bold: true };
    });
    const annualDays = rows.filter(x => x.total !== null).length || 1;
    const reportDays = rows.filter(x => x.consumption !== null).length || 1;
    const totF = sum(rows, 'f'), totG = sum(rows, 'g'), totR = sum(rows, 'consumption');
    dataRow(s, n++, [L.totalRow, '', totF, totG, totT, ...(hasReport ? [totR, null] : [])], { bg: C.total, bold: true });
    const avg = (v: number | null, d: number) => (v === null ? null : Math.round(v / d));
    dataRow(s, n++, [L.avgRow, '', avg(totF, annualDays), avg(totG, annualDays), avg(totT, annualDays), ...(hasReport ? [avg(totR, reportDays), null] : [])], { bg: C.brandLight, bold: true });
    if (peak) {
      s.mergeCells(n + 1, 1, n + 1, cols.length);
      const note = s.getCell(n + 1, 1);
      note.value = `■ ${L.peakNote}: ${peak.date} — ${Math.round(peak.total ?? 0).toLocaleString('en-US')}`;
      note.font = { name: FONT, size: 9, color: { argb: 'FF9A6700' } };
      note.alignment = { horizontal: 'right' };
    }
    s.views = [{ rightToLeft: true, showGridLines: false, state: 'frozen', ySplit: 4 }];
  }

  // ── تفاصيل المزارع من الكشوف اليومية ──
  const farmCols = [L.date, L.farm, L.previous, L.inbound, L.consumption, L.balance];
  const detail = sites.flatMap(({ site, rows }) => rows.filter(x => x.farms).map(x => ({ site, date: x.date })));
  if (detail.length) {
    const fs = newSheet(wb, L.farmsSheet, [14, 30, 16, 14, 16, 18]);
    banner(fs, farmCols.length, `${L.farmsSheet} — ${L.month}`, sub);
    let n = 4;
    for (const { site, rows } of sites) {
      const days = rows.filter(x => x.farms);
      if (!days.length) continue;
      fs.mergeCells(n, 1, n, farmCols.length);
      const sec = fs.getCell(n, 1);
      sec.value = site;
      sec.font = { name: FONT, size: 12, bold: true, color: { argb: C.brand } };
      sec.fill = fill(C.brandLight);
      sec.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
      fs.getRow(n).height = 24;
      header(fs, n + 1, farmCols);
      n += 2;
      let i = 0;
      for (const d of days) {
        for (const row of farmsOn(records, site, d.date)) {
          dataRow(fs, n++, [d.date, row.name, row.previous, row.inbound, row.consumption, row.balance], { zebra: i++ % 2 === 1 });
          if (isTankRow(row.name)) fs.getCell(n - 1, 2).font = { name: FONT, size: 10, italic: true, color: { argb: C.muted } };
        }
      }
      n += 1;
    }
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
};
