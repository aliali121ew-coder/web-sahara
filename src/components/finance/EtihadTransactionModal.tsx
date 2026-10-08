import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  PlusCircle,
  MinusCircle,
  Calculator,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  Check,
  BarChart2,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  FileUp,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';
import { EtihadBalanceRecord } from '../../types/finance';
import { formatNumber, getBusinessDate } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import { readEtihadReportFile } from '../../lib/etihadReportFile';
import { useReportAttach } from '../../lib/saharaFiles';
import { ReportAttachNotice } from './DayFilesCell';

interface EtihadTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** يعيد رقم السجل المحفوظ (لإرفاق ملف الكشف به في الأرشيف) */
  onSave: (record: Omit<EtihadBalanceRecord, 'id'>, id?: string) => string | void;
  editRecord?: EtihadBalanceRecord | null;
  lastRecordedPrice?: number;
  defaultPreviousBalance?: number;
}

export const EtihadTransactionModal: React.FC<EtihadTransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editRecord,
  lastRecordedPrice = 0,
  defaultPreviousBalance = 0
}) => {
  const { direction } = useLanguage();
  const { t, i18n } = useTranslation(['finance', 'common']);
  const isRTL = direction === 'rtl';

  // Helper to format input string with commas
  const formatInputValue = (val: string | number): string => {
    if (val === 0 || val === '0') return '';
    const rawValue = val.toString().replace(/[^0-9.]/g, '');
    if (!rawValue) return '';
    if (parseFloat(rawValue) === 0) return '';
    const parts = rawValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
  };

  const handleNumChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(formatInputValue(e.target.value));
  };

  // Form State
  const [date, setDate] = useState<string>('2026/09/09');
  const [previousBalance, setPreviousBalance] = useState<string>(formatInputValue(defaultPreviousBalance));
  const [purchases, setPurchases] = useState<string>('');

  // Deductions
  const [etihadExpense, setEtihadExpense] = useState<string>('');
  // المبيعات خانة واحدة (السجلات القديمة المفصّلة تُجمع فيها عند التعديل)
  const [sales, setSales] = useState<string>('');

  // ملف الكشف: يعبّئ الخانات، ويُرفق باليوم في الأرشيف عند الحفظ فقط
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<
    { status: 'idle' } | { status: 'reading'; name: string } | { status: 'done'; name: string; check: string } | { status: 'error'; message: string }
  >({ status: 'idle' });
  const reportAttach = useReportAttach();

  // للعرض فقط (لا تدخل في الاستهلاك ولا الرصيد)
  const [operationalGas, setOperationalGas] = useState<string>('');
  const [cleanGas, setCleanGas] = useState<string>('');

  // Pricing & Notes
  const [currentPrice, setCurrentPrice] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Populate on edit or reset on open
  useEffect(() => {
    if (editRecord) {
      setDate(editRecord.date);
      setPreviousBalance(formatInputValue(editRecord.previousBalance));
      setPurchases(formatInputValue(editRecord.purchases));
      setEtihadExpense(formatInputValue(editRecord.etihadExpense));
      setSales(formatInputValue((editRecord.saharaSales || 0) + (editRecord.cablesSales || 0) + (editRecord.specialSales || 0) + (editRecord.otherSales || 0)));
      setOperationalGas(formatInputValue(editRecord.operationalGas ?? 0));
      setCleanGas(formatInputValue(editRecord.cleanGas ?? 0));
      setCurrentPrice(formatInputValue(editRecord.currentPrice));
      setNotes(editRecord.notes || '');
    } else {
      const today = getBusinessDate();
      setDate(today || '2026/09/09');
      setPreviousBalance(formatInputValue(defaultPreviousBalance));
      setPurchases('');
      setEtihadExpense('');
      setSales('');
      setOperationalGas('');
      setCleanGas('');
      setCurrentPrice('');
      setNotes('');
    }
    setReportFile(null);
    setUpload({ status: 'idle' });
  }, [editRecord, isOpen, defaultPreviousBalance, lastRecordedPrice]);

  // Keyboard Shortcuts: Esc to close, Ctrl+Enter to submit
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const form = document.getElementById('etihad-tx-form') as HTMLFormElement | null;
        if (form) {
          form.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clean numeric helper
  const parseNum = (val: string): number => {
    const clean = val.replace(/,/g, '').trim();
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };

  // Real-time Arithmetic Calculation
  const calcPreviousBalance = parseNum(previousBalance);
  const calcPurchases = parseNum(purchases);

  const calcEtihadExpense = parseNum(etihadExpense);
  const totalSalesDeductions = parseNum(sales);

  const totalDeductions = useMemo(() => {
    return calcEtihadExpense + totalSalesDeductions;
  }, [calcEtihadExpense, totalSalesDeductions]);

  const netAvailableBalance = useMemo(() => {
    return (calcPreviousBalance + calcPurchases) - totalDeductions;
  }, [calcPreviousBalance, calcPurchases, totalDeductions]);

  // Delta between net available balance and previous balance
  const balanceDelta = useMemo(() => {
    return netAvailableBalance - calcPreviousBalance;
  }, [netAvailableBalance, calcPreviousBalance]);

  // Over-deduction validation state
  const isOverDeducted = useMemo(() => {
    return totalDeductions > (calcPreviousBalance + calcPurchases);
  }, [totalDeductions, calcPreviousBalance, calcPurchases]);

  // Chart data: المشتريات (أخضر)، المبيعات (رصاصي)، مصروف الاتحاد (أحمر)
  const chartData = useMemo(() => [
    { name: t('finance:tx.purchases'), val: calcPurchases, fill: '#10b981' },
    { name: t('finance:tx.sales'), val: totalSalesDeductions, fill: '#64748b' },
    { name: t('finance:tx.etihadExpense'), val: calcEtihadExpense, fill: '#ef4444' }
  ], [calcPurchases, totalSalesDeductions, calcEtihadExpense, t]);

  const notice = <ReportAttachNotice state={reportAttach.state} onClose={reportAttach.dismiss} />;
  if (!isOpen) return notice;

  // تعبئة من ملف الكشف: الوارد → المشتريات، الاستهلاك → الاستهلاك، المبيعات → المبيعات
  const fillFromReport = async (file: File) => {
    setUpload({ status: 'reading', name: file.name });
    setReportFile(null);
    try {
      const r = await readEtihadReportFile(file);
      const fmt = (n: number | null) => (n === null ? '' : formatInputValue(Math.round(n)));
      if (r.inbound !== null) setPurchases(fmt(r.inbound));
      if (r.consumption !== null) setEtihadExpense(fmt(r.consumption));
      if (r.sales !== null) setSales(fmt(r.sales));
      // تاريخ الكشف يصبح تاريخ الحركة (للتسجيل الجديد فقط)
      if (!editRecord && r.date) setDate(r.date);
      // التحقق: السابق + الوارد − الاستهلاك − المبيعات = الرصيد الحالي في الكشف
      let check = '';
      if (r.current !== null) {
        const prev = r.previous ?? calcPreviousBalance;
        const diff = Math.round(prev + (r.inbound ?? 0) - (r.consumption ?? 0) - (r.sales ?? 0) - r.current);
        check = diff === 0
          ? t('finance:tx.upload.checkMatch', { value: formatNumber(r.current) })
          : t('finance:tx.upload.checkMismatch', { value: formatNumber(r.current), diff: formatNumber(diff) });
      }
      if (r.previous !== null && Math.round(r.previous) !== Math.round(calcPreviousBalance)) {
        check = [check, t('finance:tx.upload.prevDiffers', { file: formatNumber(r.previous), system: formatNumber(calcPreviousBalance) })].filter(Boolean).join(' — ');
      }
      if (!editRecord && r.date) check = [t('finance:saharaBalance.upload.dateFromFile', { date: r.date }), check].filter(Boolean).join(' — ');
      setUpload({ status: 'done', name: file.name, check });
      setReportFile(file);
    } catch (e) {
      setUpload({ status: 'error', message: e instanceof Error ? e.message : t('finance:ledger.upload.parseFailed') });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverDeducted) return;

    const recordPayload: Omit<EtihadBalanceRecord, 'id'> = {
      date: date.trim() || '2026/09/09',
      previousBalance: calcPreviousBalance,
      purchases: calcPurchases,
      etihadExpense: calcEtihadExpense,
      // المبيعات تُحفظ في خانة واحدة
      saharaSales: 0,
      cablesSales: 0,
      specialSales: 0,
      otherSales: totalSalesDeductions,
      operationalGas: parseNum(operationalGas),
      cleanGas: parseNum(cleanGas),
      totalDeductions,
      currentBalance: netAvailableBalance,
      oilPreviousBalance: 0,
      oilInbound: 0,
      oilSales: 0,
      oilCurrentBalance: 0,
      currentPrice: parseNum(currentPrice) || lastRecordedPrice,
      averageCost: 535,
      notes: notes.trim(),
      createdAt: new Date().toISOString()
    };

    const savedId = onSave(recordPayload, editRecord?.id) || editRecord?.id;
    if (reportFile && savedId) reportAttach.attach(savedId, reportFile);
    setReportFile(null);
    onClose();
  };

  return (
    <>
    {notice}
    {createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      dir={i18n.dir()}
    >
      <div
        className="relative w-full max-w-5xl my-auto flex flex-col bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Enterprise Clean Header (Matches QuickActionModal) */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-2xs select-none shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs shrink-0">
              <Calculator className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                  {editRecord ? t('finance:tx.editTitle') : t('finance:tx.newTitle')}
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {t('finance:tx.etihadIndustrial')}
                </span>
              </div>
              <p className="hidden sm:block text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                {t('finance:tx.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ms-auto">
            <label
              title={t('finance:tx.upload.hint')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer transition-all ${upload.status === 'reading' ? 'opacity-60 pointer-events-none' : ''}`}
            >
              {upload.status === 'reading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
              {t('finance:tx.upload.button')}
              <input type="file" accept=".pdf,.xlsx,.xlsm,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fillFromReport(f); }} />
            </label>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common:actions.close')}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Modal Form & Body Container (بدون scroll داخلي) */}
        <form id="etihad-tx-form" onSubmit={handleSubmit} className="flex flex-col bg-slate-50/40 dark:bg-slate-900/40">

          {/* Form Cards Area (No Internal Scroll) */}
          <div className="p-3.5 sm:p-4">
            {upload.status === 'done' && (
              <div className="mb-3 flex items-start gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('finance:tx.upload.filled', { name: upload.name })}{upload.check && <> — {upload.check}</>}</span>
              </div>
            )}
            {upload.status === 'error' && (
              <div className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {upload.message}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">

                {/* 📋 اليمين: بطاقات إدخال البيانات المنسقة (7 أعمدة) */}
                <div className="lg:col-span-7 space-y-2.5">

                  {/* 🏢 البطاقة 1: بيانات الجهة والحساب والتاريخ */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-3.5 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-black text-blue-800 dark:text-blue-400 mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-sans font-bold">1</span>
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="text-xs sm:text-sm">{t('finance:tx.accountData')}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* الجهة المستلمة */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {t('finance:tx.account')}
                        </label>
                        <div className="w-full h-10 sm:h-10.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 flex items-center gap-2 font-bold text-xs">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate">{t('finance:tx.etihadIndustrial')}</span>
                        </div>
                      </div>

                      {/* تاريخ الحركة */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {t('finance:tx.date')}
                        </label>
                        <div className="relative">
                          <Calendar className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                          <input
                            type="text"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            placeholder="YYYY/MM/DD"
                            className={`w-full h-10 sm:h-10.5 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-bold transition-all text-center`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 📥 البطاقة 2: أضافة وارد وحركة الرصيد */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-3.5 shadow-2xs border-r-4 border-r-blue-600">
                    <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-black text-blue-800 dark:text-blue-400">
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-sans font-bold">2</span>
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span className="text-xs sm:text-sm">{t('finance:tx.addInbound')}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">
                        {t('finance:tx.prevAndNew')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* الرصيد السابق (تلميح مرجعي) */}
                      <div className="space-y-1 opacity-80 hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {t('finance:ledger.previousBalance')}
                          </label>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({t('finance:tx.reference')})
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={previousBalance}
                            onChange={handleNumChange(setPreviousBalance)}
                            placeholder="0"
                            dir="ltr"
                            className={`w-full h-10 sm:h-10.5 ${isRTL ? 'pr-3 pl-12' : 'pl-3 pr-12'} py-1.5 text-xs rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-400 outline-none font-sans font-medium tabular-nums transition-all text-left`}
                          />
                          <span className={`text-xs text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'}`}>
                            {t('common:units.liter')}
                          </span>
                        </div>
                      </div>

                      {/* المشتريات */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {t('finance:tx.purchases')}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={purchases}
                            onChange={handleNumChange(setPurchases)}
                            placeholder="0"
                            dir="ltr"
                            className={`w-full h-10 sm:h-10.5 ${isRTL ? 'pr-3 pl-12' : 'pl-3 pr-12'} py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-black tabular-nums transition-all text-left`}
                          />
                          <span className={`text-xs font-bold text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'}`}>
                            {t('common:units.liter')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 📤 البطاقة 3: الاستهلاك الكلي (-) */}
                  <div className={`bg-white dark:bg-slate-800 rounded-2xl border ${isOverDeducted ? 'border-rose-500/80 ring-2 ring-rose-500/20' : 'border-slate-200/90 dark:border-slate-800'} p-3 sm:p-3.5 shadow-2xs border-r-4 ${isOverDeducted ? 'border-r-rose-500' : 'border-r-slate-400'}`}>
                    <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-300">
                        <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-sans font-bold">3</span>
                        <MinusCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs sm:text-sm">{t('finance:archive.col.totalConsumption')}</span>
                      </div>
                      <span className="text-xs font-sans font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-xl border border-slate-200 dark:border-slate-700 tabular-nums">
                        {t('finance:saharaPetrol.total')}: {formatNumber(totalDeductions)} {t('common:units.liter')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* الاستهلاك */}
                      <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 truncate block">
                          {t('finance:tx.etihadExpense')}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={etihadExpense}
                            onChange={handleNumChange(setEtihadExpense)}
                            placeholder="0"
                            dir="ltr"
                            className={`w-full h-9 ${isRTL ? 'pr-2.5 pl-9' : 'pl-2.5 pr-9'} py-1 text-xs rounded-xl border ${isOverDeducted ? 'border-rose-400 dark:border-rose-600 bg-rose-50/40 dark:bg-rose-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900'} text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-bold tabular-nums transition-all text-left`}
                          />
                          <span className={`text-[10px] font-bold text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-2' : 'right-2'}`}>
                            {t('common:units.liter')}
                          </span>
                        </div>
                      </div>

                      {/* المبيعات */}
                      <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 truncate block">
                          {t('finance:tx.sales')}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={sales}
                            onChange={handleNumChange(setSales)}
                            placeholder="0"
                            dir="ltr"
                            className={`w-full h-9 ${isRTL ? 'pr-2.5 pl-9' : 'pl-2.5 pr-9'} py-1 text-xs rounded-xl border ${isOverDeducted ? 'border-rose-400 dark:border-rose-600 bg-rose-50/40 dark:bg-rose-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900'} text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-bold tabular-nums transition-all text-left`}
                          />
                          <span className={`text-[10px] font-bold text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-2' : 'right-2'}`}>
                            {t('common:units.liter')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isOverDeducted && (
                      <div className="mt-2 p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{t('finance:tx.overWarning')}</span>
                      </div>
                    )}

                    {/* كاز تشغيلي وكاز نظيف: للعرض فقط، لا يدخلان في المجموع ولا الرصيد */}
                    <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">{t('finance:tx.displayOnly')}</span>
                        <span className="text-[9.5px] font-bold text-slate-400">{t('finance:tx.noEffect')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          [t('finance:tx.operationalGas'), operationalGas, setOperationalGas],
                          [t('finance:tx.cleanGas'), cleanGas, setCleanGas],
                        ] as const).map(([label, value, setter]) => (
                          <div key={label} className="space-y-1">
                            <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 truncate block">{label}</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={value}
                                onChange={handleNumChange(setter)}
                                placeholder="0"
                                dir="ltr"
                                className={`w-full h-9 ${isRTL ? 'pr-2.5 pl-9' : 'pl-2.5 pr-9'} py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-bold tabular-nums transition-all text-left`}
                              />
                              <span className={`text-[10px] font-bold text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-2' : 'right-2'}`}>
                                {t('common:units.liter')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 💰 البطاقة 4: بيانات التسعير */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-3.5 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-300 mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="w-4 h-4 rounded-full bg-slate-600 text-white flex items-center justify-center text-[10px] font-sans font-bold">4</span>
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="text-xs sm:text-sm">{t('finance:tx.pricing')}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {t('finance:tx.currentPrice')}
                        </label>
                        <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
                          {t('finance:saharaBalance.previousPrice')}: {formatNumber(lastRecordedPrice)} {t('common:units.iqd')}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={currentPrice}
                          onChange={handleNumChange(setCurrentPrice)}
                          placeholder={String(lastRecordedPrice)}
                          dir="ltr"
                          className={`w-full h-10 sm:h-10.5 ${isRTL ? 'pr-3 pl-11' : 'pl-3 pr-11'} py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans font-black tabular-nums transition-all text-center`}
                        />
                        <span className={`text-xs font-bold text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'}`}>
                          {t('common:units.iqd')}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* 🌟 اليسار: قسم الرصيد الحالي والمقارنة البيانية الموسعة (5 أعمدة) 🌟 */}
                <div className="lg:col-span-5 flex flex-col gap-2.5">

                  {/* 🟢 1. بطاقة الرصيد المتوفر الآن الفخمة (زيادة الحجم 20% الإجمالي مع ضبط حجم النص) */}
                  <div className="shrink-0 p-5 sm:p-6 rounded-3xl min-h-[140px] flex flex-col justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-lg relative overflow-hidden">
                    {/* خلفية جمالية */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/12 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-start justify-between mb-2 text-slate-400 relative z-10">
                      <span className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <Layers className="w-4 h-4 text-emerald-400" />
                        </div>
                        {t('finance:tx.availableNow')}
                      </span>
                      <div className="flex flex-col items-end gap-1.5 mt-1">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-800/70 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          {t('finance:tx.instant')}
                        </span>
                      </div>
                    </div>

                    <div className="my-3 relative z-10 flex items-center justify-between w-full">
                      <div className="text-3xl sm:text-4xl md:text-[36px] font-black font-sans tracking-tight text-white tabular-nums drop-shadow-sm leading-none">
                        {formatNumber(netAvailableBalance)}
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 font-cairo bg-emerald-950/60 px-3 py-0.5 rounded-md border border-emerald-800/60 shrink-0">
                        {t('finance:tx.litersAvailable')}
                      </span>
                    </div>

                    {/* سطر الفرق عن الرصيد السابق (▲ / ▼) */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-[13px] relative z-10">
                      <span className="text-slate-400 font-medium">{t('finance:tx.changeFromPrev')}:</span>
                      {balanceDelta === 0 ? (
                        <span className="text-slate-400 font-bold font-sans text-xs">{t('finance:tx.noChangeLiters')}</span>
                      ) : balanceDelta > 0 ? (
                        <span className="text-emerald-400 font-black font-sans text-xs flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                          +{formatNumber(balanceDelta)} {t('common:units.liter')}
                        </span>
                      ) : (
                        <span className="text-rose-400 font-black font-sans text-xs flex items-center gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5 stroke-[3]" />
                          {formatNumber(Math.abs(balanceDelta))} {t('common:units.liter')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 📈 2. كارت مقارنة التوريد والاستهلاك والمبيعات */}
                  <div className="flex-1 flex flex-col justify-between p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 dark:border-slate-800 shrink-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800 dark:text-slate-200">
                        <BarChart2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{t('finance:tx.chartTitle')}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        {t('finance:tx.flowVolume')}
                      </span>
                    </div>

                    {/* المخطط البياني (متناسق ومرتكز مباشرة على الصناديق) */}
                    <div className="flex-1 min-h-[90px] w-full pt-0.5 pb-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.12} />
                          <XAxis hide dataKey="name" height={0} />
                          <YAxis hide domain={[0, 'auto']} />
                          <Tooltip
                            formatter={(val: number) => [`${formatNumber(val)} ${t('common:units.liter')}`, t('finance:tx.quantity')]}
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderRadius: '8px',
                              border: '1px solid #1e293b',
                              color: '#fff',
                              fontSize: '11px',
                              padding: '4px 8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}
                          />
                          <Bar dataKey="val" radius={[4, 4, 0, 0]} barSize={26}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* إحصائيات المقارنة الثلاثية المباشرة (قاعدة الأعمدة تماماً) */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-center shrink-0" dir="ltr">
                      {/* المشتريات (تحت المستطيل الأخضر تماماً) */}
                      <div className="p-1 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40" dir={i18n.dir()}>
                        <span className="block text-[9px] text-emerald-700 dark:text-emerald-400 font-bold">{t('finance:tx.purchases')}</span>
                        <span className="text-[11px] font-black font-sans text-emerald-800 dark:text-emerald-300 tabular-nums">
                          {formatNumber(calcPurchases)} {t('common:units.liter')}
                        </span>
                      </div>

                      {/* المبيعات (تحت المستطيل الرمادي تماماً) */}
                      <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800" dir={i18n.dir()}>
                        <span className="block text-[9px] text-slate-600 dark:text-slate-400 font-bold">{t('finance:tx.sales')}</span>
                        <span className="text-[11px] font-black font-sans text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatNumber(totalSalesDeductions)} {t('common:units.liter')}
                        </span>
                      </div>

                      {/* مصروف الاتحاد (تحت المستطيل الأحمر تماماً) */}
                      <div className="p-1 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40" dir={i18n.dir()}>
                        <span className="block text-[9px] text-rose-700 dark:text-rose-400 font-bold">{t('finance:tx.etihadExpense')}</span>
                        <span className="text-[11px] font-black font-sans text-rose-800 dark:text-rose-300 tabular-nums">
                          {formatNumber(calcEtihadExpense)} {t('common:units.liter')}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>

            {/* 🛡️ Enterprise Permanent Sticky Bottom Action Toolbar (Matches QuickActionModal) */}
            <div className="px-5 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0 shadow-lg select-none z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                {t('common:actions.cancel')}
              </button>

              <button
                type="submit"
                disabled={isOverDeducted}
                className={`px-6 sm:px-8 py-2 rounded-xl ${
                  isOverDeducted
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white shadow-lg shadow-blue-900/25 active:scale-95 cursor-pointer border border-blue-400/20'
                } text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2`}
              >
                <Check className="w-4.5 h-4.5 stroke-[2.2]" />
                <span>{editRecord ? t('common:actions.saveChanges') : t('finance:tx.saveRecord')}</span>
              </button>
            </div>

          </form>
      </div>
    </div>,
    document.body
    )}
    </>
  );
};
