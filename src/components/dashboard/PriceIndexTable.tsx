import React from 'react';
import { useFuelData } from '../../context/FuelDataContext';
import { useTranslation } from 'react-i18next';
import { Avatar, ChangePill, fmtPrice } from '../suppliers/supplierUi';

/**
 * مؤشرات الأسعار في الرئيسية: نفس أعمدة جدول «كل الموردين» (بلا الشركة المستلمة وآخر تحديث والإجراء)،
 * ومصدرها سجلات الأسعار نفسها؛ الضغط على صف يفتح صفحة الموردين.
 */
export const PriceIndexTable: React.FC = () => {
  const { supplierPrices, searchQuery, setActiveTab } = useFuelData();
  const { t } = useTranslation(['dashboard', 'common']);
  const rows = supplierPrices
    .filter(item => item.supplierName.includes(searchQuery) || item.product.includes(searchQuery))
    // الرئيسية تعرض آخر 7 موردين تحديثًا فقط؛ القائمة الكاملة في صفحة الموردين
    .sort((a, b) => b.lastUpdated.replace(/-/g, '/').localeCompare(a.lastUpdated.replace(/-/g, '/')))
    .slice(0, 7);

  // كل العناوين في الوسط؛ خلية المجهز (الشعار والاسم) بمحاذاة البداية
  const th = 'px-3 xl:px-4 pt-3 pb-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap';
  // كل صف كارت مستقل: خلفية وحدود أعلى/أسفل للخلايا، والطرفان بحد جانبي وزوايا دائرية
  const td = 'px-3 xl:px-4 py-3 text-center text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800 transition-colors group-hover:bg-teal-50/50 group-hover:border-teal-200 dark:group-hover:bg-teal-950/20 dark:group-hover:border-teal-900 first:border-s first:rounded-s-2xl last:border-e last:rounded-e-2xl';
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
      </div>

      <div className="overflow-x-auto px-3 sm:px-4 pb-4 bg-slate-50/70 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800">
        <table className="w-full border-separate border-spacing-y-1.5">
          <thead>
            <tr>
              <th className={th}>{t('dashboard:priceIndex.supplier')}</th>
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
              <tr key={s.id} onClick={open} className="group cursor-pointer">
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
