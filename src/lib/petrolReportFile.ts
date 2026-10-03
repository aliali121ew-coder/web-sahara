import { normalizeArabic, matchStation, readPdfPages, pdfLineText, pdfNumbersIn, PdfItem } from './saharaReportFile';

/**
 * قراءة كشف البنزين اليومي (Excel أو PDF) داخل المتصفح.
 *
 * شكل الكشف:
 * - جدول المحطات: المحطات | المدور السابق | المصروف الفعلي | الوارد | الرصيد الحالي | ملاحظات
 *   → "المصروف الفعلي" لكل محطة = الاستهلاك اليومي، و"الرصيد الحالي" = رصيد المحطة.
 * - البنود المفردة: "وارد خارجي" = الوارد، و"وارد داخلي" = الوارد الداخلي، و"المدور السابق" = الرصيد السابق (الافتتاحي).
 * - جداول جانبية (مبيعات/الكمية، الوارد/الكمية) في نفس الأسطر تُتجاهل.
 */
export interface PetrolReportExtraction {
  inboundQty?: number;
  inboundInternal?: number;
  inboundPrice?: number;
  previous?: number;
  stations: { nameInFile: string; matched: string | null; consumption?: number; balance?: number }[];
  notes: string;
}

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const t = v
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,،٬\s]/g, '')
    .replace(/٫/g, '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

const has = (text: unknown, ...labels: string[]) =>
  typeof text === 'string' && labels.some(l => normalizeArabic(text).includes(normalizeArabic(l)));

/** مفتاح متسامح (بدون الألف واللام والهمزة) لأن PDF قد يخزّن "لا" كحرف مركّب أو يعكس ترتيبه */
const looseKey = (s: string) => normalizeArabic(s).replace(/[الء]/g, '');

// عناوين الأعمدة بالأولوية (الأدق أولًا)
const NAME_HEADERS = ['اسم المحطة', 'المحطات', 'المحطة', 'الموقع'];
const CONSUMPTION_HEADERS = ['المصروف الفعلي', 'الاستهلاك', 'المصروف'];
const BALANCE_HEADERS = ['الرصيد الحالي', 'الرصيد التراكمي', 'المتبقي'];

// البنود المفردة: الوارد = الخارجي فقط (الداخلي لا يُحتسب)
const SINGLE_FIELDS: [keyof Omit<PetrolReportExtraction, 'stations' | 'notes'>, string[]][] = [
  ['inboundQty', ['وارد خارجي', 'الوارد الخارجي']],
  ['inboundInternal', ['وارد داخلي', 'الوارد الداخلي']],
  ['previous', ['المدور السابق']],
  ['inboundPrice', ['سعر الشراء', 'سعر اللتر']]
];

/** أول خانة تطابق أعلى عنوان أولوية */
const findByPriority = <T,>(cells: T[], labels: string[], text: (c: T) => unknown): number => {
  for (const l of labels) {
    const i = cells.findIndex(c => has(text(c), l));
    if (i >= 0) return i;
  }
  return -1;
};

const finish = (result: PetrolReportExtraction): PetrolReportExtraction => {
  const matchedCount = result.stations.filter(s => s.matched).length;
  if (!result.stations.length && result.inboundQty === undefined) {
    throw new Error('لم يُعثر على جدول المحطات أو بنود الوارد في الملف — تأكد أنه كشف البنزين اليومي');
  }
  const noNumbers = result.stations.filter(s => s.consumption === undefined && s.balance === undefined).length;
  result.notes = [
    result.stations.length ? `قُرئت ${matchedCount} محطة من ${result.stations.length}` : 'لم يُعثر على جدول المحطات',
    noNumbers ? `لم تُقرأ أرقام ${noNumbers} محطة (عمودا المصروف الفعلي والرصيد الحالي)` : '',
    result.inboundQty === undefined ? 'لم يُعثر على: وارد خارجي' : ''
  ].filter(Boolean).join(' — ');
  return result;
};

const addStation = (
  result: PetrolReportExtraction,
  seen: Set<string>,
  stationNames: string[],
  name: string,
  consumption?: number,
  balance?: number
) => {
  const clean = name.replace(/^\d+\s*/, '').trim();
  const matched = matchStation(clean, stationNames);
  const key = matched ?? clean;
  if (seen.has(key)) return;
  seen.add(key);
  result.stations.push({ nameInFile: clean, matched, consumption, balance });
};

// ───────────── PDF ─────────────
const readPdf = async (file: File, stationNames: string[]): Promise<PetrolReportExtraction> => {
  const { pages, anyText } = await readPdfPages(file);
  if (!anyText) throw new Error('ملف PDF هذا صورة ممسوحة بلا نص — استخدم ملف Excel أو الإدخال اليدوي');
  const result: PetrolReportExtraction = { stations: [], notes: '' };
  const seen = new Set<string>();
  const center = (i: PdfItem) => i.x + i.w / 2;

  for (const lines of pages) {
    // جدول المحطات: سطر عناوين فيه عمود المحطات والمصروف الفعلي أو الرصيد الحالي
    const headerIdx = lines.findIndex(l => {
      const t = pdfLineText(l);
      return has(t, ...NAME_HEADERS) && (has(t, ...CONSUMPTION_HEADERS) || has(t, ...BALANCE_HEADERS));
    });
    if (headerIdx >= 0 && !result.stations.length) {
      const header = lines[headerIdx];
      // عناوين PDF قد تخرج مقطّعة ("الرصيد" و"الحالي" في عنصرين) أو معكوسة الحروف، فتُطابق بكلمة مميزة
      const at = (labels: string[], words: string[], avoid: string[] = []) => {
        const i = findByPriority(header, labels, it => it.str);
        if (i >= 0) return center(header[i]);
        const hit = header.find(it => {
          const k = looseKey(it.str);
          const r = looseKey([...it.str].reverse().join(''));
          const ok = (w: string) => k.includes(looseKey(w)) || r.includes(looseKey(w));
          return words.some(ok) && !avoid.some(ok);
        });
        return hit ? center(hit) : null;
      };
      const nameX = at(NAME_HEADERS, ['محطات', 'محطة']);
      const consX = at(CONSUMPTION_HEADERS, ['مصروف', 'فعلي'], ['كلي']);
      const balX = at(BALANCE_HEADERS, ['حالي', 'رصيد'], ['سابق', 'مدور']);
      // حدود الجدول أفقيًا من عناوينه (لتجاهل الجداول الجانبية في نفس السطر)
      const xs = [nameX, consX, balX].filter((x): x is number => x !== null);
      // (إن لم يُعرف إلا عمود المحطات: الجدول كله يساره، والجداول الجانبية يمينه)
      const span = xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0;
      const lo = xs.length > 1 ? Math.min(...xs) - span * 0.35 : -Infinity;
      const hi = xs.length > 1 ? Math.max(...xs) + span * 0.35 : (nameX ?? Infinity) + 60;

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const l = lines[i].filter(it => center(it) >= lo && center(it) <= hi);
        const nums = pdfNumbersIn(l);
        const texts = l.filter(it => pdfNumbersIn([it]).length === 0);
        if (!texts.length || !nums.length) continue;
        // اسم المحطة: النص الأقرب لعمود "المحطات"
        const nameItem = nameX === null
          ? [...texts].sort((a, b) => b.x - a.x)[0]
          : texts.reduce((a, b) => (Math.abs(center(b) - nameX) < Math.abs(center(a) - nameX) ? b : a));
        const name = nameItem.str.trim();
        if (/مجموع|اجمالي|إجمالي/.test(name)) break;
        const nearest = (x: number | null) => (x === null ? undefined : nums.reduce((a, b) => (Math.abs(b.cx - x) < Math.abs(a.cx - x) ? b : a)).n);
        // احتياط بترتيب الأعمدة (من اليمين): المدور السابق، المصروف الفعلي، الوارد، الرصيد الحالي
        const byPos = [...nums].sort((a, b) => b.cx - a.cx).map(v => v.n);
        const consumption = consX !== null ? nearest(consX) : byPos.length >= 4 ? byPos[1] : undefined;
        const balance = balX !== null ? nearest(balX) : byPos.length >= 4 ? byPos[3] : undefined;
        addStation(result, seen, stationNames, name, consumption, balance);
      }
    }

    // البنود المفردة: أقرب رقم لعنوانها في نفس السطر
    for (const l of lines) {
      for (const [k, labels] of SINGLE_FIELDS) {
        if (result[k] !== undefined) continue;
        const label = l.find(it => has(it.str, ...labels));
        if (!label) continue;
        const cx = center(label);
        // تجاهل أرقام الجداول الجانبية: رقم أقرب عنصر بعده (بعيدًا عن العنوان) نصٌّ = خانة "اسم | كمية"
        const nums = pdfNumbersIn(l).filter(v => {
          const dir = v.cx > cx ? 1 : -1;
          const beyond = l.filter(it => (center(it) - v.cx) * dir > 1).sort((a, b) => Math.abs(center(a) - v.cx) - Math.abs(center(b) - v.cx))[0];
          return !beyond || pdfNumbersIn([beyond]).length > 0;
        });
        if (!nums.length) continue;
        result[k] = nums.reduce((a, b) => (Math.abs(b.cx - cx) < Math.abs(a.cx - cx) ? b : a)).n;
      }
    }
  }
  return finish(result);
};

// ───────────── Excel ─────────────
const readExcel = async (file: File, stationNames: string[]): Promise<PetrolReportExtraction> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const result: PetrolReportExtraction = { stations: [], notes: '' };
  const seen = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });

    // 1) جدول المحطات
    for (let r = 0; r < rows.length && !result.stations.length; r++) {
      const row = rows[r];
      const nameCol = findByPriority(row, NAME_HEADERS, c => c);
      if (nameCol < 0) continue;
      const consCol = findByPriority(row, CONSUMPTION_HEADERS, c => c);
      const balCol = findByPriority(row, BALANCE_HEADERS, c => c);
      if (consCol < 0 && balCol < 0) continue;
      for (let i = r + 1; i < rows.length; i++) {
        const cells = rows[i];
        const name = typeof cells[nameCol] === 'string' ? (cells[nameCol] as string).trim() : '';
        if (!name) {
          if (result.stations.length) break; // نهاية الجدول
          continue;
        }
        if (/مجموع|اجمالي|إجمالي/.test(name)) break;
        const consumption = consCol >= 0 ? toNumber(cells[consCol]) ?? undefined : undefined;
        const balance = balCol >= 0 ? toNumber(cells[balCol]) ?? undefined : undefined;
        if (consumption === undefined && balance === undefined) continue;
        addStation(result, seen, stationNames, name, consumption, balance);
      }
    }

    // 2) البنود المفردة: الرقم الأقرب للعنوان في نفس الصف
    rows.forEach(row => {
      row.forEach((cell, c) => {
        if (typeof cell !== 'string') return;
        const field = SINGLE_FIELDS.find(([k, labels]) => result[k] === undefined && has(cell, ...labels))?.[0];
        if (!field) return;
        // الرقم الأقرب للعنوان، مع تجاهل أرقام الجداول الجانبية في نفس الصف:
        // رقم يليه (بعيدًا عن العنوان) نص = خانة "اسم | كمية" من جدول جانبي
        const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';
        const partOfSideTable = (c2: number) => {
          const step = c2 > c ? 1 : -1;
          for (let j = c2 + step; j >= 0 && j < row.length; j += step) {
            if (!filled(row[j])) continue;
            return toNumber(row[j]) === null;
          }
          return false;
        };
        let best: { n: number; d: number } | null = null;
        row.forEach((other, c2) => {
          const n = toNumber(other);
          if (n === null || c2 === c || partOfSideTable(c2)) return;
          if (!best || Math.abs(c2 - c) < best.d) best = { n, d: Math.abs(c2 - c) };
        });
        if (best) result[field] = (best as { n: number }).n;
      });
    });
  }
  return finish(result);
};

export const readPetrolReportFile = async (file: File, stationNames: string[]): Promise<PetrolReportExtraction> => {
  if (/\.pdf$/i.test(file.name)) return readPdf(file, stationNames);
  if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) throw new Error('يُقبل ملف Excel أو PDF فقط');
  return readExcel(file, stationNames);
};
