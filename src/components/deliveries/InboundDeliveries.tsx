import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Truck,
  Plus,
  FileText,
  Search,
  Calendar,
  DollarSign,
  Gauge,
  User,
  Printer,
  X,
  CheckCircle2,
  Download,
  Edit,
  Trash2,
  RotateCcw,
  Fuel,
  ChevronLeft,
  ChevronRight,
  Image,
  Paperclip,
  Eye,
  SlidersHorizontal,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Layers,
  LayoutTemplate,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation, Trans } from 'react-i18next';
import { enumText } from '../../i18n/enums';
import { Breadcrumb } from '../navigation/Breadcrumb';
import { useQuickAction } from '../../context/QuickActionContext';
import { formatNumber, formatIQD, getBusinessDate } from '../../lib/utils';
import { InboundDelivery } from '../../types';
import { computeInboundPriceStats, deliveryDay } from '../../lib/inboundPrice';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import {
  InboundPrintReport,
  PRINT_AVAILABLE_COLUMNS,
  DEFAULT_PRINT_COLUMNS,
  PrintPaperSize,
  PrintOrientation,
  PrintDensity,
} from './InboundPrintReport';

/** عنوان العمود: deliveries:col.<id> */
export interface ColumnConfig {
  id: string;
  isDefault: boolean;
}

export const ALL_INBOUND_COLUMNS: ColumnConfig[] = [
  { id: 'supplier', isDefault: true },
  { id: 'company', isDefault: true },
  { id: 'driver', isDefault: true },
  { id: 'truckNumber', isDefault: true },
  { id: 'voucherNumber', isDefault: true },
  { id: 'quantity', isDefault: true },
  { id: 'density', isDefault: false },
  { id: 'color', isDefault: false },
  { id: 'price', isDefault: false },
  { id: 'cost', isDefault: true },
  { id: 'receiptDate', isDefault: true },
  { id: 'attachments', isDefault: true },
];

const DEFAULT_COLUMNS_STATE: Record<string, boolean> = ALL_INBOUND_COLUMNS.reduce(
  (acc, col) => ({ ...acc, [col.id]: col.isDefault }),
  {}
);

interface InboundDeliveriesProps {
  onOpenModal?: (delivery?: any) => void;
  /** daily: وارد يوم العمل الحالي فقط (من 7 صباحًا إلى 7 صباحًا) — archive: الأرشيف الكامل */
  variant?: 'daily' | 'archive';
  /** فرض نطاق الشركة عند التضمين خارج تبويب الوارد (مثل مركز التقارير) */
  scope?: 'sahara' | 'etihad';
}

// كارتات المؤشرات أعلى الصفحة: ارتفاع موحّد، والرقم في منتصف المساحة تحت العنوان
const KPI_CARD = 'p-4 min-h-[112px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card flex flex-col';
const KPI_HEAD = 'flex items-center justify-between gap-2 text-slate-400';
const KPI_BODY = 'flex-1 flex items-center justify-center gap-0.5 text-center pt-2';


export const InboundDeliveries: React.FC<InboundDeliveriesProps> = ({ onOpenModal, variant = 'daily', scope }) => {
  const {
    deliveries,
    saharaDeliveries,
    etihadDeliveries,
    searchQuery,
    updateDelivery,
    deleteDelivery,
    activeTab,
    setActiveTab
  } = useFuelData();
  const { isRTL } = useLanguage();
  const { t } = useTranslation(['deliveries', 'common']);
  const openQuickAction = useQuickAction();

  // 🔒 Strict Scope Isolation: determine active company domain
  const isSaharaScoped = scope ? scope === 'sahara' : activeTab === 'deliveries-sahara';
  const isEtihadScoped = scope ? scope === 'etihad' : activeTab === 'deliveries-etihad';
  const isArchive = variant === 'archive';
  const lockedCompanyName = isSaharaScoped ? 'صحاري كربلاء' : isEtihadScoped ? 'شركة الاتحاد' : null;

  // 🔒 Isolated Data Source:
  // - In Sahara section: strictly saharaDeliveries
  // - In Etihad section: strictly etihadDeliveries
  // - Global: combined deliveries
  // يوم العمل الحالي — يُحدَّث كل دقيقة ليتبدّل تلقائيًا عند الساعة 7 صباحًا
  const [businessDay, setBusinessDay] = useState(() => getBusinessDate());
  useEffect(() => {
    const id = setInterval(() => setBusinessDay(getBusinessDate()), 60_000);
    return () => clearInterval(id);
  }, []);

  const scopedDeliveries = useMemo(() => {
    const base = isSaharaScoped ? saharaDeliveries : isEtihadScoped ? etihadDeliveries : deliveries;
    if (isArchive) return base;

    // الوارد اليومي: يظهر أحدث تاريخ فقط ضمن يوم العمل الحالي، والأقدم يبقى في الأرشيف
    const latest = base.reduce((max, d) => (deliveryDay(d) > max ? deliveryDay(d) : max), '');
    const target = latest >= businessDay ? latest : businessDay;
    return base.filter(d => deliveryDay(d) === target);
  }, [isSaharaScoped, isEtihadScoped, saharaDeliveries, etihadDeliveries, deliveries, isArchive, businessDay]);

  const [localSearch, setLocalSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState<string>(() => {
    if (isSaharaScoped) return 'صحاري كربلاء';
    if (isEtihadScoped) return 'شركة الاتحاد';
    return 'الكل';
  });

  useEffect(() => {
    if (isSaharaScoped) {
      setFilterCompany('صحاري كربلاء');
    } else if (isEtihadScoped) {
      setFilterCompany('شركة الاتحاد');
    }
  }, [isSaharaScoped, isEtihadScoped]);

  const [filterSupplier, setFilterSupplier] = useState<string>('الكل');
  const [filterSupplierCompany, setFilterSupplierCompany] = useState<string>('الكل');
  const [filterFuelType, setFilterFuelType] = useState<string>('الكل');
  // فلتر الفترة (YYYY/MM/DD): فارغ = كل التواريخ
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Pagination State (10 items per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modals & Menus state
  const [selectedVoucher, setSelectedVoucher] = useState<InboundDelivery | null>(null);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);
  const editingDelivery: any = null;
  const setEditingDelivery = (_val?: any) => { void _val; };
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // وضع التعديل: تعديل مباشر للحقول داخل الجدول + تحديد متعدد للحذف
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [openMenuDeliveryId, setOpenMenuDeliveryId] = useState<string | null>(null);
  // موضع قائمة الإجراءات على الشاشة (ثابت) حتى لا تُقص داخل حاوية الجدول عند قلة الصفوف
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!openMenuDeliveryId) return;
    const close = () => setOpenMenuDeliveryId(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenuDeliveryId]);
  const [previewFile, setPreviewFile] = useState<{ id: string; name: string; url: string; type: string; size?: number } | null>(null);

  // Column Visibility State with Persistence
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sahara_inbound_visible_columns');
      if (saved) {
        return { ...DEFAULT_COLUMNS_STATE, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading visible columns', e);
    }
    return DEFAULT_COLUMNS_STATE;
  });

  // Print Specific Configuration State
  const [printVisibleColumns, setPrintVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sahara_print_visible_columns');
      if (saved) {
        return { ...DEFAULT_PRINT_COLUMNS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading print columns', e);
    }
    return DEFAULT_PRINT_COLUMNS;
  });
  const [printPaperSize, setPrintPaperSize] = useState<PrintPaperSize>('auto');
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>('auto');
  const [printDensity, setPrintDensity] = useState<PrintDensity>('normal');
  const [printShowLogos, setPrintShowLogos] = useState<boolean>(true);
  const [printShowKpis, setPrintShowKpis] = useState<boolean>(true);
  const [printShowSignatures, setPrintShowSignatures] = useState<boolean>(true);
  const [isPrintColDropdownOpen, setIsPrintColDropdownOpen] = useState<boolean>(false);

  const printActiveColCount = useMemo(() => {
    return PRINT_AVAILABLE_COLUMNS.filter(col => printVisibleColumns[col.id] ?? col.defaultVisible).length;
  }, [printVisibleColumns]);

  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [viewAllAttachmentsId, setViewAllAttachmentsId] = useState<string | null>(null);

  // الأيام التي فيها شحنات (علامة في التقويم)
  const deliveryDays = useMemo(() => new Set(scopedDeliveries.map(deliveryDay)), [scopedDeliveries]);

  // نص فلتر التاريخ: كل التواريخ / يوم واحد / فترة (من ← إلى)
  const dateRangeLabel = !dateFrom ? '' : dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`;

  useEffect(() => {
    try {
      localStorage.setItem('sahara_inbound_visible_columns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.error('Error saving visible columns', e);
    }
  }, [visibleColumns]);

  useEffect(() => {
    try {
      localStorage.setItem('sahara_print_visible_columns', JSON.stringify(printVisibleColumns));
    } catch (e) {
      console.error('Error saving print visible columns', e);
    }
  }, [printVisibleColumns]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (viewAllAttachmentsId || previewFile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewAllAttachmentsId, previewFile]);

  const toggleColumn = (colId: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [colId]: !prev[colId],
    }));
  };

  const handleShowAllColumns = () => {
    const allTrue = ALL_INBOUND_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: true }), {});
    setVisibleColumns(allTrue);
  };

  const handleResetToDefaultColumns = () => {
    setVisibleColumns(DEFAULT_COLUMNS_STATE);
  };

  // Total visible columns count (+2 for sequence # and actions, +1 for the selection checkbox in edit mode)
  const activeColumnsCount = Object.values(visibleColumns).filter(Boolean).length + 2 + (editMode ? 1 : 0);

  // Extract unique companies & suppliers with useMemo
  const companiesList = useMemo(() => {
    if (lockedCompanyName) return [lockedCompanyName];
    return ['الكل', ...Array.from(new Set(scopedDeliveries.map((d) => d.company || 'صحاري كربلاء')))];
  }, [lockedCompanyName, scopedDeliveries]);

  // اسم المجهز (الشخص) والشركة المجهزة — السجلات القديمة تحمل قيمة واحدة في الحقلين
  const supplierPersonOf = (d: InboundDelivery) =>
    d.supplierName && d.supplierName !== d.supplierCompany ? d.supplierName : '';
  const supplierCompanyOf = (d: InboundDelivery) => d.supplierCompany || d.supplierName || 'مصفى كربلاء الدولي';
  const suppliersList = useMemo(() => ['الكل', ...Array.from(new Set(scopedDeliveries.map(supplierPersonOf).filter(Boolean)))], [scopedDeliveries]);
  const supplierCompaniesList = useMemo(() => ['الكل', ...Array.from(new Set(scopedDeliveries.map(supplierCompanyOf)))], [scopedDeliveries]);
  const fuelTypesList = useMemo(() => ['الكل', 'كاز', 'بنزين', 'نفط أسود', 'ديزل'], []);

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, localSearch, filterCompany, filterSupplier, filterSupplierCompany, filterFuelType, dateFrom, dateTo]);

  const filteredDeliveries = useMemo(() => {
    const q = (searchQuery || localSearch).trim().toLowerCase();

    return scopedDeliveries.filter((d) => {
      const comp = (d.company || 'صحاري كربلاء').toLowerCase();
      const supp = (d.supplierCompany || d.supplierName || '').toLowerCase();
      const driver = (d.driverName || '').toLowerCase();
      const truck = (d.truckNumber || '').toLowerCase();
      const voucher = (d.voucherNumber || d.receiptNumber || '').toLowerCase();
      const color = (d.productColor || '').toLowerCase();
      const date = (d.receiptUnloadDate || d.date || '').toLowerCase();
      const prod = (d.product || '').toLowerCase();

      const matchesSearch =
        !q ||
        comp.includes(q) ||
        supp.includes(q) ||
        driver.includes(q) ||
        truck.includes(q) ||
        voucher.includes(q) ||
        color.includes(q) ||
        date.includes(q) ||
        prod.includes(q);

      const matchesCompany = lockedCompanyName
        ? (d.company || 'صحاري كربلاء') === lockedCompanyName
        : filterCompany === 'الكل' || (d.company || 'صحاري كربلاء') === filterCompany;
      const matchesSupplier = filterSupplier === 'الكل' || supplierPersonOf(d) === filterSupplier;
      const matchesSupplierCompany = filterSupplierCompany === 'الكل' || supplierCompanyOf(d) === filterSupplierCompany;
      const matchesFuel = filterFuelType === 'الكل' || color.includes(filterFuelType) || prod.includes(filterFuelType);

      // Date filtering (Year & Month)
      // Date range filtering (من / إلى)
      const day = deliveryDay(d);
      const matchesDate = (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);

      return matchesSearch && matchesCompany && matchesSupplier && matchesSupplierCompany && matchesFuel && matchesDate;
    });
  }, [scopedDeliveries, searchQuery, localSearch, lockedCompanyName, filterCompany, filterSupplier, filterSupplierCompany, filterFuelType, dateFrom, dateTo]);

  // Calculate totals across all matching deliveries with useMemo
  // متوسط السعر ونسبة تغيره بعد آخر وارد (نفس الحساب المستخدم في الصفحة الرئيسية)
  const priceStats = useMemo(() => computeInboundPriceStats(filteredDeliveries), [filteredDeliveries]);
  const { totalQty: totalVolume, totalCost, avgPrice, change: priceChange } = priceStats;

  // Pagination slicing with useMemo
  const totalPages = Math.max(1, Math.ceil(filteredDeliveries.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredDeliveries.length);
  const paginatedDeliveries = useMemo(() => filteredDeliveries.slice(startIndex, endIndex), [filteredDeliveries, startIndex, endIndex]);

  // ✏️ وضع التعديل: التحديد يشمل كل الشحنات المطابقة للفلاتر (كل الصفحات)
  const allSelected = filteredDeliveries.length > 0 && filteredDeliveries.every((d) => selectedIds.has(d.id));
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredDeliveries.map((d) => d.id)));
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const exitEditMode = () => {
    setEditMode(false);
    setSelectedIds(new Set());
  };
  const handleBulkDelete = () => {
    selectedIds.forEach((id) => deleteDelivery(id));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  // حفظ حقل واحد بعد تعديله داخل الجدول (الكمية والسعر يعيدان حساب التكلفة)
  const commitField = (item: InboundDelivery, field: string, raw: string) => {
    const v = raw.trim();
    if (field === 'receivedQuantity' || field === 'productPrice') {
      const n = Number(v.replace(/,/g, ''));
      if (!v || !Number.isFinite(n)) return;
      const qty = field === 'receivedQuantity' ? n : (item.receivedQuantity ?? item.volumeLiters ?? 0);
      const price = field === 'productPrice' ? n : (item.productPrice ?? item.pricePerLiter ?? 0);
      updateDelivery(item.id, {
        receivedQuantity: qty,
        volumeLiters: qty,
        productPrice: price,
        pricePerLiter: price,
        productCost: qty * price,
        totalCostIqd: qty * price,
      });
    } else if (field === 'receiptUnloadDate') {
      if (!v) return;
      updateDelivery(item.id, { receiptUnloadDate: v, date: v });
    } else {
      updateDelivery(item.id, { [field]: v } as Partial<InboundDelivery>);
    }
  };

  const editInput = (item: InboundDelivery, field: string, value: string | number, numeric = false) => (
    <input
      key={`${item.id}-${field}-${value}`}
      type="text"
      inputMode={numeric ? 'decimal' : undefined}
      defaultValue={String(value ?? '')}
      onBlur={(e) => {
        if (e.target.value !== String(value ?? '')) commitField(item, field, e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          e.currentTarget.value = String(value ?? '');
          e.currentTarget.blur();
        }
      }}
      className={`w-full min-w-[90px] px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700/70 bg-amber-50/70 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500 ${numeric ? 'font-sans' : 'font-cairo'}`}
    />
  );

  const formatTruckNumber = (val?: string) => (val || '-').split('/')[0].trim();
  const formatVoucherNumber = (val?: string) => {
    if (!val) return '-';
    const digits = val.replace(/\D/g, '');
    return digits || val;
  };

  // Print summary report
  const handlePrint = () => {
    window.print();
  };

  // Save Edit Delivery
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;

    updateDelivery(editingDelivery.id, {
      company: editingDelivery.company,
      supplierCompany: editingDelivery.supplierCompany,
      supplierName: editingDelivery.supplierName,
      driverName: editingDelivery.driverName,
      truckNumber: editingDelivery.truckNumber,
      voucherNumber: editingDelivery.voucherNumber,
      receivedQuantity: Number(editingDelivery.receivedQuantity),
      volumeLiters: Number(editingDelivery.receivedQuantity),
      productDensity: editingDelivery.productDensity,
      productColor: editingDelivery.productColor,
      productPrice: Number(editingDelivery.productPrice),
      pricePerLiter: Number(editingDelivery.productPrice),
      productCost: Number(editingDelivery.receivedQuantity) * Number(editingDelivery.productPrice),
      totalCostIqd: Number(editingDelivery.receivedQuantity) * Number(editingDelivery.productPrice),
      receiptUnloadDate: editingDelivery.receiptUnloadDate,
      date: editingDelivery.receiptUnloadDate,
    });

    setEditingDelivery(null);
  };

  return (
    <>
      {/* 🖨️ Clean Printable Report for Browser Print (Hidden on Screen, Shown on Print) */}
      <div className="print-only">
        <InboundPrintReport
          deliveries={filteredDeliveries}
          filterCompany={filterCompany}
          filterSupplier={filterSupplier}
          filterFuelType={filterFuelType}
          filterMonthYear={dateRangeLabel}
          visibleColumns={printVisibleColumns}
          paperSize={printPaperSize}
          orientation={printOrientation}
          density={printDensity}
          showHeaderLogos={printShowLogos}
          showKpiCards={printShowKpis}
          showSignatures={printShowSignatures}
          companyName={isSaharaScoped ? 'شركة صحاري كربلاء' : isEtihadScoped ? 'شركة الاتحاد' : null}
        />
      </div>

      {/* Screen Interactive View */}
      <div className="no-print space-y-4">
        {/* Breadcrumb Path (هامش ثابت وموحّد أسفلها في كل صفحات البرنامج) */}
        {!isArchive && <Breadcrumb
          items={[
            {
              label: activeTab === 'deliveries-sahara' ? t('common:enum.company.sahara') : activeTab === 'deliveries-etihad' ? t('common:enum.company.etihad') : t('deliveries:companies'),
              onClick: () => setActiveTab(activeTab === 'deliveries-sahara' ? 'finance-sahara' : 'finance-etihad')
            },
            { label: t('deliveries:inbound') }
          ]}
        />}

        {/* Top Header Card */}
        <div className="!mt-2 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Truck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-cairo">
                  {isArchive
                    ? t('deliveries:archiveTitle')
                    : isSaharaScoped
                    ? t('deliveries:titleSahara')
                    : isEtihadScoped
                    ? t('deliveries:titleEtihad')
                    : t('deliveries:title')}
                </h2>
                {!isArchive && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                    {t('deliveries:businessDay')} {businessDay}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-cairo">
                {isArchive
                  ? t('deliveries:archiveSubtitle')
                  : t('deliveries:subtitle')}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => (editMode ? exitEditMode() : setEditMode(true))}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold active:scale-95 transition-all shadow-2xs cursor-pointer ${
                editMode
                  ? 'bg-slate-600 hover:bg-slate-700 border-slate-600 text-white shadow-md shadow-slate-500/25'
                  : 'border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
              title={t('deliveries:editHint')}
            >
              {editMode ? <Check className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
              <span>{editMode ? t('deliveries:finishEditing') : t('common:actions.edit')}</span>
            </button>

            <button
              onClick={() => setShowPrintReportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-bold active:scale-95 transition-all shadow-2xs cursor-pointer"
              title={t('deliveries:printHint')}
            >
              <Printer className="w-4 h-4" />
              <span>{t('deliveries:printReport')}</span>
            </button>

            {!isArchive && (
            <button
              onClick={() => (onOpenModal ?? openQuickAction)(lockedCompanyName ? { lockedCompany: lockedCompanyName } : undefined)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('deliveries:add')}</span>
            </button>
            )}
          </div>
        </div>

      {/* KPI Top Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* كل الكارتات: العنوان أعلى، والرقم في منتصف المساحة الباقية بنفس الارتفاع */}
        <div className={KPI_CARD}>
          <div className={KPI_HEAD}>
            <span className="text-xs font-bold font-cairo">{t('deliveries:print.kpi.volume')}</span>
            <Fuel className="w-4 h-4 text-blue-600" />
          </div>
          <div className={KPI_BODY}>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-sans">
              {formatNumber(totalVolume)} <span className="text-xs font-bold text-blue-600 font-cairo">{t('common:units.liter')}</span>
            </span>
          </div>
        </div>

        <div className={KPI_CARD}>
          <div className={KPI_HEAD}>
            <span className="text-xs font-bold font-cairo">{t('deliveries:totalCost')}</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className={KPI_BODY}>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 font-sans">
              {formatNumber(totalCost)} <span className="text-xs font-bold font-cairo text-emerald-700 dark:text-emerald-400">{t('common:units.iqd')}</span>
            </span>
          </div>
        </div>

        <div className={KPI_CARD}>
          <div className={KPI_HEAD}>
            <span className="text-xs font-bold font-cairo">{t('deliveries:avgPrice')}</span>
            <Gauge className="w-4 h-4 text-amber-500" />
          </div>
          <div className={KPI_BODY}>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-sans">
              {avgPrice.toFixed(1)} <span className="text-xs font-bold text-amber-600 font-cairo">{t('deliveries:print.iqdPerLiter')}</span>
            </span>
          </div>
        </div>

        {/* معدل سعر آخر وارد (آخر يوم عمل = 24 ساعة) = تكلفته ÷ كميته، وتحته نسبة تغير المتوسط (ارتفاع = أحمر، انخفاض = أخضر) */}
        <div className={KPI_CARD}>
          <div className={KPI_HEAD}>
            <span className="text-xs font-bold font-cairo">{t('deliveries:lastAvg')}</span>
            {priceChange && priceChange.pct <= -0.005
              ? <TrendingDown className="w-4 h-4 text-emerald-600" />
              : priceChange && priceChange.pct >= 0.005
              ? <TrendingUp className="w-4 h-4 text-rose-600" />
              : <Gauge className="w-4 h-4 text-slate-400" />}
          </div>
          {priceChange === null ? (
            <div className={KPI_BODY}>
              <span className="text-xl sm:text-2xl font-black text-slate-400 font-sans">—</span>
            </div>
          ) : (() => {
            const up = priceChange.pct >= 0.005; // ما يظهر 0.00% = بلا سهم
            const down = priceChange.pct <= -0.005;
            const tone = up
              ? { box: 'bg-gradient-to-br from-rose-50 to-rose-100/60 dark:from-rose-950/60 dark:to-rose-900/20 ring-rose-200/80 dark:ring-rose-800/50', icon: 'bg-rose-500 shadow-rose-500/30', text: 'text-rose-600 dark:text-rose-400' }
              : down
              ? { box: 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/60 dark:to-emerald-900/20 ring-emerald-200/80 dark:ring-emerald-800/50', icon: 'bg-emerald-500 shadow-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' }
              : { box: 'bg-slate-50 dark:bg-slate-800/60 ring-slate-200 dark:ring-slate-700', icon: 'bg-slate-400 shadow-slate-400/30', text: 'text-slate-500' };
            return (
              // تصميم مقسوم: السعر يمينًا، والنسبة في لوحة ملوّنة مستقلة يسارًا
              <div
                className="flex-1 flex items-center justify-between gap-2 pt-2"
                title={`${priceChange.lastDay} · ${t('deliveries:shipments', { count: priceChange.lastCount })} · ${formatNumber(priceChange.lastQty)} ${t('common:units.liter')}`}
              >
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-sans leading-none tabular-nums">
                    {priceChange.lastPrice.toFixed(1)}
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-amber-600 font-cairo">{t('deliveries:print.iqdPerLiter')}</div>
                </div>
                <div className={`shrink-0 flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl ring-1 ${tone.box}`}>
                  {(up || down) && (
                    <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center shadow-md ${tone.icon}`}>
                      {down ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    </span>
                  )}
                  <span dir="ltr" className={`text-sm font-black font-sans tabular-nums leading-none ${tone.text}`}>
                    {up ? '+' : down ? '−' : ''}{Math.abs(priceChange.pct).toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        <div className={KPI_CARD}>
          <div className={KPI_HEAD}>
            <span className="text-xs font-bold font-cairo">{t('deliveries:count')}</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className={KPI_BODY}>
            <span className="text-xl sm:text-2xl font-black text-purple-600 font-sans">
              {formatNumber(filteredDeliveries.length)} <span className="text-xs font-bold font-cairo text-purple-700 dark:text-purple-300">{t('deliveries:shipmentUnit', { count: filteredDeliveries.length })}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main ERP Data Table Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card overflow-hidden">
        {/* Filters Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
            <input
              type="text"
              placeholder={t('deliveries:search')}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-cairo`}
            />
          </div>

          {/* Select Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {!lockedCompanyName && (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-bold text-slate-400 font-cairo">{t('deliveries:filter.company')}</span>
                <select
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer font-cairo"
                >
                  {companiesList.map((c) => (
                    <option key={c} value={c} className="bg-white dark:bg-slate-900 font-cairo">
                      {enumText(c)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-400 font-cairo">{t('deliveries:filter.supplier')}</span>
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer max-w-[140px] truncate font-cairo"
              >
                {suppliersList.map((s) => (
                  <option key={s} value={s} className="bg-white dark:bg-slate-900 font-cairo">
                    {enumText(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-400 font-cairo">{t('deliveries:filter.supplierCompany')}</span>
              <select
                value={filterSupplierCompany}
                onChange={(e) => setFilterSupplierCompany(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer max-w-[160px] truncate font-cairo"
              >
                {supplierCompaniesList.map((s) => (
                  <option key={s} value={s} className="bg-white dark:bg-slate-900 font-cairo">
                    {enumText(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-400 font-cairo">{t('deliveries:filter.fuel')}</span>
              <select
                value={filterFuelType}
                onChange={(e) => setFilterFuelType(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer font-cairo"
              >
                {fuelTypesList.map((f) => (
                  <option key={f} value={f} className="bg-white dark:bg-slate-900 font-cairo">
                    {enumText(f)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter: تقويم لاختيار فترة (من / إلى) مع فترات سريعة، والأيام التي فيها وارد عليها علامة */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors font-cairo cursor-pointer ${
                  dateFrom
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400'
                }`}
              >
                <Calendar className={`w-3.5 h-3.5 ${dateFrom ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`} />
                <span className={dateFrom ? 'font-mono' : ''}>{dateRangeLabel || t('deliveries:allDates')}</span>
                {dateFrom ? (
                  <span
                    role="button"
                    title={t('common:calendar.clear')}
                    onClick={(e) => { e.stopPropagation(); setDateFrom(''); setDateTo(''); }}
                    className="p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50"
                  >
                    <X className="w-3 h-3" />
                  </span>
                ) : (
                  <ChevronDown className={`w-3.5 h-3.5 ms-1 transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {isDatePickerOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsDatePickerOpen(false)} />
                  <div className={`absolute top-full mt-2 ${isRTL ? 'right-0' : 'left-0'} z-40 animate-in zoom-in-95 font-cairo`}>
                    <DateRangeCalendar
                      from={dateFrom}
                      to={dateTo}
                      marked={deliveryDays}
                      onApply={(from, to) => { setDateFrom(from); setDateTo(to); setIsDatePickerOpen(false); }}
                      onClear={() => { setDateFrom(''); setDateTo(''); setIsDatePickerOpen(false); }}
                    />
                  </div>
                </>
              )}
            </div>


            {/* 🎛️ Column Selector Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer select-none font-cairo ${
                  isColumnDropdownOpen
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 shadow-2xs hover:bg-blue-50/50 dark:hover:bg-slate-800'
                }`}
                title={t('deliveries:customizeCols')}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{t('deliveries:cols')}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-sans font-black border border-blue-200 dark:border-blue-800">
                  {Object.values(visibleColumns).filter(Boolean).length}/{ALL_INBOUND_COLUMNS.length}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isColumnDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isColumnDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsColumnDropdownOpen(false)} />
                  <div
                    className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl p-3 z-40 animate-in fade-in zoom-in-95 duration-150 font-cairo`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Dropdown Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{t('deliveries:toggleCols')}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans font-bold">
                        {t('deliveries:shownCols', { count: Object.values(visibleColumns).filter(Boolean).length })}
                      </span>
                    </div>

                    {/* Quick Actions: Show All & Reset to Default */}
                    <div className="grid grid-cols-2 gap-1.5 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={handleShowAllColumns}
                        className="px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Check className="w-3 h-3" />
                        <span>{t('deliveries:showAll')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetToDefaultColumns}
                        className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('deliveries:defaultCols')}</span>
                      </button>
                    </div>

                    {/* Checkbox List */}
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {ALL_INBOUND_COLUMNS.map((col) => {
                        const isChecked = !!visibleColumns[col.id];
                        return (
                          <label
                            key={col.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleColumn(col.id)}
                                className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>{t(`deliveries:col.${col.id}`)}</span>
                            </div>
                            {col.isDefault && (
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                {t('deliveries:default')}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ✏️ شريط وضع التعديل: تحديد الكل + حذف المحدد */}
        {editMode && (
          <div className="px-3 sm:px-4 py-2.5 bg-amber-50/90 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/60 flex flex-wrap items-center justify-between gap-3 font-cairo">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-amber-600 cursor-pointer"
                />
                <span>{t('deliveries:selectAll')} (<span className="font-sans">{filteredDeliveries.length}</span>)</span>
              </label>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {t('deliveries:selected')}: <span className="font-sans">{selectedIds.size}</span>
              </span>
              <span className="hidden md:inline text-[11px] text-slate-500 dark:text-slate-400">
                {t('deliveries:editTip')}
              </span>
            </div>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkDeleteOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                selectedIds.size === 0
                  ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-500'
                  : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-md shadow-rose-500/25 cursor-pointer active:scale-95'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('deliveries:deleteSelected')} (<span className="font-sans">{selectedIds.size}</span>)</span>
            </button>
          </div>
        )}

        {/* Clean ERP Responsive Table with Light Navy Header & Soft Zebra Striping */}
        <div className="overflow-x-auto">
          <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs border-collapse min-w-[950px]`}>
            <thead>
              <tr className="bg-gradient-to-r from-[#1c3b6f] via-[#244e91] to-[#1c3b6f] text-white font-black border-b border-[#2d5ea8] text-[11.5px] select-none shadow-xs">
                {/* تحديد - وضع التعديل فقط */}
                {editMode && (
                  <th className="py-3.5 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      title={t('deliveries:selectAll')}
                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                    />
                  </th>
                )}

                {/* التسلسل - دائم */}
                <th className="py-3.5 px-3 text-center w-12 font-sans text-blue-100">#</th>

                {/* 1. اسم المجهز */}
                {visibleColumns.supplier && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.supplier')}</th>
                )}

                {/* 2. الشركة المجهزة */}
                {visibleColumns.company && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.company')}</th>
                )}

                {/* 3. اسم السائق */}
                {visibleColumns.driver && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.driver')}</th>
                )}

                {/* 4. رقم العجلة */}
                {visibleColumns.truckNumber && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.truckNumber')}</th>
                )}

                {/* 5. رقم الفوجر */}
                {visibleColumns.voucherNumber && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.voucherNumber')}</th>
                )}

                {/* 6. الكميه المستلمة */}
                {visibleColumns.quantity && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.quantity')}</th>
                )}

                {/* 7. كثافة المنتج */}
                {visibleColumns.density && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.density')}</th>
                )}

                {/* 8. لون المنتج */}
                {visibleColumns.color && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.color')}</th>
                )}

                {/* 9. سعر المنتج */}
                {visibleColumns.price && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.price')}</th>
                )}

                {/* 10. تكلفة المنتج */}
                {visibleColumns.cost && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.cost')}</th>
                )}

                {/* 11. تاريخ الاستلام */}
                {visibleColumns.receiptDate && (
                  <th className="py-3.5 px-3.5 whitespace-nowrap text-white font-cairo">{t('deliveries:col.receiptDate')}</th>
                )}

                {/* 12. المرفقات */}
                {visibleColumns.attachments && (
                  <th className="py-3.5 px-3.5 text-center whitespace-nowrap text-white font-cairo">{t('deliveries:col.attachments')}</th>
                )}

                {/* الإجراءات - دائم */}
                <th className="py-3.5 px-3.5 text-center whitespace-nowrap w-20 text-white font-cairo">{t('deliveries:actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-cairo">
              {useMemo(() => (
                paginatedDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={activeColumnsCount} className="py-14 text-center text-slate-400">
                    <Truck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2.5 stroke-1" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-400 font-cairo">
                      {t('deliveries:empty')}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedDeliveries.map((item, index) => {
                  // اسم المجهز والشركة المجهزة (السجلات القديمة: قيمة واحدة في الحقلين)
                  const supplierCompanyName = item.supplierCompany || item.supplierName || 'مصفى كربلاء الدولي';
                  const supplierPersonName = supplierPersonOf(item);
                  const voucherNum = item.voucherNumber || item.receiptNumber || `VCH-${item.id}`;
                  const qty = item.receivedQuantity ?? item.volumeLiters ?? 0;
                  const density = item.productDensity || '0.840';
                  const color = item.productColor || 'أصفر مخضر';
                  const price = item.productPrice ?? item.pricePerLiter ?? 0;
                  const cost = item.productCost ?? item.totalCostIqd ?? (qty * price);
                  const receiptDate = item.receiptUnloadDate ? item.receiptUnloadDate.split(' ')[0] : (item.date ? item.date.split(' ')[0] : '2026/08/20');
                  const itemKey = item.id || `row-${startIndex + index}`;
                  const isMenuOpen = openMenuDeliveryId === itemKey;
                  const rowAttachments = (item.attachments && item.attachments.length > 0)
                    ? item.attachments
                    : (item.attachmentUrl
                        ? [{ id: 'att-1', name: item.attachmentName || t('deliveries:voucherFile'), url: item.attachmentUrl, type: (item.attachmentType || 'image') as 'pdf' | 'image', size: item.attachmentSize || 0 }]
                        : []);

                  return (
                    <tr
                      key={itemKey}
                      className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/35 hover:!bg-blue-50/80 dark:hover:!bg-blue-950/40 transition-colors text-slate-700 dark:text-slate-200"
                    >
                      {/* تحديد الصف - وضع التعديل */}
                      {editMode && (
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            className="w-4 h-4 accent-amber-600 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* التسلسل # */}
                      <td className="py-3.5 px-3 text-center font-sans font-bold text-slate-400 text-xs">
                        {startIndex + index + 1}
                      </td>

                      {/* 1. اسم المجهز */}
                      {visibleColumns.supplier && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                          {editMode ? editInput(item, 'supplierName', supplierPersonName) : enumText(supplierPersonName)}
                        </td>
                      )}

                      {/* 2. الشركة المجهزة */}
                      {visibleColumns.company && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-bold text-slate-800 dark:text-slate-100">
                          {editMode ? editInput(item, 'supplierCompany', item.supplierCompany || '') : enumText(supplierCompanyName)}
                        </td>
                      )}

                      {/* 3. اسم السائق */}
                      {visibleColumns.driver && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {editMode ? editInput(item, 'driverName', item.driverName || '') : (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold">{enumText(item.driverName || t('deliveries:noDriver'))}</span>
                          </div>
                          )}
                        </td>
                      )}

                      {/* 4. رقم العجلة */}
                      {visibleColumns.truckNumber && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {editMode ? editInput(item, 'truckNumber', item.truckNumber || '') : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 font-sans font-bold text-[11px]">
                            {formatTruckNumber(item.truckNumber)}
                          </span>
                          )}
                        </td>
                      )}

                      {/* 5. رقم الفوجر */}
                      {visibleColumns.voucherNumber && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-sans font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {editMode ? editInput(item, 'voucherNumber', item.voucherNumber || item.receiptNumber || '') : formatVoucherNumber(voucherNum)}
                        </td>
                      )}

                      {/* 6. الكميه المستلمة */}
                      {visibleColumns.quantity && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-sans font-bold text-slate-900 dark:text-white">
                          {editMode ? editInput(item, 'receivedQuantity', qty, true) : (<>
                          <span>{formatNumber(qty)}</span>
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 ms-1 font-cairo font-semibold">{t('common:units.liter')}</span>
                          </>)}
                        </td>
                      )}

                      {/* 7. كثافة المنتج */}
                      {visibleColumns.density && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-sans text-slate-700 dark:text-slate-300 font-semibold">
                          {editMode ? editInput(item, 'productDensity', item.productDensity || '', true) : (
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                            {density}
                          </span>
                          )}
                        </td>
                      )}

                      {/* 8. لون المنتج */}
                      {visibleColumns.color && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                          {editMode ? editInput(item, 'productColor', item.productColor || '') : enumText(color)}
                        </td>
                      )}

                      {/* 9. سعر المنتج */}
                      {visibleColumns.price && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-sans font-semibold text-slate-800 dark:text-slate-200">
                          {editMode ? editInput(item, 'productPrice', price, true) : (<>
                          {price.toLocaleString()} <span className="text-[10px] text-slate-400 font-cairo">{t('common:units.iqd')}</span>
                          </>)}
                        </td>
                      )}

                      {/* 10. تكلفة المنتج */}
                      {visibleColumns.cost && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-sans font-bold text-emerald-600 dark:text-emerald-400">
                          {formatIQD(cost)} <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 font-cairo">{t('common:units.iqd')}</span>
                        </td>
                      )}

                      {/* 11. تاريخ الاستلام */}
                      {visibleColumns.receiptDate && (
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-sans text-slate-500 dark:text-slate-400 text-[11px]">
                          {editMode ? editInput(item, 'receiptUnloadDate', item.receiptUnloadDate || item.date || '') : (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{receiptDate}</span>
                          </div>
                          )}
                        </td>
                      )}

                      {/* 12. المرفقات / الملفات */}
                      {visibleColumns.attachments && (
                        <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                          {rowAttachments.length > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {rowAttachments.slice(0, 3).map((att, idx) => (
                                <button
                                  key={att.id || idx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewFile(att);
                                  }}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800/80 transition-all shadow-2xs cursor-pointer active:scale-95"
                                  title={att.name || t('deliveries:previewDoc')}
                                >
                                  {(() => {
                                    const lowerName = (att.name || '').toLowerCase();
                                    if (att.type === 'pdf' || lowerName.endsWith('.pdf')) return <FileText className="w-3.5 h-3.5 text-rose-500" />;
                                    return <Image className="w-3.5 h-3.5 text-blue-500" />;
                                  })()}
                                </button>
                              ))}
                              {rowAttachments.length > 3 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewAllAttachmentsId(item.id);
                                  }}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 transition-all shadow-2xs cursor-pointer active:scale-95"
                                  title={t('deliveries:viewAttachments')}
                                >
                                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 font-sans">
                                    +{rowAttachments.length - 3}
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs font-bold select-none">-</span>
                          )}
                        </td>
                      )}

                      {/* الإجراءات: زر القلم وقائمته المنسدلة */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap relative">
                        <div className="relative inline-flex items-center justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuW = 176, menuH = 100;
                              const openUp = rect.bottom + menuH + 8 > window.innerHeight;
                              setMenuPos({
                                top: openUp ? rect.top - menuH - 8 : rect.bottom + 8,
                                left: isRTL ? rect.left : rect.right - menuW
                              });
                              setOpenMenuDeliveryId((prev) => (prev === itemKey ? null : itemKey));
                            }}
                            className={`p-1.5 rounded-xl transition-all cursor-pointer border ${
                              isMenuOpen
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40'
                                : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100/90 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border-slate-200/90 dark:border-slate-700 hover:shadow-xs active:scale-95'
                            }`}
                            title={t('deliveries:actions')}
                          >
                            <Edit className="w-4 h-4 stroke-[2.2]" />
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setOpenMenuDeliveryId(null)}
                              />
                              <div
                                style={menuPos ? { top: menuPos.top, left: menuPos.left } : undefined}
                                className={`fixed w-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-start`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    (onOpenModal ?? openQuickAction)(lockedCompanyName ? { ...item, lockedCompany: lockedCompanyName } : item);
                                    setOpenMenuDeliveryId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <Edit className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{t('deliveries:editShipment')}</span>
                                </button>

                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteConfirmId(item.id);
                                    setOpenMenuDeliveryId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                  <span>{t('deliveries:deleteRecord')}</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )), [
                paginatedDeliveries, visibleColumns, openMenuDeliveryId, menuPos, startIndex, activeColumnsCount, t, isRTL, editMode, selectedIds
              ])}
            </tbody>

          </table>
        </div>

        {/* 🔢 Modern 10-Row Pagination Bar */}
        {filteredDeliveries.length > 0 && (
          <div className="p-3 sm:p-4 bg-slate-50/90 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 font-cairo">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              <Trans t={t} i18nKey="deliveries:showing" count={filteredDeliveries.length} values={{ from: startIndex + 1, to: endIndex, total: filteredDeliveries.length }} components={{ 1: <span className="font-sans font-black text-blue-600 dark:text-blue-400" />, 2: <span className="font-sans font-black text-slate-900 dark:text-white" /> }} />
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 select-none">
                {/* Previous Button */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                    currentPage === 1
                      ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer shadow-2xs active:scale-95'
                  }`}
                >
                  {isRTL ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                  <span>{t('common:pagination.prev')}</span>
                </button>

                {/* Page Number Buttons */}
                <div className="flex items-center gap-1">
                  {(() => {
                    // Show a sliding window of at most 10 page numbers around the current page
                    const windowSize = Math.min(10, totalPages);
                    const windowStart = Math.min(
                      Math.max(1, currentPage - Math.floor(windowSize / 2)),
                      totalPages - windowSize + 1
                    );
                    return Array.from({ length: windowSize }, (_, i) => windowStart + i);
                  })().map((pageNum) => {
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl font-sans font-black text-xs transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                    currentPage === totalPages
                      ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer shadow-2xs active:scale-95'
                  }`}
                >
                  <span>{t('common:pagination.next')}</span>
                  {isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingDelivery && typeof document !== 'undefined' && createPortal(
        <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setEditingDelivery(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden z-10 animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm font-cairo">
                  {t('deliveries:editTitle')} ({editingDelivery.voucherNumber || editingDelivery.receiptNumber})
                </h3>
              </div>
              <button
                onClick={() => setEditingDelivery(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto font-cairo">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.supplier')}</label>
                  <input
                    type="text"
                    value={editingDelivery.supplierName && editingDelivery.supplierName !== editingDelivery.supplierCompany ? editingDelivery.supplierName : ''}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, supplierName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.company')}</label>
                  <input
                    type="text"
                    value={editingDelivery.supplierCompany || ''}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, supplierCompany: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.driver')}</label>
                  <input
                    type="text"
                    value={editingDelivery.driverName || ''}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, driverName: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.truckNumber')}</label>
                  <input
                    type="text"
                    value={editingDelivery.truckNumber || ''}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, truckNumber: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.voucherNumber')}</label>
                  <input
                    type="text"
                    value={editingDelivery.voucherNumber || editingDelivery.receiptNumber || ''}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, voucherNumber: e.target.value, receiptNumber: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.quantity')} ({t('common:units.liter')})</label>
                  <input
                    type="text"
                    value={formatNumber(editingDelivery.receivedQuantity ?? editingDelivery.volumeLiters ?? 0)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/,/g, '');
                      const vol = parseFloat(clean) || 0;
                      const prc = editingDelivery.productPrice ?? editingDelivery.pricePerLiter ?? 0;
                      setEditingDelivery({
                        ...editingDelivery,
                        receivedQuantity: vol,
                        volumeLiters: vol,
                        productCost: vol * prc,
                        totalCostIqd: vol * prc,
                      });
                    }}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.density')}</label>
                  <input
                    type="text"
                    value={editingDelivery.productDensity || '0.840'}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, productDensity: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.color')}</label>
                  <select
                    value={editingDelivery.productColor || 'احمر'}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, productColor: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="احمر">{enumText('احمر')}</option>
                    <option value="اصفر">{enumText('اصفر')}</option>
                    <option value="عسلي">{enumText('عسلي')}</option>
                    <option value="نفط ابيض">{enumText('نفط ابيض')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.price')} ({t('common:units.iqd')})</label>
                  <input
                    type="text"
                    value={formatNumber(editingDelivery.productPrice ?? editingDelivery.pricePerLiter ?? 0)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/,/g, '');
                      const prc = parseFloat(clean) || 0;
                      const vol = editingDelivery.receivedQuantity ?? editingDelivery.volumeLiters ?? 0;
                      setEditingDelivery({
                        ...editingDelivery,
                        productPrice: prc,
                        pricePerLiter: prc,
                        productCost: vol * prc,
                        totalCostIqd: vol * prc,
                      });
                    }}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.cost')} ({t('common:units.iqd')})</label>
                  <div className="w-full px-3 py-1.5 text-xs rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-sans font-black flex items-center justify-between">
                    <span>{formatIQD((editingDelivery.receivedQuantity ?? 0) * (editingDelivery.productPrice ?? 0))}</span>
                    <span className="text-[10px] text-emerald-600 font-cairo">{t('common:units.iqd')}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:col.receiptDate')}</label>
                  <input
                    type="text"
                    value={editingDelivery.receiptUnloadDate || ''}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, receiptUnloadDate: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('deliveries:station')}</label>
                  <select
                    value={editingDelivery.stationName || 'الطاقة'}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, stationName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    {['الطاقة', 'التسمين', 'الطار', 'البياض', 'أمهات', 'الأجداد'].map((st) => (
                      <option key={st} value={st}>
                        {t('deliveries:stationName', { name: st })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('common:actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {t('common:actions.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && typeof document !== 'undefined' && createPortal(
        <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200/90 dark:border-slate-800 text-center space-y-4 font-cairo z-10 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-black text-slate-900 dark:text-white text-base sm:text-lg">{t('deliveries:deleteTitle')}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('deliveries:deleteText')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteDelivery(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-500/25 transition-all cursor-pointer hover:shadow-lg active:scale-98 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('common:actions.delete')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteOpen && typeof document !== 'undefined' && createPortal(
        <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setBulkDeleteOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200/90 dark:border-slate-800 text-center space-y-4 font-cairo z-10 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-black text-slate-900 dark:text-white text-base sm:text-lg">
                <Trans t={t} i18nKey="deliveries:deleteCount" count={selectedIds.size} components={{ 1: <span className="font-sans" /> }} />
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('deliveries:deleteManyText')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-500/25 transition-all cursor-pointer hover:shadow-lg active:scale-98 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('common:actions.delete')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Printable Official Voucher Modal */}
      {selectedVoucher && typeof document !== 'undefined' && createPortal(
        <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setSelectedVoucher(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden font-cairo z-10 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  {t('deliveries:voucherTitle')} ({selectedVoucher.voucherNumber || selectedVoucher.receiptNumber})
                </h3>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Official Voucher Sheet */}
            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:receiver')}</span>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">{enumText(selectedVoucher.company || 'صحاري كربلاء')}</span>
                </div>
                <div className="text-start">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:col.supplier')}</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{enumText(selectedVoucher.supplierCompany || selectedVoucher.supplierName || 'مصفى كربلاء')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:col.driver')}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{enumText(selectedVoucher.driverName || t('deliveries:noDriver'))}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:col.truckNumber')}</span>
                  <span className="font-sans font-bold text-slate-800 dark:text-slate-200">{formatTruckNumber(selectedVoucher.truckNumber)}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:col.voucherNumber')}</span>
                  <span className="font-sans font-bold text-indigo-600 dark:text-indigo-400">{selectedVoucher.voucherNumber || selectedVoucher.receiptNumber}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:col.quantity')}</span>
                  <span className="font-sans font-black text-slate-900 dark:text-white">
                    {formatNumber(selectedVoucher.receivedQuantity ?? selectedVoucher.volumeLiters ?? 0)} {t('common:units.liter')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:col.density')}</span>
                  <span className="font-sans font-bold text-slate-800 dark:text-slate-200">{selectedVoucher.productDensity || '0.840'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:col.color')}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{enumText(selectedVoucher.productColor || 'أصفر مخضر')}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:col.price')}</span>
                  <span className="font-sans font-bold text-slate-800 dark:text-slate-200">
                    {(selectedVoucher.productPrice ?? selectedVoucher.pricePerLiter ?? 0).toLocaleString()} {t('common:units.iqd')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/20 col-span-2">
                  <span className="text-[10px] font-bold text-emerald-600 block">{t('deliveries:totalCost')}</span>
                  <span className="text-sm font-sans font-black text-emerald-600 dark:text-emerald-400">
                    {formatIQD(selectedVoucher.productCost ?? selectedVoucher.totalCostIqd ?? 0)} {t('common:units.iqd')}
                  </span>
                </div>
              </div>

              {((selectedVoucher.attachments && selectedVoucher.attachments.length > 0) ? selectedVoucher.attachments : (selectedVoucher.attachmentUrl ? [{ id: '1', name: selectedVoucher.attachmentName || t('deliveries:attachedDoc'), url: selectedVoucher.attachmentUrl, type: selectedVoucher.attachmentType || 'image', size: selectedVoucher.attachmentSize || 0 }] : [])).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('deliveries:attachedDocs')}</span>
                  {((selectedVoucher.attachments && selectedVoucher.attachments.length > 0) ? selectedVoucher.attachments : [{ id: '1', name: selectedVoucher.attachmentName || t('deliveries:attachedDoc'), url: selectedVoucher.attachmentUrl!, type: selectedVoucher.attachmentType || 'image', size: selectedVoucher.attachmentSize || 0 }]).map((att) => (
                    <div key={att.id} className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const lowerName = (att.name || '').toLowerCase();
                          if (att.type === 'pdf' || lowerName.endsWith('.pdf')) return <FileText className="w-4 h-4 text-rose-500 shrink-0" />;
                          return <Image className="w-4 h-4 text-blue-500 shrink-0" />;
                        })()}
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                          {att.name}
                        </span>
                      </div>
                      <a
                        href={att.url}
                        download={att.name || 'voucher-document'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('deliveries:downloadView')}</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">{t('deliveries:col.receiptDate')}</span>
                  <span className="font-sans font-bold text-slate-800 dark:text-slate-200">
                    {selectedVoucher.receiptUnloadDate ? selectedVoucher.receiptUnloadDate.split(' ')[0] : (selectedVoucher.date ? selectedVoucher.date.split(' ')[0] : '2026/08/20')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('deliveries:approved')}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 cursor-pointer"
              >
                {t('common:actions.close')}
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{t('deliveries:printVoucher')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal for All Attachments */}
      {viewAllAttachmentsId && (
        <div className="no-print fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setViewAllAttachmentsId(null)} />
          
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t('deliveries:allAttachments')} ({deliveries.find(i => i.id === viewAllAttachmentsId)?.attachments?.length || 0})
                </h3>
              </div>
              <button
                onClick={() => setViewAllAttachmentsId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-2.5">
                {deliveries.find(i => i.id === viewAllAttachmentsId)?.attachments?.map((att, idx) => (
                  <div
                    key={att.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group bg-white dark:bg-slate-800"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-50 dark:bg-slate-800 group-hover:scale-105 transition-transform">
                        {(() => {
                          const lowerName = (att.name || '').toLowerCase();
                          if (att.type === 'pdf' || lowerName.endsWith('.pdf')) return <FileText className="w-4 h-4 text-rose-500" />;
                          return <Image className="w-4 h-4 text-blue-500" />;
                        })()}
                      </div>
                      <div className="min-w-0 flex-1 pe-2">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={att.name}>
                          {att.name || t('deliveries:attachmentN', { n: idx + 1 })}
                        </p>
                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                          {att.type === 'pdf' ? t('deliveries:pdfDoc') : t('deliveries:imageFile')}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setViewAllAttachmentsId(null);
                        setPreviewFile(att);
                      }}
                      className="shrink-0 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 transition-colors ml-2 cursor-pointer"
                      title={t('deliveries:preview')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 Document Preview Lightbox Modal */}
      {previewFile && typeof document !== 'undefined' && createPortal(
        <div className="no-print fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setPreviewFile(null)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden z-10 flex flex-col font-cairo animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  {previewFile.type === 'pdf' ? (
                    <FileText className="w-4 h-4 text-rose-500" />
                  ) : (
                    <Image className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate" title={previewFile.name}>
                    {previewFile.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium font-sans">
                    {previewFile.type === 'pdf' ? 'PDF Document' : 'Image File'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewFile.url}
                  download={previewFile.name}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('deliveries:download')}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t('common:actions.close')}
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-950/10 dark:bg-slate-950/60 min-h-[400px]">
              {previewFile.type === 'pdf' ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  className="w-full h-[65vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
                />
              ) : (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl border border-slate-200/50 dark:border-slate-700/50"
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>

      {/* 🖨️ Fullscreen Official Print Preview Modal */}
      {showPrintReportModal && typeof document !== 'undefined' && createPortal(
        <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setShowPrintReportModal(false)} />
          <div className="relative w-full max-w-7xl max-h-[94vh] bg-slate-100 dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col font-cairo z-10 animate-in zoom-in-95 duration-150">
            
            {/* Modal Top Main Header */}
            <div className="px-5 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between no-print gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      {t('deliveries:printModal.title')}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-black">
                      {t('deliveries:printModal.activeCols', { count: printActiveColCount })}
                    </span>
                    {printActiveColCount > 10 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        {t('deliveries:printModal.a3')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('deliveries:printModal.subtitle')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('deliveries:printModal.print')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintReportModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t('common:actions.close')}
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Modal Interactive Controls Toolbar */}
            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs">
              
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* 1. Columns Selector Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPrintColDropdownOpen(!isPrintColDropdownOpen)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer shadow-sm"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{t('deliveries:printModal.columns')}</span>
                    <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md text-[10px] font-mono">
                      {printActiveColCount}/{PRINT_AVAILABLE_COLUMNS.length}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isPrintColDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {isPrintColDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsPrintColDropdownOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-80 max-h-[380px] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                          <span className="font-black text-slate-800 dark:text-slate-100 text-xs">
                            {t('deliveries:printModal.included')}
                          </span>
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                const allTrue = PRINT_AVAILABLE_COLUMNS.reduce((acc, c) => ({ ...acc, [c.id]: true }), {});
                                setPrintVisibleColumns(allTrue);
                              }}
                              className="text-blue-600 hover:underline px-1 py-0.5"
                            >
                              {t('common:enum.category.all')}
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() => setPrintVisibleColumns(DEFAULT_PRINT_COLUMNS)}
                              className="text-slate-600 dark:text-slate-400 hover:underline px-1 py-0.5"
                            >
                              {t('deliveries:printModal.default')}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {PRINT_AVAILABLE_COLUMNS.map((col) => {
                            const isChecked = printVisibleColumns[col.id] ?? col.defaultVisible;
                            return (
                              <label
                                key={col.id}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setPrintVisibleColumns(prev => ({
                                        ...prev,
                                        [col.id]: e.target.checked
                                      }));
                                    }}
                                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span>{t(`deliveries:print.col.${col.id}`)}</span>
                                </div>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">
                                  {t(`deliveries:print.cat.${col.category}`)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Paper Size Selector */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{t('deliveries:printModal.paper')}</span>
                  <select
                    value={printPaperSize}
                    onChange={(e) => setPrintPaperSize(e.target.value as PrintPaperSize)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 font-black focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="auto" className="dark:bg-slate-800">{t('deliveries:printModal.auto')}</option>
                    <option value="a4" className="dark:bg-slate-800">{t('deliveries:printModal.a4opt')}</option>
                    <option value="a3" className="dark:bg-slate-800">{t('deliveries:printModal.a3opt')}</option>
                    <option value="a2" className="dark:bg-slate-800">{t('deliveries:printModal.a2opt')}</option>
                    <option value="legal" className="dark:bg-slate-800">{t('deliveries:printModal.legal')}</option>
                  </select>
                </div>

                {/* 3. Orientation Selector */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{t('deliveries:printModal.orientation')}</span>
                  <select
                    value={printOrientation}
                    onChange={(e) => setPrintOrientation(e.target.value as PrintOrientation)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 font-black focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="auto" className="dark:bg-slate-800">{t('deliveries:printModal.autoCols')}</option>
                    <option value="landscape" className="dark:bg-slate-800">{t('common:print.landscape')}</option>
                    <option value="portrait" className="dark:bg-slate-800">{t('common:print.portrait')}</option>
                  </select>
                </div>

                {/* 4. Density & Font Scaling */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{t('deliveries:printModal.font')}</span>
                  <select
                    value={printDensity}
                    onChange={(e) => setPrintDensity(e.target.value as PrintDensity)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 font-black focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="compact" className="dark:bg-slate-800">{t('deliveries:printModal.compact')}</option>
                    <option value="normal" className="dark:bg-slate-800">{t('deliveries:printModal.normal')}</option>
                    <option value="relaxed" className="dark:bg-slate-800">{t('deliveries:printModal.relaxed')}</option>
                  </select>
                </div>
              </div>

              {/* 5. Section Quick Toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printShowLogos}
                    onChange={(e) => setPrintShowLogos(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                  />
                  <span>{t('deliveries:printModal.logos')}</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printShowKpis}
                    onChange={(e) => setPrintShowKpis(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                  />
                  <span>{t('deliveries:printModal.kpis')}</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printShowSignatures}
                    onChange={(e) => setPrintShowSignatures(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                  />
                  <span>{t('deliveries:printModal.signatures')}</span>
                </label>
              </div>

            </div>

            {/* Smart Hint Bar if high column count */}
            {printActiveColCount > 10 && (
              <div className="px-5 py-1.5 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    <Trans t={t} i18nKey="deliveries:printModal.smartHint" count={printActiveColCount} components={{ 1: <strong /> }} />
                  </span>
                </div>
              </div>
            )}

            {/* Simulated Paper Sheet Preview Container */}
            <div className="p-4 sm:p-6 overflow-auto flex-1 bg-slate-700/50 dark:bg-slate-950/90 flex justify-center custom-scrollbar">
              <div
                className="w-full bg-white rounded-lg shadow-2xl border border-slate-400 overflow-hidden text-slate-900 transition-all flex flex-col justify-between"
                style={{
                  maxWidth: (printPaperSize === 'a3' || printPaperSize === 'a2' || (printPaperSize === 'auto' && printActiveColCount > 10))
                    ? '1450px'
                    : '1120px',
                  minHeight: '700px',
                }}
              >
                <InboundPrintReport
                  deliveries={filteredDeliveries}
                  filterCompany={filterCompany}
                  filterSupplier={filterSupplier}
                  filterFuelType={filterFuelType}
                  filterMonthYear={dateRangeLabel}
                  visibleColumns={printVisibleColumns}
                  paperSize={printPaperSize}
                  orientation={printOrientation}
                  density={printDensity}
                  showHeaderLogos={printShowLogos}
                  showKpiCards={printShowKpis}
                  showSignatures={printShowSignatures}
          companyName={isSaharaScoped ? 'شركة صحاري كربلاء' : isEtihadScoped ? 'شركة الاتحاد' : null}
                />
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
};
