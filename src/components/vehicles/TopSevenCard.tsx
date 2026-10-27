/* eslint-disable i18next/no-literal-string */
import React, { useMemo } from 'react';
import { Trophy, Repeat2, ChevronLeft } from 'lucide-react';
import { VEHICLE_PROFILES_KEY, vehicleCategory, type VehicleProfile, type VehicleStat } from '../../lib/vehicleFuel';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { VehicleArt } from './VehicleArt';

// المراكز الثلاثة الأولى: ذهبي، فضي، برونزي
const MEDAL = [
  'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-amber-500/30',
  'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 shadow-slate-400/30',
  'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950 shadow-orange-500/30',
];

/** أعلى 7 عربات استهلاكًا خلال الفترة المختارة: الترتيب، الصورة، اللترات مقارنةً بالأولى */
export const TopSevenCard: React.FC<{ stats: VehicleStat[]; onOpen: (v: string) => void }> = ({ stats, onOpen }) => {
  const [profiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const top = useMemo(() => [...stats].sort((a, b) => b.total - a.total).slice(0, 7), [stats]);
  const max = top[0]?.total || 1;
  const all = stats.reduce((t, s) => t + s.total, 0) || 1;
  const share = Math.round((top.reduce((t, s) => t + s.total, 0) / all) * 100);

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"><Trophy className="w-3.5 h-3.5" /></div>
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">الأعلى استهلاكًا</h3>
        </div>
        <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">{share}% من الإجمالي</span>
      </div>

      <ol className="mt-2 space-y-1">
        {top.map((s, i) => {
          const cat = vehicleCategory(s.vehicle);
          const photo = profiles.find(p => p.id === s.vehicle)?.photo;
          return (
            <li key={s.vehicle}>
              <button
                type="button"
                onClick={() => onOpen(s.vehicle)}
                className="group w-full flex items-center gap-2.5 rounded-2xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-right cursor-pointer"
              >
                <span className={`w-6 h-6 shrink-0 rounded-lg text-[11px] font-black flex items-center justify-center shadow-sm ${MEDAL[i] || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{i + 1}</span>
                <VehicleArt code={s.vehicle} photo={photo} className="w-14 h-10 shrink-0" imgClassName={photo ? '!object-cover rounded-lg' : ''} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-white" dir="ltr">{s.vehicle}</span>
                    {cat && <span className="text-[10px] font-bold text-slate-400 truncate">{cat.label}</span>}
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
        {!top.length && <li className="text-xs text-slate-400 text-center py-6">لا توجد بيانات</li>}
      </ol>
    </div>
  );
};
