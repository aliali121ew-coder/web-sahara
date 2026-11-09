import { describe, expect, it } from 'vitest';
import { byMonth, mergeSheets, monthOf } from '../vehicleRows';
import { migrateLegacyRefills } from '../../../worker/vehicles';
import type { VehicleRefill } from '../vehicleFuel';

const row = (fileId: string, i: number, vehicle: string, date: string, qty: number, site = 'الاسمدة العضوية'): VehicleRefill => ({
  id: `${fileId}-${i}`, fileId, site, vehicle, driver: '', qty, date, days: null, prevSite: '', prevDriver: '', prevQty: null, prevDate: '', kind: '',
});

describe('mergeSheets', () => {
  const stored = [row('A', 0, '1', '2026/11/08', 100), row('A', 1, '2', '2026/11/08', 50)];

  it('rejects the same sheet, and an old-id sheet with the same row count', () => {
    const again = mergeSheets(stored, [{ fileId: 'A', legacyId: 'A', rows: stored }]);
    expect(again.results[0].status).toBe('dup');
    const legacy = mergeSheets(stored, [{ fileId: 'B', legacyId: 'A', rows: [row('B', 0, '9', '2026/11/08', 1), row('B', 1, '8', '2026/11/08', 2)] }]);
    expect(legacy.results[0].status).toBe('dup');
  });

  it('accepts another sheet of the same site and day with a different vehicle count', () => {
    const r = mergeSheets(stored, [{ fileId: 'B', legacyId: 'A', rows: [row('B', 0, '3', '2026/11/08', 70)] }]);
    expect(r.results[0]).toMatchObject({ status: 'ok', kept: 1 });
    expect(r.added).toHaveLength(1);
  });

  it('skips rows already stored from another sheet', () => {
    const r = mergeSheets(stored, [{ fileId: 'C', legacyId: 'C', rows: [row('C', 0, '1', '2026/11/08', 100), row('C', 1, '4', '2026/11/08', 30)] }]);
    expect(r.results[0]).toMatchObject({ status: 'ok', kept: 1, dupRows: 1 });
  });

  it('groups rows by month', () => {
    expect(monthOf('2026/11/08')).toBe('2026-11');
    expect([...byMonth([row('A', 0, '1', '2026/10/31', 1), row('A', 1, '1', '2026/11/01', 1)]).keys()]).toEqual(['2026-10', '2026-11']);
  });
});

/** D1 و R2 في الذاكرة بقدر ما يحتاجه النقل */
const fakeDb = (legacy: VehicleRefill[]) => ({
  prepare: () => ({ bind: () => ({ all: async () => ({ results: legacy.map(r => ({ data: JSON.stringify(r) })) }) }) }),
});
const fakeBucket = () => {
  const store = new Map<string, { body: string; etag: string }>();
  let n = 0;
  return {
    store,
    get: async (k: string) => { const o = store.get(k); return o ? { key: k, size: o.body.length, uploaded: new Date(), etag: o.etag, text: async () => o.body } : null; },
    head: async (k: string) => (store.has(k) ? { key: k } : null),
    put: async (k: string, body: string, opts?: { onlyIf?: { etagMatches?: string } }) => {
      const cur = store.get(k);
      if (opts?.onlyIf?.etagMatches && cur?.etag !== opts.onlyIf.etagMatches) return null;
      store.set(k, { body, etag: `e${++n}` });
      return { key: k };
    },
    delete: async (k: string) => { store.delete(k); },
    list: async () => ({ objects: [...store.keys()].map(key => ({ key, size: 0, uploaded: new Date(), etag: store.get(key)!.etag })), truncated: false }),
  };
};

describe('migrateLegacyRefills', () => {
  it('copies every D1 row into its month file, and running it again adds nothing', async () => {
    const legacy = [row('A', 0, '1', '2026/10/30', 10), row('A', 1, '2', '2026/10/31', 20), row('B', 0, '1', '2026/11/02', 30)];
    const bucket = fakeBucket();
    const db = fakeDb(legacy);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = await migrateLegacyRefills(db as any, bucket as any);
    expect(first).toEqual({ legacyRows: 3, months: 2, added: 3 });
    expect(JSON.parse(bucket.store.get('vehicles/refills/2026-10.json')!.body)).toHaveLength(2);
    expect(JSON.parse(bucket.store.get('vehicles/refills/2026-11.json')!.body)).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await migrateLegacyRefills(db as any, bucket as any);
    expect(second.added).toBe(0);
  });
});
