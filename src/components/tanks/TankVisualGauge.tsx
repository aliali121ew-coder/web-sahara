import React from 'react';
import {
  Thermometer,
  Gauge,
  Droplet,
  AlertTriangle,
  CheckCircle,
  Plus,
  Minus
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TankItem } from '../../types';
import { enumText } from '../../i18n/enums';
import { formatNumber } from '../../lib/utils';
import { useFuelData } from '../../context/FuelDataContext';

interface TankVisualGaugeProps {
  tank: TankItem;
}

export const TankVisualGauge: React.FC<TankVisualGaugeProps> = ({ tank }) => {
  const { t } = useTranslation(['tanks', 'common']);
  const { updateTankLevel } = useFuelData();

  // Get color gradient for fluid wave based on fuel type and status
  const getFluidGrad = () => {
    if (tank.status === 'critical') {
      return {
        grad: 'from-rose-600 via-rose-500 to-amber-500',
        waveColor: '#e11d48',
        glow: 'shadow-rose-500/30',
        border: 'border-rose-500/40',
      };
    }
    if (tank.status === 'warning') {
      return {
        grad: 'from-amber-600 via-amber-500 to-yellow-500',
        waveColor: '#d97706',
        glow: 'shadow-amber-500/30',
        border: 'border-amber-500/40',
      };
    }
    if (tank.fuelType === 'نفط أسود') {
      return {
        grad: 'from-purple-900 via-slate-800 to-indigo-950',
        waveColor: '#581c87',
        glow: 'shadow-purple-500/30',
        border: 'border-purple-500/40',
      };
    }
    if (tank.company === 'شركة الاتحاد') {
      return {
        grad: 'from-teal-600 via-emerald-600 to-cyan-500',
        waveColor: '#0d9488',
        glow: 'shadow-teal-500/30',
        border: 'border-teal-500/40',
      };
    }
    // Default Sahara Gas
    return {
      grad: 'from-blue-700 via-blue-600 to-cyan-500',
      waveColor: '#0284c7',
      glow: 'shadow-blue-500/30',
      border: 'border-blue-500/40',
    };
  };

  const fluidStyle = getFluidGrad();

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between relative overflow-hidden group">
      {/* Top Details */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {tank.code}
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {enumText(tank.company)}
              </span>
            </div>
            <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white mt-1">
              {tank.name}
            </h4>
          </div>

          {/* Status Badge */}
          <span
            className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${
              tank.status === 'safe'
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : tank.status === 'warning'
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-bounce'
            }`}
          >
            {tank.status === 'safe' && <CheckCircle className="w-3 h-3" />}
            {tank.status !== 'safe' && <AlertTriangle className="w-3 h-3" />}
            <span>
              {tank.status === 'safe'
                ? t('tanks:gauge.safe')
                : tank.status === 'warning'
                ? t('tanks:gauge.warning')
                : t('tanks:gauge.critical')}
            </span>
          </span>
        </div>
      </div>

      {/* Visual 3D Cylindrical Tank with Wave */}
      <div className="my-5 flex items-center justify-center">
        <div className="relative w-36 sm:w-40 h-52 rounded-3xl bg-slate-100 dark:bg-slate-800/80 border-2 border-slate-300/80 dark:border-slate-700 overflow-hidden shadow-inner flex flex-col justify-end">
          {/* Glass reflection gradient highlight */}
          <div className="absolute inset-0 tank-cylinder-shadow pointer-events-none z-20" />

          {/* Percentage Ruler Grid */}
          <div className="absolute inset-y-0 end-2 z-20 flex flex-col justify-between py-2 text-[9px] font-mono text-slate-400 select-none pointer-events-none">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          {/* Center Large Percentage Badge */}
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none drop-shadow-md">
            <span className="text-3xl font-black text-white font-mono tracking-tighter">
              {tank.percentage}%
            </span>
            <span className="text-[10px] font-bold text-white/90">
              {formatNumber(tank.currentLiters)} {t('common:units.liter')}
            </span>
          </div>

          {/* Liquid Height & Wave Animation */}
          <div
            className={`w-full bg-gradient-to-t ${fluidStyle.grad} relative transition-all duration-700 ease-out z-10`}
            style={{ height: `${tank.percentage}%` }}
          >
            {/* Animated SVG Wave on top of liquid */}
            <div className="absolute -top-3 left-0 right-0 h-4 overflow-hidden leading-none z-10 opacity-80">
              <svg
                viewBox="0 0 500 150"
                preserveAspectRatio="none"
                className="w-[200%] h-full animate-wave-fast"
              >
                <path
                  d="M0.00,49.98 C150.00,150.00 349.20,-50.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"
                  fill="white"
                  fillOpacity="0.4"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Sensor Readings (Temperature, Pressure, Water level) */}
      <div className="grid grid-cols-3 gap-1.5 p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-bold">
            <Thermometer className="w-3 h-3 text-amber-500" />
            <span>{t('tanks:gauge.temperature')}</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
            {tank.temperatureC}°C
          </span>
        </div>

        <div>
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-bold">
            <Gauge className="w-3 h-3 text-blue-500" />
            <span>{t('tanks:gauge.pressure')}</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
            {tank.pressureBar} bar
          </span>
        </div>

        <div>
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-bold">
            <Droplet className="w-3 h-3 text-teal-500" />
            <span>{t('tanks:gauge.sediment')}</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
            {tank.waterLevelMm} mm
          </span>
        </div>
      </div>

      {/* Quick Interactive Level Simulation Buttons */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {t('tanks:card.capacity')} <strong className="font-mono text-slate-700 dark:text-slate-300">{formatNumber(tank.capacityLiters)} {t('common:units.liter')}</strong>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => updateTankLevel(tank.id, -5000)}
            title={t('tanks:gauge.draw', { amount: formatNumber(5000) })}
            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 active:scale-95"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={() => updateTankLevel(tank.id, 5000)}
            title={t('tanks:gauge.fill', { amount: formatNumber(5000) })}
            className="p-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
