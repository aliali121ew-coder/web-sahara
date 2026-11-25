/* eslint-disable i18next/no-literal-string */
import React from 'react';
import { ChevronLeft, Truck } from 'lucide-react';

export interface Crumb { label: React.ReactNode; onClick?: () => void }

/** مسار الصفحات في تقرير العربات: كل عنصر قبل الأخير رابط يعيد لصفحته، والأخير الصفحة الحالية */
export const VehicleCrumbs: React.FC<{ items: Crumb[] }> = ({ items }) => (
  <nav aria-label="مسار الصفحات" className="font-cairo">
    <ol className="flex flex-wrap items-center gap-1 text-xs font-bold">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <li key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronLeft className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" aria-hidden />}
            {last || !c.onClick ? (
              <span aria-current={last ? 'page' : undefined} className={`flex items-center gap-1.5 px-2 py-1 truncate ${last ? 'text-slate-900 dark:text-white font-black' : 'text-slate-500 dark:text-slate-400'}`}>
                {i === 0 && <Truck className="w-3.5 h-3.5 text-sky-600 shrink-0" />}{c.label}
              </span>
            ) : (
              <button type="button" onClick={c.onClick} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer truncate transition-colors">
                {i === 0 && <Truck className="w-3.5 h-3.5 text-sky-600 shrink-0" />}{c.label}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
