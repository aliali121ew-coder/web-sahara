import React, { createContext, useContext, useState, useEffect, useCallback, startTransition } from 'react';
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
  INITIAL_SUPPLY_REQUESTS,
  INITIAL_MANAGERS,
  INITIAL_TASKS,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS
} from '../lib/mockData';

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
}

const VALID_TABS: NavTabId[] = [
  'dashboard',
  'tanks',
  'prices',
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

const FuelDataContext = createContext<FuelDataContextType | undefined>(undefined);

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
        if (Array.isArray(parsed)) {
          // Sync names and properties with latest INITIAL_FUEL_METRICS
          return parsed.map((item: any) => {
            const initial = INITIAL_FUEL_METRICS.find(i => i.id === item.id);
            return initial ? { ...item, name: initial.name } : item;
          });
        }
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

  return (
    <FuelDataContext.Provider
      value={{
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        currentSubpage,
        setCurrentSubpage,
        navigateBack,
        canGoBack,
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
      }}
    >
      {children}
    </FuelDataContext.Provider>
  );
};


export const useFuelData = (): FuelDataContextType => {
  const context = useContext(FuelDataContext);
  if (!context) {
    throw new Error('useFuelData must be used within a FuelDataProvider');
  }
  return context;
};
