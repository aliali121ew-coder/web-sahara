import React from 'react';
import { SectionHeader } from './SectionHeader';
import {
  Droplets,
  ArrowDownLeft,
  Activity,
  Sparkles,
  Calendar,
  Database,
  ShieldCheck,
  Boxes
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useBlackOilLedger, BLACK_OIL_SECTION_KEYS } from '../../lib/blackOilLedger';
import { useCentralTanks, tankLiters } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';
import { getBusinessDate } from '../../lib/utils';
import i18n from '../../i18n';

/** نسبة تغيّر صغيرة عن اليوم السابق (سهم + نسبة). upIsGood: الزيادة إيجابية (الوارد) أو سلبية (الاستهلاك) */
const ChangeBadge: React.FC<{ cur: number; prev: number | null | undefined; upIsGood: boolean; title: string }> = ({ cur, prev, upIsGood, title }) => {
  if (prev === null || prev === undefined)
    return (
      <span title={i18n.t('dashboard:compare.noPrevDay')} className="inline-flex items-center px-1 py-px rounded-md text-[9px] font-black leading-none bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">—</span>
    );
  const pct = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
  const up = pct > 0.05, down = pct < -0.05;
  const good = (up && upIsGood) || (down && !upIsGood);
  const color = !up && !down
    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    : good
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
  return (
    <span dir="ltr" title={title} className={`inline-flex items-center px-1 py-px rounded-md text-[9px] font-black font-mono leading-none whitespace-nowrap ${color}`}>
      {up ? '▲' : down ? '▼' : '•'}{Math.abs(pct) >= 1000 ? '999+' : Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
    </span>
  );
};

/**
 * كارت صغير موحّد (نفس كروت أقسام الكاز والبنزين): العنوان kpi-label وأيقونة في مربع بالطرف المقابل،
 * والرقم kpi-num تحته بخط Inter؛ داخل kpi-wrap يتكيف حجمه مع عرض الكارت فلا يُقصّ الرقم.
 */
const MiniStat: React.FC<{
  label: string; value: React.ReactNode; unit: React.ReactNode; icon?: React.ReactNode; badge?: React.ReactNode;
  box: string; iconBox?: string; labelTone?: string; numTone?: string; unitTone?: string;
}> = ({ label, value, unit, icon, badge, box, iconBox, labelTone = 'text-slate-500 dark:text-slate-400', numTone = 'text-slate-900 dark:text-white', unitTone = 'text-slate-400' }) => (
  <div className={`p-2.5 sm:p-3 rounded-2xl border flex flex-col justify-between min-w-0 ${box}`}>
    <div className="flex items-center justify-between gap-1.5 mb-1">
      <span className={`kpi-label ${labelTone}`}>{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        {badge}
        {icon && <div className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 ${iconBox}`}>{icon}</div>}
      </div>
    </div>
    <div className={`kpi-num font-black font-mono ${numTone}`}>
      {value} <span className={`text-[8.5px] font-normal ${unitTone}`}>{unit}</span>
    </div>
  </div>
);

export const BlackOilSection: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  // 1. Sahara Data: من السجل اليومي لنفط الصحاري الأسود وخزانات قسمه في منظومة الخزانات
  const saharaLedger = useBlackOilLedger('sahara');
  const [centralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const saharaTanks = centralTanks.filter(t => t.sectionKey === BLACK_OIL_SECTION_KEYS.sahara);
  const saharaCapacity = saharaTanks.reduce((a, t) => a + t.capacityLiters, 0);
  // بلا سجل يومي بعد: الرصيد من مناسيب الخزانات
  const saharaTotalBalance = saharaLedger.latest ? saharaLedger.balance : saharaTanks.reduce((a, t) => a + tankLiters(t), 0);
  const saharaRemainingCapacity = Math.max(0, saharaCapacity - saharaTotalBalance);
  const saharaInbound = saharaLedger.latest?.inbound ?? 0;
  const saharaOutbound = saharaLedger.latest?.consumption ?? 0;
  // اليوم السابق في السجل (لنسبة التغيّر بجانب الوارد والاستهلاك)
  const saharaPrevDay = saharaLedger.computed.length > 1 ? saharaLedger.computed[saharaLedger.computed.length - 2] : null;
  const saharaCoverageDays = saharaLedger.avgDaily > 0 ? Math.floor(saharaTotalBalance / saharaLedger.avgDaily) : 0;
  const saharaCoverageDate = (() => {
    const d = saharaLedger.latest ? new Date(saharaLedger.latest.date.replace(/\//g, '-') + 'T12:00:00') : new Date();
    d.setDate(d.getDate() + saharaCoverageDays);
    return getBusinessDate(d);
  })();
  const saharaFill = saharaCapacity ? Math.round((saharaTotalBalance / saharaCapacity) * 100) : 0;

  // 2. Etihad Data: من السجل اليومي لنفط الاتحاد الأسود (الريان + السكر) وخزانات قسمه في منظومة الخزانات
  const etihadLedger = useBlackOilLedger('etihad');
  const etihadTanks = centralTanks.filter(t => t.sectionKey === BLACK_OIL_SECTION_KEYS.etihad);
  const etihadCapacity = etihadTanks.reduce((a, t) => a + t.capacityLiters, 0);
  // بلا سجل يومي بعد: الرصيد من مناسيب الخزانات
  const etihadTotalBalance = etihadLedger.latest ? etihadLedger.balance : etihadTanks.reduce((a, t) => a + tankLiters(t), 0);
  const etihadRemainingCapacity = Math.max(0, etihadCapacity - etihadTotalBalance);
  const etihadInbound = etihadLedger.latest?.inbound ?? 0;
  const etihadOutbound = etihadLedger.latest?.consumption ?? 0;
  const etihadPrevDay = etihadLedger.computed.length > 1 ? etihadLedger.computed[etihadLedger.computed.length - 2] : null;
  const etihadCoverageDays = etihadLedger.avgDaily > 0 ? Math.floor(etihadTotalBalance / etihadLedger.avgDaily) : 0;
  const etihadCoverageDate = (() => {
    const d = etihadLedger.latest ? new Date(etihadLedger.latest.date.replace(/\//g, '-') + 'T12:00:00') : new Date();
    d.setDate(d.getDate() + etihadCoverageDays);
    return getBusinessDate(d);
  })();
  const etihadFill = etihadCapacity ? Math.round((etihadTotalBalance / etihadCapacity) * 100) : 0;

  // 3. Consolidated Grand Total Data (المخزون الاستراتيجي المشترك)
  const totalCapacity = saharaCapacity + etihadCapacity;
  const grandTotalBalance = saharaTotalBalance + etihadTotalBalance;
  const grandTotalInbound = saharaInbound + etihadInbound;
  const grandTotalOutbound = saharaOutbound + etihadOutbound;
  // أيام التغطية المشتركة = الرصيد الكلي ÷ مجموع الاستهلاك اليومي للشركتين
  const combinedDaily = saharaLedger.avgDaily + etihadLedger.avgDaily;
  const grandTotalDays = combinedDaily > 0 ? Math.floor(grandTotalBalance / combinedDaily) : 0;
  const grandTotalCoverageDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + grandTotalDays);
    return getBusinessDate(d);
  })();
  const grandTotalFill = totalCapacity ? Math.round((grandTotalBalance / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-4">
      
      {/* Section Header */}
      <SectionHeader title={t('dashboard:blackOil.details')} icon={
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-slate-900 text-white shadow-md shadow-purple-500/20">
          <Droplets className="w-4 h-4 text-purple-200" />
        </div>
      } />

      {/* Grid: 2 Spacious Main Cards (Sahara 5/12 + Etihad 4/12) + 1 Compact Luxury Executive Card (3/12) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-stretch">
        
        {/* ========================================================================= */}
        {/* CARD 1: Sahara Black Oil (5 Cols - صحاري كربلاء) - Light Luminous Sky Cyan */}
        {/* ========================================================================= */}
        <div className="xl:col-span-5 rounded-[26px] bg-gradient-to-b from-sky-500/[0.04] via-white to-cyan-50/40 dark:from-sky-950/20 dark:via-slate-900 dark:to-slate-900/90 border border-sky-200/80 dark:border-sky-800/40 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-xl hover:border-sky-400/80 dark:hover:border-sky-500/60 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden group">
          
          {/* Top Ambient Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 dark:bg-sky-500/10 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />

          {/* Top Header Block */}
          <div className="space-y-3 relative z-10">
            <div className="flex items-start justify-between gap-2.5">
              
              {/* Avatar + Title */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/25 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-108 group-hover:rotate-3">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {t('dashboard:blackOil.sahara')}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-medium text-slate-400">{t('dashboard:capacity.totalColon')}</span>
                    <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300">{formatNumber(saharaCapacity)} {t('common:units.liter')}</span>
                  </div>
                </div>
              </div>

              {/* Coverage Forecast Badge (يؤمن) */}
              <div className="shrink-0 text-right">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/60 shadow-2xs">
                  <Calendar className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="text-[11px] font-black font-mono text-sky-700 dark:text-sky-300 whitespace-nowrap">
                    {t('dashboard:coverage.covers')} {t('common:units.days', { count: saharaCoverageDays })}
                  </span>
                </div>
                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block text-left font-mono mt-0.5 pr-1">
                  ({saharaCoverageDate})
                </span>
              </div>

            </div>

            {/* Actual Balance Big Display */}
            <div className="pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                {t('dashboard:balance.actualCurrent')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl lg:text-[36px] font-black font-mono text-slate-900 dark:text-white tracking-tight leading-none">
                  {formatNumber(saharaTotalBalance)}
                </span>
                <span className="text-sm font-black text-sky-600 dark:text-sky-400">
                  {t('common:units.liter')}
                </span>
              </div>
            </div>
          </div>

          {/* Middle: Tactical Storage Allocation Gauge Card */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 shadow-xs space-y-3 relative z-10">
            
            {/* Allocation Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {t('dashboard:capacity.title')}
                </span>
              </div>
              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 whitespace-nowrap">
                {saharaFill}% {t('dashboard:capacity.fill')}
              </span>
            </div>

            {/* Multi-tier Progress Bar */}
            <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-700/70 rounded-full overflow-hidden p-0.5 ring-1 ring-slate-200/50 dark:ring-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${saharaFill}%` }}
              />
            </div>

            {/* Dual Data Metric Breakdown */}
            <div className="kpi-wrap pt-0.5"><div className="kpi-grid kpi-grid-2 gap-2">
              <MiniStat label={t('dashboard:balance.actual')} value={formatNumber(saharaTotalBalance)} unit={<>{t('common:units.liter')} ({saharaFill}%)</>}
                box="bg-sky-50/60 dark:bg-sky-950/30 border-sky-200/60 dark:border-sky-900/40" numTone="text-sky-900 dark:text-sky-200" />
              <MiniStat label={t('dashboard:capacity.remainingOfCapacity')} value={formatNumber(saharaRemainingCapacity)} unit={t('common:units.liter')}
                box="bg-slate-100/90 dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80" />
            </div></div>

          </div>

          {/* Bottom Operational Stats: Inbound / Outbound */}
          <div className="kpi-wrap pt-2 border-t border-slate-200/60 dark:border-slate-800 relative z-10"><div className="kpi-grid kpi-grid-2 gap-2.5">
            <MiniStat label={t('dashboard:flow.totalInbound')} value={formatNumber(saharaInbound)} unit={t('common:units.liter')}
              box="bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/50"
              icon={<ArrowDownLeft className="w-3 h-3" />} iconBox="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40"
              badge={<ChangeBadge cur={saharaInbound} prev={saharaPrevDay?.inbound} upIsGood title={`${t('dashboard:compare.prevDay')} (${saharaPrevDay?.date ?? ''}): ${formatNumber(saharaPrevDay?.inbound ?? 0)}`} />} />
            <MiniStat label={t('dashboard:flow.daily')} value={formatNumber(saharaOutbound)} unit={t('common:units.liter')}
              box="bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/50"
              icon={<Activity className="w-3 h-3" />} iconBox="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/40"
              badge={<ChangeBadge cur={saharaOutbound} prev={saharaPrevDay?.consumption} upIsGood={false} title={`${t('dashboard:compare.prevDay')} (${saharaPrevDay?.date ?? ''}): ${formatNumber(saharaPrevDay?.consumption ?? 0)}`} />} />
          </div></div>


        </div>


        {/* ========================================================================= */}
        {/* CARD 2: Etihad Black Oil (4 Cols - شركة الاتحاد) */}
        {/* ========================================================================= */}
        <div className="xl:col-span-4 rounded-[26px] bg-gradient-to-b from-teal-500/[0.04] via-white to-slate-50/50 dark:from-teal-950/20 dark:via-slate-900 dark:to-slate-900/90 border border-teal-200/80 dark:border-teal-900/40 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-xl hover:border-teal-400/80 dark:hover:border-teal-500/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden group">
          
          {/* Top Ambient Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-400/10 dark:bg-teal-500/10 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />

          {/* Top Header Block */}
          <div className="space-y-3 relative z-10">
            <div className="flex items-start justify-between gap-2">
              
              {/* Avatar + Title */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white shadow-md shadow-teal-500/25 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-108 group-hover:rotate-3">
                  <Database className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {t('dashboard:blackOil.etihad')}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-medium text-slate-400">{t('dashboard:capacity.totalColon')}</span>
                    <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300">{formatNumber(etihadCapacity)} {t('common:units.liter')}</span>
                  </div>
                </div>
              </div>

              {/* Coverage Forecast Badge (يؤمن) */}
              <div className="shrink-0 text-right">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 shadow-2xs">
                  <Calendar className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-[11px] font-black font-mono text-teal-700 dark:text-teal-300 whitespace-nowrap">
                    {t('dashboard:coverage.covers')} {t('common:units.days', { count: etihadCoverageDays })}
                  </span>
                </div>
                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block text-left font-mono mt-0.5 pr-1">
                  ({etihadCoverageDate})
                </span>
              </div>

            </div>

            {/* Actual Balance Big Display */}
            <div className="pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                {t('dashboard:balance.actualCurrent')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl lg:text-[36px] font-black font-mono text-slate-900 dark:text-white tracking-tight leading-none">
                  {formatNumber(etihadTotalBalance)}
                </span>
                <span className="text-sm font-black text-teal-600 dark:text-teal-400">
                  {t('common:units.liter')}
                </span>
              </div>
            </div>
          </div>

          {/* Middle: Tactical Storage Allocation Gauge Card */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 shadow-xs space-y-3 relative z-10">
            
            {/* Allocation Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {t('dashboard:capacity.title')}
                </span>
              </div>
              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 whitespace-nowrap">
                {etihadFill}% {t('dashboard:capacity.fill')}
              </span>
            </div>

            {/* Multi-tier Progress Bar */}
            <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-700/70 rounded-full overflow-hidden p-0.5 ring-1 ring-slate-200/50 dark:ring-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400 rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${etihadFill}%` }}
              />
            </div>

            {/* Dual Data Metric Breakdown */}
            <div className="kpi-wrap pt-0.5"><div className="kpi-grid kpi-grid-2 gap-2">
              <MiniStat label={t('dashboard:balance.actual')} value={formatNumber(etihadTotalBalance)} unit={<>{t('common:units.liter')} ({etihadFill}%)</>}
                box="bg-teal-50/60 dark:bg-teal-950/30 border-teal-200/60 dark:border-teal-900/40" numTone="text-teal-900 dark:text-teal-200" />
              <MiniStat label={t('dashboard:capacity.remainingOfCapacity')} value={formatNumber(etihadRemainingCapacity)} unit={t('common:units.liter')}
                box="bg-slate-100/90 dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80" />
            </div></div>

          </div>

          {/* Bottom Operational Stats: Inbound / Outbound */}
          <div className="kpi-wrap pt-2 border-t border-slate-200/60 dark:border-slate-800 relative z-10"><div className="kpi-grid kpi-grid-2 gap-2.5">
            <MiniStat label={t('dashboard:flow.totalInbound')} value={formatNumber(etihadInbound)} unit={t('common:units.liter')}
              box="bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/50"
              icon={<ArrowDownLeft className="w-3 h-3" />} iconBox="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40"
              badge={<ChangeBadge cur={etihadInbound} prev={etihadPrevDay?.inbound} upIsGood title={`${t('dashboard:compare.prevDay')} (${etihadPrevDay?.date ?? ''}): ${formatNumber(etihadPrevDay?.inbound ?? 0)}`} />} />
            <MiniStat label={t('dashboard:flow.daily')} value={formatNumber(etihadOutbound)} unit={t('common:units.liter')}
              box="bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/50"
              icon={<Activity className="w-3 h-3" />} iconBox="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/40"
              badge={<ChangeBadge cur={etihadOutbound} prev={etihadPrevDay?.consumption} upIsGood={false} title={`${t('dashboard:compare.prevDay')} (${etihadPrevDay?.date ?? ''}): ${formatNumber(etihadPrevDay?.consumption ?? 0)}`} />} />
          </div></div>

        </div>


        {/* ========================================================================= */}
        {/* CARD 3: Consolidated Strategic Master Widget (3 Cols - الماستر المجمع المضغوط الفاخر) */}
        {/* ========================================================================= */}
        <div className="xl:col-span-3 md:col-span-2 xl:col-span-3 rounded-[26px] bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 text-white border border-purple-500/30 p-5 sm:p-6 shadow-xl shadow-purple-950/20 hover:shadow-2xl hover:border-purple-400/50 transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden group">
          
          {/* Ambient Glow in Background */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/20 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none -ml-8 -mb-8" />

          {/* Header Row */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/30 text-purple-200 border border-purple-400/30 flex items-center justify-center shrink-0 shadow-inner">
                <Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />
              </div>
              <div>
                <h4 className="font-black text-base sm:text-lg lg:text-xl text-white leading-tight tracking-tight drop-shadow-sm">
                  {t('dashboard:balance.total')}
                </h4>
                <span className="text-[10px] text-purple-300/80 font-medium block mt-0.5">
                  {t('dashboard:blackOil.both')}
                </span>
              </div>
            </div>

            <span className="text-xs font-black font-mono px-2.5 py-1 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-inner">
              {grandTotalFill}%
            </span>
          </div>

          {/* Grand Total Value */}
          <div className="space-y-1 relative z-10">
            <span className="text-[11px] font-extrabold text-purple-200/80 uppercase tracking-wider block">
              {t('dashboard:blackOil.combinedBalance')}
            </span>
            <div className="text-2xl sm:text-3xl lg:text-[40px] font-black font-mono text-white tracking-tight leading-none flex items-baseline gap-2 drop-shadow-md">
              {formatNumber(grandTotalBalance)}
              <span className="text-sm sm:text-base font-bold text-purple-300">{t('common:units.liter')}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-purple-300/70 font-medium">{t('dashboard:capacity.grandTotalColon')}</span>
              <span className="text-[11px] font-mono font-bold text-purple-200">{formatNumber(totalCapacity)} {t('common:units.liter')}</span>
            </div>
          </div>

          {/* Middle: Twin KPI Badges - الوارد الكلي + الاستهلاك الكلي (نفس الكارت الصغير الموحّد بألوان داكنة) */}
          <div className="kpi-wrap relative z-10"><div className="kpi-grid kpi-grid-2 gap-2">
            <MiniStat label={t('dashboard:flow.totalInboundAll')} value={formatNumber(grandTotalInbound)} unit={t('common:units.liter')}
              box="bg-white/10 dark:bg-white/5 border-white/10" labelTone="text-emerald-300" numTone="text-white" unitTone="text-emerald-200/70"
              icon={<ArrowDownLeft className="w-3 h-3" />} iconBox="bg-emerald-400/15 text-emerald-300 border-emerald-300/30" />
            <MiniStat label={t('dashboard:flow.totalConsumption')} value={formatNumber(grandTotalOutbound)} unit={t('common:units.liter')}
              box="bg-white/10 dark:bg-white/5 border-white/10" labelTone="text-cyan-300" numTone="text-white" unitTone="text-cyan-200/70"
              icon={<Activity className="w-3 h-3" />} iconBox="bg-cyan-400/15 text-cyan-300 border-cyan-300/30" />
          </div></div>

          {/* Frosted Glass Coverage Block (يؤمن لغاية) */}
          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/15 shadow-inner relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-base font-black text-white leading-tight font-cairo flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-300" />
                <span>{t('dashboard:coverage.until')}</span>
                <span className="text-purple-300 font-mono font-black">{t('common:units.days', { count: grandTotalDays })}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-400/20 text-purple-200 border border-purple-300/30">
                {t('dashboard:coverage.secured')}
              </span>
            </div>
            <p className="text-[11px] text-purple-200/80 font-medium">
              {t('dashboard:coverage.dueDate')} <strong className="font-mono text-white">{grandTotalCoverageDate}</strong>
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
