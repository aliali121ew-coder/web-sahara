export type ThemeMode = 'light' | 'dark';
export type SidebarStyle = 'navy' | 'light' | 'gradient' | 'unified' | 'glass' | 'match-bg';
export type BgGradientTheme =
  | 'none'
  | 'titanium-slate'
  | 'petrol-blue'
  | 'frost-snow'
  | 'glacier-blue'
  | 'emerald-flow'
  | 'ocean-cyan'
  | 'royal-violet'
  | 'sahara-amber'
  | 'desert-bronze';
export type BgType = 'gradient' | 'solid';
export type GradientIntensity = 'subtle' | 'vibrant';
export type GradientShadeLevel = number; // 1 (فاتح وهادئ جداً) إلى 10 (أغمق قليلاً)
export type UiDensity = 'standard' | 'compact';
export type CompanyScope = 'sahara' | 'etihad';
export type UserRole = 'admin' | 'sahara_operator' | 'etihad_operator' | 'supervisor';

export type NavTabId =
  | 'dashboard'
  | 'tanks'
  | 'prices'
  | 'deliveries'
  | 'deliveries-sahara'
  | 'deliveries-etihad'
  | 'finance'
  | 'finance-etihad'
  | 'finance-sahara'
  | 'managers'
  | 'tasks'
  | 'reports'
  | 'chat'
  | 'settings';

export interface SubpageInfo {
  title: string;
  category?: string;
  parentTab?: NavTabId;
  onBack?: () => void;
}

export interface TankItem {
  id: string;
  name: string;
  code: string;
  fuelType: 'كاز' | 'بنزين' | 'نفط أسود' | 'ديزل ممتاز';
  company: 'صحاري كربلاء' | 'شركة الاتحاد' | 'مشترك';
  capacityLiters: number;
  currentLiters: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical';
  temperatureC: number;
  pressureBar: number;
  waterLevelMm: number;
  lastUpdated: string;
}

export interface FuelProductMetric {
  id: string;
  name: string;
  category: 'gas' | 'gasoline' | 'crude' | 'special';
  company: 'صحاري كربلاء' | 'شركة الاتحاد';
  priceIqd: number;
  volumeLiters: number;
  badgeColor: 'amber' | 'blue' | 'teal' | 'purple' | 'pink' | 'emerald' | 'cyan';
  trendPercent: number;
  isPositive: boolean;
  status: 'مستقر' | 'مرتفع' | 'منخفض' | 'حرج';
  lastUpdated: string;
}

export interface SupplierPriceRecord {
  id: string;
  supplierName: string;
  product: string;
  priceIqd: number;
  previousPriceIqd: number;
  changePercent: number;
  category: 'الكل' | 'تجاري' | 'رسمي' | 'حكومي';
  availability: 'متوفر' | 'محدود' | 'غير متوفر';
  lastUpdated: string;
}

export interface InboundDelivery {
  id: string;
  // 11 Core Inbound Columns:
  company: string; // الشركة
  supplierCompany: string; // الشركة المجهزة
  driverName: string; // اسم السائق
  truckNumber: string; // رقم العجلة
  voucherNumber: string; // رقم الفوجر
  receivedQuantity: number; // الكميه المستلمة (لتر)
  productDensity: string | number; // كثافة المنتج (مثال: 0.840)
  productColor: string; // لون المنتج (مثال: أصفر مخضر، أحمر، شفاف)
  productPrice: number; // سعر المنتج (د.ع / لتر)
  productCost: number; // تكلفة المنتج (د.ع)
  receiptUnloadDate: string; // تاريخ الاستلام والتفريغ

  // Additional Metadata & Compatibility fields
  supplierName?: string;
  product?: string;
  driverPhone?: string;
  receiptNumber?: string;
  volumeLiters?: number;
  pricePerLiter?: number;
  totalCostIqd?: number;
  date?: string;
  time?: string;
  tankCode?: string;
  stationName?: string;
  status?: 'تم الاستلام' | 'في الطريق' | 'قيد الفحص' | 'ملغي';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'pdf' | 'image' | string;
  attachmentSize?: number;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: 'pdf' | 'image' | string;
    size: number;
  }>;
}

export interface SupplyRequest {
  id: string;
  requestNumber: string;
  beneficiary: string;
  sector: 'الآليات' | 'المولدات' | 'المزارع' | 'موقع المشروع' | 'أخرى';
  product: string;
  volumeLiters: number;
  requesterName: string;
  approvedBy?: string;
  date: string;
  time: string;
  status: 'معتمد' | 'قيد الانتظار' | 'مرفوض' | 'تم الصرف';
  notes?: string;
}

export interface SiteManager {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  shift: 'صباحي' | 'مسائي' | 'ميداني مستمر';
  status: 'على رأس العمل' | 'في استراحة' | 'إجازة';
  assignedZone: string;
}

export interface OperationalTask {
  id: string;
  title: string;
  description: string;
  priority: 'عالية' | 'متوسطة' | 'منخفضة';
  assignee: string;
  dueDate: string;
  completed: boolean;
  category: 'صيانة' | 'تفريغ' | 'فحص جودة' | 'جرد';
}

export interface DispatchMessage {
  id: string;
  sender: string;
  role: string;
  text: string;
  timestamp: string;
  isEmergency?: boolean;
  badgeColor?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'alert' | 'warning' | 'info' | 'success';
  /** مفتاح الترجمة (common:notif.<key>.title / .message) ومتغيراته؛ النص العربي أعلاه يبقى للإشعارات القديمة */
  key?: string;
  params?: Record<string, string | number>;
}
