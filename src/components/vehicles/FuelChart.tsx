/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { formatDay, type DayFill, type VehicleStat } from '../../lib/vehicleFuel';

type Mode = 'compare' | 'trend';

/** رسم بياني: الكمية الحالية مقابل السابقة لأعلى 10 عربات، أو الإجمالي اليومي عبر الكشوف */
export const FuelChart: React.FC<{ stats: VehicleStat[]; allFills: DayFill[] }> = ({ stats, allFills }) => {
  const [mode, setMode] = useState<Mode>('compare');

  const compare = useMemo(
    () => stats.slice(0, 10).map(s => ({ name: s.vehicle, current: s.last.qty, previous: s.last.prevQty ?? 0 })),
    [stats]
  );
  const trend = useMemo(() => {
    const m = new Map<string, { total: number; vehicles: number; frequent: number }>();
    for (const f of allFills) {
      const d = m.get(f.date) || { total: 0, vehicles: 0, frequent: 0 };
      d.total += f.qty;
      d.vehicles += 1;
      if (f.days !== null && f.days <= 1) d.frequent += 1;
      m.set(f.date, d);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ name: formatDay(d), ...v }));
  }, [allFills]);

  const tip = {
    contentStyle: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12, color: '#e2e8f0', direction: 'rtl' as const },
    labelStyle: { color: '#94a3b8', fontWeight: 700 },
    cursor: { fill: 'rgb(56 189 248 / 0.08)' },
  };

  return (
    <div className="h-full rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" />تحليل الكميات</h3>
        <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
          {([['compare', 'الحالية مقابل السابقة'], ['trend', 'الإجمالي اليومي']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${mode === k ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-[300px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'compare' ? (
            <ComposedChart data={compare} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="vbarA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#6366f1" /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip {...tip} formatter={(v: number, n: string) => [`${v.toLocaleString()} لتر`, n === 'current' ? 'الحالية' : 'السابقة']} />
              <Legend formatter={v => (v === 'current' ? 'الحالية' : 'السابقة')} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="previous" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={18} />
              <Bar dataKey="current" fill="url(#vbarA)" radius={[6, 6, 0, 0]} maxBarSize={18} />
            </ComposedChart>
          ) : (
            <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="vareaA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip {...tip} formatter={(v: number, n: string) => [v.toLocaleString(), n === 'total' ? 'الإجمالي (لتر)' : 'تفويل متكرر']} />
              <Legend formatter={v => (v === 'total' ? 'الإجمالي (لتر)' : 'تفويل متكرر')} wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="l" type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} fill="url(#vareaA)" dot={{ r: 3 }} />
              <Bar yAxisId="r" dataKey="frequent" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={14} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
