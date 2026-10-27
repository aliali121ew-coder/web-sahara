/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PieChart as PieIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import type { VehicleStat } from '../../lib/vehicleFuel';
import { groupByCategory, useCategoryNames, useVehicleNames } from './categories';

// تدرّج لكل شريحة (من/إلى) بنفس روح دائرة «توزيع نسب الاستهلاك» في الرئيسية
/** سطور الدليل في كل صفحة: الكارت يحافظ على حجمه، والباقي بالتنقل بين الصفحات */
const LEGEND_PAGE = 6;

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
  const groups = full;
  const [legendPage, setLegendPage] = useState(0);
  useEffect(() => setLegendPage(0), [category]);
  const legendPages = Math.max(1, Math.ceil(groups.length / LEGEND_PAGE));
  const legendStart = legendPage * LEGEND_PAGE;
  const colorOf = (i: number) => PALETTE[i % PALETTE.length];
  const total = groups.reduce((t, g) => t + g.total, 0);

  const [active, setActive] = useState<number | null>(null);
  const focus = active !== null ? groups[active] : null;

  return (
    <div className="shrink-0 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card">
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
          <span className="text-xl font-black font-mono leading-none" style={{ color: focus ? colorOf(active ?? 0)[0] : undefined }}>
            {(focus ? focus.total : total).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">لتر</span>
          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 mt-0.5 max-w-[90px] truncate">
            {focus ? `${focus.label} · ${total ? Math.round((focus.total / total) * 100) : 0}%` : 'الإجمالي'}
          </span>
        </div>
      </div>

      {/* دليل هادئ: نقطة بلون الشريحة، الاسم، اللترات، والنسبة — بلا أشرطة */}
      <div className="mt-3 h-[228px] flex flex-col">
        {groups.slice(legendStart, legendStart + LEGEND_PAGE).map((g, k) => {
          const i = legendStart + k;
          const pct = total ? Math.round((g.total / total) * 1000) / 10 : 0;
          const [c0] = colorOf(i);
          return (
            <div
              key={g.key}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-2.5 h-[38px] px-2 rounded-lg text-xs transition-colors border-b border-slate-100 dark:border-slate-800/70 last:border-b-0 ${active === i ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c0 }} />
              <span className={`flex-1 min-w-0 font-bold text-slate-700 dark:text-slate-200 truncate ${open ? 'font-mono' : ''}`} dir={open ? 'ltr' : undefined}>{g.label}</span>
              <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0">{g.total.toLocaleString()} L</span>
              <span className="font-mono font-black text-slate-600 dark:text-slate-300 shrink-0 w-12 text-left">{pct}%</span>
            </div>
          );
        })}
      </div>
      {legendPages > 1 && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-bold">{legendStart + 1}–{Math.min(groups.length, legendStart + LEGEND_PAGE)} من {groups.length} {open ? 'عربة' : 'فئة'}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={legendPage === 0} onClick={() => setLegendPage(p => p - 1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" aria-label="السابقة"><ChevronRight className="w-4 h-4" /></button>
            <span className="font-mono font-bold">{legendPage + 1} / {legendPages}</span>
            <button type="button" disabled={legendPage >= legendPages - 1} onClick={() => setLegendPage(p => p + 1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" aria-label="التالية"><ChevronLeft className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
};
