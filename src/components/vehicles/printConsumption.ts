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

export interface PrintPeriod {
  name: string;
  range: string;
  /** حدود الفترة YYYY/MM/DD — لحساب المعدل اليومي (بدونها تُعد يومًا واحدًا) */
  from?: string;
  to?: string;
}

/** عربة في عمود «الأعلى استهلاكًا خلال الأسبوع» */
export interface WeekTop {
  code: string;
  cat: string;
  /** مجموع تفويلات الأسبوع وعددها */
  total: number;
  count: number;
  /** آخر تفويلة والتي قبلها (ولو قبل الأسبوع) */
  lastQty: number;
  lastDate: string;
  prevQty: number | null;
  prevDate: string;
  /** الأيام منذ التفويلة السابقة */
  days: number | null;
  /** تفويلتان خلال يوم أو أقل */
  frequent: boolean;
}

/** عدد العربات في الكشف: أعلى 20 حتى يتسع في ورقة واحدة */
export const SHEET_TOP = 20;
/** عدد العربات في عمود الأسبوع */
export const WEEK_TOP = 8;

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (v: number) => Math.round(v).toLocaleString('en-US');
const dash = '<span class="nil">—</span>';
const cell = (v: number | null) => (v ? n(v) : dash);

/** المتبقي كما في جدول التحليل: سعة الخزان ناقص الاستهلاك (بلا سعة لا يُحسب) */
const remainingOf = (r: PrintRow) => (r.used !== null && r.capacity && !r.estimated ? r.capacity - r.used : null);

/**
 * كشف استهلاك العربات للطباعة بالترويسة الرسمية: كارتات (عدد العربات، الأعلى استهلاكًا، النسبة عن السابق، رسم الفترات)
 * ثم في ورقة واحدة: جدول أعلى 20 عربة استهلاكًا (75%) بجانبه الأعلى استهلاكًا خلال الأسبوع (25%).
 * الطباعة العامة من كل الفئات (الفئة بجانب العربة)، وطباعة الفئة من عرباتها وحدها.
 */
export const buildConsumptionSheet = (opts: {
  rows: PrintRow[];
  periods: PrintPeriod[];
  title: string;
  /** عام أو اسم الفئة */
  scope: string;
  periodLabel: string;
  /** true = كل الفئات (الطباعة العامة) */
  grouped: boolean;
  /** الأعلى استهلاكًا خلال الأسبوع ومدى الأسبوع */
  week: WeekTop[];
  weekRange: string;
  /** تفويل نفس عدد الأيام قبل بداية الكشف (للنسبة) ومداها ومدى الكشف */
  prevTotal: number;
  curTotal: number;
  prevRange: string;
  curRange: string;
}) => {
  const { rows, periods, title, scope, grouped, week, weekRange, prevTotal, curTotal, prevRange, curRange } = opts;
  const origin = window.location.origin;
  const L = periods.length - 1;
  const cols = 2 + periods.length + 6;
  const amountOf = (r: PrintRow) => r.used ?? r.p.reduce((s, x) => s + x, 0);
  // أعلى 20 عربة استهلاكًا (من كل الفئات في الطباعة العامة)
  const ranked = [...rows].sort((a, b) => amountOf(b) - amountOf(a) || a.code.localeCompare(b.code, 'en', { numeric: true }));
  const topRows = ranked.slice(0, SHEET_TOP);

  const totals = (list: PrintRow[]) => {
    const p = periods.map((_, i) => list.reduce((s, r) => s + r.p[i], 0));
    const usedList = list.filter(r => r.used !== null);
    const remList = list.map(remainingOf).filter((x): x is number => x !== null);
    return {
      p,
      fill: p.reduce((s, x) => s + x, 0),
      used: usedList.length ? usedList.reduce((s, r) => s + r.used!, 0) : null,
      rem: remList.length ? remList.reduce((s, x) => s + x, 0) : null,
      cap: list.reduce((s, r) => s + (r.estimated ? 0 : r.capacity), 0),
      tanks: list.reduce((s, r) => s + (r.tanks || 0), 0),
      km: list.reduce((s, r) => s + r.km, 0),
    };
  };

  // التنبيه (أحمر): قفزة في الفترة الحالية 30% فأكثر عن معدل العربة نفسها في الفترات السابقة،
  // أو صرف لكل كم أعلى من متوسط فئتها بـ 30% فأكثر (حين تُسجَّل المسافة)
  const ALERT = 1.3;
  const rates = new Map<string, number[]>();
  for (const r of rows) if (r.used && r.km > 0) rates.set(r.catKey, [...(rates.get(r.catKey) || []), r.used / r.km]);
  const alertOf = (r: PrintRow) => {
    const before = r.p.slice(0, L).filter(v => v > 0);
    const own = before.length ? before.reduce((s, v) => s + v, 0) / before.length : null;
    const spike = own !== null && r.p[L] >= own * ALERT;
    const list = rates.get(r.catKey) || [];
    const avgRate = list.length > 1 ? list.reduce((s, v) => s + v, 0) / list.length : null;
    const perKm = !!r.used && r.km > 0 && avgRate !== null && r.used / r.km >= avgRate * ALERT;
    return spike || perKm;
  };
  /** خانة فارغة بلا شرطة للأعمدة الثانوية */
  const opt = (v: number | null | undefined) => (v ? n(v) : '');

  const body = topRows.map((r, i) => {
    const fill = r.p.reduce((s, x) => s + x, 0);
    const rem = remainingOf(r);
    return `<tr><td class="idx">${i + 1}</td><td class="code"><b>${esc(r.code)}</b>${grouped ? `<span class="cat">${esc(r.cat)}</span>` : ''}</td>${r.p.map((v, k) => `<td${k === L ? ' class="last"' : ''}>${cell(v)}</td>`).join('')}<td class="hl">${n(fill)}</td><td>${r.used === null ? dash : `<span class="pill${alertOf(r) ? ' alert' : ''}">${n(r.used)}</span>`}</td><td>${r.estimated ? '' : opt(r.capacity)}</td><td>${rem === null ? '' : n(rem)}</td><td>${opt(r.tanks)}</td><td>${opt(r.km)}</td></tr>`;
  }).join('');

  // الكارتات
  const all = totals(rows);
  // النسبة: مجموع أيام الكشف مقابل نفس عدد الأيام قبلها مباشرة
  const last = curTotal;
  const prev = prevTotal;
  const pct = prev ? ((last - prev) / prev) * 100 : null;
  const pctCls = pct === null ? '' : pct > 0 ? 'up' : pct < 0 ? 'down' : '';
  const pctTxt = pct === null ? '—' : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(1)}%`;
  const active = rows.filter(r => r.p[L] > 0).length;

  // رسم أعمدة الفترات: الأقدم يمينًا مثل الجدول، والفترة الأخيرة بلون مميز وقيمتها في شارة
  const W = 340, H = 74, top_ = 13, base = 54, gap = 18;
  const slot = (W - gap) / periods.length;
  const bw = Math.min(46, slot - 26);
  const max = Math.max(1, ...all.p);
  const grid = [0.5, 1].map(f => `<line x1="6" x2="${W - 6}" y1="${base - f * (base - top_)}" y2="${base - f * (base - top_)}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="3 3"/>`).join('');
  /** عمود بزوايا علوية مستديرة وقاعدة مستقيمة */
  const col = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(6, h, w / 2);
    return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
  };
  const bars = all.p.map((v, k) => {
    const on = k === L;
    const h = v ? Math.max(3, (v / max) * (base - top_)) : 1.5;
    const cx = W - gap / 2 - slot * (k + 0.5);
    const x = cx - bw / 2;
    const y = base - h;
    return `<path d="${col(x, top_, bw, base - top_)}" fill="#f1f5f9"/>`
      + `<path d="${col(x, y, bw, h)}" fill="url(#${on ? 'gOn' : 'gOff'})"/>`
      + `<text x="${cx}" y="${y - 3}" class="bv${on ? ' on' : ''}">${v ? n(v) : '0'}</text>`
      + `<text x="${cx}" y="${base + 10}" class="bn${on ? ' on' : ''}">${esc(periods[k].name)}</text>`
      + `<text x="${cx}" y="${base + 19}" class="br" direction="ltr">${esc(periods[k].range)}</text>`;
  }).join('');
  const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet"><defs>`
    + `<linearGradient id="gOn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0284c7" stop-opacity=".75"/><stop offset="1" stop-color="#7dd3fc" stop-opacity=".75"/></linearGradient>`
    + `<linearGradient id="gOff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#94a3b8"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>`
    + `</defs>${grid}<line x1="6" y1="${base}" x2="${W - 6}" y2="${base}" stroke="#cbd5e1" stroke-width="1"/>${bars}</svg>`;

  const icon = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I_TRUCK = icon('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>');
  const I_FUEL = icon('<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>');
  const I_TREND = pct !== null && pct < 0
    ? icon('<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>')
    : icon('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>');
  const I_CHART = icon('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>');
  const activePct = rows.length ? Math.round((active / rows.length) * 100) : 0;
  const cmpMax = Math.max(1, last, prev);
  // الاستهلاك اليومي لكل العربات: تفويل الفترة الأخيرة ÷ أيامها، مقابل معدل الفترات السابقة
  const ms = (d: string) => { const [y, m, dd] = d.split('/').map(Number); return Date.UTC(y, m - 1, dd); };
  const daysOf = (pp: PrintPeriod) => (pp.from && pp.to ? Math.round((ms(pp.to) - ms(pp.from)) / 86400000) + 1 : 1);
  const daily = all.p.map((v, k) => v / daysOf(periods[k]));
  const today = daily[L];
  const before = daily.slice(0, L).filter(v => v > 0);
  const beforeAvg = before.length ? before.reduce((s, v) => s + v, 0) / before.length : null;
  const dailyMax = Math.max(1, ...daily);
  const perVehicle = active ? today / active : 0;

  const cards = `<section class="cards">
  <div class="kpi t1"><div class="kh"><span class="ic">${I_TRUCK}</span><span class="k">العربات التي فوّلت · ${esc(periods[L].name)}</span></div>
    <div class="v">${active.toLocaleString('en-US')}<small>من أصل ${rows.length.toLocaleString('en-US')} عربة</small></div>
    <div class="meter"><i style="width:${activePct}%"></i></div>
    <div class="s"><b dir="ltr">${activePct}%</b> من عربات الكشف · <b>${(rows.length - active).toLocaleString('en-US')}</b> لم تفوّل</div></div>
  <div class="kpi t2"><div class="kh"><span class="ic">${I_FUEL}</span><span class="k">الاستهلاك اليومي · كل العربات</span></div>
    <div class="v">${n(today)}<small>لتر/يوم</small></div>
    <div class="meter"><i style="width:${(today / dailyMax) * 100}%"></i></div>
    <div class="s">متوسط العربة <b>${n(perVehicle)}</b> لتر${beforeAvg !== null ? ` · السابقة <b>${n(beforeAvg)}</b> لتر/يوم` : ''}</div></div>
  <div class="kpi t3 ${pctCls}"><div class="kh"><span class="ic">${I_TREND}</span><span class="k">النسبة عن الفترة السابقة</span></div>
    <div class="v" dir="ltr">${pctTxt}</div>
    <div class="cmp"><div><span dir="ltr">${esc(prevRange)}</span><i style="width:${(prev / cmpMax) * 100}%"></i><b>${n(prev)}</b></div><div class="on"><span dir="ltr">${esc(curRange)}</span><i style="width:${(last / cmpMax) * 100}%"></i><b>${n(last)}</b></div></div></div>
  <div class="kpi t4 chart"><div class="kh"><span class="ic">${I_CHART}</span><span class="k">التفويل في الفترات</span><span class="tot">${n(all.fill)} لتر</span></div>${chart}</div>
</section>`;

  // الأعلى استهلاكًا خلال الأسبوع: حلقة تغيّر آخر تفويلة عن السابقة، ثم آخر تفويلة والسابقة ومجموع الأسبوع
  const ring = (last: number, prev: number | null) => {
    const r = 15, len = 2 * Math.PI * r;
    const ch = prev ? ((last - prev) / prev) * 100 : null;
    const color = ch === null || ch === 0 ? '#94a3b8' : ch > 0 ? '#e11d48' : '#059669';
    const fill = ch === null ? 0 : Math.max(0.04, Math.min(1, Math.abs(ch) / 100));
    const txt = ch === null ? '—' : `${ch > 0 ? '↑' : ch < 0 ? '↓' : ''}${Math.abs(ch) < 10 ? Math.abs(ch).toFixed(1) : Math.round(Math.abs(ch))}%`;
    return `<div class="ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="3.5"/>${fill ? `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - fill)}" transform="rotate(-90 18 18)"/>` : ''}</svg><span style="color:${color}" dir="ltr">${txt}</span></div>`;
  };
  const day = (d: string) => (d ? `${d.slice(8)}/${d.slice(5, 7)}` : '');
  const weekList = week.slice(0, WEEK_TOP).map((w, k) => `<li><div class="rk">${k + 1}</div>${ring(w.lastQty, w.prevQty)}<div class="wi">
    <div class="wl"><b dir="ltr">${esc(w.code)}</b><span class="wc">${esc(w.cat)}</span>${w.frequent ? '<span class="fq">متكرر</span>' : ''}</div>
    <div class="wl2"><b>${n(w.lastQty)}</b> لتر · <span dir="ltr">${day(w.lastDate)}</span>${w.days !== null ? ` · <span class="${w.days <= 1 ? 'fq' : ''}">بعد ${w.days} يوم</span>` : ''}</div>
  </div><div class="wt"><b>${n(w.total)}</b><small>لتر · ${w.count} تفويلة</small></div></li>`).join('');
  const side = `<aside class="week"><div class="wh"><b>الأعلى استهلاكًا خلال الأسبوع</b><small dir="ltr">${esc(weekRange)}</small></div>
  <ol>${weekList || '<li class="empty">لا توجد تفويلات في الأسبوع</li>'}</ol></aside>`;


  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)} — ${esc(scope)}</title>
<style>
@font-face { font-family: 'CairoP'; font-weight: 200 1000; font-display: block; src: url('${origin}${cairoArabic}') format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF; }
@font-face { font-family: 'CairoP'; font-weight: 200 1000; font-display: block; src: url('${origin}${cairoLatin}') format('woff2'); unicode-range: U+0000-00FF, U+2000-206F, U+2212; }
@page { size: A4 landscape; margin: 8mm 9mm 8mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; }
body { font-family: 'CairoP', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; font-size: 10.5px; line-height: 1.3; font-variant-numeric: tabular-nums; }

/* الترويسة الرسمية */
.head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding-bottom: 6px; border-bottom: 3px double #1e3a8a; }
.org { display: flex; flex-direction: column; gap: 3px; }
.logos { display: flex; align-items: center; gap: 8px; }
.logos img { height: 36px; width: auto; object-fit: contain; }
.org h1 { margin: 0; font-size: 11.5px; font-weight: 900; }
.org p { margin: 0; font-size: 9.5px; font-weight: 700; color: #334155; }
.mid { text-align: center; }
.mid h2 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -.2px; }
.mid .scope { font-size: 12px; font-weight: 800; color: #1e3a8a; }
.partner { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.partner img { height: 50px; width: auto; object-fit: contain; }
.partner span { font-size: 10.5px; font-weight: 900; }

/* شريط بيانات الكشف */

/* الكارتات */
.cards { display: grid; grid-template-columns: 1fr 1fr 1fr 1.75fr; gap: 8px; margin: 8px 0; }
.kpi { position: relative; border: 1px solid #e2e8f0; border-radius: 12px; padding: 5px 10px 6px; overflow: hidden; background: linear-gradient(160deg, var(--tint) 0%, #fff 62%); }
.kpi::after { content: ''; position: absolute; top: 0; inset-inline: 0; height: 3px; background: var(--c); opacity: .6; }
.t1 { --c: #1e3a8a; --tint: #f5f7ff; }
.t2 { --c: #d97706; --tint: #fffdf5; }
.t3 { --c: #64748b; --tint: #f8fafc; }
.t3.up { --c: #e11d48; --tint: #fff1f2; }
.t3.down { --c: #059669; --tint: #ecfdf5; }
.t4 { --c: #0369a1; --tint: #f5faff; padding-bottom: 1px; }
.kh { display: flex; align-items: center; gap: 6px; }
.ic { width: 20px; height: 20px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: var(--c); color: #fff; flex-shrink: 0; opacity: .6; }
.ic svg { width: 12px; height: 12px; }
.k { font-size: 9.5px; font-weight: 800; color: #475569; }
.tot { margin-inline-start: auto; font-size: 9px; font-weight: 800; color: #0369a1; background: #e0f2fe; border-radius: 999px; padding: 0 8px; }
.kpi .v { font-size: 18px; font-weight: 900; line-height: 1.15; margin-top: 2px; color: #0f172a; }
.kpi .v small { font-size: 9.5px; font-weight: 700; color: #64748b; margin-inline-start: 5px; }
.kpi .v.code { direction: ltr; text-align: right; }
.kpi .v.code small { direction: rtl; unicode-bidi: isolate; margin-left: 7px; }
.t3 .v { color: var(--c); }
.meter { height: 4px; border-radius: 999px; background: #e2e8f0; margin: 3px 0 2px; overflow: hidden; }
.meter i { display: block; height: 100%; border-radius: 999px; background: var(--c); margin-inline-start: 0; opacity: .6; }
.kpi .s { font-size: 9px; color: #64748b; font-weight: 600; }
.kpi .s b { color: #0f172a; font-weight: 800; }
.cmp { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; }
.cmp div { display: grid; grid-template-columns: 62px 1fr 40px; align-items: center; gap: 5px; font-size: 8.5px; font-weight: 700; color: #64748b; }
.cmp i { display: block; height: 6px; border-radius: 999px; background: #cbd5e1; }
.cmp .on i { background: var(--c); }
.cmp .on { color: #0f172a; }
.cmp b { font-weight: 800; color: #0f172a; text-align: left; }
.bv { font-size: 8.5px; font-weight: 800; fill: #64748b; text-anchor: middle; }
.bv.on { fill: #0369a1; font-weight: 900; }
.bn { font-size: 8.5px; font-weight: 700; fill: #475569; text-anchor: middle; }
.bn.on { fill: #0369a1; font-weight: 900; }
.br { font-size: 7px; font-weight: 600; fill: #94a3b8; text-anchor: middle; }

/* الجدول */
table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #94a3b8; border-radius: 8px; overflow: hidden; }
thead { display: table-header-group; }
th { background: #1e3a8a; color: #fff; font-weight: 800; font-size: 10.5px; padding: 5px 5px; border-inline-start: 1px solid #3451a8; }
th:first-child { border-inline-start: 0; }
th small { display: block; font-weight: 600; font-size: 8.5px; color: #c7d2fe; }
th.last { background: #3b5bdb; }
td { padding: 3.5px 5px; font-size: 11px; text-align: center; border-top: 1px solid #e2e8f0; border-inline-start: 1px solid #e2e8f0; font-weight: 600; }
td:first-child { border-inline-start: 0; }
tbody tr:nth-child(even):not(.cat):not(.sub):not(.all) td { background: #f8fafc; }
td.idx { color: #64748b; width: 26px; }
td.code { text-align: right; white-space: nowrap; }
td.code b { font-weight: 900; direction: ltr; unicode-bidi: isolate; }
td.code .cat { font-size: 9px; font-weight: 700; color: #64748b; margin-inline-start: 5px; }
.pill { display: inline-block; min-width: 48px; padding: 0 8px; border-radius: 6px; font-weight: 800; line-height: 1.6; background: #eef2ff; color: #1e3a8a; }
.pill.alert { background: #ffe4e6; color: #be123c; }
td.last { background: #eff6ff !important; font-weight: 800; }
td.hl { font-weight: 800; background: #f4f6fa !important; }
td sup { color: #64748b; }
.nil { color: #e2e8f0; font-weight: 400; }
.cnt { font-weight: 700; font-size: 9px; color: #64748b; margin-inline-start: 6px; }
tr.sub td { background: #f1f5f9; font-weight: 800; border-top: 1px solid #94a3b8; }
tr.sub td.lbl, tr.all td.lbl { text-align: right; }
tr.all td { background: #0f172a; color: #fff; font-weight: 900; font-size: 11px; padding: 6px; }
tr.all .cnt, tr.all .nil { color: #94a3b8; }
tr { page-break-inside: avoid; }

/* الجدول 75% وعمود الأسبوع 25% */
.main { display: grid; grid-template-columns: 3fr 1fr; gap: 8px; align-items: stretch; }
.main > table { height: 100%; }
.week { display: flex; flex-direction: column; border: 1px solid #94a3b8; border-radius: 8px; overflow: hidden; }
.wh { background: #1e3a8a; color: #fff; padding: 5px 9px; display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
.wh b { font-size: 10px; font-weight: 800; }
.wh small { font-size: 8.5px; color: #c7d2fe; font-weight: 600; }
.week ol { list-style: none; margin: 0; padding: 5px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.week li { flex: 1 1 0; min-height: 0; display: flex; align-items: center; gap: 6px; border: 1px solid #e2e8f0; border-radius: 7px; padding: 3px 6px; }
.week li:nth-child(-n+3) { border-color: #cbd5e1; background: #f8fafc; }
.week li.empty { justify-content: center; color: #94a3b8; }
.rk { width: 15px; height: 15px; border-radius: 50%; background: #e2e8f0; color: #334155; font-size: 8.5px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.week li:nth-child(1) .rk { background: #1e3a8a; color: #fff; }
.ring { position: relative; width: 38px; height: 38px; flex-shrink: 0; }
.ring svg { width: 38px; height: 38px; display: block; }
.ring span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 900; }
.wi { flex: 1; min-width: 0; line-height: 1.35; }
.wl { display: flex; align-items: baseline; gap: 4px; white-space: nowrap; overflow: hidden; }
.wl b { font-size: 12.5px; font-weight: 900; }
.wc { font-size: 9px; font-weight: 700; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; }
.fq { color: #e11d48; font-weight: 800; }
.wl .fq { font-size: 9px; }
.wl2 { font-size: 10px; margin-top: 1px; font-weight: 700; color: #334155; white-space: nowrap; }
.wt { text-align: left; flex-shrink: 0; line-height: 1.2; }
.wt b { display: block; font-size: 13.5px; font-weight: 900; }
.wt small { font-size: 8.5px; font-weight: 700; color: #94a3b8; white-space: nowrap; }

</style></head><body><div id="sheet">
<header class="head">
  <div class="org">
    <div class="logos"><img src="${origin}/logos/sahara.png" alt=""><img src="${origin}/logos/sama.png" alt=""><img src="${origin}/logos/bawadi.png" alt=""><img src="${origin}/logos/kac.png" alt=""></div>
    <p>الإدارة المركزية للوقود والمشتقات النفطية</p>
  </div>
  <div class="mid"><h2>${esc(title)}</h2>${grouped ? '' : `<div class="scope">${esc(scope)}</div>`}</div>
  <div class="partner"><img src="${origin}/logos/etihad.png" alt=""><span>مجموعة الاتحاد للصناعات</span></div>
</header>
${cards}
<div class="main">
<table>
<thead><tr><th>ت</th><th>العربة</th>${periods.map((p, k) => `<th${k === L ? ' class="last"' : ''}>${esc(p.name)}<small dir="ltr">${esc(p.range)}</small></th>`).join('')}<th>مجموع التفويل</th><th>الاستهلاك</th><th>سعة الخزان<small>لتر</small></th><th>المتبقي</th><th>عدد الخزانات</th><th>المسافة المقطوعة<small>كم</small></th></tr></thead>
<tbody>${body || `<tr><td colspan="${cols}">لا توجد عربات</td></tr>`}</tbody>
</table>
${side}
</div>
</div></body></html>`;
};

/** مساحة الطباعة بالبكسل: A4 أفقي (297×210 مم) ناقص الهوامش */
const MM = 96 / 25.4;
const PAGE_W = Math.floor((297 - 18) * MM);
const PAGE_H = Math.floor((210 - 16) * MM) - 6;

/** يطبع صفحة HTML من إطار مخفي بعد تحميل الخط والشعارات (بلا نافذة جديدة ولا تأثر بتنسيق الصفحة) */
export const printHtml = (html: string) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  // بعرض الورقة (A4 أفقي ناقص الهوامش) حتى يُقاس ارتفاع الكشف كما سيُطبع
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;border:0;visibility:hidden;`;
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
    // ورقة واحدة: يُصغَّر الكشف إن زاد ارتفاعه على الورقة
    const sheet = doc.getElementById('sheet');
    if (sheet) {
      const z = Math.min(1, PAGE_H / sheet.scrollHeight);
      if (z < 1) sheet.style.zoom = String(z);
    }
    win.addEventListener('afterprint', () => window.setTimeout(() => frame.remove(), 500));
    win.focus();
    win.print();
    window.setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60000);
  });
};
