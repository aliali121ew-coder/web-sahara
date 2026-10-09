import { getBusinessDate } from './utils';
import type { BlackOilSiteReport } from './blackOilReportFile';
import type { BlackOilRecord, BlackOilSiteEntry } from './blackOilLedger';

/**
 * منطق نافذة "تسجيل يوم" للنفط الأسود خارج الواجهة: يوم جديد، التعبئة من التقرير اليومي،
 * الحسابات (السابقة، الحالية، النسبة)، بناء السجل، وشروط الحفظ.
 * تستخدمه النافذة والرفع المتعدد معًا فتكون النتيجة واحدة.
 */

/** كتابة الأرقام بفوارز أثناء الإدخال */
export const withCommas = (v: string) => {
  const digits = v.replace(/[^\d]/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
export const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));
/** رقم → نص إدخال بفوارز (فارغ إن لم يوجد) */
export const fmtInput = (n: number | null | undefined) => (n === null || n === undefined ? '' : Number(n).toLocaleString('en-US'));
const toInputDate = (d: string) => d.replace(/\//g, '-');
export const nextDay = (d: string) => {
  const x = new Date(toInputDate(d) + 'T12:00:00');
  x.setDate(x.getDate() + 1);
  return getBusinessDate(x);
};

export interface SiteForm { inbound: string; consumption: string; actual: string; empty: string }
export const emptySiteForm = (): SiteForm => ({ inbound: '', consumption: '', actual: '', empty: '' });

export interface BlackOilForm {
  id: string | null;
  date: string;
  previous: string;
  editPrevious: boolean; // false = الكمية السابقة تلقائية من اليوم الذي قبله
  inbound: string;
  consumption: string;
  avgDaily: string;
  /** سعر اللتر (د.ع) */
  price: string;
  /** قيم مواقع التخزين (نصوص الإدخال) */
  sites: Record<string, SiteForm>;
}

type Day = { id: string; date: string; current: number; price?: number | null };
type Site = { key: string };

/** تسجيل جديد: يوم جديد، حالية آخر يوم تصبح "سابقة"، والوارد والاستهلاك فارغان */
export const newBlackOilForm = (computed: Day[], avgDaily: number, sites: Site[]): BlackOilForm => {
  const today = getBusinessDate();
  const last = computed[computed.length - 1];
  const date = last && last.date >= today ? nextDay(last.date) : today;
  return {
    id: null, date, previous: '', editPrevious: !last, inbound: '', consumption: '',
    avgDaily: withCommas(String(avgDaily)), price: fmtInput(last?.price ?? null),
    sites: Object.fromEntries(sites.map(x => [x.key, emptySiteForm()]))
  };
};

/** تعبئة النموذج من التقرير المقروء: قيم المواقع، وتاريخ التقرير للتسجيل الجديد فقط */
export const applyBlackOilReport = (form: BlackOilForm, report: Record<string, BlackOilSiteReport>, date: string | null): BlackOilForm => {
  const next = { ...form.sites };
  for (const [key, v] of Object.entries(report)) {
    next[key] = { inbound: fmtInput(v.inbound), consumption: fmtInput(v.consumption), actual: fmtInput(v.actual), empty: fmtInput(v.empty) };
  }
  return { ...form, sites: next, date: !form.id && date ? date : form.date };
};

/** الحسابات المعروضة في النافذة والمحفوظة مع السجل */
export const blackOilDerived = (form: BlackOilForm, computed: Day[], sites: Site[]) => {
  const hasSites = sites.length > 0;
  // الكمية السابقة التلقائية = حالية آخر يوم قبل تاريخ النموذج
  const autoPrevious = computed.filter(r => r.date < form.date && r.id !== form.id).pop()?.current ?? null;
  const siteVals = hasSites
    ? sites.map(x => {
        const f = form.sites[x.key] ?? emptySiteForm();
        return { key: x.key, inbound: num(f.inbound) ?? 0, consumption: num(f.consumption) ?? 0, actual: num(f.actual), empty: num(f.empty) };
      })
    : [];
  const sitesAllActual = siteVals.length > 0 && siteVals.every(v => v.actual !== null);
  const fInbound = hasSites ? siteVals.reduce((a, v) => a + v.inbound, 0) : num(form.inbound) ?? 0;
  const fConsumption = hasSites ? siteVals.reduce((a, v) => a + v.consumption, 0) : num(form.consumption);
  const fAvg = num(form.avgDaily);
  const sitesActualTotal = sitesAllActual ? siteVals.reduce((a, v) => a + (v.actual as number), 0) : null;
  // بلا يوم سابق: الكمية السابقة تُشتق من التقرير = الرصيد الحقيقي − الوارد + الاستهلاك
  const derivedPrevious = sitesActualTotal !== null && fConsumption !== null ? sitesActualTotal - fInbound + fConsumption : null;
  const fPrevious = form.editPrevious
    ? num(form.previous) ?? (autoPrevious === null ? derivedPrevious : null)
    : autoPrevious ?? derivedPrevious;
  const fCurrent = sitesActualTotal !== null
    ? sitesActualTotal
    : fPrevious !== null && fConsumption !== null ? fPrevious + fInbound - fConsumption : null;
  const fAvailable = (fPrevious ?? 0) + fInbound;
  const fPct = fConsumption !== null && fAvailable > 0 ? (fConsumption / fAvailable) * 100 : null;
  return { hasSites, autoPrevious, siteVals, fInbound, fConsumption, fAvg, derivedPrevious, fPrevious, fCurrent, fPct };
};
export type BlackOilDerived = ReturnType<typeof blackOilDerived>;

export type BlackOilSaveBlocker = 'noPrevious' | 'noConsumption' | 'noAverage' | 'dateTaken' | 'negative';

/** ما يمنع الحفظ (فارغ = يمكن الحفظ) — نفس شروط زر الحفظ في النافذة */
export const blackOilSaveBlockers = (form: BlackOilForm, d: BlackOilDerived, records: { id: string; date: string }[]): BlackOilSaveBlocker[] => {
  const out: BlackOilSaveBlocker[] = [];
  if (d.fPrevious === null) out.push('noPrevious');
  if (d.fConsumption === null) out.push('noConsumption');
  if (!d.fAvg || d.fAvg <= 0) out.push('noAverage');
  if (records.some(r => r.date === form.date && r.id !== form.id)) out.push('dateTaken');
  if ((d.fCurrent ?? 0) < 0) out.push('negative');
  return out;
};

/**
 * السجل الذي يُحفظ. tanksSnapshot: مناسيب الخزانات الحالية (تُحفظ مع التسجيل الجديد،
 * والتعديل يحتفظ بالصورة الأصلية).
 */
export const blackOilRecord = (form: BlackOilForm, d: BlackOilDerived, old: BlackOilRecord | undefined, tanksSnapshot: () => Record<string, number>): BlackOilRecord => ({
  tanksSnapshot: old?.tanksSnapshot ?? tanksSnapshot(),
  savedAt: old?.savedAt ?? new Date().toISOString(),
  id: form.id ?? `bo-${Date.now()}`,
  date: form.date,
  inbound: d.fInbound,
  consumption: d.fConsumption ?? 0,
  avgDaily: d.fAvg ?? 0,
  price: num(form.price) || null,
  previousOverride: form.editPrevious && d.fPrevious !== d.autoPrevious ? d.fPrevious : null,
  ...(d.hasSites
    ? { sites: Object.fromEntries(d.siteVals.map(v => [v.key, { inbound: v.inbound, consumption: v.consumption, actual: v.actual, empty: v.empty } as BlackOilSiteEntry])) }
    : {})
});
