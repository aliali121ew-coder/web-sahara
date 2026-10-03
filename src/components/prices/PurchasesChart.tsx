import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LineChart as LineChartIcon, TrendingUp, TrendingDown, Minus, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2,
  Image as ImageIcon, FileSpreadsheet, Activity, GitCompareArrows, MousePointerClick
} from 'lucide-react';
import { ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../../context/LanguageContext';
import { RangeNavigator } from './RangeNavigator';
import { formatNumber } from '../../lib/utils';
import {
  CATEGORIES, type CategoryKey, type PurchaseRow, fmtPrice, addDays, daysBetween, weekStart, monthEnd
} from './purchasesData';

type Gran = 'day' | 'week' | 'month';
type GranChoice = 'auto' | Gran;

interface Props {
  /** صفوف الفترة الحالية (بعد فلتر القسم والتاريخ) */
  rows: PurchaseRow[];
  /** صفوف الفترة السابقة بنفس الطول (للمقارنة)، وعدد الأيام لإزاحتها على محور الفترة الحالية */
  prevRows: PurchaseRow[];
  prevShift: number;
  isAll: boolean;
  title: string;
  /** النقر على عمود/نقطة: ينقل الجدول إلى تلك الفترة */
  onPickRange: (from: string, to: string) => void;
}

/** نقطة على الرسم: يوم أو أسبوع أو شهر */
interface Bucket {
  key: string;
  label: string;
  from: string;
  to: string;
  inbound: number;
  count: number;
  days: number;
  price: number | null;
  minP: number | null;
  maxP: number | null;
  ma: number | null;
  prevInbound: number | null;
  prevPrice: number | null;
  /** مجموع (الكمية × السعر) والكمية المسعّرة: لمتوسط موزون دقيق عند جمع النقاط */
  pc: number;
  pq: number;
  [k: string]: number | string | null;
}

const GRAN_LABEL: Record<GranChoice, string> = { auto: 'تلقائي', day: 'يومي', week: 'أسبوعي', month: 'شهري' };
const MA_WINDOW: Record<Gran, number> = { day: 7, week: 4, month: 3 };
const MA_LABEL: Record<Gran, string> = { day: 'متوسط متحرك 7 أيام', week: 'متوسط متحرك 4 أسابيع', month: 'متوسط متحرك 3 أشهر' };
const r1 = (v: number) => Math.round(v * 10) / 10;
const pct = (a: number | null | undefined, b: number | null | undefined) => (a && b ? ((a - b) / b) * 100 : null);
const fmtQtyAxis = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

/** شارة تغيّر بسهم + نسبة (اللون ليس المؤشر الوحيد) — upIsBad: ارتفاع السعر سيئ للمشتري */
const Delta: React.FC<{ v: number | null; upIsBad?: boolean; className?: string }> = ({ v, upIsBad = true, className = '' }) => {
  if (v === null || !isFinite(v)) return <span className={`text-slate-400 ${className}`}>—</span>;
  const up = v > 0.05, down = v < -0.05;
  const color = up ? (upIsBad ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400') : down ? (upIsBad ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : 'text-slate-500';
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono font-bold ${color} ${className}`} dir="ltr">
      {up ? '▲' : down ? '▼' : '•'} {up ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
};

export const PurchasesChart: React.FC<Props> = ({ rows, prevRows, prevShift, isAll, title, onPickRange }) => {
  const { tr } = useLanguage();
  const [granChoice, setGranChoice] = useState<GranChoice>('auto');
  const [showMA, setShowMA] = useState(true);
  const [compare, setCompare] = useState(false);
  const [hidden, setHidden] = useState<Set<CategoryKey>>(new Set());
  const [full, setFull] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // الأقسام الموجودة في الفترة (للدليل)، والظاهرة منها (بعد إخفاء ما ضُغط عليه في الدليل)
  const presentCats = useMemo(() => CATEGORIES.filter(c => rows.some(r => r.cat === c.key)), [rows]);
  const visibleCats = useMemo(() => presentCats.filter(c => !isAll || !hidden.has(c.key)), [presentCats, hidden, isAll]);
  const shownRows = useMemo(() => (isAll ? rows.filter(r => !hidden.has(r.cat)) : rows), [rows, hidden, isAll]);

  // التجميع التلقائي: حتى 45 يومًا يومي، حتى 6 أشهر أسبوعي، وأكثر شهري
  const gran: Gran = useMemo(() => {
    if (granChoice !== 'auto') return granChoice;
    if (!rows.length) return 'day';
    const dates = rows.map(r => r.date).sort();
    const span = daysBetween(dates[0], dates[dates.length - 1]) + 1;
    return span <= 45 ? 'day' : span <= 186 ? 'week' : 'month';
  }, [granChoice, rows]);

  const bucketOf = (d: string) => {
    if (gran === 'day') return { key: d, from: d, to: d, label: d.slice(5) };
    if (gran === 'week') {
      const ws = weekStart(d);
      return { key: ws, from: ws, to: addDays(ws, 6), label: ws.slice(5) };
    }
    return { key: d.slice(0, 7), from: d.slice(0, 8) + '01', to: monthEnd(d), label: d.slice(0, 7) };
  };

  // ── بناء النقاط تصاعديًا: التاريخ يبدأ من اليسار (الأقدم) إلى اليمين (الأحدث) ──
  const data: Bucket[] = useMemo(() => {
    type Acc = {
      b: ReturnType<typeof bucketOf>; inbound: number; count: number; days: Set<string>; cost: number; qty: number;
      daily: Map<string, { c: number; q: number }>; cat: Map<CategoryKey, { in: number; c: number; q: number }>;
      prevIn: number; prevC: number; prevQ: number;
    };
    const map = new Map<string, Acc>();
    for (const r of shownRows) {
      const b = bucketOf(r.date);
      const a = map.get(b.key) ?? { b, inbound: 0, count: 0, days: new Set(), cost: 0, qty: 0, daily: new Map(), cat: new Map(), prevIn: 0, prevC: 0, prevQ: 0 };
      a.inbound += r.inbound;
      a.count += r.count;
      a.days.add(r.date);
      a.cost += r.pricedCost;
      a.qty += r.pricedQty;
      const dd = a.daily.get(r.date) ?? { c: 0, q: 0 };
      dd.c += r.pricedCost; dd.q += r.pricedQty;
      a.daily.set(r.date, dd);
      const cc = a.cat.get(r.cat) ?? { in: 0, c: 0, q: 0 };
      cc.in += r.inbound; cc.c += r.pricedCost; cc.q += r.pricedQty;
      a.cat.set(r.cat, cc);
      map.set(b.key, a);
    }
    // الفترات الخالية (أيام/أسابيع/أشهر بلا شراء) تُضاف فارغة حتى يبقى محور الزمن منتظمًا
    const keys = [...map.keys()].sort();
    if (keys.length > 1) {
      const last = map.get(keys[keys.length - 1])!.b.from;
      let d = map.get(keys[0])!.b.from;
      for (let guard = 0; d <= last && guard < 2000; guard++) {
        const b = bucketOf(d);
        if (!map.has(b.key)) map.set(b.key, { b, inbound: 0, count: 0, days: new Set(), cost: 0, qty: 0, daily: new Map(), cat: new Map(), prevIn: 0, prevC: 0, prevQ: 0 });
        d = gran === 'day' ? addDays(d, 1) : gran === 'week' ? addDays(d, 7) : addDays(monthEnd(d), 1);
      }
    }
    // الفترة السابقة تُضاف بعد ملء الفراغات حتى تظهر مقارنة الأيام الخالية أيضًا
    for (const r of prevRows) {
      if (isAll && hidden.has(r.cat)) continue;
      const a = map.get(bucketOf(addDays(r.date, prevShift)).key);
      if (!a) continue;
      a.prevIn += r.inbound; a.prevC += r.pricedCost; a.prevQ += r.pricedQty;
    }
    const asc = [...map.values()].sort((x, y) => x.b.key.localeCompare(y.b.key));
    const out: Bucket[] = asc.map(a => {
      const dailyPrices = [...a.daily.values()].filter(d => d.q > 0).map(d => d.c / d.q);
      const p: Bucket = {
        key: a.b.key, label: a.b.label, from: a.b.from, to: a.b.to,
        inbound: a.inbound, count: a.count, days: a.days.size,
        price: a.qty > 0 ? r1(a.cost / a.qty) : null,
        minP: dailyPrices.length ? r1(Math.min(...dailyPrices)) : null,
        maxP: dailyPrices.length ? r1(Math.max(...dailyPrices)) : null,
        ma: null,
        prevInbound: compare ? a.prevIn || null : null,
        prevPrice: compare && a.prevQ > 0 ? r1(a.prevC / a.prevQ) : null,
        pc: a.cost,
        pq: a.qty
      };
      for (const [cat, v] of a.cat) {
        p[cat] = v.in;
        p[`p_${cat}`] = v.q > 0 ? r1(v.c / v.q) : null;
        p[`c_${cat}`] = v.c;
        p[`q_${cat}`] = v.q;
      }
      return p;
    });
    // المتوسط المتحرك للسعر (على النقاط المسعّرة فقط)
    const w = MA_WINDOW[gran];
    out.forEach((p, i) => {
      const win = out.slice(Math.max(0, i - w + 1), i + 1).filter(x => x.price !== null);
      p.ma = p.price !== null && win.length ? r1(win.reduce((s, x) => s + (x.price as number), 0) / win.length) : null;
    });
    return out; // تصاعديًا: الأقدم يسارًا والأحدث يمينًا
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownRows, prevRows, prevShift, gran, compare, hidden, isAll]);

  // ── التكبير والسحب: نافذة [start, end] على النقاط (الشريط السفلي + أزرار التكبير) ──
  const [win, setWin] = useState<{ start: number; end: number } | null>(null);
  const dataSig = `${data.length}|${data[0]?.key}|${data[data.length - 1]?.key}`;
  useEffect(() => setWin(null), [dataSig]);
  const start = win?.start ?? 0;
  const end = Math.min(win?.end ?? data.length - 1, data.length - 1);
  const vis = useMemo(() => data.slice(start, end + 1), [data, start, end]);
  const zoomed = data.length > 0 && (start > 0 || end < data.length - 1);
  const zoom = (dir: 1 | -1) => {
    const len = end - start + 1;
    const next = dir === 1 ? Math.max(3, Math.round(len * 0.6)) : Math.min(data.length, Math.round(len / 0.6) + 1);
    const mid = (start + end) / 2;
    let s = Math.round(mid - (next - 1) / 2);
    s = Math.max(0, Math.min(s, data.length - next));
    setWin({ start: s, end: s + next - 1 });
  };

  // ── المؤشرات (للنافذة الظاهرة) ──
  const kpi = useMemo(() => {
    const inbound = vis.reduce((a, d) => a + d.inbound, 0);
    const count = vis.reduce((a, d) => a + d.count, 0);
    const priced = vis.filter(d => d.price !== null);
    const wCost = vis.reduce((a, d) => a + d.pc, 0);
    const wQty = vis.reduce((a, d) => a + d.pq, 0);
    const asc = priced;
    const max = priced.length ? priced.reduce((a, d) => ((d.maxP ?? d.price!) > (a.maxP ?? a.price!) ? d : a)) : null;
    const min = priced.length ? priced.reduce((a, d) => ((d.minP ?? d.price!) < (a.minP ?? a.price!) ? d : a)) : null;
    const perCat = visibleCats.map(c => {
      const pts = vis.filter(d => d[`p_${c.key}`] !== null && d[`p_${c.key}`] !== undefined);
      const q = vis.reduce((a, d) => a + (Number(d[c.key]) || 0), 0);
      const wc = vis.reduce((a, d) => a + (Number(d[`c_${c.key}`]) || 0), 0);
      const wq = vis.reduce((a, d) => a + (Number(d[`q_${c.key}`]) || 0), 0);
      return {
        ...c, inbound: q, price: wq > 0 ? wc / wq : 0,
        first: pts.length ? Number(pts[0][`p_${c.key}`]) : null, last: pts.length ? Number(pts[pts.length - 1][`p_${c.key}`]) : null
      };
    });
    return {
      inbound, count, price: wQty > 0 ? wCost / wQty : 0, max, min,
      first: asc[0]?.price ?? null, last: asc[asc.length - 1]?.price ?? null, perCat
    };
  }, [vis, visibleCats]);

  // أعلى وأدنى نقطة سعر في النافذة (علامات على الرسم)
  const extremes = useMemo(() => {
    const priced = vis.filter(d => d.price !== null);
    if (priced.length < 2) return null;
    const hi = priced.reduce((a, d) => (d.price! > a.price! ? d : a));
    const lo = priced.reduce((a, d) => (d.price! < a.price! ? d : a));
    return hi.key === lo.key ? null : { hi, lo };
  }, [vis]);

  const hasPrice = vis.some(d => (isAll ? visibleCats.some(c => d[`p_${c.key}`] != null) : d.price !== null));
  const dense = vis.length > 24;

  // ── تصدير ──
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const sheet = vis.map(d => {
      const row: Record<string, string | number> = {
        [tr('الفترة')]: d.from === d.to ? d.from : `${d.from} — ${d.to}`,
        [tr('الوارد (لتر)')]: d.inbound,
        [tr('عدد الشحنات')]: d.count,
        [tr('متوسط السعر')]: d.price ?? ''
      };
      if (gran !== 'day') {
        row[tr('أدنى سعر')] = d.minP ?? '';
        row[tr('أعلى سعر')] = d.maxP ?? '';
      }
      if (isAll) for (const c of visibleCats) {
        row[`${tr(c.title)} — ${tr('الوارد')}`] = Number(d[c.key]) || 0;
        row[`${tr(c.title)} — ${tr('السعر')}`] = (d[`p_${c.key}`] as number | null) ?? '';
      }
      if (compare) {
        row[tr('وارد الفترة السابقة')] = d.prevInbound ?? '';
        row[tr('سعر الفترة السابقة')] = d.prevPrice ?? '';
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, 'المشتريات');
    XLSX.writeFile(wb, `مشتريات-${title}-${vis[0]?.from ?? ''}-${vis[vis.length - 1]?.to ?? ''}.xlsx`.replace(/\//g, '-'));
  };

  const exportPng = async () => {
    const root = cardRef.current;
    if (!root) return;
    const svgs = [...root.querySelectorAll<SVGSVGElement>('svg.recharts-surface')].filter(s => s.getBoundingClientRect().height > 80);
    if (!svgs.length) return;
    const scale = 2, pad = 16, head = 56;
    const sizes = svgs.map(s => s.getBoundingClientRect());
    const W = Math.max(...sizes.map(s => s.width)) + pad * 2;
    const H = head + sizes.reduce((a, s) => a + s.height + pad, 0) + pad;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px Cairo, Tahoma, sans-serif';
    ctx.fillText(`${tr('حركة الوارد والسعر')} — ${tr(title)}`, W - pad, 28);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Cairo, Tahoma, sans-serif';
    ctx.fillText(`${vis[0]?.from ?? ''} — ${vis[vis.length - 1]?.to ?? ''} · ${tr(GRAN_LABEL[gran])}`, W - pad, 46);
    let y = head;
    for (let i = 0; i < svgs.length; i++) {
      const clone = svgs[i].cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(sizes[i].width));
      clone.setAttribute('height', String(sizes[i].height));
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
      await img.decode();
      ctx.drawImage(img, pad, y, sizes[i].width, sizes[i].height);
      y += sizes[i].height + pad;
    }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `مشتريات-${title}.png`;
    a.click();
  };

  // ملء الشاشة: Esc للخروج
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const pick = (payload?: { from?: string; to?: string }) => {
    if (!payload?.from || !payload.to) return;
    setFull(false); // الخروج من ملء الشاشة حتى يظهر الجدول
    onPickRange(payload.from, payload.to);
  };

  const toggleCat = (k: CategoryKey) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else if (presentCats.length - next.size > 1) next.add(k); // يبقى قسم واحد ظاهر على الأقل
      return next;
    });

  const iconBtn = (active = false) =>
    `h-8 px-2.5 inline-flex items-center gap-1.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
    }`;
  const hPrice = full ? 'h-[30vh]' : 'h-48';
  const hBars = full ? 'h-[30vh]' : 'h-48';

  // ── التلميح (في لوحة السعر؛ لوحة الوارد تُظهر المؤشر فقط) ──
  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: Bucket }[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const i = data.findIndex(x => x.key === d.key);
    const prev = i > 0 ? data[i - 1] : undefined; // النقطة الأقدم (السابقة)
    return (
      <div dir="rtl" className="rounded-xl px-3 py-2.5 text-[11px] bg-white/95 dark:bg-slate-900/95 backdrop-blur ring-1 ring-slate-200 dark:ring-white/15 shadow-xl space-y-1.5 min-w-[210px]">
        <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
          <span className="font-mono font-bold text-slate-600 dark:text-white/80">{d.from === d.to ? d.from : `${d.from} — ${d.to}`}</span>
          <span className="text-[10px] text-slate-400">{d.count} {tr('شحنة')}{gran !== 'day' ? ` · ${d.days} ${tr('يوم')}` : ''}</span>
        </div>
        {isAll ? (
          visibleCats.filter(c => d[c.key]).map(c => (
            <div key={c.key} className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded-[2px]" style={{ background: c.color }} />{tr(c.title)}</span>
              <span className="font-mono">{formatNumber(Number(d[c.key]))} · <b>{fmtPrice(Number(d[`p_${c.key}`]) || 0)}</b></span>
            </div>
          ))
        ) : (
          <>
            <div className="flex justify-between gap-3 font-bold text-slate-800 dark:text-slate-100">
              <span className="flex items-center gap-1.5"><span className="w-3 border-t-2 border-blue-600" />{tr('متوسط السعر')}</span>
              <span className="font-mono font-black">{fmtPrice(d.price ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-3 text-[10.5px] text-slate-500 dark:text-slate-400">
              <span>{tr(gran === 'day' ? 'عن اليوم السابق' : gran === 'week' ? 'عن الأسبوع السابق' : 'عن الشهر السابق')}</span>
              <Delta v={pct(d.price, prev?.price)} />
            </div>
            {kpi.price > 0 && (
              <div className="flex justify-between gap-3 text-[10.5px] text-slate-500 dark:text-slate-400">
                <span>{tr('عن متوسط الفترة')}</span>
                <Delta v={pct(d.price, kpi.price)} />
              </div>
            )}
            {gran !== 'day' && d.minP !== null && (
              <div className="flex justify-between gap-3 text-[10.5px] text-slate-500 dark:text-slate-400">
                <span>{tr('المدى اليومي')}</span>
                <span className="font-mono">{fmtPrice(d.minP)} – {fmtPrice(d.maxP ?? 0)}</span>
              </div>
            )}
            {showMA && d.ma !== null && (
              <div className="flex justify-between gap-3 text-[10.5px] text-amber-700 dark:text-amber-400">
                <span>{tr(MA_LABEL[gran])}</span>
                <span className="font-mono font-bold">{fmtPrice(d.ma)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between gap-3 font-black text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-800">
          <span>{tr(isAll ? 'إجمالي الوارد' : 'الوارد')}</span>
          <span className="font-mono">{formatNumber(d.inbound)} <span className="text-[9.5px] font-bold text-slate-400">{tr('لتر')}</span></span>
        </div>
        <div className="flex justify-between gap-3 text-[10.5px] text-slate-500 dark:text-slate-400">
          <span>{tr('تغيّر الوارد')}</span>
          <Delta v={pct(d.inbound, prev?.inbound)} upIsBad={false} />
        </div>
        {compare && (
          <div className="pt-1 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-1 text-[10.5px] text-slate-500 dark:text-slate-400">
            <div className="flex justify-between gap-3"><span>{tr('الفترة السابقة — الوارد')}</span><span className="font-mono">{d.prevInbound ? formatNumber(d.prevInbound) : '—'}</span></div>
            {!isAll && <div className="flex justify-between gap-3"><span>{tr('الفترة السابقة — السعر')}</span><span className="font-mono">{fmtPrice(d.prevPrice ?? 0)}</span></div>}
          </div>
        )}
        <div className="flex items-center gap-1 text-[9.5px] text-slate-400 pt-0.5"><MousePointerClick className="w-3 h-3" />{tr('انقر لعرض هذه الفترة في الجدول')}</div>
      </div>
    );
  };

  const xAxisCommon = { dataKey: 'key', tickFormatter: (k: string) => data.find(d => d.key === k)?.label ?? k };

  const card = (
    <div
      ref={cardRef}
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden ${
        full ? 'fixed inset-3 sm:inset-6 z-[210] rounded-3xl shadow-2xl overflow-y-auto' : 'rounded-3xl shadow-soft-card'
      }`}
      dir="rtl"
    >
      {/* الترويسة + دليل الألوان القابل للنقر */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
            <LineChartIcon className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">{tr('حركة الوارد والسعر')}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tr(title)} — {tr(GRAN_LABEL[gran])}
              {vis.length > 0 && <span className="font-mono"> · {vis[0].from} — {vis[vis.length - 1].to}</span>}
            </p>
          </div>
        </div>
        {isAll && presentCats.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {presentCats.map(c => {
              const off = hidden.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleCat(c.key)}
                  title={tr(off ? 'إظهار' : 'إخفاء')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    off ? 'border-dashed border-slate-300 dark:border-slate-700 text-slate-400 line-through' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: off ? 'transparent' : c.color, boxShadow: off ? `inset 0 0 0 1.5px ${c.color}` : undefined }} />
                  {tr(c.title)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* شريط الأدوات: التجميع، الإضافات، التكبير، التصدير، ملء الشاشة */}
      <div className="px-4 sm:px-5 mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {(['auto', 'day', 'week', 'month'] as GranChoice[]).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGranChoice(g)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${granChoice === g ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {tr(GRAN_LABEL[g])}{g === 'auto' && granChoice === 'auto' ? ` (${tr(GRAN_LABEL[gran])})` : ''}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowMA(v => !v)} disabled={isAll} className={iconBtn(showMA && !isAll)} title={tr(MA_LABEL[gran])}>
          <Activity className="w-3.5 h-3.5" />{tr('متوسط متحرك')}
        </button>
        <button type="button" onClick={() => setCompare(v => !v)} className={iconBtn(compare)} title={tr('مقارنة مع الفترة السابقة بنفس الطول')}>
          <GitCompareArrows className="w-3.5 h-3.5" />{tr('مقارنة بالفترة السابقة')}
        </button>
        <div className="flex items-center gap-1 ms-auto">
          <button type="button" onClick={() => zoom(1)} disabled={vis.length <= 3} className={iconBtn()} title={tr('تكبير')}><ZoomIn className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => zoom(-1)} disabled={!zoomed} className={iconBtn()} title={tr('تصغير')}><ZoomOut className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setWin(null)} disabled={!zoomed} className={iconBtn()} title={tr('عرض الفترة كاملة')}><RotateCcw className="w-3.5 h-3.5" /></button>
          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button type="button" onClick={exportPng} disabled={!vis.length} className={iconBtn()} title={tr('تصدير صورة PNG')}><ImageIcon className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={exportExcel} disabled={!vis.length} className={iconBtn()} title={tr('تصدير Excel')}><FileSpreadsheet className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setFull(v => !v)} className={iconBtn(full)} title={tr(full ? 'خروج من ملء الشاشة' : 'ملء الشاشة')}>
            {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* شريط المؤشرات (للنافذة الظاهرة) */}
      <div className="mx-4 sm:mx-5 mt-3 flex flex-wrap gap-px rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-200/90 dark:bg-slate-800 overflow-hidden">
        <div className="flex-1 min-w-[150px] px-3.5 py-3 bg-slate-50 dark:bg-slate-900">
          <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">{tr('إجمالي الوارد')}</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-lg font-black font-mono tabular-nums text-slate-900 dark:text-white">{formatNumber(kpi.inbound)}</span>
            <span className="text-[10px] font-bold text-slate-400">{tr('لتر')}</span>
          </div>
          <div className="text-[10px] text-slate-400">{formatNumber(kpi.count)} {tr('شحنة')} · {vis.length} {tr(gran === 'day' ? 'يوم' : gran === 'week' ? 'أسبوع' : 'شهر')}</div>
        </div>
        {isAll ? (
          kpi.perCat.map(c => (
            <div key={c.key} className="flex-1 min-w-[150px] px-3.5 py-3 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 truncate">
                <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: c.color }} />{tr(c.title)}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-lg font-black font-mono tabular-nums text-slate-900 dark:text-white">{fmtPrice(c.price)}</span>
                <span className="text-[10px] font-bold text-slate-400">{tr('د.ع')}</span>
              </div>
              <div className="text-[10px] flex items-center gap-1.5 text-slate-400">
                <Delta v={pct(c.last, c.first)} />
                <span className="font-mono truncate">{formatNumber(c.inbound)} {tr('لتر')}</span>
              </div>
            </div>
          ))
        ) : (
          <>
            {[
              { label: 'متوسط السعر الموزون', value: fmtPrice(kpi.price), sub: tr('حسب الكميات') },
              { label: 'أعلى سعر', value: kpi.max ? fmtPrice(kpi.max.maxP ?? kpi.max.price ?? 0) : '—', sub: kpi.max ? (kpi.max.from === kpi.max.to ? kpi.max.from : `${kpi.max.from.slice(5)} — ${kpi.max.to.slice(5)}`) : '' },
              { label: 'أدنى سعر', value: kpi.min ? fmtPrice(kpi.min.minP ?? kpi.min.price ?? 0) : '—', sub: kpi.min ? (kpi.min.from === kpi.min.to ? kpi.min.from : `${kpi.min.from.slice(5)} — ${kpi.min.to.slice(5)}`) : '' }
            ].map(k => (
              <div key={k.label} className="flex-1 min-w-[150px] px-3.5 py-3 bg-slate-50 dark:bg-slate-900">
                <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">{tr(k.label)}</div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-lg font-black font-mono tabular-nums text-slate-900 dark:text-white">{k.value}</span>
                  <span className="text-[10px] font-bold text-slate-400">{tr('د.ع')}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">{k.sub}</div>
              </div>
            ))}
            <div className="flex-1 min-w-[150px] px-3.5 py-3 bg-slate-50 dark:bg-slate-900">
              <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">{tr('اتجاه السعر')}</div>
              {kpi.first !== null && kpi.last !== null ? (
                <>
                  <div className="mt-0.5 flex items-center gap-1 text-lg font-black">
                    {(() => {
                      const v = pct(kpi.last, kpi.first) ?? 0;
                      const Icon = v > 0.05 ? TrendingUp : v < -0.05 ? TrendingDown : Minus;
                      return <><Icon className={`w-4 h-4 ${v > 0.05 ? 'text-rose-600' : v < -0.05 ? 'text-emerald-600' : 'text-slate-400'}`} /><Delta v={v} className="text-lg" /></>;
                    })()}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{fmtPrice(kpi.first)} ← {fmtPrice(kpi.last)}</div>
                </>
              ) : (
                <div className="mt-0.5 text-lg font-black text-slate-400">—</div>
              )}
            </div>
          </>
        )}
      </div>

      {data.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-sm text-slate-400">{tr('لا توجد بيانات للرسم')}</div>
      ) : (
        <div className="px-2 sm:px-3 pb-3 pt-2" dir="ltr">
          {/* اللوحة 1: السعر */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2" dir="rtl">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
              {tr(isAll ? 'سعر كل منتج' : 'متوسط سعر الشراء')} <span className="font-bold text-slate-400">({tr('د.ع / لتر')})</span>
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
              {!isAll && kpi.price > 0 && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-slate-400" />{tr('متوسط الفترة')} <span className="font-mono">{fmtPrice(kpi.price)}</span></span>}
              {!isAll && showMA && <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400"><span className="w-4 border-t-2 border-amber-500" />{tr(MA_LABEL[gran])}</span>}
              {compare && !isAll && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dotted border-slate-400" />{tr('الفترة السابقة')}</span>}
            </div>
          </div>
          <div className={hPrice}>
            {hasPrice ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={vis} syncId="purchases" syncMethod="value" margin={{ top: 18, right: 8, left: 8, bottom: 0 }} onClick={e => pick(e?.activePayload?.[0]?.payload)} style={{ cursor: 'pointer' }}>
                  <defs>
                    <linearGradient id="purchPriceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(148,163,184,0.28)" vertical={false} />
                  <XAxis {...xAxisCommon} hide />
                  <YAxis orientation="right" width={52} axisLine={false} tickLine={false} tickCount={4}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    domain={[(min: number) => Math.floor(min * 0.985), (max: number) => Math.ceil(max * 1.015)]} />
                  {/* عمود شفاف على محور مخفي: يضع نقاط السعر في منتصف أعمدة لوحة الوارد تمامًا */}
                  <YAxis yAxisId="align" hide />
                  <Bar yAxisId="align" dataKey="inbound" fill="transparent" isAnimationActive={false} activeBar={false} />
                  <Tooltip cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} content={renderTooltip as never} />
                  {isAll ? (
                    visibleCats.map(c => (
                      <Line key={c.key} type="monotone" dataKey={`p_${c.key}`} stroke={c.color} strokeWidth={2} connectNulls isAnimationActive={false}
                        dot={dense ? false : { r: 3, fill: c.color, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                    ))
                  ) : (
                    <>
                      {kpi.price > 0 && <ReferenceLine y={r1(kpi.price)} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.25} />}
                      {compare && <Line type="monotone" dataKey="prevPrice" stroke="#94a3b8" strokeWidth={1.75} strokeDasharray="2 4" dot={false} connectNulls isAnimationActive={false} />}
                      <Area type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} fill="url(#purchPriceFill)" connectNulls isAnimationActive={false}
                        dot={dense ? false : { r: 3, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
                      {showMA && <Line type="monotone" dataKey="ma" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
                      {/* علامات أعلى وأدنى سعر */}
                      {extremes && (
                        <>
                          <ReferenceDot x={extremes.hi.key} y={extremes.hi.price!} r={5} fill="#e11d48" stroke="#fff" strokeWidth={2}
                            label={{ value: `▲ ${fmtPrice(extremes.hi.price!)}`, position: 'top', fill: '#e11d48', fontSize: 10, fontWeight: 800 }} />
                          <ReferenceDot x={extremes.lo.key} y={extremes.lo.price!} r={5} fill="#059669" stroke="#fff" strokeWidth={2}
                            label={{ value: `▼ ${fmtPrice(extremes.lo.price!)}`, position: 'bottom', fill: '#059669', fontSize: 10, fontWeight: 800 }} />
                        </>
                      )}
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400" dir="rtl">{tr('لا توجد أسعار مسجلة لهذه الفترة')}</div>
            )}
          </div>

          {/* اللوحة 2: الوارد (مكدّس حسب القسم في "عرض الكل") + شريط التكبير والسحب */}
          <div className="flex items-center justify-between px-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-1" dir="rtl">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{tr(gran === 'day' ? 'الوارد اليومي' : gran === 'week' ? 'الوارد الأسبوعي' : 'الوارد الشهري')} <span className="font-bold text-slate-400">({tr('لتر')})</span></span>
            {compare && <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 dark:text-slate-400"><span className="w-4 border-t-2 border-dashed border-slate-400" />{tr('وارد الفترة السابقة')}</span>}
          </div>
          <div className={hBars}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vis} syncId="purchases" syncMethod="value" margin={{ top: 10, right: 8, left: 8, bottom: 0 }} barCategoryGap="24%" onClick={e => pick(e?.activePayload?.[0]?.payload)} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="2 6" stroke="rgba(148,163,184,0.28)" vertical={false} />
                <XAxis {...xAxisCommon} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} minTickGap={10} />
                <YAxis orientation="right" width={52} axisLine={false} tickLine={false} tickCount={4} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} tickFormatter={fmtQtyAxis} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={() => null} />
                {isAll ? (
                  visibleCats.map((c, i) => (
                    <Bar key={c.key} dataKey={c.key} stackId="inbound" fill={c.color} maxBarSize={32} isAnimationActive={false} radius={i === visibleCats.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))
                ) : (
                  <Bar dataKey="inbound" fill="#10b981" maxBarSize={32} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                )}
                {compare && <Line type="monotone" dataKey="prevInbound" stroke="#94a3b8" strokeWidth={1.75} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* شريط التكبير والسحب: أعمدة مصغرة لكل الفترة، محاذٍ لمساحة الرسم (هامش 8 يسارًا، 8 + عرض المحور 52 يمينًا) */}
          <div className="mt-2">
            <RangeNavigator data={data} start={start} end={end} onChange={setWin} insetLeft={8} insetRight={60} />
          </div>
        </div>
      )}
    </div>
  );

  return full
    ? createPortal(
        <>
          <div className="fixed inset-0 z-[205] bg-slate-950/60 backdrop-blur-sm" onClick={() => setFull(false)} />
          {card}
        </>,
        document.body
      )
    : card;
};

export default PurchasesChart;
