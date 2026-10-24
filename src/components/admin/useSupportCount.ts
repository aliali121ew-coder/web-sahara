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
    const load = () => chatApi.adminSupport()
      .then(r => { if (alive) setCount(r.items.filter(x => x.status === 'open').length); })
      .catch(() => { /* الشارة اختيارية */ });
    load();
    const id = setInterval(load, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [isAdmin]);
  return count;
}
