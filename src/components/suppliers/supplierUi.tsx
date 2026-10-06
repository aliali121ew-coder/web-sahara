import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../lib/utils';
import type { SupplierPriceRecord } from '../../types';

/** عناصر مشتركة بين صفحة الموردين وصفحة المورد */
export const fmtPrice = (v: number) => formatNumber(Math.round(v * 100) / 100);

export type Company = 'sahara' | 'etihad';
/** شارة الشركة المستلمة (أرشيف الوارد الذي ورد إليه المورد) */
export const CompanyBadges: React.FC<{ companies: Company[] }> = ({ companies }) => {
  const { t } = useTranslation('suppliers');
  if (!companies.length) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {companies.map(c => (
        <span key={c} className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${c === 'sahara' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'}`}>
          {t(`receiver.${c}`)}
        </span>
      ))}
    </span>
  );
};

const AVATAR_TONES = ['from-teal-400 to-emerald-600', 'from-sky-400 to-blue-600', 'from-amber-400 to-orange-600', 'from-violet-400 to-purple-600', 'from-rose-400 to-pink-600', 'from-lime-400 to-green-600'];
export const toneOf = (id: string) => AVATAR_TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
export const initialsOf = (name: string) => {
  const words = name.replace(/[()]/g, '').split(/\s+/).filter(w => w && !['شركة', 'شركه', '-', 'و'].includes(w));
  // حرف واحد: الحروف العربية المنفصلة بمسافة تبدو مشوّهة داخل الدائرة
  return (words[0] ?? '').replace(/^ال(?=..)/, '').charAt(0) || '?';
};

export const Avatar: React.FC<{ s: Pick<SupplierPriceRecord, 'id' | 'supplierName' | 'logo'>; size: string; text: string }> = ({ s, size, text }) =>
  s.logo ? (
    <img src={s.logo} alt="" className={`${size} rounded-full object-cover shrink-0 bg-white`} />
  ) : (
    <span className={`${size} ${text} rounded-full shrink-0 bg-gradient-to-br ${toneOf(s.id)} text-white font-black flex items-center justify-center select-none`}>
      {initialsOf(s.supplierName)}
    </span>
  );

