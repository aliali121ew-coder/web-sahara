import { describe, expect, it, beforeEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ALL_SECTIONS, sanitizePerms, sanitizeSinglePage, SINGLE_PAGE_TABS, grantPagePerms, type Perms } from '../permCatalog';
import { useCanOpenTab, usePermissions } from '../usePermission';
import { SESSION_PROFILE_KEY } from '../session';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const probe = async (profile: Record<string, unknown>, tabs: string[]) => {
  localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify({ id: 'u1', username: 'u', name: 'U', role: '', avatar: '', color: '', ...profile }));
  let out: { open: Record<string, boolean>; canEditAlerts: boolean } = { open: {}, canEditAlerts: false };
  const Probe = () => {
    const p = usePermissions();
    const can = useCanOpenTab();
    out = {
      open: Object.fromEntries(tabs.map(t => [t, can(t)])),
      canEditAlerts: p.canEdit('alerts'),
    };
    return null;
  };
  const root = createRoot(document.createElement('div'));
  await act(() => root.render(createElement(Probe)));
  await act(() => root.unmount());
  return out;
};

describe('Page permissions catalog & single page', () => {
  it('contains alerts and vehicles-report in ALL_SECTIONS', () => {
    expect(ALL_SECTIONS).toContain('alerts');
    expect(ALL_SECTIONS).toContain('vehicles-report');
  });

  it('sanitizes permissions correctly with new sections', () => {
    const sanitized = sanitizePerms({ alerts: 2, 'vehicles-report': 1, unknown: 2 });
    expect(sanitized).toEqual({ alerts: 2, 'vehicles-report': 1 });
  });

  it('includes alerts and vehicles-report in SINGLE_PAGE_TABS', () => {
    expect(SINGLE_PAGE_TABS).toContain('alerts');
    expect(SINGLE_PAGE_TABS).toContain('vehicles-report');
    expect(sanitizeSinglePage('alerts')).toBe('alerts');
    expect(sanitizeSinglePage('vehicles-report')).toBe('vehicles-report');
  });
});

describe('grantPagePerms migration helper', () => {
  it('grants edit alerts when user can edit any check section', () => {
    const res = grantPagePerms({ 'sahara.balance': 2 });
    expect(res.alerts).toBe(2);
  });

  it('grants view alerts when user can view a check section', () => {
    const res = grantPagePerms({ 'etihad.balance': 1 });
    expect(res.alerts).toBe(1);
  });

  it('grants view vehicles-report when user has reports permission', () => {
    const res = grantPagePerms({ reports: 2 });
    expect(res['vehicles-report']).toBe(1);
  });

  it('does not overwrite existing alerts or vehicles-report permission', () => {
    const res = grantPagePerms({ alerts: 1, 'sahara.balance': 2, 'vehicles-report': 2, reports: 1 });
    expect(res.alerts).toBe(1);
    expect(res['vehicles-report']).toBe(2);
  });

  it('returns same object if no changes needed', () => {
    const original: Perms = { dashboard: 1 };
    const res = grantPagePerms(original);
    expect(res).toBe(original);
  });
});

describe('useCanOpenTab gating', () => {
  beforeEach(() => localStorage.clear());
  const tabs = ['alerts', 'vehicles-report', 'reports'];

  it('allows admin to open both pages', async () => {
    const r = await probe({ is_admin: 1, perms: {} }, tabs);
    expect(r.open.alerts).toBe(true);
    expect(r.open['vehicles-report']).toBe(true);
    expect(r.canEditAlerts).toBe(true);
  });

  it('blocks alerts if user has alerts perm but no check sections', async () => {
    const r = await probe({ is_admin: 0, perms: { alerts: 1 } }, tabs);
    expect(r.open.alerts).toBe(false);
  });

  it('blocks alerts if user has check sections but lacks alerts perm', async () => {
    const r = await probe({ is_admin: 0, perms: { 'sahara.balance': 2 } }, tabs);
    expect(r.open.alerts).toBe(false);
  });

  it('allows alerts when user has alerts perm and at least one check section', async () => {
    const r = await probe({ is_admin: 0, perms: { alerts: 1, 'sahara.balance': 1 } }, tabs);
    expect(r.open.alerts).toBe(true);
    expect(r.canEditAlerts).toBe(false);

    const r2 = await probe({ is_admin: 0, perms: { alerts: 2, 'etihad.black-oil': 1 } }, tabs);
    expect(r2.open.alerts).toBe(true);
    expect(r2.canEditAlerts).toBe(true);
  });

  it('gates vehicles-report solely on vehicles-report permission', async () => {
    // User with old reports perm cannot open vehicles-report
    const r1 = await probe({ is_admin: 0, perms: { reports: 2 } }, tabs);
    expect(r1.open.reports).toBe(true);
    expect(r1.open['vehicles-report']).toBe(false);

    // User with vehicles-report perm can open vehicles-report
    const r2 = await probe({ is_admin: 0, perms: { 'vehicles-report': 1 } }, tabs);
    expect(r2.open['vehicles-report']).toBe(true);
    expect(r2.open.reports).toBe(false);
  });

  it('respects single_page for alerts and vehicles-report', async () => {
    const r = await probe({
      is_admin: 0,
      perms: { alerts: 1, 'sahara.balance': 1, 'vehicles-report': 1 },
      single_page: 'alerts',
    }, tabs);
    expect(r.open.alerts).toBe(true);
    expect(r.open['vehicles-report']).toBe(false);
  });
});
