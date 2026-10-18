import { useCallback, useEffect, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import { keepIfSame } from './keepIfSame';

/**
 * الطلبات بين مواقع الصحاري: موقع يطلب كمية من موقع آخر ← الموقع المطلوب منه يوافق (تنطلق الشاحنة)
 * أو يرفض ← الموقع الطالب يؤكد الاستلام. للمتابعة فقط: لا تغيّر أرصدة المواقع (الأرصدة من الكشف اليومي).
 */
export const SITE_REQUESTS_KEY = 'sahara_site_requests_v1';
const SYNC_EVENT = 'sahara-site-requests-updated';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'delivered' | 'cancelled';
export interface SiteRequest {
  id: string;
  /** الموقع الطالب (تصل إليه الشاحنة) */
  site: string;
  /** الموقع المطلوب منه (تنطلق منه الشاحنة) */
  source: string;
  qty: number;
  note?: string;
  status: RequestStatus;
  createdAt: string;
  by?: string;
  approvedAt?: string;
  approvedBy?: string;
  closedAt?: string;
  closedBy?: string;
}

const isReq = (r: unknown): r is SiteRequest =>
  !!r && typeof r === 'object' && typeof (r as SiteRequest).id === 'string' && typeof (r as SiteRequest).site === 'string' && typeof (r as SiteRequest).source === 'string';

export const readSiteRequests = (): SiteRequest[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(SITE_REQUESTS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(isReq) : [];
  } catch {
    return [];
  }
};

const write = (list: SiteRequest[]) => {
  localStorage.setItem(SITE_REQUESTS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

const now = () => new Date().toISOString();

export const createSiteRequest = (site: string, source: string, qty: number, note: string, by?: string): SiteRequest | null => {
  if (!site || !source || site === source || !(qty > 0)) return null;
  const req: SiteRequest = { id: `sr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, site, source, qty: Math.round(qty), note: note.trim() || undefined, status: 'pending', createdAt: now(), by };
  write([req, ...readSiteRequests()]);
  return req;
};

/** الانتقالات المسموحة فقط: انتظار ← موافقة/رفض/إلغاء، موافقة ← استلام */
const NEXT: Record<RequestStatus, RequestStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['delivered'],
  rejected: [], delivered: [], cancelled: [],
};

export const setRequestStatus = (id: string, status: RequestStatus, by?: string): boolean => {
  const list = readSiteRequests();
  const req = list.find(r => r.id === id);
  if (!req || !NEXT[req.status].includes(status)) return false;
  const t = now();
  write(list.map(r => (r.id !== id ? r : status === 'approved'
    ? { ...r, status, approvedAt: t, approvedBy: by }
    : { ...r, status, closedAt: t, closedBy: by })));
  return true;
};

/** طلبات موقع: الواردة إليه (مطلوب منه) والصادرة منه (طلبها) */
export const requestsOf = (list: SiteRequest[], site: string) => ({
  incoming: list.filter(r => r.source === site),
  outgoing: list.filter(r => r.site === site),
});

/** الشاحنات في الطريق (طلبات موافَق عليها لم تُستلم) */
export const inTransit = (list: SiteRequest[]) => list.filter(r => r.status === 'approved');

/** مزامنة حية بين التبويبات والأجهزة؛ تُعاد القراءة عند ظهور الصفحة المخفية */
export const useSiteRequests = () => {
  const [list, setList] = useState<SiteRequest[]>(readSiteRequests);
  const refresh = useCallback(() => setList(keepIfSame(readSiteRequests())), []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === SITE_REQUESTS_KEY) refresh(); };
    const onCloud = (e: Event) => { if (((e as CustomEvent<string[]>).detail ?? []).includes(SITE_REQUESTS_KEY)) refresh(); };
    refresh();
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
  }, [refresh]);
  return list;
};
