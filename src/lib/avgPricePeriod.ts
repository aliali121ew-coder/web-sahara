import type { InboundDelivery } from '../types';
import { deliveryDay } from './inboundPrice';
import { deliverySupplier, supplierKey } from './archiveSuppliers';
import { useSyncedStorage } from './useSyncedStorage';

/**
 * فترة احتساب «متوسط السعر» لكل شركة: تُختار من صفحة الوارد، وتُزامَن مع كل الأجهزة،
 * ويُحسب منها متوسط السعر في الرئيسية. بلا فترة (null) = كل الوارد كما كان.
 * الحدّان شاملان، وأي حدّ فارغ يعني بلا حدّ من تلك الجهة.
 */
export interface AvgPricePeriod {
  from: string;
  to: string;
}

export type AvgPriceCompany = 'sahara' | 'etihad';

export const AVG_PERIOD_KEYS: Record<AvgPriceCompany, string> = {
  sahara: 'sahara_avg_price_period_v1',
  etihad: 'etihad_avg_price_period_v1',
};

const slash = (d: string) => (d || '').trim().split(' ')[0].replace(/-/g, '/');

/** الشحنات داخل الفترة (بلا فترة = كلها) */
export const inAvgPeriod = (deliveries: InboundDelivery[], period: AvgPricePeriod | null): InboundDelivery[] => {
  if (!period || (!period.from && !period.to)) return deliveries;
  const from = slash(period.from), to = slash(period.to);
  return deliveries.filter(d => {
    const day = deliveryDay(d);
    return (!from || day >= from) && (!to || day <= to);
  });
};

const qtyOf = (d: InboundDelivery) => d.receivedQuantity ?? d.volumeLiters ?? 0;
const costOf = (d: InboundDelivery) =>
  d.productCost ?? d.totalCostIqd ?? qtyOf(d) * (d.productPrice ?? d.pricePerLiter ?? 0);

export interface PeriodSupplierShare {
  name: string;
  qty: number;
  /** حصة المجهز من كمية الفترة (0..100) */
  share: number;
  /** متوسط سعر المجهز في الفترة */
  price: number;
}

/** ملخص الفترة لنافذة الاختيار: عدد الشحنات والمجهزين، وأثر كل مجهز (الأكبر كمية أولًا) */
export const periodBreakdown = (deliveries: InboundDelivery[]) => {
  const rows = deliveries.filter(d => d.status !== 'ملغي' && qtyOf(d) > 0);
  const total = rows.reduce((a, d) => a + qtyOf(d), 0);
  const bySupplier = new Map<string, { name: string; qty: number; cost: number }>();
  for (const d of rows) {
    const name = deliverySupplier(d) || '—';
    const k = supplierKey(name) || name;
    const v = bySupplier.get(k) ?? { name, qty: 0, cost: 0 };
    v.qty += qtyOf(d);
    v.cost += costOf(d);
    bySupplier.set(k, v);
  }
  const suppliers: PeriodSupplierShare[] = [...bySupplier.values()]
    .map(v => ({ name: v.name, qty: v.qty, share: total > 0 ? (v.qty / total) * 100 : 0, price: v.qty > 0 ? v.cost / v.qty : 0 }))
    .sort((a, b) => b.qty - a.qty);
  return { shipments: rows.length, suppliers };
};

/** فترة الشركة المحفوظة مع دالة تغييرها */
export const useAvgPricePeriod = (company: AvgPriceCompany) =>
  useSyncedStorage<AvgPricePeriod | null>(AVG_PERIOD_KEYS[company], null);
