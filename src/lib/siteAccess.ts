import { FARM_SITES } from './siteFarmsTypes';

/**
 * مواقع الصحاري الستة وصلاحية كل موقع: حساب الموقع يدخل موقعه فقط (sahara.site.<key>)،
 * وصلاحية "الاحتياطي" (sahara.reserves) تفتح كل المواقع (للإدارة).
 * الطاقة مركز التوزيع: صفحتها حتى مركز المراقبة، وخريطتها تعرض المواقع لا المزارع.
 */
export const SITE_KEYS: Record<string, string> = {
  الطاقة: 'taqa',
  التسمين: 'tasmeen',
  البياض: 'bayadh',
  البوادي: 'bawadi',
  'امهات البياض': 'ummahat',
  الاجداد: 'ajdad',
};

/** ترتيب كروت المواقع: الطاقة أولًا (مركز التوزيع) */
export const HUB_SITES: readonly string[] = ['الطاقة', 'التسمين', 'البياض', 'البوادي', 'امهات البياض', 'الاجداد'];
export const DISTRIBUTION_SITE = 'الطاقة';

export const sitePerm = (site: string) => `sahara.site.${SITE_KEYS[site] ?? site}`;
export const SITE_PERMS = FARM_SITES.map(sitePerm);

type Can = (section: string) => boolean;
/** عرض الموقع: صلاحيته، أو الاحتياطي (كل المواقع) */
export const canViewSite = (canView: Can, site: string) => canView('sahara.reserves') || canView(sitePerm(site));
/** إجراءات الموقع (الطلب والموافقة والاستلام) */
export const canEditSite = (canEdit: Can, site: string) => canEdit('sahara.reserves') || canEdit(sitePerm(site));
/** هل يرى الحساب صفحة مزارع المواقع أصلًا */
export const canViewAnySite = (canView: Can) => canView('sahara.reserves') || SITE_PERMS.some(p => canView(p));
