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

/**
 * مخطط مواقع الصحاري (إحداثيات خريطة تخطيطية، x يمين و y أمام): شارع رئيسي من الطاقة إلى الأمام،
 * أمامها التسمين ويقابله البياض، أمام البياض البوادي وأمام التسمين أمهات البياض، وأمام البوادي الأجداد.
 */
export const SITE_LAYOUT: Record<string, [number, number]> = {
  الطاقة: [14, -27],
  التسمين: [14, -9],
  البياض: [-14, -9],
  'امهات البياض': [14, 9],
  البوادي: [-14, 9],
  الاجداد: [-14, 27],
};
/** اتجاه (زاوية) الطريق من موقع إلى آخر على المخطط */
export const bearingTo = (from: string, to: string): number | undefined => {
  const a = SITE_LAYOUT[from], b = SITE_LAYOUT[to];
  return a && b ? Math.atan2(b[1] - a[1], b[0] - a[0]) : undefined;
};
