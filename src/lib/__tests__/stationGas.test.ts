import { beforeEach, describe, expect, it } from 'vitest';
import type { InboundDelivery } from '../../types';
import { applyStationGas, readStationGas, readStationGasLog, stationGasLive, stationGasOptions } from '../stationGas';

const d = (id: string, supplierName: string, date: string, qty: number, price: number, status = 'مكتمل'): InboundDelivery =>
  ({ id, supplierName, date, receivedQuantity: qty, productPrice: price, status, product: 'كاز' } as unknown as InboundDelivery);

const archive = [
  d('1', 'اسعد كاظم', '2026/10/17', 30000, 840),
  d('2', 'اسعد كاظم', '2026/10/18', 20000, 850),
  d('3', 'اسعد كاظم', '2026/10/18', 10000, 880),
  d('4', 'مستودع السدة', '2026/10/16', 40000, 800),
  d('5', 'مستودع السدة', '2026/10/19', 5000, 900, 'ملغي'),
];

describe('كارت كاز محطات', () => {
  beforeEach(() => localStorage.clear());

  it('آخر يوم وارد لكل مجهز: كميات اليوم تُجمع والسعر موزون، والملغي لا يُحسب', () => {
    const opts = stationGasOptions(archive);
    expect(opts.map(o => [o.name, o.date, o.qty, o.price])).toEqual([
      ['اسعد كاظم', '2026/10/18', 30000, 860],
      ['مستودع السدة', '2026/10/16', 40000, 800],
    ]);
  });

  it('أكثر من مجهز: الكمية مجموعهم والسعر متوسطهم الموزون وتاريخ أحدثهم', () => {
    const live = stationGasLive(archive, ['اسعد كاظم', 'مستودع السدة'])!;
    expect(live.volume).toBe(70000);
    expect(live.price).toBe(Math.round(((30000 * 860 + 40000 * 800) / 70000) * 10) / 10);
    expect(live.date).toBe('2026/10/18');
  });

  it('كل تغيّر يُحفظ مرة واحدة في السجل، والسابق = السعر قبل التغيّر', () => {
    const first = stationGasLive(archive, ['اسعد كاظم']);
    expect(applyStationGas(['اسعد كاظم'], first, 'select')).toBe(true);
    // نفس القيم مرة أخرى (جزء آخر من الصفحة): لا عملية مكررة
    expect(applyStationGas(['اسعد كاظم'], first, 'auto')).toBe(false);
    const next = stationGasLive([...archive, d('6', 'اسعد كاظم', '2026/10/19', 8000, 900)], ['اسعد كاظم']);
    expect(applyStationGas(['اسعد كاظم'], next, 'auto')).toBe(true);
    expect(readStationGas()).toMatchObject({ price: 900, previousPrice: 860, volume: 8000, date: '2026/10/19' });
    const log = readStationGasLog();
    expect(log.map(e => [e.reason, e.prevPrice, e.price])).toEqual([['auto', 860, 900], ['select', null, 860]]);
  });
});
