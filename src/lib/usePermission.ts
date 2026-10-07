import { useCallback, useMemo } from 'react';
import { groupLevel, levelOf, type Level } from './permCatalog';
import { useSessionProfile } from './session';

/**
 * صلاحيات الحساب الحالي في التطبيق (لإخفاء الصفحات والأزرار فقط).
 * الحماية الفعلية على الخادم: البيانات غير المسموحة لا تصل أصلًا، والتعديل غير المسموح يُرفض.
 */
export function usePermissions() {
  const profile = useSessionProfile();
  const isAdmin = !!profile?.is_admin;
  // ثبات المراجع مهم: الدوال تُستخدم في اعتماديات useMemo/useEffect، ولو تغيّرت مع كل رسم تحدث حلقة رسم لا تنتهي
  const permsKey = JSON.stringify(profile?.perms || {});
  const perms = useMemo(() => JSON.parse(permsKey) as Record<string, Level>, [permsKey]);
  const level = useCallback((section: string): Level => levelOf(perms, isAdmin, section), [perms, isAdmin]);
  const group = useCallback((groupId: string): Level => groupLevel(perms, isAdmin, groupId), [perms, isAdmin]);
  const canView = useCallback((section: string) => level(section) >= 1, [level]);
  const canEdit = useCallback((section: string) => level(section) >= 2, [level]);
  return useMemo(() => ({ isAdmin, level, group, canView, canEdit }), [isAdmin, level, group, canView, canEdit]);
}

/** درجة صلاحية قسم واحد */
export const useLevel = (section: string) => usePermissions().level(section);

/** قسم الصلاحية المقابل لكل صفحة في القائمة الجانبية (finance-* تتبع مجموعة الشركة) */
export const TAB_SECTION: Record<string, { section?: string; group?: string }> = {
  dashboard: { section: 'dashboard' },
  tanks: { section: 'tanks' },
  prices: { section: 'prices' },
  suppliers: { section: 'suppliers' },
  deliveries: { group: 'deliveries' },
  'deliveries-sahara': { section: 'deliveries-sahara' },
  'deliveries-etihad': { section: 'deliveries-etihad' },
  finance: { group: 'etihad' },
  'finance-etihad': { group: 'etihad' },
  'finance-sahara': { group: 'sahara' },
  managers: { section: 'managers' },
  tasks: { section: 'tasks' },
  reports: { section: 'reports' },
  chat: { section: 'chat' },
  settings: { section: 'settings' },
};

/** هل يستطيع الحساب فتح هذه الصفحة؟ */
export const useCanOpenTab = () => {
  const p = usePermissions();
  return useCallback((tab: string) => {
    const t = TAB_SECTION[tab];
    if (!t) return p.isAdmin;
    if (t.group === 'deliveries') return p.canView('deliveries-sahara') || p.canView('deliveries-etihad');
    return t.group ? p.group(t.group) >= 1 : p.canView(t.section!);
  }, [p]);
};
