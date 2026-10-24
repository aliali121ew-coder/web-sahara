/* eslint-disable i18next/no-literal-string */
import React, { useState } from 'react';
import type { VehicleItem, VehicleCompartment } from './types';
import { VehicleCurveChart } from './VehicleCurveChart';
import {
  X,
  Printer,
  ShieldCheck,
  Fuel,
  User,
  Phone,
  MapPin,
  TrendingUp,
  Award,
  Layers,
  Clock,
  Sparkles,
} from 'lucide-react';

interface Props {
  vehicle: VehicleItem | null;
  onClose: () => void;
}

export const LargeTruckModal: React.FC<Props> = ({ vehicle, onClose }) => {
  const [selectedCompartment, setSelectedCompartment] = useState<VehicleCompartment | null>(() => {
    return vehicle?.compartments[1] || vehicle?.compartments[0] || null;
  });

  const [activeTab, setActiveTab] = useState<'specs' | 'curve' | 'orders'>('specs');

  if (!vehicle) return null;

  const currentComp = selectedCompartment || vehicle.compartments[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-xl overflow-y-auto animate-in fade-in duration-200">
      {/* Modal Dialog */}
      <div className="relative w-full max-w-7xl bg-[#0c1222] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Top High-Tech Command Bar */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white font-black text-sm">
              TRC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white font-cairo">
                  {vehicle.plateDisplay}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {vehicle.company}
                </span>
                {vehicle.isTop15Percent && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>أعلى 15% استهلاكاً</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {vehicle.modelName} • {vehicle.fuelType}
              </p>
            </div>
          </div>

          {/* Quick Tabs & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('specs')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === 'specs'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                فحص الشاحنة والمقصورات
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('curve')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === 'curve'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                كريف الاستهلاك
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === 'orders'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                سجل التفويلات ({vehicle.refillHistory.length})
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              title="طباعة بطاقة فحص الشاحنة"
              className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">طباعة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-all border border-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* SECTION 1: THE BIG TRUCK SHOWCASE (Matching Image 2) */}
          <div className="relative rounded-3xl bg-gradient-to-b from-[#101932] via-[#0d1428] to-[#090e1c] border border-blue-900/40 p-4 sm:p-6 overflow-hidden shadow-2xl">
            {/* Ambient Background lights */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Sub-Bar of Truck Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80 relative z-10">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black tracking-widest uppercase text-blue-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>نظام مراقبة مقطورات الوقود الثقيلة 2026</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400">
                  سعة الخزان: <strong className="text-white font-mono">{vehicle.tankCapacityLiters.toLocaleString()} لتر</strong>
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>آخر تفويلة:</span>
                  <strong className="text-slate-200">{vehicle.lastFuelingDate} {vehicle.lastFuelingTime}</strong>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                  <span>عدد التفويلات:</span>
                  <strong className="text-emerald-400 font-mono text-sm">{vehicle.fuelingsCount}</strong>
                </div>
              </div>
            </div>

            {/* Truck Interactive Visual Container (Image 2 Replica) */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Specs Column (Tomas Birtner / Driver & Engine specs like Image 2) */}
              <div className="lg:col-span-3 space-y-4">
                {/* Driver Card */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-slate-400 font-bold">السائق المعتمد</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      <span>سائق مثالي</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-600 border border-slate-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                      <User className="w-6 h-6 text-slate-200" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-white">{vehicle.driverName}</h5>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-blue-400" />
                        <span dir="ltr">{vehicle.driverPhone}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Engine & Vehicle Specs */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">طراز المحرك</span>
                    <span className="text-xs font-bold text-slate-100 font-mono">{vehicle.engineType}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-2 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">نسبة الاستخدام</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-base font-black text-white font-mono">{vehicle.utilizationPercent}%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">كفاءة استهلاك الوقود</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono block mt-0.5">{vehicle.fuelEfficiency}</span>
                    </div>
                  </div>
                </div>

                {/* Selected Compartment Detail Callout */}
                {currentComp && (
                  <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/60 shadow-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        <span>تفاصيل {currentComp.code} ({currentComp.name})</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white">
                        {currentComp.percentage}% ممتلئ
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-purple-900/50">
                      <div>
                        <span className="text-[10px] text-slate-400 block">الكمية الحالية:</span>
                        <strong className="text-white font-mono">{currentComp.currentLiters.toLocaleString()} لتر</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">الحرارة والكثافة:</span>
                        <strong className="text-slate-300 font-mono">{currentComp.temperatureC}°C • {currentComp.density}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Central Big Truck View with Interactive Compartment Overlays (Image 2 Design) */}
              <div className="lg:col-span-9 relative flex flex-col items-center">
                <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden bg-slate-950/60 border border-slate-800/80 p-2 sm:p-4 shadow-inner">
                  {/* Semi-Truck Photo / Side-view render */}
                  <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] rounded-xl overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                    <img
                      src="/trucks/semi_truck.jpg"
                      alt="Semi Truck Side View"
                      className="w-full h-full object-contain filter contrast-105"
                      onError={(e) => {
                        // Fallback SVG if image not yet loaded
                        e.currentTarget.style.display = 'none';
                      }}
                    />

                    {/* Interactive Cargo Compartments Overlay Bar (Image 2 replica) */}
                    <div
                      className="absolute top-[8%] left-[27%] right-[4%] bottom-[33%] rounded-lg border-2 border-dashed border-white/20 bg-slate-950/30 backdrop-blur-[2px] flex items-stretch p-1 gap-1 z-10"
                      dir="ltr"
                    >
                      {vehicle.compartments.map((comp) => {
                        const isSelected = selectedCompartment?.code === comp.code;
                        return (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => setSelectedCompartment(comp)}
                            className={`flex-1 rounded-md transition-all flex flex-col justify-between p-1.5 sm:p-2.5 text-left relative cursor-pointer group ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-xl shadow-purple-600/50 scale-[1.02] border-2 border-white/90 z-20'
                                : 'bg-slate-900/85 hover:bg-slate-800/90 text-slate-200 border border-slate-700/80'
                            }`}
                          >
                            {/* Compartment Code & Kg/Liters */}
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-[10px] sm:text-xs font-mono font-black ${isSelected ? 'text-white' : 'text-purple-400'}`}>
                                {comp.code}
                              </span>
                              <span className={`text-[9px] sm:text-[10px] font-mono opacity-80`}>
                                {Math.round(comp.currentLiters / 1000)}k L
                              </span>
                            </div>

                            {/* Centered % or badge */}
                            <div className="my-auto text-center">
                              <span className={`text-xs sm:text-sm md:text-base font-black font-mono block ${isSelected ? 'text-white' : 'text-slate-100'}`}>
                                {comp.percentage}%
                              </span>
                              <span className={`text-[9px] block uppercase font-bold tracking-tight opacity-75 ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                                {comp.status}
                              </span>
                            </div>

                            {/* Micro Progress bar */}
                            <div className="w-full bg-black/40 h-1 sm:h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isSelected ? 'bg-white' : comp.percentage > 80 ? 'bg-emerald-400' : 'bg-blue-400'
                                }`}
                                style={{ width: `${comp.percentage}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hint indicator */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 px-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                      <span>انقر على أي مقصورة في المقطورة (#A1 إلى #A5) لعرض تفاصيلها المباشرة</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      Total Capacity: {vehicle.tankCapacityLiters.toLocaleString()} L
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: THE VEHICLE CURVE ("وكريف لكل سيارة") */}
          <div>
            <VehicleCurveChart
              data={vehicle.curveData}
              truckNumber={vehicle.plateDisplay}
              avgLiters={vehicle.avgLitersPerFill}
            />
          </div>

          {/* SECTION 3: BOTTOM SPLIT (Map Waypoint + Fueling Orders Log, Image 2 style) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Box: Route & Station Docking Radar */}
            <div className="lg:col-span-4 rounded-3xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span>مسار وتفريغ الشاحنة</span>
                  </h4>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                    {vehicle.dockNumber}
                  </span>
                </div>

                {/* Waypoint timeline matching bottom-left of Image 2 */}
                <div className="space-y-4 my-4 relative pr-4 border-r-2 border-blue-500/30">
                  <div className="relative">
                    <div className="absolute -right-[23px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                    <span className="text-[10px] text-slate-400 font-mono block">نقطة الانطلاق (المصدر)</span>
                    <h6 className="text-xs font-bold text-slate-100">{vehicle.route.from}</h6>
                  </div>

                  <div className="relative">
                    <div className="absolute -right-[23px] top-1 w-3.5 h-3.5 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
                    <span className="text-[10px] text-slate-400 font-mono block">محطة الوصول والتفريغ</span>
                    <h6 className="text-xs font-bold text-slate-100">{vehicle.route.to}</h6>
                  </div>

                  <div className="relative">
                    <div className="absolute -right-[23px] top-1 w-3.5 h-3.5 rounded-full bg-purple-500 ring-4 ring-purple-500/20 animate-pulse" />
                    <span className="text-[10px] text-slate-400 font-mono block">المضخة ورصيف التعبئة</span>
                    <h6 className="text-xs font-bold text-purple-300">{vehicle.dockNumber}</h6>
                  </div>
                </div>
              </div>

              {/* Station Pump status summary */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>حالة الرصيف:</span>
                  <span className="font-bold text-emerald-400">موصول بنظام سكادا (SCADA)</span>
                </div>
              </div>
            </div>

            {/* Right Box: Order / Refill List (Image 2 style) */}
            <div className="lg:col-span-8 rounded-3xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>سجل التفويلات وشحنات الشاحنة (Order List)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    جميع الشحنات والتفريغات المرتبطة بالعجلة {vehicle.plateDisplay}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                  {vehicle.refillHistory.length} تفويلة مسجلة
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">التاريخ والوقت</th>
                      <th className="py-2.5 px-3">رقم الفوجر</th>
                      <th className="py-2.5 px-3">الكمية (لتر)</th>
                      <th className="py-2.5 px-3">نوع الوقود</th>
                      <th className="py-2.5 px-3">السعر والتكلفة</th>
                      <th className="py-2.5 px-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {vehicle.refillHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white">{rec.date}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{rec.time}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-blue-400 font-bold">
                          {rec.voucherNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                          {rec.quantityLiters.toLocaleString()} لتر
                        </td>
                        <td className="py-2.5 px-3">
                          <span>{rec.product}</span>
                          <span className="text-[10px] text-slate-500 block">كثافة {rec.density}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <div className="text-white">{rec.unitPriceIqd} د.ع</div>
                          <div className="text-[10px] text-slate-500">{rec.totalCostIqd.toLocaleString()} د.ع</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
