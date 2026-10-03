import { InboundDelivery } from '../types';

/** تاريخ الشحنة بصيغة YYYY/MM/DD للمقارنة */
export const deliveryDay = (d: InboundDelivery) =>
  (d.receiptUnloadDate || d.date || '').split(' ')[0].replace(/-/g, '/');

const qtyOf = (d: InboundDelivery) => d.receivedQuantity ?? d.volumeLiters ?? 0;
const costOf = (d: InboundDelivery) =>
  d.productCost ?? d.totalCostIqd ?? qtyOf(d) * (d.productPrice ?? d.pricePerLiter ?? 0);

export interface InboundPriceStats {
  totalQty: number;
  totalCost: number;
  /** متوسط السعر = التكلفة الكلية ÷ الكمية الكلية */
  avgPrice: number;
  /** أثر آخر وارد (كل شحنات أحدث يوم عمل) على المتوسط — null إن لم تكفِ البيانات */
  change: {
    prevAvg: number;
    lastDay: string;
    lastQty: number;
    lastCount: number;
    /** معدل سعر آخر وارد = تكلفته ÷ كميته */
    lastPrice: number;
    /** نسبة تغير المتوسط بعد آخر وارد (موجبة = ارتفاع) */
    pct: number;
  } | null;
}

export interface DailyBuy {
  day: string;
  qty: number;
  cost: number;
  /** معدل سعر شراء اليوم = تكلفته ÷ كميته */
  price: number;
}

/**
 * شراء اليوم = آخر يوم وارد، والسابق = يوم الوارد الذي قبله.
 * نسبة التغير: معدل اليومين معًا (تكلفتهما ÷ كميتهما) مقارنة بسعر اليوم السابق.
 */
export const computeDailyBuys = (deliveries: InboundDelivery[]) => {
  const byDay = new Map<string, { qty: number; cost: number }>();
  deliveries.forEach(d => {
    const day = deliveryDay(d);
    const acc = byDay.get(day) ?? { qty: 0, cost: 0 };
    byDay.set(day, { qty: acc.qty + qtyOf(d), cost: acc.cost + costOf(d) });
  });
  const days = [...byDay.keys()].filter(k => byDay.get(k)!.qty > 0).sort().slice(-2);
  const [prev, today] = days.length === 2 ? days : [undefined, days[0]];
  const toBuy = (day?: string): DailyBuy | null => {
    if (!day) return null;
    const { qty, cost } = byDay.get(day)!;
    return { day, qty, cost, price: cost / qty };
  };
  const todayBuy = toBuy(today);
  const prevBuy = toBuy(prev);
  const twoDayAvg = todayBuy && prevBuy ? (todayBuy.cost + prevBuy.cost) / (todayBuy.qty + prevBuy.qty) : null;
  const pct = twoDayAvg !== null && prevBuy && prevBuy.price > 0 ? ((twoDayAvg - prevBuy.price) / prevBuy.price) * 100 : null;
  return { today: todayBuy, previous: prevBuy, twoDayAvg, pct };
};

/** شحنات شركة صحاري كربلاء فقط (نطاق صفحة وارد الصحاري) */
export const ownSaharaDeliveries = (deliveries: InboundDelivery[]) =>
  deliveries.filter(d => (d.company || 'صحاري كربلاء') === 'صحاري كربلاء');

export const computeInboundPriceStats =(deliveries: InboundDelivery[]): InboundPriceStats => {
  const totalQty = deliveries.reduce((a, d) => a + qtyOf(d), 0);
  const totalCost = deliveries.reduce((a, d) => a + costOf(d), 0);
  const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;

  const change = (() => {
    if (!deliveries.length) return null;
    const lastDay = deliveries.reduce((m, d) => (deliveryDay(d) > m ? deliveryDay(d) : m), '');
    const lastBatch = deliveries.filter((d) => deliveryDay(d) === lastDay);
    const lastQty = lastBatch.reduce((a, d) => a + qtyOf(d), 0);
    const lastCost = lastBatch.reduce((a, d) => a + costOf(d), 0);
    const prevQty = totalQty - lastQty;
    if (prevQty <= 0 || lastQty <= 0) return null;
    const prevAvg = (totalCost - lastCost) / prevQty;
    if (prevAvg <= 0) return null;
    return {
      prevAvg,
      lastDay,
      lastQty,
      lastCount: lastBatch.length,
      lastPrice: lastCost / lastQty,
      pct: ((avgPrice - prevAvg) / prevAvg) * 100,
    };
  })();

  return { totalQty, totalCost, avgPrice, change };
};
