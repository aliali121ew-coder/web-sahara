import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import { CLOUD_APPLIED_EVENT } from '../lib/cloudSync';
import {
  TankItem,
  FuelProductMetric,
  SupplierPriceRecord,
  InboundDelivery,
  SupplyRequest,
  SiteManager,
  OperationalTask,
  DispatchMessage,
  SystemNotification,
  NavTabId,
  SubpageInfo
} from '../types';
import {
  INITIAL_TANKS,
  INITIAL_FUEL_METRICS,
  INITIAL_SUPPLIER_PRICES,
  INITIAL_SUPPLIER_PRICES_MOCK,
  INITIAL_SUPPLY_REQUESTS,
  INITIAL_MANAGERS,
  INITIAL_TASKS,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS
} from '../lib/mockData';
import { logPrice } from '../lib/priceLog';
import { buildArchiveSuppliers, sameSupplier, deliveriesOfSupplier, archiveValue, recordColor } from '../lib/archiveSuppliers';

const MOCK_SUPPLIERS_REMOVED_KEY = 'sahara_supplier_mock_removed';
const SUPPLIER_NAMES_REPAIRED_KEY = 'sahara_supplier_names_repaired';
const SUPPLIER_SOURCE_V2_KEY = 'sahara_supplier_source_v2';
const SUPPLIER_COLOR_YELLOW_KEY = 'sahara_supplier_color_yellow_v1';
/** إعادة بناء لمرة واحدة (2026/10/10): حذف كل بيانات الموردين وبناؤها من جديد من أرشيف وارد الصحاري والاتحاد */
const SUPPLIERS_RESET_V3_KEY = 'sahara_supplier_reset_v3';

interface FuelDataContextType {
  activeTab: NavTabId;
  setActiveTab: (tab: NavTabId) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentSubpage: SubpageInfo | null;
  setCurrentSubpage: (subpage: SubpageInfo | null) => void;
  navigateBack: () => void;
  canGoBack: boolean;

  tanks: TankItem[];
  fuelMetrics: FuelProductMetric[];
  supplierPrices: SupplierPriceRecord[];
  deliveries: InboundDelivery[];
  saharaDeliveries: InboundDelivery[];
  etihadDeliveries: InboundDelivery[];
  supplyRequests: SupplyRequest[];
  managers: SiteManager[];
  tasks: OperationalTask[];
  messages: DispatchMessage[];
  notifications: SystemNotification[];

  addDelivery: (delivery: Omit<InboundDelivery, 'id'>, targetCompany?: 'صحاري كربلاء' | 'شركة الاتحاد') => void;
  updateDelivery: (id: string, delivery: Partial<InboundDelivery>) => void;
  deleteDelivery: (id: string) => void;
  resetDeliveries: (targetCompany?: 'صحاري كربلاء' | 'شركة الاتحاد') => void;
  addSupplyRequest: (request: Omit<SupplyRequest, 'id'>) => void;
  addMessage: (text: string, isEmergency?: boolean) => void;
  toggleTask: (taskId: string) => void;
  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: () => void;
  updateTankLevel: (tankId: string, deltaLiters: number) => void;
  refreshAllData: () => void;
  /** إضافة مورد أو تعديله؛ تغيير السعر يحدّث السعر السابق ونسبة التغير وسجل الأسعار فيظهر فورًا في مؤشر الأسعار */
  saveSupplier: (supplier: SupplierPriceRecord) => void;
  deleteSupplier: (id: string) => void;
}

const VALID_TABS: NavTabId[] = [
  'dashboard',
  'tanks',
  'prices',
  'suppliers',
  'deliveries',
  'deliveries-sahara',
  'deliveries-etihad',
  'finance',
  'finance-etihad',
  'finance-sahara',
  'managers',
  'tasks',
  'reports',
  'chat',
  'settings'
];

/** معرّف فريد للشحنة (الاستيراد يضيف عشرات الشحنات في نفس الجزء من الثانية، فالوقت + رقم عشوائي صغير كان يتكرر) */
const randomTag = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
const newDeliveryId = (): string => `del-${Date.now()}-${randomTag()}`;
/** معرّف فريد (الوقت وحده يتكرر عند إنشاء عنصرين في نفس الجزء من الثانية، وكان يكرر الإشعارات) */
const newId = (prefix: string) => `${prefix}-${Date.now()}-${randomTag()}`;
/** حذف العناصر المكررة بنفس المعرّف (يُبقى أول ظهور) */
const dedupeById = <T extends { id: string }>(list: T[]): T[] => {
  const seen = new Set<string>();
  return list.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
};

/** الشحنات التجريبية القديمة (del-1 … del-50) تُحذف؛ المرفوعة من الإكسل أو المضافة يدويًا معرّفها del-<وقت>-… */
/**
 * كروت مشتريات الوقود ثابتة (بنزين، كاز الصحاري، كاز محسن...): أسعارها تُحسب من الوارد، والمحفوظ يضيف عليها فقط.
 * قائمة محفوظة فارغة أو ناقصة (مثل قاعدة جديدة أو مجموعة فارغة على الخادم) كانت تُخفي الكروت كلها،
 * فيُكمَل كل كارت مفقود من القائمة الأساسية، وتُحدَّث الأسماء من آخر نسخة.
 */
export const withAllFuelCards = (saved: FuelProductMetric[]): FuelProductMetric[] => {
  const list = saved.filter(item => item && typeof item === 'object' && item.id);
  const merged = list.map(item => {
    const initial = INITIAL_FUEL_METRICS.find(i => i.id === item.id);
    return initial ? { ...item, name: initial.name } : item;
  });
  for (const initial of INITIAL_FUEL_METRICS) if (!merged.some(m => m.id === initial.id)) merged.push(initial);
  return merged;
};

const isRealDelivery = (d: InboundDelivery) => !/^del-\d{1,3}$/.test(d.id || '');

/** إصلاح المعرّفات المكررة في البيانات المحفوظة: التكرار الثاني وما بعده يأخذ معرّفًا جديدًا */
const dedupeIds = (items: InboundDelivery[]): InboundDelivery[] => {
  const seen = new Set<string>();
  return items.map(d => {
    if (!d.id || seen.has(d.id)) {
      const fixed = { ...d, id: newDeliveryId() };
      seen.add(fixed.id);
      return fixed;
    }
    seen.add(d.id);
    return d;
  });
};

const getInitialTab = (): NavTabId => {
  if (typeof window !== 'undefined') {
    // 1. Check URL hash first (e.g. #finance-etihad)
    const hash = window.location.hash.replace(/^#/, '');
    if (VALID_TABS.includes(hash as NavTabId)) {
      return hash as NavTabId;
    }
    // 2. Check localStorage
    try {
      const saved = localStorage.getItem('sahara_active_tab');
      if (saved && VALID_TABS.includes(saved as NavTabId)) {
        return saved as NavTabId;
      }
    } catch (e) {
      // ignore
    }
  }
  return 'dashboard';
};

/** حقول التنقل (الصفحة الحالية، البحث، الصفحة الفرعية): تتغير عند كل تنقل أو حرف في البحث */
const NAV_KEYS = ['activeTab', 'setActiveTab', 'searchQuery', 'setSearchQuery', 'currentSubpage', 'setCurrentSubpage', 'navigateBack', 'canGoBack'] as const;
export type FuelNavState = Pick<FuelDataContextType, (typeof NAV_KEYS)[number]>;
export type FuelStore = Omit<FuelDataContextType, (typeof NAV_KEYS)[number]>;

/**
 * سياقان منفصلان: البيانات والتنقل. كانا سياقًا واحدًا فكان كل تنقل بين الصفحات وكل حرف في البحث
 * يعيد رسم كل صفحة تقرأ البيانات (بما فيها الصفحات المحفوظة المخفية)، وهذا أكبر سبب لبطء الاستجابة.
 * useFuelStore = البيانات فقط، useFuelNav = التنقل فقط، useFuelData = الاثنان (كما كان).
 */
const FuelStoreContext = createContext<FuelStore | undefined>(undefined);
const FuelNavContext = createContext<FuelNavState | undefined>(undefined);

export const FuelDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<NavTabId>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentSubpage, setCurrentSubpage] = useState<SubpageInfo | null>(null);

  const setActiveTab = useCallback((tab: NavTabId) => {
    startTransition(() => {
      setActiveTabState(tab);
      setCurrentSubpage(null); // Automatically reset subpage when navigating tabs
    });
    try {
      localStorage.setItem('sahara_active_tab', tab);
      if (typeof window !== 'undefined' && window.location.hash !== `#${tab}`) {
        window.history.replaceState(null, '', `#${tab}`);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const navigateBack = useCallback(() => {
    // يضاف بالصفحات الفرعية فقط - الرجوع من الصفحة الفرعية إلى الصفحة السابقة / الرئيسية
    if (currentSubpage) {
      if (currentSubpage.onBack) {
        currentSubpage.onBack();
      } else {
        setCurrentSubpage(null);
      }
    }
  }, [currentSubpage]);

  // يظهر الزر في الصفحات الفرعية فقط وليس الصفحات الرئيسية
  const canGoBack = Boolean(currentSubpage);

  // Sync hash changes and ensure initial hash is set
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash !== `#${activeTab}`) {
        window.history.replaceState(null, '', `#${activeTab}`);
      }

      const handleHashChange = () => {
        const hash = window.location.hash.replace(/^#/, '');
        if (VALID_TABS.includes(hash as NavTabId)) {
          startTransition(() => {
            setActiveTabState(hash as NavTabId);
            setCurrentSubpage(null);
          });
          try {
            localStorage.setItem('sahara_active_tab', hash);
          } catch (e) {}
        }
      };

      window.addEventListener('hashchange', handleHashChange);
      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }
  }, [activeTab]);

  const [tanks, setTanks] = useState<TankItem[]>(() => {
    const saved = localStorage.getItem('sahara_tanks');
    return saved ? JSON.parse(saved) : INITIAL_TANKS;
  });


  const [fuelMetrics, setFuelMetrics] = useState<FuelProductMetric[]>(() => {
    const saved = localStorage.getItem('sahara_fuel_metrics');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return withAllFuelCards(parsed);
      } catch (e) {
        // ignore error
      }
    }
    return INITIAL_FUEL_METRICS;
  });

  const [supplierPrices, setSupplierPrices] = useState<SupplierPriceRecord[]>(() => {
    const saved = localStorage.getItem('sahara_supplier_prices');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIER_PRICES;
  });

  const formatVoucher = (val?: string, id?: string) => {
    if (!val) return `2026${(id || Date.now().toString()).replace(/\D/g, '').slice(-4)}`;
    const digits = val.replace(/\D/g, '');
    return digits || val;
  };

    const PROVINCE_TO_CODE: Record<string, string> = {
      'بغداد': '11', 'نينوى': '12', 'ميسان': '13', 'البصرة': '14', 'الانبار': '15',
      'الأنبار': '15', 'القادسية': '16', 'ديوانية': '16', 'الديوانية': '16', 'المثنى': '17',
      'بابل': '18', 'كربلاء': '19', 'ديالى': '20', 'السليمانية': '21', 'اربيل': '22',
      'أربيل': '22', 'حلبجة': '23', 'دهوك': '24', 'كركوك': '25', 'صلاح الدين': '26',
      'ذي قار': '27', 'النجف': '28', 'واسط': '29'
    };

    const formatTruckPlate = (val?: string) => {
      if (!val) return '19A 72911';
      const trimmed = val.trim();
      if (/^\d{2}[A-Za-z\u0621-\u064A]\s+\d+$/.test(trimmed)) return trimmed;
      const match = trimmed.match(/^([^\d]+)\s+(\d+)$/);
      if (match) {
        const prov = match[1].trim();
        let code = '19';
        for (const [p, c] of Object.entries(PROVINCE_TO_CODE)) {
          if (prov.includes(p)) { code = c; break; }
        }
        return `${code}A ${match[2]}`;
      }
      return trimmed;
    };

    const normalizeDeliveryItem = (d: InboundDelivery): InboundDelivery => {
      const qty = d.receivedQuantity ?? d.volumeLiters ?? 0;
      const price = d.productPrice ?? d.pricePerLiter ?? 500;
      const cost = d.productCost ?? d.totalCostIqd ?? (qty * price);
      // كشف الوارد خاص بالكاز: شحنات صُنّفت سابقًا "نفط أسود" من لونها ("نفط ابيض" / "نفط") تُصحَّح إلى كاز
      const product = d.product === 'نفط أسود' ? 'كاز ممتاز' : d.product;
      return {
        ...d,
        product,
        company: d.company || 'صحاري كربلاء',
        supplierCompany: d.supplierCompany || d.supplierName || 'مصفى كربلاء الدولي',
        driverName: d.driverName || 'سائق غير محدد',
        truckNumber: formatTruckPlate(d.truckNumber),
        voucherNumber: formatVoucher(d.voucherNumber || d.receiptNumber, d.id),
        receivedQuantity: qty,
        productDensity: d.productDensity || '0.840',
        productColor: d.productColor || 'أصفر مخضر',
        productPrice: price,
        productCost: cost,
        receiptUnloadDate: d.receiptUnloadDate ? d.receiptUnloadDate.split(' ')[0] : (d.date || '2026/08/20'),
        volumeLiters: qty,
        totalCostIqd: cost,
        receiptNumber: formatVoucher(d.voucherNumber || d.receiptNumber, d.id),
        // اسم المجهز (الشخص) يبقى كما هو — فارغ إن لم يوجد، ولا يُستبدل باسم الشركة
        supplierName: d.supplierName || '',
      };
    };

    // 🔒 1. Independent Isolated Storage for Sahara Deliveries
    const [saharaDeliveries, setSaharaDeliveries] = useState<InboundDelivery[]>(() => {
      try {
        const saved = localStorage.getItem('sahara_inbound_deliveries');
        if (saved) {
          const parsed: InboundDelivery[] = JSON.parse(saved);
          return dedupeIds(parsed.filter(isRealDelivery).map(normalizeDeliveryItem));
        }
        const oldSaved = localStorage.getItem('sahara_deliveries');
        const all: InboundDelivery[] = oldSaved ? JSON.parse(oldSaved).filter(isRealDelivery) : [];
        return all
          .filter(d => (d.company || '').trim() !== 'شركة الاتحاد')
          .map(normalizeDeliveryItem);
      } catch {
        return [];
      }
    });

    // 🔒 2. Independent Isolated Storage for Etihad Deliveries
    const [etihadDeliveries, setEtihadDeliveries] = useState<InboundDelivery[]>(() => {
      try {
        const saved = localStorage.getItem('etihad_inbound_deliveries');
        if (saved) {
          const parsed: InboundDelivery[] = JSON.parse(saved);
          return dedupeIds(parsed.filter(isRealDelivery).map(normalizeDeliveryItem));
        }
        const oldSaved = localStorage.getItem('sahara_deliveries');
        const all: InboundDelivery[] = oldSaved ? JSON.parse(oldSaved).filter(isRealDelivery) : [];
        return all
          .filter(d => (d.company || '').trim() === 'شركة الاتحاد')
          .map(normalizeDeliveryItem);
      } catch {
        return [];
      }
    });

    // Unified view for global dashboard/reports
    const deliveries = React.useMemo(() => {
      return [...saharaDeliveries, ...etihadDeliveries].sort((a, b) => {
        const dateA = a.receiptUnloadDate || a.date || '';
        const dateB = b.receiptUnloadDate || b.date || '';
        return dateB.localeCompare(dateA);
      });
    }, [saharaDeliveries, etihadDeliveries]);

  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>(() => {
    const saved = localStorage.getItem('sahara_supply_requests');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLY_REQUESTS;
  });

  const [managers] = useState<SiteManager[]>(INITIAL_MANAGERS);

  const [tasks, setTasks] = useState<OperationalTask[]>(() => {
    const saved = localStorage.getItem('sahara_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [messages, setMessages] = useState<DispatchMessage[]>(() => {
    const saved = localStorage.getItem('sahara_messages');
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });

  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    const saved = localStorage.getItem('sahara_notifications');
    return saved ? dedupeById(JSON.parse(saved)) : INITIAL_NOTIFICATIONS;
  });

  // تعديلات من متصفح/جهاز آخر وصلت من السحابة أثناء فتح الصفحة: تُعاد قراءة المفاتيح التي تغيّرت فقط،
  // بنفس تنظيف التحميل الأول، فتبقى القيمة المحفوظة كما هي ولا يُعاد رفعها
  useEffect(() => {
    const parse = <T,>(key: string): T | null => {
      try {
        const saved = localStorage.getItem(key);
        return saved ? (JSON.parse(saved) as T) : null;
      } catch {
        return null;
      }
    };
    const onCloud = (e: Event) => {
      const keys = (e as CustomEvent<string[]>).detail ?? [];
      const has = (k: string) => keys.includes(k);
      if (has('sahara_tanks')) { const v = parse<TankItem[]>('sahara_tanks'); if (Array.isArray(v)) setTanks(v); }
      if (has('sahara_fuel_metrics')) {
        const v = parse<FuelProductMetric[]>('sahara_fuel_metrics');
        if (Array.isArray(v)) setFuelMetrics(withAllFuelCards(v));
      }
      if (has('sahara_supplier_prices')) { const v = parse<SupplierPriceRecord[]>('sahara_supplier_prices'); if (Array.isArray(v)) setSupplierPrices(v); }
      if (has('sahara_inbound_deliveries')) { const v = parse<InboundDelivery[]>('sahara_inbound_deliveries'); if (Array.isArray(v)) setSaharaDeliveries(dedupeIds(v.filter(isRealDelivery).map(normalizeDeliveryItem))); }
      if (has('etihad_inbound_deliveries')) { const v = parse<InboundDelivery[]>('etihad_inbound_deliveries'); if (Array.isArray(v)) setEtihadDeliveries(dedupeIds(v.filter(isRealDelivery).map(normalizeDeliveryItem))); }
      if (has('sahara_supply_requests')) { const v = parse<SupplyRequest[]>('sahara_supply_requests'); if (Array.isArray(v)) setSupplyRequests(v); }
      if (has('sahara_tasks')) { const v = parse<OperationalTask[]>('sahara_tasks'); if (Array.isArray(v)) setTasks(v); }
      if (has('sahara_messages')) { const v = parse<DispatchMessage[]>('sahara_messages'); if (Array.isArray(v)) setMessages(v); }
      if (has('sahara_notifications')) { const v = parse<SystemNotification[]>('sahara_notifications'); if (Array.isArray(v)) setNotifications(dedupeById(v)); }
    };
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('sahara_tanks', JSON.stringify(tanks));
  }, [tanks]);

  useEffect(() => {
    localStorage.setItem('sahara_fuel_metrics', JSON.stringify(fuelMetrics));
  }, [fuelMetrics]);

  useEffect(() => {
    localStorage.setItem('sahara_supplier_prices', JSON.stringify(supplierPrices));
  }, [supplierPrices]);

  // الموردون الحقيقيون من أرشيف الوارد: يُحذف التجريبيون مرة واحدة (ما لم يعدّلهم المستخدم)،
  // ويُضاف أي مورد جديد يظهر في الوارد تلقائيًا بسعر آخر شحنة له
  useEffect(() => {
    if (!saharaDeliveries.length && !etihadDeliveries.length) return;
    setSupplierPrices(prev => {
      let list = prev;
      // لمرة واحدة: حذف بيانات الموردين الحالية (بما فيها الأسماء المقطوعة من استيراد خاطئ) ونقل الموردين
      // من أرشيف وارد الصحاري والاتحاد. العلامة تُزامَن مع الخادم فلا يتكرر الحذف على بقية الأجهزة
      if (!localStorage.getItem(SUPPLIERS_RESET_V3_KEY)) {
        list = buildArchiveSuppliers(saharaDeliveries, etihadDeliveries);
        [SUPPLIERS_RESET_V3_KEY, MOCK_SUPPLIERS_REMOVED_KEY, SUPPLIER_NAMES_REPAIRED_KEY, SUPPLIER_SOURCE_V2_KEY, SUPPLIER_COLOR_YELLOW_KEY]
          .forEach(k => localStorage.setItem(k, '1'));
        return list;
      }
      if (!localStorage.getItem(MOCK_SUPPLIERS_REMOVED_KEY)) {
        const seed = new Map(INITIAL_SUPPLIER_PRICES_MOCK.map(m => [m.id, m.supplierName]));
        list = list.filter(s => seed.get(s.id) !== s.supplierName);
        localStorage.setItem(MOCK_SUPPLIERS_REMOVED_KEY, '1');
      }
      // فصل الصحاري عن الاتحاد: السجلات المستخرجة قبل الفصل (بلا شركة) تُستبدل بسجل لكل شركة،
      // مع نقل ما أدخله المستخدم (الهاتف، الموقع، المندوب، الشعار، التصنيف)
      const legacy = list.filter(s => s.id.startsWith('sup-a-') && !s.company);
      if (legacy.length) list = list.filter(s => !legacy.includes(s));
      // مورد أُضيف تلقائيًا من الأرشيف ولم تعد له أي شحنة (حُذفت، مثل استيراد خاطئ بأسماء مقطوعة) يُحذف،
      // ما لم يُدخل له المستخدم بيانات. بدون ذلك تبقى الأسماء الخاطئة في مؤشرات الأسعار وتحجب الأسماء الصحيحة
      const orphan = (x: SupplierPriceRecord) =>
        x.id.startsWith('sup-a-') && !!x.company && !(x.phone || x.location || x.contactName || x.logo) &&
        !deliveriesOfSupplier(x.company === 'etihad' ? etihadDeliveries : saharaDeliveries, d => d, x.supplierName).length;
      if (list.some(orphan)) list = list.filter(x => !orphan(x));
      const missing = buildArchiveSuppliers(saharaDeliveries, etihadDeliveries)
        .filter(a => !list.some(s => (!s.company || s.company === a.company) && sameSupplier(s.supplierName, a.supplierName)))
        .map(a => {
          const old = legacy.find(l => sameSupplier(l.supplierName, a.supplierName));
          return old ? { ...a, phone: old.phone, location: old.location, contactName: old.contactName, contactRole: old.contactRole, logo: old.logo, category: old.category } : a;
        });
      // إصلاح لمرة واحدة: نقل الأسماء أثناء الفصل أعطى بعض السجلات اسم مورد قريب؛ يُعاد لكل سجل أرشيف اسمه الأصلي
      if (!localStorage.getItem(SUPPLIER_NAMES_REPAIRED_KEY)) {
        const built = new Map(buildArchiveSuppliers(saharaDeliveries, etihadDeliveries).map(b => [b.id, b.supplierName]));
        list = list.map(x => (built.has(x.id) && built.get(x.id) !== x.supplierName ? { ...x, supplierName: built.get(x.id)! } : x));
        localStorage.setItem(SUPPLIER_NAMES_REPAIRED_KEY, '1');
      }
      // لمرة واحدة: المورد صار يُؤخذ من «اسم المجهز» أولًا ثم «الشركة المجهزة»؛ يُعاد حساب سجلات الأرشيف بهذه القاعدة.
      // يُحذف السجل الذي لم يعد له وارد (ما لم يُدخل له المستخدم بيانات)، ويُبقى السعر الذي عدّله المستخدم بعد آخر وارد
      if (!localStorage.getItem(SUPPLIER_SOURCE_V2_KEY)) {
        const built = new Map(buildArchiveSuppliers(saharaDeliveries, etihadDeliveries).map(b => [b.id, b]));
        const hasUserData = (x: SupplierPriceRecord) => !!(x.phone || x.location || x.contactName || x.logo);
        list = list
          .filter(x => !x.id.startsWith('sup-a-') || built.has(x.id) || hasUserData(x))
          .map(x => {
            const b = built.get(x.id);
            if (!b) return x;
            const manual = (x.lastUpdated || '').replace(/-/g, '/') > b.lastUpdated;
            return manual ? x : { ...x, priceIqd: b.priceIqd, previousPriceIqd: b.previousPriceIqd, changePercent: b.changePercent, lastUpdated: b.lastUpdated, history: b.history, product: b.product || x.product };
          });
        localStorage.setItem(SUPPLIER_SOURCE_V2_KEY, '1');
      }
      // مورد أُدخل يدويًا بلا شركة: يُنسب للشركة التي ورد إليها أكثر
      if (list.some(x => !x.company)) {
        list = list.map(x => {
          if (x.company) return x;
          const n = (ds: InboundDelivery[]) => deliveriesOfSupplier(ds, d => d, x.supplierName).length;
          const sa = n(saharaDeliveries), et = n(etihadDeliveries);
          return sa || et ? { ...x, company: et > sa ? 'etihad' : 'sahara' } : x;
        });
      }
      // الكثافة واللون: تُملأ مرة من الأرشيف للسجلات التي لم تُضبط فيها بعد
      // (قيم الأرشيف الفارغة «_»/«0» التي نُسخت سابقًا تُعامل كغير مضبوطة)
      const unset = (v?: string) => v === undefined || (v !== '' && !archiveValue(v));
      if (list.some(x => unset(x.density) || unset(x.color))) {
        const built = buildArchiveSuppliers(saharaDeliveries, etihadDeliveries);
        let touched = false;
        const filled = list.map(x => {
          if (!unset(x.density) && !unset(x.color)) return x;
          const b = built.find(a => a.id === x.id) ?? built.find(a => a.company === x.company && sameSupplier(a.supplierName, x.supplierName));
          if (!b) return x;
          const density = unset(x.density) ? b.density : x.density, color = unset(x.color) ? b.color : x.color;
          if (density === x.density && color === x.color) return x;
          touched = true;
          return { ...x, density, color };
        });
        if (touched) list = filled;
      }
      // لمرة واحدة: «أصفر مخضر» المنسوخ من الأرشيف يصبح «أصفر» في سجلات الأسعار
      if (!localStorage.getItem(SUPPLIER_COLOR_YELLOW_KEY)) {
        if (list.some(x => recordColor(x.color) !== x.color)) list = list.map(x => (recordColor(x.color) !== x.color ? { ...x, color: recordColor(x.color) } : x));
        localStorage.setItem(SUPPLIER_COLOR_YELLOW_KEY, '1');
      }
      return missing.length || list !== prev ? [...list, ...missing] : prev;
    });
  }, [saharaDeliveries, etihadDeliveries]);

  useEffect(() => {
    localStorage.setItem('sahara_inbound_deliveries', JSON.stringify(saharaDeliveries));
  }, [saharaDeliveries]);

  useEffect(() => {
    localStorage.setItem('etihad_inbound_deliveries', JSON.stringify(etihadDeliveries));
  }, [etihadDeliveries]);

  // المفتاح القديم كان يجمع وارد الشركتين معًا؛ بعد الترحيل لمفتاحين منفصلين يُحذف
  // حتى تبقى بيانات كل شركة منفصلة تمامًا (محليًا وعلى الخادم)
  useEffect(() => {
    localStorage.removeItem('sahara_deliveries');
  }, []);

  useEffect(() => {
    localStorage.setItem('sahara_supply_requests', JSON.stringify(supplyRequests));
  }, [supplyRequests]);

  useEffect(() => {
    localStorage.setItem('sahara_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('sahara_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('sahara_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addDelivery = (delivery: Omit<InboundDelivery, 'id'>, targetCompany?: 'صحاري كربلاء' | 'شركة الاتحاد') => {
    const assignedCompany = targetCompany || delivery.company || 'صحاري كربلاء';
    const isEtihad = assignedCompany === 'شركة الاتحاد';

    const qty = delivery.receivedQuantity ?? delivery.volumeLiters ?? 0;
    const price = delivery.productPrice ?? delivery.pricePerLiter ?? 0;
    const cost = delivery.productCost ?? delivery.totalCostIqd ?? (qty * price);
    const formatVoucher = (val?: string) => {
      if (!val) return `2026${Date.now().toString().slice(-4)}`;
      const digits = val.replace(/\D/g, '');
      return digits || val;
    };
    const voucher = formatVoucher(delivery.voucherNumber || delivery.receiptNumber);

    const newDelivery: InboundDelivery = {
      ...delivery,
      id: newDeliveryId(),
      company: assignedCompany,
      supplierCompany: delivery.supplierCompany || delivery.supplierName || 'مصفى كربلاء الدولي',
      driverName: delivery.driverName || 'سائق غير محدد',
      truckNumber: delivery.truckNumber || 'غير محدد',
      voucherNumber: voucher,
      receivedQuantity: qty,
      productDensity: delivery.productDensity || '0.840',
      productColor: delivery.productColor || 'أصفر مخضر',
      productPrice: price,
      productCost: cost,
      receiptUnloadDate: (delivery.receiptUnloadDate ? delivery.receiptUnloadDate.split(' ')[0] : new Date().toISOString().split('T')[0].replace(/-/g, '/')),
      volumeLiters: qty,
      pricePerLiter: price,
      totalCostIqd: cost,
      receiptNumber: voucher,
      supplierName: delivery.supplierName || '',
    };

    if (isEtihad) {
      setEtihadDeliveries((prev) => [newDelivery, ...prev]);
    } else {
      setSaharaDeliveries((prev) => [newDelivery, ...prev]);
    }

    // Add notification
    const newNotif: SystemNotification = {
      id: newId('notif'),
      title: 'شحنة واردة جديدة',
      message: `تم تسجيل وصول الشحنة وفوجر رقم ${voucher} بحجم ${qty.toLocaleString()} لتر لصالح ${assignedCompany}.`,
      key: 'inbound',
      params: { voucher, qty, company: assignedCompany },
      timestamp: 'الآن',
      read: false,
      type: 'success',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const updateDelivery = (id: string, updatedFields: Partial<InboundDelivery>) => {
    const updateItem = (item: InboundDelivery) => {
      if (item.id !== id) return item;
      const qty = updatedFields.receivedQuantity ?? item.receivedQuantity ?? 0;
      const price = updatedFields.productPrice ?? item.productPrice ?? 0;
      const cost = updatedFields.productCost ?? (qty * price);
      return {
        ...item,
        ...updatedFields,
        receivedQuantity: qty,
        productPrice: price,
        productCost: cost,
        volumeLiters: qty,
        pricePerLiter: price,
        totalCostIqd: cost,
      };
    };

    setSaharaDeliveries((prev) => prev.map(updateItem));
    setEtihadDeliveries((prev) => prev.map(updateItem));
  };

  const deleteDelivery = (id: string) => {
    setSaharaDeliveries((prev) => prev.filter((item) => item.id !== id));
    setEtihadDeliveries((prev) => prev.filter((item) => item.id !== id));
  };

  const resetDeliveries = (targetCompany?: 'صحاري كربلاء' | 'شركة الاتحاد') => {
    if (targetCompany === 'شركة الاتحاد') {
      setEtihadDeliveries([]);
    } else if (targetCompany === 'صحاري كربلاء') {
      setSaharaDeliveries([]);
    } else {
      setSaharaDeliveries([]);
      setEtihadDeliveries([]);
    }
  };

  const addSupplyRequest = (request: Omit<SupplyRequest, 'id'>) => {
    const newRequest: SupplyRequest = {
      ...request,
      id: newId('req'),
    };
    setSupplyRequests((prev) => [newRequest, ...prev]);

    const newNotif: SystemNotification = {
      id: newId('notif'),
      title: 'طلب تجهيز وقود جديد',
      message: `تم إرسال طلب تزويد ${request.volumeLiters.toLocaleString()} لتر لصالح ${request.beneficiary}.`,
      key: 'supply',
      params: { qty: request.volumeLiters, beneficiary: request.beneficiary },
      timestamp: 'الآن',
      read: false,
      type: 'info',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const addMessage = (text: string, isEmergency = false) => {
    const newMsg: DispatchMessage = {
      id: newId('msg'),
      sender: 'ali - مدير النظام',
      role: 'الإدارة المركزية',
      text,
      timestamp: new Intl.DateTimeFormat('ar-IQ', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
      isEmergency,
      badgeColor: 'blue',
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const markNotificationRead = (notifId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const updateTankLevel = (tankId: string, deltaLiters: number) => {
    setTanks((prev) =>
      prev.map((tank) => {
        if (tank.id !== tankId) return tank;
        const nextVolume = Math.max(0, Math.min(tank.capacityLiters, tank.currentLiters + deltaLiters));
        const percentage = Math.round((nextVolume / tank.capacityLiters) * 100);
        let status: 'safe' | 'warning' | 'critical' = 'safe';
        if (percentage < 30) status = 'critical';
        else if (percentage < 60) status = 'warning';

        return {
          ...tank,
          currentLiters: nextVolume,
          percentage,
          status,
          lastUpdated: 'الآن',
        };
      })
    );
  };

  const saveSupplier = (supplier: SupplierPriceRecord) => {
    // السجل: يُكتب خارج دالة التحديث (قد تُستدعى مرتين في وضع التطوير)
    const before = supplierPrices.find(s => s.id === supplier.id);
    const fields: [keyof SupplierPriceRecord, string][] = [['supplierName', 'name'], ['product', 'product'], ['density', 'density'], ['color', 'color'], ['priceIqd', 'price'], ['company', 'company'], ['category', 'category'], ['phone', 'phone'], ['location', 'location'], ['logo', 'logo']];
    const changes = before ? fields.filter(([k]) => (before[k] ?? '') !== (supplier[k] ?? '')).map(([, n]) => n) : [];
    if (!before || changes.length) {
      logPrice({
        source: 'suppliers', action: before ? 'update' : 'create', key: supplier.id, name: supplier.supplierName,
        company: supplier.company, product: supplier.product, density: supplier.density, color: supplier.color,
        prevPrice: before ? before.priceIqd : null, price: supplier.priceIqd, changes,
      });
    }
    const d = new Date();
    const today = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    setSupplierPrices(prev => {
      const old = prev.find(s => s.id === supplier.id);
      if (!old) {
        const rec = { ...supplier, previousPriceIqd: supplier.previousPriceIqd || supplier.priceIqd, changePercent: 0, lastUpdated: today, history: [{ date: today, price: supplier.priceIqd }] };
        return [...prev, rec];
      }
      const priceChanged = old.priceIqd !== supplier.priceIqd;
      const next: SupplierPriceRecord = priceChanged
        ? {
            ...supplier,
            previousPriceIqd: old.priceIqd,
            changePercent: old.priceIqd ? Math.round(((supplier.priceIqd - old.priceIqd) / old.priceIqd) * 10000) / 100 : 0,
            lastUpdated: today,
            history: [{ date: today, price: supplier.priceIqd }, ...(old.history ?? [{ date: old.lastUpdated, price: old.priceIqd }])].slice(0, 60),
          }
        : { ...supplier, history: old.history };
      return prev.map(s => (s.id === supplier.id ? next : s));
    });
  };

  const deleteSupplier = (id: string) => {
    const before = supplierPrices.find(s => s.id === id);
    if (before) {
      logPrice({
        source: 'suppliers', action: 'delete', key: id, name: before.supplierName, company: before.company,
        product: before.product, density: before.density, color: before.color, prevPrice: before.priceIqd, price: null,
      });
    }
    setSupplierPrices(prev => prev.filter(s => s.id !== id));
  };

  const refreshAllData = () => {
    setTanks([...INITIAL_TANKS]);
    setFuelMetrics([...INITIAL_FUEL_METRICS]);
    setSupplierPrices([...INITIAL_SUPPLIER_PRICES]);
    setSaharaDeliveries([]);
    setEtihadDeliveries([]);
    setSupplyRequests([...INITIAL_SUPPLY_REQUESTS]);
    setTasks([...INITIAL_TASKS]);
    setMessages([...INITIAL_MESSAGES]);
  };

  const nav = useMemo<FuelNavState>(
    () => ({ activeTab, setActiveTab, searchQuery, setSearchQuery, currentSubpage, setCurrentSubpage, navigateBack, canGoBack }),
    [activeTab, setActiveTab, searchQuery, currentSubpage, navigateBack, canGoBack]
  );
  // الدوال تُنشأ في كل عرض لكنها تقرأ الحالة عبر المتغيرات أعلاه فقط، فيكفي تحديث القيمة عند تغيّر الحالة
  const store = useMemo<FuelStore>(
    () => ({
      tanks,
      fuelMetrics,
      supplierPrices,
      deliveries,
      saharaDeliveries,
      etihadDeliveries,
      supplyRequests,
      managers,
      tasks,
      messages,
      notifications,
      addDelivery,
      updateDelivery,
      deleteDelivery,
      resetDeliveries,
      addSupplyRequest,
      addMessage,
      toggleTask,
      markNotificationRead,
      markAllNotificationsRead,
      updateTankLevel,
      refreshAllData,
      saveSupplier,
      deleteSupplier,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tanks, fuelMetrics, supplierPrices, deliveries, saharaDeliveries, etihadDeliveries, supplyRequests, managers, tasks, messages, notifications]
  );

  return (
    <FuelNavContext.Provider value={nav}>
      <FuelStoreContext.Provider value={store}>
        {children}
      </FuelStoreContext.Provider>
    </FuelNavContext.Provider>
  );
};


/** البيانات فقط: لا تعيد الرسم عند التنقل أو البحث */
export const useFuelStore = (): FuelStore => {
  const store = useContext(FuelStoreContext);
  if (!store) throw new Error('useFuelStore must be used within a FuelDataProvider');
  return store;
};

/** التنقل فقط (الصفحة الحالية، البحث، الصفحة الفرعية) */
export const useFuelNav = (): FuelNavState => {
  const nav = useContext(FuelNavContext);
  if (!nav) throw new Error('useFuelNav must be used within a FuelDataProvider');
  return nav;
};

/** البيانات والتنقل معًا (للمكوّنات التي تحتاج الاثنين) */
export const useFuelData = (): FuelDataContextType => ({ ...useFuelStore(), ...useFuelNav() });
