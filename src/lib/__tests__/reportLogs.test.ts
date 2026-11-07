import { describe, expect, it } from 'vitest';
import { guardReportLogOps, scopeReportLogs } from '../../../worker/storage/reportLogs';
import { canCreateItems, type Perms } from '../permCatalog';
import type { D1Database } from '../../../worker/types';

const ALERTS = 'sahara_report_alerts_v1';
const ACTIVITY = 'sahara_report_activity_v1';
const THREADS = 'sahara_report_threads_v1';
const NOW = 1_000_000;

type Item = { key: string; id: string; data: string };
const fakeDb = (rows: Item[]) => ({
  prepare: (sql: string) => ({
    bind: (...args: string[]) => ({
      all: async () => {
        if (sql.includes('chat_users')) return { results: [{ name: 'كرار', username: 'karrar' }] };
        const of = rows.filter(r => r.key === args[0]);
        if (sql.includes('json_extract')) return { results: of.filter(r => JSON.parse(r.data).alertId === args[1]) };
        return { results: of.filter(r => sql.includes('id') && !sql.includes('ORDER') ? args.slice(1).includes(r.id) : true) };
      },
    }),
  }),
}) as unknown as D1Database;

const alert = (id: string, section: string) => ({ id, section, by: 'x', byUser: 'x', at: 1 });
type Row = { id: string } & Record<string, unknown>;
const item = (key: string, row: Row): Item => ({ key, id: row.id, data: JSON.stringify(row) });
const upsert = (row: Row) => ({ upsert: [{ id: row.id, pos: 0, data: JSON.stringify(row) }] });
const stored = (ops: { upsert?: { data: string }[] } | null) => JSON.parse(ops!.upsert![0].data);

const etihadEditor: Perms = { alerts: 2, 'etihad.balance': 2 };

describe('scopeReportLogs', () => {
  const rows = { a1: alert('a1', 'etihad-gas'), a2: alert('a2', 'sahara-gas') };
  const items = () => ({
    [ALERTS]: JSON.stringify([rows.a1, rows.a2]),
    [ACTIVITY]: JSON.stringify([{ id: 'x1', section: 'etihad-gas' }, { id: 'x2', section: 'petrol' }]),
    [THREADS]: JSON.stringify([{ id: 't1', alertId: 'a1' }, { id: 't2', alertId: 'a2' }]),
  });
  const ids = (s: string) => (JSON.parse(s) as { id: string }[]).map(r => r.id);

  it('keeps only the rows of the sections the account can see', async () => {
    const out: Record<string, string> = items();
    await scopeReportLogs(fakeDb([]), out, { alerts: 1, 'etihad.balance': 1 });
    expect(ids(out[ALERTS])).toEqual(['a1']);
    expect(ids(out[ACTIVITY])).toEqual(['x1']);
    expect(ids(out[THREADS])).toEqual(['t1']);
  });

  it('filters threads even when the alerts key was not requested', async () => {
    const out: Record<string, string> = { [THREADS]: items()[THREADS] };
    await scopeReportLogs(fakeDb([item(ALERTS, rows.a1), item(ALERTS, rows.a2)]), out, { alerts: 1, 'etihad.balance': 1 });
    expect(ids(out[THREADS])).toEqual(['t1']);
    expect(out[ALERTS]).toBeUndefined();
  });

  it('sends nothing without the alerts permission', async () => {
    const out: Record<string, string> = items();
    await scopeReportLogs(fakeDb([]), out, { 'etihad.balance': 2 });
    expect(ids(out[ALERTS])).toEqual([]);
    expect(ids(out[ACTIVITY])).toEqual([]);
    expect(ids(out[THREADS])).toEqual([]);
  });
});

describe('guardReportLogOps', () => {
  const request = { id: 't1', alertId: 'a1', at: 10, kind: 'request', to: 'someone' };
  const db = (...msgs: Row[]) => fakeDb([item(ALERTS, alert('a1', 'etihad-gas')), item(ALERTS, alert('a2', 'sahara-gas')), ...msgs.map(m => item(THREADS, m))]);
  const reply = { id: 't2', alertId: 'a1', at: 20, kind: 'reply', text: 'تم', by: 'مدير', byUser: 'admin' };

  it('replaces a forged author with the real account', async () => {
    const out = await guardReportLogOps(db(request), THREADS, upsert(reply), 'u1', etihadEditor, NOW);
    expect(stored(out)).toMatchObject({ by: 'كرار', byUser: 'karrar', at: 20 });
  });

  it('does not let a future time stay last in the thread', async () => {
    const out = await guardReportLogOps(db(request), THREADS, upsert({ ...reply, at: NOW * 2 }), 'u1', etihadEditor, NOW);
    expect(stored(out).at).toBe(NOW);
  });

  it('rejects admin-only thread kinds', async () => {
    for (const kind of ['request', 'close', 'reopen']) {
      expect(await guardReportLogOps(db(request), THREADS, upsert({ ...reply, kind }), 'u1', etihadEditor, NOW)).toBeNull();
    }
  });

  it('rejects a reply with no open request', async () => {
    expect(await guardReportLogOps(db(), THREADS, upsert(reply), 'u1', etihadEditor, NOW)).toBeNull();
    expect(await guardReportLogOps(db(request, { ...request, id: 't3', at: 15, kind: 'close' }), THREADS, upsert(reply), 'u1', etihadEditor, NOW)).toBeNull();
  });

  it('rejects a reply on an alert of another section', async () => {
    expect(await guardReportLogOps(db({ ...request, alertId: 'a2' }), THREADS, upsert({ ...reply, alertId: 'a2' }), 'u1', etihadEditor, NOW)).toBeNull();
  });

  it('lets the assignee reply with view on the section', async () => {
    const perms: Perms = { alerts: 2, 'etihad.balance': 1 };
    expect(await guardReportLogOps(db(request), THREADS, upsert(reply), 'u1', perms, NOW)).toBeNull();
    expect(await guardReportLogOps(db({ ...request, to: 'karrar' }), THREADS, upsert(reply), 'u1', perms, NOW)).not.toBeNull();
  });

  it('needs edit on the section to add an alert or activity row', async () => {
    const row = { id: 'n1', section: 'sahara-gas', at: 5, by: 'x', byUser: 'x' };
    expect(await guardReportLogOps(db(), ACTIVITY, upsert(row), 'u1', etihadEditor, NOW)).toBeNull();
    const out = await guardReportLogOps(db(), ACTIVITY, upsert({ ...row, section: 'etihad-gas' }), 'u1', etihadEditor, NOW);
    expect(stored(out).byUser).toBe('karrar');
  });

  it('keeps the audit trail for a section editor without the alerts permission', async () => {
    const out = await guardReportLogOps(db(), ALERTS, upsert({ id: 'n1', section: 'etihad-gas', at: 5 }), 'u1', { 'etihad.balance': 2 }, NOW);
    expect(out).not.toBeNull();
  });

  it('only marks an alert reviewed in a visible section', async () => {
    const seen = { ...alert('a1', 'etihad-gas'), read: true };
    const out = await guardReportLogOps(db(), ALERTS, upsert(seen), 'u1', etihadEditor, NOW);
    expect(stored(out)).toEqual(seen);
    expect(await guardReportLogOps(db(), ALERTS, upsert({ ...alert('a2', 'sahara-gas'), read: true }), 'u1', etihadEditor, NOW)).toBeNull();
  });
});

describe('thread replies permission', () => {
  it('follows alerts edit, not section edit', () => {
    expect(canCreateItems({ alerts: 2 }, false, THREADS)).toBe(true);
    expect(canCreateItems({ alerts: 1, 'etihad.balance': 2 }, false, THREADS)).toBe(false);
    expect(canCreateItems({ 'etihad.balance': 2 }, false, ACTIVITY)).toBe(true);
  });
});
