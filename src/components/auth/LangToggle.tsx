import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** تبديل العربية/الإنجليزية في شاشات الدخول (قبل وجود الهيدر) */
export const LangToggle: React.FC<{ onColor?: boolean }> = ({ onColor }) => {
  const { t, i18n } = useTranslation('common');
  const next = i18n.language === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(next)}
      aria-label={t('language.select')}
      title={t('language.select')}
      lang={next}
      className={`auth-focus h-11 px-3 rounded-xl inline-flex items-center gap-1.5 text-sm font-bold transition ${
        onColor
          ? 'text-white bg-white/10 ring-1 ring-white/20 hover:bg-white/20'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
      }`}
    >
      <Globe className="w-4 h-4" aria-hidden />
      {next === 'en' ? 'English' : 'العربية'}
    </button>
  );
};
