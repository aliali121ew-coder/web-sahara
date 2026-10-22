import { beforeEach, describe, expect, it } from 'vitest';
import { createSiteRequest, inTransit, readSiteRequests, requestsOf, setRequestStatus, suggestTankers } from '../siteRequests';
import { canEditSite, canViewAnySite, canViewSite, sitePerm } from '../siteAccess';
import { canReadKey, canWriteKey, ALL_SECTIONS } from '../permCatalog';

describe('صلاحيات المواقع', () => {
  const can = (granted: string[]) => (s: string) => granted.includes(s);
  it('حساب موقع يدخل موقعه فقط، والاحتياطي يفتح كل المواقع', () => {
    expect(sitePerm('امهات البياض')).toBe('sahara.site.ummahat');
    expect(ALL_SECTIONS).toContain('sahara.site.taqa');
    const tasmeen = can(['sahara.site.tasmeen']);
    expect(canViewSite(tasmeen, 'التسمين')).toBe(true);
    expect(canViewSite(tasmeen, 'البياض')).toBe(false);
    expect(canViewAnySite(tasmeen)).toBe(true);
    expect(canViewAnySite(can(['sahara.balance']))).toBe(false);
    expect(canEditSite(can(['sahara.reserves']), 'الطاقة')).toBe(true);
  });

  it('حساب الموقع يقرأ بيانات المزارع، ويكتب الطلبات فقط', () => {
    const perms = { 'sahara.site.bawadi': 2 as const };
    expect(canReadKey(perms, false, 'sahara_site_farms_v1')).toBe(true);
    expect(canWriteKey(perms, false, 'sahara_site_farms_v1')).toBe(false);
    expect(canWriteKey(perms, false, 'sahara_site_requests_v1')).toBe(true);
    expect(canReadKey({ 'sahara.site.bawadi': 1 }, false, 'sahara_site_requests_v1')).toBe(true);
    expect(canWriteKey({ 'sahara.site.bawadi': 1 }, false, 'sahara_site_requests_v1')).toBe(false);
  });
});

describe('الطلبات بين المواقع', () => {
  beforeEach(() => localStorage.clear());

  it('مدة الوصول وعدد الصهاريج تُحفظ مع الطلب (والقيم غير المعقولة تُهمل)', () => {
    const r = createSiteRequest('البياض', 'الطاقة', 70000, '', undefined, { etaMin: 90.4, tankers: 2 })!;
    expect(r).toMatchObject({ etaMin: 90, tankers: 2 });
    const bad = createSiteRequest('البياض', 'الطاقة', 1000, '', undefined, { etaMin: 0, tankers: 50 })!;
    expect(bad.etaMin).toBeUndefined();
    expect(bad.tankers).toBeUndefined();
    expect(suggestTankers(70000)).toBe(2);
    expect(suggestTankers(5000)).toBe(1);
  });

  it('طلب ← موافقة (شاحنة في الطريق) ← استلام، والانتقالات الخاطئة مرفوضة', () => {
    expect(createSiteRequest('التسمين', 'التسمين', 100, '')).toBeNull();
    expect(createSiteRequest('التسمين', 'الطاقة', 0, '')).toBeNull();
    const r = createSiteRequest('التسمين', 'الطاقة', 5000.4, ' عاجل ', 'علي')!;
    expect(r).toMatchObject({ site: 'التسمين', source: 'الطاقة', qty: 5000, note: 'عاجل', status: 'pending', by: 'علي' });
    const { incoming, outgoing } = requestsOf(readSiteRequests(), 'الطاقة');
    expect(incoming.map(x => x.id)).toEqual([r.id]);
    expect(outgoing).toEqual([]);
    expect(setRequestStatus(r.id, 'delivered')).toBe(false);
    expect(setRequestStatus(r.id, 'approved', 'مدير الطاقة')).toBe(true);
    expect(inTransit(readSiteRequests()).map(x => x.id)).toEqual([r.id]);
    expect(readSiteRequests()[0]).toMatchObject({ approvedBy: 'مدير الطاقة' });
    expect(setRequestStatus(r.id, 'rejected')).toBe(false);
    expect(setRequestStatus(r.id, 'delivered', 'علي')).toBe(true);
    expect(inTransit(readSiteRequests())).toEqual([]);
    expect(readSiteRequests()[0]).toMatchObject({ status: 'delivered', closedBy: 'علي' });
  });

  it('الإلغاء والرفض قبل الموافقة فقط', () => {
    const a = createSiteRequest('البياض', 'البوادي', 100, '')!;
    const b = createSiteRequest('البياض', 'البوادي', 200, '')!;
    expect(setRequestStatus(a.id, 'cancelled')).toBe(true);
    expect(setRequestStatus(b.id, 'rejected')).toBe(true);
    expect(setRequestStatus(b.id, 'approved')).toBe(false);
    expect(readSiteRequests().map(x => x.status)).toEqual(['rejected', 'cancelled']);
  });
});
