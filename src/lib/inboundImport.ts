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
  ['receiptUnloadDate', ['تاريخ الاستلام والتفريغ', 'تاريخ الاستلام', 'التاريخ']]
];

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ').trim();

const matchHeader = (text: string): Field | null => {
  const t = norm(text);
  if (!t) return null;
  for (const [field, names] of HEADERS) if (names.some(n => t === n || t.includes(n))) return field;
  return null;
};

const toNumber = (v: unknown) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.-]/g, ''));
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

const buildRow = (cells: Partial<Record<Field, unknown>>): InboundImportRow | null => {
  const text = (f: Field) => String(cells[f] ?? '').trim();
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
  throw new Error('لم يُعثر على صف العناوين في الملف (اسم المجهز، رقم الفوجر، الكمية المستلمة...)');
};

/**
 * PDF: النصوص تُجمع في أسطر حسب موقعها العمودي، ثم يُحدد سطر العناوين،
 * وكل نص تحته يُنسب لأقرب عمود أفقيًا.
 */
const parsePdf = async (file: File): Promise<InboundImportRow[]> => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/'
  }).promise;

  type Item = { text: string; x: number; y: number };
  let columns: { field: Field; x: number }[] | null = null;
  const rows: InboundImportRow[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = (content.items as { str?: string; transform?: number[]; width?: number }[])
      .filter(it => it.str?.trim() && it.transform)
      .map(it => ({ text: it.str!.trim(), x: it.transform![4] + (it.width || 0) / 2, y: it.transform![5] }));

    // تجميع الأسطر (فرق عمودي ≤ 3 نقاط)
    const lines: Item[][] = [];
    for (const it of [...items].sort((a, b) => b.y - a.y)) {
      const line = lines.find(l => Math.abs(l[0].y - it.y) <= 3);
      if (line) line.push(it); else lines.push([it]);
    }

    for (const line of lines) {
      if (!columns) {
        const found = new Map<Field, number>();
        for (const it of line) {
          const f = matchHeader(it.text);
          if (f && !found.has(f)) found.set(f, it.x);
        }
        if (found.size >= 4) columns = [...found].map(([field, x]) => ({ field, x }));
        continue;
      }
      // سطر عناوين مكرر في صفحة جديدة
      if (line.filter(it => matchHeader(it.text)).length >= 4) continue;
      const cells: Partial<Record<Field, string>> = {};
      for (const it of [...line].sort((a, b) => b.x - a.x)) { // من اليمين لليسار
        const col = columns.reduce((best, c) => (Math.abs(c.x - it.x) < Math.abs(best.x - it.x) ? c : best));
        cells[col.field] = cells[col.field] ? `${cells[col.field]} ${it.text}` : it.text;
      }
      const row = buildRow(cells);
      if (row) rows.push(row);
    }
  }
  if (!columns) throw new Error('لم يُعثر على صف العناوين في ملف PDF (اسم المجهز، رقم الفوجر، الكمية المستلمة...)');
  return rows;
};

export const parseInboundFile = async (file: File): Promise<InboundImportRow[]> => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return parsePdf(file);
  if (/\.(xlsx|xls|csv)$/.test(name)) return parseExcel(file);
  throw new Error('يُقبل ملف Excel أو PDF فقط');
};
