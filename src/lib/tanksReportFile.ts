/**
 * ملف الخزانات اليومي (Excel): تُقرأ منه كميات 9 خزانات نفط أسود فقط ويُهمل الباقي:
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

/** قراءة الملف: أول ورقة فيها الخزانات */
export const readTanksReportFile = async (file: File): Promise<(number | null)[]> => {
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
