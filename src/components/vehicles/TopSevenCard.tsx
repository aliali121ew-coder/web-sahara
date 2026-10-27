/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, Repeat2, CalendarClock, Timer, Fuel } from 'lucide-react';
import { VEHICLE_PROFILES_KEY, formatDay, vehicleCategory, type VehicleProfile, type VehicleStat } from '../../lib/vehicleFuel';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { groupByCategory, useCategoryNames, useVehicleNames } from './categories';

/** عدد العربات المعروضة: أعلى 7 فقط */
const TOP = 7;
/** أقل ارتفاع لكارت العربة (px) — لحساب كم كارتًا يتسع حتى نهاية العمود */
const CARD_MIN = 68;
const GAP = 8;

/** لون الكارت متدرج حسب النسبة: فيروزي هادئ للنسب المنخفضة ← كهرماني ← أحمر للنسب العالية (60% فأكثر) */
const shareColor = (pct: number) => {
  const t = Math.min(1, Math.max(0, pct / 60));
  const hue = Math.round(170 - 170 * t);
  return { stroke: `hsl(${hue} 70% 45%)`, tint: `hsl(${hue} 75% 50% / 0.05)`, border: `hsl(${hue} 60% 50% / 0.2)` };
};

/**
 * حلقة التغير: آخر تفويلة مقارنةً بالسابقة — أحمر مع ↑ إذا زادت، أخضر مع ↓ إذا قلّت،
 * وامتلاؤها بمقدار التغير (حتى 100%)؛ رمادية بلا سابقة.
 */
const ChangeRing: React.FC<{ last: number; prev: number | null }> = ({ last, prev }) => {
  const r = 15;
  const len = 2 * Math.PI * r;
  const change = prev ? ((last - prev) / prev) * 100 : null;
  const color = change === null || change === 0 ? '#94a3b8' : change > 0 ? '#e11d48' : '#059669';
  const fill = change === null ? 0 : Math.min(1, Math.abs(change) / 100);
  const txt = change === null ? '—' : `${change > 0 ? '↑' : change < 0 ? '↓' : ''}${Math.abs(change) < 10 ? Math.abs(change).toFixed(1) : Math.round(Math.abs(change))}%`;
  return (
    <div className="relative w-12 h-12 shrink-0" title={change === null ? 'لا توجد تفويلة سابقة' : `مقارنةً بالتفويلة السابقة (${prev} لتر)`}>
      <span className="absolute inset-1 rounded-full bg-white/80 dark:bg-slate-900/60" />
      <svg viewBox="0 0 36 36" className="relative w-12 h-12 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgb(148 163 184 / 0.25)" strokeWidth="3.5" />
        {fill > 0 && <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0.04, fill))} className="vehicle-gauge" />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono" style={{ color }} dir="ltr">{txt}</span>
    </div>
  );
};

/**
 * الأعلى استهلاكًا (7 فقط): بلا فئة مفتوحة = أعلى عربة في كل فئة؛ مع فئة مفتوحة = أعلى عربات الفئة.
 * كل عربة في كارت صغير (حلقة تغيّر آخر تفويلة عن السابقة، آخر تفويلة والسابقة)، والكارتات تتوزع بالتساوي حتى نهاية العمود.
 */
export const TopSevenCard: React.FC<{ stats: VehicleStat[]; category: string | null; onOpen: (v: string) => void }> = ({ stats, category, onOpen }) => {
  const [profiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const names = useVehicleNames();
  const [labels] = useCategoryNames();
  const groups = useMemo(() => groupByCategory(stats, names, labels), [stats, names, labels]);
  const open = category ? groups.find(g => g.key === category) : undefined;

  const list = useMemo(() => {
    const catTotal = new Map(groups.flatMap(g => g.vehicles.map(v => [v.vehicle, g.total] as const)));
    const rows = open
      ? [...open.vehicles].sort((a, b) => b.total - a.total).map(s => ({ s, tag: '' }))
      : groups
        .map(g => ({ s: [...g.vehicles].sort((a, b) => b.total - a.total)[0], tag: g.label }))
        .filter(x => x.s)
        .sort((a, b) => b.s.total - a.s.total);
    return rows.map(r => ({ ...r, share: catTotal.get(r.s.vehicle) ? (r.s.total / catTotal.get(r.s.vehicle)!) * 100 : 0 }));
  }, [groups, open]);

  // عدد الكارتات بقدر المساحة حتى نهاية كارت الفئات (7 كحد أقصى)، وتتمدد بالتساوي لملئها
  const listRef = useRef<HTMLOListElement>(null);
  const [fit, setFit] = useState(TOP);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.max(1, Math.min(TOP, Math.floor((el.clientHeight + GAP) / (CARD_MIN + GAP))))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const view = list.slice(0, fit);

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"><Trophy className="w-3.5 h-3.5" /></div>
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{open ? `الأعلى استهلاكًا · ${open.label}` : 'الأعلى استهلاكًا في كل فئة'}</h3>
        </div>
        <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">{Math.min(fit, list.length)} من {list.length}</span>
      </div>

      <ol ref={listRef} className="mt-3 flex-1 min-h-0 overflow-hidden flex flex-col" style={{ gap: GAP }}>
        {view.map(({ s, tag, share }, i) => {
          const prof = profiles.find(p => p.id === s.vehicle);
          const cat = vehicleCategory(names.get(s.vehicle) || s.vehicle);
          return (
            <li key={s.vehicle} className="flex-1 flex" style={{ minHeight: CARD_MIN, maxHeight: 120 }}>
              <button
                type="button"
                onClick={() => onOpen(s.vehicle)}
                className="vehicle-kpi w-full flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 hover:shadow-md hover:-translate-y-px transition-all text-right cursor-pointer"
                style={{ animationDelay: `${i * 0.04}s`, background: `linear-gradient(to left, ${shareColor(share).tint}, transparent 85%)`, borderColor: shareColor(share).border }}
              >
                <ChangeRing last={s.last.qty} prev={s.last.prevQty} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`font-black text-sm text-slate-900 dark:text-white truncate ${prof?.name ? '' : 'font-mono'}`} dir={prof?.name ? undefined : 'ltr'}>{prof?.name || s.vehicle}</span>
                    <span className="text-[10px] font-bold text-slate-400 truncate">{tag || (cat ? labels[cat.key] || cat.label : '')}</span>
                    {s.frequent > 0 && <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400"><Repeat2 className="w-3 h-3" />متكرر</span>}
                  </div>
                  {/* آخر تفويلة وعدد الأيام، ثم السابقة بخط رصاصي فاتح */}
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    <span className="flex items-center gap-0.5"><Fuel className="w-3 h-3 text-sky-500" /><span className="font-mono">{s.last.qty.toLocaleString()}</span> لتر</span>
                    <span className="flex items-center gap-0.5 font-mono"><CalendarClock className="w-3 h-3 text-sky-500" />{formatDay(s.last.date)}</span>
                    {s.last.days !== null && <span className={`flex items-center gap-0.5 ${s.last.days <= 1 ? 'text-rose-600 dark:text-rose-400' : ''}`}><Timer className="w-3 h-3" />بعد {s.last.days} يوم</span>}
                  </div>
                  {s.last.prevQty !== null && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      <span>السابقة</span>
                      <span className="font-mono">{s.last.prevQty.toLocaleString()} لتر</span>
                      <span className="font-mono">{formatDay(s.last.prevDate)}</span>
                    </div>
                  )}
                </div>
                <div className="text-left shrink-0">
                  <div className="font-mono font-black text-base text-slate-900 dark:text-white leading-none">{s.total.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-1 whitespace-nowrap">لتر · {s.count} تفويلة</div>
                </div>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="text-xs text-slate-400 text-center py-6">لا توجد بيانات</li>}
      </ol>
    </div>
  );
};
