import { useTranslation } from 'react-i18next';
import { enumText } from '../../i18n/enums';
import React from 'react';
import { Users, Phone, MapPin, Clock } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';

export const SiteManagers: React.FC = () => {
  const { t } = useTranslation(['pages', 'common']);
  const { managers, searchQuery } = useFuelData();

  const filteredManagers = managers.filter(
    (m) =>
      m.name.includes(searchQuery) ||
      m.role.includes(searchQuery) ||
      m.department.includes(searchQuery) ||
      m.assignedZone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          <span>{t('pages:managers.title')}</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {t('pages:managers.subtitle')}
        </p>
      </div>

      {/* Grid of Site Managers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredManagers.map((mgr) => (
          <div
            key={mgr.id}
            className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-soft-card hover:shadow-soft-hover transition-all flex flex-col justify-between group"
          >
            <div>
              {/* Top Avatar & Status */}
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-md">
                  {mgr.name.charAt(0)}
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    mgr.status === 'على رأس العمل'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {enumText(mgr.status)}
                </span>
              </div>

              {/* Manager Name & Role */}
              <div className="mt-4">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {mgr.name}
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                  {mgr.role}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {mgr.department}
                </p>
              </div>

              {/* Details (Shift & Assigned Zone) */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{mgr.assignedZone}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>{t('pages:managers.shift', { value: mgr.shift })}</span>
                </div>
              </div>
            </div>

            {/* Phone Button */}
            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href={`tel:${mgr.phone}`}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-bold text-xs transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="font-mono">{mgr.phone}</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
