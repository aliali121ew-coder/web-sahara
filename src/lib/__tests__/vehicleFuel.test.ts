import { describe, expect, it } from 'vitest';
import { parseVehicleSheet, splitSheets } from '../vehicleFuel';
import type { PdfItem } from '../saharaReportFile';

const item = (str: string, x: number): PdfItem => ({ str, x, y: 0, w: 10 });
const siteLine = (site: string) => [item('المصنع', 500), item(site, 400)];
const header = [item('الكمية', 300), item('العربة', 200), item('التاريخ', 100)];
const row = (vehicle: string, qty: string, date: string) => [item(qty, 300), item(vehicle, 200), item(date, 100)];

describe('splitSheets', () => {
  it('يبدأ كشفًا جديدًا عند كل صفحة فيها عنوان المصنع، وما بعدها تتمة له', () => {
    const pages = [
      [siteLine('سما كربلاء'), header, row('KH1', '50', '2026/10/31')],
      [header, row('KH2', '30', '2026/10/31')],
      [siteLine('الاسمدة العضوية'), header, row('L9', '70', '2026/10/30')],
    ];
    const sheets = splitSheets(pages).map(p => parseVehicleSheet(p));
    expect(sheets.map(s => [s.site, s.rows.length, s.rows[0].date])).toEqual([
      ['سما كربلاء', 2, '2026/10/31'],
      ['الاسمدة العضوية', 1, '2026/10/30'],
    ]);
  });

  it('تاريخ ملاحظات مستند لا يمتد إلى الكشوف الأخرى في الملف المدموج', () => {
    const doc = [siteLine('سما كربلاء'), [item('الملاحظات', 500), item('27/10/2026', 400)], header, row('KH3', '20', '')];
    const pages = [[siteLine('سما الريف'), header, row('AT3', '75', '2026/10/30')], doc];
    const sheets = splitSheets(pages).map(p => parseVehicleSheet(p));
    expect(sheets.map(s => s.rows[0].date)).toEqual(['2026/10/30', '2026/10/27']);
  });
});
