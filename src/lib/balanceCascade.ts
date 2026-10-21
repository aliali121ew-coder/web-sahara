import { etihadSalesOf, type EtihadBalanceRecord } from '../types/finance';
import type { SaharaLedgerRecord } from './saharaLedger';

/**
 * تسلسل الرصيد بعد تعديل يوم: الرصيد السابق لكل يوم لاحق = الرصيد الحالي لليوم الذي قبله،
 * فيتغير رصيد كل الأيام اللاحقة من يوم إلى يوم. الوارد والاستهلاك والمبيعات تبقى كما أُدخلت.
 */
const day = (d: string) => (d || '').trim().split(' ')[0].replace(/-/g, '/');

/** عدد الأيام بعد تاريخ معيّن (لتنبيه المستخدم قبل الحفظ) */
export const laterDaysCount = (dates: string[], from: string) => dates.filter(d => day(d) > day(from)).length;

/** الاتحاد: يعيد حساب الرصيد السابق والحالي لكل يوم بعد fromDate */
export const cascadeEtihadBalances = (records: EtihadBalanceRecord[], fromDate: string): EtihadBalanceRecord[] => {
  const from = day(fromDate);
  const asc = [...records].sort((a, b) => day(a.date).localeCompare(day(b.date)));
  const next = new Map<string, EtihadBalanceRecord>();
  let last: number | null = null;
  for (const r of asc) {
    if (day(r.date) <= from || last === null) {
      last = r.currentBalance;
      continue;
    }
    const totalDeductions = (r.etihadExpense || 0) + etihadSalesOf(r);
    const currentBalance: number = last + (r.purchases || 0) - totalDeductions;
    if (r.previousBalance !== last || r.currentBalance !== currentBalance || r.totalDeductions !== totalDeductions) {
      next.set(r.id, { ...r, previousBalance: last, totalDeductions, currentBalance });
    }
    last = currentBalance;
  }
  return next.size ? records.map(r => next.get(r.id) ?? r) : records;
};

/**
 * الصحاري: الرصيد محسوب بالتسلسل أصلًا، لكن الرصيد السابق اليدوي والرصيد الحالي من ملف الكشف يقطعانه؛
 * بعد تعديل يوم يُزالان من الأيام اللاحقة حتى تبقى السلسلة متصلة
 */
export const cascadeSaharaRecords = (records: SaharaLedgerRecord[], fromDate: string): SaharaLedgerRecord[] => {
  const from = day(fromDate);
  return records.map(r =>
    day(r.date) > from && (r.previousOverride != null || r.currentOverride != null)
      ? { ...r, previousOverride: null, currentOverride: null }
      : r
  );
};
