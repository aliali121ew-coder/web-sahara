import i18n from '../i18n';
import { withPdf } from './pdfDoc';
import { findReportDate } from './reportDate';
import { fmtList } from '../i18n/format';
import type { SaharaReportExtraction } from './saharaReportUpload';

/**
 * قراءة الكشف اليومي لشركة الصحاري من ملف Excel أو PDF داخل المتصفح مباشرة (بدون ذكاء اصطناعي ولا خادم).
 * يبحث عن عناوين البنود (مثل "المصروف اليومي للمولدات") ويأخذ الرقم المجاور لها في نفس الصف،
 * ومن جدول "تفاصيل الكميات في الموقع" يأخذ اسم الموقع وعمود "الرصيد التراكمي".
 */

type NumberField = Exclude<keyof SaharaReportExtraction, 'stations' | 'notes' | 'tableTotal' | 'date'>;

const LABELS: Record<NumberField, string> = {
  generators: 'المصروف اليومي للمولدات',
  vehicles: 'المصروف اليومي للاليات',
  farms: 'المصروف اليومي للمزارع',
  sentToFarms: 'الرصيد المرسل الى المزارع',
  inboundInternal: 'الوارد الداخلي',
  inboundEtihad: 'وارد من الاتحاد',
  inboundExternal: 'الوارد الخارجي',
  previousCarried: 'المدور السابق',
  currentInFile: 'الرصيد الحالي'
};

/** اسم البند بلغة الواجهة (لملاحظة البنود الناقصة) */
const fieldName = (k: NumberField) => i18n.t(`common:fileImport.field.${k}`);

/** توحيد الكتابة العربية للمقارنة: بدون مسافات وتشكيل، وأ/إ/آ → ا، ة → ه، ى → ي (NFKC يفكّ أشكال العرض مثل ﻻ) */
export const normalizeArabic = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '');

/**
 * مفتاح مقارنة متسامح: بدون الألف واللام والهمزة، لأن ملفات PDF كثيرًا ما تخزّن "لا" كحرف مركّب
 * أو تعكس ترتيبه ("ال")، ولتطابق فروق مثل "الحجاج / الاحجاج".
 */
const looseKey = (s: string) => normalizeArabic(s).replace(/[الء]/g, '');

/** أسماء مواقع في الكشف تختلف عن اسمها في النظام */
const STATION_ALIASES: Record<string, string> = {
  النقل: 'الطاقة'
};

const stripPrefix = (s: string) => s.trim().replace(/^(محطة|موقع|معمل)\s+/, '');

/** مطابقة اسم موقع من الكشف مع أسماء محطات النظام (بدون كلمة محطة/موقع/معمل، ومع الأسماء البديلة) */
export const matchStation = (name: string, stationNames: string[]): string | null => {
  const base = stripPrefix(name);
  const target = Object.entries(STATION_ALIASES).find(([from]) => looseKey(from) === looseKey(base))?.[1] ?? base;
  return stationNames.find(n => looseKey(stripPrefix(n)) === looseKey(target)) ?? null;
};

/** تحويل نص إلى رقم (يقبل الأرقام العربية الهندية والفواصل) */
const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const t = v
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,،٬\s]/g, '')
    .replace(/٫/g, '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

const isLabel = (text: string, label: string) =>
  normalizeArabic(text) === normalizeArabic(label) || looseKey(text) === looseKey(label);
const hasLabel = (text: string, label: string) =>
  normalizeArabic(text).includes(normalizeArabic(label)) || looseKey(text).includes(looseKey(label));

const finish = (
  values: Partial<Record<NumberField, number>>,
  stations: { nameInImage: string; balance: number }[],
  stationNames: string[],
  tableTotal?: number,
  date?: string | null
): SaharaReportExtraction => {
  const missing = (Object.keys(LABELS) as NumberField[]).filter(k => values[k] === undefined);
  if (missing.length === Object.keys(LABELS).length && stations.length === 0) {
    throw new Error(i18n.t('common:fileImport.saharaNoItems'));
  }
  return {
    generators: values.generators ?? 0,
    vehicles: values.vehicles ?? 0,
    farms: values.farms ?? 0,
    sentToFarms: values.sentToFarms ?? 0,
    inboundInternal: values.inboundInternal ?? 0,
    inboundEtihad: values.inboundEtihad ?? 0,
    inboundExternal: values.inboundExternal ?? 0,
    previousCarried: values.previousCarried,
    currentInFile: values.currentInFile,
    tableTotal,
    date: date ?? undefined,
    stations: stations.map(s => ({ ...s, matchedStation: matchStation(s.nameInImage, stationNames) })),
    notes: [
      missing.length ? i18n.t('common:fileImport.missing', { list: fmtList(missing.map(fieldName)) }) : '',
      stations.length
        ? i18n.t('common:fileImport.sitesRead', { count: stations.length })
        : i18n.t('common:fileImport.noSitesTable')
    ].filter(Boolean).join(' — ')
  };
};

// ───────────── Excel ─────────────
const readExcel = async (file: File, stationNames: string[]) => {
  const XLSX = await import('xlsx');
  // cellDates: خلايا التاريخ تصل كتواريخ (لقراءة تاريخ الكشف)
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const values: Partial<Record<NumberField, number>> = {};
  const allRows: unknown[][] = [];
  const stations: { nameInImage: string; balance: number }[] = [];
  let tableTotal: number | undefined;

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
    allRows.push(...rows);

    // البنود: الرقم الأقرب للعنوان في نفس الصف
    rows.forEach(row => {
      row.forEach((cell, c) => {
        if (typeof cell !== 'string') return;
        const field = (Object.keys(LABELS) as NumberField[]).find(k => values[k] === undefined && isLabel(cell, LABELS[k]));
        if (!field) return;
        let best: { n: number; d: number } | null = null;
        row.forEach((other, c2) => {
          const n = toNumber(other);
          if (n !== null && c2 !== c && (!best || Math.abs(c2 - c) < best.d)) best = { n, d: Math.abs(c2 - c) };
        });
        if (best) values[field] = (best as { n: number }).n;
      });
    });

    // جدول المواقع: صف العناوين فيه "الرصيد التراكمي" و"موقع الخزان"
    if (stations.length) continue;
    rows.forEach((row, r) => {
      if (stations.length) return;
      const cumCol = row.findIndex(c => typeof c === 'string' && hasLabel(c, 'الرصيد التراكمي'));
      if (cumCol < 0) return;
      let nameCol = row.findIndex(c => typeof c === 'string' && (hasLabel(c, 'موقع') || hasLabel(c, 'الموقع')));
      for (let i = r + 1; i < rows.length; i++) {
        const cells = rows[i];
        if (nameCol < 0) nameCol = cells.findIndex(c => typeof c === 'string' && c.trim() !== '');
        const name = typeof cells[nameCol] === 'string' ? (cells[nameCol] as string).trim() : '';
        const balance = toNumber(cells[cumCol]);
        if (!name || balance === null) {
          if (stations.length) break; // نهاية الجدول
          continue;
        }
        if (/مجموع|اجمالي|إجمالي/.test(name)) break;
        stations.push({ nameInImage: name, balance });
      }
      // آخر خلية رقمية في عمود الرصيد التراكمي = إجمالي الجدول (الرصيد الحالي)
      for (let i = rows.length - 1; i > r; i--) {
        const n = toNumber(rows[i][cumCol]);
        if (n !== null) { tableTotal = n; break; }
      }
    });
  }
  return finish(values, stations, stationNames, tableTotal, findReportDate(allRows));
};

// ───────────── PDF ─────────────
export interface PdfItem { str: string; x: number; y: number; w: number }

/**
 * أسطر نص PDF لكل صفحة (مرتبة من الأعلى للأسفل)، كل سطر عناصره مع موضعها الأفقي.
 * مشتركة بين كشف الكاز وكشف البنزين.
 */
export const readPdfPages = (file: File): Promise<{ pages: PdfItem[][][]; anyText: boolean }> => withPdf(file, false, async pdf => {
  const pages: PdfItem[][][] = [];
  let anyText = false;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    let maxH = 0;
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const h = Math.abs(it.height || it.transform[3] || 0);
      maxH = Math.max(maxH, h);
      // المقارنة بمنتصف ارتفاع السطر لأن خط الأرقام وخط العربي قد يختلف خط أساسهما في نفس الصف
      const cy = it.transform[5] + h / 2;
      const tokens = it.str.trim().split(/\s+/);
      // خلية فيها عدة أرقام في نص واحد: تُقسَّم مع تقدير موضع كل جزء أفقيًا
      if (tokens.length > 1 && tokens.some(t => toNumber(t) !== null)) {
        const total = it.str.length || 1;
        let offset = 0;
        const text = it.str;
        for (const tok of tokens) {
          const idx = text.indexOf(tok, offset);
          offset = idx + tok.length;
          const f = (idx + tok.length / 2) / total;
          const frac = 'dir' in it && it.dir === 'rtl' ? 1 - f : f;
          items.push({ str: tok, x: it.transform[4] + it.width * frac - 1, y: cy, w: 2 });
        }
      } else {
        items.push({ str: it.str.trim(), x: it.transform[4], y: cy, w: it.width });
      }
    }
    if (items.length) anyText = true;

    // حروف تخرج منفصلة بعرض صفر (مثل "ن" آخر "التسمين") تُلحق بالكلمة الملاصقة لها؛
    // في النص العربي نهاية الكلمة عند طرفها الأيسر (x)
    for (const z of items) {
      if (z.w >= 0.5 || !z.str || toNumber(z.str) !== null) continue;
      const host = items
        .filter(i => i !== z && i.w >= 0.5 && i.str && toNumber(i.str) === null && Math.abs(i.y - z.y) < Math.max(8, maxH))
        .sort((a, b) => Math.abs(a.x - z.x) - Math.abs(b.x - z.x))[0];
      if (host && Math.abs(host.x - z.x) < 12) {
        host.str += z.str;
        z.str = '';
      }
    }
    for (let i = items.length - 1; i >= 0; i--) if (!items[i].str) items.splice(i, 1);

    // تجميع العناصر في أسطر حسب منتصف الارتفاع (بسماحية نسبةً لحجم الخط)
    const tol = Math.max(3, maxH * 0.45);
    const lines: PdfItem[][] = [];
    for (const it of [...items].sort((a, b) => b.y - a.y)) {
      const line = lines.find(l => Math.abs(l.reduce((a, i) => a + i.y, 0) / l.length - it.y) < tol);
      if (line) line.push(it); else lines.push([it]);
    }
    lines.sort((a, b) => b[0].y - a[0].y);
    pages.push(lines);
  }
  return { pages, anyText };
});

/** نص السطر من اليمين لليسار، والأرقام فيه مع منتصف موضعها الأفقي */
export const pdfLineText = (l: PdfItem[]) => [...l].sort((a, b) => b.x - a.x).map(i => i.str).join(' ');
export const pdfNumbersIn = (l: PdfItem[]) =>
  l.map(i => ({ n: toNumber(i.str), cx: i.x + i.w / 2 })).filter((v): v is { n: number; cx: number } => v.n !== null);

const readPdf = async (file: File, stationNames: string[]) => {
  const { pages, anyText } = await readPdfPages(file);
  const values: Partial<Record<NumberField, number>> = {};
  const stations: { nameInImage: string; balance: number }[] = [];
  let tableTotal: number | undefined;
  const lineText = pdfLineText;
  const numbersIn = pdfNumbersIn;

  for (const lines of pages) {
    // البنود
    for (const l of lines) {
      const text = lineText(l);
      const field = (Object.keys(LABELS) as NumberField[]).find(k => values[k] === undefined && hasLabel(text, LABELS[k]));
      const nums = numbersIn(l);
      if (field && nums.length) values[field] = nums[0].n;
    }

    // جدول المواقع (قد يمتد على عدة صفحات): سطر العناوين فيه "موقع الخزان" (عنوان "الرصيد التراكمي" قد يخرج مقطّعًا من PDF)
    const headerIdx = lines.findIndex(l => hasLabel(lineText(l), 'موقع الخزان') || hasLabel(lineText(l), 'التراكمي'));
    if (headerIdx < 0) continue;
    const cumItem = lines[headerIdx].find(i => hasLabel(i.str, 'تراكم'));
    const cumX = cumItem ? cumItem.x + cumItem.w / 2 : null;
    // الرصيد التراكمي: العمود المطابق لعنوانه، وإلا فآخر عمود في الجدول العربي (أقصى اليسار)
    const cumOf = (nums: { n: number; cx: number }[]) => cumX !== null
      ? nums.reduce((a, b) => (Math.abs(b.cx - cumX) < Math.abs(a.cx - cumX) ? b : a))
      : nums.reduce((a, b) => (b.cx < a.cx ? b : a));
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      const nums = numbersIn(l);
      if (!nums.length) continue;
      const name = l.filter(it => toNumber(it.str) === null).sort((a, b) => b.x - a.x).map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      // صف الإجمالي (بلا اسم أو باسم "المجموع"): آخر خلية في عمود الرصيد التراكمي
      if (!name || /مجموع|اجمالي|إجمالي/.test(name)) {
        if (nums.length >= 3) tableTotal = cumOf(nums).n;
        continue;
      }
      // المحطات والمعامل فقط (الجدول يكمل بالمزارع، وتلك ليست من محطات النظام)
      if (!matchStation(name, stationNames) && !/^(محطة|معمل|موقع)/.test(name)) continue;
      if (stations.some(s => s.nameInImage === name)) continue;
      stations.push({ nameInImage: name, balance: cumOf(nums).n });
    }
  }

  if (!anyText) throw new Error(i18n.t('common:fileImport.scannedPdf'));
  const date = findReportDate(pages.flatMap(lines => lines.map(l => [lineText(l), ...l.map(i => i.str)])));
  return finish(values, stations, stationNames, tableTotal, date);
};

export const isSpreadsheetOrPdf = (file: File) => /\.(xlsx|xlsm|xls|pdf)$/i.test(file.name);

export const readSaharaReportFile = (file: File, stationNames: string[]) =>
  /\.pdf$/i.test(file.name) ? readPdf(file, stationNames) : readExcel(file, stationNames);
