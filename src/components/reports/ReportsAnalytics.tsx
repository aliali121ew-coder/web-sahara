import { useTranslation } from 'react-i18next';
import { enumText } from '../../i18n/enums';
import React from 'react';
import { BarChart3, Download, Printer, ShieldCheck } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { formatNumber, getBusinessDate } from '../../lib/utils';

export const ReportsAnalytics: React.FC = () => {
  const { t } = useTranslation(['pages', 'common']);
  const { tanks, deliveries, supplyRequests } = useFuelData();
  // تاريخ الإصدار ورقم المرجع من يوم العمل الحالي (لا تاريخ ثابت)
  const issuedDate = getBusinessDate();
  const reportRef = `SH-REP-${issuedDate.replace(/\D/g, '')}`;

  const totalFuelStored = tanks.reduce((acc, t) => acc + t.currentLiters, 0);
  const totalDeliveriesVol = deliveries.reduce((acc, d) => acc + (d.receivedQuantity ?? d.volumeLiters ?? 0), 0);
  const totalDispatchedVol = supplyRequests.reduce((acc, r) => acc + r.volumeLiters, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      t('pages:reports.csvHeader') + '\n' +
      tanks
        .map(
          (tk) =>
            `${tk.code},${tk.name},${enumText(tk.fuelType)},${enumText(tk.company)},${tk.capacityLiters},${tk.currentLiters},${tk.percentage}%`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${t('pages:reports.csvFile')}_${new Date().toISOString().slice(0, 10)}.csv`);
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
            <span>{t('pages:reports.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('pages:reports.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t('pages:reports.csv')}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('pages:reports.print')}</span>
          </button>
        </div>
      </div>

      {/* Official Report Container */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 print:p-0 print:border-none print:shadow-none shadow-soft-card space-y-6">
        {/* Report Official Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest">
              {t('pages:reports.country')}
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {t('pages:reports.docTitle')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('pages:reports.ref')} <span className="font-mono text-slate-600 dark:text-slate-300">{reportRef}</span>
            </p>
          </div>

          <div className="text-left sm:text-left text-xs text-slate-500">
            <div>{t('pages:reports.issued')} <strong>{issuedDate}</strong></div>
            <div>{t('pages:reports.issuer')} <strong>{t('pages:reports.issuerName')}</strong></div>
          </div>
        </div>

        {/* Executive Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-slate-400">{t('pages:reports.stock')}</span>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {formatNumber(totalFuelStored)} {t('common:units.liter')}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-slate-400">{t('pages:reports.inbound')}</span>
            <div className="text-xl font-black text-emerald-600 font-mono mt-1">
              {formatNumber(totalDeliveriesVol)} {t('common:units.liter')}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-slate-400">{t('pages:reports.dispatched')}</span>
            <div className="text-xl font-black text-blue-600 font-mono mt-1">
              {formatNumber(totalDispatchedVol)} {t('common:units.liter')}
            </div>
          </div>
        </div>

        {/* Detailed Tank Balance Table */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            {t('pages:reports.tableTitle')}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <th className="p-2.5 rounded-s-xl">{t('pages:reports.col.code')}</th>
                  <th className="p-2.5">{t('pages:reports.col.name')}</th>
                  <th className="p-2.5">{t('pages:reports.col.fuel')}</th>
                  <th className="p-2.5">{t('pages:reports.col.company')}</th>
                  <th className="p-2.5">{t('pages:reports.col.capacity')}</th>
                  <th className="p-2.5">{t('pages:reports.col.current')}</th>
                  <th className="p-2.5">{t('pages:reports.col.fill')}</th>
                  <th className="p-2.5 rounded-e-xl">{t('pages:reports.col.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tanks.map((tank) => (
                  <tr key={tank.id}>
                    <td className="p-2.5 font-mono font-bold text-blue-600">{tank.code}</td>
                    <td className="p-2.5 font-bold">{tank.name}</td>
                    <td className="p-2.5">{enumText(tank.fuelType)}</td>
                    <td className="p-2.5">{enumText(tank.company)}</td>
                    <td className="p-2.5 font-mono">{formatNumber(tank.capacityLiters)} {t('common:units.liter')}</td>
                    <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">
                      {formatNumber(tank.currentLiters)} {t('common:units.liter')}
                    </td>
                    <td className="p-2.5 font-mono font-bold">{tank.percentage}%</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                        {enumText(tank.status)}
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
            <span>{t('pages:reports.signed')} <strong>{t('pages:reports.signer')}</strong></span>
          </div>
          <div>{t('pages:reports.stamp')} <strong className="text-blue-600 font-mono">SAHARA-2026-VERIFIED</strong></div>
        </div>
      </div>
    </div>
  );
};
