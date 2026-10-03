import React, { useState } from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { TankVisualGauge } from './TankVisualGauge';
import { formatNumber } from '../../lib/utils';

export const TanksOverviewBackup: React.FC = () => {
  const { tanks, searchQuery } = useFuelData();
  const [selectedCompany, setSelectedCompany] = useState<string>('الكل');

  const totalCapacity = tanks.reduce((acc, t) => acc + t.capacityLiters, 0);
  const totalStored = tanks.reduce((acc, t) => acc + t.currentLiters, 0);
  const criticalCount = tanks.filter((t) => t.status === 'critical').length;

  const filteredTanks = tanks.filter((t) => {
    const matchesCompany =
      selectedCompany === 'الكل' || t.company === selectedCompany;
    const matchesSearch =
      t.name.includes(searchQuery) ||
      t.code.includes(searchQuery) ||
      t.fuelType.includes(searchQuery);
    return matchesCompany && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card">
          <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي سعة الحقل</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatNumber(totalCapacity)} <span className="text-xs font-bold text-blue-600">لتر</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">5 خزانات استراتيجية</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card">
          <span className="text-xs font-bold text-slate-400 block mb-1">الوقود المخزون الفعلي</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {formatNumber(totalStored)} <span className="text-xs font-bold">لتر</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-bold mt-1 block">
            معدل الامتلاء العام: {Math.round((totalStored / totalCapacity) * 100)}%
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card">
          <span className="text-xs font-bold text-slate-400 block mb-1">حالة الأمان والسلامة</span>
          <div className="flex items-center gap-2 mt-1">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            <span className="text-xl font-extrabold text-slate-900 dark:text-white">
              {criticalCount === 0 ? 'مستقرة 100%' : `${criticalCount} خزان يحتاج تعبئة`}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">تفريغ الضغط التلقائي فعال</span>
        </div>

        <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
          <span className="text-xs font-bold text-blue-200 block mb-1">الحساسات والمجسات</span>
          <div className="text-2xl font-black font-mono mt-1">
            20 / 20 متصل
          </div>
          <span className="text-[11px] text-blue-100 mt-1 block">قراءات رقمية آنية فائقة الدقة</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            مصفوفة الخزانات والأسطوانات الحية
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-bold">الجهة المالكة:</span>
          {['الكل', 'صحاري كربلاء', 'شركة الاتحاد'].map((comp) => (
            <button
              key={comp}
              onClick={() => setSelectedCompany(comp)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCompany === comp
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {comp}
            </button>
          ))}
        </div>
      </div>

      {/* Tank Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {filteredTanks.map((tank) => (
          <TankVisualGauge key={tank.id} tank={tank} />
        ))}
      </div>
    </div>
  );
};
