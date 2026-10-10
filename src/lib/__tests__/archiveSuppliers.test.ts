import { describe, expect, it } from 'vitest';
import { archiveIdentity, latestSupplierPrices } from '../archiveSuppliers';
import type { InboundDelivery } from '../../types';

let n = 0;
const d = (date: string, supplierName: string, supplierCompany: string, price: number): InboundDelivery =>
  ({ id: `del-${1790000000000 + n++}-x`, date, receiptUnloadDate: date, supplierName, supplierCompany, productPrice: price, receivedQuantity: 1000 } as InboundDelivery);

describe('archive suppliers', () => {
  const sahara = [
    d('2026/04/10', '_', 'مستودع كربلاء', 400),
    d('2026/10/01', 'اطراف النخيل', 'ندرة الذهب', 882),
    d('2026/10/09', 'اطراف النخيل', 'ندرة الذهب', 880),
    // شحنة بلا مجهز ولا شركة: لا تُنسب لأحد (كانت تُسجّل "مصفى كربلاء الدولي")
    d('2026/10/10', '', '', 880),
    d('2026/10/08', 'محطة ارض الخير', '', 450),
  ];

  it('newest equipper first, each compared with its own previous shipment', () => {
    const rows = latestSupplierPrices(sahara, []);
    expect(rows.map(r => r.supplierName)).toEqual(['اطراف النخيل', 'محطة ارض الخير', 'مستودع كربلاء']);
    expect(rows[0]).toMatchObject({ date: '2026/10/09', price: 880, previousPrice: 882 });
    expect(rows[1]).toMatchObject({ price: 450, previousPrice: null });
  });

  it('a renamed supplier still finds its shipments through its id', () => {
    const id = latestSupplierPrices(sahara, [])[0].id;
    expect(archiveIdentity({ id, supplierName: 'النخيل - الاسم الجديد', company: 'sahara' }, sahara, [])).toBe('اطراف النخيل');
  });
});
