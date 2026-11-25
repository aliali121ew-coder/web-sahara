import { useMemo } from 'react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { usePermissions } from '../../lib/usePermission';
import { useSessionProfile } from '../../lib/session';
import { CHECK_SECTION_PERM } from '../../lib/checkSections';
import { threadAssignee, threadStatus, type ThreadMessage } from '../../lib/reportActivity';
import type { ReportAlert } from '../../lib/reportCheck';

/**
 * شارة القائمة الجانبية لسجل التنبيهات (في الأقسام التي يراها الحساب):
 * - مدير النظام: التقارير غير المطابقة التي لم تُراجَع، والردود بانتظار إغلاقه
 * - المستخدم: طلبات التصحيح المطلوبة منه
 */
export const useOpenAlertsCount = () => {
  const [alerts] = useSyncedStorage<ReportAlert[]>('sahara_report_alerts_v1', []);
  const [threads] = useSyncedStorage<ThreadMessage[]>('sahara_report_threads_v1', []);
  const { canView, canEdit, isAdmin } = usePermissions();
  const me = useSessionProfile()?.username || '';
  return useMemo(() => {
    // بلا صلاحية السجل لا شارة؛ وطلب التصحيح يُحسب فقط لمن يستطيع الرد عليه (تعديل)
    if (!canView('alerts')) return 0;
    const canReply = canEdit('alerts');
    const mine = alerts.filter(a => canView(CHECK_SECTION_PERM[a.section]));
    const byAlert = new Map<string, ThreadMessage[]>();
    for (const m of threads) byAlert.set(m.alertId, [...(byAlert.get(m.alertId) || []), m]);
    let count = 0;
    for (const a of mine) {
      const msgs = byAlert.get(a.id) || [];
      const st = threadStatus(msgs);
      if (isAdmin && ((st === 'none' && a.status === 'mismatch' && !a.read) || st === 'waiting_admin')) count++;
      else if (!isAdmin && canReply && st === 'waiting_user' && threadAssignee(msgs) === me) count++;
    }
    return count;
  }, [alerts, threads, canView, canEdit, isAdmin, me]);
};
