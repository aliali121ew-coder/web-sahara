import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * عنوان موحّد لأقسام الرئيسية: أيقونة القسم والعنوان، ثم خط رفيع يمتد لنهاية العرض ويتلاشى؛
 * الخط يعمل فاصلًا بين الأقسام دون عنصر إضافي. updatedAt: تاريخ آخر يوم مسجّل تُبنى منه أرقام القسم
 * (مصدر الرقم ووقته يعطيان الثقة في الأنظمة المؤسساتية).
 */
export const SectionHeader: React.FC<{ icon: React.ReactNode; title: React.ReactNode; updatedAt?: string }> = ({ icon, title, updatedAt }) => {
  const { t } = useTranslation('dashboard');
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <h2 className="min-w-0 text-base sm:text-lg font-black text-slate-900 dark:text-white sm:whitespace-nowrap">{title}</h2>
      <span aria-hidden className="flex-1 ms-2 h-px bg-gradient-to-l ltr:bg-gradient-to-r from-slate-200 via-slate-200/80 to-transparent dark:from-slate-700 dark:via-slate-800/80" />
      {updatedAt && (
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {t('sectionUpdated')} <span className="font-mono text-slate-700 dark:text-slate-200" dir="ltr">{updatedAt}</span>
        </span>
      )}
    </div>
  );
};
