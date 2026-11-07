import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { etihadCoverage } from '../etihadCoverage';
import type { EtihadBalanceRecord } from '../../types/finance';

const rec = (date: string, expense: number, sales = 0, balance = 0) => ({ date, etihadExpense: expense, saharaSales: sales, cablesSales: 0, specialSales: 0, otherSales: 0, currentBalance: balance }) as EtihadBalanceRecord;

describe('etihadCoverage', () => {
  it('يقسم رصيد آخر يوم على متوسط صرف الأسبوع (مصروف + مبيعات) ويعد من تاريخ آخر يوم', () => {
    const r = [rec('2026/10/31', 800, 200, 10500), rec('2026/10/30', 500, 0, 11000), rec('2026/10/24', 100000, 0, 12000)];
    expect(etihadCoverage(r)).toEqual({ days: 14, date: '2026/11/14' });
  });

  it('لا يحسب يومًا خارج الأيام السبعة ولا يومًا بلا صرف', () => {
    const r = [rec('2026/10/31', 1000, 0, 5000), rec('2026/10/30', 0, 0, 6000), rec('2026/10/25', 3000, 0, 7000), rec('2026/10/24', 50, 0, 8000)];
    expect(etihadCoverage(r).days).toBe(2);
  });

  it('بلا سجلات أو بلا صرف لا يوجد تقدير', () => {
    expect(etihadCoverage([])).toEqual({ days: 0, date: '' });
    expect(etihadCoverage([rec('2026/10/31', 0, 0, 500)])).toEqual({ days: 0, date: '' });
  });
});

describe('sw vehicle images', () => {
  it('كل صور العربات مدرجة في قائمة التخزين المسبق', () => {
    const sw = readFileSync('public/sw.js', 'utf8');
    const keys = (name: string) => (new RegExp(`const ${name} = '([^']+)'`).exec(sw)?.[1] || '').split(' ').map(k => `${k}.webp`).sort();
    expect(keys('typeImages')).toEqual(readdirSync('public/trucks/types').sort());
    expect(keys('labImages')).toEqual(readdirSync('public/trucks/lab').sort());
    for (const f of readdirSync('public/trucks/tank')) expect(sw).toContain(`/trucks/tank/${f}`);
    expect(sw).toContain('/trucks/semi_truck.jpg');
  });
});
