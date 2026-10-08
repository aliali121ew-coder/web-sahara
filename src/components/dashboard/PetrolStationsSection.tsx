import React, { useState, useMemo } from 'react';
import { SectionHeader } from './SectionHeader';
import {
  Fuel,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Activity,
  Boxes,
  BarChart3,
  Waves
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { enumText } from '../../i18n/enums';
import { usePetrolLedger, petrolPriceStats, PETROL_TOTAL_CAPACITY } from '../../lib/petrolLedger';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

type ChartMode = 'neon-waves' | 'cyber-bars';
type TimeRange = '7d' | '14d' | '30d';

/** محور الكميات: لتر / ألف / مليون حسب حجم الرقم */
const formatAxis = (val: number) =>
  val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(val % 1000 ? 1 : 0)}k` : String(val);

export const PetrolStationsSection: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  // المؤشرات من آخر يوم معتمد في "بنزين الصحاري" (تتحدث بعد "تأكيد البيانات")
  const { publishedComputed: petrolDays } = usePetrolLedger();
  const latestPetrol = petrolDays[petrolDays.length - 1];
  const totalBalance = latestPetrol?.current ?? 0;
  const totalInbound = latestPetrol?.inboundQty ?? 0;
  const totalConsumption = latestPetrol?.totalConsumption ?? 0;
  const priceStats = useMemo(() => petrolPriceStats(petrolDays), [petrolDays]);
  const avgPrice = priceStats.avgPrice > 0 ? Number(priceStats.avgPrice.toFixed(1)) : 0;
  // يؤمن لغاية = الرصيد ÷ الاستهلاك اليومي، وتاريخ النفاد = تاريخ آخر يوم + عدد الأيام
  const coverageDays = totalConsumption > 0 ? Math.floor(totalBalance / totalConsumption) : 0;
  const coverageDate = (() => {
    if (!latestPetrol || !coverageDays) return '—';
    const d = new Date(latestPetrol.date.replace(/\//g, '-') + 'T12:00:00');
    d.setDate(d.getDate() + coverageDays);
    return d.toISOString().slice(0, 10).replace(/-/g, '/');
  })();

  // السعة الكلية = مجموع سعات محطات البنزين المعتمدة (الطاقة، التسمين، البياض، البوادي، امهات البياض، الاجداد)
  const totalCapacity = PETROL_TOTAL_CAPACITY;
  const fillPct = totalCapacity ? Math.min(100, (totalBalance / totalCapacity) * 100) : 0;
  const remainingCapacity = Math.max(0, totalCapacity - totalBalance);
  const fillLabel = `${fillPct.toFixed(1)}%`;
  const remainLabel = `${(100 - fillPct).toFixed(1)}%`;

  // Required Target Metrics (الكمية المطلوب توفرها + التغطية المستهدفة)
  // الكمية المطلوب توفرها لإكمال السعة = السعة المتبقية، والتغطية المستهدفة عند امتلاء الخزانات
  const requiredQuantity = remainingCapacity;
  const targetTotalBalance = totalBalance + requiredQuantity;
  const targetCoverageDays = totalConsumption > 0 ? Math.floor(targetTotalBalance / totalConsumption) : 0;
  const targetCoverageDate = (() => {
    if (!latestPetrol || !targetCoverageDays) return '—';
    const d = new Date(latestPetrol.date.replace(/\//g, '-') + 'T12:00:00');
    d.setDate(d.getDate() + targetCoverageDays);
    return d.toISOString().slice(0, 10).replace(/-/g, '/');
  })();

  // Chart Presentation Mode Switch: Neon Waves | 3D Bars
  const [chartMode, setChartMode] = useState<ChartMode>('neon-waves');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [showInbound, setShowInbound] = useState(true);
  const [showConsumption, setShowConsumption] = useState(true);

  // بيانات الرسم من أرشيف بنزين الصحاري (الأيام المعتمدة): آخر 7 / 14 / 30 يومًا مسجلًا
  const activeChartData = useMemo(() => {
    const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const count = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    return petrolDays.slice(-count).map(d => {
      const inbound = (d.inboundQty || 0) + (d.inboundInternal || 0);
      const consumption = d.totalConsumption;
      const net = inbound - consumption;
      const [, mm, dd] = d.date.split('/');
      const weekday = WEEKDAYS[new Date(d.date.replace(/\//g, '-') + 'T12:00:00').getDay()];
      return {
        name: timeRange === '7d' ? weekday : `${mm}/${dd}`,
        short: dd,
        date: d.date,
        inbound,
        consumption,
        tag: inbound === 0 && consumption === 0 ? 'لا حركة' : net > 0 ? 'فائض' : net < 0 ? 'سحب من الرصيد' : 'متوازن',
        الصافي: net,
        isSurplus: net >= 0
      };
    });
  }, [petrolDays, timeRange]);

  // Dynamic Average Daily Consumption
  const avgConsumption = useMemo(() => {
    if (!activeChartData.length) return 0;
    const sum = activeChartData.reduce((acc, curr) => acc + curr.consumption, 0);
    return Math.round(sum / activeChartData.length);
  }, [activeChartData]);



  // Clean, High-Contrast Glass Hologram Tooltip
  const CustomHologramTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const inboundVal = data.inbound;
      const consumptionVal = data.consumption;
      const netVal = inboundVal - consumptionVal;
      const isPositive = netVal >= 0;

      return (
        <div className="bg-slate-950/95 dark:bg-slate-950/95 border border-slate-700/80 p-2 rounded-xl shadow-2xl backdrop-blur-xl text-right font-sans min-w-[135px] max-w-[160px] space-y-1 ring-1 ring-white/10 select-none pointer-events-none z-50">
          {/* Header */}
          <div className="flex items-center justify-between gap-1.5 border-b border-slate-800/90 pb-1">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-extrabold text-[11px] text-white">{enumText(data.name)}</span>
              <span className="text-[8.5px] text-slate-400 font-mono">({data.date})</span>
            </div>
            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-950/90 text-cyan-300 border border-cyan-700/50">
              {enumText(data.tag)}
            </span>
          </div>

          {/* Metrics Rows */}
          <div className="space-y-0.5 text-[10px] font-bold">
            {/* Inbound (الوارد) */}
            <div className="flex items-center justify-between gap-2 bg-emerald-950/40 px-1.5 py-0.5 rounded-lg border border-emerald-700/40">
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <span className="text-[9.5px]">{t('dashboard:flow.inboundColon')}</span>
              </div>
              <span className="font-mono font-black text-white text-[10.5px]">
                {formatNumber(inboundVal)} <span className="text-[7.5px] text-slate-400 font-normal">{t('common:units.liter')}</span>
              </span>
            </div>

            {/* Consumption (الاستهلاك) */}
            <div className="flex items-center justify-between gap-2 bg-orange-950/40 px-1.5 py-0.5 rounded-lg border border-orange-700/40">
              <div className="flex items-center gap-1 text-orange-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#f97316]" />
                <span className="text-[9.5px]">{t('dashboard:flow.consumptionColon')}</span>
              </div>
              <span className="font-mono font-black text-white text-[10.5px]">
                {formatNumber(consumptionVal)} <span className="text-[7.5px] text-slate-400 font-normal">{t('common:units.liter')}</span>
              </span>
            </div>
          </div>

          {/* Net Flow / Surplus Pill */}
          <div className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black border ${
            isPositive
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}>
            <span>{t('dashboard:petrol.surplusColon')}</span>
            <span className="font-mono font-black dir-ltr">
              {isPositive ? `+${formatNumber(netVal)}` : formatNumber(netVal)} {t('common:units.liter')}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* 🌟 Section Header */}
      <SectionHeader title={t('dashboard:petrol.title')} icon={
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 text-white shadow-md shadow-amber-500/20">
          <Fuel className="w-4 h-4 text-amber-50" />
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      } />

      {/* 🌟 3 Main Columns Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-stretch">
        
        {/* 🌟 Hero Card 1: Actual Balance & Metrics (Wider 5 cols matching Sahara) */}
        <div className="col-span-1 md:col-span-12 xl:col-span-5 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-3 h-full overflow-hidden">
          
          {/* Header Row: Title & Average Price Pill */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                <div className="w-6 h-6 rounded-lg bg-[#146f82]/10 dark:bg-[#146f82]/30 flex items-center justify-center text-[#146f82] dark:text-teal-400 border border-[#146f82]/20 dark:border-[#146f82]/40">
                  <Fuel className="w-3.5 h-3.5" />
                </div>
                <span>{t('dashboard:petrol.balance')}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {t('dashboard:petrol.active')}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl lg:text-[36px] font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  {formatNumber(totalBalance)}
                </span>
                <span className="text-base sm:text-lg font-bold text-[#146f82] dark:text-teal-400">{t('common:units.liter')}</span>
              </div>
            </div>

            {/* Average Price Pill */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-50/90 to-teal-50/30 dark:from-slate-800/80 dark:to-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-right shrink-0 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 block">{t('dashboard:price.average')}</span>
              <div className="text-base sm:text-xl font-black text-[#146f82] dark:text-teal-300 font-mono tracking-tight">
                {avgPrice} <span className="text-[10px] font-bold text-slate-500">{t('common:units.iqd')}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400">{t('dashboard:price.approved')}</span>
              </div>
            </div>
          </div>


          {/* Middle Storage Allocation Bar & Capacity Overview (Matching Sahara Layout) */}
          <div className="relative overflow-hidden p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-slate-50/95 via-teal-50/20 to-slate-100/80 dark:from-slate-900/90 dark:via-slate-800/80 dark:to-slate-900/90 border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-sm space-y-1.5 my-auto">
            
            {/* Top Bar: Title & Total Capacity Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-5.5 h-5.5 rounded-lg bg-[#146f82]/10 dark:bg-teal-400/10 flex items-center justify-center text-[#146f82] dark:text-teal-400 ring-1 ring-[#146f82]/20 shadow-2xs">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                    {t('dashboard:capacity.title')}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 dark:from-teal-950/70 dark:to-emerald-950/70 border border-teal-500/30 dark:border-teal-700/50 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="font-mono font-black text-[#146f82] dark:text-teal-300 text-xs sm:text-[12.5px] tracking-tight">
                  {fillLabel}
                </span>
                <span className="text-[9.5px] font-bold text-slate-600 dark:text-slate-300">{t('dashboard:capacity.fill')}</span>
              </div>
            </div>

            {/* Live Fluid Stream Flow Bar with HUD Badges */}
            <div className="space-y-1 pt-0.5">
              
              {/* Live Flow Stream Bar */}
              <div className="relative w-full h-4.5 sm:h-5 bg-slate-200/90 dark:bg-slate-950/90 rounded-xl p-0.5 flex items-center gap-1 shadow-inner ring-1 ring-slate-300/70 dark:ring-white/10 overflow-hidden">
                
                {/* Segment 1: الخزانات المركزية (78.1% - أزرق غامق حبري زمردي فاخر) */}
                <div
                  className="group relative h-full rounded-lg bg-gradient-to-r from-[#0c2e3a] via-[#144757] to-[#1d576a] transition-all duration-500 hover:brightness-110 shadow-[0_0_12px_rgba(29,87,106,0.4)] flex items-center justify-center overflow-hidden cursor-pointer"
                  style={{ width: fillLabel }}
                  title={`${t('dashboard:capacity.centralTanks')}: ${fillLabel} (${formatNumber(totalBalance)} ${t('common:units.liter')})`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent opacity-60 pointer-events-none" />
                  <span className="relative z-10 min-w-0 max-w-full text-[9px] sm:text-[10px] font-bold text-white px-2 drop-shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-300 shrink-0"></span>
                    <span className="truncate min-w-0">{t('dashboard:capacity.centralTanks')}</span>
                    <strong className="shrink-0 font-mono font-black text-teal-100">{fillLabel}</strong>
                  </span>
                </div>

                {/* Segment 2: السعة المتبقية (21.9% - بنفس تدرج الخط الحبري الزمردي بتدفق انسيابي) */}
                <div
                  className="group relative h-full rounded-lg bg-gradient-to-r from-[#1d576a] via-[#23687e] to-[#2ea0be] transition-all duration-500 hover:brightness-110 shadow-[0_0_14px_rgba(46,160,190,0.45)] flex items-center justify-center overflow-hidden cursor-pointer"
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
                    <strong className="font-mono font-black text-teal-100">{remainLabel}</strong>
                  </span>
                </div>

              </div>

              {/* Smart HUD Badges */}
              <div className="flex items-center justify-between text-xs gap-2 pt-0.5">
                
                {/* Badge 2: السعة المتبقية */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#1d576a]/10 dark:bg-[#1d576a]/30 border border-[#2ea0be]/30 dark:border-[#2ea0be]/50 min-w-0 shadow-2xs">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ea0be] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2ea0be]"></span>
                  </span>
                  <span className="font-bold text-[9.5px] sm:text-[10.5px] text-slate-700 dark:text-slate-200 truncate">
                    {t('dashboard:capacity.remaining')}
                  </span>
                  <span className="font-mono font-black text-[11px] sm:text-xs text-[#1d576a] dark:text-teal-300">
                    {remainLabel}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">
                    ({formatNumber(remainingCapacity)} {t('common:units.liter')})
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* Executive Metrics: الوارد - الاستهلاك (Matching Sahara Layout) */}
          <div className="kpi-wrap pt-3 border-t border-slate-100 dark:border-slate-800"><div className="kpi-grid kpi-grid-2 gap-2.5">
            
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
              <span className="text-[10px] text-slate-400 mt-0.5 block">{t('dashboard:flow.received')}</span>
            </div>

            {/* 2. الاستهلاك */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-orange-300 dark:hover:border-orange-700 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span className="kpi-label">{t('dashboard:flow.daily')}</span>
                <div className="w-5 h-5 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-200/60 dark:border-orange-800/40 shrink-0">
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
              <div className="kpi-num font-black text-slate-900 dark:text-white font-mono">
                {formatNumber(totalConsumption)} <span className="text-[8.5px] font-normal text-slate-400">{t('common:units.liter')}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{t('dashboard:flow.directOutflow')}</span>
            </div>

          </div></div>

        </div>

        {/* 🌟 Card 2: Coverage Prediction Card (Narrower 3 cols matching Sahara) */}
        <div className="col-span-1 md:col-span-6 xl:col-span-3 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-2.5 h-full overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold text-xs">
              <Calendar className="w-4 h-4 text-[#146f82] dark:text-teal-400 shrink-0" />
              <span className="truncate">{t('dashboard:coverage.smartTitle')}</span>
            </div>
            <span className="text-[9.5px] font-mono font-bold text-[#146f82] dark:text-teal-300 bg-[#146f82]/10 dark:bg-[#146f82]/25 px-2 py-0.5 rounded-full border border-[#146f82]/25 dark:border-[#146f82]/40">
              {t('dashboard:coverage.predictive')}
            </span>
          </div>

          {/* 1. Prediction Headline (الرصيد الفعلي الحالي) */}
          <div className="text-center py-1 space-y-1 my-auto">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none drop-shadow-2xs">
              {t('dashboard:coverage.until')} <span className="text-[#146f82] dark:text-[#2dd4bf] drop-shadow-xs">{t('common:units.days', { count: coverageDays })}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {t('dashboard:coverage.runOutDate')} <strong className="font-mono text-slate-800 dark:text-slate-100 font-black">{coverageDate}</strong>
            </p>
          </div>

          {/* 2. Visual Coverage Progress Metric Bar */}
          <div className="p-2.5 rounded-2xl bg-gradient-to-r from-teal-50/60 via-slate-50 to-teal-50/40 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-800/60 border border-teal-500/20 dark:border-slate-700/60 space-y-1.5 shadow-2xs my-auto">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#146f82] dark:bg-teal-400 animate-pulse"></span>
                <span>{t('dashboard:petrol.readiness')}</span>
              </span>
              <span className="font-mono font-black text-[#146f82] dark:text-teal-300 text-xs">
                77.3%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 ring-1 ring-black/5 dark:ring-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#146f82] via-[#23687e] to-[#2dd4bf] shadow-xs transition-all duration-500" style={{ width: '77.3%' }} />
            </div>
            <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 font-bold font-mono">
              <span>{t('dashboard:petrol.actualColon')} {t('common:units.days', { count: coverageDays })}</span>
              <span className="text-[#146f82] dark:text-teal-400">{t('dashboard:petrol.targetColon')} {t('common:units.days', { count: targetCoverageDays })}</span>
            </div>
          </div>

          {/* 3. كروت الإمداد والتغطية الشاملة المستهدفة (الكمية المطلوب توفرها + يؤمن لغاية بعد التعزيز) */}
          <div className="kpi-wrap pt-2.5 border-t border-slate-100 dark:border-slate-800"><div className="kpi-grid kpi-grid-2 gap-2.5">
            
            {/* كارت 1: الكمية المطلوب توفرها */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-colors min-w-0">
              <div className="kpi-label text-slate-500 dark:text-slate-400 mb-0.5" title={t('dashboard:petrol.required')}>
                <span className="lbl-full">{t('dashboard:petrol.required')}</span><span className="lbl-short">{t('dashboard:petrol.requiredShort')}</span>
              </div>
              <div className="kpi-num font-black text-slate-900 dark:text-white font-mono">
                {formatNumber(requiredQuantity)} <span className="text-[8.5px] font-normal text-slate-400">{t('common:units.liter')}</span>
              </div>
              <span className="text-[8.5px] text-[#146f82] dark:text-teal-400 font-bold mt-0.5 block">
                {t('dashboard:petrol.boost')}
              </span>
            </div>

            {/* كارت 2: يؤمن لغاية (المتوفر + المطلوب توفرها) */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-[#146f82]/5 dark:bg-[#146f82]/20 border border-[#146f82]/25 dark:border-[#146f82]/40 flex flex-col justify-between hover:border-[#146f82] transition-colors min-w-0">
              <div className="kpi-label text-[#146f82] dark:text-teal-300 mb-0.5" title={t('dashboard:petrol.coverageFull')}>
                <span className="lbl-full">{t('dashboard:petrol.coverageFull')}</span><span className="lbl-short">{t('dashboard:petrol.coverageFullShort')}</span>
              </div>
              <div className="kpi-num !whitespace-normal font-black text-[#146f82] dark:text-[#2dd4bf] font-mono">
                <span className="whitespace-nowrap">{t('common:units.days', { count: targetCoverageDays })}</span> <span className="text-[8.5px] font-normal text-slate-400 whitespace-nowrap">({targetCoverageDate})</span>
              </div>
              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5 block">
                {t('dashboard:petrol.balanceColon')} {formatNumber(targetTotalBalance)} {t('common:units.liter')}
              </span>
            </div>

          </div></div>


        </div>

        {/* 🌟 Card 3: Futuristic World-Class Telemetry & Chart Card (4 cols on xl) */}
        <div className="col-span-1 md:col-span-6 xl:col-span-4 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between gap-2.5 overflow-hidden relative group">
          
          {/* Ambient Cyber Background Glow */}
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-teal-500/10 dark:bg-teal-500/15 rounded-full blur-3xl pointer-events-none transition-opacity" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-3xl pointer-events-none transition-opacity" />

          {/* Top Header: Title, Live Ping & Mode Controls */}
          <div className="flex flex-col gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-[13px] min-w-0">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <span className="truncate">{t('dashboard:petrol.analysis')}</span>
              </div>
              
              {/* Timeframe Selector Pills */}
              <div className="shrink-0 flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/50 text-[10px] font-black">
                <button
                  onClick={() => setTimeRange('7d')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    timeRange === '7d'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('dashboard:range.d7')}
                </button>
                <button
                  onClick={() => setTimeRange('14d')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    timeRange === '14d'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('dashboard:range.d14')}
                </button>
                <button
                  onClick={() => setTimeRange('30d')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    timeRange === '30d'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('dashboard:range.monthly')}
                </button>
              </div>
            </div>

            {/* Mode Switcher Buttons */}
            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 w-full">
                <button
                  onClick={() => setChartMode('neon-waves')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[10.5px] font-bold transition-all ${
                    chartMode === 'neon-waves'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Waves className="w-3.5 h-3.5" />
                  <span>{t('dashboard:petrol.neon')}</span>
                </button>
                <button
                  onClick={() => setChartMode('cyber-bars')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[10.5px] font-bold transition-all ${
                    chartMode === 'cyber-bars'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{t('dashboard:petrol.bars')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recharts Canvas with Futuristic Filters & Laser Mouse Tracking */}
          <div className="h-[205px] min-h-[205px] max-h-[205px] w-full relative overflow-hidden shrink-0 my-auto" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'neon-waves' ? (
                <AreaChart
                  data={activeChartData}
                  margin={{ top: 14, right: 10, left: -14, bottom: 2 }}
                >
                  <defs>
                    {/* Real Soft Ambient Glow Filters */}
                    <filter id="softGlowEmerald" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#10b981" floodOpacity="0.45" />
                    </filter>
                    <filter id="softGlowOrange" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#fb923c" floodOpacity="0.45" />
                    </filter>

                    {/* Laser Path Stroke Gradients */}
                    <linearGradient id="strokeLaserInbound" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="35%" stopColor="#06b6d4" />
                      <stop offset="70%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                    <linearGradient id="strokeLaserConsumption" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#fb923c" />
                      <stop offset="35%" stopColor="#f97316" />
                      <stop offset="70%" stopColor="#fdba74" />
                      <stop offset="100%" stopColor="#fb923c" />
                    </linearGradient>

                    {/* Crystalline Multi-Stop Area Under-glow Fills */}
                    <linearGradient id="crystalInboundGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.28} />
                      <stop offset="30%" stopColor="#10b981" stopOpacity={0.14} />
                      <stop offset="75%" stopColor="#10b981" stopOpacity={0.03} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="crystalConsumptionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.24} />
                      <stop offset="30%" stopColor="#fb923c" stopOpacity={0.10} />
                      <stop offset="75%" stopColor="#fdba74" stopOpacity={0.02} />
                      <stop offset="100%" stopColor="#fdba74" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 4"
                    vertical={false}
                    stroke="#94a3b8"
                    strokeOpacity={0.12}
                  />

                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    interval={timeRange === '30d' ? 4 : timeRange === '14d' ? 1 : 0}
                    tick={{ fill: '#64748b', fontSize: 10.5, fontWeight: 700 }}
                    dy={6}
                    tickFormatter={(val) => enumText(val, 'short')}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.1))]}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                    tickFormatter={formatAxis}
                  />
                  
                  <Tooltip 
                    content={<CustomHologramTooltip />} 
                    cursor={{
                      stroke: '#06b6d4',
                      strokeWidth: 1.5,
                      strokeDasharray: '3 3',
                      strokeOpacity: 0.85
                    }}
                    wrapperStyle={{
                      pointerEvents: 'none',
                      zIndex: 100
                    }}
                    isAnimationActive={false}
                  />

                  {showInbound && (
                    <Area 
                      type="monotone" 
                      dataKey="inbound" 
                      name={t('dashboard:flow.inbound')}
                      stroke="url(#strokeLaserInbound)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#crystalInboundGrad)" 
                      filter="url(#softGlowEmerald)"
                      activeDot={{
                        r: 6.5,
                        stroke: '#06b6d4',
                        strokeWidth: 3,
                        fill: '#ffffff',
                        className: 'drop-shadow-[0_0_14px_#06b6d4]'
                      }}
                    />
                  )}

                  {showConsumption && (
                    <Area 
                      type="monotone" 
                      dataKey="consumption" 
                      name={t('dashboard:flow.consumption')}
                      stroke="url(#strokeLaserConsumption)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#crystalConsumptionGrad)" 
                      filter="url(#softGlowOrange)"
                      activeDot={{
                        r: 6,
                        stroke: '#fb923c',
                        strokeWidth: 3,
                        fill: '#ffffff',
                        className: 'drop-shadow-[0_0_14px_#fb923c]'
                      }}
                    />
                  )}

                  {/* Smart Average Consumption Baseline - Clean Line without Text */}
                  <ReferenceLine
                    y={avgConsumption}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.85}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={activeChartData}
                  margin={{ top: 14, right: 10, left: -14, bottom: 2 }}
                  barGap={4}
                >
                  <defs>
                    <linearGradient id="barInboundGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.95} />
                      <stop offset="50%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="barConsumptionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fdba74" stopOpacity={0.95} />
                      <stop offset="50%" stopColor="#f97316" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#c2410c" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#94a3b8"
                    strokeOpacity={0.09}
                  />

                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    interval={timeRange === '30d' ? 4 : timeRange === '14d' ? 1 : 0}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                    dy={6}
                    tickFormatter={(val) => enumText(val, 'short')}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                    tickFormatter={formatAxis}
                  />
                  
                  <Tooltip 
                    content={<CustomHologramTooltip />} 
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    wrapperStyle={{
                      pointerEvents: 'none',
                      zIndex: 100
                    }}
                    isAnimationActive={false}
                  />

                  {showInbound && (
                    <Bar
                      dataKey="inbound"
                      name={t('dashboard:flow.inbound')}
                      fill="url(#barInboundGrad)"
                      radius={[6, 6, 0, 0]}
                    />
                  )}

                  {showConsumption && (
                    <Bar
                      dataKey="consumption"
                      name={t('dashboard:flow.consumption')}
                      fill="url(#barConsumptionGrad)"
                      radius={[6, 6, 0, 0]}
                    />
                  )}

                  {/* Smart Average Consumption Baseline - Clean Line without Text */}
                  <ReferenceLine
                    y={avgConsumption}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.85}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Interactive Legend & SCADA Pulse Footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
            
            {/* Interactive Filter Pills (Clickable to show/hide series) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInbound(!showInbound)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-bold transition-all ${
                  showInbound
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 shadow-2xs'
                    : 'opacity-40 line-through bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'
                }`}
                title={t('dashboard:petrol.toggleInbound')}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                <span>{t('dashboard:petrol.inboundLegend')}</span>
              </button>

              <button
                onClick={() => setShowConsumption(!showConsumption)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-bold transition-all ${
                  showConsumption
                    ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700/60 shadow-2xs'
                    : 'opacity-40 line-through bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'
                }`}
                title={t('dashboard:petrol.toggleConsumption')}
              >
                <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_6px_#f97316]" />
                <span>{t('dashboard:petrol.consumptionLegend')}</span>
              </button>
            </div>


            {/* Live SCADA Telemetry Badge */}
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-[10px]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <span className="font-mono">SCADA Live Sync</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
