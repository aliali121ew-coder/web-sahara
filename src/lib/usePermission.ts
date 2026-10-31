import { useCallback, useMemo } from 'react';
import { groupLevel, levelOf, type Level } from './permCatalog';
import { useSessionProfile } from './session';
import { CHECK_SECTION_PERM } from './checkSections';

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
  // «صفحة واحدة فقط»: لا تُطبَّق على مدير النظام
  const singlePage = !isAdmin ? profile?.single_page || '' : '';
  return useMemo(() => ({ isAdmin, level, group, canView, canEdit, singlePage }), [isAdmin, level, group, canView, canEdit, singlePage]);
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
  // سجل التنبيهات: صلاحيته الخاصة + أحد الأقسام الأربعة (كاز الصحاري، كاز الاتحاد، البنزين، النفط الأسود)
  alerts: { section: 'alerts' },
  // تقرير العربات: صلاحيته الخاصة (البيانات حسب صلاحية الواردات)
  'vehicles-report': { section: 'vehicles-report' },
  // الملف الشخصي لكل حساب بلا صلاحية (آخر القائمة: صفحة البداية لحساب بلا أقسام)
  profile: {},
};

/** هل يستطيع الحساب فتح هذه الصفحة؟ */
export const useCanOpenTab = () => {
  const p = usePermissions();
  return useCallback((tab: string) => {
    // حساب مقيَّد بصفحة واحدة: لا يفتح غيرها (الباقي يتبع الصلاحيات كالمعتاد)
    if (p.singlePage && tab !== p.singlePage) return false;
    if (tab === 'profile') return true;
    // بلا أي قسم تحقق تكون الصفحة فارغة، فلا تُفتح
    if (tab === 'alerts') return p.canView('alerts') && Object.values(CHECK_SECTION_PERM).some(s => p.canView(s));
    const t = TAB_SECTION[tab];
    if (!t) return p.isAdmin;
    if (t.group === 'deliveries') return p.canView('deliveries-sahara') || p.canView('deliveries-etihad');
    return t.group ? p.group(t.group) >= 1 : p.canView(t.section!);
  }, [p]);
};
