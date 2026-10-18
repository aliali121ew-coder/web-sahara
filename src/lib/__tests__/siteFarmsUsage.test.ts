import { beforeEach, describe, expect, it } from 'vitest';
import { readSiteFarms, saveFarmsDay } from '../siteFarms';
import { farmSeries, farmSummary, usageMonth, usageMonths } from '../siteFarmsUsage';

describe('استهلاك المزارع من الكشوف اليومية', () => {
  beforeEach(() => {
    localStorage.clear();
    saveFarmsDay('التسمين', '2026/09/30', [
      { name: 'تسمين مزرعة 1', previous: 600, inbound: 0, consumption: 100, balance: 500 },
    ]);
    saveFarmsDay('التسمين', '2026/10/13', [
      { name: 'محطة التسمين', previous: 1, inbound: 0, consumption: 999, balance: 1 },
      { name: 'تسمين مزرعة 1', previous: 500, inbound: 0, consumption: 200, balance: 300 },
      { name: 'تسمين مزرعة 2', previous: 90, inbound: 0, consumption: 40, balance: 50 },
    ]);
    saveFarmsDay('التسمين', '2026/10/14', [
      { name: 'محطة التسمين', previous: 1, inbound: 0, consumption: 888, balance: 1 },
      { name: 'تسمين مزرعة 1', previous: 300, inbound: 1000, consumption: 150, balance: 1150 },
    ]);
  });

  it('الأشهر الأحدث أولًا، وجدول الشهر مزرعة × يوم بلا خزان المحطة', () => {
    const recs = readSiteFarms();
    expect(usageMonths(recs, 'التسمين')).toEqual(['2026-10', '2026-09']);
    const m = usageMonth(recs, 'التسمين', '2026-10');
    expect(m.dates).toEqual(['2026/10/13', '2026/10/14']);
    expect(m.farms).toEqual([
      { name: 'تسمين مزرعة 1', days: [200, 150], total: 350 },
      { name: 'تسمين مزرعة 2', days: [40, null], total: 40 },
    ]);
    expect(m.dayTotals).toEqual([240, 150]);
    expect(m.total).toBe(390);
  });

  it('أيام مزرعة واحدة عبر الأشهر وملخصها', () => {
    const days = farmSeries(readSiteFarms(), 'التسمين', 'تسمين مزرعة 1');
    expect(days.map(d => [d.date, d.consumption])).toEqual([['2026/09/30', 100], ['2026/10/13', 200], ['2026/10/14', 150]]);
    expect(farmSummary(days)).toMatchObject({ total: 450, avg: 150, lastBalance: 1150, days: 3 });
    expect(farmSummary(days).peak?.date).toBe('2026/10/13');
  });
});
