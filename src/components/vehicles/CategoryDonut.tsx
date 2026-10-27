/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import type { VehicleStat } from '../../lib/vehicleFuel';
import { groupByCategory, useCategoryNames, useVehicleNames } from './categories';

// تدرّج لكل شريحة (من/إلى) بنفس روح دائرة «توزيع نسب الاستهلاك» في الرئيسية
/** سطور الدليل في كل صفحة: الكارت يحافظ على حجمه، والباقي بالتنقل بين الصفحات */
const LEGEND_PAGE = 6;
/** الشرائح الملوّنة في الدائرة؛ الباقي شريحة رمادية واحدة (تجنّب مئات الشرائح الرفيعة) */
const SLICES = 5;
const REST: [string, string] = ['#94a3b8', '#cbd5e1'];

const PALETTE: [string, string][] = [
  ['#6d28d9', '#8b5cf6'], ['#1d4ed8', '#3b82f6'], ['#0d9488', '#2dd4bf'], ['#c2410c', '#fb923c'],
  ['#be185d', '#f472b6'], ['#0369a1', '#38bdf8'], ['#4d7c0f', '#a3e635'], ['#b45309', '#fbbf24'],
  ['#7c3aed', '#c4b5fd'], ['#0f766e', '#5eead4'], ['#9f1239', '#fb7185'], ['#1e40af', '#93c5fd'],
  ['#15803d', '#86efac'], ['#a16207', '#fde047'], ['#475569', '#94a3b8'], ['#701a75', '#e879f9'],
];

/** توزيع استهلاك فئات العربات (أو عربات الفئة المفتوحة): شريط واحد مقسّم وجدول مرتب بصفحات */
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
  const slices = useMemo(() => {
    if (full.length <= SLICES + 1) return full;
    const rest = full.slice(SLICES);
    return [...full.slice(0, SLICES), { key: 'rest', label: `الباقي (${rest.length})`, total: rest.reduce((t, g) => t + g.total, 0) }];
  }, [full]);
  const [legendPage, setLegendPage] = useState(0);
  useEffect(() => setLegendPage(0), [category]);
  const legendPages = Math.max(1, Math.ceil(groups.length / LEGEND_PAGE));
  const legendStart = legendPage * LEGEND_PAGE;
  // لون الصف/الشريحة: الأعلى بألوانها، والباقي رمادي
  const colorOf = (i: number) => (i < SLICES || full.length <= SLICES + 1 ? PALETTE[i % PALETTE.length] : REST);
  const total = groups.reduce((t, g) => t + g.total, 0);

  const [active, setActive] = useState<number | null>(null);
  const focus = active !== null ? slices[active] : null;
  // الصف في الجدول يُبرز شريحته (أو الشريحة الرمادية)
  const sliceOf = (i: number) => Math.min(i, slices.length - 1);

  const max = full[0]?.total || 1;
  const topShare = total ? Math.round((slices.filter(g => g.key !== 'rest').reduce((t, g) => t + g.total, 0) / total) * 1000) / 10 : 0;
  const restSlice = slices.find(g => g.key === 'rest');

  return (
    <div className="shrink-0 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"><BarChart3 className="w-3.5 h-3.5" /></div>
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{open ? `توزيع ${open.label} حسب العربة` : 'توزيع الاستهلاك حسب الفئة'}</h3>
        </div>
        <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">{full.length} {open ? 'عربة' : 'فئة'}</span>
      </div>

      {/* الإجمالي، أو العنصر الذي يمر عليه المؤشر */}
      <div className="flex items-baseline gap-1.5 mt-3.5">
        <span className="text-2xl font-black font-mono text-slate-900 dark:text-white leading-none" style={{ color: focus ? (focus.key === 'rest' ? REST[0] : PALETTE[(active ?? 0) % PALETTE.length][0]) : undefined }}>
          {(focus ? focus.total : total).toLocaleString()}
        </span>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
          {focus ? `لتر · ${focus.label} · ${total ? Math.round((focus.total / total) * 1000) / 10 : 0}%` : 'لتر الإجمالي'}
        </span>
      </div>

      {/* شريط واحد مقسّم: أعلى 5 بألوانها والباقي رمادي */}
      <div className="flex h-3 mt-3 rounded-full overflow-hidden gap-[2px]" onMouseLeave={() => setActive(null)}>
        {slices.map((g, i) => (
          <div
            key={g.key}
            onMouseEnter={() => setActive(i)}
            title={`${g.label} · ${g.total.toLocaleString()} L`}
            className="h-full transition-opacity duration-200 cursor-default"
            style={{
              width: `${total ? (g.total / total) * 100 : 0}%`,
              minWidth: 3,
              flexGrow: g.key === 'rest' ? 1 : 0,
              background: g.key === 'rest' ? REST[1] : PALETTE[i % PALETTE.length][0],
              opacity: active === null || active === i ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] font-bold text-slate-400">
        <span>{restSlice ? `أعلى ${SLICES} = ${topShare}%` : '100%'}</span>
        {restSlice && <span>الباقي {full.length - SLICES} {open ? 'عربة' : 'فئة'}</span>}
      </div>

      {/* الجدول: ترتيب، اسم بشريط رفيع باهت، لترات، نسبة */}
      <div className="mt-3 h-[252px]">
        {groups.slice(legendStart, legendStart + LEGEND_PAGE).map((g, k) => {
          const i = legendStart + k;
          const pct = total ? Math.round((g.total / total) * 1000) / 10 : 0;
          const [c0] = colorOf(i);
          const si = sliceOf(i);
          return (
            <div
              key={g.key}
              onMouseEnter={() => setActive(si)}
              onMouseLeave={() => setActive(null)}
              className={`grid grid-cols-[1.25rem_1fr_auto_2.75rem] gap-2 items-center h-[42px] px-1.5 text-xs border-b border-slate-100 dark:border-slate-800/70 last:border-b-0 rounded-lg transition-colors ${active === si ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
            >
              <span className="text-[10px] font-bold text-slate-400 font-mono">{i + 1}</span>
              <span className="min-w-0">
                <span className={`block font-bold text-slate-800 dark:text-slate-100 truncate ${open ? 'font-mono' : ''}`} dir={open ? 'ltr' : undefined}>{g.label}</span>
                <span className="block h-1 mt-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <span className="block h-full rounded-full vehicle-fill" style={{ width: `${Math.max(3, (g.total / max) * 100)}%`, background: c0, opacity: 0.75 }} />
                </span>
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400 text-left">{g.total.toLocaleString()} L</span>
              <span className="font-mono font-black text-slate-700 dark:text-slate-200 text-left">{pct}%</span>
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
