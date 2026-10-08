export interface EtihadBalanceRecord {
  id: string;
  date: string; // صيغة التاريخ مثل 2026/09/09 أو YYYY-MM-DD
  previousBalance: number; // الرصيد السابق للوقود (لتر)
  purchases: number; // المشتريات / إضافات الرصيد (+) (لتر)
  
  // الخصومات (-)
  etihadExpense: number; // مصروف الاتحاد (لتر)
  saharaSales: number; // مبيعات صحاري (لتر)
  cablesSales: number; // مبيعات الكبيلات (لتر)
  specialSales: number; // مبيعات خاصة (لتر)
  otherSales: number; // مبيعات أخرى (لتر)
  operationalGas?: number; // كاز تشغيلي (لتر) — للعرض فقط، لا يدخل في أي رصيد
  cleanGas?: number; // كاز نظيف (لتر) — للعرض فقط، لا يدخل في أي رصيد
  
  // رصيد الزيوت (منفصل)
  oilPreviousBalance: number; // الرصيد السابق للزيوت (لتر)
  oilInbound: number; // وارد زيوت (+) (لتر)
  oilSales: number; // مبيعات الزيوت (-) (لتر)
  oilCurrentBalance: number; // رصيد الزيوت المتوفر الآن (لتر)
  
  // النتائج المحسوبة
  totalDeductions: number; // إجمالي الخصومات (لتر)
  currentBalance: number; // الرصيد الحالي المتوفر للوقود (لتر)
  
  // التسعير والتكلفة
  currentPrice: number; // السعر الحالي (د.ع / لتر)
  averageCost?: number; // معدل التكلفة (د.ع)
  notes?: string; // ملاحظات إضافية
  createdAt?: string;
}

export type DateFilterRange = 'all' | 'week' | 'month' | 'today' | 'custom';

export interface EtihadSummaryMetrics {
  previousBalance: number;
  currentBalance: number;
  todayInbound: number;
  todayConsumption: number;
  todaySales: number;
  oilBalance: number;
  averageCost: number;
  averagePrice: number;
  totalPurchases: number;
  totalEtihadExpense: number;
  totalSaharaSales: number;
  totalCablesSales: number;
  totalSpecialSales: number;
  totalOtherSales: number;
  totalCost?: number;
  recordsCount: number;
}

/** المبيعات لسجل الاتحاد: خانة واحدة (السجلات القديمة كانت مفصّلة إلى صحاري/كبلات/خاصة/أخرى فتُجمع) */
export const etihadSalesOf = (r: Pick<EtihadBalanceRecord, 'saharaSales' | 'cablesSales' | 'specialSales' | 'otherSales'>): number =>
  (r.saharaSales || 0) + (r.cablesSales || 0) + (r.specialSales || 0) + (r.otherSales || 0);
