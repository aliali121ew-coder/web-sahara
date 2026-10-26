/* eslint-disable i18next/no-literal-string */
import React from 'react';
import { Flame, Repeat2, User, CalendarClock, ChevronLeft } from 'lucide-react';
import { formatDay, type VehicleStat } from '../../lib/vehicleFuel';

/** أعلى 6 عربات استهلاكًا: صورة الشاحنة وفوقها نسبة استهلاكها من الأعلى */
export const TopVehicleCards: React.FC<{ stats: VehicleStat[]; onOpen: (v: string) => void }> = ({ stats, onOpen }) => {
  const top = stats.slice(0, 6);
  const max = Math.max(1, top[0]?.total || 0);
  return (
    <div className="h-full rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" />الأعلى استهلاكًا</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">ست عربات بأكبر كمية خلال الفترة المختارة</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {top.map((s, i) => {
          const pct = Math.round((s.total / max) * 100);
          return (
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

              <div className="relative mx-3 mt-2 h-24 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <img src="/trucks/semi_truck.jpg" alt="" loading="lazy" className="absolute inset-0 w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal dark:opacity-80 group-hover:scale-105 transition-transform duration-500" />
                {/* شريط الاستهلاك فوق المقطورة كما في لوحات التتبع */}
                <div className="absolute top-[22%] right-[6%] w-[58%] h-[42%] rounded-md bg-sky-900/10 dark:bg-sky-900/40 overflow-hidden backdrop-blur-[1px]">
                  <div className="h-full bg-gradient-to-l from-sky-500/90 to-indigo-500/80 vehicle-fill" style={{ width: `${pct}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-black drop-shadow">{pct}%</span>
                </div>
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
          );
        })}
      </div>
    </div>
  );
};
