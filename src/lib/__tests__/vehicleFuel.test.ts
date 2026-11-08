import { describe, expect, it } from 'vitest';
import { capConsumption, consumptionBySite, consumptionTrend, dropStoredRows, fileDayStart, fillConsumption, parseVehicleSheet, sheetTanks, splitSheets, withTanks, type DayFill, type VehicleRefill } from '../vehicleFuel';
import type { PdfItem } from '../saharaReportFile';

const fill = (date: string, qty: number, over: Partial<DayFill> = {}): DayFill => ({
  vehicle: 'SF1', date, qty, parts: 1, sites: ['سما كربلاء'], drivers: [], days: null, prevQty: null, prevDate: '', prevSite: '', prevDriver: '', ...over,
});
const refill = (date: string, qty: number, site: string): VehicleRefill => ({
  id: `${date}-${site}`, fileId: 'f', site, vehicle: 'SF1', driver: '', qty, date, days: null, prevSite: '', prevDriver: '', prevQty: null, prevDate: '', kind: '',
});

describe('fillConsumption', () => {
  it('250 ثم 200: صُرف 200 وبقي 50، وأول تفويلة بلا سابقة لا استهلاك لها', () => {
    const [first, second] = fillConsumption([fill('2026/10/30', 200), fill('2026/10/28', 250)]);
    expect(first).toMatchObject({ date: '2026/10/28', consumed: null, remaining: null });
    expect(second).toMatchObject({ date: '2026/10/30', consumed: 200, prevDate: '2026/10/28', prevQty: 250, remaining: 50 });
  });

  it('تفويلة أكبر من السابقة: تُحسب كلها مصروفًا ولا يوجد متبقٍ سالب', () => {
    const [, second] = fillConsumption([fill('2026/10/27', 200), fill('2026/11/01', 300)]);
    expect(second).toMatchObject({ consumed: 300, remaining: null });
  });

  it('تفويلة واحدة يسجّل كشفها سابقة: تُحسب من الكشف', () => {
    const [only] = fillConsumption([fill('2026/11/01', 28, { days: 2, prevDate: '2026/10/30', prevQty: 40, prevSite: 'سما الريف' })]);
    expect(only).toMatchObject({ consumed: 28, prevDate: '2026/10/30', prevSite: 'سما الريف', remaining: 12 });
  });

  it('تفويلة واحدة بعدد أيام فقط: السابقة معروفة بتاريخها وكميتها مجهولة', () => {
    const [only] = fillConsumption([fill('2026/11/01', 28, { days: 2 })]);
    expect(only).toMatchObject({ consumed: 28, prevDate: '2026/10/30', prevQty: null, remaining: null });
  });

  it('تفويلة واحدة بلا أي سابقة: لا يوجد استهلاك', () => {
    expect(fillConsumption([fill('2026/11/01', 28)])[0].consumed).toBeNull();
  });

  it('الكشف الأحدث من البيانات يتقدّم عليها (كشف لم يُرفع)، والأقدم منها يُهمل', () => {
    const list = fillConsumption([
      fill('2026/10/20', 100),
      fill('2026/10/30', 80, { prevDate: '2026/10/25', prevQty: 90 }),
      fill('2026/11/01', 60, { prevDate: '2026/10/20', prevQty: 100 }),
    ]);
    expect(list[1]).toMatchObject({ prevDate: '2026/10/25', prevQty: 90, remaining: 10 });
    expect(list[2]).toMatchObject({ prevDate: '2026/10/30', prevQty: 80, remaining: 20 });
  });

  it('تاريخ سابق مساوٍ ليوم التفويلة (عدة تفويلات في اليوم) لا يُعد سابقة', () => {
    expect(fillConsumption([fill('2026/11/01', 50, { days: 0, parts: 2, prevDate: '2026/11/01', prevQty: null })])[0].consumed).toBeNull();
  });
});

describe('capConsumption', () => {
  const list = fillConsumption([fill('2026/10/30', 40, { days: 2 }), fill('2026/11/01', 68)]);

  it('يقص التفويلة عند السعة والمتبقي من السعة', () => {
    expect(capConsumption(list, 50).map(c => [c.consumed, c.remaining])).toEqual([[40, 10], [50, 0]]);
  });

  it('بلا سعة مسجلة لا يُحسب استهلاك', () => {
    expect(capConsumption(list, 0).map(c => [c.consumed, c.remaining])).toEqual([[null, null], [null, null]]);
  });

  it('أول تفويلة بلا سابقة تبقى خارج الحساب', () => {
    expect(capConsumption(fillConsumption([fill('2026/11/01', 28)]), 60)[0].consumed).toBeNull();
  });
});

describe('consumptionBySite', () => {
  it('ينسب المصروف لموقع التفويلة التي صُرف منها وبنسب كمياتها', () => {
    const fills = [fill('2026/10/28', 100, { sites: ['أ', 'ب'], parts: 2 }), fill('2026/10/30', 60, { sites: ['ج'] })];
    const refills = [refill('2026/10/28', 75, 'أ'), refill('2026/10/28', 25, 'ب'), refill('2026/10/30', 60, 'ج')];
    expect(consumptionBySite(fillConsumption(fills), refills)).toEqual([{ name: 'أ', total: 45 }, { name: 'ب', total: 15 }]);
  });

  it('بلا سطور للسابقة يعود لموقع الكشف، وبلا سابقة أصلًا لا شيء', () => {
    expect(consumptionBySite(fillConsumption([fill('2026/11/01', 28, { prevDate: '2026/10/30', prevSite: 'سما الريف' })]), [])).toEqual([{ name: 'سما الريف', total: 28 }]);
    expect(consumptionBySite(fillConsumption([fill('2026/11/01', 28)]), [])).toEqual([]);
  });
});

describe('consumptionTrend', () => {
  it('الخطان يختلفان: الاستهلاك عند التفويلة التي صُرف منها، وآخر تفويلة بلا استهلاك بعد', () => {
    const fills = [fill('2026/10/28', 250), fill('2026/10/30', 200), fill('2026/11/01', 120)];
    const points = consumptionTrend(fills, fillConsumption(fills));
    expect(points.map(p => [p.date, p.qty, p.consumed, p.remaining, p.until])).toEqual([
      ['2026/10/28', 250, 200, 50, '2026/10/30'],
      ['2026/10/30', 200, 120, 80, '2026/11/01'],
      ['2026/11/01', 120, null, null, ''],
    ]);
  });

  it('فترة تبدأ بعد تفويلة سابقة: تظهر نقطة السابقة حتى يطابق الخط الكارت', () => {
    const all = [fill('2026/10/28', 250), fill('2026/10/30', 200)];
    const points = consumptionTrend([all[1]], fillConsumption(all).filter(c => c.date >= '2026/10/30'));
    expect(points.map(p => [p.date, p.qty, p.consumed, p.fill?.date ?? null])).toEqual([
      ['2026/10/28', 250, 200, null],
      ['2026/10/30', 200, null, '2026/10/30'],
    ]);
  });
});

const item = (str: string, x: number): PdfItem => ({ str, x, y: 0, w: 10 });
const siteLine = (site: string) => [item('المصنع', 500), item(site, 400)];
const header = [item('الكمية', 300), item('العربة', 200), item('التاريخ', 100)];
const row = (vehicle: string, qty: string, date: string) => [item(qty, 300), item(vehicle, 200), item(date, 100)];

describe('fileDayStart', () => {
  it('يبدأ يوم الملفات الساعة 7 صباحًا بتوقيت العراق', () => {
    expect(fileDayStart(Date.parse('2026-11-01T08:00:00+03:00'))).toBe(Date.parse('2026-11-01T07:00:00+03:00'));
    expect(fileDayStart(Date.parse('2026-11-01T07:00:00+03:00'))).toBe(Date.parse('2026-11-01T07:00:00+03:00'));
    expect(fileDayStart(Date.parse('2026-11-01T06:59:00+03:00'))).toBe(Date.parse('2026-10-31T07:00:00+03:00'));
    expect(fileDayStart(Date.parse('2026-11-01T02:00:00+03:00'))).toBe(Date.parse('2026-10-31T07:00:00+03:00'));
  });
});

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

describe('dropStoredRows', () => {
  const r = (vehicle: string, date: string, qty: number, site = 'صحارى كربلاء (بيض)') => ({ vehicle, date, qty, site });
  it('skips rows already stored from another sheet and keeps the rest', () => {
    const stored = [r('299', '2026/10/31', 110)];
    const rows = [r('299', '2026/10/27', 250), r('299', '2026/10/31', 110), r('810', '2026/10/31', 126)];
    const { kept, skipped } = dropStoredRows(rows, stored);
    expect(skipped).toBe(1);
    expect(kept.map(x => `${x.vehicle}|${x.date}`)).toEqual(['299|2026/10/27', '810|2026/10/31']);
  });
  it('counts duplicates: two identical new rows and one stored keeps one', () => {
    const { kept, skipped } = dropStoredRows([r('23', '2026/10/31', 100), r('23', '2026/10/31', 100)], [r('23', '2026/10/31', 100)]);
    expect(skipped).toBe(1);
    expect(kept).toHaveLength(1);
  });
  it('does not match another site', () => {
    expect(dropStoredRows([r('23', '2026/10/31', 100)], [r('23', '2026/10/31', 100, 'موقع اخر')]).skipped).toBe(0);
  });
});

describe('category tanks', () => {
  it('every KH (كيا حمل) has a 65 L tank', () => {
    expect(sheetTanks('KH125')).toEqual([65]);
    expect(sheetTanks('kh7')).toEqual([65]);
    expect(withTanks(undefined, 'KH40')).toMatchObject({ tankCount: 1, tankLiters: 65 });
    expect(sheetTanks('BS214')).toEqual([100, 140]);
  });
  it('every HF (حافلة) has a 200 L tank', () => {
    expect(sheetTanks('HF68')).toEqual([200]);
    expect(withTanks(undefined, 'HF12')).toMatchObject({ tankCount: 1, tankLiters: 200 });
  });
});
