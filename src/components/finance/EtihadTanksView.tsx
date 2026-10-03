import React, { useState, useMemo, useCallback } from 'react';
import { useSessionState } from '../../lib/useSessionState';
import {
  Droplets,
  Fuel,
  TrendingDown,
  Calendar,
  Sparkles,
  BarChart3,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { Tank3DCard, CalculatedTankUnit } from '../tanks/Tank3DCard';
import { TankGlobalSvgDefs } from '../tanks/TankGlobalSvgDefs';
import { TankUnitRow, getFillLevelTheme, OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';
import { useCentralTanks, resolveGasoilSectionKey, resolveSaharaGasoilSectionKey } from '../../lib/centralTanks';
import { BLACK_OIL_SECTION_KEYS } from '../../lib/blackOilLedger';
import { Breadcrumb } from '../navigation/Breadcrumb';



// ── Weekly Chart Presets for the 2 Core Sections ──
const BLACK_OIL_CHART = [
  { dayName: 'السبت', date: '09/04', balance: 44900000, inflow: 1100000, outflow: 480000 },
  { dayName: 'الأحد', date: '09/05', balance: 45100000, inflow: 720000, outflow: 520000 },
  { dayName: 'الإثنين', date: '09/06', balance: 45350000, inflow: 800000, outflow: 550000 },
  { dayName: 'الثلاثاء', date: '09/07', balance: 45420000, inflow: 600000, outflow: 530000 },
  { dayName: 'الأربعاء', date: '09/08', balance: 45480000, inflow: 580000, outflow: 520000 },
  { dayName: 'الخميس', date: '09/09', balance: 45390000, inflow: 420000, outflow: 510000 },
  { dayName: 'اليوم', date: '09/10', balance: 45455400, inflow: 570000, outflow: 504600 },
];

const GASOIL_CHART = [
  { dayName: 'السبت', date: '09/04', balance: 18780000, inflow: 500000, outflow: 130000 },
  { dayName: 'الأحد', date: '09/05', balance: 18905000, inflow: 295000, outflow: 170000 },
  { dayName: 'الإثنين', date: '09/06', balance: 18990000, inflow: 280000, outflow: 195000 },
  { dayName: 'الثلاثاء', date: '09/07', balance: 19075000, inflow: 255000, outflow: 170000 },
  { dayName: 'الأربعاء', date: '09/08', balance: 19140000, inflow: 225000, outflow: 160000 },
  { dayName: 'الخميس', date: '09/09', balance: 19170000, inflow: 190000, outflow: 160000 },
  { dayName: 'اليوم', date: '09/10', balance: 19150000, inflow: 170000, outflow: 190000 },
];

interface SectionConfig {
  key: 'etihad-black-oil' | 'strategic-gasoil';
  title: string;
  shortTitle: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  headerGrad: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dailyBurnRate: number; // L/day
  coverageDays: number;
  coverageDate: string;
  chartData: typeof BLACK_OIL_CHART;
}

interface EtihadTanksViewProps {
  onBack?: () => void;
  /** الشركة: الاتحاد أو الصحاري (نفس التصميم، ولكل شركة أقسامها في منظومة الخزانات) */
  company?: 'etihad' | 'sahara';
}

export const EtihadTanksView: React.FC<EtihadTanksViewProps> = ({ onBack, company = 'etihad' }) => {
  const { tr } = useLanguage();
  const isSahara = company === 'sahara';

  // ── كل خزانات هذه الصفحة تُقرأ من منظومة الخزانات (المرجع المركزي) وتُكتب فيها ──
  // النفط الأسود: قسم "عمليات الاتحاد - النفط الأسود"
  // الكاز والديزل: قسم كاز شركة الاتحاد (محفوظ بمعرّفه الثابت)
  const [centralTanks, setCentralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);

  const tankUnits: TankUnitRow[] = useMemo(() => {
    // الصحاري: قسم "النفط الأسود - شركة صحاري كربلاء" وقسم "خزانات الكاز - شركة صحاري كربلاء"
    const gasoilKey = isSahara ? resolveSaharaGasoilSectionKey(centralTanks) : resolveGasoilSectionKey(centralTanks);
    const blackOil = centralTanks
      .filter(t => t.sectionKey === BLACK_OIL_SECTION_KEYS[company])
      .map(t => ({ ...t, sectionKey: 'etihad-black-oil' }));
    const gasoil = centralTanks
      .filter(t => gasoilKey !== null && t.sectionKey === gasoilKey)
      .map(t => ({ ...t, sectionKey: 'strategic-gasoil' }));
    return [...blackOil, ...gasoil];
  }, [centralTanks, company, isSahara]);

  // ── The 2 Official Core Sections (No Oils, No Comprehensive) ──
  const sections: SectionConfig[] = useMemo(() => [
    {
      key: 'etihad-black-oil',
      title: tr(isSahara ? 'الصحاري - النفط الأسود' : 'عمليات الاتحاد - النفط الأسود'),
      shortTitle: tr('النفط الأسود'),
      badge: tr(isSahara ? 'خزانات صحاري كربلاء' : 'محطات الطاقة والربان'),
      description: tr(isSahara ? 'خزانات النفط الأسود لشركة الصحاري — مرتبطة مباشرة بمنظومة الخزانات' : 'خزانات النفط الأسود لعمليات الاتحاد — مرتبطة مباشرة بمنظومة الخزانات'),
      icon: Droplets,
      accentColor: '#0891b2',
      headerGrad: 'from-cyan-600 via-sky-600 to-blue-700',
      badgeBg: 'bg-cyan-50 dark:bg-cyan-950/60',
      badgeText: 'text-cyan-700 dark:text-cyan-300',
      badgeBorder: 'border-cyan-200 dark:border-cyan-800',
      dailyBurnRate: 520000,
      coverageDays: 87,
      coverageDate: '6 ديسمبر 2026',
      chartData: BLACK_OIL_CHART
    },
    {
      key: 'strategic-gasoil',
      title: tr(isSahara ? 'خزانات الكاز - الصحاري' : 'مجمع الكاز والديزل'),
      shortTitle: tr(isSahara ? 'الكاز' : 'الكاز والديزل'),
      badge: tr(isSahara ? 'مواقع صحاري كربلاء' : 'الموقع الرئيسي وطوارئ بابل'),
      description: tr(isSahara ? 'خزانات الكاز في مواقع شركة الصحاري' : 'خزانا الاستخلاص والنقل لتأمين منظومة الكاز والديزل'),
      icon: Fuel,
      accentColor: '#2563eb',
      headerGrad: 'from-blue-600 via-indigo-600 to-blue-800',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
      badgeText: 'text-blue-700 dark:text-blue-300',
      badgeBorder: 'border-blue-200 dark:border-blue-800',
      dailyBurnRate: 175000,
      coverageDays: 109,
      coverageDate: '28 ديسمبر 2026',
      chartData: GASOIL_CHART
    }
  ], [tr, isSahara]);

  const [activeSectionKey, setActiveSectionKey] = useSessionState<'etihad-black-oil' | 'strategic-gasoil'>(isSahara ? 'sahara_tanks_section' : 'etihad_tanks_section', 'etihad-black-oil');
  const [activeChartMode, setActiveChartMode] = useState<'balance' | 'flow'>('balance');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Active section data
  const currentSection = useMemo(() => {
    return sections.find(s => s.key === activeSectionKey) || sections[0];
  }, [sections, activeSectionKey]);

  // Handle Level Adjustment in 3D Card
  const handleLevelChange = useCallback((id: string, newLevel: number) => {
    // التعديل يُكتب مباشرة في المخزن المركزي فيظهر فورًا في منظومة الخزانات
    setCentralTanks(prev => prev.map(t => t.id === id
      ? { ...t, levelMeters: Number(Math.max(0, Math.min(Number(newLevel) || 0, t.maxLevelMeters)).toFixed(2)) }
      : t));
  }, [setCentralTanks]);

  // Compute calculated tank units for 3D card
  const calculatedTanks: CalculatedTankUnit[] = useMemo(() => {
    return tankUnits
      .filter(t => t.sectionKey === activeSectionKey)
      .map(tank => {
        const fillPercent = Number(((tank.levelMeters / tank.maxLevelMeters) * 100).toFixed(1));
        // الكمية من المنسوب الدقيق وليس من النسبة المقرّبة
        const currentStoredLiters = Math.round((tank.levelMeters / (tank.maxLevelMeters || 1)) * tank.capacityLiters);
        const theme = getFillLevelTheme(fillPercent);

        return {
          ...tank,
          fillPercent,
          currentStoredLiters,
          theme
        };
      });
  }, [tankUnits, activeSectionKey]);

  // Aggregated metrics for the active section
  const sectionTotalCapacity = useMemo(() => {
    return calculatedTanks.reduce((sum, t) => sum + t.capacityLiters, 0);
  }, [calculatedTanks]);

  const sectionTotalStored = useMemo(() => {
    return calculatedTanks.reduce((sum, t) => sum + t.currentStoredLiters, 0);
  }, [calculatedTanks]);

  const sectionFillPercentage = useMemo(() => {
    return sectionTotalCapacity > 0
      ? Number(((sectionTotalStored / sectionTotalCapacity) * 100).toFixed(1))
      : 0;
  }, [sectionTotalCapacity, sectionTotalStored]);

  const sectionUllage = useMemo(() => {
    return Math.max(0, sectionTotalCapacity - sectionTotalStored);
  }, [sectionTotalCapacity, sectionTotalStored]);

  // ── Chart SVG Calculations ──
  const chartPoints = currentSection.chartData;
  const chartMaxBalance = Math.max(...chartPoints.map(p => p.balance)) * 1.05;
  const chartMinBalance = Math.min(...chartPoints.map(p => p.balance)) * 0.95;
  const chartMaxFlow = Math.max(...chartPoints.map(p => Math.max(p.inflow, p.outflow))) * 1.15;

  const chartWidth = 560;
  const chartHeight = 150;
  const paddingX = 30;
  const paddingY = 20;

  const getCoordinatesForBalance = (index: number, val: number) => {
    const x = paddingX + (index / (chartPoints.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - ((val - chartMinBalance) / (chartMaxBalance - chartMinBalance || 1)) * (chartHeight - paddingY * 2);
    return { x, y };
  };

  const balancePointsSvg = chartPoints
    .map((pt, i) => {
      const { x, y } = getCoordinatesForBalance(i, pt.balance);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPathSvg = chartPoints.length > 0
    ? `M ${getCoordinatesForBalance(0, chartPoints[0].balance).x},${chartHeight - paddingY} ` +
      chartPoints.map((pt, i) => {
        const { x, y } = getCoordinatesForBalance(i, pt.balance);
        return `L ${x},${y}`;
      }).join(' ') +
      ` L ${getCoordinatesForBalance(chartPoints.length - 1, chartPoints[chartPoints.length - 1].balance).x},${chartHeight - paddingY} Z`
    : '';

  const CurrentSectionIcon = currentSection.icon;

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300 font-sans text-slate-800 dark:text-slate-100">

      {/* Breadcrumb Path (هامش ثابت وموحّد أسفلها في كل صفحات البرنامج) */}
      <Breadcrumb
        items={[
          { label: tr(isSahara ? 'شركة الصحاري' : 'شركة الاتحاد'), onClick: onBack },
          { label: tr(isSahara ? 'خزانات الصحاري' : 'خزانات الاتحاد') }
        ]}
      />

      {/* 🌟 1. Centralized GPU SVG Shaders & Gradients for 3D Tanks Rendering */}
      <TankGlobalSvgDefs />

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 🌟 2. شريط أقسام الاتحاد من صفحة الخزانات (Sliding Section Tabs Ribbon) 🌟 */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <div className="!mt-2 p-3 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">

        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-blue-700 text-white flex items-center justify-center shadow-sm shrink-0">
            <Fuel className="w-5 h-5" />
          </div>
          <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
            {tr(isSahara ? 'خزانات وقود شركة الصحاري' : 'خزانات وقود شركة الاتحاد')}
          </h2>
        </div>

        {/* Section Sliding Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full sm:w-auto">
          {sections.map(sec => {
            const Icon = sec.icon;
            const isActive = sec.key === activeSectionKey;
            const count = tankUnits.filter(t => t.sectionKey === sec.key).length;

            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveSectionKey(sec.key)}
                className={`group px-4 py-2.5 sm:py-3 rounded-2xl flex items-center justify-center gap-2.5 font-black text-xs sm:text-sm transition-all duration-300 cursor-pointer border ${
                  isActive
                    ? `bg-gradient-to-r ${sec.headerGrad} text-white shadow-md shadow-blue-600/20 scale-[1.02] border-transparent ring-2 ring-blue-400/30`
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 shadow-xs'
                  }`}
                  style={{ color: isActive ? '#ffffff' : sec.accentColor }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span>{sec.shortTitle}</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {count} {tr('خزانات')}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 🌟 3. لوحة الرصيد الفعلي + يؤمن لغاية + الرسم البياني (Sliding Header) 🌟 */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <div 
        key={currentSection.key}
        className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300"
      >
        {/* ── الركائز الثلاث المطلوبة: الرصيد الفعلي | يؤمن لغاية | رسم بياني ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* 1. الرصيد الفعلي (Actual Stored Balance) */}
          <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CurrentSectionIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  {tr('الرصيد الفعلي')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                  {sectionFillPercentage}% {tr('امتلاء')}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                    {formatNumber(sectionTotalStored)}
                  </span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{tr('لتر')}</span>
                </div>
                <p className="text-[11.5px] text-slate-400 font-medium">
                  {tr('المخزون الميداني المقاس بحساسات المناسيب الحية')}
                </p>
              </div>
            </div>

            {/* Dynamic Liquid Meter */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">{tr('إجمالي السعة')}</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                  {formatNumber(sectionTotalCapacity)} {tr('لتر')}
                </span>
              </div>

              <div className="relative w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, sectionFillPercentage))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400">
                <span>{tr('الفراغ المتاح للاستلام')}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {formatNumber(sectionUllage)} {tr('لتر')}
                </span>
              </div>
            </div>
          </div>

          {/* 2. يؤمن لغاية (Operational Coverage Duration) */}
          <div className="lg:col-span-4 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-white border border-blue-900/50 shadow-soft-card p-5 sm:p-6 flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-black text-blue-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {tr('الأمان التشغيلي')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {tr('مؤمن استراتيجياً')}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold block">{tr('يؤمن لغاية')}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-emerald-400">
                    {currentSection.coverageDays}
                  </span>
                  <span className="text-sm font-bold text-slate-300">{tr('يوماً')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blue-200 font-bold mt-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>{tr('يكفي حتى تاريخ')}: {currentSection.coverageDate}</span>
                </div>
              </div>
            </div>

            {/* Daily Burn Rate Callout */}
            <div className="relative z-10 p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-300 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                {tr('الاستهلاك اليومي')}
              </span>
              <span className="font-mono font-bold text-rose-300">
                -{formatNumber(currentSection.dailyBurnRate)} {tr('لتر/يوم')}
              </span>
            </div>
          </div>

          {/* 3. رسم بياني تفاعلي (Interactive Chart) */}
          <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card p-5 sm:p-6 flex flex-col justify-between space-y-3">
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  {tr('الرسم البياني لحركة المخزون')}
                </h4>
              </div>

              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveChartMode('balance')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeChartMode === 'balance' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tr('الرصيد')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartMode('flow')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeChartMode === 'flow' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tr('الوارد')}
                </button>
              </div>
            </div>

            {/* Dynamic SVG Chart */}
            <div className="relative w-full h-[120px] flex items-center justify-center bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-2 overflow-hidden">
              {activeChartMode === 'balance' ? (
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`grad-${currentSection.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPathSvg} fill={`url(#grad-${currentSection.key})`} />
                  <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" points={balancePointsSvg} />
                  {chartPoints.map((pt, i) => {
                    const { x, y } = getCoordinatesForBalance(i, pt.balance);
                    const isHovered = hoveredPointIndex === i;
                    return (
                      <circle
                        key={pt.date}
                        cx={x}
                        cy={y}
                        r={isHovered ? 5 : 3.5}
                        className="fill-white stroke-blue-600 stroke-2 cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPointIndex(i)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                      />
                    );
                  })}
                </svg>
              ) : (
                <div className="w-full h-full flex items-end justify-between gap-1.5 px-2 py-1">
                  {chartPoints.map((pt, idx) => {
                    const inPct = (pt.inflow / chartMaxFlow) * 100;
                    const outPct = (pt.outflow / chartMaxFlow) * 100;
                    return (
                      <div key={pt.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group cursor-pointer" onMouseEnter={() => setHoveredPointIndex(idx)} onMouseLeave={() => setHoveredPointIndex(null)}>
                        <div className="w-full flex items-end justify-center gap-1 h-[75px]">
                          <div className="w-2 sm:w-2.5 bg-emerald-500 rounded-t-sm" style={{ height: `${Math.max(12, inPct)}%` }} />
                          <div className="w-2 sm:w-2.5 bg-rose-500 rounded-t-sm" style={{ height: `${Math.max(12, outPct)}%` }} />
                        </div>
                        <span className="text-[8.5px] font-mono text-slate-400">{pt.dayName.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tooltip on Hover */}
              {hoveredPointIndex !== null && chartPoints[hoveredPointIndex] && (
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-lg bg-slate-900 text-white text-[10px] font-mono shadow-md z-20 pointer-events-none">
                  {chartPoints[hoveredPointIndex].dayName}: {formatNumber(chartPoints[hoveredPointIndex].balance)} لتر
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <Sparkles className="w-3 h-3" />
                {tr('استقرار المخزون')}
              </span>
              <span className="font-mono">7 {tr('أيام مسجلة')}</span>
            </div>

          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* 🌟 4. شبكة كروت الخزانات ثلاثية الأبعاد (3D Tank Cards Matrix) 🌟 */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {tr('خزانات')} {currentSection.shortTitle} {tr('بالتصميم ثلاثي الأبعاد المباشر')}
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {calculatedTanks.length} {tr('خزانات تشغيلية عاملة')}
            </span>
          </div>

          {/* 3D Tank Cards Grid (Exact Component from TanksOverview) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
            {calculatedTanks.map(tank => (
              <Tank3DCard
                key={tank.id}
                tank={tank}
                onLevelChange={handleLevelChange}
                isEditable={false}
              />
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
