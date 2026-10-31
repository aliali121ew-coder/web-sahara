/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Area, AreaChart, Brush, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart as LineIcon, Maximize2, PieChart as PieIcon, X } from 'lucide-react';
import type { DayFill, VehicleRefill } from '../../lib/vehicleFuel';

export const vehicleCard = 'rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';

const SITE_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16'];
const siteColor = (i: number) => SITE_COLORS[i % SITE_COLORS.length];

/** دائرة توزيع كمية العربة على المواقع في الفترة المختارة */
export const SiteDonut: React.FC<{ refills: VehicleRefill[] }> = ({ refills }) => {
  const sites = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of refills) by.set(r.site, (by.get(r.site) || 0) + r.qty);
    return [...by.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [refills]);
  const total = sites.reduce((s, x) => s + x.total, 0);
  const [active, setActive] = useState<number | null>(null);
  const focus = active !== null ? sites[active] : null;

  return (
    <div className={`${vehicleCard} p-4`}>
      <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><PieIcon className="w-4 h-4 text-indigo-500" />توزيع التفويل حسب الموقع</h3>
      {!sites.length ? (
        <div className="h-44 flex items-center justify-center text-sm text-slate-400">لا توجد تفويلات في هذه الفترة</div>
      ) : (
        <>
          <div className="relative w-40 h-40 mx-auto mt-2" onMouseLeave={() => setActive(null)}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart className="outline-none select-none">
                <Pie data={sites} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={74} paddingAngle={sites.length > 1 ? 2 : 0} cornerRadius={4} startAngle={90} endAngle={-270} stroke="none" onMouseEnter={(_, i) => setActive(i)}>
                  {sites.map((s, i) => <Cell key={s.name} fill={siteColor(i)} opacity={active === null || active === i ? 1 : 0.35} style={{ transition: 'opacity .2s', outline: 'none' }} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-lg font-black font-mono leading-none text-slate-900 dark:text-white">{(focus ? focus.total : total).toLocaleString()}</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">لتر</span>
              {focus && <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 font-mono">{Math.round((focus.total / total) * 100)}%</span>}
            </div>
          </div>
          <ul className="mt-2 max-h-[104px] overflow-y-auto vehicle-scroll">
            {sites.map((s, i) => (
              <li key={s.name} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} className={`grid grid-cols-[auto_1fr_auto_2.5rem] items-center gap-2 h-[26px] px-1.5 rounded-lg text-xs transition-colors ${active === i ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: siteColor(i) }} />
                <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{s.name}</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{s.total.toLocaleString()}</span>
                <span className="font-mono font-black text-slate-700 dark:text-slate-200 text-left">{Math.round((s.total / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const TrendTip: React.FC<{ active?: boolean; payload?: { payload: DayFill }[] }> = ({ active, payload }) => {
  const f = payload?.[0]?.payload;
  if (!active || !f) return null;
  return (
    <div dir="rtl" className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg px-3 py-2 text-xs font-cairo">
      <div className="font-mono text-slate-500 dark:text-slate-400">{f.date}</div>
      <div className="mt-0.5 font-black text-slate-900 dark:text-white"><bdi className="font-mono">{f.qty.toLocaleString()}</bdi> لتر{f.parts > 1 && <span className="font-bold text-rose-600 dark:text-rose-400"> · {f.parts} تفويلات</span>}</div>
      <div className="mt-0.5 text-slate-500 dark:text-slate-400">{f.sites.join('، ')}</div>
    </div>
  );
};

/** رسم التفويلات اليومية؛ في النافذة الكبيرة يظهر شريط لتكبير جزء من الفترة */
const TrendChart: React.FC<{ data: DayFill[]; large?: boolean }> = ({ data, large }) => {
  const id = large ? 'vtrendLarge' : 'vtrend';
  return (
    <div dir="ltr" className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgb(148 163 184 / 0.18)" />
          <XAxis dataKey="date" tickFormatter={d => String(d).slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis width={44} tickFormatter={v => Number(v).toLocaleString()} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip content={<TrendTip />} cursor={{ stroke: '#6366f1', strokeOpacity: 0.3 }} />
          <Area type="monotone" dataKey="qty" stroke="#6366f1" strokeWidth={2.5} fill={`url(#${id})`} dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          {large && data.length > 8 && <Brush dataKey="date" height={26} stroke="#6366f1" travellerWidth={8} tickFormatter={d => String(d).slice(5)} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/** كارت الرسم الخطي للتفويلات في الفترة المختارة، وزر التكبير يفتح الرسم مع قائمة تفويلات الفترة */
export const RefillTrend: React.FC<{ fills: DayFill[]; period: string }> = ({ fills, period }) => {
  const [open, setOpen] = useState(false);
  const data = useMemo(() => [...fills].sort((a, b) => a.date.localeCompare(b.date)), [fills]);
  const total = data.reduce((s, f) => s + f.qty, 0);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`${vehicleCard} p-4 flex flex-col flex-1`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><LineIcon className="w-4 h-4 text-indigo-500" />التفويلات خلال الفترة</h3>
        <button type="button" disabled={!data.length} onClick={() => setOpen(true)} aria-label="تكبير الرسم" title="تكبير" className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 inline-flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Maximize2 className="w-3.5 h-3.5" /></button>
      </div>
      <div className="relative flex-1 min-h-[230px] mt-3">
        <div className="absolute inset-0">
          {data.length ? <TrendChart data={data} /> : <div className="h-full flex items-center justify-center text-sm text-slate-400">لا توجد تفويلات في هذه الفترة</div>}
        </div>
      </div>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[3px] font-cairo" onClick={() => setOpen(false)}>
          <section role="dialog" aria-label="التفويلات خلال الفترة" className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">التفويلات خلال الفترة</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"><bdi className="font-mono">{period}</bdi> · {data.length} يوم · <bdi className="font-mono">{total.toLocaleString()}</bdi> لتر</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              <div className="h-[360px]"><TrendChart data={data} large /></div>
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                  <tr>{['التاريخ', 'الكمية', 'التفويلات', 'الموقع', 'السائق'].map(h => <th key={h} className="py-2.5 px-3 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {[...data].reverse().map(f => (
                    <tr key={f.date}>
                      <td className="py-2 px-3 font-mono whitespace-nowrap">{f.date}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{f.qty.toLocaleString()} <span className="font-cairo text-slate-400">لتر</span></td>
                      <td className="py-2 px-3 font-mono">{f.parts}</td>
                      <td className="py-2 px-3">{f.sites.join('، ')}</td>
                      <td className="py-2 px-3">{f.drivers.join('، ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
};
