import { beforeEach, describe, expect, it } from 'vitest';
import { readSiteFarms, saveFarmsDay } from '../siteFarms';
import { siteCover, siteGeometry, statusOf } from '../siteFarmsMap';

describe('مزارع الموقع: أيام التغطية', () => {
  beforeEach(() => localStorage.clear());

  it('الحالة من الرصيد التراكمي: 25,000 فأقل حرجة، حتى 50,000 تحذير، وفوقها آمنة', () => {
    expect(statusOf(0)).toBe('crit');
    expect(statusOf(25000)).toBe('crit');
    expect(statusOf(25001)).toBe('warn');
    expect(statusOf(50000)).toBe('warn');
    expect(statusOf(51000)).toBe('ok');
  });

  it('المعدل = متوسط مصروف المزرعة في الكشوف، والرصيد والتوصية من آخر كشف، وخزان المحطة ليس مزرعة', () => {
    saveFarmsDay('التسمين', '2026/10/10', [
      { name: 'محطة التسمين', previous: 1, inbound: 0, consumption: 0, balance: 1000 },
      { name: 'تسمين مزرعة 1', previous: 12000, inbound: 0, consumption: 1000, balance: 11000 },
    ]);
    saveFarmsDay('التسمين', '2026/10/11', [
      { name: 'محطة التسمين', previous: 1000, inbound: 0, consumption: 0, balance: 900 },
      { name: 'تسمين مزرعة 1', previous: 11000, inbound: 0, consumption: 3000, balance: 4000 },
      { name: 'تسمين مزرعة 2', previous: 0, inbound: 0, consumption: 0, balance: 0 },
    ]);
    const c = siteCover(readSiteFarms(), 'التسمين');
    expect(c.date).toBe('2026/10/11');
    expect(c.reports).toBe(2);
    expect(c.station?.balance).toBe(900);
    expect(c.farms.map(f => f.label)).toEqual(['1', '2']);
    const f1 = c.farms[0];
    expect(f1.rate).toBe(2000);
    expect(f1.days).toBe(2);
    expect(f1.status).toBe('crit');
    expect(f1.need).toBe(47000); // حتى 51,000
    expect(c.farms[1].status).toBe('crit');
  });

  it('موقع بلا كشوف: لا مزارع', () => {
    expect(siteCover(readSiteFarms(), 'البوادي')).toEqual({ date: null, reports: 0, farms: [], station: null });
  });
});

describe('مزارع الموقع: هندسة الخريطة', () => {
  it('منطقة لكل مزرعة داخل حدود الموقع، والشكل ثابت لنفس الموقع', () => {
    for (const n of [2, 7, 17, 39, 59]) {
      const g = siteGeometry(n, 'التسمين');
      expect(g.cells).toHaveLength(n);
      expect(g.cells.every(c => c.poly.length >= 3)).toBe(true);
    }
    expect(siteGeometry(10, 'البياض')).toEqual(siteGeometry(10, 'البياض'));
    expect(siteGeometry(0, 'الطاقة').cells).toEqual([]);
  });
});
