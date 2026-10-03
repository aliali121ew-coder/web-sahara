import React from 'react';
import { useSessionState } from '../../lib/useSessionState';
import { Wallet, Truck, Database, Droplets, ShieldCheck, Hourglass } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { EtihadBalanceRecord } from '../../types/finance';
import { EtihadArchiveView } from './EtihadArchiveView';
import { InboundDeliveries } from '../deliveries/InboundDeliveries';
import { EtihadTanksReport } from './EtihadTanksReport';
import { BlackOilDailyLedger } from './BlackOilDailyLedger';

type ReportCategoryKey = 'balance' | 'inbound' | 'tanks' | 'black-oil' | 'reserves';

interface EtihadReportsCenterProps {
  records: EtihadBalanceRecord[];
  onAddNew: () => void;
  onEdit: (record: EtihadBalanceRecord) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onImportBackup?: (imported: EtihadBalanceRecord[]) => void;
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
}

/**
 * مركز تقارير الاتحاد:
 * - في الأعلى: 5 كروت صغيرة منزلقة للتنقل بين الفئات
 * - في الأسفل: كارت كبير يعرض الفئة المختارة (لكل فئة نمطها الخاص)
 */
export const EtihadReportsCenter: React.FC<EtihadReportsCenterProps> = ({
  records, onAddNew, onEdit, onDelete, onDeleteMany, onImportBackup, isEditMode, setIsEditMode
}) => {
  const { tr } = useLanguage();
  const [active, setActive] = useSessionState<ReportCategoryKey>('etihad_reports_tab', 'balance');

  const categories: { key: ReportCategoryKey; title: string; icon: React.ElementType; accent: string }[] = [
    { key: 'balance', title: tr('كشف رصيد الشركة'), icon: Wallet, accent: 'from-teal-600 to-emerald-600' },
    { key: 'inbound', title: tr('كشف الوارد'), icon: Truck, accent: 'from-sky-500 to-blue-600' },
    { key: 'tanks', title: tr('جرد الخزانات'), icon: Database, accent: 'from-indigo-700 to-slate-900' },
    { key: 'black-oil', title: tr('تقرير النفط الأسود'), icon: Droplets, accent: 'from-zinc-700 to-neutral-900' },
    { key: 'reserves', title: tr('تقرير رصيد الاحتياطي'), icon: ShieldCheck, accent: 'from-amber-500 to-orange-600' }
  ];

  const activeCategory = categories.find(c => c.key === active)!;

  return (
    <div className="space-y-3">
      {/* 1. شريط الكروت الصغيرة المنزلقة */}
      <div className="!mt-2 flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:thin]">
        {categories.map(c => {
          const Icon = c.icon;
          const isActive = c.key === active;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActive(c.key)}
              className={`snap-start shrink-0 min-w-[170px] flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border text-start transition-all cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-white dark:bg-slate-900 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                  : 'bg-white/70 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.accent} text-white flex items-center justify-center shadow-sm shrink-0`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className={`text-[13px] font-black truncate ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                {c.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. الكارت الكبير لعرض الفئة المختارة */}
      <div key={active} className="animate-in fade-in duration-200">
        {active === 'balance' ? (
          <EtihadArchiveView
            embedded
            records={records}
            onBack={() => {}}
            onAddNew={onAddNew}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteMany={onDeleteMany}
            onImportBackup={onImportBackup}
            isEditMode={isEditMode}
            setIsEditMode={setIsEditMode}
          />
        ) : active === 'inbound' ? (
          <InboundDeliveries variant="archive" scope="etihad" />
        ) : active === 'tanks' ? (
          <EtihadTanksReport />
        ) : active === 'black-oil' ? (
          <BlackOilDailyLedger variant="archive" />
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-soft-card min-h-[360px] flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <Hourglass className="w-6 h-6" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white">{activeCategory.title}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{tr('سيتم تصميم هذا التقرير في المرحلة التالية')}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EtihadReportsCenter;
