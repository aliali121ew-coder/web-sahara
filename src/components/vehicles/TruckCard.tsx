/* eslint-disable i18next/no-literal-string */
import React from 'react';
import type { VehicleItem } from './types';
import { Fuel, Clock, MapPin, User, ChevronLeft, Sparkles } from 'lucide-react';

interface Props {
  vehicle: VehicleItem;
  onSelect: (vehicle: VehicleItem) => void;
}

export const TruckCard: React.FC<Props> = ({ vehicle, onSelect }) => {
  // Status styling
  const getStatusBadge = () => {
    switch (vehicle.status) {
      case 'loading':
        return {
          bg: 'bg-amber-500/15 text-amber-500 dark:text-amber-300 border-amber-500/30',
          dot: 'bg-amber-500',
          label: 'قيد التفويل',
        };
      case 'completed':
        return {
          bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-500',
          label: 'مكتمل',
        };
      case 'ready':
        return {
          bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
          dot: 'bg-blue-500',
          label: 'جاهز للإرسال',
        };
      default:
        return {
          bg: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
          dot: 'bg-slate-400',
          label: 'في الانتظار',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <div
      onClick={() => onSelect(vehicle)}
      className="group relative rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card hover:shadow-xl hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
    >
      {/* Top subtle highlight */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Card Header (Plate, Status, Liters/Percent) */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {vehicle.truckNumber}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${status.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                <span>{status.label}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">
              {vehicle.plateDisplay}
            </p>
          </div>

          {/* Volume & % */}
          <div className="text-left font-mono">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block" dir="ltr">
              {Math.round(vehicle.lastQuantityLiters / 1000)}k L • ({vehicle.currentFillPercent}%)
            </span>
            <span className="text-[10px] text-slate-400 block">
              {vehicle.fuelType}
            </span>
          </div>
        </div>

        {/* Center: Truck Illustration matching Image 3 */}
        <div className="my-2 py-2 px-1 relative w-full h-24 sm:h-28 flex items-center justify-center bg-gradient-to-b from-slate-50/60 to-slate-100/40 dark:from-slate-800/40 dark:to-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden">
          <img
            src="/trucks/semi_truck.jpg"
            alt="Truck side view"
            className="w-full h-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-300"
          />

          {/* Top 15% Ribbon Badge */}
          {vehicle.isTop15Percent && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 shadow-sm backdrop-blur-sm">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>أعلى 15%</span>
            </div>
          )}
        </div>

        {/* Route Row ( بغداد → كربلاء ) */}
        <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/70">
          <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
            <MapPin className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[11px] truncate max-w-[130px]">{vehicle.route.from}</span>
            <span className="text-slate-400">←</span>
            <span className="text-[11px] truncate max-w-[130px]">{vehicle.route.to}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 font-bold">
            {vehicle.dockNumber}
          </span>
        </div>

        {/* Driver Name & Refill frequency */}
        <div className="grid grid-cols-2 gap-2 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate text-[11px]">{vehicle.driverName}</span>
          </div>

          <div className="flex items-center justify-end gap-1 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>آخر: {vehicle.lastFuelingDate.split('/').slice(1).join('/')}</span>
          </div>
        </div>
      </div>

      {/* Card Footer: Load Progress Bar & Fuelings Count */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/70">
        <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold">
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Fuel className="w-3.5 h-3.5" />
            <span>{vehicle.fuelingsCount} تفويلة</span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            تقدم الشحن: {vehicle.currentFillPercent}%
          </span>
        </div>

        {/* Progress Bar (Image 3 green style) */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
            style={{ width: `${vehicle.currentFillPercent}%` }}
          />
        </div>

        {/* Click CTA */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
          <span>فحص الشاحنة الكبيرة والكريف</span>
          <ChevronLeft className="w-3.5 h-3.5 transform group-hover:-translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
};
