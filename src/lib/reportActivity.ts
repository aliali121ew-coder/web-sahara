import { getProfile } from './session';
import { notifySyncedStorage } from './useSyncedStorage';
import type { CheckSection } from './checkSections';

/**
 * نشاط المستخدمين على التقارير (للأقسام الأربعة) وطلبات التصحيح:
 * - REPORT_ACTIVITY_KEY: كل إضافة يدوية أو تعديل أو حذف ليوم (رفع الكشف نفسه في سجل التنبيهات).
 * - REPORT_THREADS_KEY: محادثة تصحيح لكل تنبيه — طلب من المدير، ردّ المستخدم بإكمال الإجراء، ثم إغلاق أو إعادة فتح.
 * السجلّان إضافة فقط (لا تعديل ولا حذف إلا لمدير النظام)، فيبقيان أثرًا كاملًا لكل إجراء.
 */
export const REPORT_ACTIVITY_KEY = 'sahara_report_activity_v1';
export const REPORT_THREADS_KEY = 'sahara_report_threads_v1';

export interface FieldChange { field: string; from: number | null; to: number | null }

export interface ReportActivity {
  id: string;
  at: number;
  by: string;
  byUser: string;
  section: CheckSection;
  action: 'create' | 'edit' | 'delete';
  /** تاريخ اليوم المتأثر YYYY/MM/DD */
  date: string;
  changes?: FieldChange[];
}

export type ThreadKind = 'request' | 'reply' | 'close' | 'reopen';
export interface ThreadMessage {
  id: string;
  alertId: string;
  at: number;
  by: string;
  byUser: string;
  kind: ThreadKind;
  text: string;
  /** طلب التصحيح: اسم مستخدم المطلوب منه */
  to?: string;
}
/** none: بلا طلب — waiting_user: بانتظار المستخدم — waiting_admin: ردّ المستخدم بانتظار المدير — closed: مغلق */
export type ThreadStatus = 'none' | 'waiting_user' | 'waiting_admin' | 'closed';

const day = (d: string) => (d || '').trim().split(' ')[0].replace(/-/g, '/');
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const who = () => { const p = getProfile(); return { by: p?.name || '', byUser: p?.username || '' }; };
const read = <T,>(key: string): T[] => {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const append = <T,>(key: string, item: T) => {
  try {
    localStorage.setItem(key, JSON.stringify([item, ...read<T>(key)]));
    notifySyncedStorage(key);
  } catch { /* السجل لا يجب أن يُفشل العملية */ }
};

/** الحقول الرقمية التي تغيّرت بين نسختين من يوم (المستوى الأول فقط؛ بدون المعرّفات والأوقات) */
const IGNORED = new Set(['id', 'savedAt', 'createdAt', 'avgDaily', 'totalDeductions', 'averageCost']);
export const recordChanges = (before: object | undefined, after: object): FieldChange[] => {
  const a = (before || {}) as Record<string, unknown>, b = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: FieldChange[] = [];
  for (const k of keys) {
    if (IGNORED.has(k)) continue;
    const x = a[k], y = b[k];
    const isNum = (v: unknown) => typeof v === 'number' || v === null || v === undefined;
    if (!isNum(x) || !isNum(y) || (typeof x !== 'number' && typeof y !== 'number')) continue;
    const from = typeof x === 'number' ? x : null, to = typeof y === 'number' ? y : null;
    if (Math.round((from ?? 0) * 100) !== Math.round((to ?? 0) * 100) || (from === null) !== (to === null)) out.push({ field: k, from, to });
  }
  return out.slice(0, 12);
};

export const logActivity = (section: CheckSection, action: ReportActivity['action'], date: string, changes?: FieldChange[]) => {
  // تعديل بلا تغيير في الأرقام لا يُسجَّل
  if (action === 'edit' && changes && !changes.length) return;
  append<ReportActivity>(REPORT_ACTIVITY_KEY, { id: uid('act'), at: Date.now(), ...who(), section, action, date: day(date), changes });
};

export const readThreads = () => read<ThreadMessage>(REPORT_THREADS_KEY);
export const postThread = (alertId: string, kind: ThreadKind, text: string, to?: string) =>
  append<ThreadMessage>(REPORT_THREADS_KEY, { id: uid('thr'), alertId, at: Date.now(), ...who(), kind, text: text.trim().slice(0, 1000), to });

/** حالة محادثة تنبيه من آخر رسالة فيها */
export const threadStatus = (msgs: ThreadMessage[]): ThreadStatus => {
  const last = [...msgs].sort((x, y) => x.at - y.at).pop();
  if (!last) return 'none';
  return last.kind === 'reply' ? 'waiting_admin' : last.kind === 'close' ? 'closed' : 'waiting_user';
};
/** المطلوب منه التصحيح (آخر طلب أو إعادة فتح) */
export const threadAssignee = (msgs: ThreadMessage[]) =>
  [...msgs].sort((x, y) => x.at - y.at).filter(m => m.kind === 'request' || m.kind === 'reopen').pop()?.to;
