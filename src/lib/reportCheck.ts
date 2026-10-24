import { getProfile } from './session';
import { notifySyncedStorage } from './useSyncedStorage';
import type { BlackOilSiteReport } from './blackOilReportFile';
import type { ComputedBlackOilRecord } from './blackOilLedger';

/**
 * التحقق من صحة التقرير اليومي (اتصال السلسلة): "المدور السابق" في كشف اليوم الجديد
 * يجب أن يساوي "الرصيد الحالي" لليوم الذي قبله في المنظومة.
 * الأقسام: كاز الصحاري، كاز الاتحاد، البنزين، والنفط الأسود (للشركتين).
 * النفط الأسود بلا "مدور سابق" في تقريره: يُشتق لكل موقف = الرصيد الحقيقي − الوارد + الاستهلاك.
 * كل تحقق عند الحفظ يُسجَّل في "سجل التنبيهات" (REPORT_ALERTS_KEY) — المطابق والمختلف.
 */
import type { CheckSection } from './checkSections';
export { CHECK_SECTION_PERM, type CheckSection } from './checkSections';

/** match: مطابق — mismatch: مختلف — noFileValue: الكشف بلا مدور سابق — noPrevDay: لا يوم قبله للمقارنة */
export type CheckStatus = 'match' | 'mismatch' | 'noFileValue' | 'noPrevDay';

export interface CheckPart { key: string; file: number; system: number; diff: number }

export interface ContinuityCheck {
  section: CheckSection;
  date: string;
  /** اليوم السابق في المنظومة الذي قورن به */
  prevDate: string | null;
  status: CheckStatus;
  /** المدور السابق في الكشف */
  file: number | null;
  /** الرصيد الحالي لليوم السابق في المنظومة */
  system: number | null;
  /** الفرق = الكشف − المنظومة (موجب: الكشف أكبر) */
  diff: number;
  /** النفط الأسود: تفصيل كل موقف */
  parts?: CheckPart[];
}

/** فرق أقل من لتر واحد = مطابق (تقريب الأرقام في الملفات) */
const TOLERANCE = 1;
const day = (d: string) => (d || '').trim().split(' ')[0].replace(/-/g, '/');

interface Day { id?: string; date: string; current: number }

const previousDay = (history: Day[], date: string, excludeId?: string | null) =>
  history.filter(h => day(h.date) < day(date) && h.id !== excludeId).sort((a, b) => day(a.date).localeCompare(day(b.date))).pop();

/** كاز الصحاري والاتحاد والبنزين: مدور الكشف مقابل الرصيد الحالي لليوم السابق */
export const continuityCheck = (section: CheckSection, date: string, filePrevious: number | null | undefined, history: Day[], excludeId?: string | null): ContinuityCheck => {
  const prev = previousDay(history, date, excludeId);
  const base = { section, date: day(date), prevDate: prev ? day(prev.date) : null, system: prev?.current ?? null };
  if (!prev) return { ...base, status: 'noPrevDay', file: filePrevious ?? null, diff: 0 };
  if (filePrevious === null || filePrevious === undefined) return { ...base, status: 'noFileValue', file: null, diff: 0 };
  const diff = Math.round(filePrevious - prev.current);
  return { ...base, status: Math.abs(diff) < TOLERANCE ? 'match' : 'mismatch', file: filePrevious, diff };
};

/** النفط الأسود: لكل موقف في التقرير، المدور المشتق مقابل حالية نفس الموقف في اليوم السابق */
export const blackOilContinuity = (
  company: 'sahara' | 'etihad', date: string, report: Record<string, BlackOilSiteReport>, computed: ComputedBlackOilRecord[], excludeId?: string | null,
): ContinuityCheck => {
  const section: CheckSection = company === 'sahara' ? 'black-oil-sahara' : 'black-oil-etihad';
  const prev = computed.filter(r => day(r.date) < day(date) && r.id !== excludeId).pop();
  const base = { section, date: day(date), prevDate: prev ? day(prev.date) : null };
  if (!prev) return { ...base, status: 'noPrevDay', file: null, system: null, diff: 0 };
  const parts: CheckPart[] = [];
  for (const [key, s] of Object.entries(report)) {
    const row = prev.siteRows.find(x => x.key === key);
    if (s.actual === null || !row) continue;
    const file = s.actual - (s.inbound ?? 0) + (s.consumption ?? 0);
    parts.push({ key, file, system: row.current, diff: Math.round(file - row.current) });
  }
  if (!parts.length) return { ...base, status: 'noFileValue', file: null, system: prev.current, diff: 0 };
  const file = parts.reduce((a, p) => a + p.file, 0);
  const system = parts.reduce((a, p) => a + p.system, 0);
  return { ...base, status: parts.some(p => Math.abs(p.diff) >= TOLERANCE) ? 'mismatch' : 'match', file, system, diff: Math.round(file - system), parts };
};

// ───── سجل التنبيهات ─────
export const REPORT_ALERTS_KEY = 'sahara_report_alerts_v1';

export interface ReportAlert extends ContinuityCheck {
  id: string;
  /** وقت التحقق (ms) */
  at: number;
  fileName: string;
  /** window: من نافذة القسم — bulk: من الرفع المتعدد */
  source: 'window' | 'bulk';
  by: string;
  byUser: string;
  /** تمت مراجعته (تعليم كمقروء) */
  read?: boolean;
}

export const readReportAlerts = (): ReportAlert[] => {
  try { const v = JSON.parse(localStorage.getItem(REPORT_ALERTS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** تسجيل نتيجة تحقق عند حفظ يوم من كشف (لا يُسجَّل يوم بلا يوم سابق للمقارنة) */
export const logReportAlert = (check: ContinuityCheck, meta: { fileName: string; source: 'window' | 'bulk' }) => {
  if (check.status === 'noPrevDay') return;
  const p = getProfile();
  const alert: ReportAlert = {
    ...check,
    id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    fileName: meta.fileName,
    source: meta.source,
    by: p?.name || '',
    byUser: p?.username || '',
    // المطابق لا يحتاج مراجعة
    read: check.status === 'match' ? true : undefined,
  };
  try {
    localStorage.setItem(REPORT_ALERTS_KEY, JSON.stringify([alert, ...readReportAlerts()]));
    notifySyncedStorage(REPORT_ALERTS_KEY);
  } catch { /* السجل لا يجب أن يُفشل الحفظ */ }
};

/** تعليم تنبيهات كمراجَعة */
export const markAlertsReviewed = (ids: string[]) => {
  const set = new Set(ids);
  localStorage.setItem(REPORT_ALERTS_KEY, JSON.stringify(readReportAlerts().map(a => (set.has(a.id) ? { ...a, read: true } : a))));
  notifySyncedStorage(REPORT_ALERTS_KEY);
};

/** سجلات رصيد الاتحاد كأيام (للتحقق) */
export const etihadHistory = (): Day[] => {
  try {
    const v = JSON.parse(localStorage.getItem('sahara_etihad_balance_records_v2') || '[]') as { id: string; date: string; currentBalance: number }[];
    return Array.isArray(v) ? v.map(r => ({ id: r.id, date: r.date, current: r.currentBalance })) : [];
  } catch { return []; }
};
