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

/**
 * ملف مدموج يضم عدة كشوف: عنوان «المصنع» لا يتكرر إلا في أول صفحة من كل كشف،
 * فكل صفحة فيها هذا العنوان تبدأ كشفًا جديدًا وما بعدها تتمة له.
 */
export const splitSheets = (pages: PdfItem[][][]): PdfItem[][][][] => {
  const key = normalizeArabic('المصنع');
  const sheets: PdfItem[][][][] = [];
  for (const page of pages) {
    const starts = page.some(line => line.some(i => normalizeArabic(i.str) === key));
    if (starts || !sheets.length) sheets.push([page]);
    else sheets[sheets.length - 1].push(page);
  }
  return sheets;
};

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export interface VehicleUpload { file: VehicleFile; refills: VehicleRefill[]; total: number | null }

/** يقرأ ملف PDF (كشف واحد أو عدة كشوف مدموجة) ويحوّل كل كشف إلى ملف + تفويلات جاهزة للحفظ */
export const readVehicleFile = async (file: File, fallbackDate = ''): Promise<VehicleUpload[]> => {
  const { pages, anyText } = await readPdfPages(file);
  if (!anyText) throw new Error('الملف لا يحتوي نصًا قابلًا للقراءة (صورة ممسوحة)');
  const p = getProfile();
  const uploads: VehicleUpload[] = [];
  for (const sheetPages of splitSheets(pages)) {
    const sheet = parseVehicleSheet(sheetPages, fallbackDate);
    if (!sheet.rows.length) continue;
    const site = sheet.site || 'غير محدد';
    const reportDate = sheet.rows.reduce((m, r) => (r.date > m ? r.date : m), '');
    // معرّف الملف: المستند برقمه، والكشف بموقعه وتاريخه — به يُكتشف الكشف المرفوع مسبقًا
    const fileId = `vf-${hash(sheet.docNo ? `${site}|doc|${sheet.docNo}` : `${site}|${reportDate}`)}`;
    const refills = sheet.rows.map((r, i) => ({ ...r, site, fileId, id: `${fileId}-${i}` }));
    uploads.push({
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
    });
  }
  if (!uploads.length) throw new Error('لم يُعثر على جدول تفويل العربات في الملف');
  return uploads;
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

// ───── الاستهلاك من تسلسل التفويلات ─────

/**
 * استهلاك تفويلة: على افتراض أن العربة تُملأ إلى نفس المستوى، كمية التفويلة الجديدة = ما صُرف منذ السابقة.
 * مثال: 250 ثم 200 ← صُرف 200 وبقي 50.
 */
export interface FillConsumption {
  /** تاريخ التفويلة التي كشفت الصرف */
  date: string;
  /** المصروف منذ التفويلة السابقة؛ null = لا تفويلة سابقة معروفة (أول تفويلة للعربة في البيانات والكشف) */
  consumed: number | null;
  /** تاريخ التفويلة السابقة (التي صُرف منها)؛ فارغ إن لم يُعرف */
  prevDate: string;
  prevQty: number | null;
  /** موقع السابقة كما في الكشف، وإلا موقع هذه التفويلة */
  prevSite: string;
  /** السابقة ناقص الجديدة؛ null إذا لم تُعرف السابقة أو فاقتها الجديدة (كان في الخزان رصيد أقدم) */
  remaining: number | null;
}

/** تاريخ قبل عدد من الأيام (YYYY/MM/DD) */
const daysBefore = (date: string, days: number) => {
  const [y, m, d] = date.split('/').map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10).replace(/-/g, '/');
};

/**
 * استهلاك كل تفويلات العربة (الأقدم أولًا). تُمرَّر كل تفويلاتها لا تفويلات الفترة فقط،
 * فأول تفويلة في فترة مختارة تُحسب من التفويلة التي قبلها خارج الفترة.
 * السابقة = التفويلة الأحدث قبلها في البيانات، أو ما سجّله الكشف إن كان أحدث منها (كشف لم يُرفع).
 */
export const fillConsumption = (fills: DayFill[]): FillConsumption[] => {
  const sorted = [...fills].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((f, i) => {
    const before: DayFill | undefined = sorted[i - 1];
    const sheetDate = f.prevDate && f.prevDate < f.date ? f.prevDate : '';
    const fromData = !!before && !(sheetDate > before.date);
    const prevDate = fromData ? before.date : sheetDate || (f.days ? daysBefore(f.date, f.days) : '');
    const prevQty = fromData ? before.qty : f.prevQty;
    const known = !!prevDate || prevQty !== null;
    return {
      date: f.date,
      consumed: known ? f.qty : null,
      prevDate,
      prevQty,
      prevSite: (fromData ? before.sites.join('، ') : f.prevSite) || f.sites.join('، '),
      remaining: known && prevQty !== null && prevQty >= f.qty ? prevQty - f.qty : null,
    };
  });
};

/**
 * الاستهلاك على سعة الخزان (معادلة تحليل الاستهلاك وصفحة العربة): التفويلة الأكبر من السعة تُقص عندها،
 * والمتبقي = السعة ناقص المصروف. بلا سعة مسجلة لا يُحسب استهلاك.
 */
export const capConsumption = (list: FillConsumption[], capacity: number): FillConsumption[] => list.map(c => {
  if (c.consumed === null || !capacity) return { ...c, consumed: null, remaining: null };
  const consumed = Math.min(c.consumed, capacity);
  return { ...c, consumed, remaining: capacity - consumed };
});

/** توزيع الاستهلاك على المواقع: المصروف يُنسب لموقع التفويلة التي صُرف منها، وبنسب كمياتها إن فُوّلت من أكثر من موقع */
export const consumptionBySite = (list: FillConsumption[], refills: VehicleRefill[]) => {
  const by = new Map<string, number>();
  const add = (site: string, qty: number) => by.set(site, (by.get(site) || 0) + qty);
  for (const c of list) {
    if (c.consumed === null) continue;
    const source = refills.filter(r => r.date === c.prevDate);
    const base = source.reduce((s, r) => s + r.qty, 0);
    if (!base) { add(c.prevSite, c.consumed); continue; }
    for (const r of source) add(r.site, (c.consumed * r.qty) / base);
  }
  return [...by.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
};

/** نقطة الرسم الخطي: كمية التفويل في تاريخها، وما صُرف من تلك التفويلة حتى التي بعدها */
export interface TrendPoint {
  date: string;
  /** null = تاريخ من الكشف كميته غير معروفة */
  qty: number | null;
  /** تفويلة هذا اليوم؛ null = نقطة السابقة لأول تفويلة (خارج الفترة أو لم يُرفع كشفها) */
  fill: DayFill | null;
  consumed: number | null;
  remaining: number | null;
  /** تاريخ التفويلة التي كشفت الصرف */
  until: string;
  site: string;
}

/**
 * نقاط الرسم الخطي. الاستهلاك يُرسم عند التفويلة التي صُرف منها لا عند التي كشفته:
 * وإلا طابق خط التفويل تمامًا لأن الكميتين واحدة، أما هكذا فيظهر ما صُرف من كل تفويلة.
 * تفويلة بلا تاريخ سابق لا موضع لها على الخط، وتبقى محسوبة في الكارت والدائرة.
 */
export const consumptionTrend = (fills: DayFill[], list: FillConsumption[]): TrendPoint[] => {
  const map = new Map<string, TrendPoint>();
  for (const f of fills) map.set(f.date, { date: f.date, qty: f.qty, fill: f, consumed: null, remaining: null, until: '', site: f.sites.join('، ') });
  for (const c of list) {
    if (c.consumed === null || !c.prevDate) continue;
    const p = map.get(c.prevDate) ?? { date: c.prevDate, qty: c.prevQty, fill: null, consumed: null, remaining: null, until: '', site: c.prevSite };
    map.set(c.prevDate, { ...p, consumed: c.consumed, remaining: c.remaining, until: c.date });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
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
  /** سعة الخزان الثالث (لتر) */
  tank3Liters?: number | null;
  /** عدد الخزانات المختار في تفاصيل العربة (يُحفظ ولو لم تُدخل السعات بعد) */
  tankCount?: number | null;
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
/** العربات المحذوفة من التقرير (رمزها كما في الملفات): تُخفى من كل الصفحات وتبقى تفويلاتها محفوظة، ويعيدها مدير النظام */
export const VEHICLE_HIDDEN_KEY = 'sahara_vehicle_hidden_v1';

export type CheckKind = 'capacity' | 'limit' | 'driver' | 'frequent' | 'multi';
export interface FillCheck { kind: CheckKind; date: string; text: string }

/** مخالفات كل تفويلة مقابل ملف العربة */
/** بداية يوم قائمة الملفات: آخر الساعة 7 صباحًا بتوقيت العراق (UTC+3 طوال السنة) */
export const fileDayStart = (now: number) => {
  const d = new Date(now);
  d.setUTCHours(4, 0, 0, 0);
  return d.getTime() > now ? d.getTime() - 86400000 : d.getTime();
};

/** سعات خزانات العربة المسجلة بالترتيب */
export const tankCaps = (p: VehicleProfile | undefined) => [p?.tankLiters, p?.tank2Liters, p?.tank3Liters].filter((c): c is number => !!c);

/**
 * سعات خزانات العربات (لتر)، بالترتيب: الرئيسي ثم الثاني ثم الثالث.
 * رؤوس التريلات من كشف «راس تريلة محدث» (97 عربة)، وباقي الآليات من كشف «خدمات اليات» (72 آلية)،
 * والشفلات الصغيرة من كشف «شفل SF» (51 من 82 لها سعة مكتوبة).
 * العربة التي فيها الثالث بلا ثانٍ تُعد بخزانين. 246 خزان واحد بلا سعة مكتوبة.
 */
const VEHICLE_TANKS: Record<string, number[]> = {
  13: [500], 23: [700, 700], 25: [500, 300], 29: [700, 700], 35: [700], 40: [610], 67: [700, 700], 69: [700, 700],
  71: [700, 700], 91: [400, 350], 104: [700, 700], 109: [700, 500], 111: [700, 700], 114: [700, 700], 122: [500],
  127: [600, 500], 132: [700, 250], 139: [550], 140: [700, 700], 156: [700, 700], 161: [700, 700], 162: [700], 189: [700, 700],
  193: [700, 700], 201: [500], 203: [500], 206: [500], 216: [300], 221: [630], 222: [300], 246: [], 251: [500],
  252: [300, 300], 272: [500], 274: [600], 284: [300, 300], 285: [500], 288: [500], 296: [500], 301: [500], 305: [600, 175],
  309: [600], 329: [600], 336: [500], 461: [300, 300], 499: [700, 500, 240], 514: [600], 571: [500, 300], 588: [600],
  592: [700], 593: [700, 240], 595: [625, 625], 598: [600, 550, 250], 609: [700, 700, 250], 654: [700, 700],
  655: [700, 700, 250], 670: [950, 550, 240], 672: [500, 240], 678: [750, 620], 682: [700, 700, 240], 686: [700, 700],
  687: [750, 620, 250], 696: [500, 300], 697: [400, 300], 746: [500, 700, 240], 749: [400, 700], 755: [700, 500],
  756: [300, 300], 767: [300], 785: [300, 300], 791: [700, 700], 806: [700, 250], 811: [700, 700], 816: [700, 600], 822: [700],
  824: [700, 700], 827: [600, 600], 831: [700, 700], 833: [700, 700], 839: [350], 846: [600, 600], 850: [600, 350],
  851: [700, 700], 860: [700], 873: [700], 880: [600, 600], 881: [600, 600], 889: [700, 700], 890: [700, 700], 902: [700, 700],
  907: [700, 700], 908: [700], 910: [700, 500], 931: [600, 600], 932: [700, 700], 937: [1000, 500, 250], 993: [700, 500, 250],
  // خدمات اليات
  A13: [625], AT6: [175, 160], AT7: [280, 160], AT10: [180, 100], AT14: [250], BS14: [100, 180], BS18: [80],
  BS45: [100, 200], BS76: [100, 140], BS88: [100, 150], BS109: [100, 60], BS111: [100, 60], BS126: [100, 120],
  BS144: [100, 120], BS178: [100, 60, 100], BS196: [100, 60], BS214: [100, 140], BS224: [100, 120],
  BS243: [100, 120], BS260: [100, 120], BS263: [100], BS268: [100, 125], BS269: [100, 140], BS270: [100, 120],
  BS271: [80], BS272: [100, 120], BS273: [100, 120], BS277: [100, 140], BS278: [100, 120], BS280: [100],
  BS299: [100, 60, 120], BS317: [160], BS329: [100, 60, 100], BS330: [160], BS331: [100, 60],
  BS332: [100, 60, 140], BS333: [100, 60], BS336: [160, 80], BS338: [100, 100, 60], BS340: [100, 60],
  BS341: [100, 60], BS342: [100, 60], BS343: [160], BS345: [100, 60], BS346: [100, 60, 130], BS347: [100, 60],
  BS348: [100, 60], BS349: [100, 60], BS350: [100, 60, 120], BS352: [100, 60], BS354: [100, 60], HF68: [120, 120],
  HR2: [250], HR12: [400, 1000], HW18: [625], K5: [250], KH125: [60], KN5: [90], KN11: [250], KN12: [500],
  KN20: [400], KN35: [500], KN59: [700, 700], KO9: [60], KS5: [300], KS8: [350], L2: [700], L13: [700, 700],
  M18: [70], SL1: [350, 200], SL3: [700, 700], SL4: [600, 600],
  // شفل SF
  SF2: [40], SF3: [40], SF4: [40], SF5: [40], SF6: [40], SF7: [40], SF17: [300], SF18: [300], SF19: [300],
  SF20: [60], SF21: [60], SF22: [60], SF25: [60], SF26: [60], SF30: [60], SF31: [60], SF32: [60], SF33: [40],
  SF34: [40], SF35: [40], SF36: [40], SF37: [60], SF38: [60], SF39: [60], SF40: [60], SF46: [60], SF47: [60],
  SF51: [260], SF54: [260], SF55: [300], SF56: [300], SF57: [260], SF58: [60], SF59: [60], SF60: [60], SF61: [60],
  SF62: [60], SF63: [300], SF64: [300], SF68: [60], SF69: [60], SF70: [60], SF71: [300], SF72: [60], SF73: [300],
  SF74: [60], SF75: [60], SF76: [40], SF77: [40], SF78: [40], SF81: [40],
};

/** سعات خزانات العربة من الكشوف (null = ليست في الكشوف) */
export const sheetTanks = (code: string): number[] | null => VEHICLE_TANKS[code.trim().toUpperCase()] ?? null;
/** رموز العربات الموجودة في كشوف الخزانات */
export const SHEET_TANK_CODES = Object.keys(VEHICLE_TANKS);

/**
 * ملف العربة مع خزاناتها من الكشف إن لم تُسجَّل لها خزانات في تفاصيلها.
 * ما يُدخل في تفاصيل العربة يبقى هو المعتمد، والحفظ من التفاصيل يثبّت سعات الكشف في ملفها.
 */
export const withTanks = (p: VehicleProfile | undefined, vehicle: string): VehicleProfile | undefined => {
  if (p?.tankCount || p?.tankLiters || p?.tank2Liters || p?.tank3Liters) return p;
  const caps = VEHICLE_TANKS[(p?.name || vehicle).trim().toUpperCase()];
  if (!caps) return p;
  const base: VehicleProfile = p || { id: vehicle, name: '', type: '', tankLiters: null, dailyLimit: null, driver: '', department: '', notes: '', photo: '', updatedAt: '', by: '' };
  return { ...base, tankCount: caps.length || 1, tankLiters: caps[0] ?? null, tank2Liters: caps[1] ?? null, tank3Liters: caps[2] ?? null };
};

/** عدد خزانات العربة: المختار في تفاصيلها، وللملفات الأقدم آخر خزان له سعة؛ null = غير محدد */
export const tankCountOf = (p: VehicleProfile | undefined) => p?.tankCount || (p?.tank3Liters ? 3 : p?.tank2Liters ? 2 : p?.tankLiters ? 1 : null);

export const checkFills = (fills: DayFill[], profile: VehicleProfile | undefined): FillCheck[] => {
  const out: FillCheck[] = [];
  const norm = (s: string) => normalizeArabic(s);
  const capacity = tankCaps(profile).reduce((s, c) => s + c, 0);
  for (const f of fills) {
    if (capacity && f.qty > capacity) out.push({ kind: 'capacity', date: f.date, text: `${f.qty.toLocaleString()} لتر أكبر من سعة الخزانات ${capacity.toLocaleString()}` });
    if (profile?.dailyLimit && f.qty > profile.dailyLimit) out.push({ kind: 'limit', date: f.date, text: `تجاوز الحصة اليومية بـ ${(f.qty - profile.dailyLimit).toLocaleString()} لتر` });
    if (profile?.driver && f.drivers.length && !f.drivers.some(d => norm(d) === norm(profile.driver))) out.push({ kind: 'driver', date: f.date, text: `فوّلها ${f.drivers.join('، ')} وليس السائق المعتمد` });
    if (f.days !== null && f.days <= FREQUENT_DAYS) out.push({ kind: 'frequent', date: f.date, text: `تفويل بعد ${f.days} يوم من السابقة` });
    if (f.parts > 1) out.push({ kind: 'multi', date: f.date, text: `${f.parts} تفويلات في نفس اليوم (${f.sites.join('، ')})` });
  }
  return out;
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
  IS: { label: 'إسعاف', image: 'is', door: [0.38, 0.5], tilt: -5 },
  KR: { label: 'كريدر', image: 'kr', door: [0.66, 0.4], tilt: -4 },
  KO: { label: 'كوستر', image: 'ko', door: [0.3, 0.5], tilt: -5 },
  SA: { label: 'سايلو أعلاف', image: 'sa', door: [0.72, 0.45], tilt: 4 },
};

/** المساحة الشفافة تحت العجلات في صورة كل فئة (نسبة من ارتفاع الصورة)، لإنزال العربة حتى تقف على الأرض */
const IMAGE_GROUND: Record<string, number> = {
  a: 0.062, at: 0.048, bs: 0.082, head: 0.077, hf: 0.141, hr: 0.042, hw: 0.06, k: 0.048, ka: 0.06, kb: 0.026,
  kh: 0.138, kn: 0.062, ks: 0.058, l: 0.044, m: 0.062, r: 0.062, sf: 0.046, sf1: 0.06, sl: 0.056, sr: 0.068,
  is: 0.06, kr: 0.06, ko: 0.06, sa: 0.06,
};
export const imageGround = (url: string) => IMAGE_GROUND[/\/types\/([\w-]+)\.webp$/.exec(url)?.[1] || ''] || 0;

/** الاسم الافتراضي لفئة من مفتاحها (لمسار الصفحات) */
export const categoryLabel = (key: string) => CATEGORY[key]?.label || '';

/** خزان الشفل الصغير 75 لتر فأقل، وما فوقه شفل كبير */
const BIG_SF_LITERS = 75;

/** أرقام الشفلات الكبيرة (SF + رقم): من كشف الخزانات، كل شفل خزانه أكثر من 75 لتر */
export const BIG_SF_NUMBERS = new Set<number>(
  Object.entries(VEHICLE_TANKS)
    .filter(([code, caps]) => /^SF\d+$/.test(code) && caps.reduce((s, c) => s + c, 0) > BIG_SF_LITERS)
    .map(([code]) => Number(code.slice(2))),
);

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
const LAB_IMAGES = new Set(['a', 'at', 'bs', 'head', 'hf', 'hr', 'hw', 'k', 'ka', 'kb', 'kh', 'kn', 'ks', 'l', 'm', 'r', 'sf1', 'sl', 'sr']);
export const labImage = (code: string, photo?: string) => {
  if (photo) return photo;
  const key = vehicleCategory(code)?.key.toLowerCase();
  return key && LAB_IMAGES.has(key) ? `/trucks/lab/${key}.webp` : vehicleImage(code);
};
