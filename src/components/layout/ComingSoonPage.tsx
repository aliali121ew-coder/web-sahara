import React from 'react';
import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** صفحة قسم متوقف مؤقتًا (قيد التطوير) */
export const ComingSoonPage: React.FC<{ title: string }> = ({ title }) => {
  const { t } = useTranslation('common');
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-soft-card min-h-[360px] flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
        <Hourglass className="w-6 h-6" />
      </div>
      <div className="text-lg font-black text-slate-900 dark:text-white">{title}</div>
      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold border border-amber-200 dark:border-amber-800/60">
        {t('comingSoon.badge')}
      </span>
      <div className="text-sm text-slate-500 dark:text-slate-400">{t('comingSoon.body')}</div>
    </div>
  );
};

export default ComingSoonPage;
