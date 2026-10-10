/**
 * تاريخ الكشف من محتوى ملف (نصوص الخلايا أو أسطر PDF): أول تاريخ صالح بأي صيغة شائعة
 * (2026/10/07، 2026-10-07، 07/10/2026، 7.10.2026) أو خلية تاريخ من Excel. يعيد YYYY/MM/DD.
 * عناوين "التاريخ" لها الأولوية: يُفحص ما بجوارها أولًا، ثم باقي الملف.
 */
const pad = (n: number) => String(n).padStart(2, '0');

const valid = (y: number, m: number, d: number) => {
  if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}/${pad(m)}/${pad(d)}` : null;
};

const fromText = (raw: string): string | null => {
  const t = raw.replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
  let m = t.match(/(\d{4})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = t.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/);
  if (m) return valid(+m[3], +m[2], +m[1]);
  return null;
};

const fromCell = (c: unknown): string | null => {
  if (c instanceof Date && !isNaN(c.getTime())) return valid(c.getFullYear(), c.getMonth() + 1, c.getDate());
  return typeof c === 'string' ? fromText(c) : null;
};

/** cells: صفوف الخلايا (Excel) أو أسطر النص (PDF، كل سطر مصفوفة نصوص) */
export const findReportDate = (rows: unknown[][]): string | null => {
  // بجوار عنوان التاريخ (نفس الصف) أولًا
  for (const row of rows) {
    if (!row.some(c => typeof c === 'string' && /تاريخ|date/i.test(c))) continue;
    for (const c of row) {
      const d = fromCell(c);
      if (d) return d;
    }
  }
  for (const row of rows) for (const c of row) {
    const d = fromCell(c);
    if (d) return d;
  }
  return null;
};
