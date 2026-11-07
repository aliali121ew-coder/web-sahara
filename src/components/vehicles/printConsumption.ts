/* eslint-disable i18next/no-literal-string */
import cairoArabic from '@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2?url';
import cairoLatin from '@fontsource-variable/cairo/files/cairo-latin-wght-normal.woff2?url';

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
const dash = '<span class="nil">—</span>';
const cell = (v: number | null) => (v ? n(v) : dash);

/** المتبقي كما في جدول التحليل: سعة الخزان ناقص الاستهلاك (بلا سعة لا يُحسب) */
const remainingOf = (r: PrintRow) => (r.used !== null && r.capacity && !r.estimated ? r.capacity - r.used : null);

/**
 * كشف استهلاك العربات للطباعة بالترويسة الرسمية: كارتات (عدد العربات، الأعلى استهلاكًا، النسبة عن السابق، رسم الفترات)
 * ثم جدول: ت | العربة | الفترات الأربع | مجموع التفويل | الاستهلاك | المتبقي | عدد الخزانات | المسافة، ثم التواقيع.
 * الطباعة العامة تجمع العربات تحت فئاتها مع مجموع لكل فئة، وطباعة الفئة تعرضها وحدها.
 */
export const buildConsumptionSheet = (opts: {
  rows: PrintRow[];
  periods: PrintPeriod[];
  title: string;
  /** عام أو اسم الفئة */
  scope: string;
  periodLabel: string;
  /** true = كل الفئات مع عنوان ومجموع لكل فئة */
  grouped: boolean;
}) => {
  const { rows, periods, title, scope, periodLabel, grouped } = opts;
  const origin = window.location.origin;
  const L = periods.length - 1;
  const byCode = (a: PrintRow, b: PrintRow) => a.code.localeCompare(b.code, 'en', { numeric: true });
  const groups = new Map<string, PrintRow[]>();
  for (const r of [...rows].sort(byCode)) groups.set(r.cat, [...(groups.get(r.cat) || []), r]);
  const cols = 2 + periods.length + 5;

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
    return `<tr class="${cls}"><td colspan="2" class="lbl">${esc(label)} <span class="cnt">${list.length} عربة</span></td>${t.p.map(v => `<td>${cell(v)}</td>`).join('')}<td class="hl">${n(t.fill)}</td><td class="hl">${t.used === null ? dash : n(t.used)}</td><td>${t.rem === null ? dash : n(t.rem)}</td><td>${t.tanks || dash}</td><td>${cell(t.km)}</td></tr>`;
  };

  let i = 0;
  const body = [...groups.entries()].map(([cat, list]) => {
    const head = grouped ? `<tr class="cat"><td colspan="${cols}"><span class="bar"></span>${esc(cat)}<span class="cnt">${list.length} عربة</span></td></tr>` : '';
    const lines = list.map(r => {
      const fill = r.p.reduce((s, x) => s + x, 0);
      const rem = remainingOf(r);
      return `<tr><td class="idx">${++i}</td><td class="code">${esc(r.code)}</td>${r.p.map((v, k) => `<td${k === L ? ' class="last"' : ''}>${cell(v)}</td>`).join('')}<td class="hl">${n(fill)}</td><td class="hl">${r.used === null ? dash : n(r.used) + (r.estimated ? '<sup>*</sup>' : '')}</td><td>${rem === null ? dash : n(rem)}</td><td>${r.tanks ?? dash}</td><td>${cell(r.km)}</td></tr>`;
    }).join('');
    return head + lines + (grouped ? totalRow(`مجموع ${cat}`, list, 'sub') : '');
  }).join('');

  // الكارتات
  const all = totals(rows);
  const amountOf = (r: PrintRow) => r.used ?? r.p.reduce((s, x) => s + x, 0);
  const top = [...rows].sort((a, b) => amountOf(b) - amountOf(a))[0];
  const last = all.p[L];
  const prev = all.p[L - 1];
  const pct = prev ? ((last - prev) / prev) * 100 : null;
  const pctCls = pct === null ? '' : pct > 0 ? 'up' : pct < 0 ? 'down' : '';
  const pctTxt = pct === null ? '—' : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(1)}%`;
  const active = rows.filter(r => r.p[L] > 0).length;

  // رسم الفترات: الأقدم يمينًا مثل الجدول، والفترة الأخيرة بلون مميز
  const W = 300, H = 92, top_ = 14, base = 70, gap = 14;
  const bw = (W - gap * (periods.length + 1)) / periods.length;
  const max = Math.max(1, ...all.p);
  const bars = all.p.map((v, k) => {
    const h = Math.max(v ? 3 : 1.5, (v / max) * (base - top_));
    const x = W - gap - (k + 1) * bw - k * gap;
    const c = k === L ? '#1e3a8a' : '#cbd5e1';
    return `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="3" fill="${c}"/>`
      + `<text x="${x + bw / 2}" y="${base - h - 4}" class="bv${k === L ? ' on' : ''}">${v ? n(v) : ''}</text>`
      + `<text x="${x + bw / 2}" y="${base + 13}" class="bn${k === L ? ' on' : ''}">${esc(periods[k].name)}</text>`;
  }).join('');
  const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet"><line x1="${gap / 2}" y1="${base}" x2="${W - gap / 2}" y2="${base}" stroke="#94a3b8" stroke-width="1"/>${bars}</svg>`;

  const cards = `<section class="cards">
  <div class="card"><div class="k">عدد العربات</div><div class="v">${rows.length.toLocaleString('en-US')}<small>عربة</small></div><div class="s"><b>${active}</b> فوّلت في ${esc(periods[L].name)}</div></div>
  <div class="card"><div class="k">الأعلى استهلاكًا</div><div class="v code">${top ? esc(top.code) : '—'}</div><div class="s">${top ? `<b>${n(amountOf(top))}</b> لتر · ${esc(top.cat)}` : ''}</div></div>
  <div class="card"><div class="k">النسبة عن السابق</div><div class="v ${pctCls}" dir="ltr">${pctTxt}</div><div class="s">${esc(periods[L].name)} <b>${n(last)}</b> مقابل ${esc(periods[L - 1].name)} <b>${n(prev)}</b> لتر</div></div>
  <div class="card chart"><div class="k">التفويل في الفترات (لتر)</div>${chart}</div>
</section>`;

  const now = new Date();
  const printed = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)} — ${esc(scope)}</title>
<style>
@font-face { font-family: 'CairoP'; font-weight: 200 1000; font-display: block; src: url('${origin}${cairoArabic}') format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF; }
@font-face { font-family: 'CairoP'; font-weight: 200 1000; font-display: block; src: url('${origin}${cairoLatin}') format('woff2'); unicode-range: U+0000-00FF, U+2000-206F, U+2212; }
@page { size: A4 landscape; margin: 9mm 9mm 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; }
body { font-family: 'CairoP', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; font-size: 10.5px; font-variant-numeric: tabular-nums; }

/* الترويسة الرسمية */
.head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 3px double #0f172a; }
.org { display: flex; flex-direction: column; gap: 3px; }
.logos { display: flex; align-items: center; gap: 8px; }
.logos img { height: 36px; width: auto; object-fit: contain; }
.org h1 { margin: 0; font-size: 11.5px; font-weight: 900; }
.org p { margin: 0; font-size: 9.5px; font-weight: 700; color: #334155; }
.mid { text-align: center; }
.badge { display: inline-block; padding: 1px 16px; border-radius: 999px; background: #0f172a; color: #fff; font-size: 9.5px; font-weight: 800; }
.mid h2 { margin: 4px 0 0; font-size: 19px; font-weight: 900; letter-spacing: -.2px; }
.mid .scope { font-size: 12px; font-weight: 800; color: #1e3a8a; }
.partner { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.partner img { height: 42px; width: auto; object-fit: contain; }
.partner span { font-size: 10.5px; font-weight: 900; }

/* شريط بيانات الكشف */
.info { display: flex; gap: 0; margin: 8px 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
.info div { flex: 1; padding: 4px 10px; border-inline-start: 1px solid #e2e8f0; }
.info div:first-child { border-inline-start: 0; }
.info span { display: block; font-size: 8.5px; font-weight: 700; color: #64748b; }
.info b { font-size: 11px; font-weight: 800; }

/* الكارتات */
.cards { display: grid; grid-template-columns: 1fr 1fr 1fr 1.6fr; gap: 8px; margin-bottom: 9px; }
.card { position: relative; border: 1px solid #cbd5e1; border-radius: 10px; padding: 7px 12px 7px; overflow: hidden; }
.card::before { content: ''; position: absolute; inset-inline-start: 0; top: 0; bottom: 0; width: 4px; background: #1e3a8a; }
.card .k { font-size: 9.5px; font-weight: 800; color: #475569; }
.card .v { font-size: 22px; font-weight: 900; line-height: 1.25; margin-top: 2px; }
.card .v small { font-size: 10px; font-weight: 700; color: #64748b; margin-inline-start: 4px; }
.card .v.code { direction: ltr; text-align: right; }
.card .v.up { color: #be123c; }
.card .v.down { color: #0f766e; }
.card .s { font-size: 9.5px; color: #64748b; }
.card .s b { color: #0f172a; font-weight: 800; }
.card.chart { padding-bottom: 2px; }
.bv { font-size: 9px; font-weight: 800; fill: #475569; text-anchor: middle; }
.bn { font-size: 9px; font-weight: 700; fill: #64748b; text-anchor: middle; }
.bv.on, .bn.on { fill: #1e3a8a; font-weight: 900; }

/* الجدول */
table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #94a3b8; border-radius: 8px; overflow: hidden; }
thead { display: table-header-group; }
th { background: #0f172a; color: #fff; font-weight: 800; font-size: 10px; padding: 6px 5px; border-inline-start: 1px solid #334155; }
th:first-child { border-inline-start: 0; }
th small { display: block; font-weight: 600; font-size: 8.5px; color: #cbd5e1; }
th.last { background: #1e3a8a; }
td { padding: 4px 6px; text-align: center; border-top: 1px solid #e2e8f0; border-inline-start: 1px solid #e2e8f0; font-weight: 600; }
td:first-child { border-inline-start: 0; }
tbody tr:nth-child(even):not(.cat):not(.sub):not(.all) td { background: #f8fafc; }
td.idx { color: #64748b; width: 26px; }
td.code { font-weight: 900; direction: ltr; text-align: right; }
td.last { background: #eff6ff !important; font-weight: 800; }
td.hl { font-weight: 800; }
td sup { color: #64748b; }
.nil { color: #cbd5e1; }
tr.cat td { background: #e2e8f0; text-align: right; font-weight: 900; font-size: 11px; padding: 5px 8px; border-top: 1px solid #94a3b8; }
tr.cat .bar { display: inline-block; width: 4px; height: 11px; background: #1e3a8a; border-radius: 2px; margin-inline-end: 6px; vertical-align: -1px; }
.cnt { font-weight: 700; font-size: 9px; color: #64748b; margin-inline-start: 6px; }
tr.sub td { background: #f1f5f9; font-weight: 800; border-top: 1px solid #94a3b8; }
tr.sub td.lbl, tr.all td.lbl { text-align: right; }
tr.all td { background: #0f172a; color: #fff; font-weight: 900; font-size: 11px; padding: 6px; }
tr.all .cnt, tr.all .nil { color: #94a3b8; }
tr { page-break-inside: avoid; }

/* الأسفل */
.note { margin-top: 6px; font-size: 9px; color: #475569; }
.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 22px; page-break-inside: avoid; }
.sign div { text-align: center; font-size: 10.5px; font-weight: 800; }
.sign div span { display: block; margin-top: 26px; border-top: 1px dashed #64748b; padding-top: 3px; font-size: 9px; font-weight: 600; color: #64748b; }
</style></head><body>
<header class="head">
  <div class="org">
    <div class="logos"><img src="${origin}/logos/sahara.png" alt=""><img src="${origin}/logos/sama.png" alt=""><img src="${origin}/logos/bawadi.png" alt=""><img src="${origin}/logos/kac.png" alt=""></div>
    <h1>مجموعة شركات كربلاء للإنتاج الزراعي والحيواني</h1>
    <p>الإدارة المركزية للوقود والمشتقات النفطية</p>
  </div>
  <div class="mid"><span class="badge">وثيقة رسمية معتمدة</span><h2>${esc(title)}</h2><div class="scope">${esc(scope)}</div></div>
  <div class="partner"><img src="${origin}/logos/etihad.png" alt=""><span>مجموعة الاتحاد للصناعات</span></div>
</header>
<div class="info">
  <div><span>الفترة</span><b>${esc(periodLabel)}</b></div>
  <div><span>نوع الكشف</span><b>${grouped ? 'عام — كل الفئات' : `فئة: ${esc(scope)}`}</b></div>
  <div><span>الأعمدة</span><b>${periods.map(p => esc(p.name)).join(' · ')}</b></div>
  <div><span>تاريخ الطباعة</span><b dir="ltr">${printed}</b></div>
</div>
${cards}
<table>
<thead><tr><th>ت</th><th>العربة</th>${periods.map((p, k) => `<th${k === L ? ' class="last"' : ''}>${esc(p.name)}<small dir="ltr">${esc(p.range)}</small></th>`).join('')}<th>مجموع التفويل</th><th>الاستهلاك</th><th>المتبقي</th><th>عدد الخزانات</th><th>المسافة المقطوعة<small>كم</small></th></tr></thead>
<tbody>${body || `<tr><td colspan="${cols}">لا توجد عربات</td></tr>`}${rows.length ? totalRow('المجموع الكلي', rows, 'all') : ''}</tbody>
</table>
<div class="note">الاستهلاك = مجموع التفويلات بعد استبعاد أول تفويلة بلا سابقة وقص ما يزيد على سعة الخزان · المتبقي = سعة الخزان ناقص الاستهلاك · <sup>*</sup> تقديري: سعة الخزان غير مسجلة · الكميات باللتر</div>
<div class="sign"><div>معدّ الكشف<span>الاسم والتوقيع</span></div><div>مسؤول الوقود<span>الاسم والتوقيع</span></div><div>المدير المختص<span>الاسم والتوقيع</span></div></div>
</body></html>`;
};

/** يطبع صفحة HTML من إطار مخفي بعد تحميل الخط والشعارات (بلا نافذة جديدة ولا تأثر بتنسيق الصفحة) */
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
  const images = [...doc.images].map(img => (img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = () => r(undefined); })));
  const ready = Promise.all([doc.fonts?.ready, ...images]);
  const timeout = new Promise(r => window.setTimeout(r, 4000));
  void Promise.race([ready, timeout]).then(() => {
    win.addEventListener('afterprint', () => window.setTimeout(() => frame.remove(), 500));
    win.focus();
    win.print();
    window.setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60000);
  });
};
