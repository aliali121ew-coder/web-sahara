/* eslint-disable i18next/no-literal-string */
import React, { useState, useMemo } from 'react';
import { useFuelStore } from '../../context/FuelDataContext';
import { buildFleetAnalytics } from './vehicleDataUtils';
import { TruckCard } from './TruckCard';
import { TopConsumersPanel } from './TopConsumersPanel';
import { LargeTruckModal } from './LargeTruckModal';
import type { VehicleItem } from './types';
import {
  Truck,
  Fuel,
  TrendingUp,
  Clock,
  Search,
  LayoutGrid,
  List,
  Award,
  Layers,
  ArrowUpDown,
  Printer,
} from 'lucide-react';

export const VehiclesReport: React.FC = () => {
  const { saharaDeliveries, etihadDeliveries } = useFuelStore();

  // State for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<'all' | 'sahara' | 'etihad'>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'fuelings' | 'consumption' | 'latest' | 'plate'>('consumption');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Selected vehicle for large truck modal (Image 2)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleItem | null>(null);

  // Build reactive analytics data
  const { vehicles, kpis, top15PercentVehicles } = useMemo(() => {
    return buildFleetAnalytics(saharaDeliveries, etihadDeliveries);
  }, [saharaDeliveries, etihadDeliveries]);

  // Filtered and sorted vehicles for the left fleet grid
  const filteredVehicles = useMemo(() => {
    let list = [...vehicles];

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        v =>
          v.truckNumber.toLowerCase().includes(q) ||
          v.plateDisplay.toLowerCase().includes(q) ||
          v.driverName.toLowerCase().includes(q) ||
          v.supplierCompany.toLowerCase().includes(q) ||
          v.fuelType.toLowerCase().includes(q)
      );
    }

    // Filter by company
    if (companyFilter === 'sahara') {
      list = list.filter(v => v.company === 'صحاري كربلاء');
    } else if (companyFilter === 'etihad') {
      list = list.filter(v => v.company === 'شركة الاتحاد');
    }

    // Filter by fuel type
    if (fuelFilter !== 'all') {
      list = list.filter(v => v.fuelType === fuelFilter);
    }

    // Sorting
    switch (sortBy) {
      case 'fuelings':
        list.sort((a, b) => b.fuelingsCount - a.fuelingsCount);
        break;
      case 'consumption':
        list.sort((a, b) => b.totalFuelLiters - a.totalFuelLiters);
        break;
      case 'latest':
        list.sort((a, b) => b.lastFuelingDate.localeCompare(a.lastFuelingDate));
        break;
      case 'plate':
        list.sort((a, b) => a.truckNumber.localeCompare(b.truckNumber));
        break;
    }

    return list;
  }, [vehicles, searchQuery, companyFilter, fuelFilter, sortBy]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 font-cairo">
      {/* 🌟 1. Enterprise Page Header */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>تقرير وتحليل العربات والأسطول</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {kpis.totalVehicles} شاحنة
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تحليل عمليات التفويل، كفاءة الاستهلاك، رصد أعلى 15%، وفحص الشاحنات الكبيرة
              </p>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold border border-slate-200/80 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* 🌟 2. TOP METRIC CARDS ("في الاعلاه كارتات" - Image 3 Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Total Vehicles */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">إجمالي العربات</span>
            <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-500">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {kpis.totalVehicles}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">
            {kpis.activeTrucksNow} شاحنة نشطة الآن
          </span>
        </div>

        {/* Card 2: Total Refills */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">إجمالي التفويلات</span>
            <span className="p-1.5 rounded-xl bg-purple-500/10 text-purple-500">
              <Fuel className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {kpis.totalFuelings}
          </div>
          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold mt-1 block">
            عملية تفويل وتفريغ
          </span>
        </div>

        {/* Card 3: Total Fuel Volume */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">حجم الوقود الإجمالي</span>
            <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
            {Math.round(kpis.totalFuelVolumeLiters / 1000)}k <span className="text-xs font-normal text-slate-400">لتر</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1 block">
            {kpis.totalFuelVolumeLiters.toLocaleString()} لتر كلي
          </span>
        </div>

        {/* Card 4: Avg Liters per fill */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">متوسط التفويلة</span>
            <span className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-500">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
            {kpis.avgLitersPerFueling.toLocaleString()} <span className="text-xs font-normal text-slate-400">لتر</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1 block">
            معدل الشحنة الواحدة
          </span>
        </div>

        {/* Card 5: Latest Refill */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">أحدث تفويلة</span>
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono truncate">
            {kpis.latestRefillDate}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1 block truncate">
            العجلة: {kpis.latestRefillTruck}
          </span>
        </div>

        {/* Card 6: Top Refueled Truck */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">الأكثر تفويلاً</span>
            <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 font-mono truncate">
            {kpis.topRefueledTruck.truckNumber}
          </div>
          <span className="text-[11px] text-indigo-500 dark:text-indigo-300 font-bold mt-1 block">
            {kpis.topRefueledTruck.count} تفويلة مسجلة
          </span>
        </div>
      </div>

      {/* 🌟 3. MAIN SPLIT LAYOUT:
          - RIGHT: أعلى استهلاك 15% ("الصقحة تنقسم الى اعلى استهلاك 15% على اليمين")
          - LEFT: الباقي على اليسار ("ولباقي على اليسار")
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 👉 RIGHT COLUMN: TOP 15% CONSUMPTION (4 of 12 cols in RTL) */}
        <div className="lg:col-span-4 order-1 lg:order-1 sticky top-16">
          <TopConsumersPanel
            topVehicles={top15PercentVehicles}
            onSelect={setSelectedVehicle}
            totalStationFuel={kpis.totalFuelVolumeLiters}
          />
        </div>

        {/* 👈 LEFT COLUMN: FLEET GRID & REMAINING VEHICLES (8 of 12 cols in RTL) */}
        <div className="lg:col-span-8 order-2 lg:order-2 space-y-4">
          {/* Controls Bar: Search, Filters, Sorting, View Toggle */}
          <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Search Box */}
              <div className="relative w-full sm:flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم العجلة، اسم السائق، أو نوع الوقود..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    مسح
                  </button>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-xl transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="عرض بطاقات الشاحنات"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-xl transition-all ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="عرض جدول تفصيلي"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Chips & Sorting Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              {/* Company filters */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-bold ml-1">الشركة:</span>
                <button
                  type="button"
                  onClick={() => setCompanyFilter('all')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all ${
                    companyFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  الكل ({vehicles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyFilter('sahara')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all ${
                    companyFilter === 'sahara'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  صحاري كربلاء
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyFilter('etihad')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all ${
                    companyFilter === 'etihad'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  شركة الاتحاد
                </button>
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" />
                  <span>ترتيب:</span>
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
                >
                  <option value="consumption">الأعلى استهلاكاً (لتر)</option>
                  <option value="fuelings">الأكثر تفويلاً (مرات)</option>
                  <option value="latest">الأحدث تفويلاً</option>
                  <option value="plate">رقم اللوحة والعجلة</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fleet Vehicles Grid (Image 3 Style) */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredVehicles.map((vehicle) => (
                <TruckCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onSelect={setSelectedVehicle}
                />
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-soft-card">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">رقم العجلة واللوحة</th>
                      <th className="py-3 px-4">السائق</th>
                      <th className="py-3 px-4">الشركة</th>
                      <th className="py-3 px-4">نوع الوقود</th>
                      <th className="py-3 px-4">عدد التفويلات</th>
                      <th className="py-3 px-4">إجمالي اللترات</th>
                      <th className="py-3 px-4">آخر تفويلة</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {filteredVehicles.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedVehicle(v)}
                        className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white font-mono">{v.truckNumber}</div>
                          <div className="text-[11px] text-slate-400">{v.plateDisplay}</div>
                        </td>
                        <td className="py-3 px-4 font-bold">{v.driverName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {v.company}
                          </span>
                        </td>
                        <td className="py-3 px-4">{v.fuelType}</td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {v.fuelingsCount}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {v.totalFuelLiters.toLocaleString()} لتر
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {v.lastFuelingDate}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {v.statusText}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVehicle(v);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                          >
                            فحص الشاحنة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty search results fallback */}
          {filteredVehicles.length === 0 && (
            <div className="text-center py-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8">
              <Truck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">لا توجد عربات مطابقة للبحث</h4>
              <p className="text-xs text-slate-400 mt-1">جرب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCompanyFilter('all');
                  setFuelFilter('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
              >
                إعادة ضبط البحث
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 4. THE LARGE TRUCK MODAL ("عند ضغط تنفتح كما في الصورة الشاحنة الكبيرة" - Image 2) */}
      <LargeTruckModal
        vehicle={selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
      />
    </div>
  );
};

export default VehiclesReport;
