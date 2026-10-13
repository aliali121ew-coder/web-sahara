import { beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { annualFor, annualYears, farmsDates, farmsOn, readSiteFarms, saveAnnual, saveFarmsDay } from '../siteFarms';
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
