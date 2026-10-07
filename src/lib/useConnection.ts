import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatus, type SyncStatus } from './cloudSync';

/**
 * حالة اتصال هذا الجهاز بالمنظومة: متصل ما دام البرنامج مفتوحًا والإنترنت متاحًا والخادم يستجيب.
 * غير متصل عند انقطاع الإنترنت أو فشل الوصول للخادم (حتى تنجح المحاولة التالية).
 */
export function useConnection(): boolean {
  const [netOnline, setNetOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus);

  useEffect(() => {
    const up = () => setNetOnline(true);
    const down = () => setNetOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const off = onSyncStatus(setSync);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      off();
    };
  }, []);

  return netOnline && sync !== 'offline' && sync !== 'error';
}
