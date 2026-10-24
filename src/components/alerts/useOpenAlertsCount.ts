import { useMemo } from 'react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { usePermissions } from '../../lib/usePermission';
import { CHECK_SECTION_PERM } from '../../lib/checkSections';
import type { ReportAlert } from '../../lib/reportCheck';

/** عدد التنبيهات غير المطابقة التي لم تُراجَع بعد في الأقسام التي يراها الحساب (شارة القائمة الجانبية) */
export const useOpenAlertsCount = () => {
  const [alerts] = useSyncedStorage<ReportAlert[]>('sahara_report_alerts_v1', []);
  const { canView } = usePermissions();
  return useMemo(() => alerts.filter(a => a.status === 'mismatch' && !a.read && canView(CHECK_SECTION_PERM[a.section])).length, [alerts, canView]);
};
