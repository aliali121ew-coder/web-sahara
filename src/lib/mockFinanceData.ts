import { EtihadBalanceRecord, EtihadSummaryMetrics } from '../types/finance';

export const INITIAL_ETIHAD_RECORDS: EtihadBalanceRecord[] = [
  {
    id: 'rec-2026-09-09',
    date: '2026/09/09',
    previousBalance: 15028082,
    purchases: 10000000,
    etihadExpense: 10000,
    saharaSales: 11111100,
    cablesSales: 10000000,
    specialSales: 1111000,
    otherSales: 110,
    totalDeductions: 22232210,
    currentBalance: 2795872,
    oilPreviousBalance: 490000,
    oilInbound: 10000000,
    oilSales: 10000000,
    oilCurrentBalance: 490000,
    currentPrice: 554,
    averageCost: 535,
    notes: 'حركة التوريد والمبيعات المسجلة ليوم 09/09/2026',
    createdAt: '2026-09-09T10:30:00Z',
  },
  {
    id: 'rec-2026-09-08',
    date: '2026/09/08',
    previousBalance: 14500000,
    purchases: 1200000,
    etihadExpense: 15000,
    saharaSales: 450000,
    cablesSales: 200000,
    specialSales: 0,
    otherSales: 6918,
    totalDeductions: 671918,
    currentBalance: 15028082,
    oilPreviousBalance: 490000,
    oilInbound: 0,
    oilSales: 0,
    oilCurrentBalance: 490000,
    currentPrice: 554,
    averageCost: 535,
    notes: 'تسوية مبيعات الكابلات والصحاري اليومية',
    createdAt: '2026-09-08T18:00:00Z',
  },
  {
    id: 'rec-2026-09-07',
    date: '2026/09/07',
    previousBalance: 14000000,
    purchases: 1500000,
    etihadExpense: 20000,
    saharaSales: 600000,
    cablesSales: 350000,
    specialSales: 30000,
    otherSales: 0,
    totalDeductions: 1000000,
    currentBalance: 14500000,
    oilPreviousBalance: 485000,
    oilInbound: 10000,
    oilSales: 5000,
    oilCurrentBalance: 490000,
    currentPrice: 552,
    averageCost: 535,
    notes: 'استلام وجبة زيوت جديدة وصرف تشغيلي',
    createdAt: '2026-09-07T16:15:00Z',
  }
];

export function computeEtihadMetrics(records: EtihadBalanceRecord[]): EtihadSummaryMetrics {
  if (records.length === 0) {
    return {
      previousBalance: 15028082,
      currentBalance: 15028082,
      todayInbound: 0,
      todayConsumption: 0,
      todaySales: 0,
      oilBalance: 4900,
      averageCost: 0,
      averagePrice: 554,
      totalPurchases: 0,
      totalEtihadExpense: 0,
      totalSaharaSales: 0,
      totalCablesSales: 0,
      totalSpecialSales: 0,
      totalOtherSales: 0,
      recordsCount: 0,
    };
  }

  // Records sorted chronologically
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];

  // Today string format
  const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');
  const todayRecords = records.filter(r => r.date === todayStr || r.date === '2026/09/09');

  const todayInbound = todayRecords.reduce((acc, r) => acc + (r.purchases || 0), 0);
  const todayConsumption = todayRecords.reduce((acc, r) => acc + (r.etihadExpense || 0), 0);
  const todaySales = todayRecords.reduce(
    (acc, r) => acc + (r.saharaSales || 0) + (r.cablesSales || 0) + (r.specialSales || 0) + (r.otherSales || 0),
    0
  );

  const totalPurchases = records.reduce((acc, r) => acc + (r.purchases || 0), 0);
  const totalEtihadExpense = records.reduce((acc, r) => acc + (r.etihadExpense || 0), 0);
  const totalSaharaSales = records.reduce((acc, r) => acc + (r.saharaSales || 0), 0);
  const totalCablesSales = records.reduce((acc, r) => acc + (r.cablesSales || 0), 0);
  const totalSpecialSales = records.reduce((acc, r) => acc + (r.specialSales || 0), 0);
  const totalOtherSales = records.reduce((acc, r) => acc + (r.otherSales || 0), 0);

  return {
    previousBalance: latest.previousBalance,
    currentBalance: latest.currentBalance,
    todayInbound,
    todayConsumption,
    todaySales,
    oilBalance: latest.oilCurrentBalance,
    averageCost: latest.averageCost ?? 535,
    averagePrice: latest.currentPrice ?? 554,
    totalCost: (todayInbound > 0 ? todayInbound : totalPurchases) * (latest.currentPrice ?? 554),
    totalPurchases,
    totalEtihadExpense,
    totalSaharaSales,
    totalCablesSales,
    totalSpecialSales,
    totalOtherSales,
    recordsCount: records.length,
  };
}
