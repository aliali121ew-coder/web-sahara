/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ChevronRight, ChevronLeft, Fuel, Gauge, Trophy, Repeat2, Timer, Percent, Hash,
  User, CheckCircle2, Route as RouteIcon, Layers, IdCard, ShieldCheck, Building2, Container,
} from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import {
  FREQUENT_DAYS, VEHICLE_PROFILES_KEY, VEHICLE_ROUTES_KEY, checkFills, disciplineScore, formatDay, vehicleCategory,
  type CheckKind, type DayFill, type VehicleProfile, type VehicleRoute, type VehicleStat,
} from '../../lib/vehicleFuel';
import { VehicleProfileEditor } from './VehicleProfileEditor';
import { ScoreGauge } from './ScoreGauge';
import { VehicleArt } from './VehicleArt';
import { VehicleMap } from './VehicleMap';

interface Props {
  stat: VehicleStat;
  /** ترتيب العربات (الأعلى استهلاكًا أولًا) للتنقل بين العربات */
  ranking: string[];
  /** متوسط التفويلة في كل الأسطول */
  fleetAvg: number;
  fleetTotal: number;
  vehicles: string[];
  editable: boolean;
  onBack: () => void;
  onOpen: (v: string) => void;
}

const card = 'rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';
const isFreq = (f: DayFill) => f.days !== null && f.days <= FREQUENT_DAYS;

const Spec: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone: string }> = ({ icon, label, value, tone }) => (
  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 p-3">
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${tone}`}>{icon}</div>
    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{label}</div>
    <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5 truncate">{value}</div>
  </div>
);

/** صفحة كاملة لتفاصيل عربة: المواصفات، آخر رحلة تفويل، السائقون، الخريطة، الرسم، والسجل */
export const VehicleDetailPage: React.FC<Props> = ({ stat, ranking, fleetAvg, fleetTotal, vehicles, editable, onBack, onOpen }) => {
  const [routes] = useSyncedStorage<VehicleRoute[]>(VEHICLE_ROUTES_KEY, []);
  const [tab, setTab] = useState<'all' | 'frequent' | 'multi' | 'violations'>('all');
  const [profiles, setProfiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const [editing, setEditing] = useState(false);
  const category = vehicleCategory(stat.vehicle);
  const [dailyPage, setDailyPage] = useState(0);
  useEffect(() => setDailyPage(0), [stat.vehicle]);
  const profile = profiles.find(p => p.id === stat.vehicle);
  const checks = useMemo(() => checkFills(stat.fills, profile), [stat, profile]);
  const saveProfile = (p: VehicleProfile) => { setProfiles(prev => [p, ...prev.filter(x => x.id !== p.id)]); setEditing(false); };

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [stat.vehicle]);

  const rank = ranking.indexOf(stat.vehicle);
  const prevV = rank > 0 ? ranking[rank - 1] : null;
  const nextV = rank >= 0 && rank < ranking.length - 1 ? ranking[rank + 1] : null;
  const share = fleetTotal ? Math.round((stat.total / fleetTotal) * 1000) / 10 : 0;
  const vsFleet = fleetAvg ? Math.round(((stat.avg - fleetAvg) / fleetAvg) * 100) : 0;

  const myRoutes = useMemo(() => routes.filter(r => r.vehicle === stat.vehicle), [routes, stat.vehicle]);
  const km = myRoutes.reduce((s, r) => s + r.km, 0);

  const chart = useMemo(() => [...stat.fills].reverse().map(f => ({ name: formatDay(f.date), qty: f.qty, prev: f.prevQty ?? null, days: f.days })), [stat]);

  // مخالفات ملف العربة (السعة، الحصة، السائق) — التكرار له تبويبه
  const SERIOUS: CheckKind[] = ['capacity', 'limit', 'driver'];
  const violationDates = new Set(checks.filter(c => SERIOUS.includes(c.kind)).map(c => c.date));
  const overCap = new Set(checks.filter(c => c.kind === 'capacity').map(c => c.date));
  const rows = tab === 'frequent' ? stat.fills.filter(isFreq)
    : tab === 'multi' ? stat.fills.filter(f => f.parts > 1)
    : tab === 'violations' ? stat.fills.filter(f => violationDates.has(f.date))
    : stat.fills;
  const DAILY_PAGE = 7;
  const dailyPages = Math.max(1, Math.ceil(stat.fills.length / DAILY_PAGE));
  const dailyView = stat.fills.slice(dailyPage * DAILY_PAGE, dailyPage * DAILY_PAGE + DAILY_PAGE);

  // ملاحظات تلقائية
  const multi = stat.fills.filter(f => f.parts > 1);

  const disc = disciplineScore(stat, checks, fleetAvg);

  const tip = { contentStyle: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12, color: '#e2e8f0', direction: 'rtl' as const }, labelStyle: { color: '#94a3b8', fontWeight: 700 } };

  return (
    <div className="space-y-5 pb-12 font-cairo vehicle-page">
      {/* الشريط العلوي */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-sky-400 cursor-pointer">
          <ArrowRight className="w-4 h-4" />تقرير العربات
        </button>
        <div className="flex items-center gap-3 ml-auto">
          <div>
            <div className="text-[11px] text-slate-500 font-bold">{category ? `العربة · ${category.label}` : 'العربة'}</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none" dir="ltr">{stat.vehicle}</div>
          </div>
          {stat.frequent > 0 ? (
            <span className="flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"><Repeat2 className="w-3.5 h-3.5" />تفويل متكرر</span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" />منتظم</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-bold ml-1">الترتيب #{rank + 1} من {ranking.length}</span>
          <button type="button" disabled={!prevV} onClick={() => prevV && onOpen(prevV)} title="الأعلى استهلاكًا قبلها" className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          <button type="button" disabled={!nextV} onClick={() => nextV && onOpen(nextV)} title="التالية" className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* بطاقة العربة */}
        <div className={`${card} xl:col-span-8 p-5`}>
          {/* ملف العربة */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { icon: <Hash className="w-3.5 h-3.5" />, v: profile?.type || category?.label || 'النوع غير محدد', on: !!(profile?.type || category) },
              { icon: <Container className="w-3.5 h-3.5" />, v: profile?.tankLiters ? `خزان ${profile.tankLiters.toLocaleString()} L` : 'سعة الخزان؟', on: !!profile?.tankLiters },
              { icon: <ShieldCheck className="w-3.5 h-3.5" />, v: profile?.dailyLimit ? `حصة ${profile.dailyLimit.toLocaleString()} L/يوم` : 'بلا حصة يومية', on: !!profile?.dailyLimit },
              { icon: <User className="w-3.5 h-3.5" />, v: profile?.driver || 'بلا سائق معتمد', on: !!profile?.driver },
              { icon: <Building2 className="w-3.5 h-3.5" />, v: profile?.department || 'القسم؟', on: !!profile?.department },
            ].map((c, i) => (
              <span key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${c.on ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{c.icon}{c.v}</span>
            ))}
            <button type="button" onClick={() => setEditing(true)} className="mr-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black hover:opacity-90 hover:-translate-x-0.5 transition-all cursor-pointer">
              <IdCard className="w-3.5 h-3.5" />تفاصيل العربة
            </button>
          </div>
          {profile?.notes && <p className="-mt-2 mb-4 text-xs text-slate-500 dark:text-slate-400 leading-6">{profile.notes}</p>}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-center">
            <div className="md:col-span-2 grid grid-cols-2 gap-2.5">
              <Spec tone="bg-sky-500/10 text-sky-600" icon={<Fuel className="w-4 h-4" />} label="إجمالي الكمية" value={`${stat.total.toLocaleString()} L`} />
              <Spec tone="bg-indigo-500/10 text-indigo-600" icon={<Hash className="w-4 h-4" />} label="عدد التفويلات" value={stat.count} />
              <Spec tone="bg-violet-500/10 text-violet-600" icon={<Gauge className="w-4 h-4" />} label="متوسط التفويلة" value={`${stat.avg.toLocaleString()} L`} />
              <Spec tone="bg-amber-500/10 text-amber-600" icon={<Trophy className="w-4 h-4" />} label="أعلى تفويلة" value={`${stat.max.toLocaleString()} L`} />
              <Spec tone="bg-emerald-500/10 text-emerald-600" icon={<Timer className="w-4 h-4" />} label="متوسط الأيام بين التفويلات" value={stat.avgGap ?? '—'} />
              <Spec tone="bg-rose-500/10 text-rose-600" icon={<Percent className="w-4 h-4" />} label="حصتها من الأسطول" value={`${share}%`} />
            </div>
            <div className="md:col-span-3 relative">
              <div className="absolute inset-x-6 bottom-2 h-6 rounded-full bg-slate-900/20 blur-xl" />
              {profile?.photo ? (
                <img src={profile.photo} alt={`العربة ${stat.vehicle}`} className="relative w-full h-56 sm:h-64 object-cover rounded-3xl shadow-xl vehicle-truck-in" />
              ) : (
                <VehicleArt code={stat.vehicle} scale={0.03} className="w-full h-56 sm:h-64 vehicle-truck-in dark:rounded-2xl dark:bg-white/95" imgClassName="mix-blend-multiply dark:mix-blend-normal" />
              )}
              <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl ${vsFleet > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`} dir="ltr">{vsFleet > 0 ? '+' : ''}{vsFleet}% vs fleet</span>
                {km > 0 && <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-slate-900 text-white">{km.toLocaleString()} كم · {(stat.total / km).toFixed(2)} L/كم</span>}
              </div>
            </div>
          </div>

          {/* التفويلات اليومية: 7 سطور لكل صفحة */}
          <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><RouteIcon className="w-4 h-4 text-sky-500" />التفويلات اليومية</h3>
              <span className="text-[11px] text-slate-500 font-bold">{stat.fills.length} تفويلة</span>
            </div>
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                <tr>{['التفويلة اليومية', 'عدد الأيام', 'التاريخ', 'اسم السائق'].map(h => <th key={h} className="py-2.5 px-4 font-bold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {dailyView.map(f => (
                  <tr key={f.date} className={isFreq(f) ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}>
                    <td className="py-2.5 px-4 font-mono font-black text-slate-900 dark:text-white">{f.qty.toLocaleString()} L</td>
                    <td className="py-2.5 px-4"><span className={`px-2 py-0.5 rounded-md font-mono font-bold ${isFreq(f) ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 dark:bg-slate-800'}`}>{f.days ?? '—'}</span></td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{f.date}</td>
                    <td className="py-2.5 px-4"><span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400" />{f.drivers.join('، ') || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dailyPages > 1 && (
              <div className="flex items-center justify-center gap-1 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <button type="button" disabled={dailyPage === 0} onClick={() => setDailyPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" aria-label="السابقة"><ChevronRight className="w-4 h-4" /></button>
                <span className="font-mono font-bold px-2">{dailyPage + 1} / {dailyPages}</span>
                <button type="button" disabled={dailyPage >= dailyPages - 1} onClick={() => setDailyPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" aria-label="التالية"><ChevronLeft className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>

        {/* الخريطة + المؤشر + الملاحظات */}
        <div className="xl:col-span-4 space-y-5">
          <div className="h-[380px]"><VehicleMap date={null} vehicle={stat.vehicle} vehicles={vehicles} editable={editable} title="مسارات العربة" /></div>
          <div className={`${card} p-4`}>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" />مؤشر الانضباط</h3>
            <div className="mt-3"><ScoreGauge score={disc.score} grade={disc.grade} /></div>
            <div className="mt-4 space-y-1.5">
              {disc.factors.map(f => (
                <div key={f.label} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-slate-600 dark:text-slate-300 font-bold">{f.label}</span>
                  <span className="font-mono font-black text-rose-500">-{f.points}</span>
                </div>
              ))}
              {!disc.factors.length && <p className="text-xs text-emerald-600 font-bold text-center">بلا خصومات</p>}
              {!profile?.tankLiters && editable && (
                <button type="button" onClick={() => setEditing(true)} className="w-full mt-2 text-[11px] font-bold text-sky-600 hover:underline cursor-pointer">أضف سعة الخزان لكشف التفويل الأكبر من الخزان</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* الرسم البياني */}
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">الكمية في كل تفويلة</h3>
          <span className="text-[11px] text-slate-500">الخط المتقطع = متوسط الأسطول ({fleetAvg.toLocaleString()} L)</span>
        </div>
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs><linearGradient id="vdBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#6366f1" /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tip} formatter={(v: number, n: string) => [n === 'days' ? `${v} يوم` : `${v?.toLocaleString()} L`, n === 'qty' ? 'الكمية' : n === 'prev' ? 'السابقة' : 'الأيام']} />
              <ReferenceLine yAxisId="l" y={fleetAvg} stroke="#f97316" strokeDasharray="6 4" />
              <Bar yAxisId="l" dataKey="qty" fill="url(#vdBar)" radius={[8, 8, 0, 0]} maxBarSize={36} />
              <Line yAxisId="r" type="monotone" dataKey="days" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* السجل */}
      <div className={`${card} overflow-hidden`}>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-900 dark:text-white ml-auto flex items-center gap-2"><Layers className="w-4 h-4 text-sky-500" />سجل التفويل</h3>
          {([['all', `الكل (${stat.fills.length})`], ['frequent', `المتكرر (${stat.frequent})`], ['multi', `أكثر من موقع (${multi.length})`], ['violations', `مخالفات الملف (${violationDates.size})`]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${tab === k ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{l}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
              <tr>{['التاريخ', 'الكمية', 'السائق', 'الموقع', 'الأيام', 'السابقة', 'تاريخها', 'السائق السابق', 'الموقع السابق'].map(h => <th key={h} className="py-2.5 px-3 font-bold whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {rows.map(f => (
                <tr key={f.date} className={overCap.has(f.date) ? 'bg-rose-100/80 dark:bg-rose-950/40' : violationDates.has(f.date) ? 'bg-amber-50/70 dark:bg-amber-950/20' : isFreq(f) ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}>
                  <td className="py-2.5 px-3 font-mono font-bold">{f.date}</td>
                  <td className="py-2.5 px-3 font-mono font-black text-sky-700 dark:text-sky-400">{f.qty.toLocaleString()}{overCap.has(f.date) && <span className="mr-1 text-[9px] px-1 rounded bg-rose-500 text-white">فوق السعة</span>}{f.parts > 1 && <span className="mr-1 text-[9px] px-1 rounded bg-amber-500/15 text-amber-600">×{f.parts}</span>}</td>
                  <td className="py-2.5 px-3">{f.drivers.join('، ') || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-500">{f.sites.join('، ')}</td>
                  <td className="py-2.5 px-3"><span className={`px-1.5 py-0.5 rounded-md font-mono font-bold ${isFreq(f) ? 'bg-rose-500/10 text-rose-600' : ''}`}>{f.days ?? '—'}</span></td>
                  <td className="py-2.5 px-3 font-mono">{f.prevQty?.toLocaleString() ?? '—'}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">{f.prevDate || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-500">{f.prevDriver || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-500">{f.prevSite || '—'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="py-8 text-center text-slate-400">لا توجد سطور</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <VehicleProfileEditor
          stat={stat}
          profile={profile}
          editable={editable}
          drivers={[...new Set(stat.fills.flatMap(f => [...f.drivers, f.prevDriver]).filter(Boolean))]}
          onSave={saveProfile}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
};
