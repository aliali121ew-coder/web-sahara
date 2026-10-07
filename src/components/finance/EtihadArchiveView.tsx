import React, { useState, useMemo } from 'react';
import {
  Archive,
  Calendar,
  Search,
  Plus,
  ArrowUpDown,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Database,
  Fuel,
  DollarSign,
  TrendingDown,
  Layers
} from 'lucide-react';
import { EtihadBalanceRecord } from '../../types/finance';
import { formatNumber } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation, Trans } from 'react-i18next';
import { EtihadPrintModal } from './EtihadPrintModal';
import { Breadcrumb } from '../navigation/Breadcrumb';

export interface EtihadArchiveViewProps {
  records: EtihadBalanceRecord[];
  onBack: () => void;
  onAddNew: () => void;
  onEdit: (record: EtihadBalanceRecord) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onImportBackup?: (imported: EtihadBalanceRecord[]) => void;
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
  /** عند التضمين داخل مركز التقارير: إخفاء المسار الخاص بالصفحة */
  embedded?: boolean;
}

export const EtihadArchiveView: React.FC<EtihadArchiveViewProps> = ({
  records,
  onBack,
  onAddNew,
  onEdit,
  onDelete,
  onDeleteMany,
  isEditMode,
  setIsEditMode,
  embedded = false,
}) => {
  const { isRTL } = useLanguage();

  const { t } = useTranslation(['finance', 'common']);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  // Date Filtering
  const [dateRangeType, setDateRangeType] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Print & PDF Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Pagination State (10 items per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Filter and Sort Records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Date filtering
    if (dateRangeType === 'today') {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      result = result.filter(r => r.date.replace(/-/g, '/') === today);
    } else if (dateRangeType === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0].replace(/-/g, '/');
      result = result.filter(r => r.date.replace(/-/g, '/') >= oneWeekAgoStr);
    } else if (dateRangeType === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0].replace(/-/g, '/');
      result = result.filter(r => r.date.replace(/-/g, '/') >= oneMonthAgoStr);
    } else if (dateRangeType === 'custom' && (startDate || endDate)) {
      result = result.filter(r => {
        const rowDate = r.date.replace(/\//g, '-');
        const afterStart = startDate ? rowDate >= startDate : true;
        const beforeEnd = endDate ? rowDate <= endDate : true;
        return afterStart && beforeEnd;
      });
    }

    // Text search (date, notes, numbers)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        r.date.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        r.previousBalance.toString().includes(q) ||
        r.currentBalance.toString().includes(q) ||
        (r.purchases && r.purchases.toString().includes(q)) ||
        (r.etihadExpense && r.etihadExpense.toString().includes(q))
      );
    }

    // Sorting by date
    result.sort((a, b) => {
      const comp = a.date.localeCompare(b.date);
      return sortDirection === 'desc' ? -comp : comp;
    });

    return result;
  }, [records, searchQuery, sortDirection, dateRangeType, startDate, endDate]);

  // Reset to page 1 if filter criteria changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateRangeType, startDate, endDate]);

  // Aggregate Metrics over Filtered Records
  const summary = useMemo(() => {
    let totalPurchases = 0;
    let totalExpense = 0;
    let totalSahara = 0;
    let totalCables = 0;
    let totalSpecial = 0;
    let totalOther = 0;

    filteredRecords.forEach(r => {
      totalPurchases += (r.purchases || 0);
      totalExpense += (r.etihadExpense || 0);
      totalSahara += (r.saharaSales || 0);
      totalCables += (r.cablesSales || 0);
      totalSpecial += (r.specialSales || 0);
      totalOther += (r.otherSales || 0);
    });

    const totalSales = totalSahara + totalCables + totalSpecial + totalOther;
    const latestBalance = filteredRecords.length > 0 ? filteredRecords[0].currentBalance : (records[0]?.currentBalance || 0);

    return {
      count: filteredRecords.length,
      totalPurchases,
      totalExpense,
      totalSales,
      latestBalance
    };
  }, [filteredRecords, records]);

  // Pagination Calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRecords.length);
  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, startIndex, endIndex]);


  const filterDateLabelText = useMemo(() => {
    if (dateRangeType === 'today') return t('finance:hub.filterToday');
    if (dateRangeType === 'week') return t('common:print.rangeWeek');
    if (dateRangeType === 'month') return t('common:print.rangeMonth');
    if (dateRangeType === 'custom' && (startDate || endDate)) {
      return t('common:print.rangeFromTo', { from: startDate || '...', to: endDate || '...' });
    }
    return t('finance:etihadArchive.allCumulative');
  }, [dateRangeType, startDate, endDate, t]);

  return (
    <>
      {/* ========================================================= */}
      {/* Screen Interactive View                                   */}
      {/* ========================================================= */}
      <div className="no-print w-full space-y-5 animate-in fade-in duration-200">

        {/* Breadcrumb Path (هامش ثابت وموحّد أسفلها في كل صفحات البرنامج) */}
        {!embedded && (
          <Breadcrumb
            items={[
              { label: t('finance:hub.companyBalance'), onClick: onBack },
              { label: t('finance:etihadArchive.archive') }
            ]}
          />
        )}

        {/* ========================================================= */}
        {/* 1. CORPORATE HEADER                                       */}
        {/* ========================================================= */}
        <div className="!mt-2 w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-soft-card">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-700 via-teal-800 to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-teal-700/20 shrink-0">
              <Archive className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {t('finance:etihadArchive.title')}
                </h2>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {t('finance:etihadArchive.subtitle')}
              </p>
            </div>
          </div>
        </div>

      {/* ========================================================= */}
      {/* 2. MINI KPI SUMMARY CARDS (Inspired by Inbound Deliveries) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
        {/* Card 1: عدد الحركات */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">{t('finance:etihadArchive.listed')}</span>
            <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatNumber(summary.count)}{' '}
            <span className="text-xs font-bold text-teal-600 font-sans">{t('finance:etihadArchive.txUnit')}</span>
          </div>
        </div>

        {/* Card 2: إجمالي المشتريات / الوارد */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">{t('finance:etihadArchive.totalInbound')}</span>
            <Fuel className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatNumber(summary.totalPurchases)}{' '}
            <span className="text-xs font-bold text-slate-500 font-sans">{t('common:units.liter')}</span>
          </div>
        </div>

        {/* Card 3: إجمالي مصروف الاتحاد */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">{t('finance:tx.etihadExpense')}</span>
            <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {formatNumber(summary.totalExpense)}{' '}
            <span className="text-xs font-bold text-slate-500 font-sans">{t('common:units.liter')}</span>
          </div>
        </div>

        {/* Card 4: إجمالي المبيعات */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">{t('finance:etihadArchive.totalSales')}</span>
            <DollarSign className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatNumber(summary.totalSales)}{' '}
            <span className="text-xs font-bold text-slate-500 font-sans">{t('common:units.liter')}</span>
          </div>
        </div>

        {/* Card 5: الرصيد الختامي */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">{t('finance:etihadArchive.bookedBalance')}</span>
            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-300 font-mono">
            {formatNumber(summary.latestBalance)}{' '}
            <span className="text-xs font-bold text-teal-600 font-sans">{t('common:units.liter')}</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. ADVANCED ARCHIVE DATA TABLE CARD                       */}
      {/* ========================================================= */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card overflow-hidden">

        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          {/* Quick Search */}
          <div className="relative flex-1 max-w-md">
            <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('finance:etihadArchive.search')}
              className={`w-full ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 shadow-2xs`}
            />
          </div>

          {/* Action Filters and Tools */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">

            {/* Bulk Delete Action */}
            {selectedRows.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('finance:etihadArchive.confirmDeleteSelected', { count: selectedRows.size }))) {
                    onDeleteMany(Array.from(selectedRows));
                    setSelectedRows(new Set());
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl font-bold text-xs transition-colors shadow-2xs cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('finance:etihadArchive.deleteSelected')} ({selectedRows.size})</span>
              </button>
            )}

            {/* Date Range Selector Pills */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setDateRangeType('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  dateRangeType === 'all'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                {t('common:enum.category.all')}
              </button>

              <button
                type="button"
                onClick={() => setDateRangeType('month')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  dateRangeType === 'month'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                {t('common:print.rangeMonth')}
              </button>

              <button
                type="button"
                onClick={() => setDateRangeType('week')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  dateRangeType === 'week'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                {t('common:print.rangeWeek')}
              </button>

              {/* Custom Date Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    dateRangeType === 'custom'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t('finance:etihadArchive.custom')}</span>
                </button>

                {showDatePicker && (
                  <div className="absolute top-full mt-2 left-0 sm:right-0 sm:left-auto w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3.5 z-50 animate-in zoom-in-95">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('finance:etihadArchive.fromDate')}</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('finance:etihadArchive.toDate')}</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setDateRangeType('all');
                            setShowDatePicker(false);
                          }}
                          className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                        >
                          {t('common:actions.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDateRangeType('custom');
                            setShowDatePicker(false);
                          }}
                          className="px-3.5 py-1.5 text-xs bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 cursor-pointer shadow-xs"
                        >
                          {t('common:calendar.apply')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sort Order Toggle */}
            <button
              type="button"
              onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
              title={t('finance:etihadArchive.sortByDate')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* Toggle Edit Mode */}
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isEditMode
                  ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditMode ? t('finance:etihadArchive.hideControls') : t('finance:etihadArchive.editDelete')}</span>
            </button>

          </div>
        </div>

        {/* Paginated Corporate Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[950px] text-start text-xs border-collapse">
            <thead>
              <tr className="bg-[#eef2f8] dark:bg-[#1c2b44] text-[#1c3b6f] dark:text-blue-100 border-b-2 border-[#1c3b6f]/70 dark:border-blue-900 font-black text-[11.5px] whitespace-nowrap font-sans select-none">
                <th className="p-3 text-center w-12 font-mono">#</th>
                <th className="p-3">{t('finance:blackOil.col.date')}</th>
                <th className="p-3 font-mono">{t('finance:ledger.previousBalance')}</th>
                <th className="p-3 font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                  {t('finance:etihadArchive.col.purchases')}
                </th>
                <th className="p-3 font-mono text-rose-700 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20">
                  {t('finance:tx.etihadExpense')}
                </th>
                <th className="p-3 font-mono text-rose-700 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20">
                  {t('finance:tx.saharaSales')}
                </th>
                <th className="p-3 font-mono text-rose-700 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20">
                  {t('finance:tx.cableSales')}
                </th>
                <th className="p-3 font-mono text-rose-700 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20">
                  {t('finance:tx.otherSales')}
                </th>
                <th className="p-3 font-mono text-teal-700 dark:text-teal-300 font-black bg-teal-50/50 dark:bg-teal-950/30">
                  {t('finance:ledger.currentBalance')}
                </th>
                {isEditMode && (
                  <th className="p-3 text-center animate-in fade-in zoom-in duration-200">
                    <div className="inline-flex items-center justify-center gap-1.5 min-h-[28px]">
                      <div className="w-14 flex items-center justify-center shrink-0 text-center">
                        <span>{t('finance:archive.actions')}</span>
                      </div>
                      <div className="w-px h-4 mx-0.5 opacity-0 shrink-0"></div>
                      <div className="w-6 flex items-center justify-center shrink-0">
                        <input
                          type="checkbox"
                          title={t('finance:etihadArchive.selectPage')}
                          className="w-3.5 h-3.5 rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedRows.has(r.id))}
                          onChange={(e) => {
                            const newSet = new Set(selectedRows);
                            if (e.target.checked) {
                              paginatedRecords.forEach(r => newSet.add(r.id));
                            } else {
                              paginatedRecords.forEach(r => newSet.delete(r.id));
                            }
                            setSelectedRows(newSet);
                          }}
                        />
                      </div>
                    </div>
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((r, idx) => {
                  const sequenceNumber = startIndex + idx + 1;
                  const isSelected = selectedRows.has(r.id);
                  const isHighlighted = activeRecordId === r.id;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setActiveRecordId(activeRecordId === r.id ? null : r.id)}
                      className={`group transition-colors whitespace-nowrap text-slate-800 dark:text-slate-200 cursor-pointer ${
                        isHighlighted
                          ? 'bg-teal-50/80 dark:bg-teal-950/40 ring-1 ring-teal-400 dark:ring-teal-600 relative z-10'
                          : 'hover:bg-teal-50/30 dark:hover:bg-teal-950/20'
                      }`}
                    >
                      <td className="p-3 text-center text-slate-400 font-sans text-[11px]">
                        {sequenceNumber}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white font-sans">
                        {r.date}
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                        {formatNumber(r.previousBalance)}
                      </td>
                      <td className="p-3 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10">
                        {formatNumber(r.purchases || 0)}
                      </td>
                      <td className="p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                        {formatNumber(r.etihadExpense || 0)}
                      </td>
                      <td className="p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                        {formatNumber(r.saharaSales || 0)}
                      </td>
                      <td className="p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                        {formatNumber(r.cablesSales || 0)}
                      </td>
                      <td className="p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                        {formatNumber(r.otherSales || 0)}
                      </td>
                      <td className="p-3 font-black text-teal-700 dark:text-teal-300 text-sm bg-teal-50/40 dark:bg-teal-950/20">
                        {formatNumber(r.currentBalance)}
                      </td>
                      {isEditMode && (
                        <td className="p-3 text-center animate-in fade-in duration-200">
                          <div className="inline-flex items-center justify-center gap-1.5 font-sans min-h-[28px]">
                            <div className="w-14 flex items-center justify-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(r);
                                }}
                                title={t('common:actions.edit')}
                                className="p-1 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(r.id);
                                }}
                                title={t('common:actions.delete')}
                                className="p-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0"></div>

                            <div className="w-6 flex items-center justify-center shrink-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newSet = new Set(selectedRows);
                                  if (e.target.checked) newSet.add(r.id);
                                  else newSet.delete(r.id);
                                  setSelectedRows(newSet);
                                }}
                                className="w-3.5 h-3.5 rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                              />
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isEditMode ? 10 : 9} className="p-12 text-center text-slate-400 font-sans">
                    <div className="flex flex-col items-center justify-center space-y-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Archive className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {t('finance:etihadArchive.empty')}
                      </p>
                      <button
                        type="button"
                        onClick={onAddNew}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('finance:etihadArchive.add')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================================= */}
        {/* 4. SMART PAGINATION FOOTER (10 rows per page)             */}
        {/* ========================================================= */}
        <div className="p-4 sm:p-5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Summary Indicator */}
          <div className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <span>
              <Trans
                t={t}
                i18nKey="common:pagination.showing"
                values={{ from: filteredRecords.length > 0 ? startIndex + 1 : 0, to: endIndex, total: filteredRecords.length }}
                components={{ 1: <strong className="font-bold text-slate-900 dark:text-white font-mono" />, 2: <strong className="font-bold text-teal-700 dark:text-teal-400 font-mono" /> }}
              />
            </span>
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-0 rotate-180" />
              <span>{t('common:pagination.prev')}</span>
            </button>

            {/* Page number indicators */}
            <div className="flex items-center gap-1 mx-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Keep first, last, and pages around current
                  if (totalPages <= 5) return true;
                  if (page === 1 || page === totalPages) return true;
                  return Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && page - array[index - 1] > 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && (
                        <span className="px-1 text-slate-400 font-mono">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-xl font-bold font-mono text-xs transition-all cursor-pointer ${
                          currentPage === page
                            ? 'bg-teal-600 text-white shadow-xs font-black'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>{t('common:pagination.next')}</span>
              <ChevronLeft className="w-4 h-4 rtl:rotate-0 rotate-180" />
            </button>
          </div>
        </div>

      </div>

      </div>

      {/* Interactive Print & PDF Modal */}
      <EtihadPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        records={filteredRecords}
        filterDateLabel={filterDateLabelText}
      />
    </>
  );
};
