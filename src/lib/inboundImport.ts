import i18n from '../i18n';
import { withPdf } from './pdfDoc';
/**
 * استيراد ملف الوارد اليومي (Excel أو PDF) الذي يحمل نفس عناوين نافذة الوارد:
 * اسم المجهز، الشركة المجهزة، اسم السائق، رقم العجلة، رقم الفوجر، الكمية المستلمة،
 * كثافة المنتج، لون المنتج، سعر المنتج، تكلفة المنتج، تاريخ الاستلام والتفريغ.
 * يُبحث عن صف العناوين في الملف، ثم يُقرأ كل صف تحته كشحنة.
 */

export interface InboundImportRow {
  supplierName: string;
  supplierCompany: string;
  driverName: string;
  truckNumber: string;
  voucherNumber: string;
  receivedQuantity: number;
  productDensity: string;
  productColor: string;
  productPrice: number;
  productCost: number;
  receiptUnloadDate: string; // YYYY/MM/DD ('' = يُؤخذ من تاريخ الملف المختار)
}

type Field = keyof InboundImportRow;

// عناوين الأعمدة (بعد التوحيد) — الأطول أولًا حتى لا يطابق "اسم" قبل "اسم المجهز"
const HEADERS: [Field, string[]][] = [
  ['supplierCompany', ['الشركه المجهزه', 'الجهه المجهزه', 'شركه التجهيز']],
  ['supplierName', ['اسم المجهز', 'المجهز']],
  ['driverName', ['اسم السائق', 'السائق']],
  ['truckNumber', ['رقم العجله', 'رقم السياره', 'العجله']],
  ['voucherNumber', ['رقم الفوجر', 'الفوجر']],
  ['receivedQuantity', ['الكميه المستلمه', 'الكميه']],
  ['productDensity', ['كثافه المنتج', 'الكثافه']],
  ['productColor', ['لون المنتج', 'اللون']],
  ['productPrice', ['سعر المنتج', 'السعر']],
  ['productCost', ['تكلفه المنتج', 'التكلفه', 'المبلغ']],
  ['receiptUnloadDate', ['تاريخ الاستلام والتفريغ', 'تاريخ الاستلام', 'التاريخ', 'تاريخ']]
];

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ').trim();

const matchHeader = (text: string): Field | null => {
  const t = norm(text);
  if (!t) return null;
  // PDF قد يقطع العنوان بمسافة داخل الكلمة ("الشر كة المجهزة"): المقارنة أيضًا بدون مسافات
  const tight = t.replace(/\s/g, '');
  // "المجهزة" (بالتاء) بدون "اسم" = الشركة المجهزة، و"اسم المجهز" = المجهز
  if (!tight.includes('اسم') && tight.includes('المجهزه')) return 'supplierCompany';
  for (const [field, names] of HEADERS) if (names.some(n => t === n || t.includes(n) || tight.includes(n.replace(/\s/g, '')))) return field;
  return null;
};

/** أول رقم في النص (يتجاهل "د.ع." والفوارز): "د . ع . 5,956,400" → 5956400 */
const toNumber = (v: unknown) => {
  if (typeof v === 'number') return v;
  const t = String(v ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٬/g, ',').replace(/٫/g, '.');
  const m = t.match(/-?\d[\d,]*(?:\.\d+)?/);
  const n = m ? parseFloat(m[0].replace(/,/g, '')) : NaN;
  return Number.isFinite(n) ? n : 0;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** تاريخ من Excel (رقم تسلسلي أو Date) أو نص (2026/10/04، 04/10/2026، 2026-10-04) → YYYY/MM/DD */
export const toIsoSlashDate = (v: unknown): string => {
  if (v instanceof Date && !isNaN(+v)) return `${v.getFullYear()}/${pad(v.getMonth() + 1)}/${pad(v.getDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
  }
  const s = String(v ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
  let m = s.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m) return `${m[1]}/${pad(+m[2])}/${pad(+m[3])}`;
  m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (m) return `${m[3]}/${pad(+m[2])}/${pad(+m[1])}`;
  return '';
};

/** خانة فارغة في الكشف تُكتب "_" أو "-": تُعامل كفارغة (وإلا تُعدّ كل شحنة بلا فوجر مكررة بعد أول استيراد) */
const PLACEHOLDER = /^[_\-–—.]+$/;

const buildRow = (cells: Partial<Record<Field, unknown>>): InboundImportRow | null => {
  const text = (f: Field) => { const v = String(cells[f] ?? '').trim(); return PLACEHOLDER.test(v) ? '' : v; };
  const qty = toNumber(cells.receivedQuantity);
  const voucher = text('voucherNumber');
  // صفوف فارغة أو صف المجموع
  if (!voucher && !qty) return null;
  if (/مجموع|اجمالي|المجموع|الإجمالي|total/i.test(norm(Object.values(cells).join(' '))) && !text('driverName')) return null;
  // صف الإجماليات أسفل الجدول: خانة نصية تحمل عنوان عمود ("الكمية المستلمة") أو كلمة إجمالي ("المبلغ الكلي")
  const textFields: Field[] = ['supplierName', 'supplierCompany', 'driverName', 'truckNumber', 'voucherNumber', 'productColor'];
  const isSummaryLabel = (v: string) => {
    const t = norm(v);
    return !!t && (/مجموع|اجمالي|الكلي|total/i.test(t) || HEADERS.some(([, names]) => names.includes(t)));
  };
  if (textFields.some(f => isSummaryLabel(text(f)))) return null;
  const price = toNumber(cells.productPrice);
  const density = cells.productDensity;
  return {
    supplierName: text('supplierName'),
    supplierCompany: text('supplierCompany'),
    driverName: text('driverName'),
    truckNumber: text('truckNumber'),
    voucherNumber: voucher,
    receivedQuantity: qty,
    productDensity: typeof density === 'number' ? String(density) : text('productDensity'),
    productColor: text('productColor'),
    productPrice: price,
    productCost: toNumber(cells.productCost) || qty * price,
    receiptUnloadDate: toIsoSlashDate(cells.receiptUnloadDate)
  };
};

/** Excel: أول صف فيه 4 عناوين معروفة على الأقل هو صف العناوين */
const parseExcel = async (file: File): Promise<InboundImportRow[]> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' });
    for (let r = 0; r < Math.min(grid.length, 40); r++) {
      const cols = new Map<number, Field>();
      (grid[r] || []).forEach((cell, c) => {
        const f = matchHeader(String(cell));
        if (f && ![...cols.values()].includes(f)) cols.set(c, f);
      });
      if (cols.size < 4) continue;
      const rows: InboundImportRow[] = [];
      for (const line of grid.slice(r + 1)) {
        const cells: Partial<Record<Field, unknown>> = {};
        cols.forEach((f, c) => { cells[f] = (line || [])[c]; });
        const row = buildRow(cells);
        if (row) rows.push(row);
      }
      return rows;
    }
  }
  throw new Error(i18n.t('common:fileImport.noHeaderRow'));
};

/** نص PDF بموضعه: الحافتان الأفقيتان والارتفاع، والنص كما هو (بمسافاته) */
export interface PdfTextItem { str: string; left: number; right: number; y: number }

/**
 * نص خانة من قطعها: PDF يقطع الكلمة العربية (خصوصًا حرف الياء الأخير) إلى قطع، وبعضها بعرض صفر داخل كلمتها.
 * القطعة بعرض صفر تُدرج داخل الكلمة التي تحتويها عند أقرب نهاية كلمة، والبقية تُرتَّب من اليمين لليسار
 * وتُجمع بمسافاتها الأصلية (لا تُضاف مسافة بين قطعتين متلاصقتين: "بر" + "كات" = "بركات").
 */
const joinPdfItems = (items: PdfTextItem[]): string => {
  const solid = items.filter(i => i.right - i.left > 0.05).map(i => ({ ...i }));
  for (const z of items.filter(i => i.right - i.left <= 0.05 && i.str.trim())) {
    const host = solid.find(h => z.left >= h.left - 0.6 && z.left < h.right);
    if (!host) { solid.push({ ...z, right: z.left + 0.01 }); continue; }
    const t = host.str;
    const at = Math.round(((host.right - z.left) / (host.right - host.left)) * t.length);
    // أقرب نهاية كلمة (قبل مسافة أو نهاية النص)
    let best = t.length;
    for (let i = 0; i <= t.length; i++) if ((i === t.length || /\s/.test(t[i])) && i > 0 && !/\s/.test(t[i - 1]) && Math.abs(i - at) < Math.abs(best - at)) best = i;
    host.str = t.slice(0, best) + z.str.trim() + t.slice(best);
  }
  solid.sort((a, b) => b.left - a.left);
  let out = '';
  solid.forEach((it, i) => {
    const prev = solid[i - 1];
    // فراغ واضح بين قطعتين بلا مسافة مكتوبة: كلمتان منفصلتان
    if (prev && prev.left - it.right > 1.5 && !/\s$/.test(out) && !/^\s/.test(it.str)) out += ' ';
    out += it.str;
  });
  // الأقواس كما في Excel: "اطراف النخيل ( نشوان )"
  return out.replace(/\s*\(\s*/g, ' ( ').replace(/\s*\)\s*/g, ' ) ').replace(/\s+/g, ' ').trim();
};

/** البعد بين قطعة وعمود: صفر إن تداخلا، وإلا المسافة بين الحافتين */
const gap = (a: { left: number; right: number }, b: { left: number; right: number }) =>
  Math.max(0, a.left - b.right, b.left - a.right);

/**
 * جدول PDF من قطع النص (صفحة بصفحة): سطر العناوين يحدد عرض كل عمود (مع جمع العنوان المقطوع لقطع)،
 * وكل قطعة في الأسطر التالية تُنسب للعمود الذي يتداخل معها أو الأقرب لحافته — لا لمنتصفه:
 * الكمية في الكشف تقع بين منتصفي عنوانَي "الفوجر" و"الكمية" فكانت تُلصق برقم الفوجر.
 */
export const parsePdfTable = (pages: PdfTextItem[][]): InboundImportRow[] => {
  type Col = { field: Field; left: number; right: number };
  let columns: Col[] | null = null;
  const dataLines: PdfTextItem[][] = [];
  for (const items of pages) {
    // تجميع الأسطر (فرق عمودي ≤ 3 نقاط)
    const lines: PdfTextItem[][] = [];
    for (const it of [...items].sort((a, b) => b.y - a.y)) {
      if (!it.str.trim() && it.right - it.left <= 0.05) continue;
      const line = lines.find(l => Math.abs(l[0].y - it.y) <= 3);
      if (line) line.push(it); else lines.push([it]);
    }
    for (const line of lines) {
      // عبارات السطر: قطع متلاصقة (أو متداخلة) تُجمع في عبارة واحدة
      const phrases: PdfTextItem[][] = [];
      for (const it of [...line].sort((a, b) => b.right - a.right)) {
        const last = phrases[phrases.length - 1];
        const lastLeft = last ? Math.min(...last.map(i => i.left)) : 0;
        if (last && lastLeft - it.right < 1.5) last.push(it); else phrases.push([it]);
      }
      const headers = phrases
        .map(ph => ({ field: matchHeader(joinPdfItems(ph)), left: Math.min(...ph.map(i => i.left)), right: Math.max(...ph.map(i => i.right)) }))
        .filter((h): h is Col => !!h.field);
      if (new Set(headers.map(h => h.field)).size >= 4) {
        // أول ظهور لكل حقل (سطر العناوين يتكرر أعلى كل صفحة)
        if (!columns) columns = headers.filter((h, i) => headers.findIndex(x => x.field === h.field) === i);
        continue;
      }
      if (columns) dataLines.push(line);
    }
  }
  if (!columns) throw new Error(i18n.t('common:fileImport.noHeaderRowPdf'));
  const cols = columns;

  const mid = (x: { left: number; right: number }) => (x.left + x.right) / 2;
  const nearest = (it: PdfTextItem, spans: Col[]) => spans.reduce((best, c) => {
    const d = gap(it, c) - gap(it, best);
    if (d !== 0) return d < 0 ? c : best;
    return Math.abs(mid(c) - mid(it)) < Math.abs(mid(best) - mid(it)) ? c : best;
  });

  // الجولة الأولى: حسب عرض العناوين. ثم يُحسب لكل عمود موضع بياناته الفعلي (الوسيط) — الأرقام القصيرة
  // المحاذاة لليمين (مثل كمية 498) أقرب لعنوان الفوجر منها لعنوان الكمية، لكنها داخل موضع أرقام الكمية
  const seen = new Map<Field, { lefts: number[]; rights: number[] }>();
  for (const line of dataLines) for (const it of line) {
    if (!it.str.trim()) continue;
    const f = nearest(it, cols).field;
    const e = seen.get(f) || { lefts: [], rights: [] };
    e.lefts.push(it.left); e.rights.push(it.right);
    seen.set(f, e);
  }
  const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const dataCols: Col[] = cols.map(c => {
    const e = seen.get(c.field);
    return e && e.lefts.length >= 3 ? { field: c.field, left: median(e.lefts), right: median(e.rights) } : c;
  });

  const rows: InboundImportRow[] = [];
  for (const line of dataLines) {
    const byField = new Map<Field, PdfTextItem[]>();
    for (const it of line) {
      const f = nearest(it, dataCols).field;
      byField.set(f, [...(byField.get(f) || []), it]);
    }
    const cells: Partial<Record<Field, string>> = {};
    byField.forEach((its, f) => { cells[f] = joinPdfItems(its); });
    const row = buildRow(cells);
    if (row) rows.push(row);
  }
  return rows;
};

const parsePdf = (file: File): Promise<InboundImportRow[]> => withPdf(file, true, async pdf => {
  const pages: PdfTextItem[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    pages.push((content.items as { str?: string; transform?: number[]; width?: number }[])
      .filter(it => it.str && it.transform)
      .map(it => ({ str: it.str!, left: it.transform![4], right: it.transform![4] + (it.width || 0), y: it.transform![5] })));
  }
  return parsePdfTable(pages);
});

export const parseInboundFile = async (file: File): Promise<InboundImportRow[]> => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return parsePdf(file);
  if (/\.(xlsx|xls|csv)$/.test(name)) return parseExcel(file);
  throw new Error(i18n.t('common:fileImport.excelPdfOnly'));
};
