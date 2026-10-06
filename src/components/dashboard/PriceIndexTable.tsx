import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useTranslation } from 'react-i18next';
import { Avatar, ChangePill, fmtPrice } from '../suppliers/supplierUi';

/**
 * مؤشرات الأسعار في الرئيسية: نفس أعمدة جدول «كل الموردين» (بلا الشركة المستلمة وآخر تحديث والإجراء)،
 * ومصدرها سجلات الأسعار نفسها؛ الضغط على صف أو «كل الموردين» يفتح صفحة الموردين.
 */
export const PriceIndexTable: React.FC = () => {
  const { supplierPrices, searchQuery, setActiveTab } = useFuelData();
  const { t } = useTranslation(['dashboard', 'common']);
  const rows = supplierPrices
    .filter(item => item.supplierName.includes(searchQuery) || item.product.includes(searchQuery))
    // الرئيسية تعرض آخر 7 موردين تحديثًا فقط؛ القائمة الكاملة في صفحة الموردين
    .sort((a, b) => b.lastUpdated.replace(/-/g, '/').localeCompare(a.lastUpdated.replace(/-/g, '/')))
    .slice(0, 7);

  // العمود الأول (المجهز) بمحاذاة البداية، والباقي في الوسط
  const th = 'px-3 xl:px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-3 xl:px-4 py-3 text-center text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap';
  const open = () => setActiveTab('suppliers');

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden">
      <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-5 bg-blue-600 rounded-full" />
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span>{t('dashboard:priceIndex.title')}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 font-bold border border-blue-200 dark:border-blue-800">
                {t('dashboard:priceIndex.daily')}
              </span>
            </h3>
            <p className="text-xs text-slate-500">{t('dashboard:priceIndex.text')}</p>
          </div>
        </div>
        <button type="button" onClick={open}
          className="h-9 ps-3.5 pe-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:border-teal-400 hover:text-teal-600 cursor-pointer transition-colors">
          {t('dashboard:priceIndex.viewAll')} <ChevronLeft className="w-4 h-4 ltr:rotate-180" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className={`${th} !text-start`}>{t('dashboard:priceIndex.supplier')}</th>
              <th className={th}>{t('dashboard:priceIndex.product')}</th>
              <th className={th}>{t('dashboard:priceIndex.density')}</th>
              <th className={th}>{t('dashboard:priceIndex.color')}</th>
              <th className={th}>{t('dashboard:priceIndex.current')}</th>
              <th className={th}>{t('dashboard:priceIndex.previous')}</th>
              <th className={th}>{t('dashboard:priceIndex.change')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-400">{t('dashboard:priceIndex.empty')}</td></tr>
            )}
            {rows.map(s => (
              <tr key={s.id} onClick={open} className="border-t border-slate-100 dark:border-slate-800 cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className={`${td} !text-start`}>
                  <div className="flex items-center gap-2.5">
                    <Avatar s={s} size="w-8 h-8" text="text-xs" />
                    <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate max-w-[200px] xl:max-w-[260px]">{s.supplierName}</span>
                  </div>
                </td>
                <td className={td}><span className="block truncate max-w-[160px] mx-auto">{s.product || '—'}</span></td>
                <td className={`${td} tabular-nums`}>{s.density || '—'}</td>
                <td className={td}><span className="block truncate max-w-[120px] mx-auto">{s.color || '—'}</span></td>
                <td className={`${td} font-semibold text-slate-900 dark:text-white tabular-nums`}>{fmtPrice(s.priceIqd)}</td>
                <td className={`${td} tabular-nums`}>{fmtPrice(s.previousPriceIqd)}</td>
                <td className={td}><ChangePill pct={s.changePercent} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
