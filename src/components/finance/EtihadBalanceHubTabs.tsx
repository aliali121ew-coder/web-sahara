import React from 'react';
import {
  Wallet,
  Database,
  Droplets,
  ShieldCheck,
  CheckCircle2,
  ChevronLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type EtihadSubtabKey = 'balance' | 'tanks' | 'black-oil' | 'reserves' | 'archive' | 'reports';

interface EtihadBalanceHubTabsProps {
  activeSubtab: EtihadSubtabKey;
  onSelectSubtab: (subtab: EtihadSubtabKey) => void;
  balanceLiters?: number;
  tanksCapacity?: number;
  blackOilLiters?: number;
  reservesSitesCount?: number;
}

export const EtihadBalanceHubTabs: React.FC<EtihadBalanceHubTabsProps> = ({
  activeSubtab,
  onSelectSubtab,
  balanceLiters = 0,
  tanksCapacity = 0,
  blackOilLiters = 0,
  reservesSitesCount = 0
}) => {
  const { t } = useTranslation(['finance', 'common']);

  const tabsConfig = [
    {
      id: 'balance' as EtihadSubtabKey,
      title: t('finance:hub.companyBalance'),
      subtitle: t('finance:hub.tabs.balanceSub'),
      statValue: t('finance:hub.statMillionLiters', { value: (balanceLiters / 1000000).toFixed(2) }),
      badge: t('finance:hub.tabs.live'),
      icon: Wallet,
      colorTheme: 'teal',
      accentGradient: 'from-teal-600 to-emerald-600',
      glowColor: 'rgba(13, 148, 136, 0.25)',
      activeBorder: 'border-teal-500 dark:border-teal-400',
      iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
    },
    {
      id: 'tanks' as EtihadSubtabKey,
      title: t('finance:hub.etihadTanks'),
      subtitle: t('finance:hub.tabs.tanksSub'),
      statValue: t('finance:hub.statMillionCapacity', { value: (tanksCapacity / 1000000).toFixed(0) }),
      badge: t('finance:hub.tabs.fourTanks'),
      icon: Database,
      colorTheme: 'blue',
      accentGradient: 'from-blue-600 to-indigo-600',
      glowColor: 'rgba(37, 99, 235, 0.25)',
      activeBorder: 'border-blue-500 dark:border-blue-400',
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    },
    {
      id: 'black-oil' as EtihadSubtabKey,
      title: t('finance:hub.blackOil'),
      subtitle: t('finance:hub.tabs.blackOilSub'),
      statValue: t('finance:hub.statMillionLiters', { value: (blackOilLiters / 1000000).toFixed(1) }),
      badge: t('finance:hub.tabs.fillBadge'),
      icon: Droplets,
      colorTheme: 'purple',
      accentGradient: 'from-purple-600 to-indigo-700',
      glowColor: 'rgba(147, 51, 234, 0.25)',
      activeBorder: 'border-purple-500 dark:border-purple-400',
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
    },
    {
      id: 'reserves' as EtihadSubtabKey,
      title: t('finance:hub.reserves'),
      subtitle: t('finance:hub.tabs.reservesSub'),
      statValue: t('finance:hub.securedSites', { count: reservesSitesCount }),
      badge: t('finance:hub.tabs.safety45'),
      icon: ShieldCheck,
      colorTheme: 'amber',
      accentGradient: 'from-amber-500 to-orange-600',
      glowColor: 'rgba(245, 158, 11, 0.25)',
      activeBorder: 'border-amber-500 dark:border-amber-400',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    },
  ];

  return (
    <div className="space-y-2.5">
      {/* 4 Interactive Portal Hub Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {tabsConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubtab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectSubtab(tab.id)}
              className={`group relative text-right p-4 sm:p-5 rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between border ${
                isActive
                  ? `bg-white dark:bg-slate-900 ${tab.activeBorder} shadow-xl scale-[1.02] ring-2 ring-offset-2 ring-slate-100 dark:ring-slate-800`
                  : 'bg-white/80 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900 shadow-soft-card hover:shadow-soft-hover'
              }`}
              style={{
                boxShadow: isActive ? `0 12px 30px -10px ${tab.glowColor}` : undefined
              }}
            >
              {/* Active Indicator Top Accent Bar */}
              {isActive && (
                <div
                  className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${tab.accentGradient}`}
                />
              )}

              {/* Top Row: Icon + Badge */}
              <div className="flex items-start justify-between gap-2 w-full">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    isActive
                      ? `bg-gradient-to-tr ${tab.accentGradient} text-white shadow-md`
                      : tab.iconBg
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                    }`}
                  >
                    {tab.badge}
                  </span>

                  {isActive && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      {t('finance:hub.tabs.activeView')}
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Quick Statistics */}
              <div className="mt-4 space-y-1 w-full">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{tab.title}</span>
                  <ChevronLeft className={`w-4 h-4 transition-transform ${isActive ? '-translate-x-1 text-slate-900 dark:text-white' : 'text-slate-400 group-hover:-translate-x-0.5'}`} />
                </h3>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                  {tab.subtitle}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-slate-400 text-[11px]">{t('finance:hub.tabs.indicator')}:</span>
                  <span className={isActive ? 'text-slate-900 dark:text-white font-black' : 'text-slate-600 dark:text-slate-300'}>
                    {tab.statValue}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
