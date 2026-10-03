import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { getSyncStatus, onSyncStatus, type SyncStatus } from '../../lib/cloudSync';

const LABELS: Record<SyncStatus, string> = {
  saved: 'محفوظ على الخادم',
  saving: 'جارٍ الحفظ...',
  offline: 'بلا اتصال: محفوظ في الجهاز وسيُرفع عند عودة الاتصال',
  error: 'تعذّر الحفظ على الخادم، ستُعاد المحاولة تلقائيًا',
};

/** مؤشر صغير لحالة الحفظ على الخادم */
export const SyncBadge: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setStatus), []);

  const Icon = status === 'saving' ? Loader2 : status === 'offline' ? CloudOff : status === 'error' ? AlertTriangle : Cloud;
  const color =
    status === 'saved' ? 'text-emerald-600' : status === 'saving' ? 'text-sky-600' : status === 'offline' ? 'text-amber-600' : 'text-red-600';

  return (
    <div
      title={LABELS[status]}
      className={`fixed bottom-3 left-3 z-[9999] print:hidden flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow px-3 py-1.5 text-xs font-bold ${color}`}
    >
      <Icon className={`w-3.5 h-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} />
      <span>{status === 'saved' ? 'محفوظ' : status === 'saving' ? 'جارٍ الحفظ' : status === 'offline' ? 'بلا اتصال' : 'خطأ في الحفظ'}</span>
    </div>
  );
};
