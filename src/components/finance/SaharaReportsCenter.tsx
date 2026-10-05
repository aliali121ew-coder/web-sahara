import React from 'react';
import { useSessionState } from '../../lib/useSessionState';
import { Wallet, Truck, Database, Droplets, Sprout, Fuel, Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InboundDeliveries } from '../deliveries/InboundDeliveries';
import { SaharaBalanceArchive } from './SaharaBalanceArchive';
import { SaharaPetrolArchive } from './SaharaPetrolArchive';
import { EtihadTanksReport } from './EtihadTanksReport';
import { BlackOilDailyLedger } from './BlackOilDailyLedger';

type ReportCategoryKey = 'balance' | 'inbound' | 'tanks' | 'black-oil' | 'reserves' | 'petrol';

/**
 * مركز تقارير الصحاري (بنفس تصميم تقارير الاتحاد):
 * - في الأعلى: كروت صغيرة منزلقة للتنقل بين الفئات
 * - في الأسفل: كارت كبير يعرض الفئة المختارة
 */
export const SaharaReportsCenter: React.FC = () => {
  const { t } = useTranslation(['finance', 'common']);
  const [active, setActive] = useSessionState<ReportCategoryKey>('sahara_reports_tab', 'balance');

  const categories: { key: ReportCategoryKey; title: string; icon: React.ElementType; accent: string }[] = [
    { key: 'balance', title: t('finance:reports.balance'), icon: Wallet, accent: 'from-teal-600 to-emerald-600' },
    { key: 'inbound', title: t('finance:reports.inbound'), icon: Truck, accent: 'from-sky-500 to-blue-600' },
    { key: 'tanks', title: t('finance:reports.tanks'), icon: Database, accent: 'from-indigo-700 to-slate-900' },
    { key: 'black-oil', title: t('finance:reports.blackOil'), icon: Droplets, accent: 'from-zinc-700 to-neutral-900' },
    { key: 'reserves', title: t('finance:reports.farms'), icon: Sprout, accent: 'from-amber-500 to-orange-600' },
    { key: 'petrol', title: t('finance:reports.petrol'), icon: Fuel, accent: 'from-emerald-500 to-green-700' }
  ];

  const activeCategory = categories.find(c => c.key === active) ?? categories[0];

  return (
    <div className="space-y-3">
      {/* 1. شريط الكروت الصغيرة المنزلقة */}
      <div className="!mt-2 flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:thin]">
        {categories.map(c => {
          const Icon = c.icon;
          const isActive = c.key === activeCategory.key;
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
      <div key={activeCategory.key} className="animate-in fade-in duration-200">
        {activeCategory.key === 'balance' ? (
          <SaharaBalanceArchive />
        ) : activeCategory.key === 'tanks' ? (
          <EtihadTanksReport company="sahara" />
        ) : activeCategory.key === 'black-oil' ? (
          <BlackOilDailyLedger variant="archive" company="sahara" />
        ) : activeCategory.key === 'petrol' ? (
          <SaharaPetrolArchive />
        ) : activeCategory.key === 'inbound' ? (
          <InboundDeliveries variant="archive" scope="sahara" />
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-soft-card min-h-[360px] flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <Hourglass className="w-6 h-6" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white">{activeCategory.title}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{t('finance:reports.comingSoon')}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SaharaReportsCenter;
