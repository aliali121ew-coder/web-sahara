import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import { useFuelData } from '../../context/FuelDataContext';

interface SubpageBackButtonProps {
  onClick?: () => void;
  title?: string;
  className?: string;
}

export const SubpageBackButton: React.FC<SubpageBackButtonProps> = ({ onClick, title, className = '' }) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation('nav');
  const { navigateBack } = useFuelData();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigateBack();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title || t('breadcrumb.backTitle')}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100/90 hover:bg-blue-50 dark:bg-slate-800/90 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/90 dark:border-slate-700/80 font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow cursor-pointer active:scale-95 shrink-0 group ${className}`}
    >
      <ArrowRight className={`w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform ${!isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`} />
      <span>{t('breadcrumb.back')}</span>
    </button>
  );
};

export default SubpageBackButton;
