/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Fuel, LineChart, Loader2, RefreshCw, UserRound, Users } from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import {
  VEHICLE_PROFILES_KEY, categoryLabel, labImage, vehicleCategory,
  type DayFill, type VehicleProfile, type VehicleRefill,
} from '../../lib/vehicleFuel';
import { VEHICLE_REGISTRY_KEY, readVehicleRegistry, type VehicleRegistryEntry } from '../../lib/vehicleRegistry';

type Range = 'day' | 'week' | 'month' | 'q' | 'year';

// التواريخ في الكشوف بصيغة YYYY/MM/DD
const toMs = (d: string) => { const [y, m, dd] = d.split('/').map(Number); return Date.UTC(y, m - 1, dd); };
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '/');
const addDays = (d: string, n: number) => fromMs(toMs(d) + n * 86400000);
const short = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
const WEEKDAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS = ['ك2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'ت1', 'ت2', 'ك1'];

const fmt = (x: number | null, d = 0) => (x === null || !isFinite(x) ? '—' : x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
const num = (v: string) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };

interface Bucket { label: string; value: number }

/** حاويات الرسم: يوم = سطور آخر يوم تفويل، أسبوع/شهر = أيام، 3 أشهر = أسابيع، سنة = أشهر */
const buildBuckets = (range: Range, end: string, fills: DayFill[], lastDayLines: VehicleRefill[]): Bucket[] => {
  const sum = (from: string, to: string) => fills.filter(f => f.date >= from && f.date <= to).reduce((s, f) => s + f.qty, 0);
  if (range === 'day') return lastDayLines.map((r, i) => ({ label: `${i + 1}`, value: r.qty }));
  if (range === 'week' || range === 'month') {
    const n = range === 'week' ? 7 : 30;
    return Array.from({ length: n }, (_, i) => {
      const d = addDays(end, i - n + 1);
      return { label: range === 'week' ? WEEKDAYS[new Date(toMs(d)).getUTCDay()] : d.slice(8), value: sum(d, d) };
    });
  }
  if (range === 'q') {
    return Array.from({ length: 13 }, (_, i) => {
      const to = addDays(end, -(12 - i) * 7);
      return { label: short(addDays(to, -6)), value: sum(addDays(to, -6), to) };
    });
  }
  const [y, m] = end.split('/').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const from = fromMs(dt.getTime());
    const to = fromMs(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
    return { label: MONTHS[dt.getUTCMonth()], value: sum(from, to) };
  });
};

/** خط ومساحة الرسم (RTL: الأقدم يمينًا) */
const paths = (values: number[]) => {
  const n = values.length;
  const max = Math.max(1, ...values) * 1.15;
  const X = (i: number) => (n === 1 ? 500 : (1 - i / (n - 1)) * 1000);
  const Y = (v: number) => 210 - (v / max) * 190;
  const pts = values.map((v, i) => [X(i), Y(v)] as const);
  let line = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const cx = (x0 + x1) / 2;
    line += ` C${cx.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  const area = `${line} L${pts[n - 1][0].toFixed(1)} 220 L${pts[0][0].toFixed(1)} 220 Z`;
  const avg = values.reduce((a, b) => a + b, 0) / n;
  const peak = values.indexOf(Math.max(...values));
  return { line, area, avgY: Y(avg), peak: pts[peak], peakValue: values[peak], avg };
};

const panel = 'rounded-3xl bg-white dark:bg-[#0C1224] border border-slate-200/80 dark:border-[#1B2645] shadow-soft-card dark:shadow-none';
const card = 'rounded-[24px] bg-white dark:bg-[#0C1224] border border-[#E4E8EF] dark:border-[#1B2645] shadow-[0_1px_2px_rgba(11,18,32,.04),0_12px_32px_-20px_rgba(11,18,32,.18)] dark:shadow-none';
const badge = 'w-9 h-9 rounded-[11px] bg-[#EEF0FF] dark:bg-indigo-500/15 text-[#4F46E5] dark:text-indigo-300 inline-flex items-center justify-center shrink-0';

// ألوان الوقود في الخزان: كهرماني، والخزان الثاني يغمق نحو الأحمر عند الامتلاء، والأحمر الفاتح فوق السعة
const FUEL = {
  amber: { body: 'linear-gradient(180deg,rgb(214,150,52) 0%,rgb(184,114,30) 40%,rgb(160,96,22) 80%,rgb(222,164,40) 100%)', top: 'rgb(214,150,52)', dot: 'rgb(184,114,30)' },
  deep: { body: 'linear-gradient(180deg,rgb(170,72,40) 0%,rgb(132,40,26) 50%,rgb(98,20,16) 100%)', top: 'rgb(170,72,40)', dot: '#7F1D1D' },
  over: { body: 'linear-gradient(180deg,rgb(232,96,72),rgb(180,44,32))', top: 'rgb(232,96,72)', dot: '#DC2626' },
};
// الزجاج في رسم الخزان يبدأ من 11.28% من الأسفل ويرتفع 71.27% من الصورة
const GLASS_BOTTOM = 11.28;
const GLASS_HEIGHT = 71.27;

/** حجم رقم العربة الكبير حسب طوله حتى لا يخرج من البطاقة */
const codeSize = (code: string, wide: boolean) => (wide
  // العربات الطويلة (براد قاطرة…) تحتاج عرضًا أكبر، فيصغر الرقم بجانبها
  ? (code.length <= 3 ? 'text-[110px] sm:text-[170px]' : code.length === 4 ? 'text-[90px] sm:text-[140px]' : 'text-[76px] sm:text-[118px]')
  : (code.length <= 3 ? 'text-[150px] sm:text-[250px]' : code.length === 4 ? 'text-[120px] sm:text-[200px]' : 'text-[96px] sm:text-[160px]'));

/**
 * مختبر العربة: واجهة عرض للعربة (صورتها الكبيرة ورقمها وسجلها)، ثم سجل الآلية والاستهلاك عبر الزمن
 * والخزانات (رسم الخزان يمتلئ بالوقود حسب آخر تفويلة)، ثم محلل الصرف الحقيقي.
 */
export const VehicleLab: React.FC<{
  vehicle: string;
  allFills: DayFill[];
  refills: VehicleRefill[];
  editable: boolean;
  /** الانتقال إلى عربة أخرى من نفس الفئة */
  onSwitch?: (vehicle: string) => void;
}> = ({ vehicle, allFills, refills, editable, onSwitch }) => {
  const [profiles, setProfiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const [registry, setRegistry] = useSyncedStorage<VehicleRegistryEntry[]>(VEHICLE_REGISTRY_KEY, []);
  const profile = profiles.find(p => p.id === vehicle);
  const code = (profile?.name || vehicle).trim();
  const reg = registry.find(r => r.id === code.toUpperCase()) || registry.find(r => r.id === vehicle.toUpperCase());
  const url = labImage(code, profile?.photo);
  // نسبة عرض الصورة لارتفاعها (تُقرأ عند التحميل) لتحديد ارتفاع العربة دون أن تتجاوز عرض البطاقة
  const [aspect, setAspect] = useState(1.6);
  // العرض المتاح للعربة: عرض البطاقة ناقص الرقم الكبير، حتى تقف بجانبه ولا تغطيه
  const stageRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const stage = stageRef.current, mark = codeRef.current;
    if (!stage || !mark) return;
    const measure = () => setRoom(Math.max(0, stage.clientWidth * 0.95 - mark.offsetWidth - 56));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage); ro.observe(mark);
    return () => ro.disconnect();
  }, []);
  // صور قُصّت أسفل عجلاتها في الأصل: تُنزل خلف شريط المواصفات حتى لا يظهر القص
  const cutBottom = /\/lab\/at\.webp$/.test(url);

  const [range, setRange] = useState<Range>('month');
  const [importing, setImporting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fills = useMemo(() => allFills.filter(f => f.vehicle === vehicle).sort((a, b) => a.date.localeCompare(b.date)), [allFills, vehicle]);
  const end = useMemo(() => allFills.reduce((m, f) => (f.date > m ? f.date : m), ''), [allFills]);
  const lastDate = fills.length ? fills[fills.length - 1].date : '';
  const lastDayLines = useMemo(() => refills.filter(r => r.date === lastDate).sort((a, b) => b.qty - a.qty), [refills, lastDate]);
  const drivers = useMemo(() => [...new Set(fills.flatMap(f => f.drivers))], [fills]);
  const lastSite = fills.length ? fills[fills.length - 1].sites.join('، ') : '';

  // ── عربات نفس الفئة للتنقل بينها (مرتبة بالرقم)
  const cat = vehicleCategory(code);
  const siblings = useMemo(() => {
    const ids = [...new Set(allFills.map(f => f.vehicle))];
    const key = cat?.key;
    const same = key ? ids.filter(id => vehicleCategory((profiles.find(p => p.id === id)?.name || id).trim())?.key === key) : [vehicle];
    return same.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }, [allFills, profiles, cat?.key, vehicle]);
  const pos = siblings.indexOf(vehicle);
  const typeLabel = reg?.type || (cat ? categoryLabel(cat.key) : '') || 'عربة';

  // ── حفظ ملف العربة (السعات والمعدلات)
  const saveProfile = (patch: Partial<VehicleProfile>) => setProfiles(prev => {
    const base: VehicleProfile = prev.find(p => p.id === vehicle) || { id: vehicle, type: '', tankLiters: null, dailyLimit: null, driver: '', department: '', notes: '', photo: '', updatedAt: '', by: '' };
    return [{ ...base, ...patch, updatedAt: new Date().toISOString() }, ...prev.filter(p => p.id !== vehicle)];
  });

  // ── استيراد ملفات آليات الشركة (يمكن رفع أكثر من ملف؛ كل ملف يحدّث عرباته فقط)
  const importRegistry = async (list: FileList | null) => {
    const files = [...(list || [])];
    if (!files.length) return;
    setImporting('جارٍ القراءة…');
    try {
      const rows = (await Promise.all(files.map(readVehicleRegistry))).flat();
      setRegistry(prev => {
        const map = new Map(prev.map(r => [r.id, r]));
        rows.forEach(r => map.set(r.id, r));
        return [...map.values()];
      });
      setImporting(`تم استيراد ${rows.length.toLocaleString()} آلية`);
    } catch (e) {
      setImporting(e instanceof Error ? e.message : 'تعذّرت قراءة الملف');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      window.setTimeout(() => setImporting(null), 5000);
    }
  };

  // ── الخزانات
  const caps = [profile?.tankLiters ?? null, profile?.tank2Liters ?? null];
  // تفويلة اليوم تملأ خزان المحرك أولًا، والباقي يعبر إلى الخزان الثاني؛ ما يزيد على مجموع السعتين = فوق السعة
  const dayTotal = lastDayLines.reduce((s, r) => s + r.qty, 0);
  const capSum = (caps[0] || 0) + (caps[1] || 0);
  const fill1 = caps[0] ? Math.min(dayTotal, caps[0]) : dayTotal;
  const fill2 = caps[0] && caps[1] ? Math.min(Math.max(0, dayTotal - caps[0]), caps[1]) : 0;
  const overflow = caps[0] ? Math.max(0, dayTotal - capSum) : 0;
  const tanks = [
    { name: 'خزان المحرك', field: 'tankLiters' as const, cap: caps[0], fill: fill1, extra: caps[1] ? 0 : overflow },
    { name: 'الخزان الثاني', hint: 'وحدة التبريد في البرادات', field: 'tank2Liters' as const, cap: caps[1], fill: fill2, extra: caps[1] ? overflow : 0 },
  ];

  // ── الرسم
  const buckets = useMemo(() => (end ? buildBuckets(range, range === 'day' ? lastDate : end, fills, lastDayLines) : []), [range, end, lastDate, fills, lastDayLines]);
  const chart = buckets.length ? paths(buckets.map(b => b.value)) : null;
  const total = buckets.reduce((s, b) => s + b.value, 0);
  const firstDate = fills[0]?.date;

  // ── محلل الصرف الحقيقي: الكشوف تُبيّن التفويل فقط، فالاستهلاك يُحسب من المسافة والسرعة وتشغيل التبريد
  //    ثم يُقارن بما فُوّل فعلًا في نفس الفترة
  const [period, setPeriod] = useState<7 | 30>(7);
  const refilled = useMemo(() => (end ? fills.filter(f => f.date > addDays(end, -period)).reduce((s, f) => s + f.qty, 0) : 0), [fills, end, period]);
  const [trip, setTrip] = useState({ km: '', speed: '', hours: '', price: '' });
  const ref = profile?.refL100 ?? 0;
  const lph = profile?.reeferLph ?? 0;
  const km = num(trip.km); const speed = num(trip.speed); const hours = num(trip.hours); const price = num(trip.price);
  // الصرف يرتفع كلما ابتعدت السرعة عن 60 كم/س (تقدير: +2.5% عند 70 و+22% عند 90، بحد أقصى +60%)
  const speedFactor = speed ? Math.min(1.6, 1 + 0.00025 * (speed - 60) ** 2) : 1;
  const drive = (km * ref / 100) * speedFactor;
  const reefer = hours * lph;
  const expected = drive + reefer;
  const ready = km > 0 && ref > 0;
  const gap = ready ? refilled - expected : null;
  const gapPct = gap !== null && expected ? (gap / expected) * 100 : null;
  const over = gapPct !== null && gapPct > 10; const under = gapPct !== null && gapPct < -10;
  const ring = ready && refilled ? Math.min(1, expected / refilled) : 0;
  const ringColor = over ? '#F43F5E' : under ? '#22D3EE' : '#34D399';

  const numInput = 'w-full bg-transparent outline-none text-slate-900 dark:text-white font-mono font-semibold placeholder:text-slate-400 dark:placeholder:text-[#5B6787]';

  const tankViews = tanks.map((t, i) => {
    const pct = t.cap ? ((t.fill + t.extra) / t.cap) * 100 : null;
    const full2 = i === 1 && (pct || 0) >= 100;
    const tone = t.extra ? FUEL.over : full2 ? FUEL.deep : FUEL.amber;
    return { ...t, pct, tone, full2 };
  });
  const peakTag = chart ? {
    top: `max(0px, calc(${((chart.peak[1] / 220) * 100).toFixed(1)}% - 34px))`,
    left: `calc(${(chart.peak[0] / 10).toFixed(1)}% ${chart.peak[0] > 850 ? '- 104px' : chart.peak[0] < 150 ? '+ 8px' : '- 48px'})`,
  } : null;
  const tints = [
    ['bg-[#F5F6FF] dark:bg-indigo-500/10', 'bg-[#4F46E5]'],
    ['bg-[#F2FBF9] dark:bg-teal-500/10', 'bg-[#12A594]'],
    ['bg-[#FFF5F5] dark:bg-rose-500/10', 'bg-[#E5484D]'],
    ['bg-[#FFF8EB] dark:bg-amber-500/10', 'bg-[#F5A524]'],
  ];
  const regRows: [string, string, React.ReactNode][] = [
    ['المصنع', reg?.factory || '—', <Building2 key="f" className="w-3.5 h-3.5" />],
    ['المجموعة', reg?.group || '—', <Users key="g" className="w-3.5 h-3.5" />],
    ['السائق', drivers.join('، ') || '—', <UserRound key="d" className="w-3.5 h-3.5" />],
    ['آخر كشف', lastDate ? `${short(lastDate)}${lastSite ? ` · ${lastSite}` : ''}` : '—', <CalendarDays key="c" className="w-3.5 h-3.5" />],
  ];
  const go = (step: number) => { const next = siblings[(pos + step + siblings.length) % siblings.length]; if (next && next !== vehicle) onSwitch?.(next); };

  return (
    <div className="vehicle-page font-cairo text-[#0B1220] dark:text-[#E6EBF5] space-y-5" dir="rtl">
      {/* هوية المجموعة */}
      <div className="va-rise flex items-center gap-3.5">
        <img src="/logos/etihad-group.webp" alt="شعار مجموعة الاتحاد" className="w-[74px] h-auto drop-shadow-[0_4px_8px_rgba(11,18,32,.15)]" />
        <div>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-[26px] font-bold leading-tight text-[#16306B] dark:text-white">مجموعة الاتحاد</span>
            <span className="text-lg font-bold tracking-[.06em] text-[#B8902F]" dir="ltr">ETIHAD GROUP</span>
          </div>
          <div className="mt-0.5 text-[13px] text-[#5B6577] dark:text-[#8090B0]">نظام إدارة وتتبع الأسطول | لوحة تفاصيل العربة</div>
        </div>
      </div>

      {/* ١. واجهة العربة */}
      <section aria-label="العربة" className="va-rise relative mt-4 rounded-[28px] bg-[#E9ECF1] dark:bg-[#0F1830]" style={{ animationDelay: '.05s' }}>
        <div ref={stageRef} className="relative h-[300px] sm:h-[400px] rounded-t-[28px]">
          <div ref={codeRef} className="absolute top-8 sm:top-[46px] right-5 sm:right-10 text-right">
            <div className="text-[13px] font-bold tracking-[.04em] text-[#5B6577] dark:text-[#8090B0]">{typeLabel}</div>
            <div
              className={`lab-code font-black leading-[.86] tracking-[-.03em] ${codeSize(profile?.name || vehicle, aspect > 1.45)}`}
              style={{ fontFamily: '"Inter Variable", "Noto Kufi Arabic Variable", sans-serif' }}
              dir="ltr"
            >{profile?.name || vehicle}</div>
            {reg?.plate && (
              <div className="mt-3.5 flex items-center justify-end gap-2.5">
                <span className="font-mono text-[13px] font-semibold text-[#5B6577] dark:text-[#8090B0]" dir="ltr">{reg.plate}</span>
              </div>
            )}
          </div>
          {/* العربة بارتفاع ثابت فتخرج من حافة البطاقة العليا، وعرضها يتبع نسبة صورتها؛ تحتها ظل ناعم متلاشٍ */}
          <div
            key={url}
            className={`lab-truck absolute z-[1] left-[3%] sm:left-[4%] ${cutBottom ? '-bottom-3' : 'bottom-5'}`}
            style={{ '--ar': aspect, '--room': `${room || 700}px` } as React.CSSProperties}
          >
            {!cutBottom && <span aria-hidden className="absolute -inset-x-[6%] -bottom-4 h-12 rounded-[50%] bg-[radial-gradient(closest-side,rgba(11,18,32,.34),rgba(11,18,32,.12)_55%,rgba(11,18,32,0))] dark:bg-[radial-gradient(closest-side,rgba(0,0,0,.7),rgba(0,0,0,.25)_55%,rgba(0,0,0,0))] blur-[6px]" />}
            <img
              src={url}
              alt={`صورة العربة ${code}`}
              onLoad={e => { const im = e.currentTarget; if (im.naturalWidth && im.naturalHeight) setAspect(im.naturalWidth / im.naturalHeight); }}
              className="relative block w-auto max-w-none h-[min(250px,calc(82vw/var(--ar)))] sm:h-[min(450px,calc(var(--room)/var(--ar)))] drop-shadow-[0_18px_18px_rgba(11,18,32,.16)]"
            />
          </div>
          {siblings.length > 1 && onSwitch && (
            <div className="absolute z-[2] top-5 left-5 sm:top-auto sm:left-auto sm:bottom-[30px] sm:right-10 flex items-center gap-2.5">
              <button type="button" aria-label="العربة السابقة" onClick={() => go(-1)} className="w-11 h-11 rounded-[14px] bg-white/60 dark:bg-white/[0.06] text-[#3B4556] dark:text-[#B6C2DC] hover:bg-white hover:text-[#0B1220] dark:hover:bg-white/[0.12] dark:hover:text-white transition-colors cursor-pointer inline-flex items-center justify-center"><ChevronRight className="w-[18px] h-[18px]" /></button>
              <span className="font-mono text-xs font-semibold text-[#5B6577] dark:text-[#8090B0]"><bdi className="text-[#0B1220] dark:text-white">{pos + 1}</bdi> — {siblings.length}</span>
              <button type="button" aria-label="العربة التالية" onClick={() => go(1)} className="w-11 h-11 rounded-[14px] bg-white/60 dark:bg-white/[0.06] text-[#3B4556] dark:text-[#B6C2DC] hover:bg-white hover:text-[#0B1220] dark:hover:bg-white/[0.12] dark:hover:text-white transition-colors cursor-pointer inline-flex items-center justify-center"><ChevronLeft className="w-[18px] h-[18px]" /></button>
            </div>
          )}
        </div>
        {/* شريط المواصفات */}
        <div className="relative z-[3] grid grid-cols-1 sm:grid-cols-3 gap-[3px] rounded-b-[28px] overflow-hidden">
          <div className="bg-white dark:bg-[#0C1224] px-[22px] py-4"><div className="text-[11.5px] font-semibold text-[#5B6577] dark:text-[#8090B0]">النوع</div><div className="mt-1 text-base font-bold">{typeLabel}</div></div>
          <div className="bg-white dark:bg-[#0C1224] px-[22px] py-4"><div className="text-[11.5px] font-semibold text-[#5B6577] dark:text-[#8090B0]">رقم الآلية</div><div className="mt-1 font-mono text-base font-semibold" dir="ltr" style={{ textAlign: 'right' }}>{reg?.plate || '—'}</div></div>
          <div className="bg-[#1C2F5E] text-white px-[22px] py-4"><div className="text-[11.5px] font-semibold text-[#B6C2DC]">آخر تفويلة</div><div className="mt-1 text-base font-bold">{lastDate ? <><bdi className="font-mono">{fmt(dayTotal)}</bdi> لتر · <bdi className="font-mono">{short(lastDate)}</bdi></> : '—'}</div></div>
        </div>
      </section>

      {/* ٢. سجل الآلية · الاستهلاك · الخزانات */}
      <div className="va-rise grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(250px,.9fr)_minmax(0,1.7fr)_minmax(360px,1.4fr)] gap-4" style={{ animationDelay: '.1s' }}>
        {/* سجل الآلية */}
        <section aria-label="سجل الآلية" className={`${card} p-[18px] flex flex-col gap-3.5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5"><span className={badge}><ClipboardList className="w-[18px] h-[18px]" /></span><h3 className="text-[14.5px] font-bold">سجل الآلية</h3></div>
            {editable && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple hidden onChange={e => void importRegistry(e.target.files)} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={!!importing && importing.startsWith('جارٍ')} aria-label={reg ? 'تحديث من Excel' : 'استيراد ملف الآليات'} className="h-8 px-2.5 rounded-[10px] border border-[#DDE1F8] dark:border-[#23304F] bg-white dark:bg-transparent text-[#4338CA] dark:text-indigo-200 text-[11.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-indigo-50 dark:hover:bg-white/[0.05] disabled:opacity-60">
                  {importing?.startsWith('جارٍ') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Excel
                </button>
              </>
            )}
          </div>
          {importing && <div className="text-[11.5px] font-semibold text-indigo-700 dark:text-indigo-200">{importing}</div>}
          {reg ? (
            <>
              {/* لوحة الأرقام */}
              <div className="flex items-stretch h-[52px] rounded-xl border-2 border-[#0B1220] dark:border-[#B6C2DC] overflow-hidden bg-white">
                <div className="w-[46px] bg-[#0B1220] text-white flex flex-col items-center justify-center text-[10px] font-bold leading-tight"><span>العراق</span><span className="font-mono text-[9px] opacity-70">IRQ</span></div>
                <div className="flex-1 flex items-center justify-center min-w-0"><span className="font-mono text-[22px] font-semibold tracking-[.08em] text-[#0B1220] truncate" dir="ltr">{reg.plate || '—'}</span></div>
                <div className="w-[52px] border-s-[1.5px] border-[#E4E8EF] flex items-center justify-center text-[11.5px] font-bold text-[#3B4556] text-center leading-tight">{reg.governorate || '—'}</div>
              </div>
              <dl className="flex flex-col">
                {regRows.map(([l, v, icon]) => (
                  <div key={l} className="flex items-center gap-2.5 py-[9px] border-b border-dashed border-[#EEF1F5] dark:border-[#1B2645]">
                    <span className="w-7 h-7 rounded-lg bg-[#F4F6FA] dark:bg-white/[0.05] text-[#5B6577] dark:text-[#8090B0] inline-flex items-center justify-center shrink-0">{icon}</span>
                    <dt className="text-xs text-[#5B6577] dark:text-[#8090B0] w-[62px] shrink-0">{l}</dt>
                    <dd className="text-[13px] font-semibold min-w-0 truncate" title={v}>{v}</dd>
                  </div>
                ))}
              </dl>
              {reg.supervisor && (
                <div className="mt-auto flex items-center gap-2.5 px-3 py-2.5 rounded-[14px] bg-[#F7F8FC] dark:bg-white/[0.04]">
                  <span className="w-[34px] h-[34px] rounded-full bg-[#CCFBF1] dark:bg-teal-500/20 text-[#115E59] dark:text-teal-200 inline-flex items-center justify-center text-[13px] font-bold shrink-0">{reg.supervisor.trim().charAt(0)}</span>
                  <div className="min-w-0"><div className="text-[11px] text-[#5B6577] dark:text-[#8090B0]">المسؤول</div><div className="text-[13px] font-bold truncate">{reg.supervisor}</div></div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] leading-7 text-[#5B6577] dark:text-[#8090B0]">لا يوجد سطر لهذه العربة في ملف آليات الشركة. {editable ? 'استورد ملف «جميع آليات الشركة» (ويمكن رفع أكثر من ملف) لتظهر هنا لوحة الأرقام والنوع والمصنع والمجموعة.' : ''}</p>
          )}
        </section>

        {/* الاستهلاك عبر الزمن */}
        <section aria-label="الاستهلاك عبر الزمن" className={`${card} px-5 pt-[18px] pb-3.5 min-w-0 flex flex-col lg:col-span-2 lg:order-last xl:order-none xl:col-span-1`}>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className={badge}><LineChart className="w-[18px] h-[18px]" /></span>
              <h3 className="text-[14.5px] font-bold">الاستهلاك عبر الزمن</h3>
              {firstDate && <span className="hidden sm:inline text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F1F3F7] dark:bg-[#1B2645] text-[#5B6577] dark:text-[#8090B0]">من <bdi className="font-mono">{short(firstDate)}</bdi></span>}
            </div>
            <div role="group" aria-label="المدى" className="flex gap-0.5 p-[3px] rounded-xl bg-[#F1F3F7] dark:bg-[#0A1020]">
              {([['day', 'يوم'], ['week', 'أسبوع'], ['month', 'شهر'], ['q', '3 أشهر'], ['year', 'سنة']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)} className={`h-7 px-[11px] rounded-[9px] text-xs font-semibold cursor-pointer transition-colors ${range === k ? 'bg-[#4F46E5] text-white' : 'text-[#5B6577] hover:text-[#0B1220] dark:text-[#8090B0] dark:hover:text-white'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5">
            {[
              ['الإجمالي', fmt(total), 'لتر'],
              [range === 'day' ? 'متوسط التفويلة' : 'المتوسط', chart ? fmt(chart.avg, chart.avg < 10 ? 1 : 0) : '—', 'لتر'],
              ['الذروة', chart ? fmt(chart.peakValue) : '—', 'لتر'],
              ['التفويلات', String(range === 'day' ? lastDayLines.length : buckets.filter(b => b.value > 0).length), ''],
            ].map(([l, v, u], i) => (
              <div key={l} className={`px-3 py-2.5 rounded-[14px] ${tints[i][0]}`}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6577] dark:text-[#8090B0]"><span className={`w-1.5 h-1.5 rounded-full ${tints[i][1]}`} />{l}</div>
                <div className="mt-1 font-mono text-[22px] font-semibold leading-tight">{v} <span className="font-cairo text-[11px] text-[#8A94A6]">{u}</span></div>
              </div>
            ))}
          </div>
          {chart && total > 0 ? (
            <>
              <div key={range} className="relative flex-1 min-h-[170px] mt-2.5">
                <svg viewBox="0 0 1000 220" preserveAspectRatio="none" className="absolute inset-0 block w-full h-full" role="img" aria-label="رسم الاستهلاك">
                  <defs><linearGradient id="lab-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4F46E5" stopOpacity=".30" /><stop offset="1" stopColor="#4F46E5" stopOpacity="0" /></linearGradient></defs>
                  {[55, 110, 165].map(y => <line key={y} x1="0" y1={y} x2="1000" y2={y} className="stroke-[#F1F3F7] dark:stroke-[#141D36]" />)}
                  <path d={chart.area} fill="url(#lab-area)" />
                  <path d={`M0 ${chart.avgY.toFixed(1)} L1000 ${chart.avgY.toFixed(1)}`} fill="none" strokeWidth="1.5" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" className="stroke-[#C7CDD8] dark:stroke-[#475577]" />
                  <path d={chart.line} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="va-draw stroke-[#4F46E5] dark:stroke-[#818CF8]" />
                </svg>
                {/* نقطة الذروة خارج الـ SVG حتى تبقى دائرية */}
                <span aria-hidden className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-[#E5484D] ring-[2.5px] ring-white dark:ring-[#0C1224]" style={{ left: `${chart.peak[0] / 10}%`, top: `${(chart.peak[1] / 220) * 100}%` }} />
                {peakTag && <div className="absolute px-[9px] py-1 rounded-lg bg-[#0B1220] dark:bg-white text-white dark:text-[#0B1220] text-[11px] font-semibold whitespace-nowrap shadow-[0_6px_16px_-6px_rgba(11,18,32,.5)]" style={peakTag}>الذروة <bdi className="font-mono">{fmt(chart.peakValue)}</bdi> لتر</div>}
              </div>
              <div className="flex justify-between mt-1.5 pt-2 border-t border-[#F1F3F7] dark:border-[#141D36] font-mono text-[10.5px] text-[#A3ACBA] dark:text-[#5B6787]">
                {buckets.filter((_, i) => i % Math.max(1, Math.round(buckets.length / 8)) === 0).map((b, i) => <span key={i}>{b.label}</span>)}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-[170px] flex items-center justify-center text-sm text-[#8A94A6] dark:text-[#5B6787]">لا تفويلات في هذا المدى</div>
          )}
        </section>

        {/* الخزانات */}
        <section aria-label="الخزانات" className={`${card} p-[18px] flex flex-col gap-3.5`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5"><span className={badge}><Fuel className="w-[18px] h-[18px]" /></span><h3 className="text-[14.5px] font-bold">الخزانات</h3></div>
            <span className="text-[11.5px] text-[#5B6577] dark:text-[#8090B0]">السعة الكلية <bdi className="font-mono font-semibold text-[#0B1220] dark:text-white">{capSum ? fmt(capSum) : '—'}</bdi> لتر</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tankViews.map(t => (
              <div key={t.field} className="p-2.5 rounded-[14px] bg-[#F7F8FC] dark:bg-white/[0.04] min-w-0">
                <div className="text-xs font-bold">{t.name}</div>
                <div className={`mt-0.5 text-[10.5px] font-semibold truncate ${t.extra ? 'text-[#C0362F] dark:text-rose-400' : t.cap ? 'text-[#0E7F72] dark:text-teal-300' : 'text-[#8A94A6]'}`}>
                  {!t.cap ? (t.hint || 'أدخل السعة') : t.extra ? `أكبر من السعة بـ ${fmt(t.extra)} لتر` : t.fill ? `دخله ${fmt(t.fill)} لتر` : 'لم يصله شيء'}
                </div>
                {/* رسم الخزان فارغًا، والوقود يُصب داخل الزجاج فقط */}
                <div className="relative w-full aspect-[920/470] mt-1.5 rounded-lg overflow-hidden bg-white">
                  <img src="/trucks/tank/empty.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full" />
                  <div className="lab-glass absolute inset-0">
                    <div className="absolute inset-x-0 transition-[height,background] duration-700" style={{ bottom: `${GLASS_BOTTOM}%`, height: `${(Math.min(100, t.pct || 0) * GLASS_HEIGHT / 100).toFixed(2)}%`, background: t.tone.body }}>
                      {t.pct ? (
                        <svg viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden className="lab-slosh absolute left-0 -top-1.5 w-[200%] h-3" style={{ color: t.tone.top }}>
                          <path d="M0 6 Q25 0 50 6 T100 6 T150 6 T200 6 T250 6 T300 6 T350 6 T400 6 V12 H0 Z" fill="currentColor" />
                        </svg>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className={`flex items-center justify-between gap-2 mt-2 px-2.5 py-2 rounded-[10px] bg-white dark:bg-[#0A1020] border ${t.extra ? 'border-[#F8C9C3] dark:border-rose-500/40' : t.full2 ? 'border-[#E8C2B5] dark:border-red-900' : 'border-[#E4E8EF] dark:border-[#1B2645]'}`}>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6577] dark:text-[#8090B0]"><span className="w-[7px] h-[7px] rounded-full" style={{ background: t.tone.dot }} />الامتلاء</span>
                  <span className="flex items-baseline gap-1.5 min-w-0">
                    <span className="font-mono text-lg font-semibold">{t.pct === null ? '؟' : `${Math.round(t.pct)}%`}</span>
                    <span className="text-[10.5px] text-[#8A94A6] truncate">{fmt(t.fill + t.extra)} / {t.cap ? fmt(t.cap) : '—'}</span>
                  </span>
                </div>
                <label className="flex items-center gap-1 h-8 mt-2 px-2 rounded-[9px] border border-[#CBD2DC] dark:border-[#23304F] bg-white dark:bg-[#0A1020] focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                  <span className="text-[10.5px] text-[#5B6577] dark:text-[#8090B0]">السعة</span>
                  <input
                    key={`${vehicle}-${t.field}-${t.cap ?? ''}`}
                    type="number" inputMode="numeric" min={0} defaultValue={t.cap ?? ''} disabled={!editable} placeholder="—" aria-label={`سعة ${t.name} باللتر`}
                    onBlur={e => { const v = num(e.target.value); if ((v || null) !== t.cap) saveProfile({ [t.field]: v || null }); }}
                    className={`${numInput} text-[13px]`}
                  />
                  <span className="text-[10.5px] text-[#8A94A6]">لتر</span>
                </label>
              </div>
            ))}
          </div>
          {/* كيف توزعت آخر تفويلة */}
          <div className="p-3 rounded-[14px] border border-[#EEF1F5] dark:border-[#1B2645]">
            <div className="flex justify-between text-[11.5px] text-[#5B6577] dark:text-[#8090B0]">
              <span>توزيع آخر تفويلة</span>
              <span><bdi className="font-mono font-semibold text-[#0B1220] dark:text-white">{fmt(dayTotal)}</bdi> لتر</span>
            </div>
            <div className="flex h-2.5 mt-2 rounded-full overflow-hidden gap-0.5 bg-[#F1F3F7] dark:bg-[#0A1020]">
              {([[fill1, '#4F46E5'], [fill2, '#0EA5E9'], [overflow, '#E5484D']] as const).map(([x, c], i) => x > 0 && <span key={i} className="block h-full transition-[flex] duration-500" style={{ flex: `${x} 1 0`, background: c }} />)}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-[#5B6577] dark:text-[#8090B0]">
              <span><span className="inline-block w-2 h-2 rounded-sm bg-[#4F46E5] ml-1.5" />المحرك <bdi className="font-mono">{fmt(fill1)}</bdi></span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-[#0EA5E9] ml-1.5" />الثاني <bdi className="font-mono">{fmt(fill2)}</bdi></span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-[#E5484D] ml-1.5" />فوق السعة <bdi className="font-mono">{fmt(overflow)}</bdi></span>
            </div>
          </div>
        </section>
      </div>

      {/* محلل الصرف الحقيقي */}
      <div className="va-rise grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ animationDelay: '.15s' }}>
        <section aria-label="مدخلات المحلل" className={`${panel} p-5 flex flex-col gap-3.5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">محلل الصرف الحقيقي</h3>
              <p className="mt-1 text-[12.5px] text-slate-600 dark:text-[#8090B0]">الاستهلاك يُحسب من المسافة والسرعة والتبريد، ويُقارن بالتفويل في الكشوف</p>
            </div>
            <div role="group" aria-label="الفترة" className="flex gap-0.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0A1020] border border-slate-200/80 dark:border-[#1B2645]">
              {([7, 30] as const).map(d => (
                <button key={d} type="button" aria-pressed={period === d} onClick={() => setPeriod(d)} className={`h-7 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${period === d ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-[#8090B0] dark:hover:text-white'}`}>آخر {d} يومًا</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ['المسافة المقطوعة', 'km', 'كم', '0'],
              ['متوسط السرعة', 'speed', 'كم/س', '0'],
              ['ساعات تشغيل التبريد', 'hours', 'ساعة', '0'],
              ['سعر اللتر · اختياري', 'price', 'دينار', '0'],
            ] as const).map(([l, k, u, ph]) => (
              <label key={k} className="flex flex-col gap-1 p-2.5 px-3 rounded-2xl border border-slate-300 dark:border-[#23304F] bg-white dark:bg-[#0A1020] shadow-sm dark:shadow-none focus-within:border-indigo-500">
                <span className="text-[11.5px] font-semibold text-slate-600 dark:text-[#8090B0]">{l}</span>
                <span className="flex items-baseline gap-1.5">
                  <input type="number" inputMode="decimal" min={0} value={trip[k]} onChange={e => setTrip(s => ({ ...s, [k]: e.target.value }))} placeholder={ph} className={`${numInput} text-lg`} />
                  <span className="text-[11.5px] text-slate-400 dark:text-[#5B6787] whitespace-nowrap">{u}</span>
                </span>
              </label>
            ))}
            {([
              ['صرف القيادة عند 60 كم/س', 'refL100', 'لتر/100كم', ref],
              ['صرف التبريد للساعة', 'reeferLph', 'لتر/س', lph],
            ] as const).map(([l, k, u, v]) => (
              <label key={k} className="flex flex-col gap-1 p-2.5 px-3 rounded-2xl border border-slate-300 dark:border-[#23304F] bg-white dark:bg-[#0A1020] shadow-sm dark:shadow-none focus-within:border-indigo-500">
                <span className="text-[11.5px] font-semibold text-slate-600 dark:text-[#8090B0]">{l} <span className="text-[10px] text-slate-400 dark:text-[#5B6787]">· يُحفظ</span></span>
                <span className="flex items-baseline gap-1.5">
                  <input key={`${vehicle}-${k}-${v}`} type="number" inputMode="decimal" min={0} step="0.1" defaultValue={v || ''} disabled={!editable} placeholder="0" onBlur={e => { const x = num(e.target.value); if (x !== v) saveProfile({ [k]: x || null }); }} className={`${numInput} text-lg`} />
                  <span className="text-[11.5px] text-slate-400 dark:text-[#5B6787] whitespace-nowrap">{u}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-[11.5px] leading-6 text-slate-400 dark:text-[#5B6787]">السرعة ترفع الصرف كلما ابتعدت عن 60 كم/س (عند 90 كم/س حوالي +22%). صرف التبريد يُضاف للبرادات فقط.</p>
        </section>

        <section aria-label="نتيجة المحلل" className={`${panel} p-5 flex flex-col gap-4`}>
          <div className="flex items-center gap-5">
            <div className="relative w-[132px] h-[132px] shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden>
                <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10" className="stroke-slate-100 dark:stroke-[#141D36]" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round" strokeDasharray="314" strokeDashoffset={314 * (1 - ring)} className="transition-[stroke-dashoffset,stroke] duration-500" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-[26px] font-semibold text-slate-900 dark:text-white">{ready ? fmt(expected) : '—'}</span>
                <span className="text-[10.5px] text-slate-600 dark:text-[#8090B0]">لتر استهلاك</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className={`text-lg font-bold ${over ? 'text-rose-600 dark:text-rose-400' : under ? 'text-cyan-600 dark:text-cyan-300' : !ready ? 'text-slate-600 dark:text-[#B6C2DC]' : 'text-emerald-600 dark:text-emerald-300'}`}>
                {!km ? 'أدخل المسافة' : !ref ? 'أدخل صرف القيادة للعربة' : over ? 'التفويل أكثر من الاستهلاك' : under ? 'التفويل أقل من الاستهلاك' : 'التفويل يطابق الاستهلاك'}
              </div>
              {gap !== null && (
                <div className="mt-1.5 text-[13px] leading-6 text-slate-600 dark:text-[#B6C2DC]">
                  {over ? <><bdi className="font-mono">{fmt(gap)}</bdi> لتر فُوّلت ولا تفسرها المسافة</>
                    : under ? <>ينقص <bdi className="font-mono">{fmt(-gap)}</bdi> لتر — ربما فُوّلت خارج الكشوف</>
                    : <>الفرق <bdi className="font-mono">{fmt(Math.abs(gap))}</bdi> لتر ضمن 10%</>}
                  {price > 0 && (over || under) && <> · <bdi className="font-mono">{fmt(Math.abs(gap) * price)}</bdi> دينار</>}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ['المفوّل في الكشوف', fmt(refilled), 'لتر'],
              ['الاستهلاك المحسوب', ready ? fmt(expected) : '—', 'لتر'],
              ['الفرق', gap === null ? '—' : `${gap > 0 ? '+' : ''}${fmt(gap)}`, gapPct === null ? 'لتر' : `لتر · ${gapPct > 0 ? '+' : ''}${fmt(gapPct)}%`],
              ['زمن القيادة', speed && km ? fmt(km / speed, 1) : '—', 'ساعة'],
            ].map(([l, v, u]) => (
              <div key={l} className="p-3 px-3.5 rounded-2xl bg-indigo-50/60 dark:bg-[#0A1020] border border-indigo-100 dark:border-[#141D36]">
                <div className="text-[11.5px] font-semibold text-slate-600 dark:text-[#8090B0]">{l}</div>
                <div className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white">{v} <span className="font-cairo text-[11.5px] text-slate-400 dark:text-[#5B6787]">{u}</span></div>
              </div>
            ))}
          </div>
          {/* المفوّل مقابل الاستهلاك (القيادة + التبريد) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="w-16 text-[11.5px] font-semibold text-slate-600 dark:text-[#8090B0]">المفوّل</span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-[#0A1020] overflow-hidden"><div className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-[width] duration-500" style={{ width: `${(refilled / Math.max(refilled, expected, 1)) * 100}%` }} /></div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-16 text-[11.5px] font-semibold text-slate-600 dark:text-[#8090B0]">الاستهلاك</span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-[#0A1020] overflow-hidden flex">
                <span className="h-full bg-indigo-400 transition-[width] duration-500" style={{ width: `${(drive / Math.max(refilled, expected, 1)) * 100}%` }} />
                <span className="h-full bg-cyan-400 transition-[width] duration-500" style={{ width: `${(reefer / Math.max(refilled, expected, 1)) * 100}%` }} />
              </div>
            </div>
            <div className="flex justify-end gap-4 text-[11.5px] text-slate-600 dark:text-[#8090B0]">
              <span><span className="inline-block w-2 h-2 rounded-sm bg-indigo-400 ml-1.5" />القيادة <bdi className="font-mono">{fmt(drive)}</bdi></span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-cyan-400 ml-1.5" />التبريد <bdi className="font-mono">{fmt(reefer)}</bdi></span>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
};
