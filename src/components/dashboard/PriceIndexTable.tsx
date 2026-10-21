import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, BadgeDollarSign } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useTranslation } from 'react-i18next';
import { Avatar, CompanyBadges, fmtPrice } from '../suppliers/supplierUi';
import { SectionHeader } from './SectionHeader';
import { sameSupplier } from '../../lib/archiveSuppliers';
import { isOnDashboard, useDashboardSuppliers } from '../../lib/dashboardSuppliers';

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
 * مؤشرات الأسعار في الرئيسية (كل الموردين بلا تكرار): نفس أعمدة جدول «كل الموردين» (بلا الشركة المستلمة وآخر تحديث والإجراء)،
 * ومصدرها سجلات الأسعار نفسها (الموردون الذين لهم سعر حالي يدوي)؛ للعرض فقط (الصفوف لا تنقل لأي صفحة).
 */
export const PriceIndexTable: React.FC = () => {
  const { supplierPrices, searchQuery } = useFuelData();
  const { t } = useTranslation(['dashboard', 'common']);
  // الموردون المعلَّمون بعلامة صح في صفحة الموردين فقط
  const shown = useDashboardSuppliers();
  // من سجل الموردين: كل مورد معلَّم يظهر، والسعر الحالي يدوي («—» حتى يُكتب)، والسابق سعر آخر وارد له في الأرشيف.
  // أي تعديل يدوي أو وارد جديد يظهر فورًا. من له سعر حالي أولًا، ثم الأحدث تعديلًا
  const rows = useMemo(() => {
    const day = (d: string) => (d || '').replace(/-/g, '/');
    const list = supplierPrices
      .filter(rec => isOnDashboard(shown, rec.supplierName, rec.company))
      .filter(rec => rec.supplierName.includes(searchQuery) || (rec.product || '').includes(searchQuery))
      .sort((a, b) => Number(b.priceIqd > 0) - Number(a.priceIqd > 0) || day(b.lastUpdated).localeCompare(day(a.lastUpdated)))
      .map(rec => {
        const previous = rec.previousPriceIqd || 0;
        const diff = previous && rec.priceIqd ? rec.priceIqd - previous : 0;
        return {
          id: rec.id, company: rec.company ?? 'sahara', supplierName: rec.supplierName, logo: rec.logo, product: rec.product,
          density: rec.density, color: rec.color, price: rec.priceIqd, previousPrice: previous || null, diff,
          pct: previous ? Math.round((diff / previous) * 10000) / 100 : 0, hasPrice: rec.priceIqd > 0,
        };
      });
    // علامة كل شركة مستقلة: المورد المعلَّم في الصحاري والاتحاد يظهر بصف لكل شركة (بشارتها)، ولا يتكرر في الشركة نفسها
    const seen: typeof list = [];
    for (const item of list) if (!seen.some(x => x.company === item.company && sameSupplier(x.supplierName, item.supplierName))) seen.push(item);
    return seen;
  }, [supplierPrices, searchQuery, shown]);

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
    {/* الهاتف: كارت أم بداخله كارت مستطيل لكل مجهز (شعار الشركة، الاسم، الكثافة، السعر السابق والحالي، التغيّر) */}
    <div className="sm:hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card p-2.5 space-y-2">
      {rows.length === 0 && (
        <div className="py-8 text-center text-sm text-slate-400">{t(shown.length ? 'dashboard:priceIndex.empty' : 'dashboard:priceIndex.noneSelected')}</div>
      )}
      {rows.map(s => {
        const up = s.hasPrice && s.pct > 0, down = s.hasPrice && s.pct < 0;
        const chip = !s.hasPrice ? 'bg-slate-100 text-slate-400 dark:bg-slate-800'
          : up ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
          : down ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300';
        return (
          <div key={s.id} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar s={s} size="w-8 h-8" text="text-xs" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-black text-slate-900 dark:text-white truncate">{s.supplierName}</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {t('dashboard:priceIndex.density')}: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{s.density || '—'}</span>
                </div>
              </div>
              <img src={s.company === 'etihad' ? '/logos/etihad.png' : '/logos/sahara.png'} alt={t(`common:enum.company.${s.company}`)} className="h-7 w-auto max-w-[44px] object-contain shrink-0" />
              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-black ${chip}`} dir="ltr">
                {!s.hasPrice ? '—' : <>{up ? <TrendingUp className="w-3.5 h-3.5" /> : down ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}{up ? '+' : ''}{s.pct}%</>}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5">
                <div className="text-[10.5px] font-bold text-slate-400">{t('dashboard:priceIndex.previous')}</div>
                <div className="font-mono font-bold text-[14px] text-slate-600 dark:text-slate-300 tabular-nums">{s.previousPrice === null ? '—' : <>{fmtPrice(s.previousPrice)} <span className={iqd}>{t('common:units.iqd')}</span></>}</div>
              </div>
              <div className={`rounded-xl px-2.5 py-1.5 ${s.hasPrice ? 'bg-blue-50 dark:bg-blue-950/40' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
                <div className={`text-[10.5px] font-bold ${s.hasPrice ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400'}`}>{t('dashboard:priceIndex.current')}</div>
                <div className={`font-mono font-black text-[14px] tabular-nums ${s.hasPrice ? 'text-blue-800 dark:text-blue-200' : 'text-slate-400'}`}>{s.hasPrice ? <>{fmtPrice(s.price)} <span className={iqd}>{t('common:units.iqd')}</span></> : '—'}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    <div className="hidden sm:block rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden">
      <div className="overflow-x-auto px-3 sm:px-4 pb-4 bg-slate-50/70 dark:bg-slate-950/30">
        <table className="w-full border-separate border-spacing-y-1.5">
          <thead>
            <tr>
              <th className={th}>{t('dashboard:priceIndex.supplier')}</th>
              <th className={th}>{t('dashboard:priceIndex.current')}</th>
              <th className={th}>{t('dashboard:priceIndex.density')}</th>
              <th className={th}>{t('dashboard:priceIndex.previous')}</th>
              <th className={th}>{t('dashboard:priceIndex.diff')}</th>
              <th className={th}>{t('dashboard:priceIndex.change')}</th>
              <th className={th}>{t('dashboard:priceIndex.color')}</th>
              <th className={th}>{t('dashboard:priceIndex.product')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">{t(shown.length ? 'dashboard:priceIndex.empty' : 'dashboard:priceIndex.noneSelected')}</td></tr>
            )}
            {rows.map(s => (
              <tr key={s.id}>
                <td className={`${td} ${plain} !text-start`}>
                  <div className="flex items-center gap-2.5">
                    <Avatar s={s} size="w-8 h-8" text="text-xs" />
                    <span className="text-[14.5px] font-bold text-slate-900 dark:text-white truncate max-w-[200px] xl:max-w-[260px]">{s.supplierName}</span>
                    <CompanyBadges companies={[s.company]} />
                  </div>
                </td>
                <td className={`${td} font-extrabold text-slate-900 dark:text-white tabular-nums`}>{s.hasPrice ? <>{fmtPrice(s.price)} <span className={iqd}>{t('common:units.iqd')}</span></> : '—'}</td>
                <td className={`${td} ${plain} tabular-nums`}>{s.density || '—'}</td>
                <td className={`${td} tabular-nums font-normal text-slate-700 dark:text-slate-300`}>
                  {s.previousPrice === null ? '—' : <>{fmtPrice(s.previousPrice)} <span className={iqd}>{t('common:units.iqd')}</span></>}
                </td>
                <td className={`${td} tabular-nums font-bold ${toneText(s.diff)}`}>
                  {s.diff ? (
                    <span className="inline-flex items-center gap-1.5">
                      <DirBox v={s.diff} />
                      <span>{fmtPrice(Math.abs(s.diff))} <span className={iqd}>{t('common:units.iqd')}</span></span>
                    </span>
                  ) : '—'}
                </td>
                <td className={td}>{s.hasPrice ? <ChangeCell pct={s.pct} /> : '—'}</td>
                <td className={`${td} ${plain}`}><span className="block truncate max-w-[120px] mx-auto">{s.color || '—'}</span></td>
                <td className={`${td} ${plain}`}><span className="block truncate max-w-[160px] mx-auto">{s.product || '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};
