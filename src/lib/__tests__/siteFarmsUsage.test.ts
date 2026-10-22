import { beforeEach, describe, expect, it } from 'vitest';
import { readSiteFarms, saveFarmsDay } from '../siteFarms';
import { networkCover, farmDaysBetween, farmSeries, farmSummary, groupFarmDays, siteDayTotals, usageMonth, usageMonths, weekStart, weekUsage } from '../siteFarmsUsage';

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

describe('أيام المزرعة: أسبوعي وشهري وفترة', () => {
  const day = (date: string, consumption: number, balance: number) => ({ date, name: 'م', previous: null, inbound: null, consumption, balance });
  // 2026/10/09 جمعة، 10/10 سبت (بداية أسبوع)، 10/16 جمعة، 10/17 سبت
  const days = [day('2026/09/30', 50, 900), day('2026/10/09', 100, 800), day('2026/10/10', 200, 600), day('2026/10/16', 100, 500), day('2026/10/17', 600, 400)];

  it('بداية الأسبوع السبت', () => {
    expect(weekStart('2026/10/16')).toBe('2026/10/10');
    expect(weekStart('2026/10/17')).toBe('2026/10/17');
    expect(weekStart('2026/10/09')).toBe('2026/10/03');
  });

  it('الأسبوعي: الأحدث أولًا مع المعدل والتغيّر وآخر رصيد', () => {
    const w = groupFarmDays(days, 'week');
    expect(w.map(g => [g.from, g.to, g.days, g.total, g.avg, g.change, g.lastBalance])).toEqual([
      ['2026/10/17', '2026/10/23', 1, 600, 600, 100, 400],
      ['2026/10/10', '2026/10/16', 2, 300, 150, 200, 500],
      ['2026/10/03', '2026/10/09', 1, 100, 100, 100, 800],
      ['2026/09/26', '2026/10/02', 1, 50, 50, null, 900],
    ]);
  });

  it('الشهري والفترة', () => {
    const m = groupFarmDays(days, 'month');
    expect(m.map(g => [g.key, g.from, g.to, g.total, g.change])).toEqual([
      ['2026-10', '2026/10/01', '2026/10/31', 1000, 1900],
      ['2026-09', '2026/09/01', '2026/09/30', 50, null],
    ]);
    expect(farmDaysBetween(days, '2026/10/09', '2026/10/16').map(d => d.date)).toEqual(['2026/10/16', '2026/10/10', '2026/10/09']);
  });
});
describe('عمود الرسم الأسبوعي في جدول الكشف اليومي', () => {
  beforeEach(() => {
    localStorage.clear();
    saveFarmsDay('التسمين', '2026/10/10', [{ name: 'تسمين مزرعة 1', previous: 9, inbound: 0, consumption: 300, balance: 9 }]);
    saveFarmsDay('التسمين', '2026/10/14', [
      { name: 'تسمين مزرعة 1', previous: 9, inbound: 0, consumption: 1000, balance: 9 },
      { name: 'تسمين مزرعة 2', previous: 9, inbound: 0, consumption: 500, balance: 9 },
    ]);
    saveFarmsDay('التسمين', '2026/10/17', [{ name: 'تسمين مزرعة 1', previous: 9, inbound: 0, consumption: 50, balance: 9 }]);
  });

  it('أيام أسبوع الكشف (سبت–جمعة) ومصروف كل مزرعة فيها', () => {
    const w = weekUsage(readSiteFarms(), 'التسمين', '2026/10/14');
    expect(w.dates).toEqual(['2026/10/10', '2026/10/11', '2026/10/12', '2026/10/13', '2026/10/14', '2026/10/15', '2026/10/16']);
    expect(w.byFarm.get('تسمين مزرعة 1')).toEqual([300, null, null, null, 1000, null, null]);
    expect(w.byFarm.get('تسمين مزرعة 2')).toEqual([null, null, null, null, 500, null, null]);
  });
});
describe('مجاميع يوم الموقع (المحطة + المزارع) لكروت الموقع', () => {
  beforeEach(() => {
    localStorage.clear();
    saveFarmsDay('التسمين', '2026/10/13', [{ name: 'تسمين مزرعة 1', previous: 50, inbound: 0, consumption: 5, balance: 45 }]);
    saveFarmsDay('التسمين', '2026/10/14', [
      { name: 'محطة التسمين', previous: 1000, inbound: 300, consumption: 200, balance: 1100 },
      { name: 'تسمين مزرعة 1', previous: 45, inbound: 0, consumption: 10, balance: 35 },
    ]);
  });
  it('آخر كشف افتراضيًا، أو اليوم المحدد', () => {
    expect(siteDayTotals(readSiteFarms(), 'التسمين')).toEqual({ date: '2026/10/14', previous: 1045, inbound: 300, consumption: 210, balance: 1135, farms: 1 });
    expect(siteDayTotals(readSiteFarms(), 'التسمين', '2026/10/13').balance).toBe(45);
    expect(siteDayTotals(readSiteFarms(), 'البوادي')).toEqual({ date: null, previous: 0, inbound: 0, consumption: 0, balance: 0, farms: 0 });
  });
});
describe('خريطة مركز التوزيع: المواقع مناطق', () => {
  beforeEach(() => {
    localStorage.clear();
    saveFarmsDay('الطاقة', '2026/10/16', [{ name: 'محطة النقل', previous: 1000000, inbound: 0, consumption: 40000, balance: 960000 }]);
    saveFarmsDay('التسمين', '2026/10/15', [{ name: 'محطة التسمين', previous: 120000, inbound: 0, consumption: 20000, balance: 100000 }]);
    saveFarmsDay('التسمين', '2026/10/16', [{ name: 'محطة التسمين', previous: 100000, inbound: 0, consumption: 40000, balance: 60000 }]);
    saveFarmsDay('البياض', '2026/10/16', [{ name: 'محطة البياض', previous: 500000, inbound: 0, consumption: 10000, balance: 490000 }]);
  });
  it('رصيد الموقع ومعدله وحالته بأيام التغطية، والمركز خزان', () => {
    const c = networkCover(readSiteFarms(), 'الطاقة', ['الطاقة', 'التسمين', 'البياض', 'البوادي']);
    expect(c.station).toMatchObject({ name: 'الطاقة', balance: 960000 });
    expect(c.farms.map(f => [f.name, f.balance, Math.round(f.rate), f.status])).toEqual([
      ['التسمين', 60000, 30000, 'crit'],
      ['البياض', 490000, 10000, 'ok'],
      ['البوادي', 0, 0, 'idle'],
    ]);
  });
});