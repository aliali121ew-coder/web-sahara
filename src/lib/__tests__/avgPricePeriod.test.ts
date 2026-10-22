import { describe, expect, it } from 'vitest';
import type { InboundDelivery } from '../../types';
import { computeInboundPriceStats } from '../inboundPrice';
import { inAvgPeriod, periodBreakdown } from '../avgPricePeriod';

const d = (id: string, supplierName: string, date: string, qty: number, price: number, status = 'مكتمل') =>
  ({ id, supplierName, date, receivedQuantity: qty, productPrice: price, status }) as unknown as InboundDelivery;

const list = [
  d('1', 'عراق الطاقة', '2026/09/28', 10000, 900),
  d('2', 'عراق الطاقة', '2026-10-05', 30000, 930),
  d('3', 'يوسف مدخل', '2026/10/10', 10000, 880),
  d('4', 'محطة أرض الخير', '2026/10/20', 0, 450),
];

describe('فترة احتساب متوسط السعر', () => {
  it('بلا فترة = كل الوارد، والحدّان شاملان (والتاريخ بشرطة يُقارن مثل المائل)', () => {
    expect(inAvgPeriod(list, null)).toBe(list);
    expect(inAvgPeriod(list, { from: '2026/10/05', to: '2026/10/10' }).map(x => x.id)).toEqual(['2', '3']);
    expect(inAvgPeriod(list, { from: '2026-10-01', to: '' }).map(x => x.id)).toEqual(['2', '3', '4']);
    expect(inAvgPeriod(list, { from: '', to: '2026/09/30' }).map(x => x.id)).toEqual(['1']);
  });

  it('المتوسط يتغير حسب الفترة', () => {
    expect(computeInboundPriceStats(inAvgPeriod(list, { from: '2026/10/01', to: '2026/10/31' })).avgPrice).toBe((30000 * 930 + 10000 * 880) / 40000);
  });

  it('أثر كل مجهز: الحصة من الكمية وسعره، والشحنات بلا كمية لا تُحسب', () => {
    const b = periodBreakdown(inAvgPeriod(list, { from: '2026/10/01', to: '2026/10/31' }));
    expect(b.shipments).toBe(2);
    expect(b.suppliers.map(s => [s.name, s.share, s.price])).toEqual([['عراق الطاقة', 75, 930], ['يوسف مدخل', 25, 880]]);
  });
});
