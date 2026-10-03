import React from 'react';
import {
  ShieldCheck,
  Building2,
  Gauge,
  TrendingUp,
  Radio,
  FileCheck2,
  Boxes
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';

export const EtihadGasSection: React.FC = () => {
  const etihadTotalBalance = 15028082;
  const tankStorage = 12500000;
  const activePipelines = 2528082;
  const dailyFlowRate = 140000;
  const safetyRate = 98.4;
  const pressureValue = 1.42;

  return (
    <div className="space-y-4">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/30 ring-2 ring-teal-400/20">
            <Building2 className="w-4 h-4 text-teal-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                كاز - شركة الاتحاد
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 text-[10px] font-bold border border-teal-200 dark:border-teal-800">
                المخزون الاستراتيجي الشامل
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>الربط المشترك فعال 100%</span>
          </div>
        </div>
      </div>

      {/* Main Container Grid (Unified 3D Raised Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        
        {/* Main Hero Card: Total Balance 15,028,082 L (3D Raised) */}
        <div className="lg:col-span-7 rounded-3xl card-3d p-5 sm:p-6 flex flex-col justify-between space-y-5">
          
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                <Boxes className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>إجمالي رصيد شركة الاتحاد (الخزانات + خطوط التوريد)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shadow-xs">
                فائض استراتيجي آمن
              </span>
            </div>

            <div className="flex items-baseline gap-2.5 mt-2">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white drop-shadow-xs">
                {formatNumber(etihadTotalBalance)}
              </span>
              <span className="text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400">لتر</span>
            </div>
          </div>

          {/* Sub-distribution row: Storage vs Pipelines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-200/70 dark:border-slate-800">
            <div className="p-3.5 rounded-2xl inset-3d">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span>مخزون الخزانات الرئيسية</span>
                <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400">83.2%</span>
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                {formatNumber(tankStorage)} <span className="text-xs font-normal text-slate-400">لتر</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">المستودعات الإقليمية المؤمّنة</span>
            </div>

            <div className="p-3.5 rounded-2xl inset-3d">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span>خطوط الضخ المستمر والتدفق</span>
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">16.8%</span>
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {formatNumber(activePipelines)} <span className="text-xs font-normal text-slate-400">لتر</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">في مسار التجهيز المباشر</span>
            </div>
          </div>

          {/* Interactive Pipeline Status Banner */}
          <div className="p-3 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 flex items-center justify-between text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 animate-pulse" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                مسار الضخ الآلي المشترك: <strong className="text-teal-700 dark:text-teal-300">نشط ومستقر</strong>
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-teal-700 dark:text-teal-300">2,400 L/min</span>
          </div>

        </div>

        {/* 4 Telemetry & Audit Cards Grid (3D Raised) */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* Card 1: Safety Level */}
          <div className="p-4 rounded-3xl card-3d flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
              <span>مستوى الأمان والاحتياطي</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {safetyRate}%
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 block">
                فوق الحد الحرج بـ +48.4%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-[98.4%]" />
            </div>
          </div>

          {/* Card 2: Flow Pressure */}
          <div className="p-4 rounded-3xl card-3d flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
              <span>ضغط الإمداد والتدفق</span>
              <div className="w-7 h-7 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center shadow-xs">
                <Gauge className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {pressureValue} <span className="text-xs font-normal text-slate-500">Bar</span>
              </div>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium mt-0.5 block">
                تدفق قياسي ومضبوط
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full w-[70%]" />
            </div>
          </div>

          {/* Card 3: Daily Shared Outflow */}
          <div className="p-4 rounded-3xl card-3d flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
              <span>معدل السحب اليومي</span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shadow-xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {formatNumber(dailyFlowRate)} <span className="text-xs font-normal text-slate-500">لتر/يوم</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 block">
                الاستهلاك المشترك
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full w-[60%]" />
            </div>
          </div>

          {/* Card 4: ISO Quality Certification */}
          <div className="p-4 rounded-3xl card-3d flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
              <span>الاعتماد والمطابقة</span>
              <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center shadow-xs">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-sm font-black text-purple-700 dark:text-purple-300 font-mono">
                ISO-9001 / ASTM
              </div>
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 block">
                ● فحص نوعي معتمد
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full w-full" />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
