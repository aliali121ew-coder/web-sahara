import React, { useState } from 'react';
import { ClipboardList, Plus, Tractor, Cpu, Zap, Building } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { formatNumber } from '../../lib/utils';

export const SupplyOrders: React.FC<{ onOpenModal: () => void }> = ({ onOpenModal }) => {
  const { supplyRequests, searchQuery } = useFuelData();
  const [selectedSector, setSelectedSector] = useState<string>('الكل');

  const sectors = ['الكل', 'الآليات', 'المولدات', 'المزارع', 'موقع المشروع'];

  const filteredRequests = supplyRequests.filter((r) => {
    const matchesSector = selectedSector === 'الكل' || r.sector === selectedSector;
    const matchesSearch =
      r.requestNumber.includes(searchQuery) ||
      r.beneficiary.includes(searchQuery) ||
      r.requesterName.includes(searchQuery);
    return matchesSector && matchesSearch;
  });

  const getSectorIcon = (sector: string) => {
    switch (sector) {
      case 'الآليات':
        return <Tractor className="w-3.5 h-3.5 text-blue-600" />;
      case 'المولدات':
        return <Cpu className="w-3.5 h-3.5 text-indigo-600" />;
      case 'المزارع':
        return <Zap className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <Building className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            <span>أوامر وطلبات صرف وتجهيز الوقود</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            دورة طلبات المحروقات لقطاعات الآليات والمولدات والمزارع والمشاريع
          </p>
        </div>

        <button
          onClick={onOpenModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>طلب تجهيز جديد</span>
        </button>
      </div>

      {/* Requests Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-soft-card space-y-4">
        {/* Sector Filter Bar */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl self-start w-fit">
          {sectors.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedSector === sec
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px] font-bold uppercase">
                <th className="pb-3 pr-2">رقم الطلب</th>
                <th className="pb-3 px-3">الجهة المستفيدة</th>
                <th className="pb-3 px-3">القطاع</th>
                <th className="pb-3 px-3">المادة</th>
                <th className="pb-3 px-3">الكمية المصروفة</th>
                <th className="pb-3 px-3">مقدم الطلب والمصادق</th>
                <th className="pb-3 pl-2">حالة الصرف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 pr-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {req.requestNumber}
                    </span>
                    <div className="text-[10px] text-slate-400">{req.date} - {req.time}</div>
                  </td>

                  <td className="py-3.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                    <div>{req.beneficiary}</div>
                    {req.notes && (
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">{req.notes}</div>
                    )}
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                      {getSectorIcon(req.sector)}
                      <span>{req.sector}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-semibold">
                    {req.product}
                  </td>

                  <td className="py-3.5 px-3 font-mono font-black text-blue-600 dark:text-blue-400">
                    {formatNumber(req.volumeLiters)} <span className="text-xs font-normal">لتر</span>
                  </td>

                  <td className="py-3.5 px-3 text-xs">
                    <div className="text-slate-800 dark:text-slate-200 font-bold">{req.requesterName}</div>
                    {req.approvedBy && (
                      <div className="text-[10px] text-emerald-600 font-semibold">اعتمد: {req.approvedBy}</div>
                    )}
                  </td>

                  <td className="py-3.5 pl-2">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        req.status === 'معتمد' || req.status === 'تم الصرف'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : req.status === 'قيد الانتظار'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
