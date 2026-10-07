import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingCart, ChevronRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useTranslation, Trans } from 'react-i18next';
import { enumText } from '../../i18n/enums';
import { formatNumber, getBusinessDate } from '../../lib/utils';
import { usePetrolLedger } from '../../lib/petrolLedger';
import { useBlackOilLedger } from '../../lib/blackOilLedger';
import { FuelMetricsGrid } from '../dashboard/FuelMetricsGrid';
import { PriceIndexTable } from '../dashboard/PriceIndexTable';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import { PurchasesChart } from './PurchasesChart';
import { CATEGORIES, type CategoryKey, type CategoryFilter, type PurchaseRow, avgPrice, fmtPrice, addDays, daysBetween, weekStart, monthEnd } from './purchasesData';

/** قسم الشحنة من شركتها ومنتجها ("كاز محطات" لا يُسجَّل له وارد في كشف الوارد حاليًا) */
const categoryOf = (scope: 'sahara' | 'etihad', product: string): CategoryKey | null => {
  if (product.includes('نفط')) return scope === 'sahara' ? 'sahara-black-oil' : 'etihad-black-oil';
  if (product.includes('بنزين')) return scope === 'sahara' ? 'sahara-petrol' : null;
  if (product.includes('محطات')) return scope === 'sahara' ? 'station-gas' : null;
  if (product.includes('كاز')) return scope === 'sahara' ? 'sahara-gas' : 'etihad-gas';
  return null;
};

const normDate = (d?: string) => (d || '').slice(0, 10).replace(/-/g, '/');

type RangeKey = 'today' | 'week' | 'month' | 'custom';
const PAGE_SIZE = 10;

/** ألوان شارات المنتجات */
const productBadge = (p: string) =>
  p.includes('نفط')
    ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900'
    : p.includes('بنزين')
    ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900'
    : 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900';

/**
 * صفحة المشتريات والأسعار (من القائمة الجانبية):
 * 1) جدول المشتريات (70%) + كروت أسعار الوقود الستة (30%)
 * 2) رسم بياني لحركة الوارد ومتوسط السعر معًا
 * 3) مؤشرات أسعار الشركات والموردين
 */
export const PricesView: React.FC = () => {
  const { t, i18n } = useTranslation(['prices', 'common']);
  const rtl = i18n.dir() === 'rtl';
  const { saharaDeliveries, etihadDeliveries } = useFuelData();
  const { publishedComputed: petrolDays } = usePetrolLedger();
  // وارد النفط الأسود من السجل اليومي لكل شركة (كشف الوارد خاص بالكاز) مع سعر اللتر المسجّل لكل يوم
  const { computed: saharaBlackOil } = useBlackOilLedger('sahara');
  const { computed: etihadBlackOil } = useBlackOilLedger('etihad');

  // ── تجميع المشتريات: شحنات الوارد للشركتين + وارد بنزين الصحاري ──
  const allRows = useMemo<PurchaseRow[]>(() => {
    const map = new Map<string, PurchaseRow>();
    const add = (cat: CategoryKey | null, date: string, company: string, product: string, qty: number, price: number) => {
      if (!cat || !date || !qty) return;
      const key = `${cat}|${date}|${product}`;
      const row = map.get(key) ?? { key, cat, date, company, product, inbound: 0, count: 0, pricedCost: 0, pricedQty: 0 };
      row.inbound += qty;
      row.count += 1;
      if (price > 0) {
        row.pricedCost += qty * price;
        row.pricedQty += qty;
      }
      map.set(key, row);
    };
    const scoped = [
      ...saharaDeliveries.map(d => ['sahara', d] as const),
      ...etihadDeliveries.map(d => ['etihad', d] as const)
    ];
    for (const [scope, d] of scoped) {
      if (d.status === 'ملغي') continue;
      add(
        categoryOf(scope, d.product || ''),
        normDate(d.receiptUnloadDate || d.date),
        d.company || '—',
        d.product || '—',
        Number(d.receivedQuantity ?? d.volumeLiters) || 0,
        Number(d.productPrice ?? d.pricePerLiter) || 0
      );
    }
    for (const d of saharaBlackOil) add('sahara-black-oil', d.date, 'صحاري كربلاء', 'نفط أسود', d.inbound, d.price || 0);
    for (const d of etihadBlackOil) add('etihad-black-oil', d.date, 'شركة الاتحاد', 'نفط أسود', d.inbound, d.price || 0);
    for (const p of petrolDays) add('sahara-petrol', p.date, 'صحاري كربلاء', 'بنزين', p.inboundQty || 0, p.inboundPrice || 0);
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.company.localeCompare(b.company));
  }, [saharaDeliveries, etihadDeliveries, petrolDays, saharaBlackOil, etihadBlackOil]);

  // ── القسم المختار والفترة (يتبعهما الجدول والرسم البياني معًا) ──
  const [category, setCategory] = useState<CategoryFilter>('sahara-gas');
  const [range, setRange] = useState<RangeKey>('month');
  // فترة مخصصة (من / إلى) بنفس تقويم كشف الوارد
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePop, setDatePop] = useState<{ top: number; left: number } | null>(null);
  const [page, setPage] = useState(1);

  // حدود الفترة المعروضة [from, to] (للمقارنة مع الفترة السابقة بنفس الطول)
  const bounds = useMemo(() => {
    const today = getBusinessDate(new Date());
    if (range === 'today') return { from: today, to: today };
    if (range === 'week') return { from: weekStart(today), to: today };
    if (range === 'month') return { from: `${today.slice(0, 8)}01`, to: monthEnd(today) < today ? monthEnd(today) : today };
    const dates = allRows.map(r => r.date).sort();
    return { from: fromDate || dates[0] || today, to: toDate || dates[dates.length - 1] || today };
  }, [range, fromDate, toDate, allRows]);

  const rows = useMemo(() => {
    // اليوم = يوم العمل الحالي، الأسبوع = من السبت الماضي، الشهر = الشهر الحالي من يومه الأول
    const now = new Date();
    const today = getBusinessDate(now);
    let fromStr = today;
    if (range === 'week') {
      const sat = new Date(now);
      sat.setDate(now.getDate() - ((now.getDay() + 1) % 7));
      fromStr = getBusinessDate(sat);
    }
    const inRange = (d: string) =>
      range === 'custom'
        ? (!fromDate || d >= fromDate) && (!toDate || d <= toDate)
        : range === 'today'
        ? d === today
        : range === 'month'
        ? d.startsWith(today.slice(0, 8))
        : d >= fromStr;
    return allRows.filter(r => (category === 'all' || r.cat === category) && inRange(r.date));
  }, [allRows, category, range, fromDate, toDate]);

  // الفترة السابقة بنفس الطول (مقارنة الرسم البياني)، وإزاحتها بالأيام على محور الفترة الحالية
  const prevShift = daysBetween(bounds.from, bounds.to) + 1;
  const prevRows = useMemo(() => {
    const pFrom = addDays(bounds.from, -prevShift);
    const pTo = addDays(bounds.from, -1);
    return allRows.filter(r => (category === 'all' || r.cat === category) && r.date >= pFrom && r.date <= pTo);
  }, [allRows, category, bounds.from, prevShift]);

  // النقر على الرسم: ينقل الجدول إلى الفترة المختارة
  const tableRef = useRef<HTMLDivElement>(null);
  const pickRange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    setRange('custom');
    setPage(1);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // إجمالي وارد كل قسم (يظهر على الكروت المنزلقة)
  const categoryTotals = useMemo(() => {
    const t = {} as Record<CategoryKey, number>;
    for (const r of allRows) t[r.cat] = (t[r.cat] || 0) + r.inbound;
    return t;
  }, [allRows]);
  const allTotal = useMemo(() => allRows.reduce((a, r) => a + r.inbound, 0), [allRows]);
  const isAll = category === 'all';
  const activeTitle = t(isAll ? 'prices:category.allPurchases' : `prices:category.${category}`);

  const totals = useMemo(() => {
    const inbound = rows.reduce((a, r) => a + r.inbound, 0);
    const pricedCost = rows.reduce((a, r) => a + r.pricedCost, 0);
    const pricedQty = rows.reduce((a, r) => a + r.pricedQty, 0);
    return { inbound, price: avgPrice({ pricedCost, pricedQty }) };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
      active ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/60'
    }`;

  return (
    <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-300 pb-6">
      {/* ── القسم 1: جدول المشتريات (70%) + كروت الأسعار (30%) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-10 gap-4 items-stretch">
        <div ref={tableRef} className="xl:col-span-7 min-w-0 flex flex-col scroll-mt-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card overflow-hidden">
          {/* ترويسة الجدول والفلاتر */}
          <div className="p-4 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
                <ShoppingCart className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">{t('prices:table.title')} <span className="text-slate-400 font-bold">— {activeTitle}</span></h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('prices:table.subtitle')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {(['today', 'week', 'month'] as const).map(k => (
                  <button key={k} type="button" onClick={() => { setRange(k); setPage(1); }} className={chip(range === k)}>
                    {t(`prices:range.${k}`)}
                  </button>
                ))}
              </div>
              {/* تحديد فترة من / إلى */}
              <button
                type="button"
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setDatePop(p => (p ? null : { top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 308)) }));
                }}
                title={t('prices:range.pick')}
                className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors ${
                  range === 'custom'
                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                {range === 'custom' ? <span className="font-mono">{fromDate || '…'} — {toDate || '…'}</span> : <span>{t('prices:range.date')}</span>}
              </button>
              {datePop && createPortal(
                <>
                  <div className="fixed inset-0 z-[150]" onClick={() => setDatePop(null)} />
                  <div className="fixed z-[151]" style={{ top: datePop.top, left: datePop.left }}>
                    <DateRangeCalendar
                      from={fromDate}
                      to={toDate}
                      onApply={(f, t) => { setFromDate(f); setToDate(t); setRange('custom'); setPage(1); setDatePop(null); }}
                      onClear={() => { setFromDate(''); setToDate(''); setRange('month'); setPage(1); setDatePop(null); }}
                    />
                  </div>
                </>,
                document.body
              )}
            </div>
          </div>

          {/* كروت الأقسام الصغيرة المنزلقة: كل قسم وحده */}
          <div className="px-4 py-3 border-b border-slate-200/90 dark:border-slate-800 flex gap-2 overflow-x-auto snap-x snap-mandatory [scrollbar-width:thin]">
            {[{ key: 'all' as const }, ...CATEGORIES].map(c => {
              const isActive = c.key === category;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => { setCategory(c.key); setPage(1); }}
                  className={`snap-start shrink-0 min-w-[130px] flex-1 flex items-center justify-center px-3 py-2 rounded-2xl border text-start transition-all cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-teal-600 border-teal-600 ring-2 ring-teal-500/25 shadow-md'
                      : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/90 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'
                  }`}
                >
                  <div className="min-w-0 text-center">
                    <div className={`text-[12px] font-black truncate ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{t(`prices:category.${c.key}`)}</div>
                    <div className={`text-[10px] font-mono font-bold truncate ${isActive ? 'text-teal-100' : 'text-slate-400'}`}>
                      {formatNumber(c.key === 'all' ? allTotal : categoryTotals[c.key] || 0)} <span className="font-sans">{t('common:units.liter')}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* الجدول: ارتفاع ثابت بقدر 10 صفوف حتى لا يتغير حجم الكارت (والكروت الجانبية) عند قسم فارغ */}
          <div className="flex-1 min-h-[490px] overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-extrabold whitespace-nowrap">
                  <th className="px-4 py-3">{t('prices:table.receiver')}</th>
                  <th className="px-4 py-3">{t('prices:table.product')}</th>
                  <th className="px-4 py-3">{t('prices:table.inbound')} <span className="font-medium text-slate-400">({t('common:units.liter')})</span></th>
                  <th className="px-4 py-3">{t('prices:table.avgPrice')} <span className="font-medium text-slate-400">({t('common:units.iqd')})</span></th>
                  <th className="px-4 py-3">{t('prices:table.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">{t((isAll ? allTotal : categoryTotals[category]) ? 'prices:table.emptyRange' : 'prices:table.emptyCategory')}</td>
                  </tr>
                ) : (
                  pageRows.map(r => (
                    <tr key={r.key} className="hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors whitespace-nowrap">
                      <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100">{enumText(r.company)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-black ring-1 ${productBadge(r.product)}`}>{enumText(r.product)}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatNumber(r.inbound)}</td>
                      <td className="px-4 py-2.5 font-mono font-bold tabular-nums text-slate-800 dark:text-slate-200">{fmtPrice(avgPrice(r))}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-500 dark:text-slate-400">{r.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-t-2 border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white whitespace-nowrap">
                    <td className="px-4 py-3" colSpan={2}>{t('prices:table.total')} <span className="text-[10px] font-bold text-slate-400">({t('prices:records', { count: rows.length })})</span></td>
                    <td className="px-4 py-3 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatNumber(totals.inbound)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{fmtPrice(totals.price)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ترقيم الصفحات */}
          {/* ترقيم الصفحات ظاهر دائمًا (ولو صفحة واحدة) لثبات الارتفاع */}
          {(
            <div className="px-4 py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                <Trans
                  t={t}
                  i18nKey="prices:table.showing"
                  values={{ from: rows.length ? startIndex + 1 : 0, to: startIndex + pageRows.length, total: rows.length }}
                  components={{ 1: <b className="font-mono text-slate-900 dark:text-white" />, 2: <b className="font-mono text-teal-700 dark:text-teal-400" /> }}
                />
              </span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPage(safePage - 1)} disabled={safePage === 1} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer" aria-label={t('prices:table.prev')}>
                  {rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <span className="font-mono font-bold px-2">{safePage} / {totalPages}</span>
                <button type="button" onClick={() => setPage(safePage + 1)} disabled={safePage === totalPages} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer" aria-label={t('prices:table.next')}>
                  {rtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* كروت أسعار الوقود الستة */}
        <div className="xl:col-span-3 min-w-0">
          <FuelMetricsGrid layout="side" />
        </div>
      </div>

      {/* ── القسم 2: حركة الوارد والسعر (تكبير وسحب، تجميع، متوسط متحرك، مقارنة، تصدير، ملء الشاشة) ── */}
      <PurchasesChart rows={rows} prevRows={prevRows} prevShift={prevShift} isAll={isAll} title={activeTitle} onPickRange={pickRange} />

      {/* ── القسم 3: مؤشرات أسعار الشركات والموردين ── */}
      <PriceIndexTable />
    </div>
  );
};

export default PricesView;
