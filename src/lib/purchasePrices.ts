import { useMemo } from 'react';
import { useFuelStore } from '../context/FuelDataContext';
import type { FuelProductMetric, InboundDelivery } from '../types';
import { usePetrolLedger } from './petrolLedger';
import { usePriceOverrides } from './priceOverrides';
import { useManualFuelCards } from './manualFuelCard';
import { useBlackOilLedger, type ComputedBlackOilRecord } from './blackOilLedger';
import { logPrice } from './priceLog';
import type { PriceDay } from '../components/dashboard/PriceEditPopover';

/**
 * أسعار كروت المشتريات (من الوارد أو التعديل اليدوي) في مكان واحد: تستخدمها كروت الرئيسية وسجل الأسعار
 * (للمقارنة)، وكل حفظ أو إرجاع للسعر التلقائي يُضاف لسجل الأسعار.
 */
/** مصدر سعر تلقائي من الوارد: أيام مسعّرة (الأحدث أولًا) + توقيع يتغيّر مع كل عملية وارد جديدة */
export interface InboundPriceSource {
  days: PriceDay[];
  sig: string;
}
const round1 = (v: number) => Math.round(v * 10) / 10;
const pctChange = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : 0);

/** أسعار الوارد اليومية (متوسط موزون بالكمية لكل يوم) من شحنات كشف الوارد */
const fromDeliveries = (list: InboundDelivery[]): InboundPriceSource => {
  const priced = list.filter(d => d.status !== 'ملغي' && Number(d.productPrice ?? d.pricePerLiter) > 0 && Number(d.receivedQuantity ?? d.volumeLiters) > 0);
  const byDay = new Map<string, { c: number; q: number }>();
  let total = 0;
  for (const d of priced) {
    const date = (d.receiptUnloadDate || d.date || '').slice(0, 10).replace(/-/g, '/');
    const q = Number(d.receivedQuantity ?? d.volumeLiters);
    const p = Number(d.productPrice ?? d.pricePerLiter);
    const v = byDay.get(date) ?? { c: 0, q: 0 };
    v.c += q * p; v.q += q; total += q;
    byDay.set(date, v);
  }
  const days = [...byDay].sort((a, b) => b[0].localeCompare(a[0])).map(([date, v]) => ({ date, price: round1(v.c / v.q), qty: v.q }));
  return { days, sig: `${priced.length}|${days[0]?.date ?? ''}|${total}` };
};

/** كارت يدوي بالكامل: غير مرتبط بالوارد، يُدخل سعره وكميته وتاريخه للعرض فقط */
export const MANUAL_ONLY_ID = 'fuel-muhassan';

const companyOf = (m: FuelProductMetric): 'sahara' | 'etihad' => (m.company === 'شركة الاتحاد' ? 'etihad' : 'sahara');

export const usePurchasePrices = () => {
  const { fuelMetrics, saharaDeliveries, etihadDeliveries } = useFuelStore();
  const { publishedComputed: petrolDays } = usePetrolLedger();
  const { computed: saharaBlackOilDays } = useBlackOilLedger('sahara');
  const { computed: etihadBlackOilDays } = useBlackOilLedger('etihad');
  const { overrides, setOverride, clearOverride } = usePriceOverrides();
  const { cards: manualCards, saveCard } = useManualFuelCards();

  // ── السعر التلقائي من الوارد: كاز الصحاري وكاز الاتحاد من كشف الوارد، والبنزين من سجل البنزين ──
  const inboundSources = useMemo<Record<string, InboundPriceSource>>(() => {
    const petrol = petrolDays.filter(d => d.inboundQty > 0 && d.inboundPrice > 0);
    const petrolDaysDesc = [...petrol].reverse().map(d => ({ date: d.date, price: d.inboundPrice, qty: d.inboundQty }));
    // النفط الأسود: سعر اللتر المسجّل لكل يوم في السجل اليومي
    const fromBlackOil = (list: ComputedBlackOilRecord[]): InboundPriceSource => {
      const priced = list.filter(d => d.inbound > 0 && (d.price ?? 0) > 0);
      const days = [...priced].reverse().map(d => ({ date: d.date, price: d.price as number, qty: d.inbound }));
      return { days, sig: `${priced.length}|${days[0]?.date ?? ''}|${priced.reduce((a, d) => a + d.inbound, 0)}` };
    };
    return {
      'fuel-4': fromBlackOil(saharaBlackOilDays),
      'fuel-5': fromBlackOil(etihadBlackOilDays),
      'fuel-2': fromDeliveries(saharaDeliveries),
      'fuel-3': fromDeliveries(etihadDeliveries),
      'fuel-1': { days: petrolDaysDesc, sig: `${petrol.length}|${petrolDaysDesc[0]?.date ?? ''}|${petrol.reduce((a, d) => a + d.inboundQty, 0)}` }
    };
  }, [saharaDeliveries, etihadDeliveries, petrolDays, saharaBlackOilDays, etihadBlackOilDays]);

  // Dynamic mapping helper to get live price & trend from the supplier prices table
  const getLinkedSupplierData = (metric: FuelProductMetric) => {
    // كاز محطات: قيم يدوية فقط (لا وارد ولا جدول موردين)
    if (metric.id === MANUAL_ONLY_ID) {
      const m = manualCards[metric.id];
      const price = m?.price ?? metric.priceIqd;
      const previous = m?.previousPrice ?? price;
      return {
        displayPrice: price, previousPrice: previous, trendPercent: pctChange(price, previous),
        priceUpdatedAt: m?.date || '—', volume: m?.volume ?? metric.volumeLiters,
        source: 'standalone' as const, auto: null, src: undefined, manual: null
      };
    }
    // بطاقات المشتريات تأخذ سعرها من الوارد أو التعديل اليدوي فقط؛ صفحة الموردين لا تؤثر عليها
    const displayPrice = metric.priceIqd;
    const previousPrice = metric.priceIqd;
    const trendPercent = metric.trendPercent;

    const src = inboundSources[metric.id];
    const auto = src?.days[0] ?? null;
    // مجموع الشراء = كمية آخر يوم وارد (وليس تراكميًا)
    const volume = auto?.qty ?? 0;
    const ov = overrides[metric.id];
    // السعر اليدوي يسري فقط ما دام لم يحدث وارد جديد بعده (توقيع الوارد لم يتغيّر)
    const manual = ov && (!src || ov.baseSig === src.sig) ? ov : null;
    if (manual) {
      const base = auto?.price ?? displayPrice;
      return {
        displayPrice: manual.price, previousPrice: base, trendPercent: pctChange(manual.price, base),
        priceUpdatedAt: auto?.date ?? manual.setAt.slice(0, 10).replace(/-/g, '/'), volume, source: 'manual' as const, auto, src, manual
      };
    }
    if (auto) {
      const prev = src!.days[1]?.price ?? auto.price;
      return {
        displayPrice: auto.price, previousPrice: prev, trendPercent: pctChange(auto.price, prev),
        priceUpdatedAt: auto.date, volume, source: 'auto' as const, auto, src, manual: null
      };
    }
    return { displayPrice, previousPrice, trendPercent, priceUpdatedAt: '—', volume, source: 'supplier' as const, auto: null, src, manual: null };
  };

  // ── عمليات الحفظ: تُنفَّذ ثم تُسجَّل في سجل الأسعار ──
  const log = (metric: FuelProductMetric, action: 'update' | 'reset', prevPrice: number, price: number) =>
    logPrice({ source: 'purchases', action, key: metric.id, name: metric.name, company: companyOf(metric), prevPrice, price });

  /** سعر يدوي لكارت مرتبط بالوارد */
  const savePrice = (metric: FuelProductMetric, price: number) => {
    const before = getLinkedSupplierData(metric);
    setOverride(metric.id, price, before.src?.sig ?? '');
    log(metric, 'update', before.displayPrice, price);
  };
  /** إلغاء السعر اليدوي والعودة لسعر الوارد */
  const resetPrice = (metric: FuelProductMetric) => {
    const before = getLinkedSupplierData(metric);
    clearOverride(metric.id);
    const auto = before.auto?.price ?? metric.priceIqd;
    log(metric, 'reset', before.displayPrice, auto);
  };
  /** الكارت اليدوي بالكامل (سعر + كمية + تاريخ) */
  const saveManual = (metric: FuelProductMetric, v: { price: number; volume: number; date: string }) => {
    const before = getLinkedSupplierData(metric);
    saveCard(metric.id, v, metric.priceIqd);
    if (v.price !== before.displayPrice) log(metric, 'update', before.displayPrice, v.price);
  };

  return { fuelMetrics, priceOf: getLinkedSupplierData, savePrice, resetPrice, saveManual };
};

export type PurchasePrice = ReturnType<ReturnType<typeof usePurchasePrices>['priceOf']>;
