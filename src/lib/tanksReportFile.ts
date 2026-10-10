/**
 * ملف الخزانات اليومي (Excel أو PDF): تُقرأ منه كميات 9 خزانات نفط أسود فقط ويُهمل الباقي:
 * "الخزان الرئيسي 1..6" (جدول مستوى الخزانات الرئيسية، عمود "الكمية")، ثم
 * "خزان رقم 1 و2 و4 ( نفط اسود )" (جدول خزانات الكاز، عمود "سعة الخزان").
 * بنفس الترتيب تُملأ خزانات قسم النفط الأسود للصحاري.
 */
export const TANKS_FILE_SLOTS = [
  { kind: 'main', no: 1 }, { kind: 'main', no: 2 }, { kind: 'main', no: 3 },
  { kind: 'main', no: 4 }, { kind: 'main', no: 5 }, { kind: 'main', no: 6 },
  { kind: 'gas', no: 1 }, { kind: 'gas', no: 2 }, { kind: 'gas', no: 4 }
] as const;

/** اسم الخزان كما في الملف (للملاحظات) */
export const slotLabel = (s: (typeof TANKS_FILE_SLOTS)[number]) =>
  s.kind === 'main' ? `الخزان الرئيسي ${s.no}` : `خزان رقم ${s.no} (نفط اسود)`;

const norm = (s: string) =>
  s.normalize('NFKC').replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/[ةھە]/g, 'ه').replace(/[ىی]/g, 'ي')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, ' ').trim();

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/[,،\s]/g, '');
  return s && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

const MAIN_RE = /الخزان\s*الرئيسي\s*(\d+)/;
const GAS_RE = /خزان\s*رقم\s*(\d+)\s*\(?\s*نفط\s*اسود/;

/**
 * من صفوف الورقة: عمود الكمية يُؤخذ من آخر صف عناوين فوق الخزان
 * ("الكمية" للخزانات الرئيسية، "سعة الخزان" لخزانات الكاز — وليس "سعة الخزان الكلية").
 * النتيجة بترتيب TANKS_FILE_SLOTS، و null لخزان غير موجود في الملف.
 */
export const parseTanksSheet = (rows: unknown[][]): (number | null)[] => {
  const found = new Map<string, number>();
  let mainCol = -1;
  let gasCol = -1;
  for (const row of rows) {
    const cells = row.map(c => norm(String(c ?? '')));
    const qty = cells.indexOf('الكميه');
    if (qty >= 0) mainCol = qty;
    const cap = cells.indexOf('سعه الخزان');
    if (cap >= 0) gasCol = cap;
    for (const c of cells) {
      const m = c.match(MAIN_RE);
      const g = !m && c.match(GAS_RE);
      const key = m ? `main:${m[1]}` : g ? `gas:${g[1]}` : null;
      const col = m ? mainCol : gasCol;
      if (!key || found.has(key) || col < 0) continue;
      const v = toNum(row[col]);
      if (v !== null) found.set(key, v);
      break;
    }
  }
  return TANKS_FILE_SLOTS.map(s => found.get(`${s.kind}:${s.no}`) ?? null);
};

/** نص PDF بموقعه الأفقي */
export interface PdfItem { str: string; x: number }

/** بدون "ا" و"ل" والمسافات: PDF يستخرج "لا" معكوسة */
const skel = (s: string) => norm(s).replace(/[ال\s]/g, '');
const pdfNum = (s: string) => (s.includes('%') ? null : toNum(norm(s)));

/**
 * PDF بلا أعمدة: في صف كل خزان تُرتّب الأرقام حسب بعدها عن اسم الخزان (يعمل يمينًا أو يسارًا).
 * الخزان الرئيسي: [مستوى الارتفاع، الكمية، …] ← الثاني. خزان الكاز (نفط أسود): [سعة الخزان، …] ← الأول.
 * النسب (%) تُهمل، ورقم الخزان إن جاء منفصلًا عن اسمه يُستبعد.
 */
export const parseTanksPdfRows = (rows: PdfItem[][]): (number | null)[] => {
  const found = new Map<string, number>();
  for (const row of rows) {
    // النصوص (الاسم قد يأتي مقسّمًا إلى عدة قطع)
    // بترتيب موقعها (يمين ← يسار، وبالعكس): "الخزان الرئيس" + "ي" تأتي مقسومة وبغير ترتيبها
    const texts = row.filter(it => pdfNum(it.str) === null && !it.str.includes('%')).sort((a, b) => b.x - a.x);
    const join = (list: PdfItem[]) => skel(list.map(it => it.str).join(' '));
    const words = `${join(texts)}|${join([...texts].reverse())}`;
    const kind = words.includes('خزنرئيسي') ? 'main' : words.includes('خزنرقم') && words.includes('نفطسود') ? 'gas' : null;
    const label = texts.find(it => /خزنرئيس|خزنرقم/.test(skel(it.str))) ?? texts.find(it => skel(it.str).includes('خزن'));
    if (!kind || !label) continue;
    const nums = row
      .filter(it => pdfNum(it.str) !== null)
      .map(it => ({ v: pdfNum(it.str)!, d: Math.abs(it.x - label.x), raw: it.str }))
      .sort((a, b) => a.d - b.d);
    // رقم الخزان: داخل نص الاسم، أو أقرب رقم صحيح صغير بجانبه
    let no = Number(norm(texts.map(it => it.str).join(' ')).match(/(\d+)/)?.[1] ?? NaN);
    if (Number.isNaN(no) && nums.length && Number.isInteger(nums[0].v) && nums[0].v <= 20 && !/[,.]/.test(nums[0].raw)) no = nums.shift()!.v;
    if (Number.isNaN(no)) continue;
    const key = `${kind}:${no}`;
    const v = nums[kind === 'main' ? 1 : 0]?.v;
    if (v !== undefined && !found.has(key)) found.set(key, v);
  }
  return TANKS_FILE_SLOTS.map(s => found.get(`${s.kind}:${s.no}`) ?? null);
};

const readPdf = async (file: File) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const rows: PdfItem[][] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    const page: { y: number; items: PdfItem[] }[] = [];
    for (const it of content.items as { str?: string; transform?: number[]; width?: number }[]) {
      if (!it.str?.trim() || !it.transform) continue;
      const y = it.transform[5];
      let row = page.find(r => Math.abs(r.y - y) < 4);
      if (!row) page.push(row = { y, items: [] });
      // منتصف النص أفقيًا
      row.items.push({ str: it.str.trim(), x: it.transform[4] + (it.width ?? 0) / 2 });
    }
    page.sort((a, b) => b.y - a.y).forEach(r => rows.push(r.items));
  }
  return parseTanksPdfRows(rows);
};

/** قراءة الملف: PDF، أو أول ورقة Excel فيها الخزانات */
export const readTanksReportFile = async (file: File): Promise<(number | null)[]> => {
  if (/\.pdf$/i.test(file.name)) return readPdf(file);
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  let best: (number | null)[] = TANKS_FILE_SLOTS.map(() => null);
  for (const name of wb.SheetNames) {
    const vals = parseTanksSheet(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }));
    if (vals.filter(v => v !== null).length > best.filter(v => v !== null).length) best = vals;
    if (vals.every(v => v !== null)) break;
  }
  return best;
};
