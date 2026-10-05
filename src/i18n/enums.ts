import i18n from './index';

/**
 * ترجمة القيم الثابتة المخزّنة بالعربية في البيانات (أيام الأسبوع، الشركتان، أصناف الوقود، التصنيفات والحالات).
 * البيانات نفسها لا تتغيّر؛ تُترجم عند العرض فقط. أي قيمة غير معروفة (اسم محطة أو مورد أدخله المستخدم) تُعرض كما هي.
 */
const SLUG: Record<string, string> = {
  // أيام الأسبوع (بالإملاءين الشائعين للإثنين)
  'السبت': 'weekday.sat', 'الأحد': 'weekday.sun', 'الإثنين': 'weekday.mon', 'الاثنين': 'weekday.mon',
  'الثلاثاء': 'weekday.tue', 'الأربعاء': 'weekday.wed', 'الخميس': 'weekday.thu', 'الجمعة': 'weekday.fri',
  'اليوم': 'relative.today', 'الآن': 'relative.now',
  // غرفة المحادثة العامة التي ينشئها الخادم
  'غرفة العمليات العامة': 'room.general', 'القناة الرئيسية لكل فريق الموقع': 'room.generalDesc',
  SAT: 'weekday.sat', SUN: 'weekday.sun', MON: 'weekday.mon', TUE: 'weekday.tue', WED: 'weekday.wed', THU: 'weekday.thu', FRI: 'weekday.fri',
  // الشركات والمواقع الثابتة
  'صحاري كربلاء': 'company.sahara', 'شركة الاتحاد': 'company.etihad', 'شركة صحاري كربلاء': 'company.saharaCompany', 'المستودع الرئيسي': 'company.mainDepot',
  // مواقع تخزين النفط الأسود
  'موقع الريان': 'site.rayyan', 'موقع السكر': 'site.sukkar', 'موقع الصحاري': 'site.sahara',
  // أصناف بطاقات المشتريات
  'بنزين الصحاري': 'product.saharaGasoline', 'كاز الصحاري': 'product.saharaGasoil', 'كاز محطات': 'product.stationGasoil',
  'كاز الاتحاد': 'product.etihadGasoil', 'نفط الأسود': 'product.blackOil', 'نفط أسود': 'product.blackOil',
  'بنزين': 'product.gasoline', 'كاز': 'product.gasoil',
  'ديزل': 'product.diesel', 'كاز / ديزل': 'product.gasoilDiesel',
  // ألوان المنتج وحالات الشحنة والمجهز الافتراضي في كشف الوارد
  'احمر': 'color.red', 'اصفر': 'color.yellow', 'عسلي': 'color.honey', 'نفط ابيض': 'color.kerosene', 'أصفر مخضر': 'color.greenishYellow',
  'تم الاستلام': 'shipment.received', 'في الطريق': 'shipment.enRoute', 'قيد الفحص': 'shipment.inspection', 'ملغي': 'shipment.cancelled',
  'مصفى كربلاء الدولي': 'supplier.karbalaRefinery', 'مصفى كربلاء': 'supplier.karbalaRefineryShort',
  'ديزل ممتاز': 'product.premiumDiesel',
  // الصفحات المخفية: تصنيفات المهام وأولوياتها، حالة المناوبة، ومستوى الخزان
  'صيانة': 'task.maintenance', 'تفريغ': 'task.unloading', 'فحص جودة': 'task.quality', 'جرد': 'task.inventory',
  'عالية': 'priority.high', 'متوسطة': 'priority.medium', 'منخفضة': 'priority.low',
  'على رأس العمل': 'shift.onDuty', 'في استراحة': 'shift.onBreak', 'إجازة': 'shift.leave',
  'مستقر': 'level.stable', 'مرتفع': 'level.high', 'منخفض': 'level.low', 'حرج': 'level.critical',
  // تصنيفات الموردين وحالة التوفر
  'الكل': 'category.all', 'تجاري': 'category.commercial', 'رسمي': 'category.official', 'حكومي': 'category.government',
  'متوفر': 'availability.available', 'محدود': 'availability.limited', 'غير متوفر': 'availability.unavailable',
  // وسوم حركة اليوم في رسم البنزين
  'لا حركة': 'flowTag.none', 'فائض': 'flowTag.surplus', 'سحب من الرصيد': 'flowTag.draw', 'متوازن': 'flowTag.balanced',
};

/** أسماء المواقع والمحطات الثابتة؛ المفتاح بعد التطبيع (الهمزات والتاء المربوطة) لأن الملفات المستوردة تكتبها بأشكال مختلفة.
 * في العربية يُعرض الاسم كما كُتب في البيانات */
const STATION: Record<string, string> = {
  'الطاقه': 'station.taqa', 'التسمين': 'station.tasmeen', 'البياض': 'station.bayadh', 'البوادي': 'station.bawadi',
  'امهات البياض': 'station.umahatBayadh', 'امهات': 'station.umahat', 'الاجداد': 'station.ajdad', 'الاسفلت': 'station.asfalt',
  'مدينه الحجاج': 'station.hujjaj', 'مدينه الاحجاج': 'station.hujjaj', 'الطار': 'station.tar', 'الاستخلاص': 'station.istikhlas',
};
const normStation = (v: string) => v.trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

/** القيمة بلغة الواجهة؛ variant='short' لأسماء الأيام المختصرة في محاور الرسوم */
export const enumText = (value: string | undefined | null, variant?: 'short'): string => {
  if (!value) return '';
  const slug = SLUG[value.trim()];
  if (!slug) return siteName(value);
  const key = `common:enum.${slug}${variant === 'short' && slug.startsWith('weekday.') ? 'Short' : ''}`;
  return i18n.exists(key) ? i18n.t(key) : value;
};

/** أجزاء أسماء الخزانات والأقسام الشائعة (بعد التطبيع)؛ تُركّب منها الأسماء مثل «خزان صحاري 1» و«خزانات الكاز - شركة الاتحاد» */
const TERM: Record<string, string> = {
  'صحاري': 'term.sahara', 'صحاري كربلاء': 'term.saharaKarbala', 'شركه صحاري كربلاء': 'term.saharaCompany', 'شركه الصحاري': 'term.saharaCompany',
  'الاتحاد': 'term.etihad', 'شركه الاتحاد': 'term.etihadCompany', 'الكاز': 'term.gasoil', 'كاز': 'term.gasoil',
  'البنزين': 'term.gasoline', 'بنزين': 'term.gasoline', 'بانزين': 'term.gasoline', 'النفط الاسود': 'term.blackOil',
  'نفط الاسود': 'term.blackOil', 'نفط اسود': 'term.blackOil', 'الديزل': 'term.diesel', 'ديزل': 'term.diesel',
  'البفر': 'term.buffer', 'الوقود اليومي': 'term.dailyFuel', 'الربان': 'term.rubban', 'السكر': 'term.sukkar',
  'الريان': 'term.rayyan', 'الطاقه القديمه': 'term.oldTaqa', 'الطاقه الجديده': 'term.newTaqa', 'بيت الحاج ابو نور': 'term.baitHajj',
  'بيت الحاج': 'term.baitHajj', 'احتياط': 'term.reserve', 'احتياطي': 'term.reserve', 'الديزل الرئيسي': 'term.mainDiesel',
  'كاز الطوارئ': 'term.emergencyGasoil', 'الاتحاد الاستراتيجي': 'term.etihadStrategic', 'البنزين الاحتياطي': 'term.reserveGasoline', 'عمليات الاتحاد': 'term.etihadOps',
  'خزانات التشغيل اليومي': 'term.dailyOps', 'بفر وديزل': 'term.bufferDiesel', 'وحده الكاز والبنزين وخزانات بيت الحاج': 'term.gasPetrolHajj', 'خزانات كاز الاستخلاص والنقل': 'term.istikhlasTransport',
  'خزانات مواقع الشركه': 'term.companySites', 'قسم تشغيلي اضافي مخصص لمنظومه الخزانات': 'term.extraSection',
};

const lookup = (n: string): string | undefined => {
  const slug = STATION[n] ?? TERM[n];
  return slug && i18n.exists(`common:enum.${slug}`) ? i18n.t(`common:enum.${slug}`) : undefined;
};

/** يترجم اسمًا مركّبًا: «X - Y»، «خزان X 2»، «خزانات X»، «موقع X»؛ undefined إن وُجد جزء غير معروف */
const compose = (n: string): string | undefined => {
  const direct = lookup(n);
  if (direct) return direct;
  if (n.includes(' - ')) {
    const parts = n.split(' - ').map(p => compose(p.trim()));
    return parts.every(Boolean) ? parts.join(' – ') : undefined;
  }
  const m = n.match(/^(خزان|خزانات|موقع) (.+?)(?: ([A-Z]+-?\d+|\d+))?$/);
  if (!m) return undefined;
  const inner = compose(m[2]);
  if (!inner) return undefined;
  const tpl = m[1] === 'خزان' ? 'tankOf' : m[1] === 'خزانات' ? 'tanksOf' : 'siteOf';
  const text = i18n.t(`common:enum.${tpl}`, { name: inner });
  return m[3] ? `${text} ${m[3]}` : text;
};

/** اسم موقع أو خزان أو قسم بلغة الواجهة. في العربية يُعرض كما كُتب؛ وما لا يُعرف كاملًا يبقى كما هو */
export const siteName = (value: string | undefined | null): string => {
  if (!value) return '';
  if (i18n.language === 'ar') return value;
  return compose(normStation(value)) ?? value;
};
