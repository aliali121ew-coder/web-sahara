import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, Waves, X, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../lib/utils';
import { deliveriesOfSupplier } from '../../lib/archiveSuppliers';
import type { InboundDelivery, SupplierPriceRecord } from '../../types';
import type { Company } from './supplierUi';
import { CompareWaves } from './CompareWaves';

type Period = 'd30' | 'd90' | 'm12' | 'all';
type Metric = 'qty' | 'tankers' | 'price';
type Mode = 'bars' | 'waves';
type Scope = 'all' | Company;

/** ألوان الموردين في الأمواج: ترتيب فئوي ثابت (مُتحقَّق منه للفاتح والداكن)، ويتبع اللون المورد لا ترتيبه */
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];
const ACCENT = '#0d9488';
const DAY = 86400000;

const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;
const qtyOf = (d: InboundDelivery) => d.receivedQuantity || d.volumeLiters || 0;
const dayOf = (d: InboundDelivery) => (d.receiptUnloadDate || d.date || '').split(' ')[0].replace(/-/g, '/');
const toDate = (day: string) => { const [y, m, dd] = day.split('/').map(Number); return new Date(y, m - 1, dd || 1); };
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : formatNumber(Math.round(v)));

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
  const { t, i18n } = useTranslation(['suppliers', 'common']);
  const [period, setPeriod] = useState<Period>('m12');
  const [metric, setMetric] = useState<Metric>('qty');
  const [mode, setMode] = useState<Mode>('bars');
  const [scope, setScope] = useState<Scope>('all');
  const [hover, setHover] = useState<number | null>(null);
    const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const palette = dark ? SERIES_DARK : SERIES_LIGHT;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

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
  const active = hover ?? 0;
  const cur = bars[active];
  const total = bars.reduce((a, b) => a + b.value, 0);
  const tickName = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name);

  return createPortal(
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
          <Pills value={metric} onChange={v => { setMetric(v); setHover(null); }} options={[
            { id: 'qty', label: t('profile.metric.qty') }, { id: 'tankers', label: t('profile.metric.tankers') }, { id: 'price', label: t('profile.metric.price') },
          ]} />
          <Pills value={scope} onChange={v => { setScope(v); setHover(null); }} options={[
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
        ) : (<>
        {/* قيمة المورد المحدد */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-3 min-h-[34px] flex flex-wrap items-center gap-2">
          {cur && (
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{cur.name}</span>
              <span className="kpi-num text-[20px] text-slate-900 dark:text-white">{fmtVal(cur.value)}</span>
              <span className="text-[12px] text-slate-400">{unit}{metric !== 'price' && total ? ` · ${Math.round((cur.value / total) * 1000) / 10}%` : ''}</span>
            </div>
          )}
        </div>

        {/* الرسم */}
        <div className="relative flex-1 min-h-[280px] px-2 sm:px-4 pt-2 pb-3" dir="ltr">
          {bars.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">{t('profile.empty')}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" debounce={60}>
                <BarChart data={bars} margin={{ top: 16, right: 8, left: 4, bottom: 8 }} barCategoryGap="22%"
                  onMouseMove={(s: { activeTooltipIndex?: number | string | null }) => setHover(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
                  onMouseLeave={() => setHover(null)}>
                  <defs>
                    <linearGradient id="cmp-soft" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0.08} />
                    </linearGradient>
                    <linearGradient id="cmp-active" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={1} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#94a3b8" strokeOpacity={0.18} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} height={70} angle={-35} textAnchor="end"
                    tickFormatter={tickName} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={compact} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    domain={metric === 'price' ? ['dataMin - 40', 'dataMax + 20'] : [0, 'auto']} />
                  <Tooltip cursor={false} isAnimationActive={false} wrapperStyle={{ outline: 'none', zIndex: 20 }}
                    content={({ active: on, payload }: any) => {
                      if (!on || !payload?.length) return null;
                      const b = payload[0].payload as (typeof bars)[number];
                      const avg = b.agg.pq ? Math.round((b.agg.cost / b.agg.pq) * 10) / 10 : 0;
                      return (
                        <div dir={i18n.dir()} className="w-[230px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200/80 dark:border-slate-700 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] overflow-hidden text-start">
                          <div className="px-3.5 py-2.5 bg-teal-50/70 dark:bg-teal-950/30">
                            <div className="text-[12px] font-semibold text-slate-900 dark:text-white truncate">{b.name}</div>
                            <div className="text-[11px] text-teal-700 dark:text-teal-300">{t(`receiver.${b.company}`)}</div>
                          </div>
                          <div className="px-3.5 py-2.5 grid grid-cols-3 gap-2">
                            {[[t('profile.metric.qty'), formatNumber(b.agg.qty)], [t('profile.metric.tankers'), formatNumber(b.agg.n)], [t('profile.metric.price'), avg ? formatNumber(avg) : '—']].map(([k, v]) => (
                              <div key={k} className="min-w-0">
                                <div className="text-[10px] text-slate-400 truncate">{k}</div>
                                <div className="kpi-num text-[13px] text-slate-900 dark:text-white truncate">{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }} />
                  <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={40} isAnimationActive={false}
                    label={({ x, y, width, index }: { x?: number | string; y?: number | string; width?: number | string; index?: number }) =>
                      index === active ? <circle cx={Number(x) + Number(width) / 2} cy={Number(y)} r={4.5} fill="#fff" stroke={ACCENT} strokeWidth={2.5} /> : <g />}>
                    {bars.map((b, i) => <Cell key={b.id} fill={i === active ? 'url(#cmp-active)' : 'url(#cmp-soft)'} />)}
                  </Bar>
                </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        </>)}
      </div>
    </div>,
    document.body
  );
};
