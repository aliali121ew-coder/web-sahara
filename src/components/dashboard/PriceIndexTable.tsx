import React from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Building
} from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import { enumText } from '../../i18n/enums';
import { formatIQD } from '../../lib/utils';

export const PriceIndexTable: React.FC = () => {
  const { supplierPrices, searchQuery } = useFuelData();
  const { isRTL } = useLanguage();
  const { t } = useTranslation(['dashboard', 'common']);
  const filteredPrices = supplierPrices.filter((item) => {
    const matchesSearch =
      item.supplierName.includes(searchQuery) ||
      item.product.includes(searchQuery);
    return matchesSearch;
  })
    // الرئيسية تعرض آخر 7 موردين تحديثًا فقط؛ القائمة الكاملة في صفحة الموردين
    .sort((a, b) => b.lastUpdated.replace(/-/g, '/').localeCompare(a.lastUpdated.replace(/-/g, '/')))
    .slice(0, 7);

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-soft-card space-y-4">
      {/* Table Header & Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-5 bg-blue-600 rounded-full" />
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span>{t('dashboard:priceIndex.title')}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 font-bold border border-blue-200 dark:border-blue-800">
                {t('dashboard:priceIndex.daily')}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {t('dashboard:priceIndex.text')}
            </p>
          </div>
        </div>

      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs sm:text-sm`}>
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px] font-bold uppercase">
              <th className="pb-3 pr-2">{t('dashboard:priceIndex.supplier')}</th>
              <th className="pb-3 px-3">{t('dashboard:priceIndex.product')}</th>
              <th className="pb-3 px-3">{t('dashboard:priceIndex.category')}</th>
              <th className="pb-3 px-3">{t('dashboard:priceIndex.current')}</th>
              <th className="pb-3 px-3">{t('dashboard:priceIndex.previous')}</th>
              <th className="pb-3 pl-2">{t('dashboard:priceIndex.change')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {filteredPrices.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  {t('dashboard:priceIndex.empty')}
                </td>
              </tr>
            ) : (
              filteredPrices.map((row) => {
                const isPriceUp = row.changePercent > 0;
                const isPriceDown = row.changePercent < 0;

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Supplier Name */}
                    <td className="py-3.5 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                          <Building className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {row.supplierName}
                        </span>
                      </div>
                    </td>

                    {/* Product */}
                    <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                      {row.product}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          row.category === 'حكومي'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : row.category === 'رسمي'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {enumText(row.category)}
                      </span>
                    </td>

                    {/* Current Price */}
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {formatIQD(row.priceIqd)}
                    </td>

                    {/* Previous Price */}
                    <td className="py-3.5 px-3 font-mono text-slate-400">
                      {formatIQD(row.previousPriceIqd)}
                    </td>

                    {/* Change % */}
                    <td className="py-3.5 pl-2">
                      {isPriceUp && (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-mono font-bold text-xs bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                          <ArrowUpRight className="w-3 h-3" />
                          +{row.changePercent}%
                        </span>
                      )}
                      {isPriceDown && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                          <ArrowDownRight className="w-3 h-3" />
                          {row.changePercent}%
                        </span>
                      )}
                      {!isPriceUp && !isPriceDown && (
                        <span className="text-slate-400 font-mono text-xs px-2 py-0.5">0.0%</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
