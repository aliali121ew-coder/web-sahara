import React, { useMemo, useRef, useState } from 'react';
import {
  Flame,
  Fuel,
  Droplets,
  Gauge,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatNumber } from '../../lib/utils';
import { FuelProductMetric, InboundDelivery } from '../../types';
import { usePetrolLedger } from '../../lib/petrolLedger';
import { usePriceOverrides } from '../../lib/priceOverrides';
import { useManualFuelCards } from '../../lib/manualFuelCard';
import { useBlackOilLedger, type ComputedBlackOilRecord } from '../../lib/blackOilLedger';
import { PriceEditPopover, type PriceDay } from './PriceEditPopover';

/** مصدر سعر تلقائي من الوارد: أيام مسعّرة (الأحدث أولًا) + توقيع يتغيّر مع كل عملية وارد جديدة */
interface InboundPriceSource {
  days: PriceDay[];
  sig: string;
}
const round1 = (v: number) => Math.round(v * 10) / 10;
const pctChange = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : 0);

/** أسعار الوارد اليومية (متوسط موزون بالكمية لكل يوم) من شحنات كشف الوارد */
const fromDeliveries = (list: InboundDelivery[]): InboundPriceSource => {
  const priced = list.filter(d => d.status !== 'ملغي' && Number(d.productPrice ?? d.pricePerLiter) > 0 && Number(d.receivedQuantity ?? d.volumeLiters) > 0);
  const byDay = new Map<string, { c: number; q: number }>();
  let total = 0;
  for (const d of priced) {
    const date = (d.receiptUnloadDate || d.date || '').slice(0, 10).replace(/-/g, '/');
    const q = Number(d.receivedQuantity ?? d.volumeLiters);
    const p = Number(d.productPrice ?? d.pricePerLiter);
    const v = byDay.get(date) ?? { c: 0, q: 0 };
    v.c += q * p; v.q += q; total += q;
    byDay.set(date, v);
  }
  const days = [...byDay].sort((a, b) => b[0].localeCompare(a[0])).map(([date, v]) => ({ date, price: round1(v.c / v.q), qty: v.q }));
  return { days, sig: `${priced.length}|${days[0]?.date ?? ''}|${total}` };
};

/** كارت يدوي بالكامل: غير مرتبط بالوارد، يُدخل سعره وكميته وتاريخه للعرض فقط */
const MANUAL_ONLY_ID = 'fuel-muhassan';

/** layout="side": بدون ترويسة وفي عمودين (للعمود الجانبي في صفحة المشتريات) */
export const FuelMetricsGrid: React.FC<{ layout?: 'row' | 'side' }> = ({ layout = 'row' }) => {
  const isSide = layout === 'side';
  const { fuelMetrics, supplierPrices, saharaDeliveries, etihadDeliveries } = useFuelData();
  const { tr } = useLanguage();
  const { publishedComputed: petrolDays } = usePetrolLedger();
  const { computed: saharaBlackOilDays } = useBlackOilLedger('sahara');
  const { computed: etihadBlackOilDays } = useBlackOilLedger('etihad');
  const { overrides, setOverride, clearOverride } = usePriceOverrides();
  const { cards: manualCards, saveCard } = useManualFuelCards();

  // ── السعر التلقائي من الوارد: كاز الصحاري وكاز الاتحاد من كشف الوارد، والبنزين من سجل البنزين ──
  const inboundSources = useMemo<Record<string, InboundPriceSource>>(() => {
    const petrol = petrolDays.filter(d => d.inboundQty > 0 && d.inboundPrice > 0);
    const petrolDaysDesc = [...petrol].reverse().map(d => ({ date: d.date, price: d.inboundPrice, qty: d.inboundQty }));
    // النفط الأسود: سعر اللتر المسجّل لكل يوم في السجل اليومي
    const fromBlackOil = (list: ComputedBlackOilRecord[]): InboundPriceSource => {
      const priced = list.filter(d => d.inbound > 0 && (d.price ?? 0) > 0);
      const days = [...priced].reverse().map(d => ({ date: d.date, price: d.price as number, qty: d.inbound }));
      return { days, sig: `${priced.length}|${days[0]?.date ?? ''}|${priced.reduce((a, d) => a + d.inbound, 0)}` };
    };
    return {
      'fuel-4': fromBlackOil(saharaBlackOilDays),
      'fuel-5': fromBlackOil(etihadBlackOilDays),
      'fuel-2': fromDeliveries(saharaDeliveries),
      'fuel-3': fromDeliveries(etihadDeliveries),
      'fuel-1': { days: petrolDaysDesc, sig: `${petrol.length}|${petrolDaysDesc[0]?.date ?? ''}|${petrol.reduce((a, d) => a + d.inboundQty, 0)}` }
    };
  }, [saharaDeliveries, etihadDeliveries, petrolDays, saharaBlackOilDays, etihadBlackOilDays]);

  // ── الضغط المطوّل على الكارت يفتح نافذة السعر في مكانه ──
  const [pressing, setPressing] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<{ id: string; rect: DOMRect } | null>(null);
  const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  const cancelPress = () => {
    if (pressRef.current) clearTimeout(pressRef.current.timer);
    pressRef.current = null;
    setPressing(null);
  };
  const startPress = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    cancelPress();
    pressRef.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        setOpenCard({ id, rect: el.getBoundingClientRect() });
        setPressing(null);
        pressRef.current = null;
        navigator.vibrate?.(15);
      }, 520)
    };
    setPressing(id);
  };
  const movePress = (e: React.PointerEvent) => {
    const p = pressRef.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelPress();
  };

  const maxBenchmarkVolume = 300000;

  // Dynamic mapping helper to get live price & trend from the supplier prices table
  const getLinkedSupplierData = (metric: FuelProductMetric) => {
    // كاز محطات: قيم يدوية فقط (لا وارد ولا جدول موردين)
    if (metric.id === MANUAL_ONLY_ID) {
      const m = manualCards[metric.id];
      const price = m?.price ?? metric.priceIqd;
      const previous = m?.previousPrice ?? price;
      return {
        displayPrice: price, previousPrice: previous, trendPercent: pctChange(price, previous),
        priceUpdatedAt: m?.date || '—', volume: m?.volume ?? metric.volumeLiters,
        source: 'standalone' as const, auto: null, src: undefined, manual: null
      };
    }
    let matched = supplierPrices.find(s => {
      if (metric.id === 'fuel-1') return s.product.includes('بنزين');
      if (metric.id === 'fuel-2') return s.product.includes('Euro 5') || s.supplierName.includes('كربلاء الدولي');
      if (metric.id === 'fuel-muhassan') return s.product.includes('حكومي') || s.supplierName.includes('توزيع');
      if (metric.id === 'fuel-3') return s.supplierName.includes('الاتحاد');
      if (metric.id === 'fuel-4') return s.product.includes('نفط أسود') || s.supplierName.includes('الفرات الأوسط');
      if (metric.id === 'fuel-5') return s.supplierName.includes('الوطنية');
      return false;
    });

    const displayPrice = matched ? matched.priceIqd : metric.priceIqd;
    const previousPrice = matched?.previousPriceIqd ?? metric.priceIqd;
    const trendPercent = matched ? matched.changePercent : metric.trendPercent;

    const src = inboundSources[metric.id];
    const auto = src?.days[0] ?? null;
    // مجموع الشراء = كمية آخر يوم وارد (وليس تراكميًا)
    const volume = auto?.qty ?? 0;
    const ov = overrides[metric.id];
    // السعر اليدوي يسري فقط ما دام لم يحدث وارد جديد بعده (توقيع الوارد لم يتغيّر)
    const manual = ov && (!src || ov.baseSig === src.sig) ? ov : null;
    if (manual) {
      const base = auto?.price ?? displayPrice;
      return {
        displayPrice: manual.price, previousPrice: base, trendPercent: pctChange(manual.price, base),
        priceUpdatedAt: auto?.date ?? manual.setAt.slice(0, 10).replace(/-/g, '/'), volume, source: 'manual' as const, auto, src, manual
      };
    }
    if (auto) {
      const prev = src!.days[1]?.price ?? auto.price;
      return {
        displayPrice: auto.price, previousPrice: prev, trendPercent: pctChange(auto.price, prev),
        priceUpdatedAt: auto.date, volume, source: 'auto' as const, auto, src, manual: null
      };
    }
    return { displayPrice, previousPrice, trendPercent, priceUpdatedAt: '—', volume, source: 'supplier' as const, auto: null, src, manual: null };
  };

  const getCardPastelConfig = (metric: FuelProductMetric) => {
    switch (metric.badgeColor) {
      case 'amber':
        return {
          icon: Flame,
          cardBg: 'bg-gradient-to-b from-amber-50/90 via-white to-amber-50/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-amber-950/10',
          border: 'border-amber-200/90 dark:border-amber-900/40',
          hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-500/60',
          glowShadow: 'hover:shadow-amber-500/10',
          iconContainer: 'bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-500/35',
          circleBadge: 'border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300',
          priceColor: 'text-slate-900 dark:text-white',
          companyBadge: 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300',
          progressBar: 'bg-gradient-to-r from-amber-500 to-amber-400',
          statusColor: 'text-amber-600 dark:text-amber-400',
        };
      case 'blue':
        return {
          icon: Fuel,
          cardBg: 'bg-gradient-to-b from-blue-50/90 via-white to-blue-50/40 dark:from-blue-950/20 dark:via-slate-900 dark:to-blue-950/10',
          border: 'border-blue-200/90 dark:border-blue-900/40',
          hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-500/60',
          glowShadow: 'hover:shadow-blue-500/10',
          iconContainer: 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/35',
          circleBadge: 'border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300',
          priceColor: 'text-slate-900 dark:text-white',
          companyBadge: 'bg-blue-100/70 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300',
          progressBar: 'bg-gradient-to-r from-blue-600 to-indigo-500',
          statusColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'cyan':
        return {
          icon: Sparkles,
          cardBg: 'bg-gradient-to-b from-cyan-50/90 via-white to-cyan-50/40 dark:from-cyan-950/20 dark:via-slate-900 dark:to-cyan-950/10',
          border: 'border-cyan-200/90 dark:border-cyan-900/40',
          hoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-500/60',
          glowShadow: 'hover:shadow-cyan-500/10',
          iconContainer: 'bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-lg shadow-cyan-500/35',
          circleBadge: 'border-cyan-200 dark:border-cyan-800/60 text-cyan-700 dark:text-cyan-300',
          priceColor: 'text-slate-900 dark:text-white',
          companyBadge: 'bg-cyan-100/70 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300',
          progressBar: 'bg-gradient-to-r from-cyan-600 to-sky-500',
          statusColor: 'text-cyan-600 dark:text-cyan-400',
        };
      case 'teal':
      case 'emerald':
        return {
          icon: Gauge,
          cardBg: 'bg-gradient-to-b from-emerald-50/90 via-white to-emerald-50/40 dark:from-emerald-950/20 dark:via-slate-900 dark:to-emerald-950/10',
          border: 'border-emerald-200/90 dark:border-emerald-900/40',
          hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500/60',
          glowShadow: 'hover:shadow-emerald-500/10',
          iconContainer: 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/35',
          circleBadge: 'border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300',
          priceColor: 'text-slate-900 dark:text-white',
          companyBadge: 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300',
          progressBar: 'bg-gradient-to-r from-emerald-600 to-teal-500',
          statusColor: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'purple':
        return {
          icon: Droplets,
          cardBg: 'bg-gradient-to-b from-purple-50/90 via-white to-purple-50/40 dark:from-purple-950/20 dark:via-slate-900 dark:to-purple-950/10',
          border: 'border-purple-200/90 dark:border-purple-900/40',
          hoverBorder: 'hover:border-purple-400 dark:hover:border-purple-500/60',
          glowShadow: 'hover:shadow-purple-500/10',
          iconContainer: 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/35',
          circleBadge: 'border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300',
          priceColor: 'text-slate-900 dark:text-white',
          companyBadge: 'bg-purple-100/70 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300',
          progressBar: 'bg-gradient-to-r from-purple-600 to-indigo-600',
          statusColor: 'text-purple-600 dark:text-purple-400',
        };
      case 'pink':
      default:
        return {
          icon: Boxes,
          cardBg: 'bg-gradient-to-b from-rose-50/90 via-white to-rose-50/40 dark:from-rose-950/20 dark:via-slate-900 dark:to-rose-950/10',
          border: 'border-rose-200/90 dark:border-rose-900/40',
          hoverBorder: 'hover:border-rose-400 dark:hover:border-rose-500/60',
          glowShadow: 'hover:shadow-rose-500/10',
          iconContainer: 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/35',
          circleBadge: 'border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300',
          priceColor: 'text-slate-900 dark:text-white',
          companyBadge: 'bg-rose-100/70 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
          progressBar: 'bg-gradient-to-r from-rose-500 to-pink-500',
          statusColor: 'text-rose-600 dark:text-rose-400',
        };
    }
  };

  return (
    <div className={isSide ? 'h-full' : 'space-y-4'}>
      
      {/* Section Header */}
      {!isSide && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-600 text-white shadow-md shadow-blue-500/20">
            <Layers className="w-4 h-4 text-blue-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {tr('مشتريات الوقود والمشتقات')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/80 dark:border-slate-700/80">
                {fuelMetrics.length} {tr('أصناف رئيسية')}
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 6 Luxury Pastel Cards Grid (Adaptive on Open Sidebar) */}
      <div className={isSide ? 'h-full grid grid-cols-2 gap-2.5 2xl:gap-3 items-stretch' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 2xl:gap-4 items-stretch'}>
        {fuelMetrics.map((item) => {
          const config = getCardPastelConfig(item);
          const Icon = config.icon;
          const { displayPrice, previousPrice, trendPercent, priceUpdatedAt, volume, source } = getLinkedSupplierData(item);
          const percentage = Math.min(Math.round((volume / maxBenchmarkVolume) * 100), 100);

          const isPriceDown = trendPercent < 0;

          return (
            <div
              key={item.id}
              onPointerDown={e => startPress(e, item.id)}
              onPointerMove={movePress}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={e => e.preventDefault()}
              title={tr('اضغط مطوّلًا لعرض السعر وتعديله')}
              data-pressing={pressing === item.id || undefined}
              // صفحة الأسعار (side): أبيض ثلجي بحد رمادي خفيف · الشاشة الرئيسية: التدرّج الملوّن الأصلي
              className={`@container ${isSide ? 'rounded-[18px] p-2.5 2xl:p-3' : 'rounded-[24px] 2xl:rounded-[28px] p-3.5 sm:p-4 2xl:p-5'} ${isSide ? 'bg-[#fcfdff] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700' : `${config.cardBg} border ${config.border} ${config.hoverBorder} ${config.glowShadow}`} shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden select-none touch-manipulation cursor-pointer ${pressing === item.id ? 'scale-[0.97] !translate-y-0 ring-2 ring-teal-500/30' : ''} ${openCard?.id === item.id ? 'opacity-0' : ''}`}
            >
              {/* شريط تقدّم الضغط المطوّل */}
              {pressing === item.id && (
                <span className="absolute bottom-0 inset-x-0 h-1 bg-teal-500 origin-right" style={{ animation: 'fmLongPress 520ms linear forwards' }} />
              )}
              {/* شارة السعر اليدوي */}
              {source === 'manual' && (
                <span className="absolute top-2 left-2 z-10 px-1.5 py-px rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[9px] font-black ring-1 ring-amber-200 dark:ring-amber-900" title={tr('سعر يدوي حتى أول وارد جديد')}>
                  {tr('يدوي')}
                </span>
              )}
              <div>
                
                {/* Card Top: Floating Icon + Title + Circular Percentage Pill */}
                <div className="flex items-start justify-between gap-2">
                  
                  {/* Floating Elevated Icon (Top Corner) - Fluid Adaptive Size */}
                  <div 
                    className={`rounded-xl sm:rounded-2xl ${config.iconContainer} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                    style={{
                      width: isSide ? 'clamp(26px, 13cqw, 32px)' : 'clamp(32px, 16.5cqw, 42px)',
                      height: isSide ? 'clamp(26px, 13cqw, 32px)' : 'clamp(32px, 16.5cqw, 42px)'
                    }}
                  >
                    <Icon 
                      className="w-4 h-4 2xl:w-5 2xl:h-5"
                      style={{
                        width: 'clamp(15px, 8cqw, 19px)',
                        height: 'clamp(15px, 8cqw, 19px)'
                      }}
                    />
                  </div>

                  {/* Title & Company - Fluid Adaptive Typography with Unified Full-Screen Max */}
                  <div className="flex-1 text-right min-w-0">
                    <h3 
                      className="font-black text-slate-900 dark:text-white leading-tight whitespace-nowrap"
                      style={{ 
                        fontSize: isSide
                          ? 'clamp(11px, 6cqw, 13.5px)'
                          : item.name.length > 11 
                          ? 'clamp(11px, 6.6cqw, 16px)' 
                          : 'clamp(11.5px, 7.4cqw, 16px)' 
                      }}
                      title={item.name}
                    >
                      {tr(item.name)}
                    </h3>
                    <span 
                      className={`inline-block font-bold px-2 py-0.5 rounded-full mt-1 ${config.companyBadge} whitespace-nowrap`}
                      style={{ fontSize: 'clamp(9px, 5cqw, 11px)' }}
                      title={item.company}
                    >
                      {tr(item.company)}
                    </span>
                  </div>

                </div>

                {/* Middle: Floating Circular Trend Pill + Giant Price */}
                <div className={`${isSide ? 'mt-2' : 'mt-3 sm:mt-3.5 2xl:mt-4'} flex items-center justify-between gap-1.5`}>
                  
                  {/* Giant Price Number - Fluid Dynamic Monospace */}
                  <div className="min-w-0">
                    {!isSide && (
                    <span 
                      className="font-bold text-slate-400 block mb-0.5 whitespace-nowrap"
                      style={{ fontSize: 'clamp(9px, 4.6cqw, 10.5px)' }}
                    >
                      {tr('سعر اللتر المعتمد')}
                    </span>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span 
                        className={`font-black font-mono tracking-tight ${config.priceColor} whitespace-nowrap`}
                        style={{ fontSize: isSide ? 'clamp(1.1rem, 10cqw, 1.55rem)' : 'clamp(1.3rem, 13cqw, 2.15rem)' }}
                      >
                        {displayPrice > 0 ? displayPrice : 0}
                      </span>
                      <span 
                        className="font-bold text-slate-400 whitespace-nowrap"
                        style={{ fontSize: 'clamp(10px, 5.2cqw, 11.5px)' }}
                      >
                        {tr('د.ع')}
                      </span>
                    </div>

                    {/* Previous Price (السعر السابق مباشرة تحت السعر) */}
                    <div 
                      className="flex items-center gap-1 mt-0.5 text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap"
                      style={{ fontSize: 'clamp(8.5px, 4.2cqw, 10px)' }}
                    >
                      <span>{tr('السابق:')}</span>
                      <span className="font-mono font-bold text-slate-500 dark:text-slate-400">
                        {previousPrice > 0 ? previousPrice : displayPrice}
                      </span>
                      <span className="text-[8px] font-normal">{tr('د.ع')}</span>
                    </div>
                  </div>

                  {/* Floating Ultra-3D Tactile Circular Badge - Fluid Scaling */}
                  <div 
                    title={isPriceDown ? `${tr('انخفاض بالسعر')} (${trendPercent}%)` : trendPercent > 0 ? `${tr('ارتفاع بالسعر')} (+${trendPercent}%)` : `${tr('استقرار بالسعر')} 0.0%`}
                    className={`relative rounded-full bg-gradient-to-b from-white via-slate-50 to-slate-100/90 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 ring-1 ring-white/90 dark:ring-white/10 border ${config.circleBadge} flex flex-col items-center justify-center shrink-0 p-0.5 transition-all duration-300 group-hover:scale-108 group-hover:-translate-y-0.5 ${
                      isPriceDown
                        ? 'shadow-[0_4px_14px_rgba(16,185,129,0.22),inset_0_1.5px_2px_rgba(255,255,255,1),inset_0_-1.5px_2px_rgba(16,185,129,0.15)]'
                        : trendPercent > 0
                        ? 'shadow-[0_4px_14px_rgba(244,63,94,0.22),inset_0_1.5px_2px_rgba(255,255,255,1),inset_0_-1.5px_2px_rgba(244,63,94,0.15)]'
                        : 'shadow-[0_4px_10px_rgba(0,0,0,0.06),inset_0_1.5px_2px_rgba(255,255,255,1),inset_0_-1.5px_2px_rgba(0,0,0,0.04)]'
                    }`}
                    style={{
                      width: isSide ? 'clamp(32px, 15cqw, 38px)' : 'clamp(36px, 19cqw, 46px)',
                      height: isSide ? 'clamp(32px, 15cqw, 38px)' : 'clamp(36px, 19cqw, 46px)'
                    }}
                  >
                    {/* Top 3D Gloss Highlight Arc */}
                    <div className="absolute top-0.5 inset-x-1.5 h-1.5 rounded-full bg-gradient-to-b from-white/90 to-transparent opacity-80 pointer-events-none" />

                    {trendPercent !== 0 ? (
                      <div className="relative z-10 flex flex-col items-center justify-center leading-none space-y-0.5">
                        {isPriceDown ? (
                          <>
                            <ArrowDownRight 
                              className="text-emerald-500 shrink-0 drop-shadow-[0_1px_1px_rgba(16,185,129,0.35)]" 
                              style={{ width: 'clamp(11px, 6cqw, 14px)', height: 'clamp(11px, 6cqw, 14px)' }}
                            />
                            <span 
                              className="font-black font-mono text-emerald-700 dark:text-emerald-300 tabular-nums tracking-tighter drop-shadow-xs"
                              style={{ fontSize: 'clamp(8px, 4.2cqw, 9.5px)' }}
                            >
                              {Math.abs(trendPercent)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight 
                              className="text-rose-500 shrink-0 drop-shadow-[0_1px_1px_rgba(244,63,94,0.35)]" 
                              style={{ width: 'clamp(11px, 6cqw, 14px)', height: 'clamp(11px, 6cqw, 14px)' }}
                            />
                            <span 
                              className="font-black font-mono text-rose-700 dark:text-rose-300 tabular-nums tracking-tighter drop-shadow-xs"
                              style={{ fontSize: 'clamp(8px, 4.2cqw, 9.5px)' }}
                            >
                              +{trendPercent}%
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col items-center justify-center leading-none space-y-0.5">
                        <span 
                          className="font-black text-slate-300 dark:text-slate-600 font-mono leading-none"
                          style={{ fontSize: 'clamp(9px, 4.8cqw, 11px)' }}
                        >
                          —
                        </span>
                        <span 
                          className="font-bold text-slate-400 font-mono tabular-nums"
                          style={{ fontSize: 'clamp(7.5px, 4cqw, 9px)' }}
                        >
                          0.0%
                        </span>
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Bottom Section: Hairline Divider + Stock Level & Details */}
              <div className={`${isSide ? 'mt-2 pt-2 space-y-1.5' : 'mt-3.5 pt-2.5 2xl:mt-4 2xl:pt-3 space-y-2'} border-t border-slate-200/70 dark:border-slate-800`}>
                
                {/* Stock Level Text & Bar */}
                <div 
                  className="flex items-center justify-between"
                  style={{ fontSize: 'clamp(10px, 5.2cqw, 11.5px)' }}
                >
                  <span className="font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{tr(source === 'standalone' ? 'الكمية' : 'مجموع الشراء')}</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {formatNumber(volume)} <span className="text-[9px] font-normal text-slate-400">{tr('لتر')}</span>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${config.progressBar} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(percentage, volume > 0 ? 8 : 0)}%` }}
                  />
                </div>

                {/* Footer Status & Timestamp */}
                <div 
                  className="flex items-center justify-between font-medium text-slate-400 pt-0.5"
                  style={{ fontSize: 'clamp(9.5px, 4.8cqw, 10.5px)' }}
                >
                  <span className={`font-bold ${config.statusColor} whitespace-nowrap`}>
                    ● {tr(source === 'standalone' ? 'آخر تحديث' : 'آخر تحديث للسعر')}
                  </span>
                  {/* تاريخ آخر تحديث للسعر في مكان الوقت */}
                  <div className="flex items-center gap-1 font-mono whitespace-nowrap">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{priceUpdatedAt}</span>
                  </div>
                </div>

              </div>

            </div>
          );
        })}
      </div>

      <style>{`@keyframes fmLongPress { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
      {openCard && (() => {
        const item = fuelMetrics.find(m => m.id === openCard.id);
        if (!item) return null;
        const cfg = getCardPastelConfig(item);
        const d = getLinkedSupplierData(item);
        return (
          <PriceEditPopover
            anchor={openCard.rect}
            title={item.name}
            company={item.company}
            icon={cfg.icon}
            iconClass={cfg.iconContainer}
            price={d.displayPrice}
            autoPrice={d.auto?.price ?? null}
            autoDate={d.auto?.date ?? null}
            days={d.src?.days ?? []}
            manual={d.manual ? { price: d.manual.price, setAt: d.manual.setAt } : null}
            readOnly={!isSide}
            standalone={item.id === MANUAL_ONLY_ID ? { volume: d.volume, date: d.priceUpdatedAt, onSave: v => saveCard(item.id, v, item.priceIqd) } : undefined}
            onSave={price => setOverride(item.id, price, d.src?.sig ?? '')}
            onReset={() => clearOverride(item.id)}
            onClose={() => setOpenCard(null)}
          />
        );
      })()}
    </div>
  );
};

