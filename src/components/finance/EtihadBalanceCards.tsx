import React from 'react';
import {
  History,
  ShieldCheck,
  ArrowDownToLine,
  Flame,
  BadgeDollarSign,
  Calculator,
  Coins,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CalendarDays
} from 'lucide-react';
import { EtihadSummaryMetrics } from '../../types/finance';
import { formatNumber } from '../../lib/utils';
import { useTranslation, Trans } from 'react-i18next';

interface EtihadBalanceCardsProps {
  metrics: EtihadSummaryMetrics;
  /** أيام التغطية المحسوبة من متوسط الاستهلاك الفعلي (0 = لا تقدير) */
  coverageDays?: number;
  /** السعة الفعلية لخزانات الكاز من منظومة الخزانات (مرجع نسبة الرصيد) */
  capacityLiters?: number;
}

export const EtihadBalanceCards: React.FC<EtihadBalanceCardsProps> = ({
  metrics,
  coverageDays = 0,
  capacityLiters = 0
}) => {
  const { t } = useTranslation(['finance', 'common']);

  const getDynamicTextSize = (num: number) => {
    const strLen = formatNumber(num).length;
    if (strLen >= 14) return 'text-base sm:text-lg xl:text-xl';
    if (strLen >= 11) return 'text-lg sm:text-xl xl:text-2xl';
    if (strLen >= 9) return 'text-xl sm:text-2xl xl:text-[26px]';
    return 'text-2xl sm:text-3xl xl:text-3xl';
  };

  const totalCost = (metrics.todayInbound > 0 ? metrics.todayInbound : metrics.totalPurchases) * (metrics.averagePrice || 0);

  const currentDate = new Date();
  const securesUntilDate = new Date(currentDate.getTime() + (coverageDays * 24 * 60 * 60 * 1000));
  const y = securesUntilDate.getFullYear();
  const m = String(securesUntilDate.getMonth() + 1).padStart(2, '0');
  const d = String(securesUntilDate.getDate()).padStart(2, '0');
  const formattedSecuresUntil = coverageDays > 0 ? `${y}/${m}/${d}` : '—';

  const getBalanceStatus = (current: number) => {
    // بلا سعة معرّفة لا يُحكم على الرصيد
    if (capacityLiters <= 0) return { label: '—', color: 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/40' };
    const percentage = (current / capacityLiters) * 100;

    if (percentage >= 75) {
      return { label: t('finance:cards.excellent'), color: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 border-teal-200/50 dark:border-teal-800/40' };
    } else if (percentage >= 50) {
      return { label: t('finance:cards.good'), color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border-blue-200/50 dark:border-blue-800/40' };
    } else if (percentage >= 25) {
      return { label: t('finance:cards.average'), color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200/50 dark:border-amber-800/40' };
    } else {
      return { label: t('finance:cards.critical'), color: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200/50 dark:border-rose-800/40' };
    }
  };

  const currentStatus = getBalanceStatus(metrics.currentBalance);

  // Calculate percentages
  const inboundPercentage = capacityLiters > 0 ? ((metrics.todayInbound / capacityLiters) * 100).toFixed(2) : '0.00';
  const consumptionPercentage = metrics.currentBalance > 0
    ? ((metrics.todayConsumption / (metrics.currentBalance + metrics.todayConsumption)) * 100).toFixed(2)
    : '0.00';
  const salesPercentage = metrics.currentBalance > 0
    ? ((metrics.todaySales / (metrics.currentBalance + metrics.todaySales)) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 lg:gap-4 w-full">

      {/* 1. الرصيد السابق */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all duration-300 group">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              {t('finance:ledger.previousBalance')}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`${getDynamicTextSize(metrics.previousBalance)} font-black font-mono tracking-tight text-slate-900 dark:text-white`}>
                {formatNumber(metrics.previousBalance)}
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{t('common:units.liter')}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-xs">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            {t('finance:cards.lockedOpening')}
          </span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{t('finance:cards.approvedRecord')}</span>
        </div>
      </div>

      {/* 3. الوارد (اليوم) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all duration-300 group">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('finance:ledger.inbound')}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`${getDynamicTextSize(metrics.todayInbound)} font-black font-mono tracking-tight text-slate-900 dark:text-white`}>
                {formatNumber(metrics.todayInbound)}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t('common:units.liter')}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-xs">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{t('finance:cards.addedToCurrent')}</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1" dir="ltr">
            <TrendingUp className="w-3 h-3" />
            {inboundPercentage}%
          </span>
        </div>
      </div>

      {/* 4. الاستهلاك (اليوم) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-rose-900/40 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all duration-300 group">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('finance:saharaPetrol.consumption')}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`${getDynamicTextSize(metrics.todayConsumption)} font-black font-mono tracking-tight text-slate-900 dark:text-white`}>
                {formatNumber(metrics.todayConsumption)}
              </span>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{t('common:units.liter')}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20 shadow-xs">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{t('finance:cards.fromAvailable')}</span>
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1" dir="ltr">
            <TrendingDown className="w-3 h-3" />
            {consumptionPercentage}%
          </span>
        </div>
      </div>

      {/* 5. مبيعات (اليوم) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200/60 dark:border-indigo-900/40 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all duration-300 group">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('finance:cards.sales')}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`${getDynamicTextSize(metrics.todaySales)} font-black font-mono tracking-tight text-slate-900 dark:text-white`}>
                {formatNumber(metrics.todaySales)}
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{t('common:units.liter')}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-xs">
            <BadgeDollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{t('finance:cards.externalSales')}</span>
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1" dir="ltr">
            <TrendingDown className="w-3 h-3" />
            {salesPercentage}%
          </span>
        </div>
      </div>

      {/* 6. الرصيد الحالي المتوفر (استبدال بطاقة الزيوت بالرصيد الحالي) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-blue-50/20 to-teal-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/20 border border-teal-300/70 dark:border-teal-700/60 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all duration-300 group">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all pointer-events-none" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('finance:ledger.currentBalance')}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`${getDynamicTextSize(metrics.currentBalance)} font-black font-mono tracking-tight text-teal-600 dark:text-teal-400 truncate`}>
                {formatNumber(metrics.currentBalance)}
              </span>
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{t('common:units.liter')}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-teal-100/60 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-500" />
            {t('finance:cards.status')}:
          </span>
          <span className={`font-mono font-black px-2 py-0.5 rounded-lg border ${currentStatus.color}`}>
            {currentStatus.label}
          </span>
        </div>
      </div>

      {/* 7. التكلفة (استبدال معدل التكلفة بالتكلفة = الوارد * متوسط السعر) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-emerald-300/70 dark:border-emerald-700/60 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all duration-300 group">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('finance:cards.cost')}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`${getDynamicTextSize(totalCost)} font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 truncate`}>
                {formatNumber(totalCost)}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t('common:units.iqd')}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
            <Calculator className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-emerald-100/60 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            {t('finance:cards.costFormula')}:
          </span>
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
            {formatNumber(metrics.averagePrice)} {t('finance:tanksView.iqdPerLiter')}
          </span>
        </div>
      </div>

      {/* 8. معدل السعر */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-cyan-200/60 dark:border-cyan-900/40 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all duration-300 group">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              {t('finance:cards.avgPrice')}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-cyan-600 dark:text-cyan-400">
                {formatNumber(metrics.averagePrice)}
              </span>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{t('common:units.iqd')}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20 shadow-xs">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
            {t('finance:cards.supplyPrice')}
          </span>
          <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{t('finance:cards.officiallyApproved')}</span>
        </div>
      </div>

      {/* 2. يؤمن لغاية (بدل إجمالي المشتريات) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-sky-200/60 dark:border-sky-900/40 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all duration-300 group">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all pointer-events-none" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('finance:saharaPetrol.coversUntil')}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <Trans t={t} i18nKey="finance:tanksReport.coverageDays" count={coverageDays} components={{ 1: <span className="text-xl sm:text-2xl xl:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white" />, 2: <span className="text-xs font-bold text-sky-600 dark:text-sky-400" /> }} />
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20 shadow-xs">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{t('finance:saharaPetrol.runOutDate')}:</span>
          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{formattedSecuresUntil}</span>
        </div>
      </div>

    </div>
  );
};
