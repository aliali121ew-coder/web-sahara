import React from 'react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { SectionHeader } from './SectionHeader';
import {
  Building2,
  Boxes,
  ArrowDownLeft,
  TrendingDown,
  TrendingUp,
  Activity,
  Waves,
  BarChart3
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
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
import { useAvgPricePeriod, inAvgPeriod } from '../../lib/avgPricePeriod';
import { useCentralTanks, resolveEtihadExtractionTank, syncEtihadExtractionTank } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';

const WEEK_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

/**
 * بيانات آخر 7 أيام تنتهي بآخر يوم مسجّل في رصيد شركة الاتحاد (الأيام السابقة تبقى ظاهرة للمقارنة):
 * الوارد = المشتريات، والاستهلاك = مصروف الاتحاد + كل المبيعات، واليوم غير المسجّل = 0.
 */
const buildWeeklyFlow = (records: EtihadBalanceRecord[], anchor?: string, count = 7) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = anchor ? new Date(anchor.replace(/\//g, '-') + 'T12:00:00') : new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (count - 1) + i);
    // getDay: الأحد = 0، وWEEK_DAYS يبدأ بالسبت
    const day = WEEK_DAYS[(d.getDay() + 1) % 7];
    const date = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    const dayRecords = records.filter(r => r.date === date);
    return {
      day,
      date,
      // تسمية المحور: اسم اليوم للأسبوع، وشهر/يوم للمدد الأطول
      label: count === 7 ? day : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
      inbound: dayRecords.reduce((a, r) => a + (r.purchases || 0), 0),
      consumption: dayRecords.reduce((a, r) => a + (r.etihadExpense || 0) + recordSales(r), 0),
    };
  });
};


/** رقم محور مختصر (120k، 1.2M) */
const compactAxis = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));

/** تلميح الرسم بنفس تصميم البنزين: اليوم وتاريخه وحالته، ثم الوارد والاستهلاك، ثم الفائض */
const FlowTooltip: React.FC<{ active?: boolean; payload?: { payload: ReturnType<typeof buildWeeklyFlow>[number] }[] }> = ({ active, payload }) => {
  const { t } = useTranslation(['dashboard', 'common']);
  const w = payload?.[0]?.payload;
  if (!active || !w) return null;
  const net = w.inbound - w.consumption;
  const tag = w.inbound === 0 && w.consumption === 0 ? 'لا حركة' : net > 0 ? 'فائض' : net < 0 ? 'سحب من الرصيد' : 'متوازن';
  return (
    <div dir="rtl" className="bg-slate-950/95 border border-slate-700/80 p-2 rounded-xl shadow-2xl backdrop-blur-xl text-right min-w-[150px] max-w-[180px] space-y-1 ring-1 ring-white/10 select-none pointer-events-none">
      <div className="flex items-center justify-between gap-1.5 border-b border-slate-800/90 pb-1">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          <span className="font-extrabold text-[11px] text-white">{enumText(w.day)}</span>
          <span className="text-[8.5px] text-slate-400 font-mono">({w.date})</span>
        </div>
        <span className="text-[8px] font-bold px-1.5 rounded-full bg-teal-950/90 text-teal-300 border border-teal-700/50">{enumText(tag)}</span>
      </div>
      <div className="space-y-0.5 text-[10px] font-bold">
        <div className="flex items-center justify-between gap-2 bg-emerald-950/40 px-1.5 py-0.5 rounded-lg border border-emerald-700/40">
          <span className="flex items-center gap-1 text-emerald-400 text-[9.5px]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{t('dashboard:flow.inboundColon')}</span>
          <span className="font-mono font-black text-white text-[10.5px]">{formatNumber(w.inbound)} <span className="text-[7.5px] text-slate-400 font-normal">{t('common:units.liter')}</span></span>
        </div>
        <div className="flex items-center justify-between gap-2 bg-blue-950/40 px-1.5 py-0.5 rounded-lg border border-blue-700/40">
          <span className="flex items-center gap-1 text-blue-400 text-[9.5px]"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{t('dashboard:flow.consumptionColon')}</span>
          <span className="font-mono font-black text-white text-[10.5px]">{formatNumber(w.consumption)} <span className="text-[7.5px] text-slate-400 font-normal">{t('common:units.liter')}</span></span>
        </div>
      </div>
      <div className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black border ${net >= 0 ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/15 border-rose-500/40 text-rose-300'}`}>
        <span>{t('dashboard:petrol.surplusColon')}</span>
        <span dir="ltr" className="font-mono font-black">{net >= 0 ? `+${formatNumber(net)}` : formatNumber(net)} {t('common:units.liter')}</span>
      </div>
    </div>
  );
};

const recordSales = (r?: EtihadBalanceRecord) =>
  r ? (r.saharaSales || 0) + (r.cablesSales || 0) + (r.specialSales || 0) + (r.otherSales || 0) : 0;

export const EtihadGasSection: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  // آخر يوم مسجّل في  رصيد شركة الاتحاد واليوم الذي قبله
  // سجلات "رصيد شركة الاتحاد" (الأحدث أولًا) — حيّة: تتحدث فور الحفظ في هذا الجهاز أو أي جهاز آخر
  // (كانت تُقرأ مرة عند الفتح، والرئيسية تبقى مفتوحة في الخلفية فلا يظهر اليوم الجديد إلا بإعادة التحميل)
  const [rawRecords] = useSyncedStorage<EtihadBalanceRecord[]>('sahara_etihad_balance_records_v2', []);
  const records = React.useMemo(() => (Array.isArray(rawRecords) ? [...rawRecords].sort((a, b) => b.date.localeCompare(a.date)) : []), [rawRecords]);
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
  // فترة احتساب متوسط السعر المختارة من صفحة وارد الاتحاد (بلا فترة = كل الوارد)
  const [avgPeriod] = useAvgPricePeriod('etihad');
  const { avgPrice, change: priceChange } = React.useMemo(() => computeInboundPriceStats(inAvgPeriod(priceSource, avgPeriod)), [priceSource, avgPeriod]);
  // شراء اليوم = وارد آخر يوم مسجّل (اليوم المعروض في الكارت)؛ بلا وارد فيه = صفر
  const buys = React.useMemo(() => computeDailyBuys(priceSource, latest?.date), [priceSource, latest?.date]);
  const totalInbound = latest?.purchases ?? 0;
  const totalConsumption = latest?.etihadExpense ?? 0;
  const totalSales = recordSales(latest);
  // الاستهلاك + المبيعات = إجمالي الصرف لليوم، والفرق عن اليوم الذي قبله
  const totalOutflow = totalConsumption + totalSales;
  const prevOutflow = prev ? (prev.etihadExpense || 0) + recordSales(prev) : null;
  const outflowDiff = prevOutflow === null ? null : totalOutflow - prevOutflow;
  const weeklyFlow = React.useMemo(() => buildWeeklyFlow(records, latest?.date), [records, latest?.date]);
  // رسم الوارد والاستهلاك بنفس تصميم البنزين: مدة 7 / 14 / شهر، ومنحنى أو أعمدة، وإخفاء أي خط من المفتاح
  const [chartMode, setChartMode] = React.useState<'waves' | 'bars'>('bars');
  const [timeRange, setTimeRange] = React.useState<7 | 14 | 30>(7);
  const [showInbound, setShowInbound] = React.useState(true);
  const [showConsumption, setShowConsumption] = React.useState(true);
  // عمود اليوم المحدد (المرور عليه) بلونه الكامل وحلقة في أعلاه، والبقية فاتحة؛ بلا مرور = آخر يوم
  const [barHover, setBarHover] = React.useState<number | null>(null);
  const chartFlow = React.useMemo(() => buildWeeklyFlow(records, latest?.date, timeRange), [records, latest?.date, timeRange]);
  // متوسط الصرف اليومي للأسبوع (استهلاك + مبيعات) من الأيام التي فيها صرف مسجّل
  const weekOutDays = weeklyFlow.filter(w => w.consumption > 0);
  const weekAvgOutflow = weekOutDays.length ? weekOutDays.reduce((a, w) => a + w.consumption, 0) / weekOutDays.length : 0;
  // مجموع الأسبوع لخانتي الوارد والاستهلاك في كارت «يؤمن لغاية» (نفس أيام الرسم)
  const weekInbound = weeklyFlow.reduce((a, w) => a + w.inbound, 0);
  const weekOutflow = weeklyFlow.reduce((a, w) => a + w.consumption, 0);

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
      <SectionHeader updatedAt={latest?.date} title={t('dashboard:etihad.title')} icon={
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/20">
          <Building2 className="w-4 h-4 text-teal-100" />
        </div>
      } />

      {/* Main Strategic Card (7 Cols on xl) + Side Telemetry Charts (5 Cols on xl) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
        
        {/* Main Strategic Card (Mobile/Tablet 12 Cols, Desktop 7 Cols) */}
        <div className="col-span-1 md:col-span-12 xl:col-span-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between space-y-4 h-full overflow-hidden">
          
          {/* Header Row: Title & Average Price Pill — على الهاتف بنفس مقاسات الصحاري حتى يظهر كارت السعر كاملًا */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <span>{t('dashboard:etihad.totalBalance')}</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-[clamp(1.5rem,7.6vw,1.875rem)] sm:text-4xl lg:text-[36px] font-black font-mono tracking-tight text-slate-900 dark:text-white">
                  {formatNumber(etihadTotalBalance)}
                </span>
                <span className="text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400">{t('common:units.liter')}</span>
              </div>
            </div>

            {/* Average Price Pill with Modern Teal Glass & Glow */}
            {/* كارت السعر (نفس تصميم الصحاري): الرقم في المنتصف، وشريط سفلي ملوّن لنسبة التغير بعد آخر وارد */}
            <div className="min-w-[96px] rounded-xl overflow-hidden bg-gradient-to-br from-white to-teal-50/40 dark:from-slate-800/90 dark:to-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shrink-0 shadow-xs">
              <div className="px-2.5 pt-1.5 pb-1 text-center">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 block">{t('dashboard:price.average')}</span>
                <div className="mt-0.5 flex items-baseline justify-center gap-1">
                  <span className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-300 font-mono tracking-tight leading-none tabular-nums">
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
                    className={`px-2 py-1 border-t flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center ${tone}`}
                    title={`${t('dashboard:price.lastInboundAvg')}: ${priceChange.lastPrice.toFixed(1)} ${t('common:units.iqd')} · ${priceChange.lastDay}`}
                  >
                    {down && <TrendingDown className="w-3.5 h-3.5 shrink-0" />}
                    {up && <TrendingUp className="w-3.5 h-3.5 shrink-0" />}
                    <span dir="ltr" className="text-[10px] font-black font-mono tabular-nums leading-none">
                      {up ? '+' : down ? '−' : ''}{Math.abs(priceChange.pct).toFixed(2)}%
                    </span>
                    <span className="text-[9px] font-bold opacity-70 leading-tight">{t('dashboard:price.change')}</span>
                  </div>
                );
              })() : (
                <div className="px-2.5 py-1 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center gap-1">
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
                    <span className="truncate min-w-0"><span className="sm:hidden">{t('dashboard:capacity.currentPhone')}</span><span className="hidden sm:inline">{t('dashboard:capacity.current')}</span></span>
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


            </div>
          </div>

          {/* 3 Internal Metrics: الوارد - الاستهلاك - المبيعات */}
          {/* 3 Internal Metrics: الوارد - الاستهلاك - المبيعات */}
          <div className="kpi-wrap pt-3.5 border-t border-slate-100 dark:border-slate-800"><div className="kpi-grid kpi-grid-2 gap-3">
            
            {/* 1. الوارد */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="kpi-label">{t('dashboard:flow.dailyInbound')}</span>
                {/* القيمة مقابل العنوان في كل المقاسات */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="kpi-num font-black text-slate-900 dark:text-white font-mono">
                    {formatNumber(totalInbound)} <span className="text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40 shrink-0">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
              {latest ? (() => {
                // شراء اليوم ونسبة التغير (معدل اليومين مقارنة بسعر اليوم السابق) — نفس كارت الصحاري
                const pct = buys.pct !== null && Math.abs(buys.pct) < 0.005 ? 0 : buys.pct;
                const tone = pct === null || pct === 0 ? 'text-slate-500' : pct > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
                return (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg ring-1 min-w-0 bg-white dark:bg-slate-900/70 ring-slate-200 dark:ring-slate-700 px-1.5 py-1 text-center" title={`${t('dashboard:price.buyAvg')} · ${latest.date}`}>
                      <div className="text-[9px] font-bold leading-tight text-slate-400">{t('dashboard:price.buyPrice')}</div>
                      <div className="mt-0.5 font-mono font-black kpi-sub tabular-nums text-slate-700 dark:text-slate-200">
                        {(buys.today?.price ?? 0).toFixed(1)}<span className="text-[8.5px] font-bold text-slate-400"> {t('common:units.iqd')}</span>
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

            {/* 2. فرق الاستهلاك الفعلي بين أمس واليوم (الاستهلاك + المبيعات) */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-colors min-w-0">
              <div className="flex items-center justify-between gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="kpi-label">{t('dashboard:flow.actualDiffShort')}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {/* الفرق مقابل العنوان في كل المقاسات */}
                  {outflowDiff === null ? (
                    <div className="kpi-num font-black text-slate-400 font-mono">—</div>
                  ) : (
                    <div className={`kpi-num font-black font-mono ${outflowDiff > 0 ? 'text-rose-600 dark:text-rose-400' : outflowDiff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                      <span dir="ltr">{outflowDiff > 0 ? '▲ +' : outflowDiff < 0 ? '▼ −' : ''}{formatNumber(Math.abs(outflowDiff))}</span>{' '}
                      <span className="text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
                    </div>
                  )}
                  <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200/60 dark:border-teal-800/40 shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
              {outflowDiff === null ? (
                <>
                  <div className="hidden kpi-num font-black text-slate-400 font-mono">—</div>
                  <span className="text-[10px] text-slate-400 mt-1 block">{t('dashboard:compare.noPrevDay')}</span>
                </>
              ) : (
                <>
                  <div className={`hidden kpi-num font-black font-mono ${outflowDiff > 0 ? 'text-rose-600 dark:text-rose-400' : outflowDiff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
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
        <div className="col-span-1 md:col-span-12 xl:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
          
          {/* Card 3: يؤمن لغاية بارتفاع قليل: شريط علوي فيه الأيام (كبيرة) وتاريخ الاستحقاق، وتحته سطر الوارد والاستهلاك ومتوسط الاستهلاك الأسبوعي (أعلى الرسم) */}
          <div className="sm:col-span-2 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card hover:shadow-soft-hover transition-all overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 bg-teal-50/70 dark:bg-teal-950/30 border-b border-teal-100 dark:border-teal-900/50">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                {t('dashboard:coverage.until')} <span className="text-teal-600 dark:text-teal-400 font-mono">{coverageDays === null ? '—' : `${t('common:units.days', { count: coverageDays })}`}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('dashboard:coverage.dueDate')} <strong className="font-mono text-slate-700 dark:text-slate-200">{coverageDate}</strong>
              </p>
            </div>
            {/* أرقام الأسبوع في ثلاث خانات: العنوان كاملًا فوق، والرقم كبيرًا تحته، وفي الأسفل مؤشر:
               شريطا الوارد والاستهلاك بنسبة كل منهما للأكبر (يُقارنان بنظرة)، والمتوسط بنسبة اليوم إليه */}
            <div className="grid grid-cols-3 divide-x rtl:divide-x-reverse divide-slate-100 dark:divide-slate-800">
              {[
                { key: 'in', label: t('dashboard:etihad.weeklyInbound'), value: weekInbound, dot: 'bg-emerald-500', num: 'text-emerald-700 dark:text-emerald-300', bar: 'from-emerald-400 to-emerald-600' },
                { key: 'out', label: t('dashboard:etihad.weeklyConsumption'), value: weekOutflow, dot: 'bg-blue-500', num: 'text-blue-700 dark:text-blue-300', bar: 'from-blue-400 to-blue-600' },
              ].map(c => (
                <div key={c.key} className="px-3 sm:px-3.5 py-1.5 flex flex-col gap-1 min-w-0">
                  <span className="flex items-start gap-1.5 text-[10.5px] font-bold leading-tight text-slate-500 dark:text-slate-400">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />{c.label}
                  </span>
                  <span className={`font-mono font-black text-[15px] sm:text-base leading-none tabular-nums ${c.num}`}>
                    {formatNumber(c.value)} <span className="text-[9.5px] font-bold text-slate-400">{t('common:units.liter')}</span>
                  </span>
                  <span className="mt-auto h-[3px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <span className={`block h-full rounded-full bg-gradient-to-l ltr:bg-gradient-to-r ${c.bar}`} style={{ width: `${Math.max(weekInbound, weekOutflow) ? Math.round((c.value / Math.max(weekInbound, weekOutflow)) * 100) : 0}%` }} />
                  </span>
                </div>
              ))}
              <div className="px-3 sm:px-3.5 py-1.5 flex flex-col gap-1 min-w-0 bg-teal-50/50 dark:bg-teal-950/20">
                <span className="text-[10.5px] font-bold leading-tight text-teal-700 dark:text-teal-300">{t('dashboard:sahara.weekAvg')}</span>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <span className="font-mono font-black text-[15px] sm:text-base leading-none tabular-nums text-slate-900 dark:text-white">
                    {weekAvgOutflow > 0 ? formatNumber(Math.round(weekAvgOutflow)) : '—'} <span className="text-[9.5px] font-bold text-slate-400">{t('common:units.liter')}</span>
                  </span>
                  {weekAvgOutflow > 0 && totalOutflow > 0 && (() => {
                    const pct = ((totalOutflow - weekAvgOutflow) / weekAvgOutflow) * 100;
                    const up = pct > 0.05, down = pct < -0.05;
                    return (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-px text-[10px] font-black ${up ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : down ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                        <span className="font-bold opacity-75">{t('dashboard:sahara.today')}</span>
                        <span dir="ltr" className="inline-flex items-center gap-0.5">
                          {up ? <TrendingUp className="w-3 h-3" /> : down ? <TrendingDown className="w-3 h-3" /> : null}
                          {up ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* الرسم داخل كارت «يؤمن لغاية» بنفس تصميم رسم البنزين وبألوان الاتحاد (أخضر للوارد، أزرق للاستهلاك) */}
            <div className="relative flex-1 px-3 pt-2.5 pb-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              {/* سطر واحد: العنوان يمينًا، ومبدّل المنحنى/الأعمدة والمدة يسارًا */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-[13px] min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-600 to-blue-500 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <span className="leading-snug">{t('dashboard:etihad.weeklyFlow')}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                    {([['waves', Waves, 'dashboard:petrol.neon'], ['bars', BarChart3, 'dashboard:petrol.bars']] as const).map(([m, Icon, key]) => {
                      const on = chartMode === m;
                      return (
                        <button key={m} onClick={() => setChartMode(m)} title={t(key)} aria-label={t(key)} aria-pressed={on} className={`p-1 rounded-lg transition-all ${on ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/50 text-[10px] font-black">
                    {([[7, 'dashboard:range.d7'], [14, 'dashboard:range.d14'], [30, 'dashboard:range.monthly']] as const).map(([n, key]) => {
                      const on = timeRange === n;
                      return <button key={n} onClick={() => setTimeRange(n)} className={`px-2 py-0.5 rounded-lg transition-all ${on ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{t(key)}</button>;
                    })}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[140px] w-full relative overflow-hidden" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'waves' ? (
                    <AreaChart data={chartFlow} margin={{ top: 14, right: 10, left: -14, bottom: 2 }}>
                      <defs>
                        <filter id="etGlowIn" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#10b981" floodOpacity="0.45" />
                        </filter>
                        <filter id="etGlowOut" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#3b82f6" floodOpacity="0.45" />
                        </filter>
                        <linearGradient id="etStrokeIn" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="35%" stopColor="#14b8a6" />
                          <stop offset="70%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                        <linearGradient id="etStrokeOut" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="35%" stopColor="#2563eb" />
                          <stop offset="70%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                        <linearGradient id="etAreaIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.28} />
                          <stop offset="30%" stopColor="#10b981" stopOpacity={0.14} />
                          <stop offset="75%" stopColor="#10b981" stopOpacity={0.03} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="etAreaOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} />
                          <stop offset="30%" stopColor="#3b82f6" stopOpacity={0.1} />
                          <stop offset="75%" stopColor="#60a5fa" stopOpacity={0.02} />
                          <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#94a3b8" strokeOpacity={0.12} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} interval={timeRange === 30 ? 4 : timeRange === 14 ? 1 : 0} tick={{ fill: '#64748b', fontSize: 10.5, fontWeight: 700 }} dy={6} tickFormatter={(val) => enumText(val, 'short')} />
                      <YAxis axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.1))]} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }} tickFormatter={compactAxis} />
                      <Tooltip content={<FlowTooltip />} cursor={{ stroke: '#14b8a6', strokeWidth: 1.5, strokeDasharray: '3 3', strokeOpacity: 0.85 }} wrapperStyle={{ pointerEvents: 'none', zIndex: 100 }} isAnimationActive={false} />
                      {showInbound && <Area type="monotone" dataKey="inbound" name={t('dashboard:flow.inbound')} stroke="url(#etStrokeIn)" strokeWidth={3} fillOpacity={1} fill="url(#etAreaIn)" filter="url(#etGlowIn)" activeDot={{ r: 6.5, stroke: '#10b981', strokeWidth: 3, fill: '#ffffff' }} />}
                      {showConsumption && <Area type="monotone" dataKey="consumption" name={t('dashboard:flow.consumption')} stroke="url(#etStrokeOut)" strokeWidth={3} fillOpacity={1} fill="url(#etAreaOut)" filter="url(#etGlowOut)" activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 3, fill: '#ffffff' }} />}
                    </AreaChart>
                  ) : (
                    <BarChart data={chartFlow} margin={{ top: 14, right: 10, left: -14, bottom: 2 }} barGap={3} barCategoryGap="22%"
                      onMouseMove={(st: { activeTooltipIndex?: number | string | null }) => setBarHover(st?.activeTooltipIndex != null ? Number(st.activeTooltipIndex) : null)}
                      onMouseLeave={() => setBarHover(null)}>
                      <defs>
                        {/* المحدد: لون كامل؛ البقية: فاتح يتلاشى للأسفل (نمط رسم الأشهر في مزارع الموقع) */}
                        <linearGradient id="etBarInOn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#10b981" stopOpacity={0.7} /></linearGradient>
                        <linearGradient id="etBarInOff" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.07} /></linearGradient>
                        <linearGradient id="etBarOutOn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} /></linearGradient>
                        <linearGradient id="etBarOutOff" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.06} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#94a3b8" strokeOpacity={0.14} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} interval={timeRange === 30 ? 4 : timeRange === 14 ? 1 : 0} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={6} tickFormatter={(val) => enumText(val, 'short')} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickFormatter={compactAxis} />
                      <Tooltip content={<FlowTooltip />} cursor={false} wrapperStyle={{ pointerEvents: 'none', zIndex: 100 }} isAnimationActive={false} />
                      {(['inbound', 'consumption'] as const).filter(k => (k === 'inbound' ? showInbound : showConsumption)).map(k => {
                        const on = barHover ?? chartFlow.length - 1;
                        const color = k === 'inbound' ? '#10b981' : '#3b82f6';
                        const id = k === 'inbound' ? 'etBarIn' : 'etBarOut';
                        return (
                          <Bar key={k} dataKey={k} name={t(k === 'inbound' ? 'dashboard:flow.inbound' : 'dashboard:flow.consumption')} radius={[6, 6, 6, 6]} maxBarSize={timeRange === 7 ? 22 : 14} isAnimationActive={false}
                            label={({ x, y, width, index }: { x?: number | string; y?: number | string; width?: number | string; index?: number }) =>
                              index === on && chartFlow[on]?.[k] > 0
                                ? <circle cx={Number(x) + Number(width) / 2} cy={Number(y)} r={4} fill="#fff" stroke={color} strokeWidth={2.5} />
                                : <g />}>
                            {chartFlow.map((_, i) => <Cell key={i} fill={`url(#${id}${i === on ? 'On' : 'Off'})`} />)}
                          </Bar>
                        );
                      })}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* مفتاح تفاعلي: الضغط يُظهر أو يُخفي الخط */}
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowInbound(!showInbound)} title={t('dashboard:petrol.toggleInbound')} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-bold transition-all ${showInbound ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 shadow-2xs' : 'opacity-40 line-through bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'}`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" /><span>{t('dashboard:petrol.inboundLegend')}</span>
                  </button>
                  <button onClick={() => setShowConsumption(!showConsumption)} title={t('dashboard:petrol.toggleConsumption')} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-bold transition-all ${showConsumption ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/60 shadow-2xs' : 'opacity-40 line-through bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'}`}>
                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" /><span>{t('dashboard:petrol.consumptionLegend')}</span>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-[10px]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-mono">SCADA Live Sync</span>
                </div>
              </div>
            </div>
          </div>


        </div>

      </div>

    </div>
  );
};
