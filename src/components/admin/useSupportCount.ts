import { useEffect, useState } from 'react';
import { chatApi } from '../chat/chatApi';
import { usePermissions } from '../../lib/usePermission';

const POLL_MS = 5 * 60_000;

/**
 * عدد طلبات الموظفين المفتوحة (حساب جديد / نسيت كلمة المرور) لمدير النظام فقط:
 * شارة على «الإعدادات» وبطاقة «إدارة المستخدمين». يُحدَّث كل 5 دقائق وعند العودة للتبويب.
 */
export function useSupportCount() {
  const { isAdmin } = usePermissions();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) { setCount(0); return; }
    let alive = true;
    // الطلبات المفتوحة + بصمات الأجهزة التي تنتظر الموافقة
    const load = () => Promise.all([
      chatApi.adminSupport().then(r => r.items.filter(x => x.status === 'open').length).catch(() => 0),
      chatApi.adminPasskeys().then(r => r.items.filter(x => !x.approved).length).catch(() => 0),
      chatApi.adminDevices().then(r => r.items.filter(x => !x.approved).length).catch(() => 0),
    ]).then(([a, b, c]) => { if (alive) setCount(a + b + c); });
    load();
    const id = setInterval(load, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [isAdmin]);
  return count;
}
