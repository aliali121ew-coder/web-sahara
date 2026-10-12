import { describe, expect, it } from 'vitest';
import { Activity, act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useSyncedStorage } from '../useSyncedStorage';
import { useSaharaLedger } from '../saharaLedger';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * الصفحات التي زارها المستخدم تبقى مخفية بـ <Activity>، فتُفصل عنها مستمعات الأحداث.
 * تعديل من صفحة أخرى أثناء إخفائها يجب أن يظهر عند عودتها (كان يتطلب إعادة تحميل التطبيق).
 */
const mount = (render: () => string) => {
  const host = document.createElement('div');
  const root = createRoot(host);
  const Probe = () => createElement('span', null, render());
  const show = (visible: boolean) => act(() => root.render(createElement(Activity, { mode: visible ? 'visible' : 'hidden', children: createElement(Probe) })));
  return { host, show, unmount: () => act(() => root.unmount()) };
};

describe('hidden pages re-read storage when shown again', () => {
  it('useSyncedStorage', async () => {
    localStorage.setItem('probe_key', JSON.stringify('old'));
    const p = mount(() => useSyncedStorage<string>('probe_key', '')[0]);
    await p.show(true);
    expect(p.host.textContent).toBe('old');
    await p.show(false);
    // كتابة من صفحة أخرى أثناء الإخفاء (مستمعو هذه الصفحة مفصولون)
    localStorage.setItem('probe_key', JSON.stringify('new'));
    window.dispatchEvent(new CustomEvent('synced-storage-updated', { detail: 'probe_key' }));
    await p.show(true);
    expect(p.host.textContent).toBe('new');
    await p.unmount();
  });

  it('useSaharaLedger (published days)', async () => {
    const KEY = 'sahara_company_balance_published_v1';
    localStorage.setItem('sahara_company_balance_ledger_v1', JSON.stringify([{ id: 'd1', date: '2026/10/01' }]));
    localStorage.setItem(KEY, JSON.stringify([{ id: 'd1', date: '2026/10/01' }]));
    const p = mount(() => String(useSaharaLedger().publishedComputed.length));
    await p.show(true);
    expect(p.host.textContent).toBe('1');
    await p.show(false);
    localStorage.setItem(KEY, JSON.stringify([{ id: 'd1', date: '2026/10/01' }, { id: 'd2', date: '2026/10/02' }]));
    window.dispatchEvent(new Event('sahara-ledger-updated'));
    await p.show(true);
    expect(p.host.textContent).toBe('2');
    await p.unmount();
  });
});
