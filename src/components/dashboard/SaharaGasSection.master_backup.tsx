// BACKUP OF MASTER PARENT CARD VERSION
import React, { useState } from 'react';
import {
  TrendingUp,
  Calendar,
  Zap,
  Tractor,
  Cpu,
  ArrowUpRight,
  Flame,
  Clock,
  Droplets,
  Activity,
  PieChart as PieIcon
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { formatNumber } from '../../lib/utils';

export const SaharaGasSectionBackup: React.FC = () => {
  const actualBalance = 705021;
  const avgPrice = 554;
  const totalInbound = 0;
  const totalOutbound = 0;
  const actualConsumption = 0;
  const coverageDays = 3;
  const coverageDate = '2026/08/23';

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const sectorData = [
    {
      name: 'الآليات والمعدات',
      value: 45,
      volume: 317259,
      color: '#2563EB',
      glowColor: 'rgba(37, 99, 235, 0.35)',
      icon: Tractor,
    },
    {
      name: 'محطات التوليد',
      value: 35,
      volume: 246757,
      color: '#6366F1',
      glowColor: 'rgba(99, 102, 241, 0.35)',
      icon: Cpu,
    },
    {
      name: 'المزارع والري',
      value: 20,
      volume: 141005,
      color: '#10B981',
      glowColor: 'rgba(16, 185, 129, 0.35)',
      icon: Zap,
    },
  ];

  return (
    <div className="rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                كاز - صحاري كربلاء 2026
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200/80 dark:border-blue-800/60">
                المخزون والتشغيل
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium self-start sm:self-auto border border-slate-200/60 dark:border-slate-700/60">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>تحديث مباشر: <strong className="font-mono text-slate-900 dark:text-white">2026/08/20</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-5 rounded-[26px] bg-gradient-to-b from-white via-white to-slate-100/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/90 border border-slate-200/90 dark:border-slate-700/70 p-5 shadow-[0_6px_20px_rgba(0,0,0,0.035),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.02)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.06)] flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-400 mb-0.5">
                <Droplets className="w-3.5 h-3.5 text-blue-600" />
                <span>رصيد الصحاري الفعلي المعتمد</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  {formatNumber(actualBalance)}
                </span>
                <span className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">لتر</span>
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-right shrink-0 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-400 block">متوسط السعر</span>
              <div className="text-sm sm:text-base font-black text-blue-700 dark:text-blue-300 font-mono">
                {avgPrice} <span className="text-[10px] font-normal text-slate-500">د.ع</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 block">● معتمد</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-right shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>إجمالي الوارد</span>
                <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {formatNumber(totalInbound)} <span className="text-[10px] font-normal text-slate-400">لتر</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-right shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>الاستهلاك الكلي</span>
                <TrendingUp className="w-3 h-3 text-blue-500" />
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {formatNumber(totalOutbound)} <span className="text-[10px] font-normal text-slate-400">لتر</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-right shadow-[inset_0_1px_2px_rgba(37,99,235,0.04)]">
              <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 dark:text-blue-300">
                <span>الاستهلاك الفعلي</span>
                <Activity className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-sm font-black text-blue-900 dark:text-blue-100 font-mono mt-0.5">
                {formatNumber(actualConsumption)} <span className="text-[10px] font-normal text-blue-400">لتر</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-[26px] bg-gradient-to-b from-white via-white to-slate-100/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/90 border border-slate-200/90 dark:border-slate-700/70 p-5 shadow-[0_6px_20px_rgba(0,0,0,0.035),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.02)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.06)] flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold text-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>تنبؤ التغطية الذكية</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[9px] font-bold border border-amber-200 dark:border-amber-800/60 shadow-2xs">
              إعادة الطلب
            </span>
          </div>

          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              يؤمن لغاية <span className="text-amber-600 dark:text-amber-400">{coverageDays} أيام</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              تاريخ النفاد المتوقع: <strong className="font-mono text-slate-700 dark:text-slate-300">{coverageDate}</strong>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50">
              <span className="text-[9px] font-bold text-slate-400 block">اليوم 1</span>
              <span className="text-[9px] font-mono font-bold text-slate-700 dark:text-slate-200">08/21</span>
            </div>
            <div className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50">
              <span className="text-[9px] font-bold text-slate-400 block">اليوم 2</span>
              <span className="text-[9px] font-mono font-bold text-slate-700 dark:text-slate-200">08/22</span>
            </div>
            <div className="p-1.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60">
              <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block">اليوم 3</span>
              <span className="text-[9px] font-mono font-bold text-rose-700 dark:text-rose-300">08/23</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-[26px] bg-gradient-to-b from-white via-white to-slate-100/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/90 border border-slate-200/90 dark:border-slate-700/70 p-5 shadow-[0_6px_20px_rgba(0,0,0,0.035),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.02)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.06)] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <PieIcon className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="font-extrabold text-xs text-slate-900 dark:text-white">
                توزيع نسب الاستهلاك
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400">100% الإجمالي</span>
          </div>

          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-5 sm:col-span-5 relative h-32 sm:h-36 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white p-2 rounded-xl text-[10px] shadow-xl border border-slate-700 backdrop-blur-md">
                            <div className="font-bold">{data.name}</div>
                            <div className="font-mono text-blue-300 mt-0.5">{formatNumber(data.volume)} لتر ({data.value}%)</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={4}
                    dataKey="value"
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {sectorData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="none"
                        style={{
                          transform: activeIndex === index ? 'scale(1.06)' : 'scale(1)',
                          transformOrigin: 'center center',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-mono font-black text-slate-800 dark:text-slate-100">
                  {activeIndex !== null ? `${sectorData[activeIndex].value}%` : '100%'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {activeIndex !== null ? 'حصة' : 'الرصيد'}
                </span>
              </div>
            </div>

            <div className="col-span-7 space-y-1">
              {sectorData.map((sec, idx) => {
                const isHovered = activeIndex === idx;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseLeave={() => setActiveIndex(null)}
                    className={`p-1 rounded-xl transition-all cursor-pointer ${
                      isHovered
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: sec.color }}
                        />
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                          {sec.name}
                        </span>
                      </div>

                      <span className="font-mono font-black text-xs shrink-0" style={{ color: sec.color }}>
                        {sec.value}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pr-3.5 mt-0.5">
                      <span>{formatNumber(sec.volume)} لتر</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
