/**
 * عرض ملف Excel كما يظهر عند طباعته (مثل PDF): للقراءة فقط، مع الخطوط والألوان والحدود
 * والخلايا المدمجة وعرض الأعمدة وارتفاع الصفوف واتجاه الورقة.
 * يُعرض "نطاق الطباعة" إن وُجد، وإلا النطاق المستخدم. الصور والمخططات لا تُعرض.
 */
import type { Cell, Worksheet, Borders, Border, Color, Fill } from 'exceljs';

export interface RenderedSheet {
  name: string;
  body: string; // جدول HTML للورقة (يُعرض داخل عنصر .xl-page مع excelSheetCss)
  landscape: boolean;
}

const MAX_ROWS = 3000;
const MAX_COLS = 150;

// ألوان ثيم Office الافتراضي (0 خلفية، 1 نص، ثم الألوان المميزة)
const THEME = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'];
// أشهر الألوان المفهرسة القديمة
const INDEXED: Record<number, string> = {
  8: '000000', 9: 'FFFFFF', 10: 'FF0000', 11: '00FF00', 12: '0000FF', 13: 'FFFF00', 14: 'FF00FF', 15: '00FFFF',
  22: 'C0C0C0', 23: '808080', 64: '000000'
};

const applyTint = (hex: string, tint = 0) => {
  if (!tint) return hex;
  const ch = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const out = ch.map(c => Math.round(tint < 0 ? c * (1 + tint) : c + (255 - c) * tint));
  return out.map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
};

const toCss = (color?: Partial<Color> & { indexed?: number; tint?: number }): string | null => {
  if (!color) return null;
  if (color.argb) return `#${color.argb.slice(-6)}`;
  if (color.theme !== undefined) return `#${applyTint(THEME[color.theme] ?? '000000', color.tint)}`;
  if (color.indexed !== undefined && INDEXED[color.indexed]) return `#${INDEXED[color.indexed]}`;
  return null;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// قيم الخصائص (style) مصدرها ملف Excel نفسه (اسم الخط، الألوان، المحاذاة) فتُهرَّب علامات الاقتباس أيضًا،
// وإلا أمكن لملف خبيث إغلاق الخاصية وحقن onmouseover وغيرها (XSS)
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// "S1:X154" أو "'اسم'!$S$1:$X$154" → حدود رقمية
const colNum = (letters: string) => letters.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const parseRange = (ref?: string) => {
  const m = ref?.replace(/\$/g, '').split('!').pop()?.split(',')[0].match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  return m ? { left: colNum(m[1]), top: +m[2], right: colNum(m[3]), bottom: +m[4] } : null;
};

/** تنسيق الرقم حسب تنسيق الخلية (الحالات الشائعة) */
const formatNumber = (v: number, fmt?: string) => {
  if (!fmt || fmt === 'General') return String(+v.toPrecision(11));
  const section = fmt.split(';')[v < 0 && fmt.includes(';') ? 1 : 0] ?? fmt;
  const decimals = (section.match(/\.(0+)/)?.[1].length) ?? 0;
  const isPct = section.includes('%');
  const n = Math.abs(isPct ? v * 100 : v);
  let s = n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: section.includes(',')
  });
  if (isPct) s += '%';
  const neg = v < 0 && !fmt.includes(';');
  return neg ? `-${s}` : s;
};

const formatDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
};

/**
 * حساب المعادلات البسيطة التي حُفظت بدون نتيجة (مثل =T6-P3 أو =SUM(A1:A5)):
 * مراجع الخلايا في نفس الورقة، + − × ÷ ^، الأقواس، و SUM/AVERAGE/MIN/MAX/ABS/ROUND.
 * أي معادلة أعقد تُترك فارغة بدل عرض قيمة خاطئة.
 */
const evaluateFormula = (ws: Worksheet, formula: string, seen = new Set<string>()): number | null => {
  const src = formula.replace(/\$/g, '').toUpperCase();
  let i = 0;
  const peek = () => src[i];
  const skip = () => { while (src[i] === ' ') i++; };
  const refValue = (addr: string): number | null => {
    if (seen.has(addr)) return null; // مرجع دائري
    const cell = ws.getCell(addr);
    const v = cell.value as unknown;
    if (typeof v === 'number') return v;
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'object' && !(v instanceof Date)) {
      const o = v as { result?: unknown };
      if (typeof o.result === 'number') return o.result;
      // cell.formula يترجم المعادلة المشتركة (sharedFormula) لهذه الخلية
      if (cell.formula) return evaluateFormula(ws, cell.formula, new Set([...seen, addr]));
    }
    return null;
  };
  const rangeValues = (a: string, b: string): number[] | null => {
    const m1 = a.match(/^([A-Z]+)(\d+)$/), m2 = b.match(/^([A-Z]+)(\d+)$/);
    if (!m1 || !m2) return null;
    const out: number[] = [];
    for (let r = Math.min(+m1[2], +m2[2]); r <= Math.max(+m1[2], +m2[2]); r++) {
      for (let c = Math.min(colNum(m1[1]), colNum(m2[1])); c <= Math.max(colNum(m1[1]), colNum(m2[1])); c++) {
        const v = refValue(ws.getCell(r, c).address);
        if (v === null) return null;
        out.push(v);
      }
    }
    return out;
  };
  const FUNCS: Record<string, (xs: number[]) => number> = {
    SUM: xs => xs.reduce((a, x) => a + x, 0),
    AVERAGE: xs => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0),
    MIN: xs => Math.min(...xs),
    MAX: xs => Math.max(...xs),
    ABS: xs => Math.abs(xs[0] ?? 0),
    ROUND: xs => { const p = 10 ** (xs[1] ?? 0); return Math.round((xs[0] ?? 0) * p) / p; }
  };
  const fail = () => { throw new Error('unsupported'); };

  const primary = (): number => {
    skip();
    if (peek() === '(') { i++; const v = expr(); skip(); if (peek() !== ')') fail(); i++; return v; }
    if (peek() === '-') { i++; return -primary(); }
    if (peek() === '+') { i++; return primary(); }
    const num = src.slice(i).match(/^\d+(\.\d+)?/);
    if (num) { i += num[0].length; return +num[0]; }
    const word = src.slice(i).match(/^[A-Z]+\d*/);
    if (!word) return fail();
    i += word[0].length;
    skip();
    if (peek() === '(') { // دالة
      const fn = FUNCS[word[0]];
      if (!fn) return fail();
      i++;
      const args: number[] = [];
      skip();
      while (peek() !== ')') {
        const range = src.slice(i).match(/^([A-Z]+\d+):([A-Z]+\d+)/);
        if (range) {
          i += range[0].length;
          const vals = rangeValues(range[1], range[2]);
          if (!vals) fail();
          args.push(...vals!);
        } else args.push(expr());
        skip();
        if (peek() === ',' || peek() === ';') i++;
        else if (peek() !== ')') fail();
        skip();
      }
      i++;
      return fn(args);
    }
    if (!/\d/.test(word[0])) return fail(); // اسم معرّف أو مرجع لورقة أخرى
    const v = refValue(word[0]);
    return v === null ? fail() : v;
  };
  const power = (): number => { let v = primary(); skip(); while (peek() === '^') { i++; v = v ** primary(); skip(); } return v; };
  const term = (): number => {
    let v = power(); skip();
    while (peek() === '*' || peek() === '/') { const op = src[i++]; const r = power(); v = op === '*' ? v * r : v / r; skip(); }
    return v;
  };
  const expr = (): number => {
    let v = term(); skip();
    while (peek() === '+' || peek() === '-') { const op = src[i++]; const r = term(); v = op === '+' ? v + r : v - r; skip(); }
    return v;
  };

  try {
    const v = expr();
    skip();
    return i === src.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
};

const cellText = (cell: Cell, ws: Worksheet): string => {
  let v: unknown = cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = v as { result?: unknown; formula?: string; richText?: { text: string }[]; text?: string; error?: string };
    if (o.result !== undefined && o.result !== null) v = o.result;
    else if (cell.formula) {
      // معادلة بلا نتيجة محفوظة: تُحسب إن كانت بسيطة
      const n = evaluateFormula(ws, cell.formula);
      return n === null ? '' : formatNumber(n, cell.numFmt);
    }
    else if (o.richText) return o.richText.map(r => r.text).join('');
    else if (o.text !== undefined) return String(o.text);
    else if (o.error) return o.error;
  }
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return formatDate(v);
  if (typeof v === 'number') return formatNumber(v, cell.numFmt);
  if (typeof v === 'object') return 'error' in v ? String((v as { error: string }).error) : '';
  return String(v);
};

const BORDER_CSS: Record<string, string> = {
  thin: '1px solid', hair: '1px solid', medium: '2px solid', thick: '3px solid', double: '3px double',
  dotted: '1px dotted', dashed: '1px dashed', mediumDashed: '2px dashed', dashDot: '1px dashed',
  mediumDashDot: '2px dashed', dashDotDot: '1px dotted', mediumDashDotDot: '2px dotted', slantDashDot: '2px dashed'
};
const borderCss = (b?: Partial<Border>) => (b?.style ? `${BORDER_CSS[b.style] ?? '1px solid'} ${toCss(b.color) ?? '#000'}` : null);

const cellStyle = (cell: Cell, isRtl: boolean): string => {
  const css: string[] = [];
  const f = cell.font || {};
  if (f.bold) css.push('font-weight:700');
  if (f.italic) css.push('font-style:italic');
  if (f.underline) css.push('text-decoration:underline');
  if (f.size) css.push(`font-size:${(f.size * 4) / 3}px`);
  if (f.name) css.push(`font-family:'${String(f.name).replace(/[^\p{L}\p{N} _-]/gu, '')}',Calibri,'Cairo',sans-serif`);
  const fc = toCss(f.color);
  if (fc) css.push(`color:${fc}`);

  const fill = cell.fill as Fill & { pattern?: string; fgColor?: Color };
  if (fill?.type === 'pattern' && fill.pattern && fill.pattern !== 'none') {
    const bg = toCss(fill.fgColor);
    if (bg) css.push(`background:${bg}`);
  }

  const a = cell.alignment || {};
  const isNum = typeof cell.value === 'number' || (typeof cell.value === 'object' && cell.value !== null && typeof (cell.value as { result?: unknown }).result === 'number');
  // المحاذاة العامة في Excel: الأرقام لنهاية السطر والنص لبدايته
  const h = a.horizontal && (a.horizontal as string) !== 'general'
    ? a.horizontal
    : isNum ? (isRtl ? 'left' : 'right') : (isRtl ? 'right' : 'left');
  css.push(`text-align:${h === 'centerContinuous' || h === 'distributed' ? 'center' : h === 'fill' || h === 'justify' ? 'justify' : h}`);
  css.push(`vertical-align:${a.vertical === 'middle' ? 'middle' : a.vertical === 'top' ? 'top' : 'bottom'}`);
  css.push(a.wrapText ? 'white-space:pre-wrap' : 'white-space:nowrap');

  const b = (cell.border || {}) as Partial<Borders>;
  const sides: [keyof Borders, string][] = [['top', 'top'], ['bottom', 'bottom'], [isRtl ? 'right' : 'left', 'left'], [isRtl ? 'left' : 'right', 'right']];
  for (const [side, cssSide] of sides) {
    const v = borderCss(b[side] as Border | undefined);
    if (v) css.push(`border-${cssSide}:${v}`);
  }
  return css.join(';');
};

const renderSheet = (ws: Worksheet): string => {
  const isRtl = !!ws.views?.[0]?.rightToLeft;
  const dims = ws.dimensions as unknown as { top: number; left: number; bottom: number; right: number } | undefined;
  const area = parseRange(ws.pageSetup?.printArea) ?? (dims && dims.bottom ? dims : null);
  if (!area) return '<p class="empty">الورقة فارغة</p>';
  const top = area.top, left = area.left;
  const bottom = Math.min(area.bottom, top + MAX_ROWS - 1);
  const right = Math.min(area.right, left + MAX_COLS - 1);

  // الخلايا المدمجة: الخلية الرئيسية تأخذ الامتداد، والباقي يُتخطّى
  const spans = new Map<string, { rs: number; cs: number }>();
  const covered = new Set<string>();
  for (const ref of (ws.model as { merges?: string[] }).merges || []) {
    const r = parseRange(ref);
    if (!r) continue;
    spans.set(`${r.top}:${r.left}`, { rs: r.bottom - r.top + 1, cs: r.right - r.left + 1 });
    for (let y = r.top; y <= r.bottom; y++) for (let x = r.left; x <= r.right; x++) if (y !== r.top || x !== r.left) covered.add(`${y}:${x}`);
  }

  const cols: number[] = [];
  const colWidths: string[] = [];
  for (let c = left; c <= right; c++) {
    const col = ws.getColumn(c);
    if (col.hidden) continue;
    cols.push(c);
    colWidths.push(`<col style="width:${Math.round((col.width ?? 8.43) * 7 + 5)}px">`);
  }

  const rows: string[] = [];
  for (let r = top; r <= bottom; r++) {
    const row = ws.getRow(r);
    if (row.hidden) continue;
    const cells: string[] = [];
    for (const c of cols) {
      const key = `${r}:${c}`;
      if (covered.has(key)) continue;
      const cell = row.getCell(c);
      const span = spans.get(key);
      // امتداد الدمج مع استبعاد الأعمدة المخفية
      const cs = span ? cols.filter(x => x >= c && x < c + span.cs).length : 1;
      const attrs = span ? ` rowspan="${span.rs}" colspan="${cs}"` : '';
      cells.push(`<td${attrs} style="${escAttr(cellStyle(cell, isRtl))}">${esc(cellText(cell, ws))}</td>`);
    }
    rows.push(`<tr style="height:${Math.round(((row.height ?? 15) * 4) / 3)}px">${cells.join('')}</tr>`);
  }

  return `<table dir="${isRtl ? 'rtl' : 'ltr'}"><colgroup>${colWidths.join('')}</colgroup><tbody>${rows.join('')}</tbody></table>`;
};

/**
 * نسخة خفيفة من الملف: الخلايا والأنماط فقط. ملفات Excel قد تحمل آلاف عناصر الحبر والرسومات
 * (ملف واحد فيه 12 ألف عنصر حبر ورسم 20MB) تجعل التحميل بطيئًا جدًا، ولا نعرضها أصلًا.
 */
const KEEP_PART = /^(\[Content_Types\]\.xml|_rels\/\.rels|xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/styles\.xml|xl\/sharedStrings\.xml|xl\/theme\/[^/]+\.xml|xl\/worksheets\/sheet\d+\.xml)$/;
const SHEET_LINKS = ['drawing', 'legacyDrawing', 'legacyDrawingHF', 'controls', 'picture', 'oleObjects', 'tableParts'];

const slimWorkbook = async (data: ArrayBuffer): Promise<Uint8Array> => {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(data);
  const out = new JSZip();
  for (const name of Object.keys(zip.files)) {
    if (!KEEP_PART.test(name)) continue;
    let xml = await zip.file(name)!.async('string');
    if (name.startsWith('xl/worksheets/')) {
      // روابط الورقة للأجزاء المحذوفة (الرسومات، الصور، الجداول، أدوات التحكم)
      for (const tag of SHEET_LINKS) {
        xml = xml
          .replace(new RegExp(`<${tag}[ >][\\s\\S]*?</${tag}>`, 'g'), '')
          .replace(new RegExp(`<${tag}( [^>]*)?/>`, 'g'), '');
      }
    } else if (name === '[Content_Types].xml') {
      xml = xml.replace(/<Override [^>]*\/>/g, m =>
        /PartName="\/(xl\/(workbook|styles|sharedStrings|theme\/|worksheets\/sheet)|docProps)/.test(m) ? m : '');
    }
    out.file(name, xml);
  }
  return out.generateAsync({ type: 'uint8array', compression: 'STORE' });
};

// الأوراق المعروضة سابقًا (فتح الملف مرة ثانية فوري)
const cache = new Map<string, RenderedSheet[]>();

export const renderExcel = async (data: ArrayBuffer, cacheKey?: string): Promise<RenderedSheet[]> => {
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey)!;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  let slim: Uint8Array | null = null;
  try {
    slim = await slimWorkbook(data);
  } catch {
    slim = null; // ملف غير اعتيادي (مثل .xls القديم): يُحمَّل كما هو
  }
  // Uint8Array مقبول في exceljs.load رغم أن تعريفه يذكر Buffer فقط
  await wb.xlsx.load((slim ?? data) as unknown as ArrayBuffer);
  const sheets = renderWorkbook(wb);
  if (cacheKey) cache.set(cacheKey, sheets);
  return sheets;
};

/** تنسيق ورقة Excel: `scope` يحصر القواعد داخل حاوية الورقة في الصفحة، وبدونه للطباعة */
export const excelSheetCss = (scope = '') => `
  ${scope} .xl-page{background:#fff;padding:28px;font-family:Calibri,'Cairo',sans-serif;font-size:14.67px;color:#000;line-height:normal;}
  ${scope} .xl-page table{border-collapse:collapse;table-layout:fixed;}
  ${scope} .xl-page td{padding:0 4px;overflow:hidden;text-overflow:clip;line-height:1.2;}
  ${scope} .xl-page td.xl-hit{box-shadow:inset 0 0 0 999px rgba(250,204,21,.45);}
  ${scope} .xl-page td.xl-hit-current{box-shadow:inset 0 0 0 999px rgba(249,115,22,.6);outline:2px solid #ea580c;}
  ${scope} .xl-page .empty{text-align:center;color:#64748b;font:600 14px sans-serif;padding:40px}
`;

const renderWorkbook = (wb: import('exceljs').Workbook): RenderedSheet[] =>
  wb.worksheets
    .filter(ws => ws.state !== 'hidden' && ws.state !== 'veryHidden')
    .map(ws => {
      let body: string;
      try {
        body = renderSheet(ws);
      } catch {
        body = '<p class="empty">تعذّر عرض هذه الورقة</p>';
      }
      return { name: ws.name, body, landscape: ws.pageSetup?.orientation === 'landscape' };
    });
