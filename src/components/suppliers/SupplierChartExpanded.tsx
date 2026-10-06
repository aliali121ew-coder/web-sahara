import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { Activity, BarChart3, Waves, X, Droplets, Truck, Coins, CalendarRange } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../i18n/format';
import { formatNumber } from '../../lib/utils';
import type { InboundDelivery } from '../../types';
import { COMPANY_COLOR, type Company } from './supplierUi';

interface Row { d: InboundDelivery; co: Company }
export type Period = 'd30' | 'd90' | 'm12' | 'all';
type Metric = 'qty' | 'tankers' | 'price';
type Mode = 'waves' | 'bars';

interface Bucket { key: string; label: string; full: string; sahara: number | null; etihad: number | null; saharaQ: number; etihadQ: number; saharaN: number; etihadN: number }

const DAY = 86400000;
const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;
const qtyOf = (d: InboundDelivery) => d.receivedQuantity || d.volumeLiters || 0;
const dayOf = (d: InboundDelivery) => (d.receiptUnloadDate || d.date || '').split(' ')[0].replace(/-/g, '/');
const toDate = (day: string) => { const [y, m, dd] = day.split('/').map(Number); return new Date(y, m - 1, dd || 1); };
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : formatNumber(Math.round(v)));

/**
 * تجميع شحنات المورد حسب الفترة: يومي لآخر 30/90 يومًا، وشهري لآخر 12 شهرًا أو الكل.
 * الفترة تُحسب من آخر يوم وارد للمورد (لا من اليوم) حتى لا تظهر فارغة لمورد توقف وارده.
 */
export const buildBuckets = (rows: Row[], period: Period, metric: Metric): Bucket[] => {
  const valid = rows.filter(r => /^\d{4}\/\d{2}\/\d{2}$/.test(dayOf(r.d)));
  if (!valid.length) return [];
  const last = valid.reduce((m, r) => (dayOf(r.d) > m ? dayOf(r.d) : m), '');
  const lastTs = toDate(last).getTime();
  const daily = period === 'd30' || period === 'd90';
  const from = period === 'd30' ? lastTs - 29 * DAY : period === 'd90' ? lastTs - 89 * DAY : 0;
  const acc = new Map<string, { q: Record<Company, number>; n: Record<Company, number>; cost: Record<Company, number>; pq: Record<Company, number> }>();
  valid.forEach(({ d, co }) => {
    const day = dayOf(d);
    if (daily && toDate(day).getTime() < from) return;
    const key = daily ? day : day.slice(0, 7);
    const a = acc.get(key) ?? { q: { sahara: 0, etihad: 0 }, n: { sahara: 0, etihad: 0 }, cost: { sahara: 0, etihad: 0 }, pq: { sahara: 0, etihad: 0 } };
    a.q[co] += qtyOf(d); a.n[co] += 1;
    if (priceOf(d) > 0) { a.cost[co] += qtyOf(d) * priceOf(d); a.pq[co] += qtyOf(d); }
    acc.set(key, a);
  });
  // الأيام بلا وارد تظهر صفرًا في العرض اليومي حتى يبقى المحور الزمني متصلًا
  let keys: string[];
  if (daily) {
    keys = [];
    for (let ts = from; ts <= lastTs; ts += DAY) {
      const dt = new Date(ts);
      keys.push(`${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`);
    }
  } else {
    keys = [...acc.keys()].sort();
    if (period === 'm12') keys = keys.slice(-12);
  }
  const multiYear = new Set(keys.map(k => k.slice(0, 4))).size > 1;
  return keys.map(key => {
    const a = acc.get(key);
    const val = (c: Company): number | null => {
      if (!a) return metric === 'price' ? null : 0;
      if (metric === 'qty') return a.q[c];
      if (metric === 'tankers') return a.n[c];
      return a.pq[c] ? Math.round((a.cost[c] / a.pq[c]) * 10) / 10 : null;
    };
    const date = toDate(key);
    return {
      key,
      label: daily ? fmtDate(date, { day: 'numeric', month: 'short' }) : fmtDate(date, multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' }),
      full: daily ? fmtDate(date, { dateStyle: 'medium' }) : fmtDate(date, { month: 'long', year: 'numeric' }),
      sahara: val('sahara'), etihad: val('etihad'),
      saharaQ: a?.q.sahara ?? 0, etihadQ: a?.q.etihad ?? 0, saharaN: a?.n.sahara ?? 0, etihadN: a?.n.etihad ?? 0,
    };
  });
};

const Pills = <T extends string>({ value, options, onChange, size = 'sm' }: { value: T; options: { id: T; label: React.ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) => (
  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50">
    {options.map(o => (
      <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
        className={`flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${size === 'md' ? 'px-3 py-1.5 text-[12.5px]' : 'px-2.5 py-1 text-[11.5px]'} ${value === o.id ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

/** نافذة تحليل الوارد بملء الشاشة لصفحة المورد */
export const SupplierChartExpanded: React.FC<{ name: string; rows: Row[]; initialPeriod?: Period; onClose: () => void }> = ({ name, rows, initialPeriod = 'm12', onClose }) => {
  const { t, i18n } = useTranslation(['suppliers', 'common']);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [metric, setMetric] = useState<Metric>('qty');
  const [mode, setMode] = useState<Mode>('waves');
  const companies = useMemo(() => (['sahara', 'etihad'] as Company[]).filter(c => rows.some(r => r.co === c)), [rows]);
  const [hidden, setHidden] = useState<Set<Company>>(new Set());
  const shown = companies.filter(c => !hidden.has(c));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const data = useMemo(() => buildBuckets(rows, period, metric), [rows, period, metric]);

  // ملخص الفترة المعروضة (للشركات الظاهرة فقط)
  const summary = useMemo(() => {
    const qty = data.reduce((a, b) => a + shown.reduce((s, c) => s + (c === 'sahara' ? b.saharaQ : b.etihadQ), 0), 0);
    const n = data.reduce((a, b) => a + shown.reduce((s, c) => s + (c === 'sahara' ? b.saharaN : b.etihadN), 0), 0);
    const peak = data.reduce<Bucket | null>((m, b) => {
      const v = shown.reduce((s, c) => s + (c === 'sahara' ? b.saharaQ : b.etihadQ), 0);
      const mv = m ? shown.reduce((s, c) => s + (c === 'sahara' ? m.saharaQ : m.etihadQ), 0) : -1;
      return v > mv ? b : m;
    }, null);
    // متوسط السعر الموزون للفترة
    const cut = data.length ? data[0].key : '';
    const priced = rows.filter(r => shown.includes(r.co) && priceOf(r.d) > 0 && dayOf(r.d).slice(0, cut.length) >= cut);
    const pq = priced.reduce((a, r) => a + qtyOf(r.d), 0);
    const avgPrice = pq ? priced.reduce((a, r) => a + qtyOf(r.d) * priceOf(r.d), 0) / pq : 0;
    return { qty, n, peak, avgPrice };
  }, [data, rows, shown]);

  // خط المتوسط: متوسط القيمة لكل فترة (أو متوسط السعر)
  const avgLine = useMemo(() => {
    if (metric === 'price') return summary.avgPrice || undefined;
    const totals = data.map(b => shown.reduce((s, c) => s + ((b[c] as number) || 0), 0)).filter(v => v > 0);
    return totals.length ? totals.reduce((a, v) => a + v, 0) / totals.length : undefined;
  }, [data, shown, metric, summary.avgPrice]);

  const unit = metric === 'qty' ? t('common:units.liter') : metric === 'price' ? t('units.iqdPerLiter') : '';
  const fmtVal = (v: number) => (metric === 'price' ? formatNumber(v) : formatNumber(Math.round(v)));
  const daily = period === 'd30' || period === 'd90';

  const tooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const b = payload[0].payload as Bucket;
    return (
      <div dir={i18n.dir()} className="w-[230px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200/80 dark:border-slate-700 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] overflow-hidden text-start">
        <div className="px-3.5 py-2.5 bg-teal-50/70 dark:bg-teal-950/30 text-[12px] font-semibold text-teal-700 dark:text-teal-300">{b.full}</div>
        <div className="px-3.5 py-2.5 space-y-2">
          {shown.map(c => (
            <div key={c} className="text-[12px]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COMPANY_COLOR[c] }} />
                <span className="font-medium text-slate-700 dark:text-slate-200">{t(`receiver.${c}`)}</span>
                <span className="ms-auto font-semibold text-slate-900 dark:text-white tabular-nums">{b[c] == null ? '—' : fmtVal(b[c] as number)}</span>
              </div>
              <div className="ps-4 text-[10.5px] text-slate-400 tabular-nums">
                {formatNumber(c === 'sahara' ? b.saharaQ : b.etihadQ)} {t('common:units.liter')} · {t('profile.tankersTotal', { count: c === 'sahara' ? b.saharaN : b.etihadN })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const xTicks = { fill: '#64748b', fontSize: 11, fontWeight: 600 };
  const yTicks = { fill: '#64748b', fontSize: 11, fontWeight: 600 };
  const interval = daily ? (period === 'd90' ? 9 : 3) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-md p-2 sm:p-5 flex animate-[overlayIn_.18s_ease]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('profile.analysisTitle')} onMouseDown={e => e.stopPropagation()}
        className="relative flex-1 flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] overflow-hidden animate-[dialogIn_.22s_ease]">
        {/* توهج خلفي هادئ */}
        <div className="pointer-events-none absolute -top-10 end-1/4 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 start-1/4 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl" />

        {/* الرأس */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0 me-auto">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white flex items-center justify-center shadow-sm"><Activity className="w-4.5 h-4.5" /></span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{t('profile.analysisTitle')}</h2>
              <p className="text-xs text-slate-500 truncate">{name}</p>
            </div>
          </div>
          <Pills value={period} onChange={setPeriod} size="md" options={[
            { id: 'd30', label: t('profile.period.d30') }, { id: 'd90', label: t('profile.period.d90') },
            { id: 'm12', label: t('profile.period.m12') }, { id: 'all', label: t('profile.period.all') },
          ]} />
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')}
            className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* ملخص الفترة */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <Droplets className="w-4 h-4" />, tone: 'text-teal-600 bg-teal-500/10', k: t('profile.totalInbound'), v: formatNumber(summary.qty), u: t('common:units.liter') },
            { icon: <Truck className="w-4 h-4" />, tone: 'text-sky-600 bg-sky-500/10', k: t('profile.statTankers'), v: formatNumber(summary.n), u: '' },
            { icon: <Coins className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-500/10', k: t('profile.avgPrice'), v: summary.avgPrice ? formatNumber(Math.round(summary.avgPrice * 10) / 10) : '—', u: summary.avgPrice ? t('units.iqdPerLiter') : '' },
            { icon: <CalendarRange className="w-4 h-4" />, tone: 'text-violet-600 bg-violet-500/10', k: daily ? t('profile.peakDay') : t('profile.peakMonth'), v: summary.peak?.full ?? '—', u: '' },
          ].map(x => (
            <div key={x.k} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3.5 py-3 flex items-center gap-3 min-w-0">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${x.tone}`}>{x.icon}</span>
              <div className="min-w-0">
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{x.k}</div>
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="text-[17px] font-bold text-slate-900 dark:text-white tabular-nums truncate">{x.v}</span>
                  {x.u && <span className="text-[11px] text-slate-400 shrink-0">{x.u}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* أدوات العرض: المقياس ونمط الرسم */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 flex flex-wrap items-center gap-2">
          <Pills value={metric} onChange={setMetric} options={[
            { id: 'qty', label: t('profile.metric.qty') }, { id: 'tankers', label: t('profile.metric.tankers') }, { id: 'price', label: t('profile.metric.price') },
          ]} />
          <div className="ms-auto">
            <Pills value={mode} onChange={setMode} options={[
              { id: 'waves', label: <><Waves className="w-3.5 h-3.5" />{t('profile.mode.waves')}</> },
              { id: 'bars', label: <><BarChart3 className="w-3.5 h-3.5" />{t('profile.mode.bars')}</> },
            ]} />
          </div>
        </div>

        {/* الرسم */}
        <div className="relative flex-1 min-h-[260px] px-2 sm:px-4 pt-3" dir="ltr">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">{t('profile.empty')}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {mode === 'waves' ? (
                <AreaChart data={data} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
                  <defs>
                    {companies.map(c => (
                      <React.Fragment key={c}>
                        <linearGradient id={`exp-fill-${c}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COMPANY_COLOR[c]} stopOpacity={0.26} />
                          <stop offset="70%" stopColor={COMPANY_COLOR[c]} stopOpacity={0.04} />
                          <stop offset="100%" stopColor={COMPANY_COLOR[c]} stopOpacity={0} />
                        </linearGradient>
                        <filter id={`exp-glow-${c}`} x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={COMPANY_COLOR[c]} floodOpacity="0.35" />
                        </filter>
                      </React.Fragment>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={interval} tick={xTicks} dy={6} />
                  <YAxis axisLine={false} tickLine={false} width={48} tick={yTicks} tickFormatter={compact}
                    domain={metric === 'price' ? ['dataMin - 20', 'dataMax + 20'] : [0, 'auto']} />
                  <Tooltip content={tooltip} cursor={{ stroke: '#0d9488', strokeWidth: 1.5, strokeDasharray: '3 3' }} wrapperStyle={{ outline: 'none', zIndex: 20 }} isAnimationActive={false} />
                  {shown.map(c => (
                    <Area key={c} type="monotone" dataKey={c} stroke={COMPANY_COLOR[c]} strokeWidth={2.5} fill={`url(#exp-fill-${c})`} filter={`url(#exp-glow-${c})`}
                      connectNulls dot={false} activeDot={{ r: 6, stroke: COMPANY_COLOR[c], strokeWidth: 3, fill: '#fff' }} />
                  ))}
                  {avgLine !== undefined && <ReferenceLine y={avgLine} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.5} />}
                </AreaChart>
              ) : (
                <BarChart data={data} margin={{ top: 16, right: 16, left: 4, bottom: 4 }} barGap={3}>
                  <defs>
                    {companies.map(c => (
                      <linearGradient key={c} id={`exp-bar-${c}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COMPANY_COLOR[c]} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={COMPANY_COLOR[c]} stopOpacity={0.45} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={interval} tick={xTicks} dy={6} />
                  <YAxis axisLine={false} tickLine={false} width={48} tick={yTicks} tickFormatter={compact}
                    domain={metric === 'price' ? ['dataMin - 20', 'dataMax + 20'] : [0, 'auto']} />
                  <Tooltip content={tooltip} cursor={{ fill: 'rgba(148,163,184,0.1)' }} wrapperStyle={{ outline: 'none', zIndex: 20 }} isAnimationActive={false} />
                  {shown.map(c => (
                    <Bar key={c} dataKey={c} fill={`url(#exp-bar-${c})`} radius={[6, 6, 0, 0]} maxBarSize={daily ? 14 : 34} />
                  ))}
                  {avgLine !== undefined && <ReferenceLine y={avgLine} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.5} />}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* التذييل: إظهار/إخفاء كل شركة وشرح خط المتوسط */}
        <div className="relative shrink-0 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-2">
            {companies.map(c => {
              const on = !hidden.has(c);
              return (
                <button key={c} type="button" aria-pressed={on} title={t('profile.toggleSeries')}
                  onClick={() => setHidden(prev => { const n = new Set(prev); if (n.has(c)) n.delete(c); else if (shown.length > 1) n.add(c); return n; })}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${on ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm' : 'opacity-45 line-through bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500'}`}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMPANY_COLOR[c] }} />{t(`receiver.${c}`)}
                </button>
              );
            })}
          </div>
          {avgLine !== undefined && (
            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="w-5 border-t-2 border-dashed border-slate-400" />
              {t('profile.avgLine')}: <b className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{fmtVal(avgLine)}</b> {unit}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
