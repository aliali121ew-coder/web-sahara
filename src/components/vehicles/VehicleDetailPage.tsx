/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ChevronRight, ChevronLeft, Fuel, Gauge, Trophy, Repeat2, Timer, Percent, Hash,
  User, CheckCircle2, Route as RouteIcon, Layers, IdCard, ShieldCheck, Building2, Container,
} from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import {
  FREQUENT_DAYS, VEHICLE_PROFILES_KEY, VEHICLE_ROUTES_KEY, checkFills, daysBetween, disciplineScore, vehicleCategory,
  type CheckKind, type VehicleProfile, type VehicleRefill, type VehicleRoute, type VehicleStat,
} from '../../lib/vehicleFuel';
import { VehicleProfileEditor } from './VehicleProfileEditor';
import { ScoreGauge } from './ScoreGauge';
import { VehicleArt } from './VehicleArt';
import { useCategoryNames } from './categories';
import { VehicleMap } from './VehicleMap';

interface Props {
  stat: VehicleStat;
  /** سطور العربة كما في الملفات (قبل دمج تفويلات اليوم الواحد) */
  refills: VehicleRefill[];
  /** ترتيب العربات (الأعلى استهلاكًا أولًا) للتنقل بين العربات */
  ranking: string[];
  /** متوسط التفويلة في كل الأسطول */
  fleetAvg: number;
  fleetTotal: number;
  vehicles: string[];
  editable: boolean;
  /** اسم الصفحة التي يعود إليها زر الرجوع */
  backLabel?: string;
  onBack: () => void;
  onOpen: (v: string) => void;
}

const card = 'rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';

/** لون ثابت لكل سائق (من اسمه) لدائرة حرفه الأول في السجل */
const AVATAR = [
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300',
];
const avatarTone = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];

const Spec: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone: string }> = ({ icon, label, value, tone }) => (
  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 p-3">
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${tone}`}>{icon}</div>
    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{label}</div>
    <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5 truncate">{value}</div>
  </div>
);

/** صفحة كاملة لتفاصيل عربة: المواصفات، آخر رحلة تفويل، السائقون، الخريطة، الرسم، والسجل */
export const VehicleDetailPage: React.FC<Props> = ({ stat, refills, ranking, fleetAvg, fleetTotal, vehicles, editable, backLabel = 'تقرير العربات', onBack, onOpen }) => {
  const [routes] = useSyncedStorage<VehicleRoute[]>(VEHICLE_ROUTES_KEY, []);
  const [tab, setTab] = useState<'all' | 'frequent' | 'multi' | 'violations'>('all');
  const [profiles, setProfiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const [editing, setEditing] = useState(false);
  const [dailyPage, setDailyPage] = useState(0);
  useEffect(() => setDailyPage(0), [stat.vehicle]);
  const profile = profiles.find(p => p.id === stat.vehicle);
  // الاسم إن وُجد يحدد الفئة والصورة (يُعامل كرمز العربة)
  const [catLabels] = useCategoryNames();
  const baseCategory = vehicleCategory(profile?.name || stat.vehicle);
  const category = baseCategory ? { ...baseCategory, label: catLabels[baseCategory.key] || baseCategory.label } : null;
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


  // مخالفات ملف العربة (السعة، الحصة، السائق) — التكرار له تبويبه
  const SERIOUS: CheckKind[] = ['capacity', 'limit', 'driver'];
  const violationDates = new Set(checks.filter(c => SERIOUS.includes(c.kind)).map(c => c.date));
  const overCap = new Set(checks.filter(c => c.kind === 'capacity').map(c => c.date));
  // السجل: كل تفويلة (كل كمية) في سطر مستقل كما في الملفات، مع عدد تفويلات يومها
  const allRows = useMemo(() => {
    const perDay = new Map<string, number>();
    for (const r of refills) perDay.set(r.date, (perDay.get(r.date) || 0) + 1);
    return [...refills]
      .sort((a, b) => b.date.localeCompare(a.date) || b.qty - a.qty)
      .map(r => ({
        key: r.id, date: r.date, qty: r.qty, days: r.days,
        drivers: r.driver ? [r.driver] : [], sites: [r.site],
        prevQty: r.prevQty, prevDate: r.prevDate, prevDriver: r.prevDriver, prevSite: r.prevSite,
        parts: perDay.get(r.date) || 1,
      }));
  }, [refills]);
  const rows = tab === 'frequent' ? allRows.filter(f => f.days !== null && f.days <= FREQUENT_DAYS)
    : tab === 'multi' ? allRows.filter(f => f.parts > 1)
    : tab === 'violations' ? allRows.filter(f => violationDates.has(f.date))
    : allRows;
  // السجل مجمّعًا حسب اليوم (الأحدث أولًا) مع إجمالي اليوم وتنبيهاته
  const historyGroups = useMemo(() => {
    const out: { date: string; day: string; total: number; multi: boolean; violation: boolean; overCap: boolean; rows: typeof rows }[] = [];
    for (const f of rows) {
      let g = out.find(x => x.date === f.date);
      if (!g) {
        const [y, m, d] = f.date.split('/').map(Number);
        const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ar-IQ', { weekday: 'long', timeZone: 'UTC' });
        g = { date: f.date, day, total: 0, multi: false, violation: violationDates.has(f.date), overCap: overCap.has(f.date), rows: [] };
        out.push(g);
      }
      g.rows.push(f);
      g.total += f.qty;
      if (f.parts > 1) g.multi = true;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, checks]);
  const DAILY_PAGE = 7;
  // آخر تفويلة فقط: أحدث تاريخ للعربة في كل الملفات المرفوعة، وسطر لكل كمية في ذلك اليوم.
  // الكمية السابقة في الكشوف لا تُستخدم هنا؛ عدد الأيام = من تاريخ التفويل المرفوع الذي قبله
  const entries = useMemo(() => {
    const dates = [...new Set(refills.map(r => r.date))].sort();
    const date = dates[dates.length - 1];
    if (!date) return [];
    const prev = dates[dates.length - 2];
    // كل كمية في سطر مستقل (لا تُجمع تفويلات نفس الموقع أو اليوم)
    return refills.filter(r => r.date === date).map(r => ({
      key: r.id,
      date,
      qty: r.qty,
      days: r.days ?? (prev ? daysBetween(prev, date) : null),
      drivers: r.driver ? [r.driver] : [],
      sites: [[r.site, r.qty]] as [string, number][],
      count: 1,
    })).sort((a, b) => b.qty - a.qty);
  }, [refills]);
  const dailyPages = Math.max(1, Math.ceil(entries.length / DAILY_PAGE));
  const dailyView = entries.slice(dailyPage * DAILY_PAGE, dailyPage * DAILY_PAGE + DAILY_PAGE);

  // ملاحظات تلقائية

  const disc = disciplineScore(stat, checks, fleetAvg);


  return (
    <div className="space-y-5 pb-12 font-cairo vehicle-page">
      {/* الشريط العلوي */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-sky-400 cursor-pointer">
          <ArrowRight className="w-4 h-4" />{backLabel}
        </button>
        <div className="flex items-center gap-3 ml-auto">
          <div>
            <div className="text-[11px] text-slate-500 font-bold">{category ? `العربة · ${category.label}` : 'العربة'}</div>
            {/* الاسم إن وُجد يحل محل الرمز في العنوان، والرمز صغيرًا تحته */}
            {profile?.name ? (
              <>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">{profile.name}</div>
              </>
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none" dir="ltr">{stat.vehicle}</div>
            )}
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
              {profile?.photo ? (
                <img src={profile.photo} alt={`العربة ${stat.vehicle}`} className="relative w-full h-56 sm:h-64 object-contain" />
              ) : (
                <VehicleArt code={profile?.name || stat.vehicle} className="w-full h-56 sm:h-64" />
              )}
              <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl ${vsFleet > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`} dir="ltr">{vsFleet > 0 ? '+' : ''}{vsFleet}% vs fleet</span>
                {km > 0 && <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-slate-900 text-white">{km.toLocaleString()} كم · {(stat.total / km).toFixed(2)} L/كم</span>}
              </div>
            </div>
          </div>

          {/* آخر تفويلة: أحدث تاريخ وسطر لكل موقع */}
          <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><RouteIcon className="w-4 h-4 text-sky-500" />آخر تفويلة</h3>
              <span className="text-[11px] text-slate-500 font-bold">{entries.length > 1 ? `${entries.length} مواقع · ${entries.reduce((t, e) => t + e.qty, 0).toLocaleString()} L` : `${entries.length} موقع`}</span>
            </div>
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                <tr>{['الكمية', 'عدد الأيام', 'التاريخ', 'اسم السائق', 'الموقع'].map(h => <th key={h} className="py-2.5 px-4 font-bold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {dailyView.map(d => {
                  const freq = d.days !== null && d.days <= FREQUENT_DAYS;
                  const multi = entries.length > 1;
                  return (
                    <tr key={d.key} className={multi ? 'bg-amber-50/70 dark:bg-amber-950/20' : freq ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}>
                      <td className="py-2.5 px-4 font-mono font-black text-slate-900 dark:text-white">{d.qty.toLocaleString()} L</td>
                      <td className="py-2.5 px-4"><span className={`px-2 py-0.5 rounded-md font-mono font-bold ${freq ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 dark:bg-slate-800'}`}>{d.days ?? '—'}</span></td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{d.date}</td>
                      <td className="py-2.5 px-4"><span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400 shrink-0" />{d.drivers.join('، ') || '—'}</span></td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {d.sites.map(([site, q]) => (
                            <span key={site} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${multi ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                              {site}{multi && <span className="font-mono"> · {q.toLocaleString()} L</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* السجل: تبويبات بخط سفلي، والتفويلات مجمّعة حسب اليوم، وخمسة أعمدة (السابقة في خانة واحدة) */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500" />سجل التفويل</h3>
          <div role="tablist" aria-label="تصفية السجل" className="flex gap-5 overflow-x-auto vehicle-scroll">
            {([['all', 'الكل', allRows.length], ['frequent', 'المتكرر', allRows.filter(f => f.days !== null && f.days <= FREQUENT_DAYS).length], ['multi', 'أكثر من تفويلة باليوم', allRows.filter(f => f.parts > 1).length], ['violations', 'مخالفات الملف', violationDates.size]] as const).map(([k, l, n]) => {
              const on = tab === k;
              return (
                <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)} className={`h-14 inline-flex items-center gap-1.5 border-b-2 text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${on ? 'border-indigo-600 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                  {l}<span className={`px-1.5 py-px rounded-full text-[11px] font-mono transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[120px_minmax(190px,1.4fr)_minmax(130px,1fr)_130px_minmax(210px,1.3fr)] items-center h-11 px-5 bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-[11.5px] font-bold text-slate-500 dark:text-slate-400">
              <div>الكمية</div><div>السائق</div><div>الموقع</div><div>الفاصل</div><div>التفويلة السابقة</div>
            </div>
            {historyGroups.map(g => (
              <div key={g.date}>
                {/* رأس اليوم */}
                <div className="flex items-center gap-3 h-11 px-5 border-b border-slate-100/80 dark:border-slate-800/60">
                  <span className="text-[13px] font-bold text-slate-900 dark:text-white">{g.day}</span>
                  <bdi className="font-mono text-xs text-slate-400">{g.date}</bdi>
                  <span className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  <span className="text-xs text-slate-500 dark:text-slate-400"><bdi className="font-mono font-semibold text-slate-900 dark:text-white">{g.total.toLocaleString()}</bdi> لتر · {g.rows.length === 1 ? 'تفويلة واحدة' : `${g.rows.length} تفويلات`}</span>
                  {g.multi && <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[11.5px] font-bold text-rose-700 dark:text-rose-300"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />مكرر باليوم</span>}
                  {g.violation && <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-[11.5px] font-bold text-amber-800 dark:text-amber-300"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{g.overCap ? 'فوق سعة الخزان' : 'مخالفة الملف'}</span>}
                </div>
                {g.rows.map(f => {
                  const driver = f.drivers.join('، ');
                  const near = f.days !== null && f.days <= FREQUENT_DAYS;
                  return (
                    <div key={f.key} className="grid grid-cols-[120px_minmax(190px,1.4fr)_minmax(130px,1fr)_130px_minmax(210px,1.3fr)] items-center min-h-[60px] px-5 py-2 border-b border-slate-100/80 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="font-mono text-[15px] font-semibold text-slate-900 dark:text-white">{f.qty.toLocaleString()} <span className="font-cairo text-[11.5px] font-bold text-slate-400">لتر</span></div>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {driver ? <span className={`w-[30px] h-[30px] shrink-0 rounded-full inline-flex items-center justify-center text-xs font-bold ${avatarTone(driver)}`}>{driver.charAt(0)}</span> : null}
                        <span className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 truncate">{driver || '—'}</span>
                      </div>
                      <div className="text-[13px] text-slate-600 dark:text-slate-300 truncate">{f.sites.join('، ')}</div>
                      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                        {f.days !== null && <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${near ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`} />}
                        {f.days === null ? <span className="text-slate-400">—</span> : f.days === 0 ? 'اليوم نفسه' : <>بعد <bdi className="font-mono">{f.days}</bdi> يوم</>}
                      </div>
                      <div className="min-w-0">
                        {f.prevQty !== null || f.prevDate ? (
                          <>
                            <div className="text-[13px]"><bdi className="font-mono font-semibold text-slate-900 dark:text-white">{f.prevQty?.toLocaleString() ?? '—'}</bdi> <span className="text-slate-400">لتر ·</span> <bdi className="font-mono text-slate-500">{f.prevDate ? `${f.prevDate.slice(8)}/${f.prevDate.slice(5, 7)}` : '—'}</bdi></div>
                            <div className="text-[11.5px] text-slate-400 truncate">{[f.prevDriver, f.prevSite].filter(Boolean).join(' · ') || '—'}</div>
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {!rows.length && <div className="py-12 text-center text-sm text-slate-400">لا توجد تفويلات في هذا التبويب</div>}
          </div>
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
