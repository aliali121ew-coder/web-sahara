import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  ArrowUpDown,
  Edit3,
  Trash2,
  Plus,
  Inbox
} from 'lucide-react';
import { EtihadBalanceRecord, DateFilterRange } from '../../types/finance';
import { formatNumber } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

interface EtihadBalanceTableProps {
  records: EtihadBalanceRecord[];
  filterRange: DateFilterRange;
  setFilterRange: (val: DateFilterRange) => void;
  appliedStartDate?: string;
  setAppliedStartDate: (val: string) => void;
  appliedEndDate?: string;
  setAppliedEndDate: (val: string) => void;
  onAddNew: () => void;
  onEdit: (record: EtihadBalanceRecord) => void;
  onDelete: (id: string) => void;
  onDeleteMany?: (ids: string[]) => void;
  activeRecordId?: string | null;
  onRowClick?: (id: string | null) => void;
  isEditMode: boolean;
  maxRows?: number;
}

export const EtihadBalanceTable: React.FC<EtihadBalanceTableProps> = ({
  records,
  filterRange,
  setFilterRange,
  setAppliedStartDate,
  setAppliedEndDate,
  onAddNew,
  onEdit,
  onDelete,
  onDeleteMany,
  activeRecordId,
  onRowClick,
  isEditMode,
  maxRows,
}) => {
  const { t } = useTranslation(['finance', 'common']);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  // Filter logic (Text search and sorting only. Date filtering happens in parent)
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        r.date.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        r.previousBalance.toString().includes(q) ||
        r.currentBalance.toString().includes(q)
      );
    }

    // Sort by date
    result.sort((a, b) => {
      return sortDirection === 'desc' 
        ? b.date.localeCompare(a.date) 
        : a.date.localeCompare(b.date);
    });

    return result;
  }, [records, searchQuery, sortDirection]);

  // Sliced records if maxRows limit is defined
  const displayedRecords = useMemo(() => {
    return maxRows ? filteredRecords.slice(0, maxRows) : filteredRecords;
  }, [filteredRecords, maxRows]);



  return (
    <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card overflow-hidden">
      
      {/* Table Header Controls */}
      <div className="p-3.5 sm:p-4 md:p-5 border-b border-slate-200/90 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-3.5 bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* Title & Subtitle */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {t('finance:table.title')}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('finance:table.subtitle')}
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          
          {/* Bulk Delete Button */}
          {selectedRows.size > 0 && onDeleteMany && (
            <button
              onClick={() => {
                if (window.confirm(t('finance:etihadArchive.confirmDeleteSelected', { count: selectedRows.size }))) {
                  onDeleteMany(Array.from(selectedRows));
                  setSelectedRows(new Set());
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl font-bold text-xs transition-colors shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('finance:table.deleteSelected')} ({selectedRows.size})</span>
            </button>
          )}

          {/* Quick Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('finance:table.search')}
              className="w-full sm:w-52 md:w-60 lg:w-64 text-xs py-1.5 pr-8 pl-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>

          {/* Date Range Selector Pills */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  filterRange === 'custom' || filterRange === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>{t('finance:blackOil.col.date')}</span>
              </button>

              {showDatePicker && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-3 z-50">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t('finance:etihadArchive.fromDate')}</label>
                      <input 
                        type="date" 
                        value={tempStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t('finance:etihadArchive.toDate')}</label>
                      <input 
                        type="date" 
                        value={tempEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        onClick={() => {
                          setTempStartDate('');
                          setTempEndDate('');
                          setAppliedStartDate('');
                          setAppliedEndDate('');
                          setFilterRange('all');
                          setShowDatePicker(false);
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                      >
                        {t('common:actions.cancel')}
                      </button>
                      <button 
                        onClick={() => {
                          setAppliedStartDate(tempStartDate);
                          setAppliedEndDate(tempEndDate);
                          setFilterRange('custom');
                          setShowDatePicker(false);
                        }}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                      >
                        {t('common:calendar.apply')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFilterRange('week')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterRange === 'week'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {t('common:print.rangeWeek')}
            </button>

            <button
              type="button"
              onClick={() => setFilterRange('today')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterRange === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {t('common:calendar.today')}
            </button>
          </div>

          {/* Sort Order Toggle */}
          <button
            type="button"
            onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
            title={t('finance:etihadArchive.sortByDate')}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Main Table Responsive Viewport */}
      <div className="overflow-x-auto w-full">
        <table className="w-full min-w-[850px] text-start text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 font-extrabold text-[11px] whitespace-nowrap">
              <th className="p-3 text-center w-10">#</th>
              <th className="p-3">{t('finance:blackOil.col.date')}</th>
              <th className="p-3 font-mono">{t('finance:ledger.previousBalance')}</th>
              <th className="p-3 font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                {t('finance:tx.purchases')}
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
                        title={t('finance:table.selectAll')}
                        className="w-3.5 h-3.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={displayedRecords.length > 0 && selectedRows.size === displayedRecords.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRows(new Set(displayedRecords.map(r => r.id)));
                          } else {
                            setSelectedRows(new Set());
                          }
                        }}
                      />
                    </div>
                  </div>
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
            {displayedRecords.length > 0 ? (
              displayedRecords.map((r, idx) => (
                <tr
                  key={r.id}
                  onClick={() => onRowClick && onRowClick(activeRecordId === r.id ? null : r.id)}
                  className={`group transition-colors whitespace-nowrap text-slate-800 dark:text-slate-200 cursor-pointer ${
                    activeRecordId === r.id 
                      ? 'bg-blue-50 dark:bg-blue-900/40 ring-1 ring-blue-400 dark:ring-blue-500 relative z-10' 
                      : 'hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
                  }`}
                >
                  <td className="p-3 text-center text-slate-400 font-sans text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="p-3 font-bold text-slate-900 dark:text-white font-sans">
                    {r.date}
                  </td>
                  <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                    {formatNumber(r.previousBalance)}
                  </td>
                  <td className="p-3 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10">
                    {formatNumber(r.purchases)}
                  </td>
                  <td className="p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                    {formatNumber(r.etihadExpense)}
                  </td>
                  <td className="p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                    {formatNumber(r.saharaSales)}
                  </td>
                  <td className="p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                    {formatNumber(r.cablesSales)}
                  </td>
                  <td className="p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                    {formatNumber(r.otherSales)}
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
                            className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
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
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0"></div>
                        <div className="w-6 flex items-center justify-center shrink-0">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedRows.has(r.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const newSet = new Set(selectedRows);
                              if (e.target.checked) newSet.add(r.id);
                              else newSet.delete(r.id);
                              setSelectedRows(newSet);
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isEditMode ? 10 : 9} className="p-10 text-center text-slate-400 font-sans">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      {t('finance:table.empty')}
                    </p>
                    <button
                      type="button"
                      onClick={onAddNew}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('finance:table.addNow')}</span>
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

        </table>
      </div>


    </div>
  );
};
