// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { recordChanges, threadAssignee, threadStatus, type ThreadMessage } from '../reportActivity';

vi.mock('../../context/FuelDataContext', () => ({ useFuelNav: () => ({ setActiveTab: () => {} }) }));
vi.mock('../usePermission', () => ({ usePermissions: () => ({ isAdmin: true, canView: () => true, canEdit: () => true, level: () => 2 }) }));

const msg = (kind: ThreadMessage['kind'], at: number, to?: string): ThreadMessage => ({ id: `${kind}${at}`, alertId: 'a1', at, by: 'x', byUser: 'x', kind, text: '', to });

describe('report activity and corrections', () => {
  it('records only the numeric fields that changed', () => {
    const c = recordChanges({ id: '1', vehicles: 100, farms: 50, savedAt: 'x', note: 'a' }, { id: '1', vehicles: 120, farms: 50, savedAt: 'y', note: 'b' });
    expect(c).toEqual([{ field: 'vehicles', from: 100, to: 120 }]);
    expect(recordChanges({ price: null }, { price: 500 })).toEqual([{ field: 'price', from: null, to: 500 }]);
  });

  it('derives the correction status and assignee from the latest message', () => {
    expect(threadStatus([])).toBe('none');
    expect(threadStatus([msg('request', 1, 'karrar')])).toBe('waiting_user');
    expect(threadStatus([msg('request', 1, 'karrar'), msg('reply', 2)])).toBe('waiting_admin');
    expect(threadStatus([msg('reply', 2), msg('request', 1, 'karrar'), msg('close', 3)])).toBe('closed');
    expect(threadStatus([msg('request', 1, 'a'), msg('reply', 2), msg('reopen', 3, 'a')])).toBe('waiting_user');
    expect(threadAssignee([msg('request', 1, 'a'), msg('reply', 2), msg('reopen', 3, 'b')])).toBe('b');
  });

  it('renders the alerts page with an alert, an edit and a correction thread', async () => {
    const now = Date.now();
    localStorage.setItem('sahara_report_alerts_v1', JSON.stringify([
      { id: 'a1', at: now, section: 'sahara-gas', date: '2026/10/23', prevDate: '2026/10/22', status: 'mismatch', file: 9724000, system: 9728325, diff: -4325, fileName: 'r.pdf', source: 'bulk', by: 'كرار حيدر', byUser: 'karrar' },
    ]));
    localStorage.setItem('sahara_report_activity_v1', JSON.stringify([
      { id: 'e1', at: now - 1000, by: 'كرار حيدر', byUser: 'karrar', section: 'sahara-gas', action: 'edit', date: '2026/10/21', changes: [{ field: 'vehicles', from: 1, to: 2 }] },
    ]));
    localStorage.setItem('sahara_report_threads_v1', JSON.stringify([msg('request', now + 5, 'karrar')].map(m => ({ ...m, text: 'راجع' }))));
    const { ReportAlertsView } = await import('../../components/alerts/ReportAlertsView');
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => { root.render(React.createElement(ReportAlertsView)); });
    expect(el.querySelectorAll('li').length).toBeGreaterThan(0);
    // التبويبات الثلاثة تُعرض دون أخطاء
    for (const b of Array.from(el.querySelectorAll('button')).slice(0, 12)) await act(async () => { b.click(); });
    await act(async () => { root.unmount(); });
  });
});
