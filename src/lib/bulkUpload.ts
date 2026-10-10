import { findReportDate } from './reportDate';
import { withPdf } from './pdfDoc';

/**
 * الرفع المتعدد (صفحة شركة الصحاري): حتى 5 ملفات مرة واحدة.
 * هنا: تحديد نوع كل ملف وتاريخه من محتواه، وترتيب التنفيذ. المعالجة نفسها في bulkProcess.ts
 * (بنفس دوال نافذة كل قسم).
 */
export type BulkKind = 'balance' | 'petrol' | 'tanks' | 'black-oil';
/** القسم في صفحة الصحاري وصلاحية تعديله */
export const BULK_KINDS: Record<BulkKind, { subtab: BulkKind; perm: string }> = {
  balance: { subtab: 'balance', perm: 'sahara.balance' },
  petrol: { subtab: 'petrol', perm: 'sahara.petrol' },
  tanks: { subtab: 'tanks', perm: 'sahara.tanks' },
  'black-oil': { subtab: 'black-oil', perm: 'sahara.black-oil' },
};
/** ترتيب المعالجة لنفس التاريخ: الخزانات قبل النفط الأسود فتُحفظ مناسيبها الجديدة مع سجل اليوم */
const KIND_ORDER: BulkKind[] = ['balance', 'petrol', 'tanks', 'black-oil'];

export const MAX_BULK_FILES = 5;
export const BULK_ACCEPT = '.pdf,.xlsx,.xlsm,.xls,.csv';

export type BulkStatus = 'ready' | 'active' | 'saved' | 'skipped';
/** ملف لا يُعالج: نوع غير معروف، ملف الاتحاد، أو بلا صلاحية تعديل قسمه */
export type BulkProblem = 'unknown' | 'etihad' | 'inbound' | 'no-permission' | 'unreadable';

export interface BulkItem {
  id: string;
  file: File;
  kind: BulkKind | null;
  date: string | null;
  problem?: BulkProblem;
  status: BulkStatus;
}

// ───── تحديد نوع الملف من محتواه ─────
const norm = (s: string) =>
  s.normalize('NFKC').replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/[ةھە]/g, 'ه').replace(/[ىی]/g, 'ي').replace(/ک/g, 'ك').toLowerCase();
/** بدون "ا" و"ل" والمسافات: PDF يستخرج "لا" معكوسة ("الاستهلاك" ← "االستهالك") */
const skel = (s: string) => norm(s).replace(/[ال\s]/g, '');

/** أسطر نص الملف (PDF أو Excel) لتحديد النوع والتاريخ */
const readLines = async (file: File): Promise<string[][]> => {
  if (/\.pdf$/i.test(file.name)) return withPdf(file, false, async pdf => {
    const lines: string[][] = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      const rows: { y: number; parts: string[] }[] = [];
      for (const it of content.items as { str?: string; transform?: number[] }[]) {
        if (!it.str?.trim() || !it.transform) continue;
        const y = it.transform[5];
        let row = rows.find(r => Math.abs(r.y - y) < 4);
        if (!row) rows.push(row = { y, parts: [] });
        row.parts.push(it.str.trim());
      }
      rows.sort((a, b) => b.y - a.y).forEach(r => lines.push([r.parts.join(' '), ...r.parts]));
    }
    return lines;
  });
  const XLSX = await import('xlsx');
  // النوع والتاريخ في أعلى الكشف: قراءة أول 3 أوراق وأول 300 صف فقط (القراءة الكاملة تثقل الهاتف)
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, sheets: [0, 1, 2], sheetRows: 300 });
  const lines: unknown[][] = [];
  for (const name of wb.SheetNames.slice(0, 3)) lines.push(...XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }));
  return lines.map(r => r.map(c => (c instanceof Date ? c : String(c ?? '')))) as string[][];
};

const has = (text: string, ...words: string[]) => words.some(w => text.includes(skel(w)));

/** النوع من علامات مميزة لكل كشف (الترتيب مهم: البنزين قبل الكاز لأن كليهما فيه "المدور السابق") */
export const detectKind = (allText: string): { kind: BulkKind | null; problem?: BulkProblem } => {
  const t = skel(allText);
  if (has(t, 'رقم الفوجر') && has(t, 'اسم السائق', 'رقم العجلة')) return { kind: null, problem: 'inbound' };
  if (has(t, 'last updated') && has(t, 'معدل السعر')) return { kind: null, problem: 'etihad' };
  if (has(t, 'موقف') && has(t, 'الرصيد الحقيقي', 'مستوى الفارغ')) return { kind: 'black-oil' };
  if (has(t, 'بنزين', 'بانزين') && has(t, 'المدور السابق', 'المصروف الفعلي')) return { kind: 'petrol' };
  if (has(t, 'المرسل الى المزارع', 'الرصيد التراكمي') || (has(t, 'المدور السابق') && has(t, 'المصروف اليومي للمولدات'))) return { kind: 'balance' };
  // ملف الخزانات: تُقرأ منه كميات خزانات النفط الأسود فقط
  // ("الرئيسي" في PDF تأتي مقسومة "الخزان الرئيس" + "ي" فلا يُعتمد عليها)
  if (has(t, 'مستوى الخزانات الرئيسية') && has(t, 'نسبة امتلاء')) return { kind: 'tanks' };
  return { kind: null, problem: 'unknown' };
};

export const inspectFile = async (file: File, canEdit: (perm: string) => boolean): Promise<BulkItem> => {
  const base = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, status: 'ready' as const };
  try {
    const lines = await readLines(file);
    const { kind, problem } = detectKind(lines.map(l => l.join(' ')).join('\n'));
    const date = findReportDate(lines);
    if (!kind) return { ...base, kind: null, date, problem };
    if (!canEdit(BULK_KINDS[kind].perm)) return { ...base, kind, date, problem: 'no-permission' };
    return { ...base, kind, date };
  } catch {
    return { ...base, kind: null, date: null, problem: 'unreadable' };
  }
};

/** الملفات الصالحة بالترتيب: حسب التاريخ (الرصيد السابق لكل يوم من اليوم الذي قبله)، ثم حسب القسم */
export const orderForRun = (items: BulkItem[]) =>
  items.filter(i => i.kind && !i.problem).sort((a, b) =>
    (a.date || '').localeCompare(b.date || '') || KIND_ORDER.indexOf(a.kind!) - KIND_ORDER.indexOf(b.kind!));
