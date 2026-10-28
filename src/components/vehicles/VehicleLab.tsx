/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useRef, useState } from 'react';
import { FlaskConical, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import {
  VEHICLE_PROFILES_KEY, imageGround, vehicleImage,
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

/**
 * مختبر العربة: صفحة تحليل متقدم بطابع داكن — سجل الآلية من ملف آليات الشركة، الخزانات وسعتها،
 * الاستهلاك من اليوم إلى سنة، محلل الصرف الحقيقي (المسافة والسرعة وتشغيل التبريد)، ومؤشرات إضافية.
 */
export const VehicleLab: React.FC<{
  vehicle: string;
  allFills: DayFill[];
  refills: VehicleRefill[];
  editable: boolean;
}> = ({ vehicle, allFills, refills, editable }) => {
  const [profiles, setProfiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const [registry, setRegistry] = useSyncedStorage<VehicleRegistryEntry[]>(VEHICLE_REGISTRY_KEY, []);
  const profile = profiles.find(p => p.id === vehicle);
  const code = (profile?.name || vehicle).trim();
  const reg = registry.find(r => r.id === code.toUpperCase()) || registry.find(r => r.id === vehicle.toUpperCase());
  const url = vehicleImage(code, profile?.photo);

  const [range, setRange] = useState<Range>('month');
  const [importing, setImporting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fills = useMemo(() => allFills.filter(f => f.vehicle === vehicle).sort((a, b) => a.date.localeCompare(b.date)), [allFills, vehicle]);
  const end = useMemo(() => allFills.reduce((m, f) => (f.date > m ? f.date : m), ''), [allFills]);
  const lastDate = fills.length ? fills[fills.length - 1].date : '';
  const lastDayLines = useMemo(() => refills.filter(r => r.date === lastDate).sort((a, b) => b.qty - a.qty), [refills, lastDate]);
  const drivers = useMemo(() => [...new Set(fills.flatMap(f => f.drivers))], [fills]);

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

  const field = 'flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-300 dark:border-[#23304F] bg-white dark:bg-[#0A1020] shadow-sm dark:shadow-none focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20';
  const numInput = 'w-full bg-transparent outline-none text-slate-900 dark:text-white font-mono font-semibold placeholder:text-slate-400 dark:placeholder:text-[#5B6787]';

  return (
    <div className="vehicle-page font-cairo dark:rounded-[28px] bg-transparent dark:bg-[#070B16] text-slate-900 dark:text-[#E6EBF5] dark:p-4 dark:sm:p-6 space-y-5" dir="rtl">
      {/* العنوان */}
      <div className="va-rise flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-3 text-[28px] font-bold tracking-tight"><span className="w-11 h-11 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 inline-flex items-center justify-center"><FlaskConical className="w-5 h-5" /></span>مختبر العربة<span className="font-mono text-[22px] font-semibold text-indigo-600 dark:text-indigo-300" dir="ltr">{profile?.name || vehicle}</span></h2>
        {lastDate && (
          <span className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-slate-200/80 dark:border-[#1B2645] bg-white dark:bg-[#0C1224] text-xs font-semibold text-slate-600 dark:text-[#B6C2DC]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />آخر تفويلة <bdi className="font-mono">{short(lastDate)}</bdi>
          </span>
        )}
      </div>

      {/* الهوية · العربة · الخزانات */}
      <div className="va-rise grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ animationDelay: '.05s' }}>
        <section aria-label="سجل الآلية" className={`${panel} p-5`}>
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-xs font-bold text-slate-600 dark:text-[#8090B0]">سجل الآلية</span>
            {editable && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple hidden onChange={e => void importRegistry(e.target.files)} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={!!importing && importing.startsWith('جارٍ')} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-indigo-50 dark:bg-[#14203A] text-[11.5px] font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-[#1B2A4D] cursor-pointer disabled:opacity-60">
                  {importing?.startsWith('جارٍ') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  {reg ? 'تحديث من Excel' : 'استيراد ملف الآليات'}
                </button>
              </>
            )}
          </div>
          {importing && <div className="mb-3 text-[11.5px] font-semibold text-indigo-700 dark:text-indigo-200">{importing}</div>}
          {reg ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[13px]">
              <dt className="text-slate-600 dark:text-[#8090B0]">رقم الآلية</dt><dd className="font-mono font-semibold text-slate-900 dark:text-white" dir="ltr" style={{ textAlign: 'right' }}>{reg.plate || '—'}</dd>
              <dt className="text-slate-600 dark:text-[#8090B0]">النوع</dt><dd className="font-semibold">{reg.type || '—'}</dd>
              <dt className="text-slate-600 dark:text-[#8090B0]">المحافظة</dt><dd>{reg.governorate || '—'}</dd>
              <dt className="text-slate-600 dark:text-[#8090B0]">المصنع</dt><dd>{reg.factory || '—'}</dd>
              <dt className="text-slate-600 dark:text-[#8090B0]">المجموعة</dt><dd>{reg.group || '—'}</dd>
              <dt className="text-slate-600 dark:text-[#8090B0]">المسؤول</dt><dd>{reg.supervisor || '—'}</dd>
              <dt className="text-slate-600 dark:text-[#8090B0]">السائق</dt><dd className="truncate">{drivers.join('، ') || '—'}</dd>
            </dl>
          ) : (
            <p className="text-[13px] leading-7 text-slate-600 dark:text-[#8090B0]">لا يوجد سطر لهذه العربة في ملف آليات الشركة. {editable ? 'استورد ملف «جميع آليات الشركة» (ويمكن رفع أكثر من ملف) لتظهر هنا رقم الآلية والنوع والمصنع والمجموعة.' : ''}</p>
          )}
        </section>

        <section aria-label="العربة" className={`${panel} relative min-h-[300px] overflow-hidden flex items-end justify-center !bg-gradient-to-b from-white to-indigo-50/80 dark:!bg-none`}>
          <span className="absolute left-1/2 bottom-6 -translate-x-1/2 w-[380px] max-w-[90%] h-28 rounded-[50%] bg-[radial-gradient(closest-side,rgb(99_102_241/0.28),transparent)] dark:bg-[radial-gradient(closest-side,rgb(99_102_241/0.35),transparent)]" />
          <span className="absolute inset-x-6 bottom-10 h-px bg-slate-100 dark:bg-[#1B2645]" />
          <img src={url} alt={`صورة العربة ${code}`} className="relative w-[86%] max-w-[400px] h-auto mb-10" style={{ transform: `translateY(${imageGround(url) * 100}%)` }} />
          <div className="absolute top-4 right-4 flex gap-2">
            {reg && <span className="inline-flex items-center h-7 px-3 rounded-full bg-slate-100 dark:bg-white/[0.06] text-xs font-semibold text-slate-700 dark:text-indigo-100">{reg.type}</span>}
            {caps[1] ? <span className="inline-flex items-center h-7 px-3 rounded-full bg-slate-100 dark:bg-white/[0.06] text-xs font-semibold text-slate-700 dark:text-indigo-100">خزانان</span> : null}
          </div>
        </section>

        <section aria-label="الخزانات" className={`${panel} p-5 flex flex-col gap-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-[#8090B0]">الخزانات</span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-[#5B6787]">آخر تفويلة مقابل السعة</span>
          </div>
          {tanks.map(t => {
            const pct = t.cap ? ((t.fill + t.extra) / t.cap) * 100 : null;
            const overT = t.extra > 0;
            return (
              <div key={t.field} className="grid grid-cols-[54px_1fr] gap-3.5 items-center">
                <div className="relative w-[54px] h-[84px] rounded-xl border-[1.5px] border-slate-300 dark:border-[#2A3658] bg-slate-50 dark:bg-[#0A1020] overflow-hidden">
                  <span className={`va-grow absolute inset-x-0 bottom-0 ${overT ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ height: `${Math.min(100, pct || 0)}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold text-slate-900 dark:text-white">{pct === null ? '؟' : `${Math.round(pct)}%`}</span>
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="text-[13.5px] font-bold">{t.name}{t.hint && <span className="mr-1.5 text-[11px] font-medium text-slate-400 dark:text-[#5B6787]">{t.hint}</span>}</div>
                  <label className={field}>
                    <span className="text-[11.5px] text-slate-600 dark:text-[#8090B0] whitespace-nowrap">السعة</span>
                    <input
                      key={`${vehicle}-${t.field}-${t.cap ?? ''}`}
                      type="number" inputMode="numeric" min={0} defaultValue={t.cap ?? ''} disabled={!editable} placeholder="باللتر" aria-label={`سعة ${t.name} باللتر`}
                      onBlur={e => { const v = num(e.target.value); if ((v || null) !== t.cap) saveProfile({ [t.field]: v || null }); }}
                      className={`${numInput} text-sm`}
                    />
                    <span className="text-[11.5px] text-slate-400 dark:text-[#5B6787]">لتر</span>
                  </label>
                  <div className={`text-[11.5px] font-semibold ${overT ? 'text-rose-600 dark:text-rose-400' : t.cap ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400 dark:text-[#5B6787]'}`}>
                    {!t.cap ? 'أدخل السعة لكشف التفويل فوق السعة' : overT ? `تفويلة ${fmt(dayTotal)} لتر أكبر من السعة بـ ${fmt(t.extra)} لتر` : t.fill ? `دخله ${fmt(t.fill)} لتر من تفويلة ${fmt(dayTotal)} لتر` : 'لم يصله شيء من آخر تفويلة'}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* الاستهلاك عبر الزمن */}
      <section aria-label="الاستهلاك عبر الزمن" className={`va-rise ${panel} p-5`} style={{ animationDelay: '.1s' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold">الاستهلاك عبر الزمن</h3>
            {firstDate && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1B2645] text-slate-600 dark:text-[#8090B0]">البيانات من <bdi className="font-mono">{short(firstDate)}</bdi></span>}
          </div>
          <div role="group" aria-label="المدى" className="flex gap-0.5 p-1 rounded-2xl bg-slate-50 dark:bg-[#0A1020] border border-slate-200/80 dark:border-[#1B2645]">
            {([['day', 'يوم'], ['week', 'أسبوع'], ['month', 'شهر'], ['q', '3 أشهر'], ['year', 'سنة']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)} className={`h-8 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${range === k ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-[#8090B0] dark:hover:text-white'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            ['الإجمالي', fmt(total), 'لتر'],
            [range === 'day' ? 'متوسط التفويلة' : 'المتوسط', chart ? fmt(chart.avg, chart.avg < 10 ? 1 : 0) : '—', 'لتر'],
            ['الذروة', chart ? fmt(chart.peakValue) : '—', 'لتر'],
            ['التفويلات', String(range === 'day' ? lastDayLines.length : buckets.filter(b => b.value > 0).length), ''],
          ].map(([l, v, u]) => (
            <div key={l}>
              <div className="text-[11.5px] font-semibold text-slate-600 dark:text-[#8090B0]">{l}</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{v} <span className="font-cairo text-xs text-slate-400 dark:text-[#5B6787]">{u}</span></div>
            </div>
          ))}
        </div>
        {chart && total > 0 ? (
          <div key={range} className="mt-3">
            <svg viewBox="0 0 1000 220" preserveAspectRatio="none" className="block w-full h-[220px]" role="img" aria-label="رسم الاستهلاك">
              <defs><linearGradient id="lab-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6366F1" stopOpacity=".38" /><stop offset="1" stopColor="#6366F1" stopOpacity="0" /></linearGradient></defs>
              {[55, 110, 165].map(y => <line key={y} x1="0" y1={y} x2="1000" y2={y} className="stroke-slate-100 dark:stroke-[#141D36]" />)}
              <path d={chart.area} fill="url(#lab-area)" />
              <path d={`M0 ${chart.avgY.toFixed(1)} L1000 ${chart.avgY.toFixed(1)}`} fill="none" strokeWidth="1.5" strokeDasharray="6 6" className="stroke-slate-300 dark:stroke-[#475577]" />
              <path d={chart.line} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="va-draw stroke-indigo-600 dark:stroke-[#818CF8]" />
              <circle cx={chart.peak[0]} cy={chart.peak[1]} r="5" fill="#F43F5E" strokeWidth="2" className="stroke-white dark:stroke-[#0C1224]" />
            </svg>
            <div className="flex justify-between mt-2 font-mono text-[11px] text-slate-400 dark:text-[#5B6787]">
              {buckets.filter((_, i) => i % Math.max(1, Math.round(buckets.length / 8)) === 0).map((b, i) => <span key={i}>{b.label}</span>)}
            </div>
          </div>
        ) : (
          <div className="mt-6 py-12 text-center text-sm text-slate-400 dark:text-[#5B6787]">لا تفويلات في هذا المدى</div>
        )}
      </section>

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
