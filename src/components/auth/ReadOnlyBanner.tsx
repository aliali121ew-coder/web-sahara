import React from 'react';
import { Eye } from 'lucide-react';
import { useLevel } from '../../lib/usePermission';

/** شريط «وضع العرض فقط» أعلى القسم عندما تكون صلاحية الحساب عليه للعرض دون التعديل */
export const ReadOnlyBanner: React.FC<{ section: string }> = ({ section }) => {
  if (useLevel(section) !== 1) return null;
  return (
    <div role="status" className="no-print mb-2 flex items-center gap-2 rounded-2xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-4 py-2.5 text-xs sm:text-sm font-bold text-sky-800 dark:text-sky-200">
      <Eye className="w-4 h-4 shrink-0" />
      <span>وضع العرض فقط: صلاحيتك على هذا القسم للاطلاع، وأي تعديل لن يُحفظ على الخادم.</span>
    </div>
  );
};
