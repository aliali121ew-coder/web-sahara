import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Zap,
  Tractor,
  Cpu,
  Flame,
  Droplets,
  Activity,
  ArrowDownLeft,
  Boxes,
  PieChart as PieIcon,
  X,
  MapPin,
  ChevronLeft
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip
} from 'recharts';
import { formatNumber } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { enumText, siteName } from '../../i18n/enums';
import { useCentralTanks, resolveSaharaGasoilSectionKey, tankLiters } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';
import { useSaharaLedger } from '../../lib/saharaLedger';
import { useFuelData } from '../../context/FuelDataContext';
import { computeInboundPriceStats, computeDailyBuys, ownSaharaDeliveries } from '../../lib/inboundPrice';

const WEEK_DAYS = [
  { day: 'SAT', fullName: 'السبت' },
  { day: 'SUN', fullName: 'الأحد' },
  { day: 'MON', fullName: 'الإثنين' },
  { day: 'TUE', fullName: 'الثلاثاء' },
  { day: 'WED', fullName: 'الأربعاء' },
  { day: 'THU', fullName: 'الخميس' },
  { day: 'FRI', fullName: 'الجمعة' },
];

/**
 * بيانات الأسبوع (السبت ← الجمعة) للأسبوع الذي فيه آخر يوم مسجّل:
 * الوارد والاستهلاك الفعلي من جدول رصيد شركة الصحاري، واليوم غير المسجّل = 0.
 */
const buildWeeklyFlow = (days: { date: string; inbound: number; actualConsumption: number }[], anchor?: string) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = anchor ? new Date(anchor.replace(/\//g, '-') + 'T12:00:00') : new Date();
  const saturday = new Date(base);
  saturday.setDate(base.getDate() - ((base.getDay() + 1) % 7)); // السبت = بداية الأسبوع
  const byDate = new Map(days.map(d => [d.date, d]));
  return WEEK_DAYS.map((w, i) => {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + i);
    const date = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    const rec = byDate.get(date);
    return { ...w, date, inbound: rec?.inbound ?? 0, consumption: rec?.actualConsumption ?? 0 };
  });
};

export const SaharaGasSection: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  // متوسط السعر = تكلفة المنتج الكلية ÷ الكمية المستلمة الكلية لوارد الصحاري (نفس كارت صفحة الوارد)،
  // ونسبة التغير = أثر آخر وارد على المتوسط (ارتفاع = أحمر، انخفاض = أخضر)
  const { saharaDeliveries } = useFuelData();
  const { avgPrice, change: priceChange, dailyBuys } = React.useMemo(() => {
    // نفس نطاق صفحة وارد الصحاري: شحنات شركة صحاري كربلاء فقط
    const own = ownSaharaDeliveries(saharaDeliveries);
    const stats = computeInboundPriceStats(own);
    // شراء اليوم ونسبة التغير (معدل اليومين مقارنة بسعر أمس) — نفس حساب صفحة رصيد الشركة
    const buys = computeDailyBuys(own);
    const today = buys.today ? { day: buys.today.day, price: buys.today.price, twoDayAvg: buys.twoDayAvg, pct: buys.pct } : null;
    return { ...stats, dailyBuys: { today } };
  }, [saharaDeliveries]);
  // آخر يوم مسجّل في رصيد شركة الصحاري، وفرق الاستهلاك الفعلي عن اليوم الذي قبله
  // النسخة المعتمدة فقط: تتحدث بعد "تأكيد البيانات" في صفحة رصيد الشركة
  const { publishedComputed: saharaDays } = useSaharaLedger();
  const latestDay = saharaDays[saharaDays.length - 1];
  const prevDay = saharaDays[saharaDays.length - 2];  const weeklyFlow = React.useMemo(() => buildWeeklyFlow(saharaDays, latestDay?.date), [saharaDays, latestDay?.date]);
  const totalInbound = latestDay?.inbound ?? 0;
  const actualConsumption = latestDay?.actualConsumption ?? 0;
  // الفرق باللتر بين الاستهلاك الفعلي اليوم وأمس، والنسبة فقط إن كان لأمس استهلاك
  const actualDiff = prevDay ? actualConsumption - prevDay.actualConsumption : null;
  const actualDiffPct = prevDay && prevDay.actualConsumption > 0 ? (actualDiff! / prevDay.actualConsumption) * 100 : null;

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // توزيع الاستهلاك: من قسم "الاستهلاك اليومي" لآخر يوم في رصيد شركة الصحاري، والنسبة من الاستهلاك الفعلي
  const sectorPct = (v: number) => (actualConsumption > 0 ? Math.round((v / actualConsumption) * 100) : 0);
  const sectorData = [
    {
      name: t('dashboard:sahara.sectors.vehicles'),
      value: sectorPct(latestDay?.vehicles ?? 0),
      volume: latestDay?.vehicles ?? 0,
      color: '#2563EB',
      glowColor: 'rgba(37, 99, 235, 0.35)',
      icon: Tractor,
    },
    {
      name: t('dashboard:sahara.sectors.generators'),
      value: sectorPct(latestDay?.generators ?? 0),
      volume: latestDay?.generators ?? 0,
      color: '#6366F1',
      glowColor: 'rgba(99, 102, 241, 0.35)',
      icon: Cpu,
    },
    {
      name: t('dashboard:sahara.sectors.farms'),
      value: sectorPct(latestDay?.farms ?? 0),
      volume: latestDay?.farms ?? 0,
      color: '#10B981',
      glowColor: 'rgba(16, 185, 129, 0.35)',
      icon: Zap,
    },
  ];

  // أرصدة المواقع: مباشرة من منظومة الخزانات — قسم "خزانات الكاز - شركة صحاري كربلاء"
  const [centralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const coveredStations = React.useMemo(() => {
    const key = resolveSaharaGasoilSectionKey(centralTanks);
    if (!key) return [];
    return centralTanks
      .filter(t => t.sectionKey === key)
      .map(t => ({ id: t.id, name: t.name.replace(/^موقع\s+/, ''), balance: tankLiters(t), capacity: t.capacityLiters }));
  }, [centralTanks]);

  // السعة = مجموع سعات خزانات المواقع
  // الكارت ثابت على 8 خانات: إذا زادت المواقع تظهر أعلى 8 رصيدًا، والباقي من زر "عرض الكل" أسفلها
  const MAX_SLOTS = 8;
  const hasOverflow = coveredStations.length > MAX_SLOTS;
  const gridStations = hasOverflow
    ? [...coveredStations].sort((a, b) => b.balance - a.balance).slice(0, MAX_SLOTS)
    : coveredStations;
  const [showAllStations, setShowAllStations] = useState(false);

  // الرصيد الفعلي = الرصيد الحالي لآخر يوم في رصيد شركة الصحاري (وإن لم يوجد سجل: مجموع أرصدة المواقع)
  const actualBalance = latestDay ? latestDay.current : coveredStations.reduce((a, st) => a + st.balance, 0);
  // يؤمن لغاية = الرصيد الفعلي ÷ الاستهلاك الفعلي اليومي، وتاريخ النفاد = تاريخ آخر يوم + عدد الأيام
  const coverageDays = actualConsumption > 0 ? Math.floor(actualBalance / actualConsumption) : null;
  const coverageDate = (() => {
    if (coverageDays === null || !latestDay) return '—';
    const d = new Date(latestDay.date.replace(/\//g, '-') + 'T12:00:00');
    d.setDate(d.getDate() + coverageDays);
    return d.toISOString().slice(0, 10).replace(/-/g, '/');
  })();
  const totalCapacity = coveredStations.reduce((a, st) => a + st.capacity, 0);
  const remainingCapacity = Math.max(0, totalCapacity - actualBalance);
  const fillPct = totalCapacity ? (actualBalance / totalCapacity) * 100 : 0;
  const fillLabel = `${fillPct.toFixed(1)}%`;
  const remainLabel = `${(100 - fillPct).toFixed(1)}%`;

  return (
    <div className="space-y-3.5">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {t('dashboard:sahara.title')}
              </h2>

              
            </div>
          </div>
        </div>
      </div>

      {/* Hero Cards Grid (Responsive: Mobile 1 Col, Tablet 2 Rows/Split, Desktop 3 Cards in 1 Row 5+3+4) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
        
        {/* Hero Card 1: Actual Balance & Metrics (12 cols on mobile/tablet, 5 cols on desktop) */}
        <div className="col-span-1 md:col-span-12 xl:col-span-5 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-3.5 h-full overflow-hidden">
          
          {/* Header Row: Title & Average Price Pill */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                  <Droplets className="w-3.5 h-3.5" />
                </div>
                <span>{t('dashboard:sahara.balance')}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {t('dashboard:sahara.actual')}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  {formatNumber(actualBalance)}
                </span>
                <span className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">{t('common:units.liter')}</span>
              </div>
            </div>

            {/* Average Price Pill with Modern Glass & Glow */}
            {/* كارت السعر: الرقم في المنتصف، وتحته شريط سفلي ملوّن مستقل لنسبة التغير */}
            <div className="min-w-[128px] rounded-2xl overflow-hidden bg-gradient-to-br from-white to-blue-50/40 dark:from-slate-800/90 dark:to-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shrink-0 shadow-xs">
              <div className="px-3 pt-2.5 pb-2 text-center">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 block">{t('dashboard:price.average')}</span>
                <div className="mt-0.5 flex items-baseline justify-center gap-1">
                  <span className="text-lg sm:text-2xl font-black text-blue-700 dark:text-blue-300 font-mono tracking-tight leading-none tabular-nums">
                    {avgPrice.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{t('common:units.iqd')}</span>
                </div>
              </div>
              {/* نسبة الزيادة/النقصان بعد آخر وارد (ارتفاع = أحمر، انخفاض = أخضر) */}
              {priceChange ? (() => {
                const up = priceChange.pct >= 0.005; // ما يظهر 0.00% = بلا سهم
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

          {/* Middle Storage Allocation Bar & Capacity Overview (Centered Harmoniously) */}
          <div className="relative overflow-hidden p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-slate-50/95 via-blue-50/20 to-slate-100/80 dark:from-slate-900/90 dark:via-slate-800/80 dark:to-slate-900/90 border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-sm space-y-1.5 my-auto">
            
            {/* Top Bar: Title & Total Capacity Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-5.5 h-5.5 rounded-lg bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20 shadow-2xs">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                    {t('dashboard:capacity.titleShort')}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-blue-500/10 dark:from-blue-950/70 dark:to-emerald-950/70 border border-blue-500/30 dark:border-blue-700/50 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="font-mono font-black text-blue-700 dark:text-blue-300 text-xs sm:text-[12.5px] tracking-tight">
                  {fillLabel}
                </span>
                <span className="text-[9.5px] font-bold text-slate-600 dark:text-slate-300">{t('dashboard:capacity.fill')}</span>
              </div>
            </div>

            {/* Pattern 2 + Pattern 1 Badges: Live Fluid Stream Flow Bar with HUD Badges */}
            <div className="space-y-1 pt-0.5">
              
              {/* Live Flow Stream Bar */}
              <div className="relative w-full h-4.5 sm:h-5 bg-slate-200/90 dark:bg-slate-950/90 rounded-xl p-0.5 flex items-center gap-1 shadow-inner ring-1 ring-slate-300/70 dark:ring-white/10 overflow-hidden">
                
                {/* Segment 1: الخزانات المركزية (83.2%) */}
                <div
                  className="group relative h-full rounded-lg bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 transition-all duration-500 hover:brightness-110 shadow-[0_0_12px_rgba(37,99,235,0.35)] flex items-center justify-center overflow-hidden cursor-pointer"
                  style={{ width: fillLabel }}
                  title={`${t('dashboard:capacity.centralTanks')}: ${fillLabel} (${formatNumber(actualBalance)} ${t('common:units.liter')})`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent opacity-60 pointer-events-none" />
                  <span className="relative z-10 text-[9px] sm:text-[10px] font-bold text-white px-2 truncate drop-shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-300"></span>
                    <span>{t('dashboard:capacity.current')}</span>
                    <strong className="font-mono font-black text-blue-100">{fillLabel}</strong>
                  </span>
                </div>

                {/* Segment 2: السعة المتبقية (16.8%) */}
                <div
                  className="group relative h-full rounded-lg bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 transition-all duration-500 hover:brightness-110 shadow-[0_0_14px_rgba(6,182,212,0.45)] flex items-center justify-center overflow-hidden cursor-pointer"
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
                    <strong className="font-mono font-black text-cyan-50">{remainLabel}</strong>
                  </span>
                </div>

              </div>

              {/* Smart HUD Badges */}
              <div className="flex items-center justify-between text-xs gap-2 pt-0.5">
                
                {/* Badge 2: السعة المتبقية */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-50/80 dark:bg-cyan-950/50 border border-cyan-200/60 dark:border-cyan-800/40 min-w-0 shadow-2xs">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                  </span>
                  <span className="font-bold text-[9.5px] sm:text-[10.5px] text-slate-700 dark:text-slate-200 truncate">
                    {t('dashboard:capacity.remaining')}
                  </span>
                  <span className="font-mono font-black text-[11px] sm:text-xs text-cyan-700 dark:text-cyan-300">
                    {remainLabel}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">
                    ({formatNumber(remainingCapacity)} {t('common:units.liter')})
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* 3 Enriched Executive Metrics: الوارد - الاستهلاك الكلي - الاستهلاك الفعلي */}
          <div className="kpi-wrap pt-3 border-t border-slate-100 dark:border-slate-800"><div className="kpi-grid kpi-grid-3 gap-2.5">
            
            {/* 1. الوارد */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span className="kpi-label">{t('dashboard:flow.totalInbound')}</span>
                <div className="w-5 h-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40 shrink-0">
                  <ArrowDownLeft className="w-3 h-3" />
                </div>
              </div>
              <div className="kpi-num font-black text-slate-900 dark:text-white font-mono">
                {formatNumber(totalInbound)} <span className="text-[8.5px] font-normal text-slate-400">{t('common:units.liter')}</span>
              </div>
              {prevDay ? (
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {/* شراء اليوم (معدل سعر آخر يوم وارد) وبجانبه نسبة التغير: معدل اليومين مقارنة بسعر أمس (ارتفاع = أحمر، انخفاض = أخضر) */}
                  {(() => {
                    const buy = dailyBuys.today;
                    // ما يظهر 0.00% يُعامل كصفر: بلا سهم وبلون رمادي
                    const pct = buy && buy.pct !== null && Math.abs(buy.pct) < 0.005 ? 0 : buy?.pct ?? null;
                    // الكارت أبيض دائمًا، ولون النص فقط يتغير
                    const tone = pct === null || pct === 0
                      ? 'text-slate-500'
                      : pct > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400';
                    return (
                      <>
                        <div
                          className="rounded-lg ring-1 min-w-0 bg-white dark:bg-slate-900/70 ring-slate-200 dark:ring-slate-700 px-1.5 py-1 text-center"
                          title={buy ? `${t('dashboard:price.buyAvg')} · ${buy.day}` : undefined}
                        >
                          <div className="text-[9px] font-bold leading-tight text-slate-400">{t('dashboard:price.todayBuy')}</div>
                          <div className="mt-0.5 font-mono font-black kpi-sub tabular-nums text-slate-700 dark:text-slate-200">
                            {buy ? buy.price.toFixed(1) : '—'}{buy && <span className="text-[8.5px] font-bold text-slate-400"> {t('common:units.iqd')}</span>}
                          </div>
                        </div>
                        <div className="rounded-lg ring-1 min-w-0 bg-white dark:bg-slate-900/70 ring-slate-200 dark:ring-slate-700 px-1.5 py-1 text-center" title={buy?.twoDayAvg ? `${t('dashboard:price.twoDayAvg')}: ${buy.twoDayAvg.toFixed(1)} ${t('common:units.iqd')} · ${t('dashboard:price.vsPrevBuy')}` : t('dashboard:price.vsPrevBuy')}>
                          <div className="text-[9px] font-bold leading-tight text-slate-400">{t('dashboard:price.change')}</div>
                          <div className={`mt-0.5 flex items-center justify-center gap-0.5 ${tone}`}>
                            {pct !== null && pct < 0 && <TrendingDown className="w-3 h-3 shrink-0" />}
                            {pct !== null && pct > 0 && <TrendingUp className="w-3 h-3 shrink-0" />}
                            <span dir="ltr" className="font-mono font-black kpi-sub tabular-nums leading-none">
                              {pct === null ? '—' : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}%`}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 mt-0.5 block">{t('dashboard:flow.received')}</span>
              )}
            </div>

            {/* 3. الاستهلاك الفعلي */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-bold text-blue-700 dark:text-blue-300 mb-1">
                <span className="kpi-label">{t('dashboard:flow.actual')}</span>
                <div className="w-5 h-5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center border border-blue-300/60 dark:border-blue-700/50 shrink-0">
                  <Activity className="w-3 h-3" />
                </div>
              </div>
              <div className="kpi-num font-black text-blue-900 dark:text-blue-100 font-mono">
                {formatNumber(actualConsumption)} <span className="text-[8.5px] font-normal text-blue-500">{t('common:units.liter')}</span>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-300 mt-0.5 block">{t('dashboard:flow.directOutflow')}</span>
            </div>

            {/* 2. فرق الاستهلاك الفعلي بين أمس واليوم */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span className="kpi-label">{t('dashboard:flow.actualDiff')}</span>
                <div className="w-5 h-5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40 shrink-0">
                  <TrendingUp className="w-3 h-3" />
                </div>
              </div>
              {actualDiff === null ? (
                <>
                  <div className="kpi-num font-black text-slate-400 font-mono">—</div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{t('dashboard:compare.noPrevDay')}</span>
                </>
              ) : (
                <>
                  <div
                    className={`kpi-num font-black font-mono ${actualDiff > 0 ? 'text-rose-600 dark:text-rose-400' : actualDiff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}
                    title={actualDiffPct !== null ? `${Math.abs(actualDiffPct).toFixed(1)}%` : undefined}
                  >
                    <span dir="ltr">{actualDiff > 0 ? '▲ +' : actualDiff < 0 ? '▼ −' : ''}{formatNumber(Math.abs(actualDiff))}</span>{' '}
                    <span className="text-[8.5px] font-normal text-slate-400">{t('common:units.liter')}</span>
                  </div>
                  {/* أمس واليوم بخانتين واضحتين */}
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-white dark:bg-slate-900/70 ring-1 ring-slate-200 dark:ring-slate-700 px-1.5 py-1 text-center min-w-0">
                      <div className="text-[9px] font-bold text-slate-400 leading-none">{t('dashboard:day.yesterday')}</div>
                      <div className="mt-0.5 font-mono font-black kpi-sub text-slate-600 dark:text-slate-300 tabular-nums">{formatNumber(prevDay!.actualConsumption)}</div>
                    </div>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-200 dark:ring-blue-800 px-1.5 py-1 text-center min-w-0">
                      <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 leading-none">{t('dashboard:day.today')}</div>
                      <div className="mt-0.5 font-mono font-black kpi-sub text-blue-900 dark:text-blue-100 tabular-nums">{formatNumber(actualConsumption)}</div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div></div>

        </div>

        {/* Hero Card 2: Coverage Prediction (Mobile 1 col, Tablet 6 cols, Desktop 3 cols) */}
        <div className="col-span-1 md:col-span-6 xl:col-span-3 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 sm:pb-[18px] shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between gap-2.5 overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold text-xs">
              <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">{t('dashboard:coverage.smartTitle')}</span>
            </div>
            <span className="text-[9.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
              {t('dashboard:coverage.predictive')}
            </span>
          </div>

          {/* 1. Prediction Headline (Enlarged) */}
          <div className="text-center py-1.5 space-y-1.5">
            <div className="text-3xl sm:text-4xl lg:text-[34px] font-black text-slate-900 dark:text-white tracking-tight leading-none drop-shadow-2xs">
              {t('dashboard:coverage.until')} <span className="text-amber-600 dark:text-amber-400">{coverageDays === null ? '—' : `${t('common:units.days', { count: coverageDays })}`}</span>
            </div>
            <p className="text-xs sm:text-[12.5px] text-slate-500 dark:text-slate-400 font-semibold leading-none">
              {t('dashboard:coverage.runOutDate')} <strong className="font-mono text-slate-800 dark:text-slate-100 font-black">{coverageDate}</strong>
            </p>
          </div>

          {/* 2. Stations Divider with Centered Label (بنص الخط كما في المحطات) */}
          <div className="relative flex items-center justify-center my-0.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80 dark:border-slate-800" />
            </div>
            <button
              type="button"
              onClick={() => setShowAllStations(true)}
              className="relative px-3 bg-white dark:bg-slate-900 flex items-center gap-2 z-10 cursor-pointer group/st"
              title={t('dashboard:stations.showAll')}
            >
              <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 group-hover/st:text-blue-600 dark:group-hover/st:text-blue-400 transition-colors">
                {t('dashboard:stations.title')}
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-[9px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                {t('dashboard:stations.secured', { count: coveredStations.length })}
              </span>
            </button>
          </div>

          {/* 3. Stations Grid with Proportional Vertical Stature */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 grid grid-cols-2 auto-rows-fr gap-x-2 gap-y-3 pt-1">
              {gridStations.map((station, idx) => (
                <div
                  key={station.id ?? idx}
                  title={`${siteName(station.name)}: ${formatNumber(station.balance)} ${t('common:units.liter')}`}
                  className="relative p-2 pt-2.5 pb-1.5 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 shadow-2xs group flex flex-col items-center justify-center text-center"
                >
                  {/* Floating Label in Medium Inky Emerald (حبري زمردي متوسط ومتزن) */}
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-slate-900 text-[9.5px] sm:text-[10px] font-extrabold text-[#1d576a] dark:text-sky-300 transition-colors z-10 whitespace-nowrap leading-none">
                    {siteName(station.name)}
                  </span>

                  {/* Centered Fuel Balance in Softened Balanced Gray (أفتح بنسبة 10%) */}
                  <div className="relative flex items-center justify-center w-full mt-0.5">
                    <span className="font-mono font-black text-xs sm:text-[13px] text-slate-500 dark:text-slate-300 tracking-tight tabular-nums text-center">
                      {formatNumber(station.balance)}
                    </span>
                    <span className="absolute left-1 text-[7.5px] font-bold text-slate-400 dark:text-slate-500">{t('common:units.liter')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* زر عرض كل المواقع: يظهر فقط إذا زادت المواقع الظاهرة على 8 (الخزانات المخفية لا تُحتسب) */}
            {hasOverflow && (
            <div className="shrink-0 flex justify-center pt-2.5">
              <button
                type="button"
                onClick={() => setShowAllStations(true)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[9.5px] font-extrabold cursor-pointer transition-colors shadow-2xs"
              >
                {t('dashboard:stations.viewAll')}
                <span className="font-mono px-1 rounded-full bg-blue-600 text-white text-[9px]">+{coveredStations.length - gridStations.length}</span>
                <ChevronLeft className="w-3 h-3" />
              </button>
            </div>
            )}
          </div>

        </div>

        {/* نافذة كل المواقع */}
        {showAllStations && createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl" onClick={() => setShowAllStations(false)}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <MapPin className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">{t('dashboard:stations.title')}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('dashboard:stations.sites', { count: coveredStations.length })} · {t('dashboard:stations.fromTanks')}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setShowAllStations(false)} aria-label={t('common:actions.close')} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {[...coveredStations].sort((a, b) => b.balance - a.balance).map(st => {
                  const pct = st.capacity ? (st.balance / st.capacity) * 100 : 0;
                  return (
                    <div key={st.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{siteName(st.name)}</span>
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                          {formatNumber(st.balance)} <span className="text-[10px] font-bold text-slate-400">{t('common:units.liter')}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="font-mono text-[11px] font-black text-slate-600 dark:text-slate-300 w-12 text-left">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400 font-mono">{t('dashboard:capacity.label')}: {formatNumber(st.capacity)} {t('common:units.liter')}</div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">{t('dashboard:stations.total')}</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {formatNumber(actualBalance)} / {formatNumber(totalCapacity)} {t('common:units.liter')} <span className="text-blue-600 dark:text-blue-400">({fillLabel})</span>
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Hero Card 3: Sector Breakdown with Donut Chart (Mobile 1 col, Tablet 6 cols, Desktop 4 cols) */}
        <div 
          className="col-span-1 md:col-span-6 xl:col-span-4 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between overflow-hidden"
          onMouseLeave={() => setActiveIndex(null)}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <PieIcon className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                {t('dashboard:sahara.consumptionSplit')}
              </h3>
            </div>
            <span className="font-mono text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40">
              {t('dashboard:sahara.totalPercent')}
            </span>
          </div>


          {/* Chart + Legend Container */}
          <div className="flex flex-col sm:flex-row items-stretch justify-between gap-3 sm:gap-4 flex-1 py-1">
            
            {/* Right Column: Donut Chart + Under it the Rectangular Inbound & Consumption Chart Card */}
            <div className="flex flex-col items-center justify-between shrink-0 mx-auto sm:mx-0 w-full sm:w-[195px] gap-2">
              
              {/* Donut Chart Visual - Futuristic Glass Halo & Curved Segments */}
              <div 
                className="w-32 h-32 sm:w-36 sm:h-36 shrink-0 relative flex items-center justify-center"
                onMouseLeave={() => setActiveIndex(null)}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart className="outline-none focus:outline-none select-none">
                    <defs>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                      <linearGradient id="purpleGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#6d28d9" />
                      </linearGradient>
                      <linearGradient id="emeraldGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#047857" />
                      </linearGradient>
                      <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.35" />
                      </filter>
                    </defs>
                    
                    {/* Subtle Background Dial Track */}
                    <Pie
                      data={[{ value: 100 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={56}
                      dataKey="value"
                      fill="currentColor"
                      className="text-slate-100 dark:text-slate-800/60 outline-none focus:outline-none"
                      isAnimationActive={false}
                      stroke="none"
                    />

                    {/* Active Sharp Geometric Data Segments (حواف حادة ومستقيمة) */}
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={56}
                      paddingAngle={3}
                      cornerRadius={0}
                      dataKey="value"
                      className="outline-none focus:outline-none"
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {sectorData.map((_, index) => {
                        const gradIds = ['url(#blueGrad)', 'url(#purpleGrad)', 'url(#emeraldGrad)'];
                        const isHovered = activeIndex === index;

                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={gradIds[index % gradIds.length]}
                            stroke="none"
                            filter={isHovered ? 'url(#glowEffect)' : undefined}
                            className="outline-none focus:outline-none"
                            tabIndex={-1}
                            style={{
                              transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                              transformOrigin: 'center center',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              cursor: 'pointer',
                              outline: 'none',
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Futuristic Glassmorphism Center Halo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[66px] h-[66px] sm:w-[74px] sm:h-[74px] rounded-full bg-gradient-to-b from-white/95 via-slate-50/90 to-slate-100/90 dark:from-slate-800/95 dark:via-slate-800/90 dark:to-slate-900/95 border border-slate-200/90 dark:border-slate-700/80 shadow-md backdrop-blur-md flex flex-col items-center justify-center p-1 transition-all duration-300">
                    <span 
                      className="font-mono font-black leading-none transition-all duration-300 tracking-tight text-center tabular-nums"
                      style={{ 
                        color: activeIndex !== null ? sectorData[activeIndex].color : undefined,
                        fontSize: activeIndex !== null ? '1.15rem' : '0.8rem',
                        transform: activeIndex !== null ? 'scale(1.08)' : 'scale(1)'
                      }}
                    >
                      {activeIndex !== null ? `${sectorData[activeIndex].value}%` : formatNumber(actualConsumption)}
                    </span>
                    {activeIndex === null && (
                      <span className="text-[7px] font-bold text-blue-600 dark:text-blue-400 leading-none mt-0.5">{t('common:units.liter')}</span>
                    )}
                    <span className="text-[8px] font-extrabold text-slate-500 dark:text-slate-400 mt-0.5 max-w-[65px] truncate text-center leading-tight">
                      {activeIndex !== null ? sectorData[activeIndex].name : t('dashboard:sahara.actual')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rectangular Weekly Comparison Dual-Bar Chart Card */}
              <div className="w-full p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2 relative">
                
                {/* Header with Legend Badges */}
                <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-slate-200/60 dark:border-slate-700/50">
                  <span className="font-black text-[11.5px] text-slate-800 dark:text-white">
                    {t('dashboard:sahara.weekData')}
                  </span>
                  <div className="flex items-center gap-2 text-[9.5px] shrink-0">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{t('dashboard:flow.inbound')}</span>
                    </span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>{t('dashboard:flow.consumption')}</span>
                    </span>
                  </div>
                </div>

                {/* Recharts Weekly Dual-Bar Chart */}
                <div className="h-24 w-full -mx-1 pt-0.5 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weeklyFlow}
                      margin={{ top: 2, right: 4, left: 4, bottom: 0 }}
                      barGap={1.5}
                      barCategoryGap="16%"
                    >
                      <defs>
                        <linearGradient id="saharaInboundBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="saharaConsumptionBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }}
                        interval={0}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                        position={{ y: 2 }}
                        wrapperStyle={{ zIndex: 50, pointerEvents: 'none', left: '50%', transform: 'translateX(-50%)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900/95 text-white px-2.5 py-1.5 rounded-xl text-[9px] sm:text-[9.5px] shadow-2xl border border-slate-700/80 backdrop-blur-md space-y-1 min-w-[130px] pointer-events-none select-none">
                                <div className="font-extrabold text-slate-200 border-b border-slate-700/60 pb-0.5 flex items-center justify-between">
                                  <span>{enumText(data.fullName || data.day)}</span>
                                  <span className="text-[8px] font-mono text-slate-400">{data.date}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-emerald-400 font-bold">
                                  <span className="shrink-0">{t('dashboard:flow.inboundColon')}</span>
                                  <span className="font-mono font-black tabular-nums">{formatNumber(data.inbound)} <span className="text-[7.5px] font-normal text-emerald-300/80">{t('common:units.liter')}</span></span>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-rose-400 font-bold">
                                  <span className="shrink-0">{t('dashboard:flow.consumptionColon')}</span>
                                  <span className="font-mono font-black tabular-nums">{formatNumber(data.consumption)} <span className="text-[7.5px] font-normal text-rose-300/80">{t('common:units.liter')}</span></span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="inbound"
                        fill="url(#saharaInboundBar)"
                        radius={[2, 2, 0, 0]}
                        animationDuration={600}
                      />
                      <Bar
                        dataKey="consumption"
                        fill="url(#saharaConsumptionBar)"
                        radius={[2, 2, 0, 0]}
                        animationDuration={600}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

              </div>

            </div>

            {/* Sector Metrics Legend with Micro-Progress Bars */}
            <div className="flex-1 w-full flex flex-col justify-between gap-2.5 min-w-0">
              {sectorData.map((sec, idx) => {
                const isHovered = activeIndex === idx;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseLeave={() => setActiveIndex(null)}
                    className={`flex-1 flex flex-col justify-between p-2.5 sm:p-3 rounded-2xl transition-all duration-200 cursor-pointer border ${
                      isHovered
                        ? 'bg-slate-100/90 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-sm scale-[1.02]'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {/* Top Row: Dot + Name + Badge Percentage */}
                    <div className="flex items-center justify-between text-xs gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-xs"
                          style={{ backgroundColor: sec.color }}
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-[11px] sm:text-xs">
                          {sec.name}
                        </span>
                      </div>

                      <span 
                        className="font-mono font-black text-[11px] px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs"
                        style={{ 
                          backgroundColor: `${sec.color}15`, 
                          color: sec.color,
                          border: `1px solid ${sec.color}30`
                        }}
                      >
                        {sec.value}%
                      </span>
                    </div>

                    {/* Middle: Sleek Micro Progress Bar */}
                    <div className="w-full bg-slate-200/70 dark:bg-slate-700/50 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${sec.value}%`,
                          backgroundColor: sec.color
                        }}
                      />
                    </div>

                    {/* Bottom Row: Volume in Liters */}
                    <div className="flex items-center justify-between text-[11px] font-mono mt-1 pt-0.5 text-slate-500 dark:text-slate-400">
                      <span className="text-[10px] font-medium text-slate-400">{t('dashboard:sahara.consumedQty')}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                        {formatNumber(sec.volume)} <span className="text-[9px] font-semibold text-slate-400">{t('common:units.liter')}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
