import React, { useRef } from 'react';
import {
  PlusCircle,
  Edit,
  Download,
  DatabaseBackup,
  Printer,
  UploadCloud
} from 'lucide-react';
import { EtihadBalanceRecord, etihadSalesOf } from '../../types/finance';
import { useTranslation } from 'react-i18next';

interface EtihadQuickActionsProps {
  onAddNew: () => void;
  onEditLatest: () => void;
  records: EtihadBalanceRecord[];
  onImportBackup: (imported: EtihadBalanceRecord[]) => void;
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
  onOpenPrintModal?: () => void;
}

export const EtihadQuickActions: React.FC<EtihadQuickActionsProps> = ({
  onAddNew,
  onEditLatest: _onEditLatest,
  records,
  onImportBackup,
  isEditMode,
  setIsEditMode,
  onOpenPrintModal
}) => {
  const { t } = useTranslation(['finance', 'common']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export to CSV / Excel-ready file
  const handleExportCSV = () => {
    if (records.length === 0) {
      alert(t('finance:quick.noData'));
      return;
    }

    const headers = [
      t('finance:blackOil.col.date'),
      t('finance:ledger.previousBalance'),
      t('finance:tx.purchases'),
      t('finance:tx.etihadExpense'),
      t('finance:tx.sales'),
      t('finance:quick.netCurrent'),
      t('finance:quick.currentPrice'),
      t('finance:quick.notes')
    ];

    const rows = records.map(r => [
      r.date,
      r.previousBalance,
      r.purchases,
      r.etihadExpense,
      etihadSalesOf(r),
      r.currentBalance,
      r.currentPrice,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${t('finance:quick.csvFile')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const backupData = {
      version: '1.0',
      company: 'شركة الاتحاد',
      timestamp: new Date().toISOString(),
      recordsCount: records.length,
      records: records
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${t('finance:quick.backupFile')}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Trigger File Input to Restore JSON Backup
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.records)) {
          onImportBackup(parsed.records);
          alert(t('finance:quick.restored', { count: parsed.records.length }));
        } else if (Array.isArray(parsed)) {
          onImportBackup(parsed);
          alert(t('finance:quick.restored', { count: parsed.length }));
        } else {
          alert(t('finance:quick.invalidBackup'));
        }
      } catch (err) {
        alert(t('finance:quick.readError'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrint = () => {
    if (onOpenPrintModal) {
      onOpenPrintModal();
    } else {
      window.print();
    }
  };

  return (
    <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 md:p-5 shadow-soft-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-3 sm:mb-3.5">
        <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span>{t('finance:quick.title')}</span>
        </h4>
        <span className="text-[11px] text-slate-400">
          {t('finance:quick.subtitle')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 w-full">
        
        {/* 1. إضافة بيانات جديدة */}
        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t('finance:quick.add')}</span>
        </button>

        {/* 2. تعديل */}
        <button
          type="button"
          onClick={() => setIsEditMode(!isEditMode)}
          className={`flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer ${
            isEditMode 
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/20' 
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-600/20'
          }`}
        >
          <Edit className="w-4 h-4" />
          <span>{isEditMode ? t('finance:quick.cancelEdit') : t('finance:quick.edit')}</span>
        </button>

        {/* 3. تصدير */}
        <button
          type="button"
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t('finance:quick.csv')}</span>
        </button>

        {/* 4. طباعة الكشف وتصدير PDF */}
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-slate-700/20 active:scale-95 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>{t('finance:quick.pdf')}</span>
        </button>

        {/* 5. نسخ احتياطي */}
        <div className="relative flex gap-1.5">
          <button
            type="button"
            onClick={handleExportBackup}
            title={t('finance:quick.exportBackup')}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <DatabaseBackup className="w-4 h-4" />
            <span>{t('finance:quick.backup')}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={t('finance:quick.importBackup')}
            className="p-3 rounded-2xl bg-purple-100 dark:bg-purple-950/60 hover:bg-purple-200 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer shrink-0"
          >
            <UploadCloud className="w-4 h-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

      </div>
    </div>
  );
};
