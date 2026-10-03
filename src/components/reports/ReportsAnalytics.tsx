import React from 'react';
import { BarChart3, Download, Printer, ShieldCheck } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { formatNumber } from '../../lib/utils';

export const ReportsAnalytics: React.FC = () => {
  const { tanks, deliveries, supplyRequests } = useFuelData();

  const totalFuelStored = tanks.reduce((acc, t) => acc + t.currentLiters, 0);
  const totalDeliveriesVol = deliveries.reduce((acc, d) => acc + (d.receivedQuantity ?? d.volumeLiters ?? 0), 0);
  const totalDispatchedVol = supplyRequests.reduce((acc, r) => acc + r.volumeLiters, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'رمز الخزان,الاسم,النوع,الشركة,السعة,المخزون الفعلي,النسبة\n' +
      tanks
        .map(
          (t) =>
            `${t.code},${t.name},${t.fuelType},${t.company},${t.capacityLiters},${t.currentLiters},${t.percentage}%`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `تقرير_وقود_صحاري_كربلاء_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header with Export & Print */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <span>التقارير التحليلية وجرد الوقود الشامل</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            كشوفات دورية رسمية معتمدة قابلة للطباعة والتصدير كملفات Excel و PDF
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel/CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير الرسمي</span>
          </button>
        </div>
      </div>

      {/* Official Report Container */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 print:p-0 print:border-none print:shadow-none shadow-soft-card space-y-6">
        {/* Report Official Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest">
              جمهورية العراق - محافظة كربلاء المقدسة
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
              تقرير موقف المحروقات والخزينات اليومي لصحاري كربلاء 2026
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              الرقم المرجعي: <span className="font-mono text-slate-600 dark:text-slate-300">SH-REP-2026-0820</span>
            </p>
          </div>

          <div className="text-left sm:text-left text-xs text-slate-500">
            <div>تاريخ الإصدار: <strong>2026/08/20</strong></div>
            <div>جهة التقرير: <strong>مركز التحكم والسيطرة الميداني</strong></div>
          </div>
        </div>

        {/* Executive Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-slate-400">إجمالي المخزون الفعلي</span>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {formatNumber(totalFuelStored)} لتر
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-slate-400">إجمالي واردات الفترة</span>
            <div className="text-xl font-black text-emerald-600 font-mono mt-1">
              {formatNumber(totalDeliveriesVol)} لتر
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-slate-400">إجمالي مصروفات الوقود</span>
            <div className="text-xl font-black text-blue-600 font-mono mt-1">
              {formatNumber(totalDispatchedVol)} لتر
            </div>
          </div>
        </div>

        {/* Detailed Tank Balance Table */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            1. جدول الجرد الميداني للخزانات
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <th className="p-2.5 rounded-r-xl">الرمز</th>
                  <th className="p-2.5">اسم الخزان</th>
                  <th className="p-2.5">نوع الوقود</th>
                  <th className="p-2.5">الجهة</th>
                  <th className="p-2.5">السعة الكلية</th>
                  <th className="p-2.5">المخزون الحالي</th>
                  <th className="p-2.5">نسبة الامتلاء</th>
                  <th className="p-2.5 rounded-l-xl">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tanks.map((tank) => (
                  <tr key={tank.id}>
                    <td className="p-2.5 font-mono font-bold text-blue-600">{tank.code}</td>
                    <td className="p-2.5 font-bold">{tank.name}</td>
                    <td className="p-2.5">{tank.fuelType}</td>
                    <td className="p-2.5">{tank.company}</td>
                    <td className="p-2.5 font-mono">{formatNumber(tank.capacityLiters)} لتر</td>
                    <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">
                      {formatNumber(tank.currentLiters)} لتر
                    </td>
                    <td className="p-2.5 font-mono font-bold">{tank.percentage}%</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                        {tank.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Report Official Footer / Sign-off */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>معتمد إلكترونياً بتوقيع المشرف العام: <strong>ali - مدير النظام</strong></span>
          </div>
          <div>ختم السيطرة والعمليات: <strong className="text-blue-600 font-mono">SAHARA-2026-VERIFIED</strong></div>
        </div>
      </div>
    </div>
  );
};
