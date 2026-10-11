import { describe, it, expect } from 'vitest';
import { computeDailyBuys } from '../inboundPrice';
const d = (date: string, q: number, p: number) => ({ id: date + q, date, receivedQuantity: q, productPrice: p, productCost: q * p }) as never;
const list = [d('2026/10/08', 100, 800), d('2026/10/09', 100, 900)];
describe('computeDailyBuys', () => {
  it('legacy: last two inbound days', () => {
    const r = computeDailyBuys(list);
    expect(r.today?.day).toBe('2026/10/09'); expect(r.previous?.day).toBe('2026/10/08'); expect(r.pct).toBeCloseTo(((850 - 800) / 800) * 100);
  });
  it('onDay with inbound', () => {
    const r = computeDailyBuys(list, '2026/10/09');
    expect(r.today?.price).toBe(900); expect(r.previous?.day).toBe('2026/10/08');
  });
  it('onDay without inbound -> no buy', () => {
    const r = computeDailyBuys(list, '2026/10/10');
    expect(r.today).toBeNull(); expect(r.pct).toBeNull(); expect(r.previous?.day).toBe('2026/10/09');
  });
  it('onDay before all', () => {
    const r = computeDailyBuys(list, '2026/10/01');
    expect(r.today).toBeNull(); expect(r.previous).toBeNull();
  });
});
