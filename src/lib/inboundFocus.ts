import type { InboundDelivery } from '../types';

/**
 * فتح أرشيف الوارد مصفّى على مورد ويوم معيّن (من صفحة الموردين).
 * يُحفظ الطلب في sessionStorage ليقرأه الأرشيف عند فتحه أول مرة، ويُبثّ حدث إن كان مفتوحًا أصلًا.
 */
export interface InboundFocus { scope: 'sahara' | 'etihad'; company: string; person: string; date: string }

const KEY = 'sahara_inbound_focus';
export const FOCUS_EVENT = 'sahara-inbound-focus';
const PLACEHOLDER = new Set(['', '_', '-', 'مشتريات متنوعة']);

export const focusFromDelivery = (d: InboundDelivery, scope: InboundFocus['scope'], date: string): InboundFocus => {
  const company = (d.supplierCompany || '').trim();
  return PLACEHOLDER.has(company)
    ? { scope, company: '', person: (d.supplierName || '').trim(), date }
    : { scope, company: d.supplierCompany, person: '', date };
};

export const requestInboundFocus = (f: InboundFocus) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(f)); } catch { /* تجاهل */ }
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: f }));
};

/** يقرأ الطلب مرة واحدة ثم يحذفه */
export const takeInboundFocus = (scope: InboundFocus['scope']): InboundFocus | null => {
  try {
    const f = JSON.parse(sessionStorage.getItem(KEY) || 'null') as InboundFocus | null;
    if (f?.scope !== scope) return null;
    sessionStorage.removeItem(KEY);
    return f;
  } catch {
    return null;
  }
};
