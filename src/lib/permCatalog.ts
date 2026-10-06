/**
 * كتالوج الصلاحيات: مشترك بين الخادم (worker) والتطبيق.
 * لكل حساب درجة على كل قسم: 0 = لا يوجد، 1 = عرض، 2 = عرض وتعديل. مدير النظام له تعديل على كل شيء.
 * الخادم يطبّقها على مفاتيح البيانات (KEY_RULES)، والتطبيق يستخدمها لإخفاء الصفحات والأزرار فقط.
 */

export type Level = 0 | 1 | 2;
export type Perms = Record<string, Level>;

export interface SectionDef { id: string; label: string }
export interface SectionGroup { id: string; label: string; sections: SectionDef[] }

export const PERM_GROUPS: SectionGroup[] = [
  {
    id: 'pages', label: 'الصفحات العامة', sections: [
      { id: 'dashboard', label: 'لوحة التحكم' },
      { id: 'tanks', label: 'الخزانات' },
      { id: 'prices', label: 'الأسعار' },
      { id: 'suppliers', label: 'الموردين' },
      { id: 'deliveries-sahara', label: 'واردات الصحاري' },
      { id: 'deliveries-etihad', label: 'واردات الاتحاد' },
      { id: 'managers', label: 'مدراء المواقع' },
      { id: 'tasks', label: 'المهام والطلبات' },
      { id: 'reports', label: 'التقارير' },
      { id: 'chat', label: 'المحادثة' },
      { id: 'settings', label: 'الإعدادات' },
      { id: 'appearance', label: 'ضبط المظهر والخلفية' },
    ],
  },
  {
    id: 'etihad', label: 'شركة الاتحاد', sections: [
      { id: 'etihad.balance', label: 'الرصيد' },
      { id: 'etihad.tanks', label: 'الخزانات' },
      { id: 'etihad.black-oil', label: 'النفط الأسود' },
      { id: 'etihad.reserves', label: 'الاحتياطي' },
      { id: 'etihad.reports', label: 'التقارير' },
      { id: 'etihad.archive', label: 'الأرشيف' },
    ],
  },
  {
    id: 'sahara', label: 'شركة الصحاري', sections: [
      { id: 'sahara.balance', label: 'الرصيد' },
      { id: 'sahara.tanks', label: 'الخزانات' },
      { id: 'sahara.black-oil', label: 'النفط الأسود' },
      { id: 'sahara.reserves', label: 'الاحتياطي' },
      { id: 'sahara.petrol', label: 'البنزين' },
      { id: 'sahara.reports', label: 'التقارير' },
    ],
  },
];

export const ALL_SECTIONS = PERM_GROUPS.flatMap(g => g.sections.map(s => s.id));
const SECTION_SET = new Set(ALL_SECTIONS);

/** تنظيف صلاحيات قادمة من العميل: أقسام معروفة فقط ودرجات 0..2 */
export const sanitizePerms = (raw: unknown): Perms => {
  const out: Perms = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (SECTION_SET.has(k) && (v === 1 || v === 2)) out[k] = v;
  }
  return out;
};

export const parsePerms = (s: string | null | undefined): Perms => {
  try { return sanitizePerms(JSON.parse(s || '{}')); } catch { return {}; }
};

export const levelOf = (perms: Perms, isAdmin: boolean, section: string): Level =>
  isAdmin ? 2 : (perms[section] || 0);

/** هل يملك أي قسم داخل مجموعة (لإظهار صفحة الشركة) */
export const groupLevel = (perms: Perms, isAdmin: boolean, groupId: string): Level => {
  const g = PERM_GROUPS.find(x => x.id === groupId);
  return (g ? Math.max(0, ...g.sections.map(s => levelOf(perms, isAdmin, s.id))) : 0) as Level;
};

// ───── ربط مفاتيح البيانات بالأقسام ─────
const COMMON = 'common';
type Rule = { match: (k: string) => boolean; read: string[]; write?: string[] };

const eq = (...keys: string[]) => (k: string) => keys.includes(k);
const pre = (...prefixes: string[]) => (k: string) => prefixes.some(p => k.startsWith(p));

const TANK_READERS = ['tanks', 'etihad.tanks', 'sahara.tanks', 'etihad.reserves', 'sahara.reserves', 'dashboard'];

const KEY_RULES: Rule[] = [
  { match: pre('sahara_company_balance_'), read: ['sahara.balance', 'sahara.reports', 'dashboard'], write: ['sahara.balance'] },
  { match: eq('sahara_gas_avg_price_v1'), read: ['sahara.balance', 'dashboard'], write: ['sahara.balance'] },
  { match: pre('sahara_petrol_'), read: ['sahara.petrol', 'sahara.reports', 'tanks', 'dashboard'], write: ['sahara.petrol'] },
  { match: pre('sahara_black_oil_'), read: ['sahara.black-oil', 'sahara.reports'], write: ['sahara.black-oil'] },
  { match: pre('etihad_black_oil_'), read: ['etihad.black-oil', 'etihad.reports'], write: ['etihad.black-oil'] },
  { match: eq('sahara_etihad_balance_records_v2', 'sahara_etihad_print_columns'), read: ['etihad.balance', 'etihad.reports', 'etihad.archive', 'dashboard'], write: ['etihad.balance'] },
  {
    match: k => k === 'sahara_tanks' || k.startsWith('sahara_tank_') || ['central_tank_daily_snapshots_v1', 'sahara_gasoil_section_key', 'etihad_gasoil_section_key', 'etihad_extraction_tank_id'].includes(k),
    read: TANK_READERS, write: ['tanks', 'etihad.tanks', 'sahara.tanks'],
  },
  { match: eq('sahara_inbound_deliveries', 'sahara_deliveries', 'sahara_inbound_visible_columns', 'sahara_print_visible_columns'), read: ['deliveries-sahara', 'dashboard', 'reports'], write: ['deliveries-sahara'] },
  { match: eq('etihad_inbound_deliveries'), read: ['deliveries-etihad', 'dashboard', 'reports'], write: ['deliveries-etihad'] },
  { match: eq('fuel_price_overrides_v1'), read: ['prices', 'dashboard'], write: ['prices'] },
  { match: eq('sahara_supplier_prices', 'sahara_supplier_mock_removed', 'sahara_supplier_names_repaired', 'sahara_supplier_source_v2', 'sahara_supplier_color_yellow_v1'), read: ['prices', 'suppliers', 'dashboard'], write: ['prices', 'suppliers'] },
  // سجل الأسعار والمشتريات: كل من يعدّل الأسعار أو الموردين يضيف له
  { match: eq('sahara_price_log_v1'), read: ['prices', 'suppliers', 'dashboard'], write: ['prices', 'suppliers'] },
  { match: eq('sahara_tasks', 'sahara_supply_requests'), read: ['tasks', 'dashboard'], write: ['tasks'] },
  { match: eq('sahara_fuel_metrics'), read: ['dashboard', 'reports'], write: ['dashboard'] },
  // قوائم مرجعية وإشعارات وتفضيلات عرض: لكل حساب مفعّل
  {
    match: k => ['sahara_notifications', 'sahara_messages', 'sahara_suppliers_list', 'sahara_companies_list', 'sahara_colors_list', 'sahara_stations_list',
      'sahara_subtab', 'etihad_subtab', 'sahara_reports_tab', 'etihad_reports_tab', 'sahara_tanks_section', 'etihad_tanks_section'].includes(k)
      || k.startsWith('sahara_view_') || k.startsWith('sahara_bio_declined_'),
    read: [COMMON],
  },
];

/** مفاتيح لا تُخزَّن على الخادم أبدًا (أسرار الجلسة وإعدادات الجهاز) */
export const isServerForbiddenKey = (k: string) =>
  k.startsWith('sahara_chat_') || k.startsWith('sahara_session_') || k.startsWith('sahara_cloud_')
  || k.endsWith('_token') || k.includes('supabase') || k === 'sahara_bio_cred' || k === 'sahara_last_username' || k === 'sahara_last_name' || k === 'sahara_bio_user'
  || k.startsWith(SHADOW_PREFIX);

/**
 * مجموعات كبيرة تُخزَّن سطرًا لكل عنصر على الخادم (جدول collection_items) بدل نص JSON واحد،
 * ويرسل التطبيق الفرق فقط عند الحفظ. كل عنصر يُعرَّف بحقل id.
 */
export const COLLECTION_KEYS = [
  // الواردات والإشعارات
  'sahara_inbound_deliveries', 'etihad_inbound_deliveries', 'sahara_notifications',
  // الدفاتر والأرصدة المالية: تعديلان متزامنان على قيدين مختلفين يُحفظان معًا بدل أن يمسح أحدهما الآخر
  'sahara_company_balance_ledger_v1', 'sahara_company_balance_published_v1',
  'sahara_petrol_ledger_v1', 'sahara_petrol_published_v1',
  'sahara_black_oil_daily_ledger_v1', 'etihad_black_oil_daily_ledger_v1',
  'sahara_etihad_balance_records_v2',
  // التشغيل
  'sahara_tanks', 'sahara_fuel_metrics', 'sahara_supplier_prices', 'sahara_price_log_v1',
  'sahara_tasks', 'sahara_supply_requests', 'sahara_messages',
] as const;
/** نسخة محلية من آخر قيمة وصلت من الخادم لكل مجموعة (لحساب الفرق) — لا تُزامَن أبدًا */
export const SHADOW_PREFIX = 'sahara_shadow:';

const ruleFor = (k: string) => KEY_RULES.find(r => r.match(k));

const anyAtLeast = (perms: Perms, isAdmin: boolean, sections: string[], min: Level) =>
  sections.some(s => s === COMMON || levelOf(perms, isAdmin, s) >= min);

export const canReadKey = (perms: Perms, isAdmin: boolean, key: string) => {
  if (isServerForbiddenKey(key)) return false;
  if (isAdmin) return true;
  const r = ruleFor(key);
  return !!r && anyAtLeast(perms, false, r.read, 1);
};

export const canWriteKey = (perms: Perms, isAdmin: boolean, key: string) => {
  if (isServerForbiddenKey(key)) return false;
  if (isAdmin) return true;
  const r = ruleFor(key);
  return !!r && anyAtLeast(perms, false, r.write || r.read, 2);
};

const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  PERM_GROUPS.flatMap(g => g.sections.map(s => [s.id, g.id === 'pages' ? s.label : `${g.label} ← ${s.label}`])),
);

/** اسم القسم المسؤول عن مفتاح بيانات (لسجل العمليات) */
export const keySectionLabel = (key: string) => {
  const r = ruleFor(key);
  const id = r && (r.write || r.read).find(x => x !== COMMON);
  return id ? SECTION_LABEL[id] : 'بيانات عامة';
};
