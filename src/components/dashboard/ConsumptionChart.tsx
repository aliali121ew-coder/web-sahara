import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { formatNumber } from '../../lib/utils';

const CONSUMPTION_DATA = [
  { day: 'السبت', sahara: 42000, etihad: 110000, machinery: 22000, generators: 14000, farms: 6000 },
  { day: 'الأحد', sahara: 48000, etihad: 125000, machinery: 25000, generators: 15000, farms: 8000 },
  { day: 'الإثنين', sahara: 51000, etihad: 132000, machinery: 27000, generators: 16000, farms: 8000 },
  { day: 'الثلاثاء', sahara: 46000, etihad: 118000, machinery: 24000, generators: 14000, farms: 8000 },
  { day: 'الأربعاء', sahara: 53000, etihad: 140000, machinery: 28000, generators: 17000, farms: 8000 },
  { day: 'الخميس', sahara: 59000, etihad: 155000, machinery: 31000, generators: 19000, farms: 9000 },
  { day: 'الجمعة', sahara: 38000, etihad: 98000, machinery: 19000, generators: 13000, farms: 6000 },
];

export const ConsumptionChart: React.FC = () => {
  const [chartView, setChartView] = useState<'flow' | 'sectors'>('flow');

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-soft-card space-y-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span>التحليل البياني لمعدلات السحب والاستهلاك الأسبوعي</span>
            </h3>
            <p className="text-xs text-slate-500">
              مقارنة الاستهلاك اليومي بين صحاري كربلاء وشركة الاتحاد والقطاعات التشغيلية
            </p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            onClick={() => setChartView('flow')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              chartView === 'flow'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            مسار السحب اليومي
          </button>
          <button
            onClick={() => setChartView('sectors')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              chartView === 'sectors'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            توزيع القطاعات
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartView === 'flow' ? (
            <AreaChart data={CONSUMPTION_DATA} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSahara" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorEtihad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1e293b',
                  borderRadius: '16px',
                  color: '#fff',
                  fontSize: '12px',
                  direction: 'rtl',
                  textAlign: 'right',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
                formatter={(value: any) => [`${formatNumber(Number(value))} لتر`, '']}
              />
              <Legend
                verticalAlign="top"
                align="left"
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                formatter={(val) => (val === 'sahara' ? 'صحاري كربلاء' : 'شركة الاتحاد')}
              />
              <Area type="monotone" dataKey="sahara" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorSahara)" />
              <Area type="monotone" dataKey="etihad" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorEtihad)" />
            </AreaChart>
          ) : (
            <BarChart data={CONSUMPTION_DATA} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1e293b',
                  borderRadius: '16px',
                  color: '#fff',
                  fontSize: '12px',
                  direction: 'rtl',
                  textAlign: 'right',
                }}
                formatter={(value: any) => [`${formatNumber(Number(value))} لتر`, '']}
              />
              <Legend
                verticalAlign="top"
                align="left"
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                formatter={(val) => (val === 'machinery' ? 'الآليات' : val === 'generators' ? 'المولدات' : 'المزارع')}
              />
              <Bar dataKey="machinery" fill="#2563eb" radius={[6, 6, 0, 0]} stackId="a" />
              <Bar dataKey="generators" fill="#6366f1" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="farms" fill="#10b981" radius={[6, 6, 0, 0]} stackId="a" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
