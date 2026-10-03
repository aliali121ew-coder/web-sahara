/** بيانات صفحة المشتريات: الأقسام، صف المشتريات، ودوال الأسعار والتواريخ (مشتركة بين الجدول والرسم البياني) */

/** أقسام المشتريات (كروت منزلقة): كل قسم = جهة مستلمة + منتج */
export type CategoryKey = 'station-gas' | 'sahara-gas' | 'etihad-gas' | 'sahara-black-oil' | 'etihad-black-oil' | 'sahara-petrol';

/** color: لون القسم في الرسم البياني (ثابت للقسم مهما تغيّر عدد الأقسام الظاهرة) */
export const CATEGORIES: { key: CategoryKey; title: string; color: string }[] = [
  { key: 'station-gas', title: 'كاز محطات', color: '#0891b2' },
  { key: 'sahara-gas', title: 'كاز الصحاري', color: '#4f46e5' },
  { key: 'etihad-gas', title: 'كاز الاتحاد', color: '#10b981' },
  { key: 'sahara-black-oil', title: 'نفط أسود الصحاري', color: '#8b5cf6' },
  { key: 'etihad-black-oil', title: 'نفط أسود الاتحاد', color: '#f43f5e' },
  { key: 'sahara-petrol', title: 'بنزين الصحاري', color: '#f59e0b' }
];

/** "عرض الكل": يدمج كل الأقسام في الجدول والرسم البياني */
export type CategoryFilter = CategoryKey | 'all';

/** صف مشتريات: كل (تاريخ + قسم + منتج) في صف واحد */
export interface PurchaseRow {
  key: string;
  cat: CategoryKey;
  date: string; // YYYY/MM/DD
  company: string;
  product: string;
  inbound: number;
  /** عدد الشحنات في هذا اليوم */
  count: number;
  /** مجموع (الكمية × السعر) وكمية الشحنات المسعّرة، لحساب متوسط السعر الموزون */
  pricedCost: number;
  pricedQty: number;
}

export const avgPrice = (r: { pricedCost: number; pricedQty: number }) => (r.pricedQty > 0 ? r.pricedCost / r.pricedQty : 0);
export const fmtPrice = (v: number) => (v > 0 ? (Math.round(v * 10) / 10).toLocaleString('en-US') : '—');

// ── تواريخ بصيغة YYYY/MM/DD ──
export const parseDate = (d: string) => new Date(d.replace(/\//g, '-') + 'T12:00:00');
export const fmtDate = (d: Date) =>
  `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d: string, n: number) => {
  const x = parseDate(d);
  x.setDate(x.getDate() + n);
  return fmtDate(x);
};
export const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
/** بداية الأسبوع (السبت) لتاريخ معيّن */
export const weekStart = (d: string) => {
  const x = parseDate(d);
  x.setDate(x.getDate() - ((x.getDay() + 1) % 7));
  return fmtDate(x);
};
/** آخر يوم في الشهر */
export const monthEnd = (d: string) => {
  const x = parseDate(d.slice(0, 8) + '01');
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  return fmtDate(x);
};
