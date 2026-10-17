import { beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { annualFor, annualYears, farmsDates, farmsOn, importAnnual, importFarmsDay, lastDayUse, mergeAnnualDays, readSiteFarms, saveAnnual, saveFarmsDay } from '../siteFarms';
import { archiveMonths, closedMonths, monthReport, monthRows } from '../siteFarmsArchive';
import { buildMonthWorkbook, type MonthExportLabels } from '../siteFarmsExport';
import ExcelJS from 'exceljs';
import { detectKind } from '../bulkUpload';
import { readAnnualFarmsFile, readDailyFarmsFile } from '../siteFarmsFile';

const toFile = (rows: unknown[][], name: string) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'S');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer;
  const file = new File([buf], name);
  // jsdom: File بلا arrayBuffer
  if (!file.arrayBuffer) Object.defineProperty(file, 'arrayBuffer', { value: async () => buf });
  return file;
};

describe('صفحة مزارع الموقع: التخزين', () => {
  beforeEach(() => localStorage.clear());

  it('يحفظ لقطات الأيام داخل سجل الشهر ويقرؤها بالتاريخ', () => {
    saveFarmsDay('التسمين', '2026/10/11', [
      { name: 'تسمين مزرعة 1', previous: 48108, inbound: 0, consumption: 100, balance: 48008 },
    ]);
    saveFarmsDay('التسمين', '2026/10/12', [
      { name: 'تسمين مزرعة 1', previous: 48008, inbound: 0, consumption: 50, balance: 47958 },
      { name: 'تسمين مزرعة 2', previous: 10, inbound: 0, consumption: 0, balance: 10 },
    ]);
    expect(readSiteFarms()).toHaveLength(1);
    expect(farmsDates(readSiteFarms(), 'التسمين')).toEqual(['2026/10/11', '2026/10/12']);
    expect(farmsOn(readSiteFarms(), 'التسمين', '2026/10/11')).toEqual([
      { name: 'تسمين مزرعة 1', previous: 48108, inbound: 0, consumption: 100, balance: 48008 },
    ]);
    expect(farmsOn(readSiteFarms(), 'التسمين', '2026/10/12')[1].balance).toBe(10);
    expect(farmsOn(readSiteFarms(), 'البوادي', '2026/10/12')).toEqual([]);
  });

  it('يستبدل سنة موقع عند إعادة الرفع', () => {
    saveAnnual('التسمين', 2025, [1, 2], [0, 1]);
    saveAnnual('التسمين', 2025, [5], [5]);
    expect(annualYears(readSiteFarms(), 'التسمين')).toEqual([2025]);
    expect(annualFor(readSiteFarms(), 'التسمين', 2025)?.f).toEqual([5]);
  });
});

describe('صفحة مزارع الموقع: قراءة الملفات', () => {
  it('الملف السنوي: تواريخ نصية، و"-" للأيام القادمة، وملف النقل بالآليات فقط', async () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const rows: unknown[][] = [
      [2026], ['التاريخ', null, ...dates],
      ['محطة النقل', 'مصروف الاليات', ...dates.map((_, i) => (i < 2 ? 500 + i : '-'))],
      ['المجموع', null, ...dates.map(() => '-')],
    ];
    const r = await readAnnualFarmsFile(toFile(rows, 'n.xlsx'));
    expect(r.site).toBe('الطاقة');
    const start = (Date.UTC(2026, 8, 1) - Date.UTC(2026, 0, 1)) / 864e5;
    expect(r.years[0].g.slice(start)).toEqual([500, 501]);
    expect(r.years[0].f.every(v => v === 0)).toBe(true);
  });

  it('الملف السنوي: الموقع والسنة ومصروف المزارع والمولدات (مع حذف الأيام المستقبلية)', async () => {
    const d = (m: number, day: number) => new Date(Date.UTC(2026, m - 1, day, 0, 0, 0));
    const dates = Array.from({ length: 30 }, (_, i) => d(1, i + 1));
    const rows: unknown[][] = [
      [], [2026],
      ['التاريخ', null, ...dates],
      ['التقرير السنوي', 'مصروف المزارع', ...dates.map((_, i) => (i < 3 ? 100 + i : 0))],
      ['محطة مشروع التسمين', 'مصروف المولدات + الاليات', ...dates.map((_, i) => (i < 3 ? 10 : 0))],
      ['المجموع', null, ...dates.map(() => 0)],
    ];
    const r = await readAnnualFarmsFile(toFile(rows, 'a.xlsx'));
    expect(r.site).toBe('التسمين');
    expect(r.years).toHaveLength(1);
    expect(r.years[0].year).toBe(2026);
    expect(r.years[0].f).toEqual([100, 101, 102]);
    expect(r.years[0].g).toEqual([10, 10, 10]);
  });

  it('الملف السنوي: "محطة النقل" = الطاقة، وبلا اسم موقع يُؤخذ من اسم الملف، وإلا فلا موقع', async () => {
    const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2025, 0, i + 1)));
    const rows = (label: string): unknown[][] => [
      [2025], ['التاريخ', null, ...dates],
      [label, 'مصروف المزارع', ...dates.map(() => 50)],
      ['', 'مصروف المولدات', ...dates.map(() => 5)],
    ];
    expect((await readAnnualFarmsFile(toFile(rows('محطة النقل'), 'a.xlsx'))).site).toBe('الطاقة');
    expect((await readAnnualFarmsFile(toFile(rows('التقرير السنوي'), 'المصروف السنوي البوادي.xlsx'))).site).toBe('البوادي');
    expect((await readAnnualFarmsFile(toFile(rows('التقرير السنوي'), 'annual.xlsx'))).site).toBeNull();
  });

  it('الكشف اليومي: مزارع كل موقع بأعمدة الرصيد السابق والوارد والمصروف والتراكمي', async () => {
    const rows: unknown[][] = [
      ['التاريخ', '2026/10/11'],
      ['موقع الخزان', 'الرصيد السابق', 'الوارد', 'المصروف اليومي', 'الرصيد التراكمي'],
      ['محطة التسمين', 238588, 72933, 66126, 245395],
      ['تسمين مزرعة 1', 48108, 0, 100, 48008],
      ['معمل الاسفلت', 23216, 0, 0, 23216],
    ];
    const r = await readDailyFarmsFile(toFile(rows, 'd.xlsx'));
    expect(r.date).toBe('2026/10/11');
    expect(Object.keys(r.sites)).toEqual(['التسمين']);
    expect(r.sites['التسمين']).toEqual([
      { name: 'محطة التسمين', previous: 238588, inbound: 72933, consumption: 66126, balance: 245395 },
      { name: 'تسمين مزرعة 1', previous: 48108, inbound: 0, consumption: 100, balance: 48008 },
    ]);
  });
});

describe('مزارع الموقع: تحديث الملف السنوي اليومي والمكرر', () => {
  beforeEach(() => localStorage.clear());

  it('الدمج: الأيام الجديدة تُضاف وقيم الملف هي الأحدث، وأيام بعد نهاية الملف تبقى', () => {
    expect(mergeAnnualDays(null, [1, 2], [0, 1])).toEqual({ f: [1, 2], g: [0, 1], added: 2, changed: 0 });
    expect(mergeAnnualDays({ f: [1, 2], g: [0, 1] }, [1, 5, 7], [0, 1, 2])).toEqual({ f: [1, 5, 7], g: [0, 1, 2], added: 1, changed: 1 });
    expect(mergeAnnualDays({ f: [1, 2, 3], g: [0, 0, 0] }, [1], [0])).toEqual({ f: [1, 2, 3], g: [0, 0, 0], added: 0, changed: 0 });
  });

  it('إعادة رفع الملف يحدّث السنة، والملف نفسه مرة ثانية مكرر (لا يُحفظ شيء)', () => {
    expect(importAnnual('التسمين', [{ year: 2026, f: [10, 20], g: [1, 2] }])).toEqual([{ year: 2026, added: 2, changed: 0 }]);
    expect(importAnnual('التسمين', [{ year: 2026, f: [10, 25, 30], g: [1, 2, 3] }])).toEqual([{ year: 2026, added: 1, changed: 1 }]);
    expect(annualFor(readSiteFarms(), 'التسمين', 2026)?.f).toEqual([10, 25, 30]);
    const before = localStorage.getItem('sahara_site_farms_v1');
    expect(importAnnual('التسمين', [{ year: 2026, f: [10, 25, 30], g: [1, 2, 3] }])).toEqual([]);
    expect(localStorage.getItem('sahara_site_farms_v1')).toBe(before);
  });

  it('مزارع كشف الرصيد: تُحفظ، والكشف نفسه مرة ثانية مكرر، وتغيّر رقم يحدّث الموقع فقط', () => {
    const sites = {
      'التسمين': [{ name: 'تسمين مزرعة 1', previous: 100, inbound: 0, consumption: 10, balance: 90 }],
      'البوادي': [{ name: 'بوادي مزرعة 1', previous: 50, inbound: 0, consumption: 5, balance: 45 }],
    };
    expect(importFarmsDay('2026/10/12', sites)).toEqual(['التسمين', 'البوادي']);
    expect(importFarmsDay('2026/10/12', sites)).toEqual([]);
    expect(importFarmsDay('2026/10/12', { ...sites, 'البوادي': [{ ...sites['البوادي'][0], consumption: 6, balance: 44 }] })).toEqual(['البوادي']);
  });

  it('بطاقة الموقع: استهلاك آخر يوم من الملف السنوي، وإلا من مزارع آخر كشف (بلا خزان المحطة)', () => {
    saveFarmsDay('البوادي', '2026/10/12', [
      { name: 'محطة البوادي', previous: 1000, inbound: 0, consumption: 300, balance: 700 },
      { name: 'بوادي مزرعة 1', previous: 50, inbound: 0, consumption: 20, balance: 30 },
    ]);
    expect(lastDayUse(readSiteFarms(), 'البوادي')).toEqual({ date: '2026/10/12', total: 20, f: 20, g: 0, source: 'daily' });
    saveAnnual('البوادي', 2026, [5, 7, 9], [1, 1, 2]);
    expect(lastDayUse(readSiteFarms(), 'البوادي')).toEqual({ date: '2026/01/03', total: 11, f: 9, g: 2, source: 'annual' });
    expect(lastDayUse(readSiteFarms(), 'الطاقة')).toBeNull();
  });
});

describe('أرشيف مزارع الموقع: الجدول والملفات الشهرية', () => {
  beforeEach(() => localStorage.clear());
  const L: MonthExportLabels = {
    title: 'T', company: 'C', month: 'M', exportedAt: 'E', summarySheet: 'S', farmsSheet: 'F',
    site: 's', days: 'n', farmsUse: 'fu', genUse: 'gu', total: 't', avg: 'a', peak: 'pk', reportUse: 'ru', balance: 'b',
    date: 'd', weekday: 'w', farm: 'fm', previous: 'p', inbound: 'i', consumption: 'c',
    totalRow: 'TOT', avgRow: 'AVG', peakNote: 'PN', weekdays: ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'],
  };

  it('أيام الشهر من الملف السنوي ومن الكشف، وملخص الشهر وملف Excel المنسّق', async () => {
    // 40 يومًا: كانون الثاني كاملًا و9 أيام من شباط
    saveAnnual('التسمين', 2026, Array.from({ length: 40 }, () => 100), Array.from({ length: 40 }, () => 10));
    saveFarmsDay('التسمين', '2026/02/09', [
      { name: 'محطة التسمين', previous: 1, inbound: 0, consumption: 999, balance: 1 },
      { name: 'تسمين مزرعة 1', previous: 500, inbound: 0, consumption: 60, balance: 440 },
    ]);
    const recs = readSiteFarms();
    expect(archiveMonths(recs)).toEqual(['2026-02', '2026-01']);
    const feb = monthRows(recs, 'التسمين', '2026-02');
    expect(feb).toHaveLength(9);
    expect(feb[8]).toEqual({ date: '2026/02/09', f: 100, g: 10, total: 110, consumption: 60, balance: 440, farms: 1 });
    expect(feb[0].consumption).toBeNull();
    expect(monthRows(recs, 'التسمين', '2026-01')).toHaveLength(31);
    expect(closedMonths(recs, new Date(2026, 1, 15))).toEqual(['2026-01']);
    expect(closedMonths(recs, new Date(2026, 2, 1))).toEqual(['2026-02', '2026-01']);
    // ملخص الشهر: مجاميع الملف السنوي، ومصروف المزارع من الكشف (بلا خزان المحطة)
    const [tas] = monthReport(recs, '2026-02');
    expect(tas).toMatchObject({ site: 'التسمين', f: 900, g: 90, total: 990, report: 60, lastBalance: 440, avg: 110, hasReport: true });
    expect(monthReport(recs, '2026-02', 'البوادي')).toEqual([]);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildMonthWorkbook(recs, '2026-02', L));
    expect(wb.worksheets.map(w => w.name)).toEqual(['S', 'التسمين', 'F']);
    const sum = wb.getWorksheet('S')!;
    expect(sum.getCell('A1').value).toBe('T — M');
    expect(sum.getRow(5).values).toEqual([undefined, 'التسمين', 9, 900, 90, 990, 110, '02/01  (110)', 60, 440]);
    expect(sum.getCell('A6').value).toBe('TOT');
    const site = wb.getWorksheet('التسمين')!;
    expect(site.getRow(13).values).toEqual([undefined, '2026/02/09', 'mo', 100, 10, 110, 60, 440]);
    expect(site.getCell('A14').value).toBe('TOT');
    expect(site.getCell('E14').value).toBe(990);
    expect(site.getCell('E15').value).toBe(110);
    expect(site.getCell('E14').numFmt).toBe('#,##0');
    const farms = wb.getWorksheet('F')!;
    expect(farms.getCell('A4').value).toBe('التسمين');
    expect(farms.getRow(7).values).toEqual([undefined, '2026/02/09', 'تسمين مزرعة 1', 500, 0, 60, 440]);
  });

  it('الرفع المتعدد يميّز الملف السنوي عن كشف الرصيد', () => {
    expect(detectKind('2026 التقرير السنوي مصروف المزارع محطة مشروع التسمين مصروف المولدات + الاليات').kind).toBe('site-annual');
    expect(detectKind('المدور السابق المصروف اليومي للمزارع المصروف اليومي للمولدات موقع الخزان الرصيد التراكمي').kind).toBe('balance');
    expect(detectKind('2026 التاريخ محطة النقل مصروف الاليات المجموع').kind).toBe('site-annual');
  });
});
