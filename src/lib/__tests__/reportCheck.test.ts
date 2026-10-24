import { describe, expect, it } from 'vitest';
import { blackOilContinuity, continuityCheck } from '../reportCheck';
import type { ComputedBlackOilRecord } from '../blackOilLedger';

const days = [
  { id: 'a', date: '2026/10/19', current: 9_700_000 },
  { id: 'b', date: '2026/10/20', current: 9_804_648 },
];

describe('report continuity check', () => {
  it('matches when the carried forward equals the previous day current', () => {
    const c = continuityCheck('sahara-gas', '2026/10/21', 9_804_648, days);
    expect(c).toMatchObject({ status: 'match', prevDate: '2026/10/20', diff: 0, system: 9_804_648 });
  });

  it('reports the difference (file − system) when they differ', () => {
    const c = continuityCheck('petrol', '2026-10-21', 9_800_000, days);
    expect(c).toMatchObject({ status: 'mismatch', diff: -4_648, date: '2026/10/21' });
  });

  it('ignores sub-litre rounding and compares with the day right before (not the newest)', () => {
    expect(continuityCheck('etihad-gas', '2026/10/20', 9_700_000.4, days).status).toBe('match');
  });

  it('skips the edited day itself and handles missing values', () => {
    expect(continuityCheck('sahara-gas', '2026/10/20', 1, days, 'a').status).toBe('noPrevDay');
    expect(continuityCheck('sahara-gas', '2026/10/21', undefined, days).status).toBe('noFileValue');
  });

  it('black oil: derives the carried forward per site (actual − inbound + consumption)', () => {
    const prev = { id: 'p', date: '2026/10/20', current: 300, siteRows: [{ key: 'rayan', current: 200 }, { key: 'sugar', current: 100 }] } as unknown as ComputedBlackOilRecord;
    const site = (actual: number, inbound: number, consumption: number) => ({ actual, inbound, consumption, program: null, capacity: null, empty: null, diff: null });
    const ok = blackOilContinuity('etihad', '2026/10/21', { rayan: site(210, 30, 20), sugar: site(90, 0, 10) }, [prev]);
    expect(ok).toMatchObject({ status: 'match', file: 300, system: 300 });
    const bad = blackOilContinuity('etihad', '2026/10/21', { rayan: site(215, 30, 20), sugar: site(90, 0, 10) }, [prev]);
    expect(bad.status).toBe('mismatch');
    expect(bad.parts?.find(p => p.key === 'rayan')?.diff).toBe(5);
  });
});
