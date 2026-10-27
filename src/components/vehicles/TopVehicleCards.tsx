/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from 'react';
import { Layers, Repeat2, User, CalendarClock, ChevronLeft, ArrowRight, Truck } from 'lucide-react';
import { VEHICLE_PROFILES_KEY, formatDay, vehicleCategory, type VehicleProfile, type VehicleStat } from '../../lib/vehicleFuel';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { VehicleArt } from './VehicleArt';

interface Category {
  key: string;
  label: string;
  /** رمز عربة من الفئة لعرض صورتها */
  sample: string;
  vehicles: VehicleStat[];
  total: number;
  fills: number;
  frequent: number;
}

const OTHER = 'OTHER';

/**
 * فئات العربات: كارت لكل فئة موجودة في البيانات (الإجمالي، عدد العربات والتفويلات، المتكرر)،
 * والضغط على الفئة يعرض عرباتها مرتبة بالاستهلاك، والضغط على عربة يفتح صفحتها.
 */
export const TopVehicleCards: React.FC<{ stats: VehicleStat[]; onOpen: (v: string) => void }> = ({ stats, onOpen }) => {
  const [profiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const photo = (v: string) => profiles.find(p => p.id === v)?.photo;
  const [selected, setSelected] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, Category>();
    for (const s of stats) {
      const cat = vehicleCategory(s.vehicle);
      const key = cat?.key || OTHER;
      const c = map.get(key) || { key, label: cat?.label || 'أخرى', sample: s.vehicle, vehicles: [], total: 0, fills: 0, frequent: 0 };
      c.vehicles.push(s);
      c.total += s.total;
      c.fills += s.count;
      if (s.frequent) c.frequent += 1;
      map.set(key, c);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [stats]);

  const grand = categories.reduce((t, c) => t + c.total, 0) || 1;
  const current = categories.find(c => c.key === selected);

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
      </div>

      <div className="flex-1 vehicle-page" key={selected || 'all'}>
        {!current ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {categories.map(c => {
              const share = Math.round((c.total / grand) * 100);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelected(c.key)}
                  className="group text-right rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 hover:border-sky-400 dark:hover:border-sky-500 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900 dark:text-white">{c.label}</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300">{share}%</span>
                  </div>
                  <div className="relative h-20 mt-2">
                    {c.key === OTHER
                      ? <div className="absolute inset-0 flex items-center justify-center"><Truck className="w-10 h-10 text-slate-300 dark:text-slate-600" /></div>
                      : <VehicleArt code={c.sample} className="absolute inset-0" />}
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-900 dark:text-white font-mono leading-none">{c.total.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">لتر</span></div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-sky-500 to-indigo-500" style={{ width: `${Math.max(3, share)}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span><b className="text-slate-700 dark:text-slate-200">{c.vehicles.length}</b> عربة · {c.fills} تفويلة</span>
                    {c.frequent > 0 && <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold"><Repeat2 className="w-3 h-3" />{c.frequent}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {current.vehicles.map((s, i) => (
              <button
                key={s.vehicle}
                type="button"
                onClick={() => onOpen(s.vehicle)}
                className="group text-right rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-400 dark:hover:border-sky-500 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between px-3 pt-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center ${i === 0 ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{i + 1}</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white text-base" dir="ltr">{s.vehicle}</span>
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
                  <VehicleArt code={s.vehicle} photo={photo(s.vehicle)} className="absolute inset-0" imgClassName={photo(s.vehicle) ? '!object-cover' : ''} />
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
