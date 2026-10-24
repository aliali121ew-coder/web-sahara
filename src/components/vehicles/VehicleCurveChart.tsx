/* eslint-disable i18next/no-literal-string */
import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { VehicleCurvePoint } from './types';
import { TrendingUp, Activity, Fuel, Zap } from 'lucide-react';

interface Props {
  data: VehicleCurvePoint[];
  truckNumber: string;
  avgLiters: number;
}

export const VehicleCurveChart: React.FC<Props> = ({ data, truckNumber, avgLiters }) => {
  const [metric, setMetric] = useState<'liters' | 'efficiency'>('liters');

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-500 animate-pulse" />
        <p className="text-xs">لا تتوفر بيانات كافية لرسم منحنى هذه الشاحنة بعد.</p>
      </div>
    );
  }

  const latestPoint = data[data.length - 1];
  const firstPoint = data[0];
  const deltaLiters = latestPoint ? latestPoint.liters - firstPoint.liters : 0;
  const isRising = deltaLiters >= 0;

  return (
    <div className="rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 p-5 shadow-2xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 font-cairo">
              <span>منحنى تفويلات واستهلاك الشاحنة</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30" dir="ltr">
                {truckNumber}
              </span>
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            معدل التفويل الزمني، ومقارنة الأحجام بمعدل الوسط الحسابي ({avgLiters.toLocaleString()} لتر)
          </p>
        </div>

        {/* Metric toggles */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetric('liters')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              metric === 'liters'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>حجم التفويل (لتر)</span>
          </button>
          <button
            type="button"
            onClick={() => setMetric('efficiency')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              metric === 'efficiency'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>كفاءة المحرك (كم/لتر)</span>
          </button>
        </div>
      </div>

      {/* Quick summary strip */}
      <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-800/50 rounded-2xl p-2.5 border border-slate-700/40 text-xs">
        <div className="text-center">
          <span className="text-slate-400 block text-[11px]">آخر تفويلة</span>
          <span className="font-bold text-white font-mono">
            {latestPoint ? `${latestPoint.liters.toLocaleString()} لتر` : '—'}
          </span>
        </div>
        <div className="text-center border-x border-slate-700/60">
          <span className="text-slate-400 block text-[11px]">المعدل العام</span>
          <span className="font-bold text-blue-400 font-mono">
            {avgLiters.toLocaleString()} لتر
          </span>
        </div>
        <div className="text-center">
          <span className="text-slate-400 block text-[11px]">الاتجاه</span>
          <span className={`font-bold font-mono ${isRising ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isRising ? `+${deltaLiters.toLocaleString()} لتر ↑` : `${deltaLiters.toLocaleString()} لتر ↓`}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-56 sm:h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="truckLitersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="truckEffGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />

            <XAxis
              dataKey="displayDate"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />

            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (metric === 'liters' ? `${Math.round(v / 1000)}k` : `${v}`)}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload as VehicleCurvePoint;
                  return (
                    <div className="bg-slate-950/95 border border-slate-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md text-xs font-cairo">
                      <div className="text-slate-400 text-[10px] mb-1 flex items-center justify-between gap-3">
                        <span>{p.date}</span>
                        <span className="font-mono text-blue-400">{p.voucherNumber}</span>
                      </div>
                      <div className="text-white font-bold text-sm flex items-center gap-2">
                        <Fuel className="w-4 h-4 text-blue-400" />
                        <span className="font-mono">{p.liters.toLocaleString()} لتر</span>
                      </div>
                      <div className="text-purple-400 text-[11px] mt-1 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>كفاءة: {p.efficiencyKmPerL} كم / لتر</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {metric === 'liters' && (
              <ReferenceLine
                y={avgLiters}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: 'المعدل',
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'right',
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey={metric === 'liters' ? 'liters' : 'efficiencyKmPerL'}
              stroke={metric === 'liters' ? '#3b82f6' : '#a855f7'}
              strokeWidth={3}
              fillOpacity={1}
              fill={metric === 'liters' ? 'url(#truckLitersGradient)' : 'url(#truckEffGradient)'}
              dot={{ r: 4, fill: metric === 'liters' ? '#60a5fa' : '#c084fc', strokeWidth: 2, stroke: '#0f172a' }}
              activeDot={{ r: 7, fill: '#ffffff', stroke: metric === 'liters' ? '#3b82f6' : '#a855f7', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
