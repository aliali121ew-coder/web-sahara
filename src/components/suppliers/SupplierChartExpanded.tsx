import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Brush } from 'recharts';
import { Activity, BarChart3, Waves, X, Droplets, Truck, Coins, CalendarRange, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../i18n/format';
import { formatNumber } from '../../lib/utils';
import { deliveryCompany } from '../../lib/archiveSuppliers';
import type { InboundDelivery } from '../../types';
import { COMPANY_COLOR, type Company } from './supplierUi';

interface Row { d: InboundDelivery; co: Company }
export type Period = 'd30' | 'd90' | 'm12' | 'all';
type Metric = 'qty' | 'tankers' | 'price';
type Mode = 'waves' | 'bars';

interface Bucket { key: string; label: string; full: string; sahara: number | null; etihad: number | null; saharaQ: number; etihadQ: number; saharaN: number; etihadN: number; saharaP: number; etihadP: number; ship?: Row }

const DAY = 86400000;
const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;
const qtyOf = (d: InboundDelivery) => d.receivedQuantity || d.volumeLiters || 0;
const dayOf = (d: InboundDelivery) => (d.receiptUnloadDate || d.date || '').split(' ')[0].replace(/-/g, '/');
const toDate = (day: string) => { const [y, m, dd] = day.split('/').map(Number); return new Date(y, m - 1, dd || 1); };
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : formatNumber(Math.round(v)));

/** مستويات التكبير: من الأعم إلى الأدق؛ «shipment» تعرض كل شحنة واردة نقطةً مستقلة */
export type Gran = 'month' | 'week' | 'day' | 'shipment';
export const GRANS: Gran[] = ['month', 'week', 'day', 'shipment'];

const ymd = (dt: Date) => `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
/** بداية الأسبوع (السبت) */
const weekStart = (day: string) => { const dt = toDate(day); dt.setDate(dt.getDate() - ((dt.getDay() + 1) % 7)); return ymd(dt); };

/**
 * تجميع شحنات المورد حسب الفترة ومستوى التكبير (شهري/أسبوعي/يومي/كل شحنة).
 * الفترة تُحسب من آخر يوم وارد للمورد (لا من اليوم) حتى لا تظهر فارغة لمورد توقف وارده،
 * وتُعرض فقط الفترات التي فيها وارد فيمتلئ الرسم بالبيانات الفعلية.
 */
export const buildBuckets = (rows: Row[], period: Period, metric: Metric, gran: Gran = 'month'): Bucket[] => {
  const valid = rows.filter(r => /^\d{4}\/\d{2}\/\d{2}$/.test(dayOf(r.d)));
  if (!valid.length) return [];
  const last = valid.reduce((m, r) => (dayOf(r.d) > m ? dayOf(r.d) : m), '');
  const lastTs = toDate(last).getTime();
  const from = period === 'd30' ? lastTs - 29 * DAY : period === 'd90' ? lastTs - 89 * DAY : period === 'm12' ? new Date(toDate(last).getFullYear(), toDate(last).getMonth() - 11, 1).getTime() : 0;
  const inRange = valid.filter(r => toDate(dayOf(r.d)).getTime() >= from).sort((a, b) => dayOf(a.d).localeCompare(dayOf(b.d)));

  // كل شحنة نقطة مستقلة
  if (gran === 'shipment') {
    return inRange.map(({ d, co }, i) => {
      const day = dayOf(d);
      const q = qtyOf(d), p = priceOf(d);
      const v = metric === 'qty' ? q : metric === 'tankers' ? 1 : p || null;
      return {
        key: `${day}#${i}`, label: fmtDate(toDate(day), { day: 'numeric', month: 'short' }), full: fmtDate(toDate(day), { dateStyle: 'medium' }),
        sahara: co === 'sahara' ? v : null, etihad: co === 'etihad' ? v : null,
        saharaQ: co === 'sahara' ? q : 0, etihadQ: co === 'etihad' ? q : 0, saharaN: co === 'sahara' ? 1 : 0, etihadN: co === 'etihad' ? 1 : 0,
        saharaP: co === 'sahara' ? p : 0, etihadP: co === 'etihad' ? p : 0, ship: { d, co },
      };
    });
  }

  const keyOf = (day: string) => (gran === 'month' ? day.slice(0, 7) : gran === 'week' ? weekStart(day) : day);
  const acc = new Map<string, { q: Record<Company, number>; n: Record<Company, number>; cost: Record<Company, number>; pq: Record<Company, number> }>();
  inRange.forEach(({ d, co }) => {
    const key = keyOf(dayOf(d));
    const a = acc.get(key) ?? { q: { sahara: 0, etihad: 0 }, n: { sahara: 0, etihad: 0 }, cost: { sahara: 0, etihad: 0 }, pq: { sahara: 0, etihad: 0 } };
    a.q[co] += qtyOf(d); a.n[co] += 1;
    if (priceOf(d) > 0) { a.cost[co] += qtyOf(d) * priceOf(d); a.pq[co] += qtyOf(d); }
    acc.set(key, a);
  });
  const keys = [...acc.keys()].sort();
  const multiYear = new Set(keys.map(k => k.slice(0, 4))).size > 1;
  return keys.map(key => {
    const a = acc.get(key)!;
    const price = (c: Company) => (a.pq[c] ? Math.round((a.cost[c] / a.pq[c]) * 10) / 10 : 0);
    // شركة بلا وارد في هذه الفترة: لا نقطة لها (null) فيتصل خطها بنقاطها فقط دون الهبوط إلى الصفر
    const val = (c: Company): number | null => {
      if (!a.n[c]) return null;
      if (metric === 'qty') return a.q[c];
      if (metric === 'tankers') return a.n[c];
      return price(c) || null;
    };
    const date = toDate(key);
    const label = gran === 'month'
      ? fmtDate(date, multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' })
      : fmtDate(date, { day: 'numeric', month: 'short' });
    const full = gran === 'month' ? fmtDate(date, { month: 'long', year: 'numeric' })
      : gran === 'week' ? `${fmtDate(date, { day: 'numeric', month: 'short' })} – ${fmtDate(new Date(date.getTime() + 6 * DAY), { day: 'numeric', month: 'short', year: 'numeric' })}`
      : fmtDate(date, { dateStyle: 'medium' });
    return {
      key, label, full,
      sahara: val('sahara'), etihad: val('etihad'),
      saharaQ: a.q.sahara, etihadQ: a.q.etihad, saharaN: a.n.sahara, etihadN: a.n.etihad,
      saharaP: price('sahara'), etihadP: price('etihad'),
    };
  });
};

const Pills = <T extends string>({ value, options, onChange, size = 'sm' }: { value: T; options: { id: T; label: React.ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) => (
  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50">
    {options.map(o => (
      <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
        className={`flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${size === 'md' ? 'px-3 py-1.5 text-[12.5px]' : 'px-2.5 py-1 text-[11.5px]'} ${value === o.id ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

/** نافذة تحليل الوارد بملء الشاشة لصفحة المورد */
export const SupplierChartExpanded: React.FC<{ name: string; rows: Row[]; initialPeriod?: Period; onClose: () => void }> = ({ name, rows, initialPeriod = 'm12', onClose }) => {
  const { t, i18n } = useTranslation(['suppliers', 'common']);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [metric, setMetric] = useState<Metric>('qty');
  const [mode, setMode] = useState<Mode>('waves');
  const [gran, setGran] = useState<Gran>('month');
  // المجهز (الشركة المجهزة) داخل المورد: الكل أو مجهز واحد
  const [equipper, setEquipper] = useState<string>('');
  const companies = useMemo(() => (['sahara', 'etihad'] as Company[]).filter(c => rows.some(r => r.co === c)), [rows]);
  const [hidden, setHidden] = useState<Set<Company>>(new Set());
  const shown = companies.filter(c => !hidden.has(c));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const equippers = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => { const e = deliveryCompany(r.d) || name; m.set(e, (m.get(e) ?? 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [rows, name]);
  const scoped = useMemo(() => (equipper ? rows.filter(r => (deliveryCompany(r.d) || name) === equipper) : rows), [rows, equipper, name]);
  const data = useMemo(() => buildBuckets(scoped, period, metric, gran), [scoped, period, metric, gran]);
  // نافذة العرض: عند كثرة النقاط يظهر شريط تنقّل (Brush) يبدأ بآخر 60 نقطة، ويمكن سحبه أو توسيعه
  const WINDOW = 60;
  const useBrush = data.length > WINDOW;
  const brushKey = `${gran}-${period}-${metric}-${equipper}-${data.length}`;
  // كثافة عالية = نقاط كثيرة: يُلغى التحريك والتوهج والنقاط الصغيرة حتى يبقى الرسم سلسًا على الأجهزة الضعيفة
  const dense = data.length > WINDOW;
  // يوم/شهر لكل نقطة (لتسميات المحور)
  const dayKey = (b: Bucket) => b.key.slice(0, 10);
  const monthStarts = useMemo(() => {
    const out: string[] = [];
    let prev = '';
    data.forEach(b => { const m = b.key.slice(0, 7); if (m !== prev) { out.push(b.key); prev = m; } });
    return out;
  }, [data]);
  const spanDays = (a: number, b: number) => {
    const x = data[a], y = data[b];
    return x && y ? (toDate(dayKey(y)).getTime() - toDate(dayKey(x)).getTime()) / DAY : 0;
  };
  // تسميات المحور: أيام عند نافذة قصيرة (≤ 45 يومًا)، وأشهر عند نافذة أطول
  const [dayTicks, setDayTicks] = useState(true);
  // بداية النافذة الظاهرة: تُحدَّث فقط عند تغيّر شهرها، فيبقى سحب الشريط خفيفًا
  const [winStart, setWinStart] = useState(0);
  useEffect(() => {
    const start = useBrush ? data.length - WINDOW : 0;
    setWinStart(start);
    setDayTicks(gran === 'month' || spanDays(start, data.length - 1) <= 45);
  }, [brushKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const onBrush = ({ startIndex, endIndex }: { startIndex?: number; endIndex?: number }) => {
    if (gran === 'month' || startIndex == null || endIndex == null) return;
    const next = spanDays(startIndex, endIndex) <= 45;
    if (next !== dayTicks) setDayTicks(next);
    if (data[startIndex]?.key.slice(0, 7) !== data[winStart]?.key.slice(0, 7)) setWinStart(startIndex);
  };
  // تسميات الأشهر: الشهر الذي تبدأ به النافذة ثم بداية كل شهر بعده
  const monthTicks = useMemo(() => {
    const first = data[winStart]?.key;
    return first ? [first, ...monthStarts.filter(k => k > first && k.slice(0, 7) !== first.slice(0, 7))] : monthStarts;
  }, [data, winStart, monthStarts]);
  const keyIndex = useMemo(() => new Map(data.map((b, i) => [b.key, i])), [data]);
  const tickLabel = (key: string) => {
    const b = data[keyIndex.get(key) ?? -1];
    if (!b) return '';
    if (gran === 'month' || gran === 'week') return b.label;
    return dayTicks ? fmtDate(toDate(dayKey(b)), { day: 'numeric', month: 'short' }) : fmtDate(toDate(dayKey(b)), { month: 'short', year: '2-digit' });
  };
  const zoom = (dir: 1 | -1) => setGran(g => GRANS[Math.min(GRANS.length - 1, Math.max(0, GRANS.indexOf(g) + dir))]);

  // ملخص الفترة المعروضة (للشركات الظاهرة فقط)
  const summary = useMemo(() => {
    const qty = data.reduce((a, b) => a + shown.reduce((s, c) => s + (c === 'sahara' ? b.saharaQ : b.etihadQ), 0), 0);
    const n = data.reduce((a, b) => a + shown.reduce((s, c) => s + (c === 'sahara' ? b.saharaN : b.etihadN), 0), 0);
    const peak = data.reduce<Bucket | null>((m, b) => {
      const v = shown.reduce((s, c) => s + (c === 'sahara' ? b.saharaQ : b.etihadQ), 0);
      const mv = m ? shown.reduce((s, c) => s + (c === 'sahara' ? m.saharaQ : m.etihadQ), 0) : -1;
      return v > mv ? b : m;
    }, null);
    // متوسط السعر الموزون للفترة
    const cut = data.length ? data[0].key : '';
    const priced = scoped.filter(r => shown.includes(r.co) && priceOf(r.d) > 0 && dayOf(r.d) >= cut.slice(0, 10));
    const pq = priced.reduce((a, r) => a + qtyOf(r.d), 0);
    const avgPrice = pq ? priced.reduce((a, r) => a + qtyOf(r.d) * priceOf(r.d), 0) / pq : 0;
    return { qty, n, peak, avgPrice };
  }, [data, scoped, shown]);

  // خط المتوسط: متوسط القيمة لكل فترة (أو متوسط السعر)
  const avgLine = useMemo(() => {
    if (metric === 'price') return summary.avgPrice || undefined;
    const totals = data.map(b => shown.reduce((s, c) => s + ((b[c] as number) || 0), 0)).filter(v => v > 0);
    return totals.length ? totals.reduce((a, v) => a + v, 0) / totals.length : undefined;
  }, [data, shown, metric, summary.avgPrice]);

  const unit = metric === 'qty' ? t('common:units.liter') : metric === 'price' ? t('units.iqdPerLiter') : '';
  const fmtVal = (v: number) => (metric === 'price' ? formatNumber(v) : formatNumber(Math.round(v)));
  const daily = gran !== 'month';

  const tooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const b = payload[0].payload as Bucket;
    if (b.ship) {
      const { d, co } = b.ship;
      const f: [string, string][] = [
        [t('table.receiver'), t(`receiver.${co}`)],
        [t('profile.col.equipper'), deliveryCompany(d) || name],
        [t('profile.col.driver'), d.driverName || '—'],
        [t('profile.col.truck'), d.truckNumber || '—'],
        [t('profile.metric.qty'), `${formatNumber(qtyOf(d))} ${t('common:units.liter')}`],
        [t('profile.metric.price'), priceOf(d) ? `${formatNumber(priceOf(d))} ${t('units.iqdPerLiter')}` : '—'],
      ];
      return (
        <div dir={i18n.dir()} className="w-[250px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200/80 dark:border-slate-700 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] overflow-hidden text-start">
          <div className="px-3.5 py-2.5 bg-teal-50/70 dark:bg-teal-950/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: COMPANY_COLOR[co] }} />
            <span className="text-[12px] font-semibold text-teal-700 dark:text-teal-300">{b.full}</span>
          </div>
          <dl className="px-3.5 py-2.5 space-y-1">
            {f.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 text-[12px]">
                <dt className="text-slate-400">{k}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100 tabular-nums truncate max-w-[140px]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }
    const parts = shown.filter(c => (c === 'sahara' ? b.saharaN : b.etihadN) > 0);
    const totalQ = parts.reduce((a, c) => a + (c === 'sahara' ? b.saharaQ : b.etihadQ), 0);
    const totalN = parts.reduce((a, c) => a + (c === 'sahara' ? b.saharaN : b.etihadN), 0);
    const stat = (k: string, v: string, strong = false) => (
      <div className="min-w-0">
        <div className="text-[10px] text-slate-400 truncate">{k}</div>
        <div className={`tabular-nums truncate ${strong ? 'text-[13px] font-bold text-slate-900 dark:text-white' : 'text-[12px] font-semibold text-slate-700 dark:text-slate-200'}`}>{v}</div>
      </div>
    );
    return (
      <div dir={i18n.dir()} className="w-[260px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200/80 dark:border-slate-700 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] overflow-hidden text-start">
        <div className="px-3.5 py-2.5 bg-teal-50/70 dark:bg-teal-950/30 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-teal-700 dark:text-teal-300">{b.full}</span>
          {parts.length > 1 && <span className="text-[11px] text-slate-500 tabular-nums">{formatNumber(totalQ)} {t('common:units.liter')} · {formatNumber(totalN)}</span>}
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {parts.map(c => (
            <div key={c} className="px-3.5 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COMPANY_COLOR[c] }} />
                <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">{t(`receiver.${c}`)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {stat(t('profile.metric.qty'), `${formatNumber(c === 'sahara' ? b.saharaQ : b.etihadQ)}`, true)}
                {stat(t('profile.metric.tankers'), formatNumber(c === 'sahara' ? b.saharaN : b.etihadN))}
                {stat(t('profile.metric.price'), (c === 'sahara' ? b.saharaP : b.etihadP) ? formatNumber(c === 'sahara' ? b.saharaP : b.etihadP) : '—')}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const xTicks = { fill: '#64748b', fontSize: 11, fontWeight: 600 };
  const yTicks = { fill: '#64748b', fontSize: 11, fontWeight: 600 };
  // عدد تسميات المحور يتكيّف مع عدد النقاط (نحو 10 تسميات كحد أقصى)
  // نحو 12 تسمية على المحور داخل النافذة المعروضة

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-md p-2 sm:p-5 flex animate-[overlayIn_.18s_ease]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('profile.analysisTitle')} onMouseDown={e => e.stopPropagation()}
        className="relative flex-1 flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] overflow-hidden animate-[dialogIn_.22s_ease]">
        {/* توهج خلفي هادئ */}
        <div className="pointer-events-none absolute -top-10 end-1/4 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 start-1/4 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl" />

        {/* الرأس */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0 me-auto">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white flex items-center justify-center shadow-sm"><Activity className="w-4.5 h-4.5" /></span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{t('profile.analysisTitle')}</h2>
              <p className="text-xs text-slate-500 truncate">{name}</p>
            </div>
          </div>
          <Pills value={period} onChange={setPeriod} size="md" options={[
            { id: 'd30', label: t('profile.period.d30') }, { id: 'd90', label: t('profile.period.d90') },
            { id: 'm12', label: t('profile.period.m12') }, { id: 'all', label: t('profile.period.all') },
          ]} />
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')}
            className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* ملخص الفترة */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <Droplets className="w-4 h-4" />, tone: 'text-teal-600 bg-teal-500/10', k: t('profile.totalInbound'), v: formatNumber(summary.qty), u: t('common:units.liter') },
            { icon: <Truck className="w-4 h-4" />, tone: 'text-sky-600 bg-sky-500/10', k: t('profile.statTankers'), v: formatNumber(summary.n), u: '' },
            { icon: <Coins className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-500/10', k: t('profile.avgPrice'), v: summary.avgPrice ? formatNumber(Math.round(summary.avgPrice * 10) / 10) : '—', u: summary.avgPrice ? t('units.iqdPerLiter') : '' },
            { icon: <CalendarRange className="w-4 h-4" />, tone: 'text-violet-600 bg-violet-500/10', k: daily ? t('profile.peakDay') : t('profile.peakMonth'), v: summary.peak?.full ?? '—', u: '' },
          ].map(x => (
            <div key={x.k} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3.5 py-3 flex items-center gap-3 min-w-0">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${x.tone}`}>{x.icon}</span>
              <div className="min-w-0">
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{x.k}</div>
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="text-[17px] font-bold text-slate-900 dark:text-white tabular-nums truncate">{x.v}</span>
                  {x.u && <span className="text-[11px] text-slate-400 shrink-0">{x.u}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* أدوات العرض: المقياس ونمط الرسم */}
        <div className="relative shrink-0 px-4 sm:px-6 pt-4 flex flex-wrap items-center gap-2">
          <Pills value={metric} onChange={setMetric} options={[
            { id: 'qty', label: t('profile.metric.qty') }, { id: 'tankers', label: t('profile.metric.tankers') }, { id: 'price', label: t('profile.metric.price') },
          ]} />
          {equippers.length > 1 && (
            <select value={equipper} onChange={e => setEquipper(e.target.value)} aria-label={t('profile.col.equipper')}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500 cursor-pointer max-w-[220px]">
              <option value="">{t('profile.allEquippers')}</option>
              {equippers.map(([e, n]) => <option key={e} value={e}>{e} ({formatNumber(n)})</option>)}
            </select>
          )}
          {/* التكبير والتصغير: شهري ← أسبوعي ← يومي ← كل شحنة */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50">
            <button type="button" onClick={() => zoom(-1)} disabled={gran === 'month'} aria-label={t('profile.zoomOut')} title={t('profile.zoomOut')}
              className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-[12px] font-semibold text-teal-600 dark:text-teal-300 whitespace-nowrap min-w-[64px] text-center">{t(`profile.gran.${gran}`)}</span>
            <button type="button" onClick={() => zoom(1)} disabled={gran === 'shipment'} aria-label={t('profile.zoomIn')} title={t('profile.zoomIn')}
              className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="ms-auto">
            <Pills value={mode} onChange={setMode} options={[
              { id: 'waves', label: <><Waves className="w-3.5 h-3.5" />{t('profile.mode.waves')}</> },
              { id: 'bars', label: <><BarChart3 className="w-3.5 h-3.5" />{t('profile.mode.bars')}</> },
            ]} />
          </div>
        </div>

        {/* الرسم */}
        <div className="relative flex-1 min-h-[260px] px-2 sm:px-4 pt-3" dir="ltr">
          <div className="h-full">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">{t('profile.empty')}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {mode === 'waves' ? (
                <AreaChart data={data} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
                  <defs>
                    {companies.map(c => (
                      <React.Fragment key={c}>
                        <linearGradient id={`exp-fill-${c}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COMPANY_COLOR[c]} stopOpacity={0.26} />
                          <stop offset="70%" stopColor={COMPANY_COLOR[c]} stopOpacity={0.04} />
                          <stop offset="100%" stopColor={COMPANY_COLOR[c]} stopOpacity={0} />
                        </linearGradient>
                        <filter id={`exp-glow-${c}`} x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={COMPANY_COLOR[c]} floodOpacity="0.35" />
                        </filter>
                      </React.Fragment>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                  <XAxis dataKey="key" axisLine={false} tickLine={false} tick={xTicks} dy={6} tickFormatter={tickLabel} minTickGap={28}
                    {...(!dayTicks && gran !== 'month' && gran !== 'week' ? { ticks: monthTicks, interval: 0 } : { interval: 'preserveStartEnd' as const })} />
                  <YAxis axisLine={false} tickLine={false} width={48} tick={yTicks} tickFormatter={compact}
                    domain={metric === 'price' ? ['dataMin - 20', 'dataMax + 20'] : [0, 'auto']} />
                  <Tooltip content={tooltip} cursor={{ stroke: '#0d9488', strokeWidth: 1.5, strokeDasharray: '3 3' }} wrapperStyle={{ outline: 'none', zIndex: 20 }} isAnimationActive={false} />
                  {shown.map(c => (
                    <Area key={c} type={dense ? 'linear' : 'monotone'} dataKey={c} stroke={COMPANY_COLOR[c]} strokeWidth={dense ? 1.75 : 2.5} fill={`url(#exp-fill-${c})`}
                      filter={dense ? undefined : `url(#exp-glow-${c})`} isAnimationActive={!dense}
                      connectNulls dot={dense ? false : { r: data.length > 40 ? 2 : 3.5, fill: '#fff', stroke: COMPANY_COLOR[c], strokeWidth: 2 }} activeDot={{ r: 5, stroke: COMPANY_COLOR[c], strokeWidth: 2.5, fill: '#fff' }} />
                  ))}
                  {avgLine !== undefined && <ReferenceLine y={avgLine} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.5} />}
                  {useBrush && <Brush key={brushKey} dataKey="key" height={26} travellerWidth={10} startIndex={data.length - WINDOW} endIndex={data.length - 1} stroke="#0d9488" fill="transparent" tickFormatter={() => ''} onChange={onBrush} />}
                </AreaChart>
              ) : (
                <BarChart data={data} margin={{ top: 16, right: 16, left: 4, bottom: 4 }} barGap={3}>
                  <defs>
                    {companies.map(c => (
                      <linearGradient key={c} id={`exp-bar-${c}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COMPANY_COLOR[c]} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={COMPANY_COLOR[c]} stopOpacity={0.45} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                  <XAxis dataKey="key" axisLine={false} tickLine={false} tick={xTicks} dy={6} tickFormatter={tickLabel} minTickGap={28}
                    {...(!dayTicks && gran !== 'month' && gran !== 'week' ? { ticks: monthTicks, interval: 0 } : { interval: 'preserveStartEnd' as const })} />
                  <YAxis axisLine={false} tickLine={false} width={48} tick={yTicks} tickFormatter={compact}
                    domain={metric === 'price' ? ['dataMin - 20', 'dataMax + 20'] : [0, 'auto']} />
                  <Tooltip content={tooltip} cursor={{ fill: 'rgba(148,163,184,0.1)' }} wrapperStyle={{ outline: 'none', zIndex: 20 }} isAnimationActive={false} />
                  {shown.map(c => (
                    <Bar key={c} dataKey={c} fill={`url(#exp-bar-${c})`} isAnimationActive={!dense} radius={[6, 6, 0, 0]} maxBarSize={daily ? 14 : 34} />
                  ))}
                  {avgLine !== undefined && <ReferenceLine y={avgLine} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.5} />}
                  {useBrush && <Brush key={brushKey} dataKey="key" height={26} travellerWidth={10} startIndex={data.length - WINDOW} endIndex={data.length - 1} stroke="#0d9488" fill="transparent" tickFormatter={() => ''} onChange={onBrush} />}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
          </div>
        </div>

        {/* التذييل: إظهار/إخفاء كل شركة وشرح خط المتوسط */}
        <div className="relative shrink-0 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-2">
            {companies.map(c => {
              const on = !hidden.has(c);
              return (
                <button key={c} type="button" aria-pressed={on} title={t('profile.toggleSeries')}
                  onClick={() => setHidden(prev => { const n = new Set(prev); if (n.has(c)) n.delete(c); else if (shown.length > 1) n.add(c); return n; })}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${on ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm' : 'opacity-45 line-through bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500'}`}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COMPANY_COLOR[c] }} />{t(`receiver.${c}`)}
                </button>
              );
            })}
          </div>
          {avgLine !== undefined && (
            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="w-5 border-t-2 border-dashed border-slate-400" />
              {t('profile.avgLine')}: <b className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{fmtVal(avgLine)}</b> {unit}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
