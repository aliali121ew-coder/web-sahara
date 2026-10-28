/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowDownWideNarrow, ArrowUpRight, ChevronLeft, ChevronRight, Repeat2, Search } from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { FREQUENT_DAYS, VEHICLE_PROFILES_KEY, daysBetween, vehicleCategory, type DayFill, type VehicleProfile } from '../../lib/vehicleFuel';
import { useCategoryNames, useVehicleNames } from './categories';
import { VehicleArt } from './VehicleArt';

type Unit = 'day' | 'week' | 'month';
type Status = 'حرج' | 'مرتفع' | 'طبيعي' | 'منخفض' | 'جديد' | 'بلا تفويل';
type SortKey = 'change' | 'current';

const PAGE = 10;
const UNITS: [Unit, string][] = [['day', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري']];
const MONTHS = ['كانون 2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين 1', 'تشرين 2', 'كانون 1'];

/** لون كل حالة: نقطة صغيرة في الجدول، وعمود الفترة الأخيرة في الرسم */
const DOT: Record<Status, string> = {
  'حرج': 'bg-rose-500',
  'مرتفع': 'bg-amber-400',
  'طبيعي': 'bg-slate-400',
  'منخفض': 'bg-teal-500',
  'جديد': 'bg-sky-500',
  'بلا تفويل': 'bg-slate-300 dark:bg-slate-600',
};
const RULES = 'حرج: ارتفاع 30% فأكثر، أو 20% مع تفويل متقارب · مرتفع: 15% فأكثر · منخفض: انخفاض 10% فأكثر — على المعدل اليومي في أيام الكشوف';

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
const changeTone = (x: number | null) => (x === null ? 'text-slate-400' : x >= 15 ? 'text-rose-600 dark:text-rose-400' : x <= -10 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400');

/** نسبة التغير بسهم والرقم معزول باتجاه LTR حتى لا يختلط بالنص العربي */
const Delta: React.FC<{ value: number | null; className?: string }> = ({ value, className = '' }) => (
  value === null ? <span className={`text-slate-400 ${className}`}>—</span> : (
    <span className={`inline-flex items-center gap-0.5 font-mono font-semibold ${changeTone(value)} ${className}`}>
      {value > 0 ? <ArrowUpRight className="w-3.5 h-3.5 shrink-0" /> : value < 0 ? <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" /> : null}
      <bdi dir="ltr">{absPct(value)}</bdi>
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
  const firstSheet = useMemo(() => allFills.reduce((m, f) => (!m || f.date < m ? f.date : m), ''), [allFills]);

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
    const key = (r: Row) => (sort === 'current' ? r.p[3] : r.change ?? -Infinity);
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
  const count = (s: Status) => rows.filter(r => r.status === s).length;
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const lastName = periods[3].name;

  /** تنبيهان على الأكثر بكلمات قليلة */
  const signals = (r: Row) => {
    const out: [string, string][] = [];
    if (r.change !== null && r.change >= 30) out.push(['ارتفاع حاد', 'bg-rose-500']);
    else if (r.change !== null && r.change >= 15) out.push(['ارتفاع', 'bg-amber-400']);
    else if (r.change !== null && r.change <= -10) out.push(['انخفاض', 'bg-teal-500']);
    if (r.multi > 0) out.push(['تفويل مكرر باليوم', 'bg-rose-500']);
    else if (r.minGap !== null && r.minGap <= FREQUENT_DAYS) out.push(['يومان متتاليان', 'bg-amber-400']);
    if (r.status === 'جديد') out.push(['بلا سابقة للمقارنة', 'bg-sky-500']);
    if (r.status === 'بلا تفويل') out.push([`لم تفوّل في ${lastName}`, 'bg-slate-400']);
    if (!out.length) out.push(['مستقر', 'bg-slate-400']);
    return out.slice(0, 2);
  };

  const kpis: { label: string; value: React.ReactNode; unit?: string; note: React.ReactNode; dot: string; tone?: string; onClick?: () => void; active?: boolean }[] = [
    { label: `استهلاك ${lastName}`, value: fmt(k.totals[3]), unit: 'لتر', note: <><Delta value={k.delta} /> بالمعدل اليومي</>, dot: 'bg-indigo-500' },
    { label: 'متوسط العربة', value: fmt(k.avg), unit: 'لتر', note: <><bdi className="font-mono">{k.active}</bdi> عربة فوّلت</>, dot: 'bg-violet-500' },
    { label: 'تفويل عالٍ', value: k.crit + k.high, unit: 'عربة', note: <>حرجة <bdi className="font-mono">{k.crit}</bdi> · مرتفعة <bdi className="font-mono">{k.high}</bdi></>, dot: 'bg-rose-500', tone: 'text-rose-600 dark:text-rose-400', active: filter === 'حرج', onClick: () => { setFilter(filter === 'حرج' ? 'all' : 'حرج'); setPage(0); } },
    { label: 'أعلى ارتفاع', value: k.top ? <Delta value={k.top.change} /> : '—', note: k.top ? <bdi dir="ltr" className="font-mono">{k.top.display}</bdi> : '—', dot: 'bg-amber-400', tone: 'text-slate-900 dark:text-white', onClick: k.top ? () => onOpen(k.top!.vehicle) : undefined },
    { label: 'تفويل متقارب', value: k.close, unit: 'عربة', note: 'يومان أو اليوم نفسه', dot: 'bg-slate-400' },
  ];

  const tabs: (Status | 'all')[] = ['all', 'حرج', 'مرتفع', 'منخفض', 'طبيعي', 'جديد', 'بلا تفويل'];

  // الخط الزمني لأيام الفترة الأخيرة (يمين = أقدم)
  const span = daysBetween(periods[3].from, periods[3].to);
  const pos = (d: string) => (span ? (daysBetween(periods[3].from, d) / span) * 100 : 50);

  return (
    <div className="vehicle-page space-y-5 pb-12 font-cairo">
      {/* العنوان والأدوات */}
      <div className="va-rise flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl sm:text-[28px] font-black tracking-tight text-slate-900 dark:text-white">تحليل الاستهلاك</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          {firstSheet && (
            <span className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />الكشوف من <bdi className="font-mono">{short(firstSheet)}</bdi>
            </span>
          )}
          <div role="group" aria-label="مدة كل عمود" className="flex gap-0.5 p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800">
            {UNITS.map(([u, l]) => (
              <button key={u} type="button" aria-pressed={unit === u} onClick={() => { setUnit(u); setPage(0); }} className={`h-9 px-4 rounded-xl text-sm font-bold cursor-pointer transition-all duration-200 ${unit === u ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* شريط المؤشرات: سطح واحد بخمس خانات */}
      <section aria-label="المؤشرات" className="grid grid-cols-2 lg:grid-cols-5 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden divide-x divide-x-reverse divide-slate-100 dark:divide-slate-800">
        {kpis.map((c, i) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{c.label}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
              </div>
              <div className="flex items-baseline gap-1.5 mt-2.5">
                <span className={`text-[28px] leading-none font-mono font-semibold tracking-tight ${c.tone || 'text-slate-900 dark:text-white'}`}>{c.value}</span>
                {c.unit && <span className="text-xs font-bold text-slate-400">{c.unit}</span>}
              </div>
              <div className="flex items-center gap-1 mt-2 text-[11.5px] font-medium text-slate-500 dark:text-slate-400 truncate">{c.note}</div>
            </>
          );
          const cls = `va-rise text-right p-4 sm:p-5 transition-colors ${i === 4 ? 'col-span-2 lg:col-span-1' : ''} ${c.active ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''}`;
          return c.onClick
            ? <button key={c.label} type="button" onClick={c.onClick} aria-pressed={c.active} style={{ animationDelay: `${0.05 + i * 0.06}s` }} className={`${cls} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400`}>{body}</button>
            : <div key={c.label} style={{ animationDelay: `${0.05 + i * 0.06}s` }} className={cls}>{body}</div>;
        })}
      </section>

      {/* الجدول 70% والجانب 30% */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-stretch">
        <section aria-label="جدول المقارنة" className="va-rise lg:col-span-7 flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden" style={{ animationDelay: '.15s' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 border-b border-slate-100 dark:border-slate-800">
            <div role="tablist" aria-label="تصفية الحالة" className="flex gap-5 overflow-x-auto vehicle-scroll">
              {tabs.filter(s => s === 'all' || count(s) > 0).map(s => {
                const on = filter === s;
                return (
                  <button key={s} type="button" role="tab" aria-selected={on} onClick={() => { setFilter(s); setPage(0); }} className={`h-14 inline-flex items-center gap-1.5 border-b-2 text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${on ? 'border-indigo-600 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    {s === 'all' ? 'الكل' : s}
                    <span className={`px-1.5 py-px rounded-full text-[11px] font-mono transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{s === 'all' ? rows.length : count(s)}</span>
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 h-9 px-3 my-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-950 focus-within:ring-2 focus-within:ring-indigo-300">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="sr-only">بحث عن عربة</span>
              <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="بحث" className="w-28 bg-transparent outline-none text-xs text-slate-900 dark:text-white" />
            </label>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full min-w-[800px] text-right">
              <thead>
                <tr className="h-14 text-[11.5px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 font-bold">العربة</th>
                  {periods.map((p, i) => (
                    <th key={p.from} className="px-2 font-bold" title={p.range}>
                      {i === 3
                        ? <button type="button" onClick={() => { setSort('current'); setPage(0); }} className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 cursor-pointer">{p.name}{sort === 'current' && <ArrowDownWideNarrow className="w-3 h-3" />}</button>
                        : <span className="text-slate-600 dark:text-slate-300">{p.name}</span>}
                      <div className="flex items-center gap-1 mt-0.5 text-[10.5px] font-medium text-slate-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${cov[i] ? 'bg-teal-500' : 'border border-slate-300 dark:border-slate-600'}`} />
                        {cov[i] ? (unit === 'day' ? 'كشف' : `${cov[i]} يوم`) : 'لا كشوف'}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 font-bold">
                    <button type="button" onClick={() => { setSort('change'); setPage(0); }} className={`inline-flex items-center gap-1 cursor-pointer ${sort === 'change' ? 'text-slate-900 dark:text-white' : ''}`}>التغير{sort === 'change' && <ArrowDownWideNarrow className="w-3 h-3" />}</button>
                  </th>
                  <th className="px-2 font-bold">الاتجاه</th>
                  <th className="px-2 font-bold" title={RULES}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {view.map((r, idx) => {
                  const on = sel?.vehicle === r.vehicle;
                  const rmax = Math.max(1, ...r.rate.map(x => x ?? 0));
                  return (
                    <tr
                      key={r.vehicle}
                      tabIndex={0}
                      aria-label={`فتح صفحة العربة ${r.display}`}
                      onClick={() => onOpen(r.vehicle)}
                      onKeyDown={e => { if (e.key === 'Enter') onOpen(r.vehicle); }}
                      onMouseEnter={() => setHover(r.vehicle)}
                      onFocus={() => setHover(r.vehicle)}
                      style={{ animationDelay: `${0.2 + idx * 0.035}s` }}
                      className={`va-rise va-row h-[62px] border-b border-slate-100/80 dark:border-slate-800/60 cursor-pointer outline-none ${on ? 'bg-indigo-50/70 dark:bg-indigo-950/25' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'} focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400`}
                    >
                      <td className="px-5">
                        <div className="flex items-center gap-3 min-w-0">
                          <VehicleArt code={r.code} photo={profiles.find(p => p.id === r.vehicle)?.photo} className={`w-11 h-9 shrink-0 rounded-xl transition-colors duration-300 ${on ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-slate-100 dark:bg-slate-800'}`} imgClassName="p-0.5" />
                          <div className="min-w-0">
                            <div className={`va-code text-sm font-semibold font-mono truncate transition-colors ${on ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`} dir="ltr" style={{ textAlign: 'right' }}>{r.display}</div>
                            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{r.cat}</div>
                          </div>
                        </div>
                      </td>
                      {r.p.map((v, i) => (
                        <td key={i} className={`px-2 text-[13px] font-mono ${!cov[i] ? 'text-slate-300 dark:text-slate-600' : i === 3 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                          {!cov[i] ? '·' : v ? fmt(v) : '—'}
                        </td>
                      ))}
                      <td className="px-2"><Delta value={r.change} className="text-[13px]" /></td>
                      <td className="px-2">
                        <div className="flex items-end gap-[3px] h-[26px]" aria-hidden>
                          {r.rate.map((x, i) => (
                            <span key={i} className={`va-grow block w-2.5 rounded-[3px] ${x === null ? 'bg-slate-200 dark:bg-slate-700' : i === 3 ? DOT[r.status] : 'bg-slate-300 dark:bg-slate-600'}`} style={{ height: x === null ? 2 : Math.max(3, (x / rmax) * 26), animationDelay: `${0.25 + idx * 0.035 + i * 0.05}s` }} />
                          ))}
                        </div>
                      </td>
                      <td className="px-2">
                        <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[r.status]} ${r.status === 'حرج' ? 'va-pulse' : ''}`} />
                          {r.status}
                          {r.close && <Repeat2 className="w-3.5 h-3.5 text-rose-500" aria-label="تفويل متقارب" />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!view.length && <tr><td colSpan={8} className="text-center text-sm text-slate-400 py-12">لا توجد عربات مطابقة</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div><bdi className="font-mono text-slate-900 dark:text-white">{visible.length ? cur * PAGE + 1 : 0}–{cur * PAGE + view.length}</bdi> من <bdi className="font-mono text-slate-900 dark:text-white">{visible.length}</bdi></div>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="الصفحة السابقة" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                {Array.from({ length: pages }, (_, i) => i).filter(i => i === 0 || i === pages - 1 || Math.abs(i - cur) <= 1).map((i, idx, arr) => (
                  <React.Fragment key={i}>
                    {idx > 0 && i - arr[idx - 1] > 1 && <span className="px-1">…</span>}
                    <button type="button" aria-current={i === cur ? 'page' : undefined} onClick={() => setPage(i)} className={`w-8 h-8 rounded-lg text-xs font-bold font-mono cursor-pointer transition-colors ${i === cur ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`}>{i + 1}</button>
                  </React.Fragment>
                ))}
                <button type="button" disabled={cur === pages - 1} onClick={() => setPage(cur + 1)} aria-label="الصفحة التالية" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </section>

        {/* الجانب: العربة المحددة — ينتهي مع نهاية كارت الجدول (يأخذ ارتفاعه ولا يحدده) */}
        <div className="lg:col-span-3 relative lg:min-h-[760px]">
          <aside aria-label="العربة المحددة" className="va-rise lg:absolute lg:inset-0 flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden" style={{ animationDelay: '.25s' }}>
            {sel ? (
              <div key={sel.vehicle} className="flex flex-col flex-1 min-h-0">
                {/* الصورة والحالة */}
                <div className="relative h-32 shrink-0 bg-slate-100/80 dark:bg-slate-800/50">
                  <span className="absolute bottom-5 inset-x-1/4 h-2.5 rounded-[50%] bg-slate-900/10 dark:bg-black/30" />
                  <VehicleArt code={sel.code} photo={profiles.find(p => p.id === sel.vehicle)?.photo} className="absolute inset-x-12 inset-y-3 vehicle-truck-in" />
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/95 dark:bg-slate-900/90 shadow-sm text-xs font-bold text-slate-800 dark:text-slate-100">
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT[sel.status]}`} />{sel.status}
                  </span>
                </div>

                <div className="flex-1 min-h-0 flex flex-col gap-4 p-5">
                  <div className="va-fade">
                    <div className="text-2xl font-mono font-semibold tracking-tight text-slate-900 dark:text-white truncate" dir="ltr" style={{ textAlign: 'right' }}>{sel.display}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sel.cat}{sel.driver && <> · {sel.driver}</>}</div>
                  </div>

                  {/* الآن مقابل قبل */}
                  <div className="va-fade grid grid-cols-[1fr_auto_1fr] items-end gap-3" style={{ animationDelay: '.05s' }}>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">الآن</div>
                      <div className={`text-[32px] leading-tight font-mono font-semibold tracking-tight ${sel.change !== null && sel.change >= 15 ? 'text-rose-600 dark:text-rose-400' : sel.change !== null && sel.change <= -10 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-900 dark:text-white'}`}>{sel.curRate ? num(sel.curRate) : '—'}</div>
                    </div>
                    <span className={`self-center px-3 py-1.5 rounded-full text-xs ${sel.change !== null && sel.change >= 15 ? 'bg-rose-50 dark:bg-rose-950/40' : sel.change !== null && sel.change <= -10 ? 'bg-teal-50 dark:bg-teal-950/40' : 'bg-slate-100 dark:bg-slate-800'}`}><Delta value={sel.change} /></span>
                    <div className="text-left">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">قبل</div>
                      <div className="text-[22px] leading-tight font-mono font-semibold text-slate-400">{sel.prevRate ? num(sel.prevRate) : '—'}</div>
                    </div>
                  </div>
                  <div className="-mt-3 text-[10.5px] text-slate-400">لتر لكل يوم كشوف</div>

                  {/* المعدل في الفترات الأربع */}
                  {(() => {
                    const top = Math.max(1, ...sel.rate.map(r => r ?? 0), sel.prevRate) * 1.25;
                    return (
                      <div className="flex-1 min-h-[120px] flex flex-col">
                        <div className="relative flex-1 min-h-[80px] flex items-end gap-3 border-b border-slate-200 dark:border-slate-700">
                          {sel.prevRate > 0 && <div className="va-line absolute inset-x-0 border-t-[1.5px] border-dashed border-slate-400/80 z-10" style={{ bottom: `${(sel.prevRate / top) * 100}%` }} />}
                          {sel.rate.map((v, i) => (
                            <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                              <span className={`text-[11px] font-mono font-semibold ${v === null ? 'text-slate-300 dark:text-slate-600' : i === 3 ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{v === null ? '' : num(v)}</span>
                              <span className={`va-grow block w-full max-w-[46px] rounded-t-[10px] rounded-b-[3px] ${v === null ? 'bg-slate-100 dark:bg-slate-800' : i === 3 ? DOT[sel.status] : 'bg-slate-200 dark:bg-slate-700'}`} style={{ height: v === null ? '3px' : `${Math.max(3, (v / top) * 100)}%`, animationDelay: `${i * 0.07}s` }} />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-3 pt-2">
                          {periods.map(p => <div key={p.from} className="flex-1 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{p.name}</div>)}
                        </div>
                      </div>
                    );
                  })()}

                  {/* تفويلات الفترة الأخيرة على خط زمني: الحجم حسب الكمية، والأحمر أكثر من مرة في اليوم */}
                  {span > 0 && (
                    <div className="va-fade shrink-0" style={{ animationDelay: '.1s' }}>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2.5">
                        <span>تفويلات {lastName}</span><bdi className="font-mono">{sel.recent.reduce((s, f) => s + f.parts, 0)}</bdi>
                      </div>
                      <div className="relative h-11">
                        <span className="absolute top-[13px] inset-x-1 h-0.5 rounded bg-slate-100 dark:bg-slate-800" />
                        {sel.recent.length > 1 && (() => {
                          const ds = sel.recent.map(f => pos(f.date));
                          return <span className="va-track absolute top-[13px] h-0.5 rounded bg-indigo-500" style={{ right: `${Math.min(...ds)}%`, left: `${100 - Math.max(...ds)}%` }} />;
                        })()}
                        {sel.recent.map((f, j) => {
                          const qmax = Math.max(...sel.recent.map(x => x.qty));
                          const size = 10 + (f.qty / qmax) * 10;
                          const hot = f.parts > 1;
                          return (
                            <span
                              key={f.date}
                              title={`${short(f.date)} · ${fmt(f.qty)} لتر${hot ? ` · ${f.parts} مرات` : ''}`}
                              className={`va-fade absolute rounded-full border-2 border-white dark:border-slate-900 ${hot ? 'bg-rose-500 ring-1 ring-rose-500' : 'bg-indigo-500 ring-1 ring-indigo-500'}`}
                              style={{ width: size, height: size, top: 14 - size / 2, right: `calc(${pos(f.date)}% - ${size / 2}px)`, animationDelay: `${0.15 + j * 0.08}s` }}
                            />
                          );
                        })}
                        {[periods[3].from, ...sel.recent.map(f => f.date), periods[3].to].filter((d, i, a) => a.indexOf(d) === i).map(d => (
                          <bdi key={d} className={`absolute top-7 w-8 -mr-4 text-center text-[10px] font-mono ${sel.recent.some(f => f.date === d) ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`} style={{ right: `${pos(d)}%` }}>{d.slice(8)}</bdi>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {signals(sel).map(([t, dot]) => (
                      <span key={t} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{t}</span>
                    ))}
                  </div>

                  <button type="button" onClick={() => onOpen(sel.vehicle)} className="shrink-0 w-full flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold cursor-pointer transition-all hover:-translate-y-px hover:shadow-lg">
                    صفحة العربة<ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-400">لا توجد تفويلات في الفترات المختارة</div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};
