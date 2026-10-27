/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Repeat2, User, CalendarClock, ChevronLeft, ChevronRight, ArrowRight, Truck, MoreVertical, Pencil, RotateCcw, Check, X } from 'lucide-react';
import { VEHICLE_PROFILES_KEY, formatDay, type VehicleProfile, type VehicleStat } from '../../lib/vehicleFuel';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { VehicleArt } from './VehicleArt';
import { VehicleSearch, type SearchOption } from './VehicleSearch';
import { OTHER_CATEGORY, groupByCategory, useCategoryNames, useVehicleNames } from './categories';
import { usePermissions } from '../../lib/usePermission';

const OTHER = OTHER_CATEGORY;
const PAGE_SIZE = 9;

/**
 * فئات العربات: كارت لكل فئة موجودة في البيانات (الإجمالي، عدد العربات والتفويلات، المتكرر)،
 * والضغط على الفئة يعرض عرباتها مرتبة بالاستهلاك، والضغط على عربة يفتح صفحتها.
 */
export const TopVehicleCards: React.FC<{
  stats: VehicleStat[];
  onOpen: (v: string) => void;
  /** الفئة المفتوحة (مرفوعة للصفحة لتتبعها الدائرة وكارت الأعلى استهلاكًا) */
  selected: string | null;
  onSelect: (key: string | null) => void;
}> = ({ stats, onOpen, selected, onSelect: setSelected }) => {
  const [profiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const photo = (v: string) => profiles.find(p => p.id === v)?.photo;

  const names = useVehicleNames();
  // إعادة تسمية الفئات لمدير النظام فقط: قائمة النقاط الثلاث في أعلى الكارت
  const { isAdmin } = usePermissions();
  const [labels, renameCategory] = useCategoryNames();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuFor]);
  const categories = useMemo(() => groupByCategory(stats, names, labels), [stats, names, labels]);

  const grand = categories.reduce((t, c) => t + c.total, 0) || 1;
  const current = categories.find(c => c.key === selected);
  const searchOptions = useMemo<SearchOption[]>(() => (current ? [current] : categories).flatMap(c => c.vehicles.map(v => ({
    vehicle: v.vehicle,
    label: names.get(v.vehicle) || v.vehicle,
    category: current ? undefined : c.label,
    total: v.total,
  }))), [current, categories, names]);
  // عربات الفئة على صفحات: 9 (ثلاثة صفوف) لينتهي الكارت مع نهاية الدائرة وكارت الأعلى استهلاكًا
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [selected, stats]);
  const vehicles = current?.vehicles || [];
  const totalPages = Math.max(1, Math.ceil(vehicles.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(vehicles.length, startIndex + PAGE_SIZE);
  const pageVehicles = vehicles.slice(startIndex, endIndex);

  return (
    <div className="h-full rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        {current ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelected(null)} className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer" aria-label="كل الفئات">
              <ArrowRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{current.label}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{current.vehicles.length} عربة · {current.total.toLocaleString()} لتر — مرتبة بالاستهلاك</p>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><Layers className="w-4 h-4 text-sky-500" />فئات العربات</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{categories.length} فئة خلال الفترة المختارة · اضغط على فئة لعرض عرباتها</p>
          </div>
        )}
        {/* البحث: داخل الفئة المفتوحة عن عرباتها، وفي الرئيسية عن كل العربات مع فئاتها */}
        <VehicleSearch
          key={selected || 'all'}
          options={searchOptions}
          onOpen={onOpen}
          placeholder={current ? `ابحث في ${current.label}` : 'ابحث برقم العربة'}
        />
      </div>

      <div className="flex-1 vehicle-page" key={`${selected || 'all'}-${page}`}>
        {!current ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {categories.map(c => {
              const share = Math.round((c.total / grand) * 100);
              return (
                <div
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => { if (editing?.key !== c.key) setSelected(c.key); }}
                  onKeyDown={e => { if (e.key === 'Enter' && editing?.key !== c.key) setSelected(c.key); }}
                  className="group relative text-right rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 transition-all duration-300 ease-out hover:border-sky-400 dark:hover:border-sky-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10 hover:bg-white dark:hover:bg-slate-900 cursor-pointer"
                  // تدرج 5% من أسفل الكارت بلون الثيم المختار (يتغير مع الثيم)
                  style={{ backgroundImage: 'linear-gradient(to top, rgb(var(--app-accent-rgb, 14 165 233) / 0.05), transparent 55%)' }}
                >
                  <div className="flex items-center justify-between gap-1">
                    {editing?.key === c.key ? (
                      <form
                        className="flex items-center gap-1 flex-1 min-w-0"
                        onClick={e => e.stopPropagation()}
                        onSubmit={e => { e.preventDefault(); renameCategory(c.key, editing.value); setEditing(null); }}
                      >
                        <input
                          autoFocus
                          value={editing.value}
                          onChange={e => setEditing({ key: c.key, value: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Escape') setEditing(null); }}
                          className="w-full min-w-0 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-sky-400 text-sm font-black text-slate-900 dark:text-white focus:outline-hidden"
                        />
                        <button type="submit" className="p-1 rounded-lg bg-sky-500 text-white cursor-pointer" aria-label="حفظ"><Check className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => setEditing(null)} className="p-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer" aria-label="إلغاء"><X className="w-3.5 h-3.5" /></button>
                      </form>
                    ) : (
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate transition-colors group-hover:text-sky-700 dark:group-hover:text-sky-300">{c.label}</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300">{share}%</span>
                      {isAdmin && editing?.key !== c.key && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setMenuFor(m => (m === c.key ? null : c.key)); }}
                            className="p-0.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                            aria-label="خيارات الفئة"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuFor === c.key && (
                            <div onClick={e => e.stopPropagation()} className="vehicle-page absolute left-0 top-7 z-20 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-1 text-xs font-bold">
                              <button type="button" onClick={() => { setEditing({ key: c.key, value: c.label }); setMenuFor(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer">
                                <Pencil className="w-3.5 h-3.5 text-sky-500" />إعادة تسمية الفئة
                              </button>
                              {labels[c.key] && (
                                <button type="button" onClick={() => { renameCategory(c.key, ''); setMenuFor(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer">
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />استعادة الاسم الأصلي
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative h-20 mt-2">
                    {c.key === OTHER
                      ? <div className="absolute inset-0 flex items-center justify-center"><Truck className="w-10 h-10 text-slate-300 dark:text-slate-600" /></div>
                      : <VehicleArt code={c.sample} className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-110" />}
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-900 dark:text-white font-mono leading-none">{c.total.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">لتر</span></div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-sky-500 to-indigo-500" style={{ width: `${Math.max(3, share)}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span><b className="text-slate-700 dark:text-slate-200">{c.vehicles.length}</b> عربة · {c.fills} تفويلة</span>
                    {c.frequent > 0 && <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold"><Repeat2 className="w-3 h-3" />{c.frequent}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pageVehicles.map((s, k) => { const i = startIndex + k; return (
              <button
                key={s.vehicle}
                type="button"
                onClick={() => onOpen(s.vehicle)}
                className="group text-right rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-400 dark:hover:border-sky-500 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between px-3 pt-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center ${i === 0 ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{i + 1}</span>
                    {profiles.find(p => p.id === s.vehicle)?.name ? (
                      <span className="flex flex-col leading-tight min-w-0">
                        <span className="font-black text-slate-900 dark:text-white text-sm truncate max-w-[130px]">{profiles.find(p => p.id === s.vehicle)!.name}</span>
                      </span>
                    ) : (
                      <span className="font-mono font-black text-slate-900 dark:text-white text-base" dir="ltr">{s.vehicle}</span>
                    )}
                  </div>
                  {s.frequent > 0 ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      <Repeat2 className="w-3 h-3" />متكرر
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">منتظم</span>
                  )}
                </div>

                <div className="relative mx-3 mt-2 h-24 rounded-xl overflow-hidden">
                  <VehicleArt code={names.get(s.vehicle) || s.vehicle} photo={photo(s.vehicle)} className="absolute inset-0" />
                </div>

                <div className="px-3 pt-2.5 pb-3 space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xl font-black text-slate-900 dark:text-white font-mono">{s.total.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400 font-bold">لتر · {s.count} تفويلة</div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black text-sky-600 dark:text-sky-400 font-mono">{s.last.days ?? '—'}</div>
                      <div className="text-[10px] text-slate-400 font-bold">يوم عن السابقة</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    <span className="flex items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" /><span className="truncate">{s.last.drivers[0] || '—'}</span></span>
                    <span className="flex items-center gap-1 shrink-0"><CalendarClock className="w-3 h-3" />{formatDay(s.last.date)}</span>
                    <ChevronLeft className="w-3.5 h-3.5 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>
            ); })}
          </div>
        )}
      </div>

      {/* الصفحات بنفس شريط صفحة الوارد */}
      {current && vehicles.length > 0 && (
        <div className="mt-4 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 p-3 sm:p-4 rounded-b-3xl bg-slate-50/90 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            عرض <span className="font-sans font-black text-blue-600 dark:text-blue-400">{startIndex + 1}–{endIndex}</span> من <span className="font-sans font-black text-slate-900 dark:text-white">{vehicles.length}</span> عربة
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 select-none">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${page === 1 ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer shadow-2xs active:scale-95'}`}
              >
                <ChevronRight className="w-3.5 h-3.5" /><span>السابق</span>
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  const windowSize = Math.min(10, totalPages);
                  const windowStart = Math.min(Math.max(1, page - Math.floor(windowSize / 2)), totalPages - windowSize + 1);
                  return Array.from({ length: windowSize }, (_, i) => windowStart + i);
                })().map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-xl font-sans font-black text-xs transition-all cursor-pointer ${n === page ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${page === totalPages ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer shadow-2xs active:scale-95'}`}
              >
                <span>التالي</span><ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
