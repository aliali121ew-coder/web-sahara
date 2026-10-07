import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ZoomIn, ZoomOut, Users, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../i18n/format';
import { formatNumber } from '../../lib/utils';
import type { InboundDelivery } from '../../types';
import { RangeBar } from './SupplierChartExpanded';
import { LiteLines } from './LiteLines';

type Metric = 'qty' | 'tankers' | 'price';
type Gran = 'month' | 'week' | 'day';
const GRANS: Gran[] = ['month', 'week', 'day'];

export interface CompareSupplier { id: string; name: string; qty: number; ds: InboundDelivery[] }
interface Series { id: string; name: string; color: string }
type Row = Record<string, number | string | null> & { key: string; full: string };

const OTHER = '__other';
const OTHER_COLOR = '#94a3b8';
const MAX_SELECTED = 6;
const WINDOW = 60;
const MAX_DRAWN = 360;
const DAY = 86400000;
const ACCENT = '#0d9488';

const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;
const qtyOf = (d: InboundDelivery) => d.receivedQuantity || d.volumeLiters || 0;
const dayOf = (d: InboundDelivery) => (d.receiptUnloadDate || d.date || '').split(' ')[0].replace(/-/g, '/');
const toDate = (day: string) => { const [y, m, dd] = day.split('/').map(Number); return new Date(y, m - 1, dd || 1); };
const ymd = (dt: Date) => `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
const weekStart = (day: string) => { const dt = toDate(day); dt.setDate(dt.getDate() - ((dt.getDay() + 1) % 7)); return ymd(dt); };
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : formatNumber(Math.round(v)));

/** يختصر النقاط الزائدة مع الحفاظ على قمة وقاع كل مقطع (حسب مجموع السلاسل الظاهرة) */
const decimate = (pts: Row[], ids: string[], max = MAX_DRAWN): Row[] => {
  if (pts.length <= max) return pts;
  const total = (r: Row) => ids.reduce((a, id) => a + ((r[id] as number) || 0), 0);
  const chunk = Math.ceil(pts.length / (max / 2));
  const out: Row[] = [];
  for (let i = 0; i < pts.length; i += chunk) {
    let lo = i, hi = i;
    for (let j = i; j < Math.min(i + chunk, pts.length); j++) {
      if (total(pts[j]) < total(pts[lo])) lo = j;
      if (total(pts[j]) > total(pts[hi])) hi = j;
    }
    if (lo === hi) out.push(pts[lo]);
    else out.push(pts[Math.min(lo, hi)], pts[Math.max(lo, hi)]);
  }
  return out;
};

/** الرسم نفسه (React.memo): لا يُعاد رسمه إلا عند تغيّر نقاطه أو سلاسله */
const WavesView = React.memo(({ points, series, metric, ticks, tickLabel, tooltip, spot, onPick }: {
  points: Row[]; series: Series[]; metric: Metric; ticks: string[]; tickLabel: (k: string) => string; tooltip: (p: any) => React.ReactNode;
  spot: string | null; onPick?: (key: string) => void;
}) => {
  // توهج ناعم للخطوط عندما تكون النقاط معقولة العدد (لا يُطبَّق على الكثيف حفاظًا على السرعة)
  const glow = points.length <= 150;
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={60}>
      <AreaChart data={points} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}
        onClick={onPick ? (st: { activeLabel?: string | number }) => { if (st?.activeLabel != null) onPick(String(st.activeLabel)); } : undefined}
        style={onPick ? { cursor: 'pointer' } : undefined}>
        <defs>
          {series.map(s => (
            <React.Fragment key={s.id}>
              <linearGradient id={`cw-fill-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={s.id === OTHER ? 0.1 : 0.24} />
                <stop offset="60%" stopColor={s.color} stopOpacity={s.id === OTHER ? 0.03 : 0.06} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
              <filter id={`cw-glow-${s.id}`} x="-10%" y="-30%" width="120%" height="160%">
                <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor={s.color} floodOpacity="0.4" />
              </filter>
            </React.Fragment>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
        <XAxis dataKey="key" axisLine={false} tickLine={false} ticks={ticks} interval={0} tickFormatter={tickLabel} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={6} />
        <YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} tickFormatter={compact}
          domain={metric === 'price' ? ['dataMin - 20', 'dataMax + 20'] : [0, 'auto']} />
        <Tooltip isAnimationActive={false} content={tooltip} cursor={{ stroke: ACCENT, strokeWidth: 1.5, strokeDasharray: '3 3' }} wrapperStyle={{ outline: 'none', zIndex: 20 }} />
        {series.map(s => {
          // تسليط الضوء: المورد المؤشَّر عليه يبقى ساطعًا والبقية تخفت
          const dim = spot !== null && spot !== s.id;
          const lit = spot === s.id;
          return (
            <Area key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color}
              strokeWidth={lit ? 3.25 : s.id === OTHER ? 1.75 : 2.25} strokeOpacity={dim ? 0.18 : 1}
              strokeDasharray={s.id === OTHER ? '5 4' : undefined} fill={dim ? 'none' : `url(#cw-fill-${s.id})`}
              filter={glow && !dim && s.id !== OTHER ? `url(#cw-glow-${s.id})` : undefined}
              connectNulls isAnimationActive={false} dot={false}
              activeDot={dim ? false : { r: lit ? 6 : 4.5, stroke: s.color, strokeWidth: 2.5, fill: '#fff' }} />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
});

/**
 * أمواج المقارنة: الموردون المختارون (حتى 6) + «باقي الموردين» تجمع كل الكميات الأخرى،
 * مع تكبير/تصغير (شهري، أسبوعي، يومي) وشريط نطاق سريع بنفس تقنيات نافذة تحليل المورد.
 */
export const CompareWaves: React.FC<{ suppliers: CompareSupplier[]; metric: Metric; palette: string[]; resetKey: string }> = ({ suppliers, metric, palette, resetKey }) => {
  const { t, i18n } = useTranslation(['suppliers', 'common']);
  const [gran, setGran] = useState<Gran>('month');
  const ranked = useMemo(() => [...suppliers].sort((a, b) => b.qty - a.qty), [suppliers]);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { setSelected(ranked.slice(0, MAX_SELECTED).map(s => s.id)); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [spot, setSpot] = useState<string | null>(null);
  // شهر مفتوح بالضغط في العرض الشهري: يُعرض يومًا بيوم لكل الموردين
  const [focus, setFocus] = useState<string | null>(null);
  const openMonth = useCallback((key: string) => { setFocus(key.slice(0, 7)); setGran('day'); }, []);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const h = (e: MouseEvent) => { if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pickerOpen]);

  // اللون يتبع المورد (مكانه في القائمة المختارة)، و«باقي الموردين» رمادي متقطع
  const series = useMemo<Series[]>(() => {
    const chosen = selected.map((id, i) => ({ id, name: suppliers.find(s => s.id === id)?.name ?? '', color: palette[i % palette.length] })).filter(s => s.name);
    const hasOther = suppliers.length > chosen.length;
    return hasOther ? [...chosen, { id: OTHER, name: t('compare.others'), color: OTHER_COLOR }] : chosen;
  }, [selected, suppliers, palette, t]);
  const shownSeries = series.filter(s => !hidden.has(s.id));

  // جميع الكميات: كل شحنة تذهب لسلسلة موردها أو لـ«باقي الموردين»
  const data = useMemo<Row[]>(() => {
    const keyOf = (day: string) => (gran === 'month' ? day.slice(0, 7) : gran === 'week' ? weekStart(day) : day);
    const sel = new Set(selected);
    const acc = new Map<string, Map<string, { q: number; n: number; cost: number; pq: number }>>();
    suppliers.forEach(s => {
      const sid = sel.has(s.id) ? s.id : OTHER;
      s.ds.forEach(d => {
        const day = dayOf(d);
        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(day)) return;
        const k = keyOf(day);
        const m = acc.get(k) ?? new Map();
        const a = m.get(sid) ?? { q: 0, n: 0, cost: 0, pq: 0 };
        a.q += qtyOf(d); a.n += 1; if (priceOf(d) > 0) { a.cost += qtyOf(d) * priceOf(d); a.pq += qtyOf(d); }
        m.set(sid, a); acc.set(k, m);
      });
    });
    const keys = [...acc.keys()].sort();
    return keys.map(k => {
      const date = toDate(k);
      const row: Row = {
        key: k,
        full: gran === 'month' ? fmtDate(date, { month: 'long', year: 'numeric' })
          : gran === 'week' ? `${fmtDate(date, { day: 'numeric', month: 'short' })} – ${fmtDate(new Date(date.getTime() + 6 * DAY), { day: 'numeric', month: 'short', year: 'numeric' })}`
          : fmtDate(date, { dateStyle: 'medium' }),
      };
      const m = acc.get(k)!;
      series.forEach(s => {
        const a = m.get(s.id);
        row[s.id] = !a || !a.n ? null : metric === 'qty' ? a.q : metric === 'tankers' ? a.n : a.pq ? Math.round((a.cost / a.pq) * 10) / 10 : null;
      });
      return row;
    });
  }, [suppliers, selected, series, gran, metric]);

  // النافذة الظاهرة + شريط النطاق (حالة السحب معزولة هنا)
  const dataKey = `${resetKey}-${gran}-${data.length}`;
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (focus) {
      const first = data.findIndex(r => r.key.startsWith(focus));
      if (first >= 0) {
        let lastIdx = first;
        while (lastIdx + 1 < data.length && data[lastIdx + 1].key.startsWith(focus)) lastIdx++;
        setRange([first, Math.max(lastIdx, Math.min(first + 1, data.length - 1))]);
        return;
      }
    }
    setRange([Math.max(0, data.length - WINDOW), Math.max(0, data.length - 1)]);
  }, [dataKey, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = useDeferredValue(range);
  const last = Math.max(0, data.length - 1);
  const vs = Math.min(view[0], last), ve = Math.min(Math.max(view[1], view[0]), last);
  const visible = useMemo(() => data.slice(vs, ve + 1), [data, vs, ve]);
  const ids = useMemo(() => shownSeries.map(s => s.id), [shownSeries]);
  const liteSeries = useMemo(() => shownSeries.map(s => ({ id: s.id, color: s.color, dashed: s.id === OTHER })), [shownSeries]);
  // عدد النقاط المرسومة يقل مع عدد السلاسل حتى يبقى الرسم خفيفًا (≈ 1400 نقطة كحد أقصى لكل الخطوط)
  const maxPts = Math.max(80, Math.floor(1400 / Math.max(1, ids.length)));
  const points = useMemo(() => decimate(visible, ids, live ? Math.min(maxPts, 120) : maxPts), [visible, ids, live, maxPts]);

  const spanDays = visible.length ? (toDate(visible[visible.length - 1].key).getTime() - toDate(visible[0].key).getTime()) / DAY : 0;
  const dayTicks = gran !== 'day' || spanDays <= 45;
  const ticks = useMemo(() => {
    if (!points.length) return [];
    if (!dayTicks) {
      const out: string[] = []; let prev = '';
      points.forEach(r => { const m = r.key.slice(0, 7); if (m !== prev) { out.push(r.key); prev = m; } });
      return out;
    }
    const step = Math.max(1, Math.ceil(points.length / 10));
    const out = points.filter((_, i) => i % step === 0).map(r => r.key);
    const lk = points[points.length - 1].key;
    return out[out.length - 1] === lk ? out : [...out, lk];
  }, [points, dayTicks]);
  const multiYear = useMemo(() => new Set(points.map(r => r.key.slice(0, 4))).size > 1, [points]);
  const tickLabel = useCallback((k: string) => {
    const date = toDate(k);
    if (gran === 'month') return fmtDate(date, multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' });
    if (!dayTicks) return fmtDate(date, { month: 'short', year: '2-digit' });
    return fmtDate(date, { day: 'numeric', month: 'short' });
  }, [gran, dayTicks, multiYear]);

  const fmtVal = useCallback((v: number) => (metric === 'price' ? formatNumber(v) : formatNumber(Math.round(v))), [metric]);
  const dataIndex = useMemo(() => new Map(data.map((r, i) => [r.key, i])), [data]);
  const tooltip = useCallback(({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as Row;
    const idx = dataIndex.get(row.key) ?? -1;
    // القيمة السابقة لكل مورد (آخر فترة قبلها فيها قيمة) لحساب التغيّر
    const prevOf = (id: string) => { for (let i = idx - 1; i >= 0; i--) { const v = data[i][id]; if (typeof v === 'number') return v; } return null; };
    const items = shownSeries.filter(s => row[s.id] != null).sort((a, b) => (row[b.id] as number) - (row[a.id] as number));
    const sum = items.reduce((a, s) => a + (row[s.id] as number), 0);
    const top = items.length ? (row[items[0].id] as number) : 1;
    return (
      <div dir={i18n.dir()} className="w-[330px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700 shadow-[0_18px_40px_-14px_rgba(15,23,42,0.45)] overflow-hidden text-start">
        <div className="px-4 py-3 bg-gradient-to-l from-teal-500 to-cyan-600 text-white flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold">{row.full}</span>
          {metric !== 'price' && <span className="kpi-num text-[14px]">{fmtVal(sum)}</span>}
        </div>
        <div className="px-3.5 py-2.5 space-y-2">
          {items.map((s, i) => {
            const v = row[s.id] as number;
            const prev = prevOf(s.id);
            const delta = prev ? Math.round(((v - prev) / prev) * 1000) / 10 : null;
            return (
              <div key={s.id}>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-4 text-[10px] font-bold text-slate-400 tabular-nums">{i + 1}</span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="truncate text-slate-700 dark:text-slate-200 font-medium">{s.name}</span>
                  {delta !== null && delta !== 0 && (
                    <span dir="ltr" className={`text-[10px] font-semibold tabular-nums ${(delta > 0) === (metric === 'price') ? 'text-rose-500' : 'text-emerald-600'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>
                  )}
                  <span className="ms-auto kpi-num text-[12.5px] text-slate-900 dark:text-white">{fmtVal(v)}</span>
                </div>
                <div className="ms-6 mt-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (v / top) * 100)}%`, background: s.color }} />
                </div>
              </div>
            );
          })}
          {!items.length && <div className="text-[12px] text-slate-400">—</div>}
        </div>
        {gran === 'month' && <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 text-[10.5px] text-teal-600 dark:text-teal-400">{t('compare.clickMonth')}</div>}
      </div>
    );
  }, [shownSeries, metric, fmtVal, i18n, data, dataIndex, gran, t]);

  const toggleSelect = (id: string) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX_SELECTED ? prev : [...prev, id]));
  const zoom = (dir: 1 | -1) => { setFocus(null); setGran(g => GRANS[Math.min(GRANS.length - 1, Math.max(0, GRANS.indexOf(g) + dir))]); };

  return (
    <>
      {/* أدوات الأمواج: اختيار الموردين، التكبير والتصغير، ومفتاح السلاسل */}
      <div className="relative shrink-0 px-4 sm:px-6 pt-3 flex flex-wrap items-center gap-2">
        <div ref={pickerRef} className="relative">
          <button type="button" onClick={() => setPickerOpen(o => !o)} aria-expanded={pickerOpen}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:border-teal-400 cursor-pointer">
            <Users className="w-4 h-4 text-teal-600" /> {t('compare.pick', { count: selected.length, max: MAX_SELECTED })} <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {pickerOpen && (
            <div className="absolute z-30 top-full mt-1.5 start-0 w-72 max-h-80 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-1">
              {ranked.map(s => {
                const on = selected.includes(s.id);
                const full = !on && selected.length >= MAX_SELECTED;
                return (
                  <button key={s.id} type="button" disabled={full} onClick={() => toggleSelect(s.id)}
                    className={`w-full px-2.5 py-2 rounded-lg flex items-center gap-2 text-start text-[12.5px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-teal-500 border-teal-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{on && <Check className="w-3 h-3" />}</span>
                    <span className="truncate flex-1">{s.name}</span>
                    <span className="kpi-num text-[11px] text-slate-400">{compact(s.qty)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50">
          <button type="button" onClick={() => zoom(-1)} disabled={gran === 'month'} aria-label={t('profile.zoomOut')} title={t('profile.zoomOut')}
            className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"><ZoomOut className="w-4 h-4" /></button>
          <span className="px-2 text-[12px] font-semibold text-teal-600 dark:text-teal-300 whitespace-nowrap min-w-[56px] text-center">{t(`profile.gran.${gran}`)}</span>
          <button type="button" onClick={() => zoom(1)} disabled={gran === 'day'} aria-label={t('profile.zoomIn')} title={t('profile.zoomIn')}
            className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"><ZoomIn className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 ms-auto">
          {series.map(s => {
            const on = !hidden.has(s.id);
            return (
              <button key={s.id} type="button" aria-pressed={on}
                onMouseEnter={() => setSpot(s.id)} onMouseLeave={() => setSpot(null)}
                onClick={() => setHidden(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else if (series.length - n.size > 1) n.add(s.id); return n; })}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-semibold transition-all cursor-pointer ${on ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm' : 'opacity-45 line-through bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500'}`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex-1 min-h-[260px] px-2 sm:px-4 pt-3" dir="ltr">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">{t('profile.empty')}</div>
        ) : (
          live ? (
            // أثناء السحب: رسم SVG خفيف جدًا (خطوط فقط)، والرسم الكامل يعود عند الإفلات
            <LiteLines points={points} series={liteSeries} ticks={ticks} tickLabel={tickLabel} yFrom={metric === 'price' ? 'data' : 'zero'} format={compact} />
          ) : (
            <WavesView points={points} series={shownSeries} metric={metric} ticks={ticks} tickLabel={tickLabel} tooltip={tooltip}
              spot={spot} onPick={gran === 'month' ? openMonth : undefined} />
          )
        )}
      </div>
      {data.length > WINDOW && (
        <div className="relative shrink-0 px-4 sm:px-6 pt-2 pb-3" dir="ltr"
          onPointerDown={() => setLive(true)} onPointerUp={() => setLive(false)} onPointerCancel={() => setLive(false)} onPointerLeave={e => { if (e.buttons === 0) setLive(false); }}>
          <RangeBar count={data.length} value={range} onChange={setRange} onEnd={() => setLive(false)}
            startLabel={data[range[0]]?.full ?? ''} endLabel={data[range[1]]?.full ?? ''} />
        </div>
      )}
    </>
  );
};
