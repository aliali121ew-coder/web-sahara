/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, Repeat2, ChevronLeft, ChevronRight } from 'lucide-react';
import { VEHICLE_PROFILES_KEY, vehicleCategory, type VehicleProfile, type VehicleStat } from '../../lib/vehicleFuel';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { VehicleArt } from './VehicleArt';
import { groupByCategory } from './categories';

/** أقل عدد سطور في الصفحة؛ ويزيد ليملأ ارتفاع الكارت حتى نهاية العمود */
const MIN_PAGE = 7;
/** ارتفاع السطر التقريبي قبل القياس (px) */
const ROW_FALLBACK = 56;

// المراكز الثلاثة الأولى: ذهبي، فضي، برونزي
const MEDAL = [
  'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-amber-500/30',
  'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 shadow-slate-400/30',
  'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950 shadow-orange-500/30',
];

/**
 * الأعلى استهلاكًا: بلا فئة مفتوحة = أعلى عربة في كل فئة؛ مع فئة مفتوحة = عربات الفئة بالترتيب.
 * السطور تملأ الكارت حتى نهاية العمود (7 على الأقل)، وأزرار الصفحات في أسفله.
 */
export const TopSevenCard: React.FC<{ stats: VehicleStat[]; category: string | null; onOpen: (v: string) => void }> = ({ stats, category, onOpen }) => {
  const [profiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const groups = useMemo(() => groupByCategory(stats), [stats]);
  const open = category ? groups.find(g => g.key === category) : undefined;

  const list = useMemo(() => {
    if (open) return [...open.vehicles].sort((a, b) => b.total - a.total).map(s => ({ s, tag: '' }));
    return groups
      .map(g => ({ s: [...g.vehicles].sort((a, b) => b.total - a.total)[0], tag: g.label }))
      .filter(x => x.s)
      .sort((a, b) => b.s.total - a.s.total);
  }, [groups, open]);

  // عدد السطور يُحسب من ارتفاع القائمة المتاح (الكارت يمتد مع كارت الفئات) فتمتلئ حتى نهايته ثم الصفحات
  const listRef = useRef<HTMLOListElement>(null);
  const [PAGE, setPerPage] = useState(MIN_PAGE);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const first = el.querySelector('li');
      const row = first ? first.getBoundingClientRect().height + 4 : ROW_FALLBACK;
      setPerPage(Math.max(MIN_PAGE, Math.floor((el.clientHeight + 4) / row)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [category, stats, PAGE]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const view = list.slice(page * PAGE, page * PAGE + PAGE);
  const max = list[0]?.s.total || 1;

  return (
    <div className="flex-1 flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"><Trophy className="w-3.5 h-3.5" /></div>
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{open ? `الأعلى استهلاكًا · ${open.label}` : 'الأعلى استهلاكًا في كل فئة'}</h3>
        </div>
        <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">{list.length} {open ? 'عربة' : 'فئة'}</span>
      </div>

      <ol ref={listRef} className="mt-2 space-y-1 flex-1 min-h-0 overflow-hidden vehicle-page">
        {view.map(({ s, tag }, k) => {
          const i = page * PAGE + k;
          const cat = vehicleCategory(s.vehicle);
          const prof = profiles.find(p => p.id === s.vehicle);
          return (
            <li key={s.vehicle}>
              <button
                type="button"
                onClick={() => onOpen(s.vehicle)}
                className="group w-full flex items-center gap-2.5 rounded-2xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-right cursor-pointer"
              >
                <span className={`w-6 h-6 shrink-0 rounded-lg text-[11px] font-black flex items-center justify-center shadow-sm ${MEDAL[i] || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{i + 1}</span>
                <VehicleArt code={s.vehicle} photo={prof?.photo} className="w-14 h-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {prof?.name ? (
                      <>
                        <span className="font-black text-sm text-slate-900 dark:text-white truncate">{prof.name}</span>
                        <span className="font-mono text-[10px] font-bold text-sky-700 dark:text-sky-300" dir="ltr">{s.vehicle}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white" dir="ltr">{s.vehicle}</span>
                        <span className="text-[10px] font-bold text-slate-400 truncate">{tag || cat?.label || ''}</span>
                      </>
                    )}
                    {s.frequent > 0 && <Repeat2 className="w-3 h-3 text-rose-500 shrink-0" />}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full vehicle-fill ${i === 0 ? 'bg-gradient-to-l from-amber-400 to-orange-500' : 'bg-gradient-to-l from-sky-400 to-indigo-500'}`} style={{ width: `${Math.max(4, (s.total / max) * 100)}%` }} />
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div className="font-mono font-black text-sm text-slate-900 dark:text-white leading-none">{s.total.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-0.5">لتر · {s.count}</div>
                </div>
                <ChevronLeft className="w-3.5 h-3.5 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            </li>
          );
        })}
        {!list.length && <li className="text-xs text-slate-400 text-center py-6">لا توجد بيانات</li>}
      </ol>

      {pages > 1 && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1 text-xs text-slate-500">
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" aria-label="السابقة"><ChevronRight className="w-4 h-4" /></button>
          <span className="font-mono font-bold px-2">{page + 1} / {pages}</span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" aria-label="التالية"><ChevronLeft className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};
