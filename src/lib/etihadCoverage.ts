import { etihadSalesOf, type EtihadBalanceRecord } from '../types/finance';

const toDate = (d: string) => new Date(d.replace(/\//g, '-') + 'T12:00:00');
const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '/');

/**
 * «يؤمن لغاية» لشركة الاتحاد، بنفس حساب الواجهة الرئيسية: الرصيد الحالي لآخر يوم ÷ متوسط الصرف الأسبوعي
 * (المصروف + كل المبيعات، على الأيام التي فيها صرف ضمن 7 أيام تنتهي بآخر يوم مسجّل).
 * تاريخ النفاد = تاريخ آخر يوم + عدد الأيام.
 */
export const etihadCoverage = (records: EtihadBalanceRecord[]): { days: number; date: string } => {
  const latest = [...records].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) return { days: 0, date: '' };
  const week = new Set(Array.from({ length: 7 }, (_, i) => {
    const d = toDate(latest.date);
    d.setDate(d.getDate() - i);
    return fmt(d);
  }));
  const outflow = new Map<string, number>();
  for (const r of records) {
    if (week.has(r.date)) outflow.set(r.date, (outflow.get(r.date) || 0) + (r.etihadExpense || 0) + etihadSalesOf(r));
  }
  const days = [...outflow.values()].filter(v => v > 0);
  const avg = days.length ? days.reduce((a, v) => a + v, 0) / days.length : 0;
  if (avg <= 0) return { days: 0, date: '' };
  const count = Math.floor((latest.currentBalance || 0) / avg);
  const end = toDate(latest.date);
  end.setDate(end.getDate() + count);
  return { days: count, date: count > 0 ? fmt(end) : '' };
};
