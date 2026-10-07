import React from 'react';
import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, BadgeDollarSign } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useTranslation } from 'react-i18next';
import { Avatar, fmtPrice } from '../suppliers/supplierUi';
import { SectionHeader } from './SectionHeader';

/** مربع الاتجاه لفرق التغيّر: سهم مستقيم داخل كارت صغير بدل الإشارة (+ / −) */
const DirBox: React.FC<{ v: number }> = ({ v }) => {
  const tone = v > 0 ? 'bg-rose-50/70 text-rose-400 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/60'
    : v < 0 ? 'bg-emerald-50/70 text-emerald-500 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60'
    : 'bg-slate-50 text-slate-400 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700';
  return (
    <span className={`w-4 h-4 rounded ring-1 flex items-center justify-center shrink-0 ${tone}`}>
      {v > 0 ? <ArrowUp className="w-2.5 h-2.5" strokeWidth={2} /> : v < 0 ? <ArrowDown className="w-2.5 h-2.5" strokeWidth={2} /> : <Minus className="w-2.5 h-2.5" strokeWidth={2} />}
    </span>
  );
};

const toneText = (v: number) => (v > 0 ? 'text-rose-600 dark:text-rose-400' : v < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400');

/** خلية التغيّر: سهم الاتجاه المائل داخل مربع صغير، والنسبة نصًا ملوّنًا */
const ChangeCell: React.FC<{ pct: number }> = ({ pct }) => {
  const up = pct > 0, down = pct < 0;
  const box = up ? 'bg-rose-50 text-rose-500 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-900'
    : down ? 'bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900'
    : 'bg-slate-50 text-slate-400 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700';
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-6 h-6 rounded-md ring-1 flex items-center justify-center shrink-0 ${box}`}>
        {up ? <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.5} /> : down ? <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />}
      </span>
      <span dir="ltr" className={`text-[14.5px] font-extrabold tabular-nums ${toneText(pct)}`}>{up ? '+' : ''}{pct}%</span>
    </span>
  );
};

/**
 * مؤشرات الأسعار في الرئيسية: نفس أعمدة جدول «كل الموردين» (بلا الشركة المستلمة وآخر تحديث والإجراء)،
 * ومصدرها سجلات الأسعار نفسها؛ للعرض فقط (الصفوف لا تنقل لأي صفحة).
 */
export const PriceIndexTable: React.FC = () => {
  const { supplierPrices, searchQuery } = useFuelData();
  const { t } = useTranslation(['dashboard', 'common']);
  const rows = supplierPrices
    .filter(item => item.supplierName.includes(searchQuery) || item.product.includes(searchQuery))
    // الرئيسية تعرض آخر 7 موردين تحديثًا فقط؛ القائمة الكاملة في صفحة الموردين
    .sort((a, b) => b.lastUpdated.replace(/-/g, '/').localeCompare(a.lastUpdated.replace(/-/g, '/')))
    .slice(0, 7);

  // كل العناوين في الوسط؛ خلية المجهز (الشعار والاسم) بمحاذاة البداية
  const th = 'px-3 xl:px-4 pt-3 pb-1 text-center text-[13px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap';
  // كل صف كارت مستقل: خلفية وحدود أعلى/أسفل للخلايا، والطرفان بحد جانبي وزوايا دائرية
  const td = 'px-3 xl:px-4 py-3 text-center text-[14px] whitespace-nowrap bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800 first:border-s first:rounded-s-2xl last:border-e last:rounded-e-2xl';
  const plain = 'font-medium text-slate-800 dark:text-slate-100';
  const iqd = 'text-[11.5px] font-medium text-slate-500 dark:text-slate-400';

  return (
    <div className="space-y-3.5">
      <SectionHeader title={t('dashboard:priceIndex.title')} icon={
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/20">
          <BadgeDollarSign className="w-4 h-4 text-blue-100" />
        </div>
      } />
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden">
      <div className="overflow-x-auto px-3 sm:px-4 pb-4 bg-slate-50/70 dark:bg-slate-950/30">
        <table className="w-full border-separate border-spacing-y-1.5">
          <thead>
            <tr>
              <th className={th}>{t('dashboard:priceIndex.supplier')}</th>
              <th className={th}>{t('dashboard:priceIndex.product')}</th>
              <th className={th}>{t('dashboard:priceIndex.density')}</th>
              <th className={th}>{t('dashboard:priceIndex.color')}</th>
              <th className={th}>{t('dashboard:priceIndex.current')}</th>
              <th className={th}>{t('dashboard:priceIndex.previous')}</th>
              <th className={th}>{t('dashboard:priceIndex.diff')}</th>
              <th className={th}>{t('dashboard:priceIndex.change')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">{t('dashboard:priceIndex.empty')}</td></tr>
            )}
            {rows.map(s => (
              <tr key={s.id}>
                <td className={`${td} ${plain} !text-start`}>
                  <div className="flex items-center gap-2.5">
                    <Avatar s={s} size="w-8 h-8" text="text-xs" />
                    <span className="text-[14.5px] font-bold text-slate-900 dark:text-white truncate max-w-[200px] xl:max-w-[260px]">{s.supplierName}</span>
                  </div>
                </td>
                <td className={`${td} ${plain}`}><span className="block truncate max-w-[160px] mx-auto">{s.product || '—'}</span></td>
                <td className={`${td} ${plain} tabular-nums`}>{s.density || '—'}</td>
                <td className={`${td} ${plain}`}><span className="block truncate max-w-[120px] mx-auto">{s.color || '—'}</span></td>
                <td className={`${td} font-extrabold text-slate-900 dark:text-white tabular-nums`}>{fmtPrice(s.priceIqd)} <span className={iqd}>{t('common:units.iqd')}</span></td>
                <td className={`${td} tabular-nums font-normal text-slate-700 dark:text-slate-300`}>{fmtPrice(s.previousPriceIqd)} <span className={iqd}>{t('common:units.iqd')}</span></td>
                <td className={`${td} tabular-nums font-bold ${toneText(s.priceIqd - s.previousPriceIqd)}`}>
                  {s.priceIqd - s.previousPriceIqd ? (
                    <span className="inline-flex items-center gap-1.5">
                      <DirBox v={s.priceIqd - s.previousPriceIqd} />
                      <span>{fmtPrice(Math.abs(s.priceIqd - s.previousPriceIqd))} <span className={iqd}>{t('common:units.iqd')}</span></span>
                    </span>
                  ) : '—'}
                </td>
                <td className={td}><ChangeCell pct={s.changePercent} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};
