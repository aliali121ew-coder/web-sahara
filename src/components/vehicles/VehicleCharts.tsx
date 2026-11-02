import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Area, Brush, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Flame, LineChart as LineIcon, Maximize2, PieChart as PieIcon, X } from 'lucide-react';
import { consumptionBySite, consumptionTrend, type DayFill, type FillConsumption, type TrendPoint, type VehicleRefill } from '../../lib/vehicleFuel';
import { fmtNumber } from '../../i18n/format';
import { siteName } from '../../i18n/enums';

export const vehicleCard = 'rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';

const SITE_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16'];
const siteColor = (i: number) => SITE_COLORS[i % SITE_COLORS.length];
/** الكميات قد تكون كسورًا بعد توزيع الاستهلاك على المواقع */
const liters = (v: number) => fmtNumber(v, { maximumFractionDigits: 1 });

interface SiteRow { name: string; total: number }

/** دائرة توزيع كمية على المواقع */
const SiteDonut: React.FC<{ title: string; icon: React.ReactNode; empty: string; sites: SiteRow[]; colorOf: (site: string) => string }> = ({ title, icon, empty, sites, colorOf }) => {
  const { t } = useTranslation('vehicles');
  const total = sites.reduce((s, x) => s + x.total, 0);
  const [active, setActive] = useState<number | null>(null);
  const focus = active !== null ? sites[active] : null;

  return (
    <div className={`${vehicleCard} p-4 min-w-0`}>
      <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">{icon}{title}</h3>
      {!sites.length ? (
        <div className="h-44 flex items-center justify-center text-center text-sm text-slate-400 px-2">{empty}</div>
      ) : (
        <>
          <div className="relative w-40 h-40 mx-auto mt-2" onMouseLeave={() => setActive(null)}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart className="outline-none select-none">
                <Pie data={sites} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={74} paddingAngle={sites.length > 1 ? 2 : 0} cornerRadius={4} startAngle={90} endAngle={-270} stroke="none" onMouseEnter={(_, i) => setActive(i)}>
                  {sites.map((s, i) => <Cell key={s.name} fill={colorOf(s.name)} opacity={active === null || active === i ? 1 : 0.35} style={{ transition: 'opacity .2s', outline: 'none' }} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-lg font-black font-mono leading-none text-slate-900 dark:text-white">{liters(focus ? focus.total : total)}</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">{t('liter')}</span>
              {focus && <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 font-mono">{Math.round((focus.total / total) * 100)}%</span>}
            </div>
          </div>
          <ul className="mt-2 max-h-[104px] overflow-y-auto vehicle-scroll">
            {sites.map((s, i) => (
              <li key={s.name} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} className={`grid grid-cols-[auto_1fr_auto_2.5rem] items-center gap-2 h-[26px] px-1.5 rounded-lg text-xs transition-colors ${active === i ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: colorOf(s.name) }} />
                <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{siteName(s.name)}</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{liters(s.total)}</span>
                <span className="font-mono font-black text-slate-700 dark:text-slate-200 text-left">{Math.round((s.total / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

/** دائرتا التفويل والاستهلاك في الفترة المختارة؛ لون الموقع واحد في الدائرتين */
export const VehicleDonuts: React.FC<{ refills: VehicleRefill[]; allRefills: VehicleRefill[]; consumption: FillConsumption[] }> = ({ refills, allRefills, consumption }) => {
  const { t } = useTranslation('vehicles');
  const fuelSites = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of refills) by.set(r.site, (by.get(r.site) || 0) + r.qty);
    return [...by.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [refills]);
  const usedSites = useMemo(() => consumptionBySite(consumption, allRefills), [consumption, allRefills]);
  const colorOf = useMemo(() => {
    const order = [...new Set([...fuelSites, ...usedSites].map(s => s.name))];
    return (site: string) => siteColor(order.indexOf(site));
  }, [fuelSites, usedSites]);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))] gap-5">
      <SiteDonut title={t('donut.fuelTitle')} icon={<PieIcon className="w-4 h-4 text-indigo-500 shrink-0" />} empty={t('donut.fuelEmpty')} sites={fuelSites} colorOf={colorOf} />
      <SiteDonut title={t('donut.consumptionTitle')} icon={<Flame className="w-4 h-4 text-teal-600 dark:text-teal-500 shrink-0" />} empty={t('donut.consumptionEmpty')} sites={usedSites} colorOf={colorOf} />
    </div>
  );
};

const TrendTip: React.FC<{ active?: boolean; payload?: { payload: TrendPoint }[] }> = ({ active, payload }) => {
  const { t, i18n } = useTranslation('vehicles');
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div dir={i18n.dir()} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg px-3 py-2 text-xs font-cairo">
      <div className="font-mono text-slate-500 dark:text-slate-400">{p.date}</div>
      {p.qty !== null && <div className="mt-0.5 font-black text-slate-900 dark:text-white"><bdi className="font-mono">{liters(p.qty)}</bdi> {t('liter')}{p.fill && p.fill.parts > 1 && <span className="font-bold text-rose-600 dark:text-rose-400"> · {t('trend.fills', { count: p.fill.parts })}</span>}</div>}
      {p.consumed !== null && <div className="mt-0.5 font-bold text-teal-700 dark:text-teal-400">{t('trend.spentUntil', { value: liters(p.consumed), date: p.until })}</div>}
      {p.remaining !== null && <div className="mt-0.5 font-bold text-slate-600 dark:text-slate-300">{t('trend.remaining', { value: liters(p.remaining) })}</div>}
      <div className="mt-0.5 text-slate-500 dark:text-slate-400">{p.site.split('، ').map(siteName).join('، ')}</div>
      {!p.fill && <div className="mt-0.5 text-slate-400">{t('trend.prevFill')}</div>}
    </div>
  );
};

/** رسم التفويل والاستهلاك؛ في النافذة الكبيرة يظهر شريط لتكبير جزء من الفترة */
const TrendChart: React.FC<{ data: TrendPoint[]; large?: boolean }> = ({ data, large }) => {
  const id = large ? 'vtrendLarge' : 'vtrend';
  return (
    <div dir="ltr" className="w-full h-full text-teal-600 dark:text-teal-500">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgb(148 163 184 / 0.18)" />
          <XAxis dataKey="date" tickFormatter={d => String(d).slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis width={44} tickFormatter={v => fmtNumber(Number(v))} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip content={<TrendTip />} cursor={{ stroke: '#6366f1', strokeOpacity: 0.3 }} />
          {/* بلا حركة: النقاط لا تُرسم إلا بعد انتهائها، ونقطة استهلاك وحيدة هي كل ما يظهر من الخط */}
          <Area type="monotone" dataKey="qty" isAnimationActive={false} stroke="#6366f1" strokeWidth={2.5} fill={`url(#${id})`} dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="consumed" isAnimationActive={false} connectNulls stroke="currentColor" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: 'currentColor', strokeWidth: 0 }} activeDot={{ r: 5, fill: 'currentColor' }} />
          {large && data.length > 8 && <Brush dataKey="date" height={26} stroke="#6366f1" travellerWidth={8} tickFormatter={d => String(d).slice(5)} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

/** مفتاح الخطين: الخط المتصل للتفويل والمتقطع للاستهلاك، مع إجمالي كل منهما */
const TrendLegend: React.FC<{ fuel: number; used: number; hasUsed: boolean }> = ({ fuel, used, hasUsed }) => {
  const { t } = useTranslation('vehicles');
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
      <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full bg-indigo-500" />{t('trend.fuel')} <bdi className="font-mono">{liters(fuel)}</bdi></span>
      <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-teal-600 dark:border-teal-500" />{t('trend.consumption')} <bdi className="font-mono">{hasUsed ? liters(used) : '—'}</bdi></span>
    </div>
  );
};

/** كارت الرسم الخطي للتفويل والاستهلاك في الفترة المختارة، وزر التكبير يفتح الرسم مع قائمة الفترة */
export const RefillTrend: React.FC<{ fills: DayFill[]; consumption: FillConsumption[]; period: string }> = ({ fills, consumption, period }) => {
  const { t } = useTranslation('vehicles');
  const [open, setOpen] = useState(false);
  const data = useMemo(() => consumptionTrend(fills, consumption), [fills, consumption]);
  const total = fills.reduce((s, f) => s + f.qty, 0);
  // المجموع من التفويلات لا من نقاط الرسم، ليطابق كارت الاستهلاك
  const counted = consumption.filter(c => c.consumed !== null);
  const used = counted.reduce((s, c) => s + (c.consumed ?? 0), 0);
  const hasLine = data.some(p => p.consumed !== null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`${vehicleCard} p-4 flex flex-col flex-1`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><LineIcon className="w-4 h-4 text-indigo-500" />{t('trend.title')}</h3>
        <button type="button" disabled={!data.length} onClick={() => setOpen(true)} aria-label={t('trend.enlarge')} title={t('trend.enlargeShort')} className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 inline-flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Maximize2 className="w-3.5 h-3.5" /></button>
      </div>
      {!!data.length && <div className="mt-2"><TrendLegend fuel={total} used={used} hasUsed={!!counted.length} /></div>}
      <div className="relative flex-1 min-h-[230px] mt-3">
        <div className="absolute inset-0">
          {data.length ? <TrendChart data={data} /> : <div className="h-full flex items-center justify-center text-sm text-slate-400">{t('trend.empty')}</div>}
        </div>
      </div>
      {!!data.length && <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{t(hasLine ? 'trend.hint' : 'trend.noConsumption')}</p>}

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[3px] font-cairo" onClick={() => setOpen(false)}>
          <section role="dialog" aria-label={t('trend.title')} className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">{t('trend.title')}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"><bdi className="font-mono">{period}</bdi> · {t('trend.summary', { days: fills.length, fuel: liters(total), consumption: counted.length ? liters(used) : '—' })}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('trend.close')} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              <TrendLegend fuel={total} used={used} hasUsed={!!counted.length} />
              <div className="h-[360px]"><TrendChart data={data} large /></div>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                    <tr>{(['date', 'qty', 'consumed', 'remaining', 'parts', 'site', 'driver'] as const).map(c => <th key={c} className="py-2.5 px-3 font-bold text-start whitespace-nowrap">{t(`trend.col.${c}`)}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {[...data].reverse().map(p => (
                      <tr key={p.date}>
                        <td className="py-2 px-3 font-mono whitespace-nowrap">{p.date}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{p.qty !== null ? liters(p.qty) : '—'} <span className="font-cairo text-slate-400">{t('liter')}</span></td>
                        <td className="py-2 px-3 font-mono whitespace-nowrap">{p.consumed !== null ? liters(p.consumed) : '—'}</td>
                        <td className="py-2 px-3 font-mono whitespace-nowrap">{p.remaining !== null ? liters(p.remaining) : '—'}</td>
                        <td className="py-2 px-3 font-mono">{p.fill?.parts ?? '—'}</td>
                        <td className="py-2 px-3 min-w-[7rem]">{p.site.split('، ').map(siteName).join('، ')}</td>
                        <td className="py-2 px-3 min-w-[7rem]">{p.fill?.drivers.join('، ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
};
