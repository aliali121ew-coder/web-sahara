import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { findReportDate } from './reportDate';

/**
 * الرفع المتعدد (صفحة شركة الصحاري): حتى 5 ملفات مرة واحدة.
 * لا يحفظ شيئًا بنفسه: يحدد نوع كل ملف من محتواه، ثم يفتح نافذة التسجيل العادية لقسمه
 * معبّأة من الملف (كأن المستخدم دخل التبويب ورفعه)، فيراجع ويحفظ، ثم ينتقل للملف التالي.
 * بهذا يمر كل ملف بنفس منطق الحفظ والتحقق وإرفاق الملف بالأرشيف تمامًا كالرفع اليدوي.
 */
export type BulkKind = 'balance' | 'petrol' | 'black-oil';
/** القسم في صفحة الصحاري وصلاحية تعديله */
export const BULK_KINDS: Record<BulkKind, { subtab: BulkKind; perm: string }> = {
  balance: { subtab: 'balance', perm: 'sahara.balance' },
  petrol: { subtab: 'petrol', perm: 'sahara.petrol' },
  'black-oil': { subtab: 'black-oil', perm: 'sahara.black-oil' },
};
/** ترتيب المعالجة لنفس التاريخ */
const KIND_ORDER: BulkKind[] = ['balance', 'petrol', 'black-oil'];

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
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
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
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
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

// ───── قائمة الانتظار (في الذاكرة فقط؛ الملفات لا تُحفظ إلا عبر نوافذ الأقسام) ─────
interface QueueState { items: BulkItem[]; running: boolean; claimed: string | null; finished: boolean }
let state: QueueState = { items: [], running: false, claimed: null, finished: false };
const listeners = new Set<() => void>();
const emit = (next: Partial<QueueState>) => { state = { ...state, ...next }; listeners.forEach(l => l()); };

const activate = (items: BulkItem[]) => {
  const next = items.find(i => i.status === 'ready');
  if (!next) return emit({ items, running: false, claimed: null, finished: true });
  emit({ items: items.map(i => (i.id === next.id ? { ...i, status: 'active' } : i)), running: true, claimed: null, finished: false });
};

export const bulkQueue = {
  get: () => state,
  start: (ordered: BulkItem[]) => activate(ordered.map(i => ({ ...i, status: 'ready' }))),
  active: () => state.items.find(i => i.status === 'active') ?? null,
  /** نافذة القسم تأخذ الملف مرة واحدة فقط (يمنع التعبئة المكررة عند إعادة العرض) */
  claim: (id: string) => {
    if (state.claimed === id) return false;
    emit({ claimed: id });
    return true;
  },
  /** انتهى الملف الحالي (حُفظ أو أُغلقت النافذة بدون حفظ) ← الملف التالي */
  finish: (id: string, status: 'saved' | 'skipped') => {
    if (!state.items.some(i => i.id === id && i.status === 'active')) return;
    activate(state.items.map(i => (i.id === id ? { ...i, status } : i)));
  },
  /** إيقاف: الملفات الباقية تُعلَّم "لم تُعالج" */
  stop: () => emit({ items: state.items.map(i => (i.status === 'ready' || i.status === 'active' ? { ...i, status: 'skipped' } : i)), running: false, claimed: null, finished: true }),
  /** إغلاق الملخص */
  clear: () => emit({ items: [], running: false, claimed: null, finished: false }),
};

export const useBulkQueue = () => {
  const [, rerender] = useState(0);
  useEffect(() => {
    const l = () => rerender(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state;
};

/**
 * لنافذة القسم: الملف المطلوب تعبئته الآن (مرة واحدة)، وإبلاغ القائمة عند إغلاق النافذة.
 * onOpen: يفتح نافذة تسجيل يوم جديد. fill: يعبّئها من الملف (بعد فتحها).
 */
export const useBulkSlot = (kind: BulkKind, enabled: boolean) => {
  const q = useBulkQueue();
  const active = enabled ? q.items.find(i => i.status === 'active' && i.kind === kind) ?? null : null;
  return {
    /** الملف النشط لهذا القسم ولم تأخذه النافذة بعد */
    pending: active && q.claimed !== active.id ? active : null,
    /** الملف الذي تعالجه النافذة الآن */
    current: active && q.claimed === active.id ? active : null,
  };
};

/**
 * ربط نافذة قسم بالرفع المتعدد. isOpen: هل نافذة التسجيل مفتوحة. open: يفتح يومًا جديدًا.
 * fill: يعبّئ النافذة المفتوحة من الملف (نفس دالة الرفع اليدوي).
 * عند إغلاق النافذة يُبلَّغ: "حُفظ" إن استُدعيت markSaved قبل الإغلاق، وإلا "تُرك".
 */
export const useBulkFill = (kind: BulkKind, enabled: boolean, isOpen: boolean, open: () => void, fill: (file: File) => void) => {
  const { pending } = useBulkSlot(kind, enabled);
  const idRef = useRef<string | null>(null);
  const openedRef = useRef(false);
  const savedRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const openRef = useRef(open);
  const fillRef = useRef(fill);
  useLayoutEffect(() => { openRef.current = open; fillRef.current = fill; });

  // ملف جديد لهذا القسم: فتح نافذة يوم جديد ثم تعبئتها بعد ظهورها
  useEffect(() => {
    if (!pending || !bulkQueue.claim(pending.id)) return;
    idRef.current = pending.id;
    openedRef.current = false;
    savedRef.current = false;
    openRef.current();
    setFile(pending.file);
  }, [pending]);
  useEffect(() => {
    if (!isOpen || !file) return;
    setFile(null);
    openedRef.current = true;
    fillRef.current(file);
  }, [isOpen, file]);
  // أُغلقت النافذة (حفظ أو إلغاء) ← الملف التالي
  useEffect(() => {
    if (isOpen || !openedRef.current || !idRef.current) return;
    const id = idRef.current;
    idRef.current = null;
    openedRef.current = false;
    bulkQueue.finish(id, savedRef.current ? 'saved' : 'skipped');
  }, [isOpen]);

  return { markSaved: () => { if (idRef.current) savedRef.current = true; } };
};
