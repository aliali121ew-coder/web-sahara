import React from 'react';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import { useFuelData } from '../../context/FuelDataContext';

export interface BreadcrumbItem {
  /** Visible label for this step in the path */
  label: string;
  /** Click handler — omit (or leave undefined) for the current/active page (last item) */
  onClick?: () => void;
}

interface BreadcrumbProps {
  /** Path items after "الرئيسية" (Home). The last item is treated as the current page. */
  items: BreadcrumbItem[];
  /** Optional handler for the Home crumb; defaults to navigating to the main dashboard */
  onHomeClick?: () => void;
  className?: string;
}

/**
 * Professional enterprise-style breadcrumb trail.
 * الرئيسية  ›  شركة الاتحاد  ›  نفط أسود
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onHomeClick, className = '' }) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation('nav');
  const { setActiveTab } = useFuelData();
  const Separator = isRTL ? ChevronLeft : ChevronRight;

  const handleHome = () => {
    if (onHomeClick) {
      onHomeClick();
    } else {
      setActiveTab('dashboard');
    }
  };

  return (
    <nav
      aria-label={t('breadcrumb.label')}
      className={`flex items-center gap-1 flex-wrap text-[11px] sm:text-xs font-bold select-none leading-none ${className}`}
    >
      <button
        type="button"
        onClick={handleHome}
        className="flex items-center gap-1 px-1.5 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title={t('breadcrumb.home')}
      >
        <Home className="w-3 h-3" />
        <span className="hidden sm:inline">{t('breadcrumb.home')}</span>
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            <Separator className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0" />
            {isLast || !item.onClick ? (
              <span
                className="px-1.5 py-1 rounded-md text-slate-900 dark:text-white font-black"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="px-1.5 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
