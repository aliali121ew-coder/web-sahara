import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSyncStatus, onSyncStatus, type SyncStatus } from '../../lib/cloudSync';

/** مؤشر صغير لحالة الحفظ على الخادم */
export const SyncBadge: React.FC = () => {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setStatus), []);

  const Icon = status === 'saving' ? Loader2 : status === 'offline' ? CloudOff : status === 'error' ? AlertTriangle : Cloud;
  const color =
    status === 'saved' ? 'text-emerald-600' : status === 'saving' ? 'text-sky-600' : status === 'offline' ? 'text-amber-600' : 'text-red-600';

  return (
    <div
      title={t(`sync.${status}Hint`)}
      role="status"
      aria-live="polite"
      className={`fixed bottom-3 end-3 z-[9999] print:hidden flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow px-3 py-1.5 text-xs font-bold ${color}`}
    >
      <Icon className={`w-3.5 h-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} />
      <span>{t(`sync.${status}`)}</span>
    </div>
  );
};
