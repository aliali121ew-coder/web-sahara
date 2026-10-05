import React, { useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  Building,
  AlertCircle,
  Clock,
  Search,
  CheckCircle2
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useTranslation, Trans } from 'react-i18next';
import { siteName } from '../../i18n/enums';

export interface ReserveSite {
  id: string;
  name: string;
  location: string;
  fuelType: string;
  currentReserveLiters: number;
  maxCapacityLiters: number;
  minimumThresholdLiters: number;
  managerName: string;
  managerPhone: string;
  coverageDays: number;
  status: 'optimal' | 'warning' | 'critical';
  lastUpdated: string;
}

export const INITIAL_RESERVE_SITES: ReserveSite[] = [
  {
    id: 'site-01',
    name: 'موقع مصفى كربلاء الدولي (موقع الاحتياط الرئيسي)',
    location: 'كربلاء - طريق عين التمر',
    fuelType: 'كاز استراتيجي',
    currentReserveLiters: 2800000,
    maxCapacityLiters: 3500000,
    minimumThresholdLiters: 1000000,
    managerName: 'م. علي الحسيني',
    managerPhone: '0780 111 2233',
    coverageDays: 35,
    status: 'optimal',
    lastUpdated: 'اليوم 09:15 ص'
  },
  {
    id: 'site-02',
    name: 'موقع مجمع معامل الاتحاد الصناعية',
    location: 'بابل / المدحتية - المجمع الصناعي',
    fuelType: 'كاز + زيوت',
    currentReserveLiters: 2100000,
    maxCapacityLiters: 2500000,
    minimumThresholdLiters: 800000,
    managerName: 'م. أحمد السعدي',
    managerPhone: '0770 222 3344',
    coverageDays: 28,
    status: 'optimal',
    lastUpdated: 'اليوم 08:30 ص'
  },
  {
    id: 'site-03',
    name: 'موقع الخزانات المركزية الجنوبية',
    location: 'النجف الأشرف - مفرق الفرات الأوسط',
    fuelType: 'كاز تشغيلي',
    currentReserveLiters: 1250000,
    maxCapacityLiters: 1500000,
    minimumThresholdLiters: 500000,
    managerName: 'م. كرار الموسوي',
    managerPhone: '0781 444 5566',
    coverageDays: 21,
    status: 'optimal',
    lastUpdated: 'اليوم 10:00 ص'
  },
  {
    id: 'site-04',
    name: 'موقع محطات المولدات والمشاريع الميدانية',
    location: 'المزارع والمشاريع الخدمية الخارجية',
    fuelType: 'كاز طوارئ',
    currentReserveLiters: 700000,
    maxCapacityLiters: 1000000,
    minimumThresholdLiters: 300000,
    managerName: 'م. حسين العامري',
    managerPhone: '0771 555 6677',
    coverageDays: 15,
    status: 'optimal',
    lastUpdated: 'اليوم 07:45 ص'
  }
];

export const EtihadMultiSiteReservesView: React.FC = () => {
  const { t } = useTranslation(['finance', 'common']);
  const [sites] = useState<ReserveSite[]>(INITIAL_RESERVE_SITES);
  const [searchQuery, setSearchQuery] = useState('');

  const totalReserve = sites.reduce((acc, s) => acc + s.currentReserveLiters, 0);
  const totalCapacity = sites.reduce((acc, s) => acc + s.maxCapacityLiters, 0);
  const totalThreshold = sites.reduce((acc, s) => acc + s.minimumThresholdLiters, 0);
  const overallSafetyPercent = Math.round((totalReserve / totalCapacity) * 100);

  const filteredSites = sites.filter(s =>
    s.name.includes(searchQuery) ||
    s.location.includes(searchQuery) ||
    s.managerName.includes(searchQuery)
  );

  return (
    <div className="space-y-2.5 sm:space-y-3 animate-in fade-in duration-200">
      
      {/* 1. Global Multi-site Reserve KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        
        {/* Card 1: Total Distributed Reserve */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 text-white shadow-soft-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-amber-100">{t('finance:reservesView.total')}</span>
            <div className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
              {formatNumber(totalReserve)}
            </span>
            <span className="text-xs font-bold text-amber-100">{t('common:units.liter')}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-amber-100">
            <span>{t('finance:reservesView.distributed', { count: 4 })}</span>
            <span className="font-mono font-black">{t('finance:reservesView.pctCapacity', { pct: overallSafetyPercent })}</span>
          </div>
        </div>

        {/* Card 2: Strategic Safety Buffer */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('finance:reservesView.minSafety')}</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {formatNumber(totalThreshold)}
            </span>
            <span className="text-xs font-bold text-slate-400">{t('common:units.liter')}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t('finance:reservesView.above')}:
            </span>
            <span className="font-mono">+{formatNumber(totalReserve - totalThreshold)} {t('common:units.liter')}</span>
          </div>
        </div>

        {/* Card 3: Combined Capacity */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('finance:reservesView.capacity')}</span>
            <Building className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {formatNumber(totalCapacity)}
            </span>
            <span className="text-xs font-bold text-slate-400">{t('common:units.liter')}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full" style={{ width: `${overallSafetyPercent}%` }} />
          </div>
          <span className="text-[10.5px] text-slate-400 mt-1.5 block">
            {t('finance:reservesView.vacant')}: {formatNumber(totalCapacity - totalReserve)} {t('common:units.liter')}
          </span>
        </div>

        {/* Card 4: Multi-Site Security Days */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('finance:reservesView.emergencyDays')}</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <Trans t={t} i18nKey="finance:reservesView.safetyDays" count={45} components={{ 1: <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400" />, 2: <span className="text-xs font-bold text-slate-400" /> }} />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{t('finance:reservesView.continuity')}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{t('finance:reservesView.covered100')}</span>
          </div>
        </div>

      </div>

      {/* 2. Filter & Search Bar */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-soft-card">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('finance:reservesView.search')}
              className="w-60 text-xs py-1.5 pr-8 pl-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <span className="text-xs text-slate-400 font-bold">
          {t('finance:reservesView.count')}: {filteredSites.length}
        </span>
      </div>

      {/* 3. Site by Site Detailed Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
        {filteredSites.map((site) => {
          const fillRatio = Math.round((site.currentReserveLiters / site.maxCapacityLiters) * 100);

          return (
            <div
              key={site.id}
              className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-3"
            >
              {/* Top Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {siteName(site.name)}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{site.location}</span>
                      <span>•</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{site.fuelType}</span>
                    </div>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-200/60 dark:border-emerald-800/60">
                  {t('finance:reservesView.secured')}
                </span>
              </div>

              {/* Reserve Volume & Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t('finance:reservesView.available')}</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {formatNumber(site.currentReserveLiters)} <span className="text-xs font-normal text-slate-400">/ {formatNumber(site.maxCapacityLiters)} {t('common:units.liter')}</span>
                    </span>
                  </div>
                  <div className="text-end">
                    <span className="text-slate-400 text-[11px] block">{t('finance:reservesView.protection')}</span>
                    <span className="text-base font-black text-amber-600 dark:text-amber-400">
                      {fillRatio}%
                    </span>
                  </div>
                </div>

                <div className="relative w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                  <div
                    className="h-full rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 transition-all duration-700"
                    style={{ width: `${fillRatio}%` }}
                  />
                </div>
              </div>

              {/* Site Details: Minimum Threshold, Manager, Coverage */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block">{t('finance:reservesView.minLimit')}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatNumber(site.minimumThresholdLiters)} {t('common:units.liter')}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block">{t('finance:reservesView.emergency')}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {t('common:units.days', { count: site.coverageDays })}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block">{t('finance:reservesView.manager')}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {site.managerName}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
