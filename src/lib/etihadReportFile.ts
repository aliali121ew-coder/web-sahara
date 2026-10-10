import i18n from '../i18n';
import { withPdf } from './pdfDoc';

/**
 * قراءة كشف وقود الاتحاد اليومي (PDF أو Excel) لتعبئة نافذة "تسجيل حركة رصيد" تلقائيًا.
 * الكشف صف عناوين ثم صف قيم:
 * الرصيد السابق | الاستهلاك | المبيعات | الوارد | الرصيد الحالي | معدل السعر — مع "LAST UPDATED: 2026-10-07".
 */
export interface EtihadReportExtraction {
  previous: number | null;
  inbound: number | null;
  consumption: number | null;
  sales: number | null;
  current: number | null;
  price: number | null;
  /** تاريخ الكشف YYYY/MM/DD إن وُجد */
  date: string | null;
}

type Field = Exclude<keyof EtihadReportExtraction, 'date'>;

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/[ةھە]/g, 'ه').replace(/[ىی]/g, 'ي').replace(/ک/g, 'ك')
    .replace(/\s+/g, ' ').trim();

/** هيكل الكلمة بدون "ا" و"ل": PDF يستخرج "لا" معكوسة ("الاستهلاك" ← "االستهالك") */
const skel = (s: string) => norm(s).replace(/[ال\s]/g, '');

// الترتيب مهم: "الرصيد السابق" و"الرصيد الحالي" قبل أي تطابق عام
const LABELS: [Field, string[]][] = [
  ['previous', ['الرصيد السابق', 'السابق', 'المدور']],
  ['current', ['الرصيد الحالي', 'الحالي', 'المتبقي']],
  ['consumption', ['الاستهلاك', 'استهلاك', 'المصروف', 'مصروف']],
  ['sales', ['المبيعات', 'مبيعات']],
  ['inbound', ['الوارد', 'وارد', 'المشتريات']],
  ['price', ['معدل السعر', 'السعر']]
];

const matchField = (text: string): Field | null => {
  const t = norm(text);
  const k = skel(t);
  for (const [f, names] of LABELS) if (names.some(n => t.includes(n) || (skel(n).length >= 3 && k.includes(skel(n))))) return f;
  return null;
};

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٬,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
};

const findDate = (texts: string[]): string | null => {
  for (const raw of texts) {
    const t = raw.trim();
    let m = t.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
    if (m) return `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
    m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (m) return `${m[3]}/${m[2].padStart(2, '0')}/${m[1].padStart(2, '0')}`;
  }
  return null;
};

const empty = (): EtihadReportExtraction => ({ previous: null, inbound: null, consumption: null, sales: null, current: null, price: null, date: null });

/** عنصر نص في سطر PDF مع منتصف موضعه الأفقي */
export interface EtihadPdfItem { text: string; cx: number }

/**
 * أسطر PDF (من الأعلى للأسفل): كل كلمة عنوان تُنسب لأقرب رقم أفقيًا في سطر القيم الذي تحتها،
 * فتتكوّن تسمية كل عمود من كلماته (العناوين قد تُستخرج كلمات منفصلة).
 */
export const parseEtihadPdfLines = (lines: EtihadPdfItem[][]): EtihadReportExtraction => {
  const out = empty();
  out.date = findDate(lines.flat().map(i => i.text));
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].filter(it => toNumber(it.text) === null);
    if (header.filter(it => matchField(it.text)).length < 3) continue;
    const valuesLine = lines.slice(i + 1).find(l => l.filter(it => toNumber(it.text) !== null).length >= 3);
    if (!valuesLine) continue;
    const nums = valuesLine.map(it => ({ n: toNumber(it.text), cx: it.cx })).filter((v): v is { n: number; cx: number } => v.n !== null);
    const words: string[][] = nums.map(() => []);
    for (const w of [...header].sort((a, b) => b.cx - a.cx)) {
      let best = 0;
      nums.forEach((v, j) => { if (Math.abs(v.cx - w.cx) < Math.abs(nums[best].cx - w.cx)) best = j; });
      words[best].push(w.text);
    }
    nums.forEach((v, j) => {
      const f = matchField(words[j].join(' '));
      if (f && out[f] === null) out[f] = v.n;
    });
    break;
  }
  return out;
};

/** شبكة Excel: صف العناوين ثم أول صف أرقام تحته، بنفس رقم العمود */
export const parseEtihadGrid = (grid: unknown[][]): EtihadReportExtraction => {
  const out = empty();
  out.date = findDate(grid.flat().map(c => String(c ?? '')));
  for (let i = 0; i < grid.length; i++) {
    const fields = (grid[i] || []).map(c => (typeof c === 'string' ? matchField(c) : null));
    if (fields.filter(Boolean).length < 3) continue;
    const values = grid.slice(i + 1).find(r => (r || []).filter(c => toNumber(c) !== null).length >= 3);
    if (!values) continue;
    fields.forEach((f, j) => {
      const n = toNumber(values[j]);
      if (f && n !== null && out[f] === null) out[f] = n;
    });
    break;
  }
  return out;
};

const readPdfLines = (file: File): Promise<EtihadPdfItem[][]> => withPdf(file, true, async pdf => {
  const lines: (EtihadPdfItem & { y: number })[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    const items = (content.items as { str?: string; transform?: number[]; width?: number }[])
      .filter(it => it.str?.trim() && it.transform)
      .map(it => ({ text: it.str!.trim(), cx: it.transform![4] + (it.width || 0) / 2, y: it.transform![5] - p * 10000 }));
    for (const it of items.sort((a, b) => b.y - a.y)) {
      const line = lines.find(l => Math.abs(l[0].y - it.y) <= 5);
      if (line) line.push(it); else lines.push([it]);
    }
  }
  return lines;
});

const readGrid = async (file: File): Promise<unknown[][]> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const grid: unknown[][] = [];
  for (const name of wb.SheetNames) grid.push(...XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }));
  return grid;
};

export const readEtihadReportFile = async (file: File): Promise<EtihadReportExtraction> => {
  const name = file.name.toLowerCase();
  let r: EtihadReportExtraction;
  if (name.endsWith('.pdf')) r = parseEtihadPdfLines(await readPdfLines(file));
  else if (/\.(xlsx|xlsm|xls|csv)$/.test(name)) r = parseEtihadGrid(await readGrid(file));
  else throw new Error(i18n.t('common:fileImport.excelPdfOnly'));
  if (r.inbound === null && r.consumption === null && r.sales === null) throw new Error(i18n.t('finance:tx.upload.noFields'));
  return r;
};
