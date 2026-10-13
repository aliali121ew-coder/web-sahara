import { describe, expect, it, beforeEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { sanitizeSinglePage, SINGLE_PAGE_TABS } from '../permCatalog';
import { useCanOpenTab, usePermissions } from '../usePermission';
import { SESSION_PROFILE_KEY } from '../session';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('sanitizeSinglePage', () => {
  it('keeps only known pages', () => {
    for (const id of SINGLE_PAGE_TABS) expect(sanitizeSinglePage(id)).toBe(id);
    expect(sanitizeSinglePage('admin')).toBe('');
    expect(sanitizeSinglePage('<script>')).toBe('');
    expect(sanitizeSinglePage(undefined)).toBe('');
    expect(sanitizeSinglePage(5)).toBe('');
  });
});

/** يعرض خطاف الصلاحيات بملف جلسة معيّن ويعيد: الصفحة الوحيدة + نتيجة فتح كل صفحة */
const probe = async (profile: Record<string, unknown>, tabs: string[]) => {
  localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify({ id: 'u1', username: 'u', name: 'U', role: '', avatar: '', color: '', ...profile }));
  let out: { single: string; open: Record<string, boolean> } = { single: '', open: {} };
  const Probe = () => {
    const p = usePermissions();
    const can = useCanOpenTab();
    out = { single: p.singlePage, open: Object.fromEntries(tabs.map(t => [t, can(t)])) };
    return null;
  };
  const root = createRoot(document.createElement('div'));
  await act(() => root.render(createElement(Probe)));
  await act(() => root.unmount());
  return out;
};

describe('single page accounts', () => {
  beforeEach(() => localStorage.clear());
  const tabs = ['dashboard', 'tanks', 'prices', 'finance-etihad'];

  it('opens only the chosen page', async () => {
    const r = await probe({ is_admin: 0, perms: { dashboard: 1, tanks: 1, prices: 2, 'etihad.balance': 1 }, single_page: 'tanks' }, tabs);
    expect(r.single).toBe('tanks');
    expect(r.open).toEqual({ dashboard: false, tanks: true, prices: false, 'finance-etihad': false });
  });

  it('still requires view permission on the chosen page', async () => {
    const r = await probe({ is_admin: 0, perms: { dashboard: 1 }, single_page: 'tanks' }, tabs);
    expect(r.open.tanks).toBe(false);
  });

  it('without the option, pages follow permissions as before', async () => {
    const r = await probe({ is_admin: 0, perms: { dashboard: 1, tanks: 1 } }, tabs);
    expect(r.single).toBe('');
    expect(r.open).toEqual({ dashboard: true, tanks: true, prices: false, 'finance-etihad': false });
  });

  it('is ignored for the system administrator', async () => {
    const r = await probe({ is_admin: 1, perms: {}, single_page: 'tanks' }, tabs);
    expect(r.single).toBe('');
    expect(Object.values(r.open).every(Boolean)).toBe(true);
  });
});
