/* eslint-disable i18next/no-literal-string */

/** سطر عربة في كشف الطباعة */
export interface PrintRow {
  code: string;
  cat: string;
  catKey: string;
  /** الكمية في كل فترة من الفترات الأربع */
  p: number[];
  used: number | null;
  /** الاستهلاك بلا خزان مسجل (بلا قص) */
  estimated: boolean;
  capacity: number;
  tanks: number | null;
  km: number;
}

export interface PrintPeriod { name: string; range: string }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (v: number) => Math.round(v).toLocaleString('en-US');
const dash = '—';

/** المتبقي كما في جدول التحليل: سعة الخزان ناقص الاستهلاك (بلا سعة لا يُحسب) */
const remainingOf = (r: PrintRow) => (r.used !== null && r.capacity && !r.estimated ? r.capacity - r.used : null);

/**
 * كشف استهلاك العربات للطباعة: ت | العربة | الفترات الأربع | مجموع التفويل | الاستهلاك | المتبقي | عدد الخزانات | المسافة.
 * الطباعة العامة تجمع العربات تحت فئاتها مع مجموع لكل فئة، وطباعة الفئة تعرضها وحدها.
 */
export const buildConsumptionSheet = (opts: {
  rows: PrintRow[];
  periods: PrintPeriod[];
  title: string;
  periodLabel: string;
  /** true = كل الفئات مع عنوان ومجموع لكل فئة */
  grouped: boolean;
}) => {
  const { rows, periods, title, periodLabel, grouped } = opts;
  const byCode = (a: PrintRow, b: PrintRow) => a.code.localeCompare(b.code, 'en', { numeric: true });
  const groups = new Map<string, PrintRow[]>();
  for (const r of [...rows].sort(byCode)) groups.set(r.cat, [...(groups.get(r.cat) || []), r]);
  const cols = 4 + periods.length + 5;

  const totals = (list: PrintRow[]) => {
    const p = periods.map((_, i) => list.reduce((s, r) => s + r.p[i], 0));
    const usedList = list.filter(r => r.used !== null);
    const remList = list.map(remainingOf).filter((x): x is number => x !== null);
    return {
      p,
      fill: p.reduce((s, x) => s + x, 0),
      used: usedList.length ? usedList.reduce((s, r) => s + r.used!, 0) : null,
      rem: remList.length ? remList.reduce((s, x) => s + x, 0) : null,
      tanks: list.reduce((s, r) => s + (r.tanks || 0), 0),
      km: list.reduce((s, r) => s + r.km, 0),
    };
  };
  const totalRow = (label: string, list: PrintRow[], cls: string) => {
    const t = totals(list);
    return `<tr class="${cls}"><td colspan="2">${esc(label)} <span class="cnt">(${list.length})</span></td>${t.p.map(v => `<td>${v ? n(v) : dash}</td>`).join('')}<td>${n(t.fill)}</td><td>${t.used === null ? dash : n(t.used)}</td><td>${t.rem === null ? dash : n(t.rem)}</td><td>${t.tanks || dash}</td><td>${t.km ? n(t.km) : dash}</td></tr>`;
  };

  let i = 0;
  const body = [...groups.entries()].map(([cat, list]) => {
    const head = grouped ? `<tr class="cat"><td colspan="${cols}">${esc(cat)}</td></tr>` : '';
    const lines = list.map(r => {
      const fill = r.p.reduce((s, x) => s + x, 0);
      const rem = remainingOf(r);
      return `<tr><td>${++i}</td><td class="code">${esc(r.code)}</td>${r.p.map(v => `<td>${v ? n(v) : dash}</td>`).join('')}<td class="b">${n(fill)}</td><td class="b">${r.used === null ? dash : n(r.used) + (r.estimated ? '<span class="est">*</span>' : '')}</td><td>${rem === null ? dash : n(rem)}</td><td>${r.tanks ?? dash}</td><td>${r.km ? n(r.km) : dash}</td></tr>`;
    }).join('');
    return head + lines + (grouped ? totalRow(`مجموع ${cat}`, list, 'sub') : '');
  }).join('');

  // الكارتات أعلى الجدول: عدد العربات، الأعلى استهلاكًا، النسبة عن الفترة السابقة، ورسم الفترات
  const all = totals(rows);
  const amountOf = (r: PrintRow) => r.used ?? r.p.reduce((s, x) => s + x, 0);
  const top = [...rows].sort((a, b) => amountOf(b) - amountOf(a))[0];
  const last = all.p[periods.length - 1];
  const prev = all.p[periods.length - 2];
  const pct = prev ? ((last - prev) / prev) * 100 : null;
  const pctTxt = pct === null ? dash : `${pct > 0 ? '▲' : pct < 0 ? '▼' : ''} ${Math.abs(pct).toFixed(1)}%`;
  const pctCls = pct === null ? '' : pct >= 15 ? 'up' : pct <= -10 ? 'down' : '';
  const max = Math.max(1, ...all.p);
  const W = 230, H = 62, gap = 10, bw = (W - gap * (periods.length - 1)) / periods.length;
  // الأقدم يمينًا مثل اتجاه الجدول
  const bars = all.p.map((v, k) => {
    const h = Math.max(2, (v / max) * (H - 16));
    const x = W - (k + 1) * bw - k * gap;
    const fill = k === periods.length - 1 ? '#4f46e5' : '#cbd5e1';
    return `<rect x="${x}" y="${H - h}" width="${bw}" height="${h}" rx="3" fill="${fill}"/><text x="${x + bw / 2}" y="${H - h - 3}" text-anchor="middle" font-size="9" font-family="monospace" fill="#334155">${v ? n(v) : ''}</text>`;
  }).join('');
  const labelsRow = periods.map(p => `<span style="width:${bw}px">${esc(p.name)}</span>`).join('');
  const cards = `<div class="cards">
<div class="card"><div class="lbl">عدد العربات</div><div class="val">${rows.length.toLocaleString('en-US')}</div><div class="sub">${rows.filter(r => r.p[periods.length - 1] > 0).length} فوّلت في ${esc(periods[periods.length - 1].name)}</div></div>
<div class="card"><div class="lbl">الأعلى استهلاكًا</div><div class="val">${top ? esc(top.code) : dash}</div><div class="sub">${top ? `${n(amountOf(top))} لتر${top.used === null ? ' تفويل' : ''} · ${esc(top.cat)}` : ''}</div></div>
<div class="card"><div class="lbl">النسبة عن السابق</div><div class="val ${pctCls}">${pctTxt}</div><div class="sub">${esc(periods[periods.length - 1].name)} ${n(last)} مقابل ${esc(periods[periods.length - 2].name)} ${n(prev)} لتر</div></div>
<div class="card chart"><div class="lbl">التفويل في الفترات</div><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bars}</svg><div class="bl">${labelsRow}</div></div>
</div>`;

  const now = new Date();
  const printed = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; font-size: 11px; }
.top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px double #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
h1 { font-size: 17px; margin: 0; }
.meta { font-size: 11px; color: #475569; }
.meta b { color: #0f172a; font-family: monospace; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #94a3b8; padding: 3px 5px; text-align: center; }
th { background: #e2e8f0; font-weight: 800; }
th small { display: block; font-weight: 500; color: #475569; font-family: monospace; }
td { font-family: monospace; }
td.code { font-weight: 800; }
td.b { font-weight: 700; }
tr.cat td { background: #f1f5f9; text-align: right; font-family: inherit; font-weight: 800; }
tr.sub td, tr.all td { background: #f8fafc; font-weight: 800; }
tr.sub td:first-child, tr.all td:first-child { text-align: right; font-family: inherit; }
tr.all td { background: #e2e8f0; }
.cnt { font-weight: 500; color: #475569; }
.est { color: #64748b; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
.note { margin-top: 6px; font-size: 10px; color: #475569; }
.cards { display: grid; grid-template-columns: 1fr 1fr 1fr 1.35fr; gap: 8px; margin-bottom: 8px; }
.card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; }
.card .lbl { font-size: 10px; font-weight: 800; color: #475569; }
.card .val { font-size: 20px; font-weight: 800; font-family: monospace; margin-top: 2px; }
.card .val.up { color: #e11d48; }
.card .val.down { color: #0d9488; }
.card .sub { font-size: 10px; color: #64748b; margin-top: 1px; }
.card.chart svg { display: block; margin-top: 2px; }
.card .bl { display: flex; flex-direction: row; gap: 10px; font-size: 9px; color: #475569; text-align: center; }
</style></head><body>
<div class="top"><div><h1>${esc(title)}</h1><div class="meta">الفترة: <b>${esc(periodLabel)}</b></div></div><div class="meta">تاريخ الطباعة: <b>${printed}</b></div></div>
${cards}
<table><thead><tr><th>ت</th><th>العربة</th>${periods.map(p => `<th>${esc(p.name)}<small>${esc(p.range)}</small></th>`).join('')}<th>مجموع التفويل</th><th>الاستهلاك</th><th>المتبقي</th><th>عدد الخزانات</th><th>المسافة المقطوعة (كم)</th></tr></thead>
<tbody>${body || `<tr><td colspan="${cols}">لا توجد عربات</td></tr>`}${rows.length ? totalRow('المجموع الكلي', rows, 'all') : ''}</tbody></table>
<div class="note">الاستهلاك = مجموع التفويلات بعد استبعاد أول تفويلة بلا سابقة وقص ما يزيد على سعة الخزان · المتبقي = سعة الخزان ناقص الاستهلاك · * تقديري: سعة الخزان غير مسجلة</div>
</body></html>`;
};

/** يطبع صفحة HTML من إطار مخفي (بلا نافذة جديدة ولا تأثر بتنسيق الصفحة) */
export const printHtml = (html: string) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  win.addEventListener('afterprint', cleanup);
  window.setTimeout(() => { win.focus(); win.print(); }, 150);
  window.setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60000);
};
