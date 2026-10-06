import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Waves, X, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../lib/utils';
import { deliveriesOfSupplier } from '../../lib/archiveSuppliers';
import type { InboundDelivery, SupplierPriceRecord } from '../../types';
import type { Company } from './supplierUi';
import { CompareWaves } from './CompareWaves';
import { CompareRanking } from './CompareRanking';
import { SupplierChartExpanded } from './SupplierChartExpanded';

type Period = 'd30' | 'd90' | 'm12' | 'all';
type Metric = 'qty' | 'tankers' | 'price';
type Mode = 'bars' | 'waves';
type Scope = 'all' | Company;

/** ألوان الموردين في الأمواج: ترتيب فئوي ثابت (مُتحقَّق منه للفاتح والداكن)، ويتبع اللون المورد لا ترتيبه */
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];
const DAY = 86400000;

const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;
const qtyOf = (d: InboundDelivery) => d.receivedQuantity || d.volumeLiters || 0;
const dayOf = (d: InboundDelivery) => (d.receiptUnloadDate || d.date || '').split(' ')[0].replace(/-/g, '/');
const toDate = (day: string) => { const [y, m, dd] = day.split('/').map(Number); return new Date(y, m - 1, dd || 1); };

interface Agg { qty: number; n: number; cost: number; pq: number }
const emptyAgg = (): Agg => ({ qty: 0, n: 0, cost: 0, pq: 0 });
const valueOf = (a: Agg | undefined, metric: Metric): number | null => {
  if (!a || !a.n) return null;
  if (metric === 'qty') return a.qty;
  if (metric === 'tankers') return a.n;
  return a.pq ? Math.round((a.cost / a.pq) * 10) / 10 : null;
};

const Pills = <T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: React.ReactNode }[]; onChange: (v: T) => void }) => (
  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50">
    {options.map(o => (
      <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
        className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${value === o.id ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

/** نافذة مقارنة كل الموردين: أعمدة (عمود لكل مورد) أو أمواج (أعلى 6 موردين عبر الزمن) */
export const SuppliersCompare: React.FC<{ suppliers: SupplierPriceRecord[]; sahara: InboundDelivery[]; etihad: InboundDelivery[]; onClose: () => void }> = ({ suppliers, sahara, etihad, onClose }) => {
  const { t } = useTranslation(['suppliers', 'common']);
  const [period, setPeriod] = useState<Period>('m12');
  const [metric, setMetric] = useState<Metric>('qty');
  const [mode, setMode] = useState<Mode>('bars');
  const [scope, setScope] = useState<Scope>('all');
  // مورد مفتوح من لوحة الترتيب: نافذة تحليل وارده فوق المقارنة
  const [openId, setOpenId] = useState<string | null>(null);
  const openRec = openId ? suppliers.find(s => s.id === openId) ?? null : null;
  const openRows = useMemo(() => {
    if (!openRec?.company) return [];
    const co = openRec.company;
    return deliveriesOfSupplier(co === 'etihad' ? etihad : sahara, d => d, openRec.supplierName).map(d => ({ d, co }));
  }, [openRec, sahara, etihad]);
    const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const palette = dark ? SERIES_DARK : SERIES_LIGHT;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !openId) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, openId]);

  // شحنات كل مورد من أرشيف شركته (مرة واحدة)
  const perSupplier = useMemo(() => {
    return suppliers
      .filter(s => s.company)
      .map(s => ({ s, ds: deliveriesOfSupplier(s.company === 'etihad' ? etihad : sahara, d => d, s.supplierName) }))
      .filter(x => x.ds.length);
  }, [suppliers, sahara, etihad]);

  // الفترة تُحسب من آخر يوم وارد في الأرشيف
  const from = useMemo(() => {
    let last = '';
    perSupplier.forEach(({ ds }) => ds.forEach(d => { const day = dayOf(d); if (day > last) last = day; }));
    if (!last || period === 'all') return '';
    const lt = toDate(last);
    if (period === 'm12') { const f = new Date(lt.getFullYear(), lt.getMonth() - 11, 1); return `${f.getFullYear()}/${String(f.getMonth() + 1).padStart(2, '0')}/01`; }
    const f = new Date(lt.getTime() - (period === 'd30' ? 29 : 89) * DAY);
    return `${f.getFullYear()}/${String(f.getMonth() + 1).padStart(2, '0')}/${String(f.getDate()).padStart(2, '0')}`;
  }, [perSupplier, period]);

  const inScope = useMemo(() => perSupplier
    .filter(x => scope === 'all' || x.s.company === scope)
    .map(x => ({ ...x, ds: from ? x.ds.filter(d => dayOf(d) >= from) : x.ds }))
    .filter(x => x.ds.length), [perSupplier, scope, from]);

  // أعمدة: قيمة كل مورد في الفترة، مرتبة من الأعلى
  const bars = useMemo(() => inScope.map(({ s, ds }) => {
    const a = emptyAgg();
    ds.forEach(d => { a.qty += qtyOf(d); a.n += 1; if (priceOf(d) > 0) { a.cost += qtyOf(d) * priceOf(d); a.pq += qtyOf(d); } });
    return { id: s.id, name: s.supplierName, company: s.company as Company, value: valueOf(a, metric) ?? 0, agg: a };
  }).filter(b => b.value > 0).sort((x, y) => y.value - x.value), [inScope, metric]);

  // الأمواج: كل الموردين في النطاق (شحناتهم وكمياتهم) لمكوّن CompareWaves
  const waveSuppliers = useMemo(() => inScope.map(({ s, ds }) => ({ id: s.id, name: s.supplierName, qty: ds.reduce((a, d) => a + qtyOf(d), 0), ds })), [inScope]);
  const unit = metric === 'qty' ? t('common:units.liter') : metric === 'price' ? t('units.iqdPerLiter') : t('profile.statTankers');
  const fmtVal = (v: number) => (metric === 'price' ? formatNumber(v) : formatNumber(Math.round(v)));

  return (<>
  {openRec && (
    <SupplierChartExpanded name={openRec.supplierName} rows={openRows} initialPeriod={period === 'all' ? 'all' : 'm12'} onClose={() => setOpenId(null)} />
  )}
  {createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-md p-2 sm:p-5 flex animate-[overlayIn_.18s_ease]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('compare.title')} onMouseDown={e => e.stopPropagation()}
        className="relative flex-1 flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] overflow-hidden animate-[dialogIn_.22s_ease]">
        <div className="pointer-events-none absolute -top-10 end-1/4 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl" />

        {/* الرأس */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0 me-auto">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white flex items-center justify-center shadow-sm"><Scale className="w-4.5 h-4.5" /></span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{t('compare.title')}</h2>
              <p className="text-xs text-slate-500 truncate">{t('compare.subtitle', { count: bars.length })}</p>
            </div>
          </div>
          <Pills value={period} onChange={setPeriod} options={[
            { id: 'd30', label: t('profile.period.d30') }, { id: 'd90', label: t('profile.period.d90') },
            { id: 'm12', label: t('profile.period.m12') }, { id: 'all', label: t('profile.period.all') },
          ]} />
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')}
            className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* الأدوات */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 flex flex-wrap items-center gap-2">
          <Pills value={metric} onChange={v => { setMetric(v); }} options={[
            { id: 'qty', label: t('profile.metric.qty') }, { id: 'tankers', label: t('profile.metric.tankers') }, { id: 'price', label: t('profile.metric.price') },
          ]} />
          <Pills value={scope} onChange={v => { setScope(v); }} options={[
            { id: 'all', label: t('compare.allCompanies') }, { id: 'sahara', label: t('receiver.sahara') }, { id: 'etihad', label: t('receiver.etihad') },
          ]} />
          <div className="ms-auto">
            <Pills value={mode} onChange={setMode} options={[
              { id: 'bars', label: <><BarChart3 className="w-3.5 h-3.5" />{t('profile.mode.bars')}</> },
              { id: 'waves', label: <><Waves className="w-3.5 h-3.5" />{t('profile.mode.waves')}</> },
            ]} />
          </div>
        </div>

        {mode === 'waves' ? (
          <CompareWaves suppliers={waveSuppliers} metric={metric} palette={palette} resetKey={`${period}-${scope}-${metric}`} />
        ) : (
          <CompareRanking items={bars} records={suppliers} palette={palette} unit={unit} showShare={metric !== 'price'} fmtVal={fmtVal} onOpen={setOpenId} />
        )}
      </div>
    </div>,
    document.body
  )}
  </>);
};
