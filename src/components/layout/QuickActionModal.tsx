import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import { parseInboundFile, type InboundImportRow } from '../../lib/inboundImport';
import {
  X,
  Truck,
  Building2,
  User,
  FileText,
  Fuel,
  DollarSign,
  Calendar,
  Sparkles,
  Gauge,
  Plus,
  ChevronDown,
  Paperclip,
  UploadCloud,
  Image,
  Trash2,
  CheckCircle2,
  Eye,
  Download,
  PenLine,
  Upload,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useFuelStore } from '../../context/FuelDataContext';
import { useLanguage } from '../../context/LanguageContext';
import { enumText } from '../../i18n/enums';
import { useTranslation } from 'react-i18next';
import { formatIQD, formatNumber } from '../../lib/utils';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: any;
}

export interface IraqProvinceCode {
  code: string;
  name: string;
}

export const IRAQ_PROVINCE_CODES: IraqProvinceCode[] = [
  { code: '11', name: 'محافظة بغداد' },
  { code: '12', name: 'محافظة نينوى' },
  { code: '13', name: 'محافظة ميسان' },
  { code: '14', name: 'محافظة البصرة' },
  { code: '15', name: 'محافظة الأنبار' },
  { code: '16', name: 'محافظة القادسية' },
  { code: '17', name: 'محافظة المثنى' },
  { code: '18', name: 'محافظة بابل' },
  { code: '19', name: 'محافظة كربلاء المقدسة' },
  { code: '20', name: 'محافظة ديالى' },
  { code: '21', name: 'محافظة السليمانية' },
  { code: '22', name: 'محافظة أربيل' },
  { code: '23', name: 'محافظة حلبجة' },
  { code: '24', name: 'محافظة دهوك' },
  { code: '25', name: 'محافظة كركوك' },
  { code: '26', name: 'محافظة صلاح الدين' },
  { code: '27', name: 'محافظة ذي قار' },
  { code: '28', name: 'محافظة النجف الأشرف' },
  { code: '29', name: 'محافظة واسط' },
];

const DEFAULT_COMPANIES = ['صحاري كربلاء', 'شركة الاتحاد', 'المستودع الرئيسي'];
const DEFAULT_SUPPLIERS = [
  'مصفى كربلاء الدولي',
  'مستودع الفرات الأوسط',
  'مصفى الدورة',
  'شركة توزيع المنتجات النفطية',
  'شركة سومو',
];
const DEFAULT_COLORS = ['احمر', 'اصفر', 'عسلي', 'نفط ابيض'];

/** كشف الوارد خاص بالكاز: كل شحنة (رفع ملف أو إدخال يدوي) كاز مهما كان لونها، ومنها "نفط ابيض".
 *  النفط الأسود يُسجَّل من قسمه الخاص وليس من هنا. */
const productFromColor = (_color: string) => 'كاز ممتاز';

export const QuickActionModal: React.FC<QuickActionModalProps> = ({ isOpen, onClose, editData }) => {
  const { addDelivery, updateDelivery, deliveries } = useFuelStore();
  const { isRTL } = useLanguage();

  const { t, i18n } = useTranslation(['deliveries', 'common']);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Dynamic dropdown lists loaded from storage & deliveries
  const [companies, setCompanies] = useState<string[]>(() => {
    const saved = localStorage.getItem('sahara_companies_list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    const fromDeliveries = deliveries.map((d) => d.company).filter(Boolean);
    return Array.from(new Set([...DEFAULT_COMPANIES, ...fromDeliveries]));
  });

  const [suppliers, setSuppliers] = useState<string[]>(() => {
    const saved = localStorage.getItem('sahara_suppliers_list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    const fromDeliveries = deliveries
      .map((d) => d.supplierCompany || d.supplierName)
      .filter(Boolean) as string[];
    return Array.from(new Set([...DEFAULT_SUPPLIERS, ...fromDeliveries]));
  });

  const [colors, setColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('sahara_colors_list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_COLORS;
  });

  // Modal form states
  const [deliveryCompany, setDeliveryCompany] = useState('صحاري كربلاء');
  const [deliverySupplier, setDeliverySupplier] = useState('مصفى كربلاء الدولي'); // الشركة المجهزة
  const [deliverySupplierName, setDeliverySupplierName] = useState(''); // اسم المجهز
  // اقتراحات "اسم المجهز" من الشحنات السابقة
  const supplierNames = Array.from(new Set(deliveries.map((d) => d.supplierName).filter((n): n is string => !!n && !DEFAULT_SUPPLIERS.includes(n))));

  // طريقة الإدخال: يدوي أو رفع ملف الوارد اليومي (Excel / PDF بنفس عناوين النافذة)
  const [entryMode, setEntryMode] = useState<'manual' | 'upload'>('manual');
  // فترة ملف الوارد (من / إلى) بنفس تقويم الأرشيف: الشحنة بلا تاريخ تأخذ "من"، والتي خارج الفترة لا تُستورد
  const todaySlash = () => new Date().toISOString().split('T')[0].replace(/-/g, '/');
  const [importFrom, setImportFrom] = useState(todaySlash);
  const [importTo, setImportTo] = useState(todaySlash);
  const [importDatePop, setImportDatePop] = useState<{ top: number; left: number } | null>(null);
  const [importState, setImportState] = useState<
    | { status: 'idle' }
    | { status: 'reading'; fileName: string }
    | { status: 'ready'; fileName: string; rows: InboundImportRow[] }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [deliveryDriver, setDeliveryDriver] = useState('سجاد حيدر الموسوي');

  // رقم العجلة: خانة واحدة
  const [truckNumberText, setTruckNumberText] = useState('');

  // Voucher & Fuel
  const [deliveryVoucher, setDeliveryVoucher] = useState(
    () => `2026${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [rawVolume, setRawVolume] = useState('36,000');
  const [deliveryDensity, setDeliveryDensity] = useState('0.842');
  const [deliveryColor, setDeliveryColor] = useState('احمر');
  const [rawPrice, setRawPrice] = useState('510');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    return new Date().toISOString().split('T')[0].replace(/-/g, '/');
  });

  useEffect(() => {
    if (isOpen && editData) {
      setDeliveryCompany(editData.company || editData.lockedCompany || 'صحاري كربلاء');
      setDeliverySupplier(editData.supplierCompany || editData.supplierName || 'مصفى كربلاء الدولي');
      // السجلات القديمة كانت تحفظ نفس القيمة في الحقلين
      setDeliverySupplierName(editData.supplierName && editData.supplierName !== editData.supplierCompany ? editData.supplierName : '');
      setEntryMode('manual');
      setDeliveryDriver(editData.driverName || 'سجاد حيدر الموسوي');
      setTruckNumberText(String(editData.truckNumber || '').trim());
      setDeliveryVoucher(editData.voucherNumber || editData.receiptNumber || '');
      const rawVol = (editData.receivedQuantity ?? editData.volumeLiters ?? 0).toString();
      const cleanVol = rawVol.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      setRawVolume(cleanVol);
      setDeliveryDensity(editData.productDensity || '0.840');
      setDeliveryColor(editData.productColor || 'احمر');
      const prc = (editData.productPrice ?? editData.pricePerLiter ?? 0).toString();
      const cleanPrc = prc.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      setRawPrice(cleanPrc);
      setDeliveryDate(editData.receiptUnloadDate ? editData.receiptUnloadDate.split(' ')[0] : new Date().toISOString().split('T')[0].replace(/-/g, '/'));
      
      if (editData.attachments && editData.attachments.length > 0) {
        setAttachments(editData.attachments);
      } else if (editData.attachmentUrl) {
        setAttachments([{
          id: '1',
          name: editData.attachmentName || t('deliveries:attachedDoc'),
          url: editData.attachmentUrl,
          type: editData.attachmentType || 'image',
          size: editData.attachmentSize || 0
        }]);
      } else {
        setAttachments([]);
      }
    } else if (isOpen && !editData) {
      setDeliveryCompany('صحاري كربلاء');
      setDeliverySupplier('مصفى كربلاء الدولي');
      setDeliverySupplierName('');
      setEntryMode('manual');
      setImportState({ status: 'idle' });
      setImportFrom(todaySlash());
      setImportTo(todaySlash());
      setDeliveryDriver('سجاد حيدر الموسوي');
      setTruckNumberText('');
      setDeliveryVoucher(`2026${Math.floor(1000 + Math.random() * 9000)}`);
      setRawVolume('36,000');
      setDeliveryDensity('0.842');
      setDeliveryColor('احمر');
      setRawPrice('510');
      setDeliveryDate(new Date().toISOString().split('T')[0].replace(/-/g, '/'));
      setAttachments([]);
    }
  }, [isOpen, editData]);

  // Multi-Attachment State (PDF, JPG, PNG)
  const [attachments, setAttachments] = useState<
    Array<{
      id: string;
      name: string;
      url: string;
      type: 'pdf' | 'image';
      size: number;
    }>
  >([]);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url: string;
    type: 'pdf' | 'image';
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Array<{ id: string; name: string; progress: number; file: File }>>([]);

  const processFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    let invalidCount = 0;

    fileList.forEach((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name);

      if (!isPdf && !isImage) {
        invalidCount++;
        return;
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      setUploadingFiles((prev) => [...prev, { id: fileId, name: file.name, progress: 0, file }]);

      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 20) + 10;
        
        if (currentProgress >= 100) {
          currentProgress = 100;
          clearInterval(interval);
          setUploadingFiles((prev) => prev.map(f => f.id === fileId ? { ...f, progress: 100 } : f));
          
          setTimeout(() => {
            const reader = new FileReader();
            reader.onload = () => {
              const newAttachment = {
                id: fileId,
                name: file.name,
                url: reader.result as string,
                type: (isPdf ? 'pdf' : 'image') as 'pdf' | 'image',
                size: file.size,
              };
              setAttachments((prev) => [...prev, newAttachment]);
              setUploadingFiles((prev) => prev.filter(f => f.id !== fileId));
            };
            reader.readAsDataURL(file);
          }, 800);
        } else {
          setUploadingFiles((prev) => prev.map(f => f.id === fileId ? { ...f, progress: currentProgress } : f));
        }
      }, 150);
    });

    if (invalidCount > 0) {
      alert(t('deliveries:quick.skippedFiles'));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value so same files can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  // In-Cell Quick Add States

  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');


  const [submitted, setSubmitted] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('sahara_companies_list', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('sahara_suppliers_list', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('sahara_colors_list', JSON.stringify(colors));
  }, [colors]);

  if (!isOpen) return null;

  // Number formatting helpers with live typing support
  const parseNumber = (val: string): number => {
    const clean = (val || '').replace(/,/g, '').trim();
    return parseFloat(clean) || 0;
  };

  const formatInputWithCommas = (val: string): string => {
    const clean = (val || '').replace(/,/g, '').trim();
    if (!clean) return '';
    const parts = clean.split('.');
    if (isNaN(Number(parts[0]))) return val;
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '') {
      setRawVolume('');
      return;
    }
    const clean = v.replace(/,/g, '');
    if (/^\d*\.?\d*$/.test(clean)) {
      setRawVolume(formatInputWithCommas(v));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '') {
      setRawPrice('');
      return;
    }
    const clean = v.replace(/,/g, '');
    if (/^\d*\.?\d*$/.test(clean)) {
      setRawPrice(formatInputWithCommas(v));
    }
  };

  const numericVolume = parseNumber(rawVolume);
  const numericPrice = parseNumber(rawPrice);
  const computedCost = numericVolume * numericPrice;


  const handleGenerateVoucher = () => {
    setDeliveryVoucher(`2026${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleAddNewSupplier = () => {
    const trimmed = newSupplierName.trim();
    if (trimmed) {
      if (!suppliers.includes(trimmed)) {
        setSuppliers([trimmed, ...suppliers]);
      }
      setDeliverySupplier(trimmed);
      setNewSupplierName('');
      setIsAddingSupplier(false);
    }
  };

  const handleAddNewColor = () => {
    const trimmed = newColorName.trim();
    if (trimmed) {
      if (!colors.includes(trimmed)) {
        setColors([...colors, trimmed]);
      }
      setDeliveryColor(trimmed);
      setNewColorName('');
      setIsAddingColor(false);
    }
  };

  const handleDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-save
    if (deliverySupplier && !suppliers.includes(deliverySupplier)) {
      setSuppliers((prev) => [deliverySupplier, ...prev]);
    }
    if (deliveryCompany && !companies.includes(deliveryCompany)) {
      setCompanies((prev) => [deliveryCompany, ...prev]);
    }
    if (deliveryColor && !colors.includes(deliveryColor)) {
      setColors((prev) => [...prev, deliveryColor]);
    }

    const targetComp = (editData?.lockedCompany || deliveryCompany) as ('صحاري كربلاء' | 'شركة الاتحاد');

    const deliveryPayload = {
      company: targetComp,
      supplierCompany: deliverySupplier,
      supplierName: deliverySupplierName.trim(),
      driverName: deliveryDriver,
      truckNumber: truckNumberText.trim(),
      voucherNumber: deliveryVoucher || `VCH-${Date.now().toString().slice(-4)}`,
      receivedQuantity: numericVolume,
      productDensity: deliveryDensity || '0.840',
      productColor: deliveryColor,
      productPrice: numericPrice,
      productCost: computedCost,
      receiptUnloadDate: deliveryDate
        ? deliveryDate.split(' ')[0]
        : new Date().toISOString().split('T')[0].replace(/-/g, '/'),

      // المحطة لم تعد في النافذة: يبقى ما في السجل القديم
      stationName: editData?.stationName ?? '',
      tankCode: editData?.tankCode ?? '',
      product: productFromColor(deliveryColor),
      volumeLiters: numericVolume,
      pricePerLiter: numericPrice,
      totalCostIqd: computedCost,
      receiptNumber: deliveryVoucher || `VCH-${Date.now().toString().slice(-4)}`,
      // لا حقل لهاتف السائق في النافذة: يبقى ما في السجل القديم بدل رقم افتراضي
      driverPhone: editData?.driverPhone ?? '',
      status: 'تم الاستلام' as const,
      date: deliveryDate
        ? deliveryDate.split(' ')[0]
        : new Date().toISOString().split('T')[0].replace(/-/g, '/'),
      time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      attachmentUrl: attachments[0]?.url,
      attachmentName: attachments[0]?.name,
      attachmentType: attachments[0]?.type,
      attachmentSize: attachments[0]?.size,
      attachments: attachments,
    };

    if (editData && editData.id) {
      updateDelivery(editData.id, deliveryPayload);
    } else {
      addDelivery(deliveryPayload, targetComp);
    }

    // تصفير الكمية والكثافة والمستندات وتوليد رقم فوجر جديد بعد عملية الحفظ
    setRawVolume('');
    setDeliveryDensity('');
    setAttachments([]);
    setDeliveryVoucher(`VCH-2026-${Math.floor(1000 + Math.random() * 9000)}`);

    // تبقى بطاقة النجاح ظاهرة حتى يغلقها المستخدم بزر ✕
    setSubmitted(true);
  };

  // الشركة المستلمة: من الصفحة التي فُتحت منها النافذة (صحاري أو الاتحاد)
  const receivingCompany = (editData?.lockedCompany || deliveryCompany) as 'صحاري كربلاء' | 'شركة الاتحاد';
  const existingVouchers = new Set(
    deliveries.filter((d) => d.company === receivingCompany).map((d) => String(d.voucherNumber || d.receiptNumber || '').trim()).filter(Boolean)
  );

  const handleImportFile = async (file: File) => {
    setImportState({ status: 'reading', fileName: file.name });
    try {
      const rows = await parseInboundFile(file);
      if (!rows.length) throw new Error(t('deliveries:quick.noRows'));
      // الفترة تُؤخذ من تواريخ الشحنات في الملف تلقائيًا (كانت "اليوم" فتُتجاهل شحنات الأيام الأخرى)،
      // وتبقى قابلة للتغيير يدويًا من زر الفترة
      const dates = rows.map(r => r.receiptUnloadDate).filter(Boolean).sort();
      if (dates.length) {
        setImportFrom(dates[0]);
        setImportTo(dates[dates.length - 1]);
      }
      setImportState({ status: 'ready', fileName: file.name, rows });
    } catch (err) {
      setImportState({ status: 'error', message: err instanceof Error ? err.message : t('deliveries:quick.readFailed') });
    }
  };

  const importRows = importState.status === 'ready' ? importState.rows : [];
  const isDuplicateRow = (r: InboundImportRow) => !!r.voucherNumber && existingVouchers.has(r.voucherNumber.trim());
  const rowDate = (r: InboundImportRow) => r.receiptUnloadDate || importFrom;
  const isOutOfRange = (r: InboundImportRow) => rowDate(r) < importFrom || rowDate(r) > importTo;
  const newImportRows = importRows.filter((r) => !isDuplicateRow(r) && !isOutOfRange(r));

  const handleImportSubmit = () => {
    newImportRows.forEach((r) => {
      const date = rowDate(r);
      addDelivery({
        company: receivingCompany,
        supplierCompany: r.supplierCompany,
        supplierName: r.supplierName,
        driverName: r.driverName,
        truckNumber: r.truckNumber,
        voucherNumber: r.voucherNumber || `VCH-${Date.now().toString().slice(-4)}`,
        receivedQuantity: r.receivedQuantity,
        productDensity: r.productDensity,
        productColor: r.productColor,
        productPrice: r.productPrice,
        productCost: r.productCost,
        receiptUnloadDate: date,
        stationName: '',
        tankCode: '',
        product: productFromColor(r.productColor),
        volumeLiters: r.receivedQuantity,
        pricePerLiter: r.productPrice,
        totalCostIqd: r.productCost,
        receiptNumber: r.voucherNumber,
        status: 'تم الاستلام' as const,
        date,
        time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        attachments: []
      }, receivingCompany);
      if (r.supplierCompany && !suppliers.includes(r.supplierCompany)) setSuppliers((prev) => [r.supplierCompany, ...prev]);
      if (r.productColor && !colors.includes(r.productColor)) setColors((prev) => [...prev, r.productColor]);
    });
    setImportState({ status: 'idle' });
    setSubmitted(true);
  };

  const closeSuccess = () => {
    setSubmitted(false);
    onClose();
  };

  // بعد الحفظ: بطاقة نجاح صغيرة مع علامة صح متحركة بدل النافذة الكبيرة
  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-[2px] animate-in fade-in duration-150" dir={i18n.dir()}>
        <div className="success-pop relative w-[300px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl px-6 py-6 flex flex-col items-center text-center font-cairo">
          <button
            type="button"
            onClick={closeSuccess}
            aria-label={t('common:actions.close')}
            autoFocus
            className="absolute top-3 left-3 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 cursor-pointer transition-all"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
          <div className="relative w-20 h-20 mb-3">
            <span className="absolute inset-0 rounded-full bg-emerald-400/25 success-ring" />
            <svg viewBox="0 0 52 52" className="relative w-20 h-20">
              <circle className="success-circle" cx="26" cy="26" r="24" fill="none" stroke="#10b981" strokeWidth="3" />
              <path className="success-check" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M15 27 l7 7 l15 -16" />
            </svg>
          </div>
          <h4 className="font-black text-base text-slate-900 dark:text-white">
            {editData?.id ? t('deliveries:quick.saved') : t('deliveries:quick.recorded')}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('deliveries:quick.posted')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-[70vw] max-w-[1420px] h-fit max-h-[96vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden font-cairo z-10 animate-in zoom-in-95 duration-150">
        
        {/* Enterprise Clean Header */}
        <div className="px-6 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs select-none shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs shrink-0">
              <Truck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                  {editData?.id ? t('deliveries:editTitle') : t('deliveries:quick.newTitle')}
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  ERP Gate Entry
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {t('deliveries:quick.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ms-auto me-3">
            {!editData?.lockedCompany && (
              <select
                value={deliveryCompany}
                onChange={(e) => setDeliveryCompany(e.target.value)}
                title={t('deliveries:receiver')}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                {companies.map((c) => <option key={c} value={c}>{enumText(c)}</option>)}
              </select>
            )}
            {/* طريقة الإدخال: يدوي أو رفع ملف الوارد اليومي (للتسجيل الجديد فقط) */}
            {!editData?.id && (
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                {([
                  { key: 'manual', label: t('deliveries:quick.manual'), icon: PenLine },
                  { key: 'upload', label: t('deliveries:quick.upload'), icon: Upload }
                ] as const).map(({ key, label, icon: ModeIcon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEntryMode(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${entryMode === key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'}`}
                  >
                    <ModeIcon className="w-3.5 h-3.5" />
                    {enumText(label)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
          >
            <X className="w-4.5 h-4.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Form & Body Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/40 dark:bg-slate-900/40">
            <form onSubmit={handleDeliverySubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              
              {/* Scrollable Form Cards Area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 pb-8 sm:pb-12 space-y-3 custom-scrollbar">
                {entryMode === 'upload' ? (
                  <div className="space-y-3">
                    {/* التاريخ + الملف */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3.5 items-stretch">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">{t('deliveries:quick.period')}</label>
                        <button
                          type="button"
                          onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setImportDatePop((p) => (p ? null : { top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 308)) }));
                          }}
                          className="w-full h-11 sm:h-12 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 hover:border-purple-400 text-slate-900 dark:text-white flex items-center gap-2 font-sans font-bold text-xs sm:text-sm cursor-pointer transition-colors"
                        >
                          <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="truncate">{importFrom === importTo ? importFrom : `${importFrom} — ${importTo}`}</span>
                        </button>
                        <p className="text-[10.5px] text-slate-400">{t('deliveries:quick.periodHint')}</p>
                        {importDatePop && createPortal(
                          <>
                            <div className="fixed inset-0 z-[150]" onClick={() => setImportDatePop(null)} />
                            <div className="fixed z-[151]" style={{ top: importDatePop.top, left: importDatePop.left }}>
                              <DateRangeCalendar
                                from={importFrom}
                                to={importTo}
                                onApply={(f, t) => { setImportFrom(f); setImportTo(t); setImportDatePop(null); }}
                                onClear={() => { setImportFrom(todaySlash()); setImportTo(todaySlash()); setImportDatePop(null); }}
                              />
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                      <label
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleImportFile(f); }}
                        className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-center cursor-pointer transition-colors"
                      >
                        {importState.status === 'reading' ? <Loader2 className="w-7 h-7 text-blue-600 animate-spin" /> : <UploadCloud className="w-7 h-7 text-blue-600" />}
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {importState.status === 'reading' ? t('deliveries:quick.reading', { file: importState.fileName }) : t('deliveries:quick.choose')}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t('deliveries:quick.chooseHint')}
                        </span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv,.pdf"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleImportFile(f); }}
                        />
                      </label>
                    </div>

                    {importState.status === 'error' && (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {enumText(importState.message)}
                      </div>
                    )}

                    {importState.status === 'ready' && (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                        {/* ملخص */}
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-black text-slate-800 dark:text-slate-100 truncate max-w-[260px]" title={importState.fileName}>{importState.fileName}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold text-slate-600 dark:text-slate-300">{t('deliveries:shipments', { count: importRows.length })}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 font-bold text-emerald-700 dark:text-emerald-300">{t('deliveries:quick.newCount', { count: newImportRows.length })}</span>
                          {importRows.length > newImportRows.length && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 font-bold text-amber-700 dark:text-amber-300">{t('deliveries:quick.skipCount', { count: importRows.length - newImportRows.length })}</span>
                          )}
                          <span className="ms-auto font-bold text-slate-500">{t('deliveries:quick.totalQty')}: <span className="font-sans font-black text-slate-900 dark:text-white">{formatIQD(newImportRows.reduce((a, r) => a + r.receivedQuantity, 0))}</span> {t('common:units.liter')}</span>
                        </div>
                        {/* معاينة الصفوف */}
                        <div className="max-h-[46vh] overflow-auto">
                          <table className="w-full text-xs text-start whitespace-nowrap">
                            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-black">
                              <tr>
                                {['#', t('deliveries:col.supplier'), t('deliveries:col.company'), t('deliveries:col.driver'), t('deliveries:col.truckNumber'), t('deliveries:col.voucherNumber'), t('deliveries:col.quantity'), t('deliveries:col.density'), t('deliveries:col.color'), t('deliveries:col.price'), t('deliveries:col.cost'), t('deliveries:quick.receiptUnload'), t('deliveries:quick.status')].map((h) => (
                                  <th key={h} className="px-3 py-2">{enumText(h)}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                              {importRows.map((r, i) => {
                                const dup = isDuplicateRow(r);
                                const outside = !dup && isOutOfRange(r);
                                return (
                                  <tr key={i} className={dup || outside ? 'opacity-50' : 'odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-800 dark:even:bg-slate-800/60'}>
                                    <td className="px-3 py-2 font-sans text-slate-400">{i + 1}</td>
                                    <td className="px-3 py-2 font-bold">{r.supplierName || '—'}</td>
                                    <td className="px-3 py-2 font-bold">{r.supplierCompany || '—'}</td>
                                    <td className="px-3 py-2">{r.driverName || '—'}</td>
                                    <td className="px-3 py-2 font-sans">{r.truckNumber || '—'}</td>
                                    <td className="px-3 py-2 font-sans font-bold">{r.voucherNumber || '—'}</td>
                                    <td className="px-3 py-2 font-sans font-black">{formatIQD(r.receivedQuantity)}</td>
                                    <td className="px-3 py-2 font-sans">{r.productDensity || '—'}</td>
                                    <td className="px-3 py-2">{r.productColor || '—'}</td>
                                    <td className="px-3 py-2 font-sans">{formatIQD(r.productPrice)}</td>
                                    <td className="px-3 py-2 font-sans font-bold">{formatIQD(r.productCost)}</td>
                                    <td className="px-3 py-2 font-sans">{rowDate(r)}</td>
                                    <td className="px-3 py-2">
                                      {dup
                                        ? <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold">{t('deliveries:quick.already')}</span>
                                        : outside
                                        ? <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold">{t('deliveries:quick.outside')}</span>
                                        : <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold">{t('deliveries:quick.new')}</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (<>

                
                {/* 🏢 البطاقة 1: بيانات الجهة والناقل */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-3.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-black text-blue-800 dark:text-blue-400 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-sans font-bold">1</span>
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="text-xs">{t('deliveries:quick.partiesTitle')}</span>
                  </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* 1. اسم المجهز (الشخص/الوكيل) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('deliveries:col.supplier')}
                    </label>
                    <div className="relative">
                      <User className={`w-4.5 h-4.5 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400`} />
                      <input
                        type="text"
                        list="inbound-supplier-names"
                        value={deliverySupplierName}
                        onChange={(e) => setDeliverySupplierName(e.target.value)}
                        placeholder={t('deliveries:col.supplier')}
                        className={`w-full h-11 sm:h-12 ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all`}
                      />
                      <datalist id="inbound-supplier-names">
                        {supplierNames.map((n) => <option key={n} value={n} />)}
                      </datalist>
                    </div>
                  </div>

                  {/* 2. الشركة المجهزة */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {t('deliveries:col.company')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAddingSupplier(!isAddingSupplier)}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isAddingSupplier ? t('common:actions.cancel') : t('deliveries:quick.add')}</span>
                      </button>
                    </div>

                    {isAddingSupplier ? (
                      <div className="relative w-full h-11 sm:h-12 flex items-center">
                        <input
                          type="text"
                          placeholder={t('deliveries:quick.newSupplierPh')}
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewSupplier();
                            }
                            if (e.key === 'Escape') {
                              setIsAddingSupplier(false);
                            }
                          }}
                          className={`w-full h-full ${isRTL ? 'pl-16 pr-3.5' : 'pr-16 pl-3.5'} text-sm rounded-xl border-2 border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-bold shadow-2xs`}
                          autoFocus
                        />
                        <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-1.5' : 'right-1.5'} flex items-center gap-1`}>
                          <button
                            type="button"
                            onClick={handleAddNewSupplier}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                          >
                            {t('common:actions.save')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingSupplier(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={deliverySupplier}
                          onChange={(e) => setDeliverySupplier(e.target.value)}
                          className="w-full h-11 sm:h-12 px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all appearance-none cursor-pointer"
                        >
                          {suppliers.map((s) => (
                            <option key={s} value={s}>
                              {enumText(s)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3.5' : 'right-3.5'} pointer-events-none`} />
                      </div>
                    )}
                  </div>

                  {/* 3. اسم السائق */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('deliveries:col.driver')}
                    </label>
                    <div className="relative">
                      <User className={`w-4.5 h-4.5 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400`} />
                      <input
                        type="text"
                        value={deliveryDriver}
                        onChange={(e) => setDeliveryDriver(e.target.value)}
                        required
                        placeholder={t('deliveries:quick.driverPh')}
                        className={`w-full h-11 sm:h-12 ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all`}
                      />
                    </div>
                  </div>

                  {/* 4. رقم العجلة */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('deliveries:col.truckNumber')}
                    </label>
                    <div className="relative">
                      <Truck className={`w-4.5 h-4.5 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400`} />
                      <input
                        type="text"
                        value={truckNumberText}
                        onChange={(e) => setTruckNumberText(e.target.value)}
                        required
                        placeholder="19A 72911"
                        className={`w-full h-11 sm:h-12 ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-bold transition-all`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 📦 البطاقة 2: مواصفات الفوجر والمنتج (كبيرة وممتدة) */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-800 dark:text-indigo-400 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-sans font-bold">2</span>
                  <Fuel className="w-4 h-4" />
                  <span className="text-xs sm:text-sm">{t('deliveries:quick.specsTitle')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* 5. رقم الفوجر */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {t('deliveries:col.voucherNumber')}
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateVoucher}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        title={t('deliveries:quick.generateHint')}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{t('deliveries:quick.generate')}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <FileText className={`w-4.5 h-4.5 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400`} />
                      <input
                        type="text"
                        value={deliveryVoucher}
                        onChange={(e) => setDeliveryVoucher(e.target.value)}
                        required
                        placeholder="VCH-2026-XXXX"
                        className={`w-full h-11 sm:h-12 ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-bold transition-all`}
                      />
                    </div>
                  </div>

                  {/* 6. الكميه المستلمة (بفوارز) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('deliveries:col.quantity')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={rawVolume}
                        onChange={handleVolumeChange}
                        required
                        placeholder="36,000"
                        className={`w-full h-11 sm:h-12 ${isRTL ? 'pr-3.5 pl-12' : 'pl-3.5 pr-12'} py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-semibold text-blue-600 dark:text-blue-400 transition-all`}
                      />
                      <span className={`text-xs font-black text-blue-600 dark:text-blue-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3.5' : 'right-3.5'}`}>
                        {t('common:units.liter')}
                      </span>
                    </div>
                  </div>

                  {/* 7. كثافة المنتج */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('deliveries:col.density')}
                    </label>
                    <div className="relative">
                      <Gauge className={`w-4.5 h-4.5 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400`} />
                      <input
                        type="text"
                        value={deliveryDensity}
                        onChange={(e) => setDeliveryDensity(e.target.value)}
                        placeholder="0.840"
                        className={`w-full h-11 sm:h-12 ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-bold transition-all`}
                      />
                    </div>
                  </div>

                  {/* 8. لون المنتج (احمر - اصفر - عسلي - نفط ابيض - اضافة لون) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {t('deliveries:col.color')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAddingColor(!isAddingColor)}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isAddingColor ? t('common:actions.cancel') : t('deliveries:quick.add')}</span>
                      </button>
                    </div>

                    {isAddingColor ? (
                      <div className="relative w-full h-11 sm:h-12 flex items-center">
                        <input
                          type="text"
                          placeholder={t('deliveries:quick.newColorPh')}
                          value={newColorName}
                          onChange={(e) => setNewColorName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewColor();
                            }
                            if (e.key === 'Escape') {
                              setIsAddingColor(false);
                            }
                          }}
                          className={`w-full h-full ${isRTL ? 'pl-16 pr-3.5' : 'pr-16 pl-3.5'} text-sm rounded-xl border-2 border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none font-bold shadow-2xs`}
                          autoFocus
                        />
                        <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-1.5' : 'right-1.5'} flex items-center gap-1`}>
                          <button
                            type="button"
                            onClick={handleAddNewColor}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                          >
                            {t('common:actions.save')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingColor(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={deliveryColor}
                          onChange={(e) => setDeliveryColor(e.target.value)}
                          className="w-full h-11 sm:h-12 px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all appearance-none cursor-pointer"
                        >
                          {colors.map((c) => (
                            <option key={c} value={c}>
                              {enumText(c)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3.5' : 'right-3.5'} pointer-events-none`} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 💰 البطاقة 3: التسعير والتاريخ */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-400 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="w-4.5 h-4.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-sans font-bold">3</span>
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs sm:text-sm">{t('deliveries:quick.pricingTitle')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* 9. سعر المنتج (بفوارز) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('deliveries:quick.pricePerLiter')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={rawPrice}
                        onChange={handlePriceChange}
                        required
                        placeholder="510"
                        className={`w-full h-11 sm:h-12 ${isRTL ? 'pr-3.5 pl-12' : 'pl-3.5 pr-12'} py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-black transition-all`}
                      />
                      <span className={`text-xs font-bold text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3.5' : 'right-3.5'}`}>
                        {t('common:units.iqd')}
                      </span>
                    </div>
                  </div>

                  {/* 10. تكلفة المنتج الإجمالية (تلقائياً بعد الضرب بالسعر) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('deliveries:quick.autoCost')}
                    </label>
                    <div className="w-full h-11 sm:h-12 px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-sans font-black flex items-center justify-between shadow-2xs">
                      <span className="text-xs sm:text-sm font-black">{formatIQD(computedCost)}</span>
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 font-cairo">{t('common:units.iqd')}</span>
                    </div>
                  </div>

                  {/* 11. تاريخ الاستلام والتفريغ */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      {t('deliveries:quick.receiptUnload')}
                    </label>
                    <div className="relative">
                      <Calendar className={`w-4.5 h-4.5 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400`} />
                      <input
                        type="text"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        required
                        placeholder="YYYY/MM/DD"
                        className={`w-full h-11 sm:h-12 ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-bold transition-all`}
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* 📎 إرفاق الفوجر (Two-panel design) */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
                  
                  {/* Panel 1: Drag & Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-all duration-300 ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-900/30 scale-[1.02] shadow-[0_0_30px_rgba(59,130,246,0.15)]'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200/80 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 shadow-2xs">
                      <UploadCloud className="w-5 h-5 stroke-[2.2]" />
                    </div>

                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                      {t('deliveries:quick.dropHint')}
                    </p>

                    <label className="cursor-pointer px-5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 active:scale-95 transition-all mb-1.5">
                      <span>{t('deliveries:quick.browse')}</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    <span className="text-[10px] text-slate-400 font-sans">
                      {t('deliveries:quick.formats')}
                    </span>
                  </div>

                  {/* Panel 2: Uploaded File Info */}
                  <div className="flex flex-col justify-between rounded-2xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 p-3.5 min-h-[140px]">
                    <div>
                      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200/70 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Paperclip className="w-4 h-4 text-slate-500" />
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {t('deliveries:quick.attachedFiles')} ({attachments.length + uploadingFiles.length})
                          </h4>
                        </div>
                        {attachments.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            {t('deliveries:quick.ready', { count: attachments.length })}
                          </span>
                        )}
                      </div>

                      {(attachments.length > 0 || uploadingFiles.length > 0) ? (
                        <div className="space-y-2 max-h-[130px] overflow-y-auto overflow-x-hidden pe-1.5 ps-0.5 custom-scrollbar">
                          {uploadingFiles.map((upFile) => (
                            <div
                              key={upFile.id}
                              className="relative flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-md shadow-blue-500/5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 group"
                            >
                              {/* Glowing background gradient that fills up */}
                              <div 
                                className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 transition-all duration-300 ease-out z-0"
                                style={{ width: `${upFile.progress}%` }} 
                              />
                              
                              {/* Sharp bottom progress line with glow */}
                              <div 
                                className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] transition-all duration-300 ease-out z-10"
                                style={{ width: `${upFile.progress}%` }}
                              />

                              <div className="flex items-center gap-3 min-w-0 flex-1 z-10">
                                {/* Animated Icon Container */}
                                <div className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-100/50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 overflow-hidden">
                                  {upFile.progress < 100 ? (
                                    <>
                                      <div className="absolute inset-0 border-[2.5px] border-blue-500/20 rounded-lg animate-[spin_3s_linear_infinite]" />
                                      <UploadCloud className="w-4 h-4 animate-bounce" />
                                    </>
                                  ) : (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-in zoom-in duration-200" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {upFile.name}
                                  </p>
                                  <div className="flex items-center justify-between mt-1">
                                    <p className={`text-[10px] font-sans font-black transition-colors duration-200 ${upFile.progress === 100 ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                      {upFile.progress === 100 ? t('deliveries:quick.uploaded') : t('deliveries:quick.uploading')}
                                    </p>
                                    <span className={`text-[10px] font-bold font-sans transition-colors duration-200 ${upFile.progress === 100 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                      {upFile.progress}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    att.type === 'pdf'
                                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-800'
                                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 border border-blue-200 dark:border-blue-800'
                                  }`}
                                >
                                  {att.type === 'pdf' ? (
                                    <FileText className="w-3.5 h-3.5" />
                                  ) : (
                                    <Image className="w-3.5 h-3.5" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={att.name}>
                                    {att.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-sans">
                                    {(att.size / 1024).toFixed(1)} KB • {att.type === 'pdf' ? 'PDF' : 'Image'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ms-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewFile(att)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                                  title={t('deliveries:previewDoc')}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttachment(att.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                  title={t('common:actions.delete')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 flex flex-col items-center justify-center text-center text-slate-400 space-y-1">
                          <FileText className="w-6 h-6 opacity-30 stroke-[1.5]" />
                          <p className="text-[11px] font-medium text-slate-400">
                            {t('deliveries:quick.noFiles')}
                          </p>
                        </div>
                      )}
                    </div>

                    {attachments.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('deliveries:quick.attached', { count: attachments.length })}
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              </div>

                </>)}
              </div>

              {/* 🛡️ Enterprise Permanent Sticky Bottom Action Toolbar (Always Visible) */}
              <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-lg select-none z-10">
                <div className="flex items-center gap-2 sm:gap-3 text-xs">
                  {computedCost > 0 && (
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-cairo">{t('deliveries:quick.totalCost')}:</span>
                      <span className="font-sans font-black text-xs">{formatNumber(computedCost)} {t('common:units.iqd')}</span>
                    </div>
                  )}
                  {attachments.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 font-bold shadow-2xs">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-[11px]">{t('deliveries:quick.files', { count: attachments.length })}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    {t('common:actions.cancel')}
                  </button>

                  {entryMode === 'upload' ? (
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    disabled={!newImportRows.length}
                    className="px-6 sm:px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black shadow-lg shadow-blue-900/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-400/20"
                  >
                    <Upload className="w-4.5 h-4.5 stroke-[2.2]" />
                    <span>{t('deliveries:quick.import', { count: newImportRows.length })}</span>
                  </button>
                  ) : (
                  <button
                    type="submit"
                    className="px-6 sm:px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white text-xs sm:text-sm font-black shadow-lg shadow-blue-900/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-400/20"
                  >
                    <Truck className="w-4.5 h-4.5 stroke-[2.2]" />
                    <span>{editData?.id ? t('common:actions.saveChanges') : t('deliveries:quick.confirm')}</span>
                  </button>
                  )}
                </div>
              </div>

            </form>
        </div>
      </div>

      {/* 🔍 Document Preview Lightbox Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
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
                  className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
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
        </div>
      )}
    </div>
  );
};
