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
      // سجل التنبيهات: «عرض» يفتح الصفحة (تنبيهات أقسام الحساب فقط)، «تعديل» يسمح بالرد على طلبات التصحيح
      { id: 'alerts', label: 'سجل التنبيهات' },
      // تقرير العربات: يُبنى من الواردات التي يملك الحساب صلاحية عليها
      { id: 'vehicles-report', label: 'تقرير العربات' },
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
      // زر "رفع متعدد" في صفحة الاتحاد (حفظ كل ملف يتطلب صلاحية تعديل قسمه)
      { id: 'etihad.bulk-upload', label: 'الرفع المتعدد' },
    ],
  },
  {
    id: 'sahara', label: 'شركة الصحاري', sections: [
      { id: 'sahara.balance', label: 'الرصيد' },
      { id: 'sahara.tanks', label: 'الخزانات' },
      { id: 'sahara.black-oil', label: 'النفط الأسود' },
      // صفحة «مزارع الموقع» عند الصحاري (كل المواقع الستة)
      { id: 'sahara.reserves', label: 'مزارع الموقع (كل المواقع)' },
      { id: 'sahara.petrol', label: 'البنزين' },
      { id: 'sahara.reports', label: 'التقارير' },
      // زر "رفع متعدد" في صفحة الصحاري (يعرض الزر فقط؛ حفظ كل ملف يتطلب صلاحية تعديل قسمه)
      { id: 'sahara.bulk-upload', label: 'الرفع المتعدد' },
      // حساب كل موقع من مواقع المزارع: يدخل موقعه فقط (الاحتياطي يفتح كل المواقع)
      { id: 'sahara.site.taqa', label: 'موقع الطاقة' },
      { id: 'sahara.site.tasmeen', label: 'موقع التسمين' },
      { id: 'sahara.site.bayadh', label: 'موقع البياض' },
      { id: 'sahara.site.bawadi', label: 'موقع البوادي' },
      { id: 'sahara.site.ummahat', label: 'موقع امهات البياض' },
      { id: 'sahara.site.ajdad', label: 'موقع الاجداد' },
    ],
  },
];

/** صلاحيات حسابات المواقع الستة (انظر src/lib/siteAccess.ts) */
const SITE_SECTIONS = ['sahara.site.taqa', 'sahara.site.tasmeen', 'sahara.site.bayadh', 'sahara.site.bawadi', 'sahara.site.ummahat', 'sahara.site.ajdad'];

export const ALL_SECTIONS = PERM_GROUPS.flatMap(g => g.sections.map(s => s.id));

/**
 * «صفحة واحدة فقط»: حساب لا يرى القائمة الجانبية ولا يتنقل بين الصفحات، ويفتح صفحته التي حدّدتها الإدارة فقط.
 * واجهة فقط (الصلاحيات الفعلية وحماية البيانات على الخادم كما هي)، ولا تُطبَّق على مدير النظام.
 */
export const SINGLE_PAGE_TABS = ['dashboard', 'tanks', 'prices', 'suppliers', 'deliveries-sahara', 'deliveries-etihad', 'finance-etihad', 'finance-sahara', 'chat', 'settings', 'alerts', 'vehicles-report'] as const;
export type SinglePageTab = (typeof SINGLE_PAGE_TABS)[number];
export const sanitizeSinglePage = (v: unknown): string =>
  typeof v === 'string' && (SINGLE_PAGE_TABS as readonly string[]).includes(v) ? v : '';
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

/** أقسام التحقق من التقارير (تطابق CHECK_SECTION_PERM في checkSections.ts) */
const CHECK_PERM_SECTIONS = ['sahara.balance', 'etihad.balance', 'sahara.petrol', 'sahara.black-oil', 'etihad.black-oil'];

/**
 * ترحيل مرة واحدة: يمنح صلاحيتي «سجل التنبيهات» و«تقرير العربات» لمن كان يفتحهما قبل أن تصبحا مستقلتين.
 * - alerts: تعديل لمن يعدّل أحد أقسام التحقق (كان يستطيع الرد)، وعرض لمن يراها فقط
 * - vehicles-report: عرض لمن يملك «التقارير»
 * لا يغيّر صلاحية موجودة، ويعيد نفس الكائن إن لم يتغيّر شيء.
 */
export const grantPagePerms = (perms: Perms): Perms => {
  const add: Perms = {};
  const check = Math.max(0, ...CHECK_PERM_SECTIONS.map(s => perms[s] || 0)) as Level;
  if (!perms.alerts && check) add.alerts = check;
  if (!perms['vehicles-report'] && perms.reports) add['vehicles-report'] = 1;
  return Object.keys(add).length ? { ...perms, ...add } : perms;
};

// ───── ربط مفاتيح البيانات بالأقسام ─────
const COMMON = 'common';
/**
 * read: من يقرأ. write: من يعدّل ويحذف بالكامل (بدونه = نفس أقسام القراءة، ما عدا COMMON التي لا تمنح كتابة إلا إن ذُكرت صراحة).
 * create: (للمجموعات) من يضيف عناصر جديدة فقط دون تعديل الموجود أو حذفه.
 * markRead: (للمجموعات) كل من يقرأ يستطيع تعليم عنصر موجود كمقروء (تغيير حقل read إلى true فقط).
 */
type Rule = { match: (k: string) => boolean; read: string[]; write?: string[]; create?: string[]; markRead?: boolean };

const eq = (...keys: string[]) => (k: string) => keys.includes(k);
const pre = (...prefixes: string[]) => (k: string) => prefixes.some(p => k.startsWith(p));

const TANK_READERS = ['tanks', 'etihad.tanks', 'sahara.tanks', 'etihad.reserves', 'sahara.reserves', 'dashboard'];

const KEY_RULES: Rule[] = [
  { match: pre('sahara_company_balance_'), read: ['sahara.balance', 'sahara.reports', 'dashboard'], write: ['sahara.balance'] },
  { match: eq('sahara_gas_avg_price_v1'), read: ['sahara.balance', 'dashboard'], write: ['sahara.balance'] },
  { match: pre('sahara_petrol_'), read: ['sahara.petrol', 'sahara.reports', 'tanks', 'dashboard'], write: ['sahara.petrol'] },
  // مزارع الموقع (الصحاري): بيانات معزولة عن بقية الصفحات
  { match: eq('sahara_site_farms_v1'), read: ['sahara.reserves', 'sahara.reports', ...SITE_SECTIONS], write: ['sahara.reserves'] },
  // الطلبات بين المواقع: كل حساب موقع يطلب ويوافق ويستلم (الواجهة تحصر كل حساب في موقعه)
  { match: eq('sahara_site_requests_v1'), read: ['sahara.reserves', 'sahara.reports', ...SITE_SECTIONS], write: ['sahara.reserves', ...SITE_SECTIONS] },
  // الواجهة الرئيسية تعرض "تفاصيل النفط الأسود" من هذين السجلين: يقرؤهما من يرى الرئيسية أيضًا
  // (بدونها لا يصل اليوم الجديد إلا لمن يملك صلاحية القسم، فتبقى الرئيسية عند الآخرين على مناسيب الخزانات)
  { match: pre('sahara_black_oil_'), read: ['sahara.black-oil', 'sahara.reports', 'dashboard'], write: ['sahara.black-oil'] },
  { match: pre('etihad_black_oil_'), read: ['etihad.black-oil', 'etihad.reports', 'dashboard'], write: ['etihad.black-oil'] },
  { match: eq('sahara_etihad_balance_records_v2', 'sahara_etihad_print_columns'), read: ['etihad.balance', 'etihad.reports', 'etihad.archive', 'dashboard'], write: ['etihad.balance'] },
  {
    match: k => k === 'sahara_tanks' || k.startsWith('sahara_tank_') || ['central_tank_daily_snapshots_v1', 'sahara_gasoil_section_key', 'etihad_gasoil_section_key', 'etihad_extraction_tank_id'].includes(k),
    read: TANK_READERS, write: ['tanks', 'etihad.tanks', 'sahara.tanks'],
  },
  { match: eq('sahara_inbound_deliveries', 'sahara_deliveries', 'sahara_inbound_visible_columns', 'sahara_print_visible_columns'), read: ['deliveries-sahara', 'dashboard', 'reports'], write: ['deliveries-sahara'] },
  { match: eq('etihad_inbound_deliveries'), read: ['deliveries-etihad', 'dashboard', 'reports'], write: ['deliveries-etihad'] },
  // فترة احتساب متوسط السعر لكل شركة (تُختار من صفحة الوارد، وتقرؤها الرئيسية)
  { match: eq('sahara_avg_price_period_v1'), read: ['deliveries-sahara', 'dashboard', 'reports'], write: ['deliveries-sahara'] },
  { match: eq('etihad_avg_price_period_v1'), read: ['deliveries-etihad', 'dashboard', 'reports'], write: ['deliveries-etihad'] },
  { match: eq('fuel_price_overrides_v1'), read: ['prices', 'dashboard'], write: ['prices'] },
  // كارت كاز محطات: المجهزون المختارون وقيمه، وسجله الخاص
  { match: eq('sahara_station_gas_v1', 'sahara_station_gas_log_v1', 'sahara_station_gas_log_reset_v1'), read: ['prices', 'dashboard'], write: ['prices'] },
  { match: eq('sahara_supplier_prices', 'sahara_dashboard_suppliers_v1', 'sahara_supplier_mock_removed', 'sahara_supplier_names_repaired', 'sahara_supplier_source_v2', 'sahara_supplier_color_yellow_v1', 'sahara_supplier_reset_v3', 'sahara_supplier_current_manual_v1'), read: ['prices', 'suppliers', 'dashboard'], write: ['prices', 'suppliers'] },
  // سجل الأسعار والمشتريات: كل من يعدّل الأسعار أو الموردين يضيف له
  { match: eq('sahara_price_log_v1'), read: ['prices', 'suppliers', 'dashboard'], write: ['prices', 'suppliers'] },
  { match: eq('sahara_tasks', 'sahara_supply_requests'), read: ['tasks', 'dashboard'], write: ['tasks'] },
  // تقرير العربات: كشوف تفويل الآليات المرفوعة (PDF) وسطورها
  { match: eq('sahara_vehicle_files_v1', 'sahara_vehicle_refills_v1', 'sahara_vehicle_routes_v1'), read: ['vehicles-report'], write: ['vehicles-report'] },
  { match: eq('sahara_fuel_metrics'), read: ['dashboard', 'reports'], write: ['dashboard'] },
  // سجل التنبيهات (التحقق من اتصال التقارير): يقرؤه من يرى أحد الأقسام الأربعة، ويضيف إليه من يحفظ يومًا فيها،
  // ويعلّم التنبيه كمراجَع كل من يقرأ؛ تعديله وحذفه لمدير النظام
  { match: eq('sahara_report_alerts_v1'), read: ['sahara.balance', 'etihad.balance', 'sahara.petrol', 'sahara.black-oil', 'etihad.black-oil'], write: [], create: ['sahara.balance', 'etihad.balance', 'sahara.petrol', 'sahara.black-oil', 'etihad.black-oil'], markRead: true },
  // نشاط المستخدمين على التقارير ومحادثات التصحيح: نفس من يرى سجل التنبيهات ويضيف إليه
  { match: eq('sahara_report_activity_v1', 'sahara_report_threads_v1'), read: ['sahara.balance', 'etihad.balance', 'sahara.petrol', 'sahara.black-oil', 'etihad.black-oil'], write: [], create: ['sahara.balance', 'etihad.balance', 'sahara.petrol', 'sahara.black-oil', 'etihad.black-oil'] },
  // الإشعارات: يقرؤها الجميع ويعلّمونها كمقروءة؛ ينشئها من يسجّل واردًا أو طلب تجهيز؛ تعديلها وحذفها لمدير النظام
  { match: eq('sahara_notifications'), read: [COMMON], write: [], create: ['deliveries-sahara', 'deliveries-etihad', 'tasks'], markRead: true },
  // رسائل التوجيه القديمة: قراءة للجميع، والكتابة لمدير النظام
  { match: eq('sahara_messages'), read: [COMMON], write: [] },
  // القوائم المرجعية المشتركة (الشركات، الموردون، الألوان، المحطات): يعدّلها من يدخل الواردات أو الأسعار أو الطلبات
  {
    match: eq('sahara_suppliers_list', 'sahara_companies_list', 'sahara_colors_list', 'sahara_stations_list', 'sahara_name_index_v1'),
    read: [COMMON], write: ['deliveries-sahara', 'deliveries-etihad', 'prices', 'suppliers', 'tasks'],
  },
  // تفضيلات العرض (التبويب المفتوح، رفض عرض البصمة): بلا أثر على البيانات، يكتبها أي حساب مفعّل
  {
    match: k => ['sahara_subtab', 'etihad_subtab', 'sahara_reports_tab', 'etihad_reports_tab', 'sahara_tanks_section', 'etihad_tanks_section'].includes(k)
      || k.startsWith('sahara_view_') || k.startsWith('sahara_bio_declined_'),
    read: [COMMON], write: [COMMON],
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
  'sahara_site_farms_v1',
  // التشغيل
  'sahara_tanks', 'sahara_fuel_metrics', 'sahara_supplier_prices', 'sahara_price_log_v1',
  'sahara_tasks', 'sahara_supply_requests', 'sahara_messages',
  // سجل التنبيهات: إضافة من عدة أجهزة دون أن يمسح أحدها الآخر
  'sahara_report_alerts_v1', 'sahara_report_activity_v1', 'sahara_report_threads_v1',
  // تقرير العربات: مئات السطور يوميًا
  'sahara_vehicle_files_v1', 'sahara_vehicle_refills_v1', 'sahara_vehicle_routes_v1',
] as const;
/** نسخة محلية من آخر قيمة وصلت من الخادم لكل مجموعة (لحساب الفرق) — لا تُزامَن أبدًا */
export const SHADOW_PREFIX = 'sahara_shadow:';

const ruleFor = (k: string) => KEY_RULES.find(r => r.match(k));

/**
 * بصمة قواعد القراءة والكتابة: تدخل في ETag حالة الخادم، فإذا تغيّرت القواعد (مثل إضافة "dashboard" لقراءة مفتاح)
 * تستلم الأجهزة المفتوحة النسخة الجديدة فورًا بدل رد 304 حتى يتغيّر شيء في البيانات
 */
export const KEY_RULES_SIGNATURE = KEY_RULES
  .map(r => [r.read, r.write ?? [], r.create ?? [], r.markRead ? 1 : 0].map(x => (Array.isArray(x) ? x.join(',') : x)).join('/'))
  .join(';');

const anyAtLeast = (perms: Perms, isAdmin: boolean, sections: string[], min: Level) =>
  sections.some(s => s === COMMON || levelOf(perms, isAdmin, s) >= min);

export const canReadKey = (perms: Perms, isAdmin: boolean, key: string) => {
  if (isServerForbiddenKey(key)) return false;
  if (isAdmin) return true;
  const r = ruleFor(key);
  return !!r && anyAtLeast(perms, false, r.read, 1);
};

/** صلاحية الكتابة الكاملة (إضافة وتعديل وحذف واستبدال) */
export const canWriteKey = (perms: Perms, isAdmin: boolean, key: string) => {
  if (isServerForbiddenKey(key)) return false;
  if (isAdmin) return true;
  const r = ruleFor(key);
  // أقسام القراءة العامة (COMMON) لا تمنح كتابة ضمنيًا: لا بد أن تُذكر في write صراحة
  return !!r && anyAtLeast(perms, false, r.write || r.read.filter(s => s !== COMMON), 2);
};

/** إضافة عناصر جديدة فقط إلى مجموعة (دون تعديل الموجود أو حذفه) */
export const canCreateItems = (perms: Perms, isAdmin: boolean, key: string) => {
  if (canWriteKey(perms, isAdmin, key)) return true;
  const r = ruleFor(key);
  return !!r?.create && anyAtLeast(perms, false, r.create, 2);
};

/** تعليم عناصر المجموعة كمقروءة (تغيير حقل read إلى true فقط) */
export const canMarkRead = (perms: Perms, isAdmin: boolean, key: string) =>
  !!ruleFor(key)?.markRead && canReadKey(perms, isAdmin, key);

/** هل يملك الحساب أي نوع من الكتابة على المفتاح (وإلا يُعامل كقراءة فقط في التطبيق) */
export const canWriteSome = (perms: Perms, isAdmin: boolean, key: string) =>
  canWriteKey(perms, isAdmin, key) || canCreateItems(perms, isAdmin, key) || canMarkRead(perms, isAdmin, key);

const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  PERM_GROUPS.flatMap(g => g.sections.map(s => [s.id, g.id === 'pages' ? s.label : `${g.label} ← ${s.label}`])),
);

/** اسم القسم المسؤول عن مفتاح بيانات (لسجل العمليات) */
export const keySectionLabel = (key: string) => {
  const r = ruleFor(key);
  // المفاتيح العامة (قوائم، إشعارات، تفضيلات) تبقى «بيانات عامة» ولا تُنسب لقسم
  const id = r && !r.read.includes(COMMON) && (r.write || r.read).find(x => x !== COMMON);
  return id ? SECTION_LABEL[id] : 'بيانات عامة';
};
