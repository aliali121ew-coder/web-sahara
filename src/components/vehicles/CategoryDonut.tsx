/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PieChart as PieIcon, ChevronDown } from 'lucide-react';
import type { VehicleStat } from '../../lib/vehicleFuel';
import { groupByCategory, useCategoryNames, useVehicleNames } from './categories';

// تدرّج لكل شريحة (من/إلى) بنفس روح دائرة «توزيع نسب الاستهلاك» في الرئيسية
/** عدد الشرائح الظاهرة قبل «عرض الكل»؛ الباقي يُجمّع في شريحة رمادية */
const TOP = 4;
const REST: [string, string] = ['#64748b', '#94a3b8'];

const PALETTE: [string, string][] = [
  ['#6d28d9', '#8b5cf6'], ['#1d4ed8', '#3b82f6'], ['#0d9488', '#2dd4bf'], ['#c2410c', '#fb923c'],
  ['#be185d', '#f472b6'], ['#0369a1', '#38bdf8'], ['#4d7c0f', '#a3e635'], ['#b45309', '#fbbf24'],
  ['#7c3aed', '#c4b5fd'], ['#0f766e', '#5eead4'], ['#9f1239', '#fb7185'], ['#1e40af', '#93c5fd'],
  ['#15803d', '#86efac'], ['#a16207', '#fde047'], ['#475569', '#94a3b8'], ['#701a75', '#e879f9'],
];

/** دائرة استهلاك فئات العربات: الإجمالي في الوسط، ونسبة كل فئة ولتراتها في الدليل */
export const CategoryDonut: React.FC<{ stats: VehicleStat[]; category: string | null }> = ({ stats, category }) => {
  // بلا فئة مفتوحة: توزيع الفئات؛ مع فئة مفتوحة: توزيع عرباتها (أعلى 9 والباقي مجمّع)
  const names = useVehicleNames();
  const [labels] = useCategoryNames();
  const all = useMemo(() => groupByCategory(stats, names, labels), [stats, names, labels]);
  const open = category ? all.find(g => g.key === category) : undefined;
  const full = useMemo(() => (open
    ? [...open.vehicles].sort((a, b) => b.total - a.total).map(v => ({ key: v.vehicle, label: names.get(v.vehicle) || v.vehicle, total: v.total }))
    : all.map(g => ({ key: g.key, label: g.label, total: g.total }))), [all, open, names]);
  // مختصر: أعلى 4 والباقي في سطر واحد، و«عرض الكل» يفتح القائمة كاملة
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [category]);
  const groups = useMemo(() => {
    if (expanded || full.length <= TOP + 1) return full;
    const rest = full.slice(TOP);
    return [...full.slice(0, TOP), { key: 'rest', label: `${rest.length} ${open ? 'عربة' : 'فئة'} أخرى`, total: rest.reduce((t, g) => t + g.total, 0) }];
  }, [full, expanded, open]);
  const colorOf = (i: number) => (groups[i]?.key === 'rest' ? REST : PALETTE[i % PALETTE.length]);
  const total = groups.reduce((t, g) => t + g.total, 0);
  const max = Math.max(1, ...groups.map(g => g.total));

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
              <linearGradient id="vcatRest" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={REST[0]} /><stop offset="100%" stopColor={REST[1]} /></linearGradient>
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
                  fill={g.key === 'rest' ? 'url(#vcatRest)' : `url(#vcat${i % PALETTE.length})`}
                  opacity={active === null || active === i ? 1 : 0.35}
                  style={{ transition: 'opacity .2s', outline: 'none', cursor: 'pointer' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-xl font-black font-mono leading-none" style={{ color: focus ? colorOf(active ?? 0)[0] : undefined }}>
            {(focus ? focus.total : total).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">لتر</span>
          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 mt-0.5 max-w-[90px] truncate">
            {focus ? `${focus.label} · ${total ? Math.round((focus.total / total) * 100) : 0}%` : 'الإجمالي'}
          </span>
        </div>
      </div>

      {/* دليل مرتب بأشرطة: اسم الفئة ونسبتها وشريط بطولها مقارنةً بالأكبر */}
      <div className="mt-3 space-y-2">
        {groups.map((g, i) => {
          const pct = total ? Math.round((g.total / total) * 1000) / 10 : 0;
          const [c0, c1] = colorOf(i);
          return (
            <div
              key={g.key}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`rounded-lg px-1.5 py-1 transition-colors ${active === i ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={`font-bold text-slate-700 dark:text-slate-200 truncate ${open && g.key !== 'rest' ? 'font-mono' : ''}`} dir={open && g.key !== 'rest' ? 'ltr' : undefined}>{g.label}</span>
                <span className="font-mono font-black text-slate-500 dark:text-slate-400 shrink-0">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full vehicle-fill" style={{ width: `${Math.max(2, (g.total / max) * 100)}%`, background: `linear-gradient(90deg, ${c1}, ${c0})` }} />
              </div>
            </div>
          );
        })}
      </div>
      {full.length > TOP + 1 && (
        <button type="button" onClick={() => setExpanded(e => !e)} className="mt-2 flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer">
          {expanded ? 'عرض مختصر' : `عرض كل ${open ? 'العربات' : 'الفئات'} (${full.length})`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
};
