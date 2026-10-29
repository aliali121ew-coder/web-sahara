import { normalizeArabic, readPdfPages, type PdfItem } from './saharaReportFile';
import { getProfile } from './session';

/**
 * تقرير العربات: كشوف «مطابقة الكاز» اليومية (PDF) لآليات الموقع.
 *
 * شكل الكشف (من اليمين): ت | اسم المادة | و.القياس | التاريخ | الكمية السابقة | السائق السابق | المصنع السابق
 *   | عدد الأيام | التاريخ | الكمية | العربة | السائق | تشغيلي/انشائي
 * - الكمية والتاريخ والسائق = التفويلة الحالية، وأعمدة «السابق» = آخر تفويلة قبلها (قد تكون من موقع آخر)
 * - رأس الكشف: «المصنع: <الموقع>» و«من <تاريخ> الى <تاريخ>»
 * - العربة قد تتكرر في نفس اليوم (تفويل من أكثر من موقع/مرة): تُجمع كتفويلة واحدة لذلك التاريخ
 */

export interface VehicleRefill {
  id: string;
  fileId: string;
  /** الموقع الذي صدر عنه الكشف (المصنع) */
  site: string;
  vehicle: string;
  driver: string;
  qty: number;
  /** YYYY/MM/DD */
  date: string;
  /** عدد الأيام منذ التفويلة السابقة (كما في الكشف) */
  days: number | null;
  prevSite: string;
  prevDriver: string;
  prevQty: number | null;
  prevDate: string;
  kind: string;
  /** رقم السيارة (اللوحة) إن وُجد في المستند */
  plate?: string;
}

export interface VehicleFile {
  id: string;
  name: string;
  /** وقت الرفع (ISO) */
  uploadedAt: string;
  by: string;
  site: string;
  /** تاريخ الكشف (آخر تاريخ تفويل فيه) */
  reportDate: string;
  rows: number;
  totalQty: number;
  /** رقم المستند (مستند تجهيز زيت الغاز) */
  docNo?: string;
  /** من أين أُخذ تاريخ التفويل: حقل الملاحظات أو تاريخ الملف */
  dateSource?: 'notes' | 'file';
}

export const VEHICLE_FILES_KEY = 'sahara_vehicle_files_v1';
export const VEHICLE_REFILLS_KEY = 'sahara_vehicle_refills_v1';

// ───── قراءة الكشف ─────

const DATE_RE = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$|^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;

/** تاريخ بصيغة YYYY/MM/DD أو null */
export const toIsoDate = (s: string): string | null => {
  const m = DATE_RE.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[5], m[4]];
  return `${y}/${mo.padStart(2, '0')}/${d.padStart(2, '0')}`;
};

const num = (s: string): number | null => {
  const t = s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,،٬\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

/** نص عربي مقروء (الملف يخزّن أشكال العرض للحروف) */
const clean = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim();

type Col =
  | 'driver' | 'vehicle' | 'qty' | 'date' | 'days' | 'prevSite' | 'prevDriver' | 'prevQty' | 'prevDate'
  | 'kind' | 'shift' | 'plate' | 'store' | 'tech';

// عناوين الأعمدة في كل أنواع الكشوف (الأطول أولًا حتى لا يطابق «السائق» عنوان «السائق السابق»).
// أعمدة لا تُستخدم (الشفت، المخزن، الفني) تُعرَّف حتى لا تُنسب نصوصها لعمود مجاور
const HEADERS: [Col, string][] = [
  ['prevSite', 'المصنع السابق'],
  ['prevDriver', 'السائق السابق'],
  ['prevQty', 'الكمية السابقة'],
  ['days', 'عدد الايام'],
  ['kind', 'تشغيلي/انشائي'],
  ['kind', 'الغرض'],
  ['shift', 'الشفت'],
  ['driver', 'اسم السائق'],
  ['driver', 'السائق'],
  ['plate', 'رقم السيارة'],
  ['store', 'المخزن'],
  ['tech', 'الفني'],
  ['vehicle', 'العربة'],
  ['qty', 'الكمية'],
];

const center = (i: PdfItem) => i.x + i.w / 2;

/**
 * مواضع الأعمدة من سطر العناوين. الأولوية: الكمية والعربة (إلزاميتان)،
 * وبعدها ما وُجد من عدد الأيام والسائق والتاريخ وأعمدة «السابق» (التاريخان: الأيسر للحالي والأيمن للسابق).
 */
const readHeader = (line: PdfItem[]): Map<Col, number> | null => {
  const cols = new Map<Col, number>();
  const used = new Set<PdfItem>();
  for (const [col, label] of HEADERS) {
    if (cols.has(col)) continue;
    const key = normalizeArabic(label);
    const hit = line.find(i => !used.has(i) && normalizeArabic(i.str) === key);
    if (hit) { cols.set(col, center(hit)); used.add(hit); }
  }
  const dates = line.filter(i => normalizeArabic(i.str) === normalizeArabic('التاريخ')).sort((a, b) => a.x - b.x);
  if (dates.length >= 2) { cols.set('date', center(dates[0])); cols.set('prevDate', center(dates[dates.length - 1])); }
  else if (dates.length === 1) cols.set('date', center(dates[0]));
  return cols.has('vehicle') && cols.has('qty') ? cols : null;
};

export interface VehicleSheet {
  site: string;
  rows: Omit<VehicleRefill, 'id' | 'fileId' | 'site'>[];
  total: number | null;
  docNo: string;
  dateSource: 'notes' | 'file';
}

/** أول تاريخ داخل نص (قد يأتي مع كلام في حقل الملاحظات) */
const DATE_ANY = /(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/;
const dateInText = (s: string) => {
  const m = DATE_ANY.exec(s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  return m ? toIsoDate(m[1]) : null;
};


/** كل عنصر في السطر يُنسب لأقرب عمود */
const assign = <C extends string>(line: PdfItem[], cols: Map<C, number>) => {
  const cells = new Map<C, string[]>();
  const entries = [...cols.entries()];
  for (const it of line) {
    const c = center(it);
    const [col] = entries.reduce((best, e) => (Math.abs(e[1] - c) < Math.abs(best[1] - c) ? e : best));
    cells.set(col, [...(cells.get(col) || []), it.str]);
  }
  return cells;
};

/**
 * يقرأ سطور الملف (صفحات → أسطر → عناصر) — منفصلة عن PDF لتُختبر.
 * يدعم «كشف مطابقة الكاز» و«كشف تجهيز الكاز» و«مستند تجهيز زيت الغاز» بنفس القاعدة.
 * التاريخ: تاريخ حقل «الملاحظات» أولًا (البيانات تُدخل أحيانًا في غير يومها)، وإلا تاريخ الملف/السطر.
 */
export const parseVehicleSheet = (pages: PdfItem[][][], fallbackDate = ''): VehicleSheet => {
  let site = '';
  let total: number | null = null;
  let docNo = '';
  let notesDate: string | null = null;
  let docDate: string | null = null;
  const rows: VehicleSheet['rows'] = [];
  const isLabel = (i: PdfItem, l: string) => normalizeArabic(i.str) === normalizeArabic(l);

  for (const lines of pages) {
    let cols: Map<Col, number> | null = null;
    for (const line of lines) {
      const text = normalizeArabic(line.map(i => i.str).join(' '));
      if (!site && line.some(i => isLabel(i, 'المصنع'))) {
        // «المصنع» عنوان في أقصى اليمين، واسم الموقع النص الذي يليه يسارًا
        const label = line.find(i => isLabel(i, 'المصنع'))!;
        const name = line.filter(i => i.x < label.x && num(i.str) === null && !toIsoDate(i.str) && !isLabel(i, 'من') && i.str.trim())
          .sort((a, b) => b.x - a.x)[0];
        if (name) site = clean(name.str).replace(/^\)(.*)$/, '$1').replace(/\)([^()]+)$/, '($1)');
      }
      // حقل الملاحظات: تاريخ فيه يتقدّم على تاريخ الملف
      if (notesDate === null && line.some(i => isLabel(i, 'الملاحظات') || isLabel(i, 'ملاحظات'))) {
        notesDate = line.map(i => dateInText(i.str)).find(Boolean) || null;
      }
      if (!docNo && line.some(i => isLabel(i, 'رقم المستند'))) {
        const label = line.find(i => isLabel(i, 'رقم المستند'))!;
        const n = line.filter(i => i.x < label.x && /^\d+$/.test(i.str.trim())).sort((a, b) => b.x - a.x)[0];
        if (n) docNo = n.str.trim();
      }
      if (!docDate && !cols && line.some(i => isLabel(i, 'تاريخ'))) {
        docDate = line.map(i => toIsoDate(i.str)).find(Boolean) || null;
      }

      const header = readHeader(line);
      if (header) { cols = header; continue; }
      if (!cols) continue;
      if (text.includes(normalizeArabic('المجموع'))) {
        const n = line.map(i => num(i.str)).filter((v): v is number => v !== null);
        if (n.length) total = Math.max(...n);
        continue;
      }

      const cells = assign(line, cols);
      const get = (c: Col) => clean((cells.get(c) || []).join(' '));
      // خلية التاريخ قد تلتصق بها وحدة القياس المجاورة («لتر»)
      const dateIn = (c: Col) => (cells.get(c) || []).map(toIsoDate).find(Boolean) || '';
      // وكذلك الأرقام: قد تلتصق بها «لتر» أو اسم المادة من عمود مجاور ليس له عنوان مقروء
      const numIn = (c: Col) => (cells.get(c) || []).map(num).find((v): v is number => v !== null) ?? null;
      // أولًا: الكمية والعربة — بدونهما السطر ليس تفويلة
      const qty = numIn('qty');
      const vehicle = get('vehicle').replace(/\s+/g, '');
      if (qty === null || !vehicle) continue;
      const plate = get('plate').replace(/\s+/g, '');
      rows.push({
        vehicle,
        qty,
        // بعدها: عدد الأيام والسائق والتاريخ إن وُجدت (التاريخ يُكمَل من الملاحظات/الملف أدناه)
        days: numIn('days'),
        driver: get('driver'),
        date: dateIn('date'),
        prevSite: get('prevSite'),
        prevDriver: get('prevDriver'),
        prevQty: numIn('prevQty'),
        prevDate: dateIn('prevDate'),
        kind: get('kind'),
        ...(plate ? { plate } : {}),
      });
    }
  }
  // تاريخ الملاحظات أولًا، ثم تاريخ السطر أو المستند، وأخيرًا التاريخ الذي اختاره الرافع
  for (const r of rows) r.date = notesDate || r.date || docDate || fallbackDate;
  const kept = rows.filter(r => r.date);
  return { site, rows: kept, total, docNo, dateSource: notesDate ? 'notes' : 'file' };
};

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** يقرأ ملف PDF ويحوّله إلى ملف + تفويلات جاهزة للحفظ */
export const readVehicleFile = async (file: File, fallbackDate = ''): Promise<{ file: VehicleFile; refills: VehicleRefill[]; total: number | null }> => {
  const { pages, anyText } = await readPdfPages(file);
  if (!anyText) throw new Error('الملف لا يحتوي نصًا قابلًا للقراءة (صورة ممسوحة)');
  const sheet = parseVehicleSheet(pages, fallbackDate);
  if (!sheet.rows.length) throw new Error('لم يُعثر على جدول تفويل العربات في الملف');
  const site = sheet.site || 'غير محدد';
  const reportDate = sheet.rows.reduce((m, r) => (r.date > m ? r.date : m), '');
  // معرّف الملف: المستند برقمه، والكشف بموقعه وتاريخه — رفع نفس الملف مرة ثانية يستبدل الأول
  const fileId = `vf-${hash(sheet.docNo ? `${site}|doc|${sheet.docNo}` : `${site}|${reportDate}`)}`;
  const p = getProfile();
  const refills = sheet.rows.map((r, i) => ({ ...r, site, fileId, id: `${fileId}-${i}` }));
  return {
    file: {
      id: fileId,
      name: file.name,
      uploadedAt: new Date().toISOString(),
      by: p?.name || p?.username || '',
      site,
      reportDate,
      rows: refills.length,
      totalQty: refills.reduce((s, r) => s + r.qty, 0),
      ...(sheet.docNo ? { docNo: sheet.docNo } : {}),
      dateSource: sheet.dateSource,
    },
    refills,
    total: sheet.total,
  };
};

// ───── التحليل ─────

/** تفويلات العربة في يوم واحد مجمّعة (عدة مواقع/مرات = تفويلة واحدة) */
export interface DayFill {
  vehicle: string;
  date: string;
  qty: number;
  /** عدد السطور التي جُمعت */
  parts: number;
  sites: string[];
  drivers: string[];
  /** أقل عدد أيام عن التفويلة السابقة (0 = تكرار في نفس اليوم) */
  days: number | null;
  prevQty: number | null;
  prevDate: string;
  prevSite: string;
  prevDriver: string;
}

/** حد «التفويل المتكرر»: تفويلتان خلال يوم واحد أو أقل */
export const FREQUENT_DAYS = 1;

/** عدد الأيام بين تاريخين YYYY/MM/DD */
export const daysBetween = (a: string, b: string) => {
  const t = (d: string) => { const [y, m, dd] = d.split('/').map(Number); return Date.UTC(y, m - 1, dd); };
  return Math.round((t(b) - t(a)) / 86400000);
};

export const groupDayFills = (refills: VehicleRefill[]): DayFill[] => {
  const map = new Map<string, VehicleRefill[]>();
  for (const r of refills) {
    const k = `${r.vehicle}|${r.date}`;
    const l = map.get(k);
    if (l) l.push(r); else map.set(k, [r]);
  }
  const fills = [...map.values()].map(list => {
    // السطر المرجعي للتفويلة السابقة = الأقدم تاريخًا سابقًا (الذي يشير لما قبل هذا اليوم)
    const outside = list.filter(r => r.prevDate && r.prevDate < r.date).sort((a, b) => a.prevDate.localeCompare(b.prevDate))[0] || list[0];
    const days = list.reduce<number | null>((m, r) => (r.days === null ? m : m === null ? r.days : Math.min(m, r.days)), null);
    return {
      vehicle: list[0].vehicle,
      date: list[0].date,
      qty: list.reduce((s, r) => s + r.qty, 0),
      parts: list.length,
      sites: [...new Set(list.map(r => r.site))],
      drivers: [...new Set(list.map(r => r.driver).filter(Boolean))],
      days: list.length > 1 ? 0 : days,
      prevQty: outside.prevQty,
      prevDate: outside.prevDate,
      prevSite: outside.prevSite,
      prevDriver: outside.prevDriver,
    };
  });
  // سطور بلا «عدد الأيام/السابق» (مستند تجهيز): تُكمَل من تفويلة العربة السابقة في البيانات
  const byVehicle = new Map<string, DayFill[]>();
  for (const f of fills) {
    const l = byVehicle.get(f.vehicle);
    if (l) l.push(f); else byVehicle.set(f.vehicle, [f]);
  }
  for (const list of byVehicle.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    for (let k = 1; k < list.length; k++) {
      const f = list[k];
      const prev = list[k - 1];
      if (f.days === null) f.days = daysBetween(prev.date, f.date);
      if (!f.prevDate) {
        f.prevDate = prev.date;
        f.prevQty = prev.qty;
        f.prevSite = prev.sites.join('، ');
        f.prevDriver = prev.drivers.join('، ');
      }
    }
  }
  return fills;
};

export interface VehicleStat {
  vehicle: string;
  fills: DayFill[];
  total: number;
  count: number;
  avg: number;
  max: number;
  last: DayFill;
  /** عدد مرات التفويل خلال FREQUENT_DAYS */
  frequent: number;
  /** متوسط الأيام بين التفويلات */
  avgGap: number | null;
  drivers: string[];
}

export const vehicleStats = (fills: DayFill[]): VehicleStat[] => {
  const by = new Map<string, DayFill[]>();
  for (const f of fills) {
    const l = by.get(f.vehicle);
    if (l) l.push(f); else by.set(f.vehicle, [f]);
  }
  return [...by.entries()].map(([vehicle, list]) => {
    list.sort((a, b) => b.date.localeCompare(a.date));
    const total = list.reduce((s, f) => s + f.qty, 0);
    const gaps = list.map(f => f.days).filter((d): d is number => d !== null);
    return {
      vehicle,
      fills: list,
      total,
      count: list.length,
      avg: Math.round(total / list.length),
      max: Math.max(...list.map(f => f.qty)),
      last: list[0],
      frequent: list.filter(f => f.days !== null && f.days <= FREQUENT_DAYS).length,
      avgGap: gaps.length ? Math.round((gaps.reduce((s, d) => s + d, 0) / gaps.length) * 10) / 10 : null,
      drivers: [...new Set(list.flatMap(f => f.drivers))],
    };
  });
};

/** «اليوم السابق» لتاريخ معيّن من بين التواريخ المتوفرة */
export const previousDate = (dates: string[], date: string) => dates.filter(d => d < date).sort().pop() || null;

/** MM/DD للعرض المختصر */
export const formatDay = (d: string) => (d ? d.slice(5) : '—');

// ───── مسارات العربات على الخريطة ─────

export interface MapPoint { lat: number; lng: number; name: string }

/** رحلة تُضاف يدويًا: العربة والمسافة، ومن/إلى اختياريان (بدونهما لا يُرسم خط) */
export interface VehicleRoute {
  id: string;
  vehicle: string;
  km: number;
  /** YYYY/MM/DD */
  date: string;
  from: MapPoint | null;
  to: MapPoint | null;
  note: string;
  by: string;
  createdAt: string;
}

export const VEHICLE_ROUTES_KEY = 'sahara_vehicle_routes_v1';

/** المسافة المستقيمة بين نقطتين (كم) — للمقارنة مع المسافة المسجّلة */
export const straightKm = (a: MapPoint, b: MapPoint) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
};

// ───── ملف العربة (يُدخل يدويًا) والتدقيق عليه ─────

export const VEHICLE_TYPES = ['شاحنة', 'تريلة', 'بيكب', 'صالون', 'شفل', 'حفارة', 'كرين', 'رافعة شوكية', 'مولدة', 'حوضية', 'أخرى'] as const;

export interface VehicleProfile {
  /** = رقم العربة */
  id: string;
  /** اسم وصفي للعربة يظهر بجانب رمزها (الرمز نفسه لا يتغير لأنه يربطها بسطور الملفات) */
  name?: string;
  type: string;
  /** سعة الخزان (لتر): تفويلة أكبر منها مستحيلة */
  tankLiters: number | null;
  /** سعة الخزان الثاني (لتر) — خزان وحدة التبريد في بعض البرادات */
  tank2Liters?: number | null;
  /** المعدل المرجعي للقيادة (لتر لكل 100 كم) — لمختبر العربة */
  refL100?: number | null;
  /** صرف وحدة التبريد (لتر لكل ساعة) — لمختبر العربة */
  reeferLph?: number | null;
  /** الحصة اليومية المسموحة (لتر) */
  dailyLimit: number | null;
  /** السائق المعتمد للعربة */
  driver: string;
  department: string;
  notes: string;
  /** صورة مصغّرة (data URL) */
  photo: string;
  updatedAt: string;
  by: string;
}

export const VEHICLE_PROFILES_KEY = 'sahara_vehicle_profiles_v1';
/** أسماء مخصصة لفئات العربات (مفتاح الفئة → الاسم)، يعدّلها مدير النظام */
export const VEHICLE_CATEGORY_NAMES_KEY = 'sahara_vehicle_category_names_v1';

export type CheckKind = 'capacity' | 'limit' | 'driver' | 'frequent' | 'multi';
export interface FillCheck { kind: CheckKind; date: string; text: string }

/** مخالفات كل تفويلة مقابل ملف العربة */
export const checkFills = (fills: DayFill[], profile: VehicleProfile | undefined): FillCheck[] => {
  const out: FillCheck[] = [];
  const norm = (s: string) => normalizeArabic(s);
  for (const f of fills) {
    if (profile?.tankLiters && f.qty > profile.tankLiters) out.push({ kind: 'capacity', date: f.date, text: `${f.qty.toLocaleString()} لتر أكبر من سعة الخزان ${profile.tankLiters.toLocaleString()}` });
    if (profile?.dailyLimit && f.qty > profile.dailyLimit) out.push({ kind: 'limit', date: f.date, text: `تجاوز الحصة اليومية بـ ${(f.qty - profile.dailyLimit).toLocaleString()} لتر` });
    if (profile?.driver && f.drivers.length && !f.drivers.some(d => norm(d) === norm(profile.driver))) out.push({ kind: 'driver', date: f.date, text: `فوّلها ${f.drivers.join('، ')} وليس السائق المعتمد` });
    if (f.days !== null && f.days <= FREQUENT_DAYS) out.push({ kind: 'frequent', date: f.date, text: `تفويل بعد ${f.days} يوم من السابقة` });
    if (f.parts > 1) out.push({ kind: 'multi', date: f.date, text: `${f.parts} تفويلات في نفس اليوم (${f.sites.join('، ')})` });
  }
  return out;
};

/** وزن كل نوع مخالفة في مؤشر الانضباط */
const PENALTY: Record<CheckKind, number> = { capacity: 30, limit: 15, driver: 8, frequent: 12, multi: 10 };

/**
 * مؤشر الانضباط 0–100: يبدأ من 100 ويُخصم لكل مخالفة (نسبةً لعدد التفويلات)،
 * ولزيادة متوسط التفويلة عن متوسط الأسطول.
 */
export const disciplineScore = (stat: VehicleStat, checks: FillCheck[], fleetAvg: number) => {
  const factors: { label: string; points: number }[] = [];
  const kinds: CheckKind[] = ['capacity', 'limit', 'driver', 'frequent', 'multi'];
  const labels: Record<CheckKind, string> = { capacity: 'تجاوز سعة الخزان', limit: 'تجاوز الحصة اليومية', driver: 'سائق غير معتمد', frequent: 'تفويل متكرر', multi: 'أكثر من تفويلة باليوم' };
  for (const k of kinds) {
    const n = checks.filter(c => c.kind === k).length;
    if (n) factors.push({ label: labels[k], points: Math.round(PENALTY[k] * Math.min(3, n) * Math.max(0.5, n / stat.count)) });
  }
  if (fleetAvg && stat.avg > fleetAvg * 1.25) factors.push({ label: 'أعلى من متوسط الأسطول', points: Math.min(20, Math.round(((stat.avg / fleetAvg) - 1) * 10)) });
  const score = Math.max(0, 100 - factors.reduce((s, f) => s + f.points, 0));
  return { score, factors, grade: score >= 85 ? 'ممتاز' : score >= 70 ? 'جيد' : score >= 50 ? 'يحتاج متابعة' : 'مخالف' };
};

/** تصغير الصورة قبل حفظها مع ملف العربة (عرض 640 بكسل، JPEG) */
export const shrinkImage = (file: File, max = 640): Promise<string> => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); reject(new Error('تعذّرت معالجة الصورة')); return; }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    resolve(c.toDataURL('image/jpeg', 0.8));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('الملف ليس صورة صالحة')); };
  img.src = url;
});

// ───── فئة العربة من رمزها ─────

export interface VehicleCategory { key: string; label: string; image: string; door: [number, number]; tilt: number }

/** door: موضع باب العربة في الصورة (نسبة من العرض والارتفاع) لطباعة رقمها عليه، tilt: ميل جانب العربة (درجة) ليتبع الرقم زاوية الباب */
const CATEGORY: Record<string, { label: string; image: string; door: [number, number]; tilt: number }> = {
  HEAD: { label: 'رأس قاطرة', image: 'head', door: [0.44, 0.45], tilt: 4 },
  HF: { label: 'باص', image: 'hf', door: [0.58, 0.56], tilt: -8 },
  K: { label: 'خباطة', image: 'k', door: [0.37, 0.46], tilt: -6 },
  BS: { label: 'براد صغير', image: 'bs', door: [0.45, 0.56], tilt: -6 },
  A: { label: 'إطفاء', image: 'a', door: [0.42, 0.56], tilt: -6 },
  SF: { label: 'شفل صغير', image: 'sf', door: [0.52, 0.6], tilt: -8 },
  SF1: { label: 'شفل كبير', image: 'sf1', door: [0.7, 0.42], tilt: -5 },
  SL: { label: 'براد قاطرة', image: 'sl', door: [0.37, 0.5], tilt: -5 },
  AT: { label: 'براد', image: 'at', door: [0.41, 0.56], tilt: -5 },
  M: { label: 'كناسة', image: 'm', door: [0.42, 0.48], tilt: -5 },
  L: { label: 'قلاب', image: 'l', door: [0.37, 0.45], tilt: -5 },
  KS: { label: 'ضاغطة نفايات', image: 'ks', door: [0.38, 0.46], tilt: -5 },
  KA: { label: 'ساحبة زراعية', image: 'ka', door: [0.38, 0.4], tilt: 0 },
  HW: { label: 'حوضية ماء', image: 'hw', door: [0.44, 0.5], tilt: -6 },
  KH: { label: 'بيكب حمل', image: 'kh', door: [0.39, 0.523], tilt: -3 },
  KN: { label: 'كرين', image: 'kn', door: [0.3, 0.56], tilt: -5 },
  R: { label: 'رافعة شوكية', image: 'r', door: [0.75, 0.6], tilt: 0 },
  SR: { label: 'سحب مجاري', image: 'sr', door: [0.36, 0.42], tilt: -5 },
  HR: { label: 'حفارة', image: 'hr', door: [0.25, 0.6], tilt: 0 },
  KB: { label: 'براد كيا', image: 'kb', door: [0.6, 0.5], tilt: 0 },
};

/** المساحة الشفافة تحت العجلات في صورة كل فئة (نسبة من ارتفاع الصورة)، لإنزال العربة حتى تقف على الأرض */
const IMAGE_GROUND: Record<string, number> = {
  a: 0.062, at: 0.048, bs: 0.082, head: 0.077, hf: 0.141, hr: 0.042, hw: 0.113, k: 0.048, ka: 0.238, kb: 0.026,
  kh: 0.138, kn: 0.08, ks: 0.058, l: 0.044, m: 0.062, r: 0.062, sf: 0.046, sf1: 0.06, sl: 0.056, sr: 0.068,
};
export const imageGround = (url: string) => IMAGE_GROUND[/\/types\/([\w-]+)\.webp$/.exec(url)?.[1] || ''] || 0;

/** الاسم الافتراضي لفئة من مفتاحها (لمسار الصفحات) */
export const categoryLabel = (key: string) => CATEGORY[key]?.label || '';

/** أرقام الشفلات الكبيرة (SF + رقم): الشفل الكبير والصغير لكل منهما تسلسله */
export const BIG_SF_NUMBERS = new Set<number>();

/**
 * الفئة من رمز العربة: الأرقام فقط = رأس قاطرة (يُفصل ويُشد لأكثر من مقطورة)،
 * وغيرها بالحروف قبل الرقم (HF12 → باص، SF64 → شفل).
 */
export const vehicleCategory = (code: string): VehicleCategory | null => {
  const c = code.trim().toUpperCase();
  if (/^\d+$/.test(c)) return { key: 'HEAD', ...CATEGORY.HEAD, image: `/trucks/types/${CATEGORY.HEAD.image}.webp` };
  const m = /^([A-Z]+)(\d*)/.exec(c);
  if (!m) return null;
  let key = m[1];
  if (key === 'SF' && BIG_SF_NUMBERS.has(Number(m[2]))) key = 'SF1';
  const cat = CATEGORY[key];
  return cat ? { key, ...cat, image: `/trucks/types/${cat.image}.webp` } : null;
};

/** صورة العربة: صورتها الخاصة إن وُجدت، ثم صورة فئتها، ثم الصورة العامة */
export const vehicleImage = (code: string, photo?: string) => photo || vehicleCategory(code)?.image || '/trucks/semi_truck.jpg';

/** صور أكبر وأدق خاصة بمختبر العربة (مقصوصة على حدودها، لا فراغ تحت العجلات)، وما لا صورة له يرجع لصورة فئته */
const LAB_IMAGES = new Set(['head', 'kn', 'ks', 'sf1']);
export const labImage = (code: string, photo?: string) => {
  if (photo) return photo;
  const key = vehicleCategory(code)?.key.toLowerCase();
  return key && LAB_IMAGES.has(key) ? `/trucks/lab/${key}.webp` : vehicleImage(code);
};
