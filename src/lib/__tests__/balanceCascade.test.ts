import { describe, expect, it } from 'vitest';
import type { EtihadBalanceRecord } from '../../types/finance';
import type { SaharaLedgerRecord } from '../saharaLedger';
import { computeSahara } from '../saharaLedger';
import { cascadeEtihadBalances, cascadeSaharaRecords, laterDaysCount } from '../balanceCascade';

const e = (id: string, date: string, prev: number, purchases: number, expense: number, sales: number, current: number) =>
  ({ id, date, previousBalance: prev, purchases, etihadExpense: expense, otherSales: sales, saharaSales: 0, cablesSales: 0, specialSales: 0, totalDeductions: expense + sales, currentBalance: current }) as EtihadBalanceRecord;

describe('تسلسل الرصيد بعد تعديل يوم', () => {
  it('الاتحاد: الأيام اللاحقة تأخذ الرصيد السابق من اليوم الذي قبلها، والأيام السابقة لا تتغير', () => {
    const records = [
      e('17', '2026/10/17', 900, 50, 20, 10, 920),
      e('15', '2026/10/15', 1000, 100, 50, 0, 1000), // عُدّل: الحالي صار 1000 (كان 1050)
      e('14', '2026/10/14', 800, 200, 0, 0, 1000),
      e('16', '2026/10/16', 1050, 0, 100, 0, 950),
    ];
    const out = cascadeEtihadBalances(records, '2026/10/15');
    const byId = Object.fromEntries(out.map(r => [r.id, r]));
    expect(byId['14']).toBe(records[2]);
    expect(byId['15']).toBe(records[1]);
    expect([byId['16'].previousBalance, byId['16'].currentBalance]).toEqual([1000, 900]);
    expect([byId['17'].previousBalance, byId['17'].currentBalance]).toEqual([900, 920]);
    expect(out.map(r => r.id)).toEqual(['17', '15', '14', '16']);
  });

  it('الاتحاد: تواريخ بشرطة تُقارن مثل المائلة، وبلا تغيير تُعاد نفس القائمة', () => {
    const records = [e('a', '2026-10-15', 0, 10, 0, 0, 10), e('b', '2026/10/16', 10, 5, 0, 0, 15)];
    expect(cascadeEtihadBalances(records, '2026/10/15')).toBe(records);
    expect(laterDaysCount(records.map(r => r.date), '2026-10-15')).toBe(1);
  });

  it('الصحاري: الرصيد اليدوي والكشف يُزالان من الأيام اللاحقة فتتصل السلسلة', () => {
    const s = (id: string, date: string, inbound: number, prev?: number, cur?: number) =>
      ({ id, date, vehicles: 0, farms: 0, generators: 0, sales: 0, inboundExternal: { government: inbound }, previousOverride: prev ?? null, currentOverride: cur ?? null }) as SaharaLedgerRecord;
    const records = [s('1', '2026/10/14', 100, 0), s('2', '2026/10/15', 50), s('3', '2026/10/16', 10, 999, 5000)];
    const out = computeSahara(cascadeSaharaRecords(records, '2026/10/15'));
    expect(out.map(r => r.current)).toEqual([100, 150, 160]);
    expect(out[0].previousOverride).toBe(0);
  });
});
