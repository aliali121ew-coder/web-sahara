import React from 'react';
import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** صفحة مزارع الموقع للصحاري (قيد البرمجة) */
export const SaharaSiteFarmsView: React.FC = () => {
  const { t } = useTranslation(['finance', 'common']);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-soft-card min-h-[360px] flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
        <Hourglass className="w-6 h-6" />
      </div>
      <div className="text-lg font-black text-slate-900 dark:text-white">{t('finance:siteFarms.title')}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{t('finance:siteFarms.comingSoon')}</div>
    </div>
  );
};

export default SaharaSiteFarmsView;
