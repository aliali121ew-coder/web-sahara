/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownWideNarrow, ChevronLeft, ChevronRight, Fuel, Gauge, Repeat2, Search, TrendingDown, TrendingUp, Truck } from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { FREQUENT_DAYS, VEHICLE_PROFILES_KEY, daysBetween, vehicleCategory, type DayFill, type VehicleProfile } from '../../lib/vehicleFuel';
import { useCategoryNames, useVehicleNames } from './categories';
import { VehicleArt } from './VehicleArt';

type Unit = 'day' | 'week' | 'month';
type Status = 'حرج' | 'مرتفع' | 'طبيعي' | 'منخفض' | 'جديد' | 'بلا تفويل';
type SortKey = 'change' | 'current' | 'dev';

const PAGE = 10;
const UNITS: [Unit, string, string][] = [['day', 'يومي', 'أيام'], ['week', 'أسبوعي', 'أسابيع'], ['month', 'شهري', 'أشهر']];
const MONTHS = ['كانون 2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين 1', 'تشرين 2', 'كانون 1'];

const TONE: Record<Status, { pill: string; bar: string; text: string }> = {
  'حرج': { pill: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300', bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
  'مرتفع': { pill: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  'طبيعي': { pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', bar: 'bg-slate-500', text: 'text-slate-700 dark:text-slate-200' },
  'منخفض': { pill: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300', bar: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-400' },
  'بلا تفويل': { pill: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', bar: 'bg-slate-400', text: 'text-slate-500' },
  'جديد': { pill: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300', bar: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-400' },
};

// التواريخ في الكشوف بصيغة YYYY/MM/DD
const toMs = (d: string) => { const [y, m, dd] = d.split('/').map(Number); return Date.UTC(y, m - 1, dd); };
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '/');
const addDays = (d: string, n: number) => fromMs(toMs(d) + n * 86400000);
const short = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

interface Period { from: string; to: string; name: string; range: string }

/** أربع فترات متتالية تنتهي بآخر تاريخ: أيام، أو أسابيع (7 أيام)، أو أشهر تقويمية */
const buildPeriods = (end: string, unit: Unit): Period[] => [3, 2, 1, 0].map(back => {
  if (unit === 'day') {
    const d = addDays(end, -back);
    return { from: d, to: d, name: new Date(toMs(d)).toLocaleDateString('ar-IQ', { weekday: 'long', timeZone: 'UTC' }), range: short(d) };
  }
  if (unit === 'week') {
    const to = addDays(end, -back * 7);
    const from = addDays(to, -6);
    return { from, to, name: `أسبوع ${4 - back}`, range: `${short(from)}–${short(to)}` };
  }
  const [y, m] = end.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - back, 1));
  const from = fromMs(dt.getTime());
  const last = fromMs(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
  const to = last > end ? end : last;
  return { from, to, name: MONTHS[dt.getUTCMonth()], range: `${dt.getUTCFullYear()}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}` };
});

interface RecentFill { date: string; qty: number; gap: number | null; parts: number }

interface Row {
  vehicle: string;
  code: string;
  display: string;
  cat: string;
  catKey: string;
  driver: string;
  /** الكمية في كل فترة */
  p: number[];
  /** المعدل اليومي لكل فترة على أيام الكشوف (null = فترة بلا كشوف) */
  rate: (number | null)[];
  prevRate: number;
  curRate: number;
  change: number | null;
  catAvg: number;
  dev: number | null;
  n: number;
  /** أقل فاصل حقيقي بين يومي تفويل في الفترة الأخيرة */
  minGap: number | null;
  /** أيام فيها أكثر من تفويلة للعربة في الفترة الأخيرة */
  multi: number;
  close: boolean;
  recent: RecentFill[];
  status: Status;
}

const num = (n: number) => (n < 10 && n % 1 ? n.toFixed(1) : Math.round(n).toLocaleString());
const absPct = (x: number) => `${Math.abs(x) < 10 ? Math.abs(x).toFixed(1) : Math.round(Math.abs(x)).toLocaleString()}%`;
const changeTone = (x: number | null) => (x === null ? 'text-slate-500' : x >= 15 ? 'text-rose-700 dark:text-rose-400' : x <= -10 ? 'text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300');
const changeBg = (x: number | null) => (x !== null && x >= 15 ? 'bg-rose-50 dark:bg-rose-950/40' : x !== null && x <= -10 ? 'bg-teal-50 dark:bg-teal-950/40' : 'bg-slate-50 dark:bg-slate-800/60');

/** نسبة التغير بسهم أيقونة والرقم معزول باتجاه LTR حتى لا يختلط بالنص العربي */
const Delta: React.FC<{ value: number | null; className?: string }> = ({ value, className = '' }) => (
  value === null ? <span className={`text-slate-400 ${className}`}>—</span> : (
    <span className={`inline-flex items-center gap-1 font-black ${changeTone(value)} ${className}`}>
      {value > 0 ? <TrendingUp className="w-3.5 h-3.5 shrink-0" /> : value < 0 ? <TrendingDown className="w-3.5 h-3.5 shrink-0" /> : null}
      <bdi dir="ltr" className="font-mono">{absPct(value)}</bdi>
    </span>
  )
);

/**
 * تحليل الاستهلاك: مقارنة كل عربة على آخر 4 فترات (يوم/أسبوع/شهر) لكشف التفويل العالي.
 * المقارنة على المعدل اليومي في أيام الكشوف فقط، حتى لا تُقارن فترة كاملة بفترة بدأت فيها الكشوف قبل يومين.
 * الضغط على صف يفتح صفحة العربة، والمرور عليه يعرضها بالجانب.
 */
export const ConsumptionAnalysis: React.FC<{ allFills: DayFill[]; endDate: string; onOpen: (vehicle: string) => void }> = ({ allFills, endDate, onOpen }) => {
  const [unit, setUnit] = useState<Unit>('week');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('change');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const names = useVehicleNames();
  const [labels] = useCategoryNames();
  const [profiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);

  const periods = useMemo(() => buildPeriods(endDate, unit), [endDate, unit]);
  const periodOf = (date: string) => periods.findIndex(p => date >= p.from && date <= p.to);

  /** عدد أيام الكشوف في كل فترة (أي تاريخ فيه تفويلات لأي عربة) */
  const cov = useMemo(() => periods.map(p => new Set(allFills.filter(f => f.date >= p.from && f.date <= p.to).map(f => f.date)).size), [allFills, periods]);

  const rows = useMemo<Row[]>(() => {
    const byVehicle = new Map<string, DayFill[]>();
    for (const f of allFills) {
      const l = byVehicle.get(f.vehicle);
      if (l) l.push(f); else byVehicle.set(f.vehicle, [f]);
    }
    const prevIdx = [0, 1, 2].filter(i => cov[i] > 0);
    const prevDays = prevIdx.reduce((s, i) => s + cov[i], 0);

    const base = [...byVehicle.entries()].flatMap(([vehicle, list]) => {
      list.sort((a, b) => a.date.localeCompare(b.date));
      const p = [0, 0, 0, 0];
      const recent: RecentFill[] = [];
      let last: DayFill | null = null;
      list.forEach((f, k) => {
        const i = periodOf(f.date);
        if (i < 0) return;
        p[i] += f.qty;
        last = f;
        if (i === 3) {
          // الفاصل الحقيقي من يوم التفويل السابق (سطور اليوم نفسه مجمّعة في تفويلة واحدة)
          const gap = k > 0 ? daysBetween(list[k - 1].date, f.date) : f.parts === 1 ? f.days : null;
          recent.push({ date: f.date, qty: f.qty, gap, parts: f.parts });
        }
      });
      if (!p.some(Boolean)) return [];
      const gaps = recent.map(r => r.gap).filter((g): g is number => g !== null && g > 0);
      const minGap = gaps.length ? Math.min(...gaps) : null;
      const multi = recent.filter(r => r.parts > 1).length;
      const rate = p.map((v, i) => (cov[i] ? v / cov[i] : null));
      const prevRate = prevDays ? prevIdx.reduce((s, i) => s + p[i], 0) / prevDays : 0;
      const curRate = rate[3] ?? 0;
      const change = prevRate && p[3] ? ((curRate - prevRate) / prevRate) * 100 : null;
      const code = names.get(vehicle) || vehicle;
      const cat = vehicleCategory(code);
      const prof = profiles.find(x => x.id === vehicle);
      const lastFill = last as DayFill | null;
      return [{
        vehicle, code, display: prof?.name || vehicle,
        catKey: cat?.key || 'OTHER', cat: (cat && labels[cat.key]) || cat?.label || 'أخرى',
        driver: lastFill?.drivers[0] || prof?.driver || '',
        p, rate, prevRate, curRate, change, n: recent.length, minGap, multi,
        close: (minGap !== null && minGap <= FREQUENT_DAYS) || multi > 0,
        recent: recent.reverse(),
      }];
    });
    // متوسط الفئة للفترة الأخيرة (العربات التي فوّلت فيها فقط)
    const cats = new Map<string, number[]>();
    for (const r of base) if (r.p[3] > 0) cats.set(r.catKey, [...(cats.get(r.catKey) || []), r.p[3]]);
    return base.map(r => {
      const list = cats.get(r.catKey) || [];
      const catAvg = list.length ? list.reduce((s, x) => s + x, 0) / list.length : 0;
      const dev = catAvg && r.p[3] && list.length > 1 ? ((r.p[3] - catAvg) / catAvg) * 100 : null;
      const c = r.change;
      const status: Status = !r.p[3] ? 'بلا تفويل' : c === null ? 'جديد'
        : c >= 30 || (r.close && c >= 20) ? 'حرج'
        : c >= 15 ? 'مرتفع' : c <= -10 ? 'منخفض' : 'طبيعي';
      return { ...r, catAvg, dev, status };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFills, periods, cov, names, labels, profiles]);

  const sorted = useMemo(() => {
    const key = (r: Row) => (sort === 'current' ? r.p[3] : sort === 'dev' ? r.dev ?? -Infinity : r.change ?? -Infinity);
    return [...rows].sort((a, b) => key(b) - key(a) || b.p[3] - a.p[3]);
  }, [rows, sort]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter(r => (filter === 'all' || r.status === filter)
      && (!needle || `${r.vehicle} ${r.code} ${r.display} ${r.driver}`.toLowerCase().includes(needle)));
  }, [sorted, filter, q]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const view = visible.slice(cur * PAGE, cur * PAGE + PAGE);

  const k = useMemo(() => {
    const totals = [0, 1, 2, 3].map(i => rows.reduce((s, r) => s + r.p[i], 0));
    const active = rows.filter(r => r.p[3] > 0);
    const prevIdx = [0, 1, 2].filter(i => cov[i] > 0);
    const prevDays = prevIdx.reduce((s, i) => s + cov[i], 0);
    const prevRate = prevDays ? prevIdx.reduce((s, i) => s + totals[i], 0) / prevDays : 0;
    const curRate = cov[3] ? totals[3] / cov[3] : 0;
    const top = rows.filter(r => r.change !== null).sort((a, b) => b.change! - a.change!)[0];
    return {
      totals,
      delta: prevRate && curRate ? ((curRate - prevRate) / prevRate) * 100 : null,
      avg: active.length ? totals[3] / active.length : 0,
      active: active.length,
      crit: rows.filter(r => r.status === 'حرج').length,
      high: rows.filter(r => r.status === 'مرتفع').length,
      top,
      close: rows.filter(r => r.close).length,
    };
  }, [rows, cov]);

  const sel = rows.find(r => r.vehicle === hover) || view[0] || sorted[0];
  const unitInfo = UNITS.find(u => u[0] === unit)!;
  const curLabel = unit === 'day' ? 'آخر يوم' : unit === 'week' ? 'آخر أسبوع' : 'آخر شهر';
  const count = (s: Status) => rows.filter(r => r.status === s).length;
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const sparkMax = Math.max(1, ...k.totals);
  const firstData = cov.findIndex(c => c > 0);

  const flags = (r: Row) => {
    const out: { text: string; tone: string }[] = [];
    if (r.change !== null && r.change >= 30) out.push({ text: 'ارتفاع حاد عن معدله السابق', tone: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' });
    else if (r.change !== null && r.change >= 15) out.push({ text: 'ارتفاع ملحوظ عن معدله السابق', tone: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' });
    if (r.multi > 0) out.push({ text: `أكثر من تفويلة في اليوم نفسه (${r.multi})`, tone: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' });
    if (r.minGap !== null && r.minGap <= FREQUENT_DAYS) out.push({ text: 'تفويلتان في يومين متتاليين', tone: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' });
    if (r.dev !== null && r.dev >= 25) out.push({ text: 'أعلى من متوسط فئته', tone: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' });
    if (r.status === 'بلا تفويل') out.push({ text: 'لم تفوّل في الفترة الأخيرة', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300' });
    if (r.status === 'جديد') out.push({ text: 'لا تفويلات سابقة للمقارنة', tone: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300' });
    if (!out.length) out.push({ text: 'لا مؤشرات تفويل عالٍ', tone: 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300' });
    return out;
  };

  const SortHead: React.FC<{ id: SortKey; children: React.ReactNode; className?: string }> = ({ id, children, className = '' }) => (
    <th className={`px-2 font-black ${className}`}>
      <button type="button" onClick={() => { setSort(id); setPage(0); }} className={`inline-flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white ${sort === id ? 'text-slate-900 dark:text-white' : ''}`}>
        {children}{sort === id && <ArrowDownWideNarrow className="w-3 h-3" />}
      </button>
    </th>
  );

  return (
    <div className="vehicle-page space-y-5 pb-12 font-cairo">
      {/* الأدوات: مدة كل عمود */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">تحليل الاستهلاك</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            مقارنة آخر 4 {unitInfo[2]} حتى <bdi dir="ltr" className="font-mono">{endDate}</bdi> لكشف التفويل العالي
            {firstData > 0 && <span className="text-amber-700 dark:text-amber-400"> · الكشوف تبدأ من {periods[firstData].name}، والفترات قبلها لا تدخل المقارنة</span>}
          </p>
        </div>
        <div role="group" aria-label="مدة كل عمود" className="flex gap-1 p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800">
          {UNITS.map(([u, l]) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => { setUnit(u); setPage(0); }} className={`h-9 px-4 rounded-xl text-sm font-black cursor-pointer transition-all ${unit === u ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* الكارتات */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="vehicle-kpi col-span-2 lg:col-span-1 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card flex justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"><Fuel className="w-3.5 h-3.5 text-indigo-500" />استهلاك {curLabel}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5"><span className="font-mono">{fmt(k.totals[3])}</span> <span className="text-xs text-slate-400">لتر</span></div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1"><Delta value={k.delta} /> بالمعدل اليومي</div>
          </div>
          <div className="flex items-end gap-1 h-14 self-end" aria-hidden>
            {k.totals.map((t, i) => <div key={i} className={`w-2.5 rounded ${i === 3 ? 'bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-900'}`} style={{ height: `${Math.max(6, (t / sparkMax) * 100)}%` }} />)}
          </div>
        </div>
        <div className="vehicle-kpi rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"><Gauge className="w-3.5 h-3.5 text-violet-500" />متوسط العربة</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5"><span className="font-mono">{fmt(k.avg)}</span> <span className="text-xs text-slate-400">لتر</span></div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">على {k.active} عربة فوّلت</div>
        </div>
        <button type="button" onClick={() => { setFilter(filter === 'حرج' ? 'all' : 'حرج'); setPage(0); }} className="vehicle-kpi text-right rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-800 dark:text-rose-300"><AlertTriangle className="w-3.5 h-3.5" />تفويل عالٍ</div>
          <div className="text-2xl font-black text-rose-900 dark:text-rose-200 mt-1.5"><span className="font-mono">{k.crit + k.high}</span> <span className="text-xs">عربات</span></div>
          <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 mt-1">{k.crit} حرجة · {k.high} مرتفعة</div>
        </button>
        <button type="button" disabled={!k.top} onClick={() => k.top && onOpen(k.top.vehicle)} className="vehicle-kpi text-right rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card cursor-pointer hover:border-sky-400 disabled:cursor-default">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"><TrendingUp className="w-3.5 h-3.5 text-rose-500" />أعلى ارتفاع</div>
          <div className="text-2xl mt-1.5">{k.top ? <Delta value={k.top.change} /> : '—'}</div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">{k.top ? <>العربة <bdi dir="ltr">{k.top.display}</bdi></> : 'لا توجد مقارنة'}</div>
        </button>
        <div className="vehicle-kpi rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"><Repeat2 className="w-3.5 h-3.5 text-amber-500" />تفويل متقارب</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5"><span className="font-mono">{k.close}</span> <span className="text-xs text-slate-400">عربات</span></div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">يومان متتاليان أو اليوم نفسه</div>
        </div>
      </div>

      {/* الجدول 70% والجانب 30% */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-stretch">
        <section aria-label="جدول المقارنة" className="lg:col-span-7 flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-white">مقارنة آخر 4 {unitInfo[2]}</h3>
              <span className="text-[11px] text-slate-400">{rows.length} عربة</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'حرج', 'مرتفع', 'منخفض', 'جديد', 'بلا تفويل'] as const).map(s => (s === 'all' || count(s) > 0) && (
                <button key={s} type="button" aria-pressed={filter === s} onClick={() => { setFilter(s); setPage(0); }} className={`h-8 px-3 rounded-xl text-xs font-black cursor-pointer transition-colors ${filter === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`}>
                  {s === 'all' ? 'الكل' : s} <span className="opacity-60 font-mono">{s === 'all' ? rows.length : count(s)}</span>
                </button>
              ))}
              <label className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus-within:border-sky-400">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="sr-only">بحث عن عربة</span>
                <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="رقم العربة" className="w-24 bg-transparent outline-none text-xs text-slate-900 dark:text-white" />
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full min-w-[880px] text-right">
              <thead>
                <tr className="h-14 bg-slate-50 dark:bg-slate-950/50 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 font-black">العربة</th>
                  {periods.map((p, i) => (
                    <th key={p.from} className={`px-2 font-black ${i === 3 ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300' : ''}`}>
                      {i === 3 ? <button type="button" onClick={() => { setSort('current'); setPage(0); }} className="inline-flex items-center gap-1 cursor-pointer">{p.name}{sort === 'current' && <ArrowDownWideNarrow className="w-3 h-3" />}</button> : p.name}
                      <div className="text-[10px] font-medium text-slate-400 font-mono" dir="ltr">{p.range}</div>
                      {unit !== 'day' && <div className={`text-[10px] font-bold ${cov[i] ? 'text-slate-400' : 'text-amber-600 dark:text-amber-400'}`}>{cov[i] ? `${cov[i]} يوم كشوف` : 'لا كشوف'}</div>}
                    </th>
                  ))}
                  <SortHead id="change" className="text-center">التغير</SortHead>
                  <SortHead id="dev" className="text-center">عن الفئة</SortHead>
                  <th className="px-2 font-black text-center">تفويلات</th>
                  <th className="px-2 font-black text-center">أقل فاصل</th>
                  <th className="px-2 font-black text-center">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {view.map(r => {
                  const max = Math.max(1, ...r.p);
                  const on = sel?.vehicle === r.vehicle;
                  return (
                    <tr
                      key={r.vehicle}
                      tabIndex={0}
                      aria-label={`فتح صفحة العربة ${r.display}`}
                      onClick={() => onOpen(r.vehicle)}
                      onKeyDown={e => { if (e.key === 'Enter') onOpen(r.vehicle); }}
                      onMouseEnter={() => setHover(r.vehicle)}
                      onFocus={() => setHover(r.vehicle)}
                      className={`h-[60px] border-b border-slate-100 dark:border-slate-800/70 cursor-pointer outline-none transition-colors ${on ? 'bg-indigo-50/80 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'} focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400`}
                    >
                      <td className="px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <VehicleArt code={r.code} photo={profiles.find(p => p.id === r.vehicle)?.photo} className={`w-11 h-9 shrink-0 rounded-xl ${on ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-slate-100 dark:bg-slate-800'}`} imgClassName="p-0.5" />
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-900 dark:text-white truncate font-mono" dir="ltr">{r.display}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{r.cat}</div>
                          </div>
                        </div>
                      </td>
                      {r.p.map((v, i) => (
                        <td key={i} className={`px-2 ${i === 3 ? 'bg-sky-50/70 dark:bg-sky-950/20' : ''}`}>
                          <div className={`text-[13px] font-mono ${!cov[i] ? 'text-slate-300 dark:text-slate-600' : i === 3 ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-600 dark:text-slate-300'}`}>{v ? fmt(v) : '—'}</div>
                          <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden"><div className={`h-full rounded-full ${i === 3 ? TONE[r.status].bar : 'bg-slate-300 dark:bg-slate-600'}`} style={{ width: `${(v / max) * 100}%` }} /></div>
                        </td>
                      ))}
                      <td className="px-2 text-center">
                        <span className={`inline-flex text-xs px-2 py-1 rounded-lg ${changeBg(r.change)}`}><Delta value={r.change} /></span>
                      </td>
                      <td className={`px-2 text-center text-xs font-bold font-mono ${r.dev !== null && r.dev >= 25 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`} dir="ltr">{r.dev === null ? '—' : `${r.dev > 0 ? '+' : ''}${Math.round(r.dev)}%`}</td>
                      <td className="px-2 text-center text-[13px] font-bold font-mono text-slate-700 dark:text-slate-200">{r.n || '—'}</td>
                      <td className="px-2 text-center">
                        {r.multi > 0 ? <span className="inline-block text-xs font-black px-2 py-1 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">اليوم نفسه</span>
                          : r.minGap === null ? <span className="text-xs text-slate-400">—</span>
                          : <span className={`inline-block text-xs font-black px-2 py-1 rounded-lg ${r.minGap <= FREQUENT_DAYS ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'}`}><bdi className="font-mono">{r.minGap}</bdi> يوم</span>}
                      </td>
                      <td className="px-2 text-center"><span className={`inline-block text-[11px] font-black px-2.5 py-1 rounded-full ${TONE[r.status].pill}`}>{r.status}</span></td>
                    </tr>
                  );
                })}
                {!view.length && <tr><td colSpan={10} className="text-center text-sm text-slate-400 py-12">لا توجد عربات مطابقة</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div>عرض <b className="text-slate-900 dark:text-white font-mono">{visible.length ? cur * PAGE + 1 : 0}–{cur * PAGE + view.length}</b> من <b className="text-slate-900 dark:text-white font-mono">{visible.length}</b> عربة</div>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="الصفحة السابقة" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                {Array.from({ length: pages }, (_, i) => i).filter(i => i === 0 || i === pages - 1 || Math.abs(i - cur) <= 1).map((i, idx, arr) => (
                  <React.Fragment key={i}>
                    {idx > 0 && i - arr[idx - 1] > 1 && <span className="px-1">…</span>}
                    <button type="button" aria-current={i === cur ? 'page' : undefined} onClick={() => setPage(i)} className={`w-8 h-8 rounded-lg text-xs font-black font-mono cursor-pointer ${i === cur ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{i + 1}</button>
                  </React.Fragment>
                ))}
                <button type="button" disabled={cur === pages - 1} onClick={() => setPage(cur + 1)} aria-label="الصفحة التالية" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </section>

        {/* الجانب: العربة المحددة ورسم آخر 4 فترات — ينتهي مع نهاية كارت الجدول (يأخذ ارتفاعه ولا يحدده) */}
        <div className="lg:col-span-3 relative lg:min-h-[800px]">
        <div className="flex flex-col gap-5 lg:absolute lg:inset-0">
          {sel ? (
            <>
              <section aria-label="تفاصيل العربة" className="shrink-0 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden">
                {/* الصورة والحالة ونسبة التغير */}
                <div className="relative h-24 bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-800/70 dark:to-slate-900/40">
                  <VehicleArt key={sel.vehicle} code={sel.code} photo={profiles.find(p => p.id === sel.vehicle)?.photo} className="absolute inset-x-16 inset-y-2 vehicle-truck-in" />
                  <span className={`absolute top-3 right-3 text-[11px] font-black px-2.5 py-1 rounded-full ${TONE[sel.status].pill}`}>{sel.status}</span>
                  <span className={`absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/80 shadow-sm`}><Delta value={sel.change} /></span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="min-w-0">
                    <div className="text-xl font-black text-slate-900 dark:text-white font-mono truncate leading-tight" dir="ltr" style={{ textAlign: 'right' }}>{sel.display}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sel.cat}{sel.driver && <> · {sel.driver}</>}</div>
                  </div>

                  {/* المعدل اليومي: الحالي مقابل السابق */}
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/50 p-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                      <span>المعدل اليومي</span>
                      <span>لتر / يوم كشوف</span>
                    </div>
                    {[
                      ['الحالي', sel.curRate, TONE[sel.status].bar, 'text-slate-900 dark:text-white'],
                      ['السابق', sel.prevRate, 'bg-slate-300 dark:bg-slate-600', 'text-slate-600 dark:text-slate-300'],
                    ].map(([l, v, bar, txt]) => {
                      const top = Math.max(sel.curRate, sel.prevRate, 1);
                      return (
                        <div key={l as string} className="flex items-center gap-2.5 mt-1.5 first-of-type:mt-0">
                          <span className="w-10 text-[11px] font-bold text-slate-500 dark:text-slate-400">{l as string}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-white dark:bg-slate-800 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${bar as string}`} style={{ width: `${((v as number) / top) * 100}%` }} /></div>
                          <bdi className={`w-12 text-left text-sm font-black font-mono ${txt as string}`}>{(v as number) ? num(v as number) : '—'}</bdi>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 px-2 py-2">
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400">{curLabel}</div>
                      <div className="text-base font-black text-slate-900 dark:text-white font-mono">{fmt(sel.p[3])}</div>
                      <div className="text-[10px] text-slate-400">لتر</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 px-2 py-2">
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400">التفويلات</div>
                      <div className="text-base font-black text-slate-900 dark:text-white font-mono">{sel.n}</div>
                      <div className="text-[10px] text-slate-400">{sel.n ? <><bdi className="font-mono">{fmt(sel.p[3] / sel.n)}</bdi> لتر للتفويلة</> : '—'}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 px-2 py-2">
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400">عن فئته</div>
                      <div className={`text-base font-black font-mono ${sel.dev !== null && sel.dev >= 25 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}><bdi dir="ltr">{sel.dev === null ? '—' : `${sel.dev > 0 ? '+' : ''}${Math.round(sel.dev)}%`}</bdi></div>
                      <div className="text-[10px] text-slate-400">متوسطها <bdi className="font-mono">{fmt(sel.catAvg)}</bdi></div>
                    </div>
                  </div>

                  {/* تفويلات الفترة الأخيرة بفواصلها */}
                  {sel.recent.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">تفويلات {curLabel}</div>
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
                        {sel.recent.slice(0, 3).map(f => {
                          const near = f.parts > 1 || (f.gap !== null && f.gap <= FREQUENT_DAYS);
                          return (
                            <li key={f.date} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                              <bdi dir="ltr" className="font-mono font-bold text-slate-700 dark:text-slate-200">{short(f.date)}</bdi>
                              <span className="font-black text-slate-900 dark:text-white"><bdi className="font-mono">{fmt(f.qty)}</bdi> لتر</span>
                              <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-full ${near ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {f.parts > 1 ? `${f.parts} مرات اليوم` : f.gap === null ? 'أول تفويلة' : <>بعد <bdi className="font-mono">{f.gap}</bdi> يوم</>}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {sel.recent.length > 3 && <div className="text-[10.5px] text-slate-400 mt-1">و{sel.recent.length - 3} تفويلات أخرى في صفحة العربة</div>}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {flags(sel).map(f => <span key={f.text} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${f.tone}`}><AlertTriangle className="w-3 h-3 shrink-0" />{f.text}</span>)}
                  </div>

                  <button type="button" onClick={() => onOpen(sel.vehicle)} className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-black cursor-pointer hover:opacity-90">
                    <Truck className="w-4 h-4" />فتح صفحة العربة
                  </button>
                </div>
              </section>

              <section aria-label="رسم آخر 4 فترات" className="flex-1 min-h-[200px] flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">المعدل اليومي · آخر 4 {unitInfo[2]}</h3>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400"><span className="w-4 border-t-2 border-dashed border-slate-500" />معدله السابق</span>
                </div>
                {(() => {
                  const top = Math.max(1, ...sel.rate.map(r => r ?? 0), sel.prevRate) * 1.2;
                  return (
                    <>
                      <div className="relative flex-1 min-h-[90px] mt-3 flex items-end gap-3 px-1 border-b border-slate-200 dark:border-slate-700">
                        {sel.prevRate > 0 && <div className="absolute inset-x-0 border-t-2 border-dashed border-slate-400 dark:border-slate-500 z-10" style={{ bottom: `${(sel.prevRate / top) * 100}%` }} />}
                        {sel.rate.map((v, i) => (
                          <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                            <span className={`text-[11px] font-black font-mono ${v === null ? 'text-slate-300 dark:text-slate-600' : i === 3 ? TONE[sel.status].text : 'text-slate-600 dark:text-slate-300'}`}>{v === null ? 'لا كشوف' : v ? num(v) : '0'}</span>
                            <div className={`w-full max-w-[52px] rounded-t-xl rounded-b-md transition-all duration-500 ${v === null ? 'bg-slate-100 dark:bg-slate-800' : i === 3 ? TONE[sel.status].bar : 'bg-slate-300 dark:bg-slate-600'}`} style={{ height: `${v === null ? 2 : Math.max(2, (v / top) * 100)}%` }} />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 px-1 pt-2">
                        {periods.map(p => <div key={p.from} className="flex-1 text-center"><div className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">{p.name}</div><div className="text-[10px] text-slate-400 font-mono" dir="ltr">{p.range}</div></div>)}
                      </div>
                    </>
                  );
                })()}
              </section>
            </>
          ) : (
            <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-8 text-center text-sm text-slate-400">لا توجد تفويلات في الفترات المختارة</div>
          )}
        </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400 px-1">
        <b className="text-slate-700 dark:text-slate-200">قواعد الكشف:</b>
        <span><span className={`inline-block px-2 py-0.5 rounded-full font-black ${TONE['حرج'].pill}`}>حرج</span> ارتفاع 30% فأكثر، أو 20% مع تفويل متقارب</span>
        <span><span className={`inline-block px-2 py-0.5 rounded-full font-black ${TONE['مرتفع'].pill}`}>مرتفع</span> ارتفاع 15% فأكثر</span>
        <span><span className={`inline-block px-2 py-0.5 rounded-full font-black ${TONE['منخفض'].pill}`}>منخفض</span> انخفاض 10% فأكثر</span>
        <span>التغير = المعدل اليومي في الفترة الأخيرة مقابل معدل الفترات السابقة، على أيام الكشوف فقط</span>
      </div>
    </div>
  );
};
