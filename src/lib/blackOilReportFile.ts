import i18n from '../i18n';
/**
 * قراءة تقرير النفط الأسود اليومي (Excel أو PDF) لتعبئة نافذة "تسجيل يوم" تلقائيًا.
 * التقرير مقسّم إلى مواقف (موقف الريان، موقف السكر...) وتحت كل موقف أسطر: عنوان + رقم، مثل:
 * الرصيد الحقيقي بالخزانات، رصيد البرنامج، السعة الكلية للخزانات، مستوى الفارغ الحالي،
 * فرق رصيد البرنامج عن الحقيقي، الوارد، الاستهلاك.
 */

export interface BlackOilSiteReport {
  /** الرصيد الحقيقي بالخزانات */
  actual: number | null;
  program: number | null;
  capacity: number | null;
  /** مستوى الفارغ الحالي */
  empty: number | null;
  diff: number | null;
  inbound: number | null;
  consumption: number | null;
}

type Metric = keyof BlackOilSiteReport;

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/[ةھە]/g, 'ه').replace(/[ىی]/g, 'ي').replace(/ک/g, 'ك')
    .replace(/\s+/g, ' ').trim();

// ترتيب الفحص مهم: "فرق رصيد البرنامج" قبل "رصيد البرنامج"
const LABELS: [Metric, string[]][] = [
  ['diff', ['فرق رصيد', 'الفرق']],
  ['actual', ['الرصيد الحقيقي', 'الرصيد الفعلي']],
  ['program', ['رصيد البرنامج']],
  ['capacity', ['السعه الكليه', 'السعه']],
  ['empty', ['مستوي الفارغ', 'الفارغ']],
  ['inbound', ['الوارد', 'وارد']],
  ['consumption', ['الاستهلاك', 'استهلاك', 'المصروف']]
];

/**
 * هيكل الكلمة بدون "ا" و"ل": ملفات PDF تستخرج الحرف المركّب "لا" معكوسًا ("الاستهلاك" ← "االستهالك")،
 * فتُطابق العناوين بعد حذف هذين الحرفين أيضًا.
 */
const skel = (s: string) => s.replace(/[ال\s]/g, '');

const matchLabel = (text: string): Metric | null => {
  const t = norm(text);
  for (const [m, names] of LABELS) if (names.some(n => t.includes(n))) return m;
  const k = skel(t);
  for (const [m, names] of LABELS) if (names.some(n => skel(n).length >= 3 && k.includes(skel(n)))) return m;
  return null;
};

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٬,\s]/g, '');
  if (!/\d/.test(s)) return null;
  const n = parseFloat(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** المواقع المعروفة: كلمة البحث في التقرير → مفتاح الموقع */
export interface SiteMatcher {
  key: string;
  /** كلمات تُطابق عنوان الموقف في التقرير (بعد التوحيد) */
  words: string[];
}

/** شبكة صفوف (كل صف = نصوص الخلايا) → قيم كل موقع */
const readGrid = (grid: unknown[][], sites: SiteMatcher[]): Record<string, BlackOilSiteReport> => {
  const out: Record<string, BlackOilSiteReport> = {};
  let current: string | null = null;
  // عنوان بلا رقم في نفس السطر (شائع في PDF): الرقم يُؤخذ من أول سطر أرقام بعده
  let pending: Metric | null = null;
  const put = (label: Metric, value: number) => {
    if (!current) return;
    const entry = (out[current] ??= { actual: null, program: null, capacity: null, empty: null, diff: null, inbound: null, consumption: null });
    if (entry[label] === null) entry[label] = value;
  };
  for (const row of grid) {
    const cells = (row || []).map(c => (typeof c === 'number' ? c : norm(c))).filter(c => c !== '');
    if (!cells.length) continue;
    const texts = cells.filter((c): c is string => typeof c === 'string' && !/^[\d.,\s-]+$/.test(c));
    const nums = cells.map(toNumber).filter((n): n is number => n !== null);
    const label = texts.map(matchLabel).find(Boolean) ?? null;
    if (!label) {
      // عنوان موقف: نص فيه اسم الموقع
      const site = sites.find(s => texts.some(t => s.words.some(w => t.includes(w))));
      if (site) { current = site.key; pending = null; continue; }
      // موقف/موقع آخر غير مطلوب (مثل "موقف الصحاري"): تتوقف القراءة حتى الموقف المعروف التالي
      if (texts.some(t => /^(موقف|موقع)\s/.test(t))) { current = null; pending = null; continue; }
      // سطر أرقام فقط: يعود لآخر عنوان بلا رقم
      if (pending && nums.length) { put(pending, nums[0]); pending = null; }
      continue;
    }
    if (nums.length) { put(label, nums[0]); pending = null; }
    else pending = label;
  }
  return out;
};

const readExcel = async (file: File) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const grid: unknown[][] = [];
  for (const name of wb.SheetNames) grid.push(...XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }));
  return grid;
};

const readPdf = async (file: File) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/'
  }).promise;
  const grid: unknown[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    type Item = { text: string; x: number; y: number };
    const items: Item[] = (content.items as { str?: string; transform?: number[] }[])
      .filter(it => it.str?.trim() && it.transform)
      .map(it => ({ text: it.str!.trim(), x: it.transform![4], y: it.transform![5] }));
    const lines: Item[][] = [];
    for (const it of [...items].sort((a, b) => b.y - a.y)) {
      const line = lines.find(l => Math.abs(l[0].y - it.y) <= 5);
      if (line) line.push(it); else lines.push([it]);
    }
    for (const l of lines) grid.push([...l].sort((a, b) => b.x - a.x).map(i => i.text));
  }
  return grid;
};

/** تاريخ التقرير (أول تاريخ في الملف: 29/09/2026 أو 2026/09/29) → YYYY/MM/DD */
const findDate = (grid: unknown[][]): string | null => {
  for (const row of grid) for (const c of row || []) {
    const t = String(c ?? '').trim();
    let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}/${m[2].padStart(2, '0')}/${m[1].padStart(2, '0')}`;
    m = t.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
    if (m) return `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
  }
  return null;
};

export interface BlackOilReportResult {
  sites: Record<string, BlackOilSiteReport>;
  /** تاريخ التقرير إن وُجد */
  date: string | null;
}

/** يعيد قيم كل موقع وُجد في التقرير (المفتاح = key الموقع) وتاريخ التقرير */
export const parseBlackOilReport = async (file: File, sites: SiteMatcher[]): Promise<BlackOilReportResult> => {
  const name = file.name.toLowerCase();
  let grid: unknown[][];
  if (name.endsWith('.pdf')) grid = await readPdf(file);
  else if (/\.(xlsx|xls|csv)$/.test(name)) grid = await readExcel(file);
  else throw new Error(i18n.t('common:fileImport.excelPdfOnly'));
  const result = readGrid(grid, sites);
  if (!Object.keys(result).length) throw new Error(i18n.t('common:fileImport.blackOilNoSites'));
  return { sites: result, date: findDate(grid) };
};
