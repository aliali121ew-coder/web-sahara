import {
  TankItem,
  FuelProductMetric,
  SupplierPriceRecord,
  SupplyRequest,
  SiteManager,
  OperationalTask,
  DispatchMessage,
  SystemNotification
} from '../types';
/**
 * القيم الابتدائية عند عدم وجود بيانات محفوظة.
 * لا بيانات تجريبية: القوائم فارغة، وتعريف المنتجات فقط بأرقام صفرية حتى تُدخل القيم الفعلية.
 */
export const INITIAL_TANKS: TankItem[] = [];

export const INITIAL_FUEL_METRICS: FuelProductMetric[] = [
  {
    id: 'fuel-1',
    name: 'بنزين الصحاري',
    category: 'gasoline',
    company: 'صحاري كربلاء',
    priceIqd: 0,
    volumeLiters: 0,
    badgeColor: 'amber',
    trendPercent: 0,
    isPositive: true,
    status: 'مستقر',
    lastUpdated: '',
  },
  {
    id: 'fuel-2',
    name: 'كاز الصحاري',
    category: 'gas',
    company: 'صحاري كربلاء',
    priceIqd: 0,
    volumeLiters: 0,
    badgeColor: 'blue',
    trendPercent: 0,
    isPositive: true,
    status: 'مستقر',
    lastUpdated: '',
  },
  {
    id: 'fuel-muhassan',
    name: 'كاز محطات',
    category: 'gas',
    company: 'صحاري كربلاء',
    priceIqd: 0,
    volumeLiters: 0,
    badgeColor: 'cyan',
    trendPercent: 0,
    isPositive: true,
    status: 'مستقر',
    lastUpdated: '',
  },
  {
    id: 'fuel-3',
    name: 'كاز الاتحاد',
    category: 'gas',
    company: 'شركة الاتحاد',
    priceIqd: 0,
    volumeLiters: 0,
    badgeColor: 'teal',
    trendPercent: 0,
    isPositive: true,
    status: 'مستقر',
    lastUpdated: '',
  },
  {
    id: 'fuel-4',
    name: 'نفط الأسود',
    category: 'crude',
    company: 'صحاري كربلاء',
    priceIqd: 0,
    volumeLiters: 0,
    badgeColor: 'purple',
    trendPercent: 0,
    isPositive: true,
    status: 'مستقر',
    lastUpdated: '',
  },
  {
    id: 'fuel-5',
    name: 'نفط الأسود',
    category: 'crude',
    company: 'شركة الاتحاد',
    priceIqd: 0,
    volumeLiters: 0,
    badgeColor: 'pink',
    trendPercent: 0,
    isPositive: true,
    status: 'مستقر',
    lastUpdated: '',
  },
];

export const INITIAL_SUPPLIER_PRICES: SupplierPriceRecord[] = [];

/** موردون تجريبيون كانوا يُزرعون سابقًا: تُستخدم معرّفاتهم لحذفهم من البيانات المحفوظة فقط */
export const INITIAL_SUPPLIER_PRICES_MOCK: SupplierPriceRecord[] = [
  {
    id: 'sup-1',
    supplierName: 'شركة توزيع المنتجات النفطية - كربلاء',
    product: 'كاز حكومي مدعوم',
    priceIqd: 450,
    previousPriceIqd: 450,
    changePercent: 0.0,
    category: 'حكومي',
    availability: 'متوفر',
    lastUpdated: '2026/08/20',
  },
  {
    id: 'sup-2',
    supplierName: 'مصفى كربلاء الدولي الحديث',
    product: 'كاز ممتاز فائق النقاوة (Euro 5)',
    priceIqd: 515,
    previousPriceIqd: 505,
    changePercent: 1.98,
    category: 'رسمي',
    availability: 'متوفر',
    lastUpdated: '2026/08/20',
  },
  {
    id: 'sup-3',
    supplierName: 'شركة الاتحاد للاستثمارات النفطية',
    product: 'كاز شحنات ضخمة مجمعة',
    priceIqd: 493.3,
    previousPriceIqd: 498.0,
    changePercent: -0.94,
    category: 'تجاري',
    availability: 'متوفر',
    lastUpdated: '2026/08/19',
  },
  {
    id: 'sup-4',
    supplierName: 'مستودع الفرات الأوسط للمشتقات',
    product: 'نفط أسود صناعي ثقيل',
    priceIqd: 490,
    previousPriceIqd: 480,
    changePercent: 2.08,
    category: 'تجاري',
    availability: 'محدود',
    lastUpdated: '2026/08/20',
  },
  {
    id: 'sup-5',
    supplierName: 'شركة بابل للمحروقات والطاقة',
    product: 'بنزين محسن عالي الأوكتان',
    priceIqd: 650,
    previousPriceIqd: 660,
    changePercent: -1.51,
    category: 'تجاري',
    availability: 'متوفر',
    lastUpdated: '2026/08/18',
  },
  {
    id: 'sup-6',
    supplierName: 'الهيئة الوطنية للطاقة والصناعة',
    product: 'نفط أبيض للاستخدام المدني',
    priceIqd: 350,
    previousPriceIqd: 350,
    changePercent: 0.0,
    category: 'حكومي',
    availability: 'محدود',
    lastUpdated: '2026/08/17',
  },
];

export const INITIAL_SUPPLY_REQUESTS: SupplyRequest[] = [];

export const INITIAL_MANAGERS: SiteManager[] = [];

export const INITIAL_TASKS: OperationalTask[] = [];

export const INITIAL_MESSAGES: DispatchMessage[] = [];

export const INITIAL_NOTIFICATIONS: SystemNotification[] = [];
