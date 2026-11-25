/* eslint-disable i18next/no-literal-string */
import cairoArabic from '@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2?url';
import cairoLatin from '@fontsource-variable/cairo/files/cairo-latin-wght-normal.woff2?url';

/** عربة محدثة في كشف الطباعة: سعات الخانات بالترتيب (الرئيسي، الاحتياط 1، 2، 3، البراد) */
export interface UpdatedRow {
  code: string;
  cat: string;
  /** نوع الوقود: كاز، بانزين، شحن */
  fuel: string;
  caps: (number | null)[];
  /** وقت آخر تحديث يدوي (ISO)؛ فارغ = محدثة من كشف الخزانات */
  updatedAt: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (v: number | null) => (v ? Math.round(v).toLocaleString('en-US') : '');

/**
 * كشف العربات المحدثة (A4 عمودي، عدة صفحات): الأحدث تحديثًا أولًا.
 * الجدول: ت | العربة | الخزان الرئيسي | خزان الاحتياط الأول | الثاني | الثالث | خزان البراد
 */
export const buildUpdatedSheet = (rows: UpdatedRow[]) => {
  const origin = window.location.origin;
  const now = new Date();
  const printed = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const body = rows.map((r, i) => `<tr><td class="idx">${i + 1}</td><td class="code"><b>${esc(r.code)}</b><span>${esc(r.cat)}</span></td><td class="fuel f-${r.fuel === 'شحن' ? 'e' : r.fuel === 'بانزين' ? 'p' : 'd'}">${esc(r.fuel)}</td>${
    r.fuel === 'شحن' ? '<td colspan="5" class="charge">عربة شحن — بلا خزانات</td>'
      : r.caps.map((c, k) => `<td class="${k === 0 ? 'main' : k === 4 ? 'reefer' : ''}">${n(c)}</td>`).join('')}</tr>`).join('');

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>العربات المحدثة</title>
<style>
@font-face { font-family: 'CairoP'; font-weight: 200 1000; font-display: block; src: url('${origin}${cairoArabic}') format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF; }
@font-face { font-family: 'CairoP'; font-weight: 200 1000; font-display: block; src: url('${origin}${cairoLatin}') format('woff2'); unicode-range: U+0000-00FF, U+2000-206F, U+2212; }
@page { size: A4 portrait; margin: 10mm 9mm 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; }
body { font-family: 'CairoP', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.3; font-variant-numeric: tabular-nums; padding: 10mm 9mm; }
@media print { body { padding: 0; } }
.head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding-bottom: 6px; border-bottom: 3px double #1e3a8a; margin-bottom: 8px; }
.logos { display: flex; align-items: center; gap: 6px; }
.logos img { height: 30px; width: auto; object-fit: contain; }
.org p { margin: 3px 0 0; font-size: 9px; font-weight: 700; color: #334155; }
.mid { text-align: center; }
.mid h2 { margin: 0; font-size: 18px; font-weight: 900; }
.mid div { font-size: 10px; font-weight: 700; color: #64748b; }
.partner { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.partner img { height: 36px; width: auto; object-fit: contain; }
.partner span { font-size: 9.5px; font-weight: 900; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th { background: #1e3a8a; color: #fff; font-weight: 800; font-size: 10.5px; padding: 6px 4px; border: 1px solid #3451a8; }
th small { display: block; font-size: 8.5px; font-weight: 600; color: #c7d2fe; }
td { padding: 4px 5px; text-align: center; border: 1px solid #e2e8f0; font-weight: 700; font-size: 11.5px; }
tbody tr:nth-child(even) td { background: #f8fafc; }
td.idx { color: #64748b; width: 30px; font-weight: 600; }
td.code { text-align: right; white-space: nowrap; }
td.code b { font-weight: 900; direction: ltr; unicode-bidi: isolate; }
td.code span { font-size: 9px; font-weight: 700; color: #64748b; margin-inline-start: 6px; }
td.main { background: #eef2ff !important; font-weight: 900; color: #1e3a8a; }
td.reefer { color: #b45309; }
td.fuel { font-size: 10px; font-weight: 900; }
td.f-d { color: #1e3a8a; }
td.f-p { color: #b45309; }
td.f-e { color: #047857; }
td.charge { color: #047857; font-size: 10px; font-weight: 800; background: #ecfdf5 !important; }
tr { page-break-inside: avoid; }
</style></head><body>
<header class="head">
  <div class="org">
    <div class="logos"><img src="${origin}/logos/sahara.png" alt=""><img src="${origin}/logos/sama.png" alt=""><img src="${origin}/logos/bawadi.png" alt=""><img src="${origin}/logos/kac.png" alt=""></div>
    <p>الإدارة المركزية للوقود والمشتقات النفطية</p>
  </div>
  <div class="mid"><h2>العربات المحدثة</h2><div>${rows.length.toLocaleString('en-US')} عربة · الأحدث تحديثًا أولًا · <span dir="ltr">${printed}</span></div></div>
  <div class="partner"><img src="${origin}/logos/etihad.png" alt=""><span>مجموعة الاتحاد للصناعات</span></div>
</header>
<table>
<thead><tr><th>ت</th><th>العربة</th><th>الوقود</th><th>سعة الخزان الرئيسي<small>لتر</small></th><th>خزان الاحتياط الأول<small>لتر</small></th><th>خزان الاحتياط الثاني<small>لتر</small></th><th>خزان الاحتياط الثالث<small>لتر</small></th><th>خزان البراد<small>لتر</small></th></tr></thead>
<tbody>${body || '<tr><td colspan="8">لا توجد عربات محدثة</td></tr>'}</tbody>
</table>
</body></html>`;
};
