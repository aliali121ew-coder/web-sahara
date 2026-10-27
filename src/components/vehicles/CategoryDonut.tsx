/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import type { VehicleStat } from '../../lib/vehicleFuel';
import { groupByCategory } from './categories';

// تدرّج لكل شريحة (من/إلى) بنفس روح دائرة «توزيع نسب الاستهلاك» في الرئيسية
const PALETTE: [string, string][] = [
  ['#6d28d9', '#8b5cf6'], ['#1d4ed8', '#3b82f6'], ['#0d9488', '#2dd4bf'], ['#c2410c', '#fb923c'],
  ['#be185d', '#f472b6'], ['#0369a1', '#38bdf8'], ['#4d7c0f', '#a3e635'], ['#b45309', '#fbbf24'],
  ['#7c3aed', '#c4b5fd'], ['#0f766e', '#5eead4'], ['#9f1239', '#fb7185'], ['#1e40af', '#93c5fd'],
  ['#15803d', '#86efac'], ['#a16207', '#fde047'], ['#475569', '#94a3b8'], ['#701a75', '#e879f9'],
];

/** دائرة استهلاك فئات العربات: الإجمالي في الوسط، ونسبة كل فئة ولتراتها في الدليل */
export const CategoryDonut: React.FC<{ stats: VehicleStat[]; category: string | null }> = ({ stats, category }) => {
  // بلا فئة مفتوحة: توزيع الفئات؛ مع فئة مفتوحة: توزيع عرباتها (أعلى 9 والباقي مجمّع)
  const all = useMemo(() => groupByCategory(stats), [stats]);
  const open = category ? all.find(g => g.key === category) : undefined;
  const groups = useMemo(() => {
    if (!open) return all.map(g => ({ key: g.key, label: g.label, total: g.total }));
    const sorted = [...open.vehicles].sort((a, b) => b.total - a.total);
    const items = sorted.slice(0, 9).map(v => ({ key: v.vehicle, label: v.vehicle, total: v.total }));
    const rest = sorted.slice(9).reduce((t, v) => t + v.total, 0);
    return rest ? [...items, { key: 'rest', label: `باقي العربات (${sorted.length - 9})`, total: rest }] : items;
  }, [all, open]);
  const total = groups.reduce((t, g) => t + g.total, 0);
  const [active, setActive] = useState<number | null>(null);
  const focus = active !== null ? groups[active] : null;

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"><PieIcon className="w-3.5 h-3.5" /></div>
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{open ? `توزيع ${open.label} حسب العربة` : 'توزيع الاستهلاك حسب الفئة'}</h3>
        </div>
        <span className="font-mono text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40">100%</span>
      </div>

      <div className="relative w-44 h-44 mx-auto mt-3" onMouseLeave={() => setActive(null)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart className="outline-none select-none">
            <defs>
              {PALETTE.map(([a, b], i) => (
                <linearGradient key={i} id={`vcat${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={a} />
                  <stop offset="100%" stopColor={b} />
                </linearGradient>
              ))}
            </defs>
            <Pie data={[{ value: 1 }]} dataKey="value" cx="50%" cy="50%" innerRadius={52} outerRadius={80} fill="rgb(148 163 184 / 0.12)" stroke="none" isAnimationActive={false} />
            <Pie
              data={groups.map(g => ({ name: g.label, value: g.total }))}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={groups.length > 1 ? 1.5 : 0}
              cornerRadius={4}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              onMouseEnter={(_, i) => setActive(i)}
            >
              {groups.map((g, i) => (
                <Cell
                  key={g.key}
                  fill={`url(#vcat${i % PALETTE.length})`}
                  opacity={active === null || active === i ? 1 : 0.35}
                  style={{ transition: 'opacity .2s', outline: 'none', cursor: 'pointer' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-xl font-black font-mono leading-none" style={{ color: focus ? PALETTE[(active ?? 0) % PALETTE.length][0] : undefined }}>
            {(focus ? focus.total : total).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">لتر</span>
          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 mt-0.5 max-w-[90px] truncate">
            {focus ? `${focus.label} · ${total ? Math.round((focus.total / total) * 100) : 0}%` : 'الإجمالي'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
        {groups.map((g, i) => {
          const pct = total ? Math.round((g.total / total) * 1000) / 10 : 0;
          return (
            <button
              key={g.key}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-1.5 text-[11px] rounded-lg px-1.5 py-1 text-right transition-colors cursor-default ${active === i ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `linear-gradient(135deg, ${PALETTE[i % PALETTE.length][0]}, ${PALETTE[i % PALETTE.length][1]})` }} />
              <span className={`font-bold text-slate-700 dark:text-slate-200 truncate flex-1 ${open && g.key !== 'rest' ? 'font-mono' : ''}`} dir={open && g.key !== 'rest' ? 'ltr' : undefined}>{g.label}</span>
              <span className="font-mono font-black text-slate-500 dark:text-slate-400">{pct}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
