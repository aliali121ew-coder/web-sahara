import React from 'react';
import { SectionHeader } from './SectionHeader';
import {
  Building2,
  Calendar,
  Boxes,
  ArrowDownLeft,
  Activity,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { formatNumber } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { enumText } from '../../i18n/enums';
import { EtihadBalanceRecord } from '../../types/finance';
import { useFuelStore } from '../../context/FuelDataContext';
import { InboundDelivery } from '../../types';
import { computeInboundPriceStats, computeDailyBuys } from '../../lib/inboundPrice';
import { useCentralTanks, resolveEtihadExtractionTank, syncEtihadExtractionTank } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';

const WEEK_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

/**
 * بيانات الأسبوع (السبت ← الجمعة) للأسبوع الذي فيه آخر يوم مسجّل في رصيد شركة الاتحاد:
 * الوارد = المشتريات، والاستهلاك = مصروف الاتحاد + كل المبيعات، واليوم غير المسجّل = 0.
 */
const buildWeeklyFlow = (records: EtihadBalanceRecord[], anchor?: string) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = anchor ? new Date(anchor.replace(/\//g, '-') + 'T12:00:00') : new Date();
  const saturday = new Date(base);
  saturday.setDate(base.getDate() - ((base.getDay() + 1) % 7));
  return WEEK_DAYS.map((day, i) => {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + i);
    const date = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    const dayRecords = records.filter(r => r.date === date);
    return {
      day,
      date,
      inbound: dayRecords.reduce((a, r) => a + (r.purchases || 0), 0),
      consumption: dayRecords.reduce((a, r) => a + (r.etihadExpense || 0) + recordSales(r), 0),
    };
  });
};

/** سجلات صفحة "رصيد شركة الاتحاد" مرتبة من الأحدث للأقدم */
const loadEtihadRecords = (): EtihadBalanceRecord[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem('sahara_etihad_balance_records_v2') || '[]');
    return Array.isArray(parsed) ? [...parsed].sort((a: EtihadBalanceRecord, b: EtihadBalanceRecord) => b.date.localeCompare(a.date)) : [];
  } catch {
    return [];
  }
};

const recordSales = (r?: EtihadBalanceRecord) =>
  r ? (r.saharaSales || 0) + (r.cablesSales || 0) + (r.specialSales || 0) + (r.otherSales || 0) : 0;

export const EtihadGasSection: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  // آخر يوم مسجّل في  رصيد شركة الاتحاد واليوم الذي قبله
  const [records] = React.useState(loadEtihadRecords);
  const latest = records[0];
  const prev = records[1];
  const etihadTotalBalance = latest?.currentBalance ?? 0;
  // متوسط السعر ونسبة تغيره وشراء اليوم: من وارد الاتحاد (نفس معادلات قسم الصحاري)
  const { etihadDeliveries } = useFuelStore();
  // إن لم يكن في صفحة وارد الاتحاد كميات وتكاليف، تُحوَّل سجلات رصيد الشركة إلى وارد يومي:
  // الكمية = المشتريات، والتكلفة = المشتريات × سعر اللتر الحالي لذلك اليوم
  const priceSource = React.useMemo(() => {
    const hasInbound = etihadDeliveries.some(d => (d.receivedQuantity ?? d.volumeLiters ?? 0) > 0);
    if (hasInbound) return etihadDeliveries;
    return records
      .filter(r => (r.purchases || 0) > 0 && (r.currentPrice || 0) > 0)
      .map(r => ({
        id: `etihad-rec-${r.id}`,
        date: r.date,
        receiptUnloadDate: r.date,
        company: 'شركة الاتحاد',
        receivedQuantity: r.purchases,
        productPrice: r.currentPrice,
        productCost: r.purchases * r.currentPrice,
      }) as InboundDelivery);
  }, [etihadDeliveries, records]);
  const { avgPrice, change: priceChange } = React.useMemo(() => computeInboundPriceStats(priceSource), [priceSource]);
  const buys = React.useMemo(() => computeDailyBuys(priceSource), [priceSource]);
  const totalInbound = latest?.purchases ?? 0;
  const totalConsumption = latest?.etihadExpense ?? 0;
  const totalSales = recordSales(latest);
  // الاستهلاك + المبيعات = إجمالي الصرف لليوم، والفرق عن اليوم الذي قبله
  const totalOutflow = totalConsumption + totalSales;
  const prevOutflow = prev ? (prev.etihadExpense || 0) + recordSales(prev) : null;
  const outflowDiff = prevOutflow === null ? null : totalOutflow - prevOutflow;
  const weeklyFlow = React.useMemo(() => buildWeeklyFlow(records, latest?.date), [records, latest?.date]);
  const inboundWeekly = weeklyFlow.map(w => ({ day: w.day, date: w.date, val: w.inbound }));
  const consumptionWeekly = weeklyFlow.map(w => ({ day: w.day, date: w.date, val: w.consumption }));

  // السعة = سعة خزان "موقع الاستخلاص" في منظومة الخزانات (تتحدث فورًا عند تغييرها)
  const [centralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const extractionTank = React.useMemo(() => resolveEtihadExtractionTank(centralTanks), [centralTanks]);
  // الخزان يُملأ تلقائيًا من الرصيد الحالي لشركة الاتحاد
  React.useEffect(() => {
    if (latest) syncEtihadExtractionTank(latest.currentBalance);
  }, [latest]);
  const totalCapacity = extractionTank?.capacityLiters ?? 0;
  const fillPct = totalCapacity ? Math.min(100, (etihadTotalBalance / totalCapacity) * 100) : 0;
  const remainingCapacity = Math.max(0, totalCapacity - etihadTotalBalance);
  const fillLabel = `${fillPct.toFixed(1)}%`;
  const remainLabel = `${(100 - fillPct).toFixed(1)}%`;
  // يؤمن لغاية = الرصيد الحالي ÷ الاستهلاك الفعلي (المصروف + المبيعات) لآخر يوم، وتاريخ النفاد = تاريخ آخر يوم + عدد الأيام
  const coverageDays = totalOutflow > 0 ? Math.floor(etihadTotalBalance / totalOutflow) : null;
  const coverageDate = (() => {
    if (coverageDays === null || !latest) return '—';
    const d = new Date(latest.date.replace(/\//g, '-') + 'T12:00:00');
    d.setDate(d.getDate() + coverageDays);
    return d.toISOString().slice(0, 10).replace(/-/g, '/');
  })();

  return (
    <div className="space-y-3.5">
      
      {/* Section Header */}
      <SectionHeader title={t('dashboard:etihad.title')} icon={
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/20">
          <Building2 className="w-4 h-4 text-teal-100" />
        </div>
      } />

      {/* Main Strategic Card (7 Cols on xl) + Side Telemetry Charts (5 Cols on xl) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
        
        {/* Main Strategic Card (Mobile/Tablet 12 Cols, Desktop 7 Cols) */}
        <div className="col-span-1 md:col-span-12 xl:col-span-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-4 h-full overflow-hidden">
          
          {/* Header Row: Title & Average Price Pill */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <span>
                  {t('dashboard:etihad.totalBalance')}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-3xl sm:text-4xl lg:text-[36px] font-black font-mono tracking-tight text-slate-900 dark:text-white">
                  {formatNumber(etihadTotalBalance)}
                </span>
                <span className="text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400">{t('common:units.liter')}</span>
              </div>
            </div>

            {/* Average Price Pill with Modern Teal Glass & Glow */}
            {/* كارت السعر (نفس تصميم الصحاري): الرقم في المنتصف، وشريط سفلي ملوّن لنسبة التغير بعد آخر وارد */}
            <div className="min-w-[128px] rounded-2xl overflow-hidden bg-gradient-to-br from-white to-teal-50/40 dark:from-slate-800/90 dark:to-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shrink-0 shadow-xs">
              <div className="px-3 pt-2.5 pb-2 text-center">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 block">{t('dashboard:price.average')}</span>
                <div className="mt-0.5 flex items-baseline justify-center gap-1">
                  <span className="text-lg sm:text-2xl font-black text-teal-700 dark:text-teal-300 font-mono tracking-tight leading-none tabular-nums">
                    {avgPrice > 0 ? avgPrice.toFixed(1) : '—'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{t('common:units.iqd')}</span>
                </div>
              </div>
              {priceChange ? (() => {
                const up = priceChange.pct >= 0.005;
                const down = priceChange.pct <= -0.005;
                const tone = up
                  ? 'bg-rose-50 border-rose-200/80 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400'
                  : down
                  ? 'bg-emerald-50 border-emerald-200/80 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700';
                return (
                  <div
                    className={`px-3 py-1.5 border-t flex items-center justify-center gap-1.5 ${tone}`}
                    title={`${t('dashboard:price.lastInboundAvg')}: ${priceChange.lastPrice.toFixed(1)} ${t('common:units.iqd')} · ${priceChange.lastDay}`}
                  >
                    {down && <TrendingDown className="w-3.5 h-3.5 shrink-0" />}
                    {up && <TrendingUp className="w-3.5 h-3.5 shrink-0" />}
                    <span dir="ltr" className="text-[11px] font-black font-mono tabular-nums leading-none">
                      {up ? '+' : down ? '−' : ''}{Math.abs(priceChange.pct).toFixed(2)}%
                    </span>
                    <span className="text-[9px] font-bold opacity-70 whitespace-nowrap">{t('dashboard:price.change')}</span>
                  </div>
                );
              })() : (
                <div className="px-3 py-1.5 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400">{t('dashboard:price.approved')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Middle Storage Allocation Bar & Capacity Overview - Premium Redesign */}
          <div className="relative overflow-hidden p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-slate-50/95 via-teal-50/20 to-slate-100/80 dark:from-slate-900/90 dark:via-slate-800/80 dark:to-slate-900/90 border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-sm space-y-1.5 my-auto">
            
            {/* Top Bar: Title & Total Capacity Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-5.5 h-5.5 rounded-lg bg-teal-500/10 dark:bg-teal-400/10 flex items-center justify-center text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/20">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    {t('dashboard:capacity.title')}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 dark:from-teal-950/70 dark:to-emerald-950/70 border border-teal-500/30 dark:border-teal-700/50 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="font-mono font-extrabold text-teal-700 dark:text-teal-300 text-xs sm:text-[12.5px] tracking-tight">
                  {fillLabel}
                </span>
                <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">{t('dashboard:capacity.fill')}</span>
              </div>
            </div>

            {/* Live Fluid Stream Flow Bar with Floating HUD Badges */}
            <div className="space-y-1 pt-0.5">
              
              {/* Live Flow Stream Bar */}
              <div className="relative w-full h-4.5 sm:h-5 bg-slate-200/90 dark:bg-slate-950/90 rounded-xl p-0.5 flex items-center gap-1 shadow-inner ring-1 ring-slate-300/70 dark:ring-white/10 overflow-hidden">
                
                {/* Segment 1: الخزانات المركزية (83.2%) */}
                <div
                  className="group relative h-full rounded-lg bg-gradient-to-r from-teal-700 via-teal-600 to-teal-500 transition-all duration-500 hover:brightness-110 shadow-[0_0_12px_rgba(13,148,136,0.35)] flex items-center justify-center overflow-hidden cursor-pointer"
                  style={{ width: fillLabel }}
                  title={`${t('dashboard:etihad.tanks')}: ${fillLabel} (${formatNumber(etihadTotalBalance)} ${t('common:units.liter')})`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent opacity-60 pointer-events-none" />
                  <span className="relative z-10 min-w-0 max-w-full text-[9px] sm:text-[10px] font-bold text-white px-2 drop-shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-300 shrink-0"></span>
                    <span className="truncate min-w-0">{t('dashboard:capacity.current')}</span>
                    <strong className="shrink-0 font-mono font-black text-teal-100">{fillLabel}</strong>
                  </span>
                </div>

                {/* Segment 2: السعة المتبقية (16.8%) */}
                <div
                  className="group relative h-full rounded-lg bg-gradient-to-r from-teal-600 via-emerald-500 to-teal-300 transition-all duration-500 hover:brightness-110 shadow-[0_0_14px_rgba(16,185,129,0.45)] flex items-center justify-center overflow-hidden cursor-pointer"
                  style={{ width: remainLabel }}
                  title={`${t('dashboard:capacity.remaining')}: ${remainLabel} (${formatNumber(remainingCapacity)} ${t('common:units.liter')})`}
                >
                  {/* Live Animated Holographic Flow Stream */}
                  <div className="absolute inset-0 animate-stream-flow opacity-60 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/25 to-transparent opacity-70 pointer-events-none" />
                  
                  <span className="relative z-10 text-[9px] sm:text-[10px] font-bold text-white px-1.5 truncate drop-shadow-md flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                    </span>
                    <span>{t('dashboard:capacity.remainingShort')}</span>
                    <strong className="font-mono font-black text-teal-950">{remainLabel}</strong>
                  </span>
                </div>

              </div>

              {/* Smart HUD Badges */}
              <div className="flex items-center justify-between text-xs gap-2 pt-0.5">
                
                {/* Badge 2: السعة المتبقية */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/40 min-w-0 shadow-2xs">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="font-bold text-[9.5px] sm:text-[10.5px] text-slate-700 dark:text-slate-200 truncate">
                    {t('dashboard:capacity.remaining')}
                  </span>
                  <span className="font-mono font-black text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-300">
                    {remainLabel}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">
                    ({formatNumber(remainingCapacity)} {t('common:units.liter')})
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* 3 Internal Metrics: الوارد - الاستهلاك - المبيعات */}
          {/* 3 Internal Metrics: الوارد - الاستهلاك - المبيعات */}
          <div className="kpi-wrap pt-3.5 border-t border-slate-100 dark:border-slate-800"><div className="kpi-grid kpi-grid-3 gap-3">
            
            {/* 1. الوارد */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="kpi-label">{t('dashboard:flow.totalInbound')}</span>
                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40 shrink-0">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="kpi-num font-black text-slate-900 dark:text-white font-mono">
                {formatNumber(totalInbound)} <span className="text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
              </div>
              {buys.today ? (() => {
                // شراء اليوم ونسبة التغير (معدل اليومين مقارنة بسعر اليوم السابق) — نفس كارت الصحاري
                const pct = buys.pct !== null && Math.abs(buys.pct) < 0.005 ? 0 : buys.pct;
                const tone = pct === null || pct === 0 ? 'text-slate-500' : pct > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
                return (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg ring-1 min-w-0 bg-white dark:bg-slate-900/70 ring-slate-200 dark:ring-slate-700 px-1.5 py-1 text-center" title={`${t('dashboard:price.buyAvg')} · ${buys.today.day}`}>
                      <div className="text-[9px] font-bold leading-tight text-slate-400">{t('dashboard:price.todayBuy')}</div>
                      <div className="mt-0.5 font-mono font-black kpi-sub tabular-nums text-slate-700 dark:text-slate-200">
                        {buys.today.price.toFixed(1)}<span className="text-[8.5px] font-bold text-slate-400"> {t('common:units.iqd')}</span>
                      </div>
                    </div>
                    <div
                      className="rounded-lg ring-1 min-w-0 bg-white dark:bg-slate-900/70 ring-slate-200 dark:ring-slate-700 px-1.5 py-1 text-center"
                      title={buys.twoDayAvg !== null ? `${t('dashboard:price.twoDayAvg')}: ${buys.twoDayAvg.toFixed(1)} ${t('common:units.iqd')}` : t('dashboard:compare.noPrevDay')}
                    >
                      <div className="text-[9px] font-bold leading-tight text-slate-400">{t('dashboard:price.change')}</div>
                      <div className={`mt-0.5 flex items-center justify-center gap-0.5 ${tone}`}>
                        {pct !== null && pct < 0 && <TrendingDown className="w-3 h-3 shrink-0" />}
                        {pct !== null && pct > 0 && <TrendingUp className="w-3 h-3 shrink-0" />}
                        <span dir="ltr" className="font-mono font-black kpi-sub tabular-nums leading-none">
                          {pct === null ? '—' : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <span className="text-[10px] text-slate-400 mt-1 block">{t('dashboard:flow.received')}</span>
              )}
            </div>

            {/* 2. الاستهلاك + المبيعات */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="kpi-label" title={t('dashboard:flow.actual')}><span className="lbl-full">{t('dashboard:flow.actual')}</span><span className="lbl-short">{t('dashboard:flow.actualShort')}</span></span>
                <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40 shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="kpi-num font-black text-slate-900 dark:text-white font-mono">
                {formatNumber(totalOutflow)} <span className="text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-slate-400 min-w-0">
                <span className="whitespace-nowrap">{t('dashboard:flow.consumption')}: <strong className="font-mono text-slate-600 dark:text-slate-300">{formatNumber(totalConsumption)}</strong></span>
                <span className="whitespace-nowrap">{t('dashboard:flow.sales')}: <strong className="font-mono text-slate-600 dark:text-slate-300">{formatNumber(totalSales)}</strong></span>
              </div>
            </div>

            {/* 3. فرق الاستهلاك الفعلي بين أمس واليوم (الاستهلاك + المبيعات) */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="kpi-label" title={t('dashboard:flow.actualDiff')}><span className="lbl-full">{t('dashboard:flow.actualDiff')}</span><span className="lbl-short">{t('dashboard:flow.actualDiffShort')}</span></span>
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200/60 dark:border-teal-800/40 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              {outflowDiff === null ? (
                <>
                  <div className="kpi-num font-black text-slate-400 font-mono">—</div>
                  <span className="text-[10px] text-slate-400 mt-1 block">{t('dashboard:compare.noPrevDay')}</span>
                </>
              ) : (
                <>
                  <div className={`kpi-num font-black font-mono ${outflowDiff > 0 ? 'text-rose-600 dark:text-rose-400' : outflowDiff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                    <span dir="ltr">{outflowDiff > 0 ? '▲ +' : outflowDiff < 0 ? '▼ −' : ''}{formatNumber(Math.abs(outflowDiff))}</span>{' '}
                    <span className="text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-white dark:bg-slate-900/70 ring-1 ring-slate-200 dark:ring-slate-700 px-1.5 py-1 text-center min-w-0">
                      <div className="text-[9px] font-bold text-slate-400 leading-none">{t('dashboard:day.yesterday')}</div>
                      <div className="mt-0.5 font-mono font-black kpi-sub text-slate-600 dark:text-slate-300 tabular-nums">{formatNumber(prevOutflow!)}</div>
                    </div>
                    <div className="rounded-lg bg-teal-50 dark:bg-teal-950/50 ring-1 ring-teal-200 dark:ring-teal-800 px-1.5 py-1 text-center min-w-0">
                      <div className="text-[9px] font-bold text-teal-600 dark:text-teal-400 leading-none">{t('dashboard:day.today')}</div>
                      <div className="mt-0.5 font-mono font-black kpi-sub text-teal-900 dark:text-teal-100 tabular-nums">{formatNumber(totalOutflow)}</div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div></div>

        </div>

        {/* Side Weekly Comparison Charts & Coverage (Mobile/Tablet 12 Cols, Desktop 5 Cols) */}
        <div className="col-span-1 md:col-span-12 xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
          
          {/* Card 1: Inbound Weekly Chart (مقارنة الوارد الأسبوعي) */}
          <div className="p-4 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-2 overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span className="truncate">{t('dashboard:etihad.weeklyInbound')}</span>
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatNumber(totalInbound)} <span className="text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
              </div>
              <span className="text-[9px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                {t('dashboard:compare.sevenDays')}
              </span>
            </div>

            {/* Inbound Weekly Area Chart with X-Axis and Interactive Tooltip */}
            <div className="h-20 w-full -mx-1 pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inboundWeekly} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inboundGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }}
                    interval={0}
                    tickFormatter={(val) => enumText(val, 'short')}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white px-2.5 py-1 rounded-xl text-[10px] shadow-lg border border-slate-700/60 backdrop-blur-md">
                            <span className="font-bold text-slate-300">{enumText(data.day)} <span className="font-mono text-slate-400">{data.date}</span>:</span>
                            <span className="font-mono font-black text-emerald-400">{formatNumber(data.val)} {t('common:units.liter')}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="val"
                    stroke="#10B981"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#inboundGradient)"
                    dot={{ fill: '#10B981', r: 2 }}
                    activeDot={{ r: 3.5, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: Consumption Weekly Chart (مقارنة الاستهلاك الأسبوعي) */}
          <div className="p-4 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-2 overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span className="truncate">{t('dashboard:etihad.weeklyConsumption')}</span>
              <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
            </div>
            
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                {formatNumber(totalOutflow)} <span className="text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
              </div>
              <span className="text-[9px] text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/40">
                {t('dashboard:compare.sevenDays')}
              </span>
            </div>

            {/* Consumption Weekly Area Chart with X-Axis and Interactive Tooltip */}
            <div className="h-20 w-full -mx-1 pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={consumptionWeekly} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }}
                    interval={0}
                    tickFormatter={(val) => enumText(val, 'short')}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white px-2.5 py-1 rounded-xl text-[10px] shadow-lg border border-slate-700/60 backdrop-blur-md">
                            <span className="font-bold text-slate-300">{enumText(data.day)} <span className="font-mono text-slate-400">{data.date}</span>:</span>
                            <span className="font-mono font-black text-blue-400">{formatNumber(data.val)} {t('common:units.liter')}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="val"
                    stroke="#3B82F6"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#consumptionGradient)"
                    dot={{ fill: '#3B82F6', r: 2 }}
                    activeDot={{ r: 3.5, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 3: Smart Coverage Prediction (يؤمن لغاية - Spans across 2 columns) */}
          <div className="sm:col-span-2 p-4 sm:p-5 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-3 overflow-hidden">
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold text-xs min-w-0">
                <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate">{t('dashboard:etihad.coverageTitle')}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-[10px] font-bold border border-teal-200 dark:border-teal-800/60 shadow-2xs shrink-0">
                {t('dashboard:etihad.surplus')}
              </span>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {t('dashboard:coverage.until')} <span className="text-teal-600 dark:text-teal-400 font-mono">{coverageDays === null ? '—' : `${t('common:units.days', { count: coverageDays })}`}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {t('dashboard:coverage.dueDate')} <strong className="font-mono text-slate-700 dark:text-slate-300">{coverageDate}</strong>
              </p>
            </div>

            {/* 3 Metrics Chips: كاز التشغيلي - كاز نظيف - الرصيد الكلي */}
            <div className="kpi-wrap pt-3 border-t border-slate-100 dark:border-slate-800 text-center"><div className="kpi-grid kpi-grid-chips gap-2 sm:gap-2.5">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between overflow-hidden min-w-0">
                <span className="kpi-label font-bold text-slate-500 dark:text-slate-400 block mb-1">{t('dashboard:etihad.operationalGas')}</span>
                <div className="kpi-num font-mono font-black text-slate-900 dark:text-white tracking-tight">
                  {formatNumber(latest?.operationalGas ?? 0)} <span className="text-[9px] sm:text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
                </div>
              </div>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between overflow-hidden min-w-0">
                <span className="kpi-label font-bold text-slate-500 dark:text-slate-400 block mb-1">{t('dashboard:etihad.cleanGas')}</span>
                <div className="kpi-num font-mono font-black text-slate-900 dark:text-white tracking-tight">
                  {formatNumber(latest?.cleanGas ?? 0)} <span className="text-[9px] sm:text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
                </div>
              </div>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200/90 dark:border-teal-800/70 flex flex-col justify-between shadow-2xs overflow-hidden min-w-0">
                <span className="kpi-label font-bold text-teal-700 dark:text-teal-300 block mb-1">{t('dashboard:balance.total')}</span>
                <div className="kpi-num font-mono font-black text-teal-900 dark:text-teal-100 tracking-tight">
                  {formatNumber(etihadTotalBalance)} <span className="text-[9px] sm:text-[10px] font-normal text-teal-600 dark:text-teal-400">{t('common:units.liter')}</span>
                </div>
              </div>
            </div></div>

          </div>

        </div>

      </div>

    </div>
  );
};
