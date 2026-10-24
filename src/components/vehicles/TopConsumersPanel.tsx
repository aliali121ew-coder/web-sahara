/* eslint-disable i18next/no-literal-string */
import React from 'react';
import type { VehicleItem } from './types';
import {
  Flame,
  Crown,
  Fuel,
  ChevronLeft,
  Zap,
} from 'lucide-react';

interface Props {
  topVehicles: VehicleItem[];
  onSelect: (vehicle: VehicleItem) => void;
  totalStationFuel: number;
}

export const TopConsumersPanel: React.FC<Props> = ({
  topVehicles,
  onSelect,
  totalStationFuel,
}) => {
  const topTotalFuel = topVehicles.reduce((s, v) => s + v.totalFuelLiters, 0);
  const sharePercent = totalStationFuel > 0 ? Math.round((topTotalFuel / totalStationFuel) * 100) : 0;
  const maxFuel = topVehicles[0]?.totalFuelLiters || 1;

  return (
    <div className="rounded-3xl bg-gradient-to-b from-white via-white to-amber-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/10 border border-amber-300/40 dark:border-amber-500/20 p-5 sm:p-6 shadow-soft-card relative overflow-hidden flex flex-col h-full">
      {/* Decorative top amber glow */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 pb-4 border-b border-amber-200/50 dark:border-amber-500/20">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25">
              <Flame className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-cairo flex items-center gap-2">
                <span>أعلى استهلاك (15%)</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {topVehicles.length} شاحنات
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                الشاحنات الأكثر استهلاكاً لوقود المحطة والتفويل المتكرر
              </p>
            </div>
          </div>
        </div>

        {/* Aggregate Pill Banner */}
        <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>حصة استهلاك النخبة:</span>
          </div>
          <div className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
            {sharePercent}% من إجمالي الوقود
          </div>
        </div>
      </div>

      {/* Ranked Vehicle List */}
      <div className="mt-4 space-y-3 flex-1 overflow-y-auto pr-1">
        {topVehicles.map((veh, index) => {
          const isFirst = index === 0;
          const isSecond = index === 1;
          const isThird = index === 2;
          const barWidth = Math.round((veh.totalFuelLiters / maxFuel) * 100);

          return (
            <div
              key={veh.id}
              onClick={() => onSelect(veh)}
              className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                isFirst
                  ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-400/50 shadow-md hover:border-amber-500'
                  : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/40 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              {/* Top Row: Rank, Truck ID, and Fuel Liters */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  {/* Rank Badge */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shadow-sm font-mono ${
                      isFirst
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/40'
                        : isSecond
                        ? 'bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white'
                        : isThird
                        ? 'bg-amber-700/80 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isFirst ? <Crown className="w-4 h-4 fill-slate-950" /> : `#${index + 1}`}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {veh.truckNumber}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300">
                        {veh.company}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-[160px]">
                      {veh.driverName}
                    </span>
                  </div>
                </div>

                {/* Liters total */}
                <div className="text-left font-mono">
                  <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-500" />
                    <span>{veh.totalFuelLiters.toLocaleString()}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">لتر مسحوب</span>
                </div>
              </div>

              {/* Progress Relative Consumption Bar */}
              <div className="w-full bg-slate-200/80 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden my-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isFirst
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Bottom Quick Stats */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                  <span>{veh.fuelingsCount} تفويلة</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-mono">{veh.avgLitersPerFill.toLocaleString()} لتر/تفويلة</span>
                </div>

                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                  <span>فحص الشاحنة</span>
                  <ChevronLeft className="w-3.5 h-3.5 transform group-hover:-translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info Box */}
      <div className="mt-4 pt-3 border-t border-amber-200/40 dark:border-amber-500/20 text-center">
        <span className="text-xs text-slate-400">
          يتم احتساب أعلى 15% آلياً بناءً على الحجم التراكمي وتكرار الشحن
        </span>
      </div>
    </div>
  );
};
