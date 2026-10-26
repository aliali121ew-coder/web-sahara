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

type Col = 'driver' | 'vehicle' | 'qty' | 'date' | 'days' | 'prevSite' | 'prevDriver' | 'prevQty' | 'prevDate' | 'kind';

// عناوين الأعمدة (الأطول أولًا حتى لا يطابق «السائق» عنوان «السائق السابق»)
const HEADERS: [Col, string][] = [
  ['prevSite', 'المصنع السابق'],
  ['prevDriver', 'السائق السابق'],
  ['prevQty', 'الكمية السابقة'],
  ['days', 'عدد الايام'],
  ['kind', 'تشغيلي/انشائي'],
  ['driver', 'السائق'],
  ['vehicle', 'العربة'],
  ['qty', 'الكمية'],
];

const center = (i: PdfItem) => i.x + i.w / 2;

/** مواضع الأعمدة من سطر العناوين (التاريخان: الأيسر للحالي والأيمن للسابق) */
const readHeader = (line: PdfItem[]): Map<Col, number> | null => {
  const cols = new Map<Col, number>();
  const used = new Set<PdfItem>();
  for (const [col, label] of HEADERS) {
    const key = normalizeArabic(label);
    const hit = line.find(i => !used.has(i) && normalizeArabic(i.str) === key);
    if (hit) { cols.set(col, center(hit)); used.add(hit); }
  }
  const dates = line.filter(i => normalizeArabic(i.str) === normalizeArabic('التاريخ')).sort((a, b) => a.x - b.x);
  if (dates.length >= 2) { cols.set('date', center(dates[0])); cols.set('prevDate', center(dates[dates.length - 1])); }
  return cols.has('vehicle') && cols.has('qty') && cols.has('prevQty') ? cols : null;
};

export interface VehicleSheet {
  site: string;
  rows: Omit<VehicleRefill, 'id' | 'fileId' | 'site'>[];
  total: number | null;
}

/** يقرأ سطور الكشف (صفحات → أسطر → عناصر) — منفصلة عن PDF لتُختبر */
export const parseVehicleSheet = (pages: PdfItem[][][]): VehicleSheet => {
  let site = '';
  let total: number | null = null;
  const rows: VehicleSheet['rows'] = [];
  for (const lines of pages) {
    let cols: Map<Col, number> | null = null;
    for (const line of lines) {
      const text = normalizeArabic(line.map(i => i.str).join(' '));
      if (!site && text.includes(normalizeArabic('المصنع')) && !text.includes(normalizeArabic('السابق'))) {
        // «المصنع» عنوان في أقصى اليمين، واسم الموقع النص الذي يليه يسارًا
        const label = line.find(i => normalizeArabic(i.str) === normalizeArabic('المصنع'));
        const name = label && line.filter(i => i.x < label.x && num(i.str) === null && !toIsoDate(i.str) && normalizeArabic(i.str) !== normalizeArabic('من'))
          .sort((a, b) => b.x - a.x)[0];
        if (name) site = clean(name.str);
      }
      const header = readHeader(line);
      if (header) { cols = header; continue; }
      if (!cols) continue;
      if (text.includes(normalizeArabic('المجموع'))) {
        const n = line.map(i => num(i.str)).filter((v): v is number => v !== null);
        if (n.length) total = Math.max(...n);
        continue;
      }
      // كل عنصر يُنسب لأقرب عمود
      const cells = new Map<Col, string[]>();
      const entries = [...cols.entries()];
      for (const it of line) {
        const c = center(it);
        const [col] = entries.reduce((best, e) => (Math.abs(e[1] - c) < Math.abs(best[1] - c) ? e : best));
        cells.set(col, [...(cells.get(col) || []), it.str]);
      }
      const get = (c: Col) => clean((cells.get(c) || []).join(' '));
      // خلية التاريخ قد تلتصق بها وحدة القياس المجاورة («لتر»)
      const dateIn = (c: Col) => (cells.get(c) || []).map(toIsoDate).find(Boolean) || '';
      const date = dateIn('date');
      const qty = num(get('qty'));
      const vehicle = get('vehicle').replace(/\s+/g, '');
      if (!date || qty === null || !vehicle) continue;
      rows.push({
        vehicle,
        driver: get('driver'),
        qty,
        date,
        days: num(get('days')),
        prevSite: get('prevSite'),
        prevDriver: get('prevDriver'),
        prevQty: num(get('prevQty')),
        prevDate: dateIn('prevDate'),
        kind: get('kind'),
      });
    }
  }
  return { site, rows, total };
};

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** يقرأ ملف PDF ويحوّله إلى ملف + تفويلات جاهزة للحفظ */
export const readVehicleFile = async (file: File): Promise<{ file: VehicleFile; refills: VehicleRefill[]; total: number | null }> => {
  const { pages, anyText } = await readPdfPages(file);
  if (!anyText) throw new Error('الملف لا يحتوي نصًا قابلًا للقراءة (صورة ممسوحة)');
  const sheet = parseVehicleSheet(pages);
  if (!sheet.rows.length) throw new Error('لم يُعثر على جدول تفويل العربات في الملف');
  const site = sheet.site || 'غير محدد';
  const reportDate = sheet.rows.reduce((m, r) => (r.date > m ? r.date : m), '');
  // معرّف الملف من الموقع والتاريخ: رفع كشف نفس الموقع واليوم مرة ثانية يستبدل الأول
  const fileId = `vf-${hash(`${site}|${reportDate}`)}`;
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

export const groupDayFills = (refills: VehicleRefill[]): DayFill[] => {
  const map = new Map<string, VehicleRefill[]>();
  for (const r of refills) {
    const k = `${r.vehicle}|${r.date}`;
    const l = map.get(k);
    if (l) l.push(r); else map.set(k, [r]);
  }
  return [...map.values()].map(list => {
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
