import React from 'react';

/**
 * عنوان موحّد لأقسام الرئيسية: أيقونة القسم والعنوان، ثم خط رفيع يمتد لنهاية العرض ويتلاشى؛
 * الخط يعمل فاصلًا بين الأقسام دون عنصر إضافي.
 */
export const SectionHeader: React.FC<{ icon: React.ReactNode; title: React.ReactNode }> = ({ icon, title }) => (
  <div className="flex items-center gap-2.5">
    {icon}
    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white whitespace-nowrap">{title}</h2>
    <span aria-hidden className="flex-1 ms-2 h-px bg-gradient-to-l ltr:bg-gradient-to-r from-slate-300 via-slate-300/70 to-transparent dark:from-slate-600 dark:via-slate-700/70" />
  </div>
);
