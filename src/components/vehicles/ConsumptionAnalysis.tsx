/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowDownWideNarrow, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FlaskConical, Printer, Repeat2, Search, X } from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import { FREQUENT_DAYS, VEHICLE_PROFILES_KEY, VEHICLE_ROUTES_KEY, capConsumption, daysBetween, fillConsumption, imageGround, tankCaps, tankCountOf, vehicleCategory, vehicleImage, withTanks, type DayFill, type VehicleProfile, type VehicleRoute } from '../../lib/vehicleFuel';
import { VEHICLE_REGISTRY_KEY, type VehicleRegistryEntry } from '../../lib/vehicleRegistry';
import { useCategoryNames, useVehicleNames } from './categories';
import { VehicleArt } from './VehicleArt';
import { buildConsumptionSheet, printHtml } from './printConsumption';

type Unit = 'day' | 'week' | 'month';
type Status = 'حرج' | 'مرتفع' | 'طبيعي' | 'منخفض' | 'جديد';
type SortKey = 'change' | 'current';

const PAGE = 10;
/** أرقام الصفحات الظاهرة، والباقي بالأسهم */
const PAGE_BUTTONS = 5;
const UNITS: [Unit, string][] = [['day', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري']];
const MONTHS = ['كانون 2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين 1', 'تشرين 2', 'كانون 1'];

/** لون كل حالة: نقطة صغيرة في الجدول، وعمود الفترة الأخيرة في الرسم */
const DOT: Record<Status, string> = {
  'حرج': 'bg-rose-500',
  'مرتفع': 'bg-amber-400',
  'طبيعي': 'bg-slate-400',
  'منخفض': 'bg-teal-500',
  'جديد': 'bg-sky-500',
};
const RULES = 'التغير = آخر تفويلة مقابل التي قبلها، على الصرف اليومي (الكمية ÷ الأيام منذ السابقة)، وإن لم تُعرف أيام السابقة فعلى الكمية · حرج: ارتفاع 30% فأكثر، أو 20% مع تفويل متقارب · مرتفع: 15% فأكثر · منخفض: انخفاض 10% فأكثر · جديد: لا توجد تفويلتان للمقارنة';
const USED_RULE = 'مجموع تفويلات الفترات الأربع (أو الفترة المختارة من وإلى)، لأن كل تفويلة تملأ الخزان فتساوي ما صُرف قبلها. أول تفويلة بلا سابقة لا تُحسب، والتفويلة الأكبر من السعة تُقص عندها، والرقم تحته = سعة الخزان ناقص الاستهلاك. بلا خزان مسجل يظهر الرقم تقديريًا بلا قص';

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

/** فترة مختارة (من/إلى): العمود الأخير هي، وقبلها ثلاث فترات بطولها للمقارنة */
const buildRangePeriods = (from: string, to: string): Period[] => {
  const n = daysBetween(from, to) + 1;
  return [3, 2, 1, 0].map(back => {
    const end = addDays(to, -back * n);
    const start = addDays(end, 1 - n);
    const name = `${short(start)}–${short(end)}`;
    return { from: start, to: end, name, range: name };
  });
};

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
  /** مجموع سعات الخزانات (0 = غير مسجلة) */
  capacity: number;
  /** الاستهلاك في الفترات الأربع؛ null = لا تفويلة لها سابقة */
  used: number | null;
  /** السعة غير مسجلة: الاستهلاك بلا قص على الخزان */
  estimated: boolean;
  /** عدد الخزانات (null = غير محدد) */
  tanks: number | null;
  /** المسافة المقطوعة في نفس فترة الاستهلاك (كم) من مسارات العربة */
  km: number;
  /** صرف آخر تفويلة والتي قبلها (لتر/يوم، أو لتر إن قورنت الكمية) */
  now: number | null;
  before: number | null;
  /** أساس المقارنة: الصرف اليومي أو كمية التفويلة */
  cmpBy: 'rate' | 'qty';
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
 * endDate هو اليوم الافتراضي للتحليل ويتغير من تقويم الصفحة. مع category تظهر عربات الفئة فقط،
 * وأيام الكشوف تبقى محسوبة من كل الأسطول حتى يُعد يوم كشف لم تفوّل فيه الفئة يومًا بلا استهلاك.
 */
export const ConsumptionAnalysis: React.FC<{
  allFills: DayFill[];
  endDate: string;
  category?: string | null;
  categoryName?: string;
  onClearCategory?: () => void;
  onOpen: (vehicle: string) => void;
  onLab: (vehicle: string) => void;
}> = ({ allFills, endDate: initialEnd, category, categoryName, onClearCategory, onOpen, onLab }) => {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [endDate, setEndDate] = useState(initialEnd);
  /** بداية الفترة المختارة؛ null = يوم نهاية واحد بالوحدة المختارة */
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [unit, setUnit] = useState<Unit>('day');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('change');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const names = useVehicleNames();
  const [labels] = useCategoryNames();
  const [profiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const [registry] = useSyncedStorage<VehicleRegistryEntry[]>(VEHICLE_REGISTRY_KEY, []);
  const [routes] = useSyncedStorage<VehicleRoute[]>(VEHICLE_ROUTES_KEY, []);
  const [printOpen, setPrintOpen] = useState(false);

  const periods = useMemo(() => (fromDate ? buildRangePeriods(fromDate, endDate) : buildPeriods(endDate, unit)), [fromDate, endDate, unit]);
  const periodOf = (date: string) => periods.findIndex(p => date >= p.from && date <= p.to);

  /** عدد أيام الكشوف في كل فترة (أي تاريخ فيه تفويلات لأي عربة) */
  const cov = useMemo(() => periods.map(p => new Set(allFills.filter(f => f.date >= p.from && f.date <= p.to).map(f => f.date)).size), [allFills, periods]);
  const sheetDates = useMemo(() => new Set(allFills.map(f => f.date)), [allFills]);

  const allRows = useMemo<Row[]>(() => {
    // المسافة على نفس فترة الاستهلاك: الفترات الأربع، أو الفترة المختارة وحدها
    const kmFrom = fromDate ? periods[3].from : periods[0].from;
    const kmTo = periods[3].to;
    const kmOf = new Map<string, number>();
    for (const r of routes) if (r.date >= kmFrom && r.date <= kmTo) kmOf.set(r.vehicle, (kmOf.get(r.vehicle) || 0) + r.km);
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
      const code = names.get(vehicle) || vehicle;
      const cat = vehicleCategory(code);
      const prof = withTanks(profiles.find(x => x.id === vehicle), vehicle);
      const lastFill = last as DayFill | null;
      const capacity = tankCaps(prof).reduce((s, c) => s + c, 0);
      // الصرف من تسلسل كل تفويلات العربة؛ بلا خزان مسجل يبقى بلا قص (تقديري)
      const cons = fillConsumption(list);
      const spent = capacity ? capConsumption(cons, capacity) : cons;
      const inRange = spent.filter(c => c.consumed !== null && periodOf(c.date) >= (fromDate ? 3 : 0));
      const used = inRange.length ? inRange.reduce((s, c) => s + c.consumed!, 0) : null;
      // آخر تفويلة داخل الفترات مقابل التي قبلها (ولو كانت قبل الفترات)
      let at = -1;
      list.forEach((f, j) => { if (periodOf(f.date) >= 0) at = j; });
      const daily = (j: number) => {
        const c = spent[j];
        const gap = c?.prevDate ? daysBetween(c.prevDate, c.date) : 0;
        return c && c.consumed !== null && gap > 0 ? c.consumed / gap : null;
      };
      const amount = (j: number) => (spent[j]?.consumed ?? (capacity ? Math.min(list[j].qty, capacity) : list[j].qty));
      let now: number | null = null;
      let before: number | null = null;
      let cmpBy: 'rate' | 'qty' = 'rate';
      if (at > 0) {
        const a = daily(at);
        const b = daily(at - 1);
        if (a !== null && b !== null) { now = a; before = b; }
        else { now = amount(at); before = amount(at - 1); cmpBy = 'qty'; }
      }
      const change = now !== null && before ? ((now - before) / before) * 100 : null;
      return [{
        vehicle, code, display: prof?.name || vehicle,
        catKey: cat?.key || 'OTHER', cat: (cat && labels[cat.key]) || cat?.label || 'أخرى',
        driver: lastFill?.drivers[0] || prof?.driver || '',
        p, capacity, used, estimated: !capacity, tanks: tankCountOf(prof), km: kmOf.get(vehicle) || 0, now, before, cmpBy, rate, prevRate, curRate, change, n: recent.length, minGap, multi,
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
      const status: Status = c === null ? 'جديد'
        : c >= 30 || (r.close && c >= 20) ? 'حرج'
        : c >= 15 ? 'مرتفع' : c <= -10 ? 'منخفض' : 'طبيعي';
      return { ...r, catAvg, dev, status };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFills, periods, cov, names, labels, profiles, routes]);
  const rows = useMemo(() => allRows.filter(r => !category || r.catKey === category), [allRows, category]);

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
  const pageCount = Math.min(PAGE_BUTTONS, pages);
  const firstPage = Math.min(Math.max(0, cur - Math.floor(pageCount / 2)), pages - pageCount);

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
    if (!r.p[3]) out.push([`لم تفوّل في ${lastName}`, 'bg-slate-400']);
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

  const tabs: (Status | 'all')[] = ['all', 'حرج', 'مرتفع', 'منخفض', 'طبيعي', 'جديد'];

  // الطباعة: عامة (كل الفئات مجمّعة) أو لفئة واحدة، على الفترات الظاهرة في الجدول
  const printCats = useMemo(() => {
    const m = new Map<string, { key: string; name: string; count: number }>();
    for (const r of allRows) { const c = m.get(r.catKey); if (c) c.count++; else m.set(r.catKey, { key: r.catKey, name: r.cat, count: 1 }); }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [allRows]);
  const doPrint = (catKey: string | null) => {
    setPrintOpen(false);
    const list = catKey ? allRows.filter(r => r.catKey === catKey) : allRows;
    const name = catKey ? printCats.find(c => c.key === catKey)?.name || '' : 'عام';
    printHtml(buildConsumptionSheet({
      rows: list,
      periods,
      title: 'كشف استهلاك العربات',
      scope: name,
      periodLabel: `من ${fromDate ?? periods[0].from} إلى ${fromDate ? endDate : periods[3].to}`,
      grouped: !catKey,
    }));
  };

  // الخط الزمني لأيام الفترة الأخيرة (يمين = أقدم)
  const span = daysBetween(periods[3].from, periods[3].to);
  const pos = (d: string) => (span ? (daysBetween(periods[3].from, d) / span) * 100 : 50);

  return (
    <div className="vehicle-page space-y-5 pb-12 font-cairo">
      {/* العنوان والأدوات */}
      <div className="va-rise relative z-30 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl sm:text-[28px] font-black tracking-tight text-slate-900 dark:text-white">تحليل الاستهلاك</h2>
          {category && (
            <span className="inline-flex items-center gap-1.5 h-8 pr-3 pl-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-black">
              {categoryName}
              <button type="button" onClick={onClearCategory} aria-label="إلغاء تحديد الفئة" title="كل الفئات" className="w-5 h-5 rounded-full inline-flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <button type="button" aria-label="تاريخ التحليل" onClick={() => setDateOpen(o => !o)} className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-bold font-mono text-slate-700 dark:text-slate-200 hover:border-sky-400 cursor-pointer">
              <CalendarDays className="w-4 h-4 text-sky-600" />{fromDate ? `${fromDate} ← ${endDate}` : endDate}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dateOpen ? 'rotate-180' : ''}`} />
            </button>
            {dateOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDateOpen(false)} />
                <div className="absolute z-50 top-full mt-2 right-0 sm:right-auto sm:left-0">
                  <DateRangeCalendar
                    from={fromDate ?? endDate}
                    to={endDate}
                    marked={sheetDates}
                    max={[...sheetDates].sort().pop()}
                    onApply={(from, to) => { setFromDate(from < to ? from : null); setEndDate(to); setPage(0); setDateOpen(false); }}
                    onClear={() => { setFromDate(null); setEndDate(initialEnd); setPage(0); setDateOpen(false); }}
                  />
                </div>
              </>
            )}
          </div>
          <div role="group" aria-label="مدة كل عمود" className="flex gap-0.5 p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800">
            {UNITS.map(([u, l]) => (
              <button key={u} type="button" aria-pressed={!fromDate && unit === u} onClick={() => { setFromDate(null); setUnit(u); setPage(0); }} className={`h-9 px-4 rounded-xl border text-sm font-bold cursor-pointer outline-hidden transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-400 ${!fromDate && unit === u ? 'border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-l from-indigo-50 to-sky-50 dark:from-indigo-950/50 dark:to-sky-950/30 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>{l}</button>
            ))}
          </div>
          <div className="relative">
            <button type="button" aria-haspopup="menu" aria-expanded={printOpen} onClick={() => setPrintOpen(o => !o)} className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 cursor-pointer">
              <Printer className="w-4 h-4 text-indigo-600" />طباعة
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${printOpen ? 'rotate-180' : ''}`} />
            </button>
            {printOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPrintOpen(false)} />
                <div role="menu" className="absolute z-50 top-full mt-2 left-0 w-56 max-h-80 overflow-y-auto vehicle-scroll p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
                  <button type="button" role="menuitem" onClick={() => doPrint(null)} className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-xl text-sm font-black text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer">
                    عام — كل الفئات<bdi className="font-mono text-[11px] text-slate-400">{allRows.length}</bdi>
                  </button>
                  <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                  {printCats.map(c => (
                    <button key={c.key} type="button" role="menuitem" onClick={() => doPrint(c.key)} className={`w-full flex items-center justify-between gap-2 h-9 px-3 rounded-xl text-[13px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer ${c.key === category ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                      {c.name}<bdi className="font-mono text-[11px] text-slate-400">{c.count}</bdi>
                    </button>
                  ))}
                </div>
              </>
            )}
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
      {/* مسافة أعلى الصف حتى تبرز العربة فوق حافة الكارت الجانبي */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-stretch pt-3">
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
            <table className="w-full min-w-[880px] text-right">
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
                        {cov[i] ? (unit === 'day' && !fromDate ? 'كشف' : `${cov[i]} يوم`) : 'لا كشوف'}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 font-bold text-center" title={USED_RULE}>الاستهلاك</th>
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
                      <td className="px-2">
                        {r.used === null ? <div className="text-center text-slate-400" title="لا توجد تفويلة لها سابقة">—</div> : r.estimated ? (
                          <div className="flex flex-col items-center gap-0.5" title={`استهلاك تقديري ${fmt(r.used)} لتر · سعة الخزان غير مسجلة`}>
                            <span className="inline-flex items-center justify-center min-w-9 h-9 px-1.5 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-600 text-[12.5px] font-mono font-bold text-slate-600 dark:text-slate-300">{fmt(r.used)}</span>
                            <span className="text-[10px] font-medium whitespace-nowrap text-slate-400">بلا خزان</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5" title={`استهلاك ${fmt(r.used)} لتر · سعة الخزان ${fmt(r.capacity)} لتر`}>
                            <span className="inline-flex items-center justify-center min-w-9 h-9 px-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 ring-1 ring-indigo-300 dark:ring-indigo-700 text-[12.5px] font-mono font-bold text-indigo-700 dark:text-indigo-300">{fmt(r.used)}</span>
                            <span className={`text-[10px] font-medium whitespace-nowrap ${r.used > r.capacity ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                              {r.used > r.capacity ? 'فوق السعة' : 'متبقي'} <bdi className="font-mono">{fmt(Math.abs(r.capacity - r.used))}</bdi>
                            </span>
                          </div>
                        )}
                      </td>
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
                {!view.length && <tr><td colSpan={9} className="text-center text-sm text-slate-400 py-12">لا توجد عربات مطابقة</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div><bdi className="font-mono text-slate-900 dark:text-white">{visible.length ? cur * PAGE + 1 : 0}–{cur * PAGE + view.length}</bdi> من <bdi className="font-mono text-slate-900 dark:text-white">{visible.length}</bdi></div>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="الصفحة السابقة" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                {Array.from({ length: pageCount }, (_, i) => firstPage + i).map(i => (
                  <button key={i} type="button" aria-current={i === cur ? 'page' : undefined} onClick={() => setPage(i)} className={`w-8 h-8 rounded-lg text-xs font-bold font-mono cursor-pointer transition-colors ${i === cur ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`}>{i + 1}</button>
                ))}
                <button type="button" disabled={cur === pages - 1} onClick={() => setPage(cur + 1)} aria-label="الصفحة التالية" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </section>

        {/* الجانب: العربة المحددة — ينتهي مع نهاية كارت الجدول (يأخذ ارتفاعه ولا يحدده) */}
        <div className="lg:col-span-3 relative lg:min-h-[760px]">
          <aside aria-label="العربة المحددة" className="va-rise lg:absolute lg:inset-0 flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card" style={{ animationDelay: '.25s' }}>
            {sel ? (
              <div key={sel.vehicle} className="flex flex-col flex-1 min-h-0">
                {/* العربة كبيرة وثابتة على أرضية بيضاء، أعلاها يبرز فوق حافة الكارت، وعجلاتها على الأرض */}
                {(() => {
                  const url = vehicleImage(sel.code, profiles.find(p => p.id === sel.vehicle)?.photo);
                  return (
                    <div className="relative h-[230px] shrink-0 rounded-t-3xl">
                      <div className="va-appear absolute left-1/2 bottom-7 -translate-x-1/2 w-[min(330px,88%)] h-px z-10">
                        <img src={url} alt={`صورة العربة ${sel.display}`} className="absolute bottom-0 left-0 w-full h-auto max-w-none" style={{ transform: `translateY(${imageGround(url) * 100}%)` }} />
                      </div>
                  <span className="absolute z-20 top-3 right-3 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/95 dark:bg-slate-900/90 shadow-sm text-xs font-bold text-slate-800 dark:text-slate-100">
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT[sel.status]}`} />{sel.status}
                  </span>
                    </div>
                  );
                })()}

                <div className="flex-1 min-h-0 flex flex-col gap-4 p-5">
                  <div className="va-fade">
                    <div className="text-2xl font-mono font-semibold tracking-tight text-slate-900 dark:text-white truncate" dir="ltr" style={{ textAlign: 'right' }}>{sel.display}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sel.cat}{sel.driver && <> · {sel.driver}</>}</div>
                  </div>

                  {/* الآن مقابل قبل */}
                  <div className="va-fade grid grid-cols-[1fr_auto_1fr] items-end gap-3" style={{ animationDelay: '.05s' }}>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">الآن</div>
                      <div className={`text-[32px] leading-tight font-mono font-semibold tracking-tight ${sel.change !== null && sel.change >= 15 ? 'text-rose-600 dark:text-rose-400' : sel.change !== null && sel.change <= -10 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-900 dark:text-white'}`}>{sel.now !== null ? num(sel.now) : '—'}</div>
                    </div>
                    <span className={`self-center px-3 py-1.5 rounded-full text-xs ${sel.change !== null && sel.change >= 15 ? 'bg-rose-50 dark:bg-rose-950/40' : sel.change !== null && sel.change <= -10 ? 'bg-teal-50 dark:bg-teal-950/40' : 'bg-slate-100 dark:bg-slate-800'}`}><Delta value={sel.change} /></span>
                    <div className="text-left">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">قبل</div>
                      <div className="text-[22px] leading-tight font-mono font-semibold text-slate-400">{sel.before !== null ? num(sel.before) : '—'}</div>
                    </div>
                  </div>
                  <div className="-mt-3 text-[10.5px] text-slate-400">{sel.cmpBy === 'rate' ? 'لتر يوميًا · آخر تفويلة مقابل السابقة' : 'لتر بالتفويلة · آخر تفويلة مقابل السابقة'}</div>

                  {/* المعدل في الفترات الأربع */}
                  {(() => {
                    const top = Math.max(1, ...sel.rate.map(r => r ?? 0), sel.prevRate) * 1.25;
                    return (
                      <div className="shrink-0 flex flex-col">
                        <div className="relative h-16 flex items-end gap-3 border-b border-slate-200 dark:border-slate-700">
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

                  {/* مدخل مختبر العربة: كارت فاتح من نفس طابع اللوحة الجانبية */}
                  {(() => {
                    const prof = withTanks(profiles.find(p => p.id === sel.vehicle), sel.vehicle);
                    const reg = registry.find(r => r.id === sel.code.toUpperCase());
                    const label = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400';
                    return (
                      <button type="button" onClick={() => onLab(sel.vehicle)} aria-label={`افتح بيانات عامة للعربة ${sel.display}`} className="group mt-auto shrink-0 w-full text-right rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-l from-indigo-50 to-sky-50 dark:from-indigo-950/50 dark:to-sky-950/30 cursor-pointer transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                        <span className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="w-9 h-9 shrink-0 rounded-xl bg-white dark:bg-slate-900/70 text-indigo-600 dark:text-indigo-300 inline-flex items-center justify-center"><FlaskConical className="w-[18px] h-[18px]" /></span>
                            <span className="min-w-0">
                              <span className="block text-sm font-black text-slate-900 dark:text-white">بيانات عامة</span>
                              <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 truncate">من اليوم إلى سنة · الصرف الحقيقي</span>
                            </span>
                          </span>
                          <ChevronLeft className="w-[18px] h-[18px] shrink-0 text-indigo-500 transition-transform group-hover:-translate-x-1" />
                        </span>
                        <span className="grid grid-cols-[1.1fr_1.3fr_0.7fr] border-t border-indigo-100 dark:border-indigo-900/50 px-4 py-2.5">
                          <span className="min-w-0"><span className={label}>رقم الآلية</span><span className="block font-mono text-[13.5px] font-semibold text-slate-900 dark:text-white truncate" dir="ltr" style={{ textAlign: 'right' }}>{reg?.plate || '—'}</span></span>
                          <span className="min-w-0 border-r border-indigo-100 dark:border-indigo-900/50 pr-3"><span className={label}>المجموعة</span><span className="block text-[12.5px] font-bold text-slate-900 dark:text-white truncate">{reg?.group?.replace(/^اليات\s*/, '').replace(/[\s-]+$/, '') || '—'}</span></span>
                          <span className="border-r border-indigo-100 dark:border-indigo-900/50 pr-3"><span className={label}>الخزانات</span><span className="block font-mono text-[13.5px] font-semibold text-slate-900 dark:text-white">{tankCountOf(prof) ?? '—'}</span></span>
                        </span>
                      </button>
                    );
                  })()}
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
