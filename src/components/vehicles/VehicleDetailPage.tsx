/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, CalendarDays, ChevronRight, ChevronLeft, ChevronDown, FlaskConical, Fuel, Gauge, Trophy, Timer, Hash, Container, X,
  User, Route as RouteIcon, IdCard,
} from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import {
  FREQUENT_DAYS, VEHICLE_PROFILES_KEY, VEHICLE_ROUTES_KEY, checkFills, daysBetween, tankCaps, vehicleCategory, vehicleStats,
  type CheckKind, type VehicleProfile, type VehicleRefill, type VehicleRoute, type VehicleStat,
} from '../../lib/vehicleFuel';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import { VehicleProfileEditor } from './VehicleProfileEditor';
import { VehicleArt } from './VehicleArt';
import { useCategoryNames } from './categories';
import { RefillTrend, SiteDonut, vehicleCard as card } from './VehicleCharts';
import { VehicleRefillTable } from './VehicleRefillTable';

interface Props {
  stat: VehicleStat;
  /** سطور العربة كما في الملفات (قبل دمج تفويلات اليوم الواحد) */
  refills: VehicleRefill[];
  /** ترتيب العربات (الأعلى استهلاكًا أولًا) للتنقل بين العربات */
  ranking: string[];
  editable: boolean;
  /** اسم الصفحة التي يعود إليها زر الرجوع */
  backLabel?: string;
  onBack: () => void;
  onOpen: (v: string) => void;
  /** يفتح مختبر العربة */
  onLab: (v: string) => void;
}

/** كارت رقم موحّد: العنوان والأيقونة في صف، وتحته القيمة ووحدتها بنفس الارتفاع في كل الكارتات */
const Spec: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; unit?: string; tone: string }> = ({ icon, label, value, unit, tone }) => (
  <div className="h-[92px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/70 px-3.5 py-3 flex flex-col justify-between">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-bold truncate">{label}</span>
      <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${tone}`}>{icon}</span>
    </div>
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-xl leading-none font-black text-slate-900 dark:text-white font-mono">{value}</span>
      {unit && <span className="text-[11px] font-bold text-slate-400 truncate">{unit}</span>}
    </div>
  </div>
);

/** صفحة كاملة لتفاصيل عربة: المواصفات، آخر تفويلة، الرسوم، والسجل؛ والتاريخ يحدد كل شيء عدا آخر تفويلة */
export const VehicleDetailPage: React.FC<Props> = ({ stat, refills, editable, backLabel = 'تقرير العربات', onBack, onLab }) => {
  const [routes] = useSyncedStorage<VehicleRoute[]>(VEHICLE_ROUTES_KEY, []);
  const [profiles, setProfiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const [editing, setEditing] = useState(false);
  const [dailyPage, setDailyPage] = useState(0);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  useEffect(() => { setDailyPage(0); setRange(null); }, [stat.vehicle]);
  const profile = profiles.find(p => p.id === stat.vehicle);
  // الاسم إن وُجد يحدد الفئة والصورة (يُعامل كرمز العربة)
  const [catLabels] = useCategoryNames();
  const baseCategory = vehicleCategory(profile?.name || stat.vehicle);
  const category = baseCategory ? { ...baseCategory, label: catLabels[baseCategory.key] || baseCategory.label } : null;
  const fillDates = useMemo(() => new Set(stat.fills.map(f => f.date)), [stat]);
  const sortedDates = useMemo(() => [...new Set(refills.map(r => r.date))].sort(), [refills]);
  const fills = useMemo(() => (range ? stat.fills.filter(f => f.date >= range.from && f.date <= range.to) : stat.fills), [stat, range]);
  const rangedRefills = useMemo(() => (range ? refills.filter(r => r.date >= range.from && r.date <= range.to) : refills), [refills, range]);
  const view = useMemo(() => vehicleStats(fills)[0] ?? null, [fills]);
  const checks = useMemo(() => checkFills(fills, profile), [fills, profile]);
  const saveProfile = (p: VehicleProfile) => { setProfiles(prev => [p, ...prev.filter(x => x.id !== p.id)]); setEditing(false); };

  useEffect(() => { window.scrollTo(0, 0); }, [stat.vehicle]);

  const caps = tankCaps(profile);
  const tanks = caps.length || null;
  const capacity = caps.reduce((s, c) => s + c, 0);
  const periodLabel = !range ? 'كل الفترة' : range.from === range.to ? range.from : `${range.from} ← ${range.to}`;

  const myRoutes = useMemo(() => routes.filter(r => r.vehicle === stat.vehicle), [routes, stat.vehicle]);
  const km = myRoutes.reduce((s, r) => s + r.km, 0);


  // مخالفات ملف العربة (السعة، الحصة، السائق) — التكرار له تبويبه
  const SERIOUS: CheckKind[] = ['capacity', 'limit', 'driver'];
  const violationDates = new Set(checks.filter(c => SERIOUS.includes(c.kind)).map(c => c.date));
  const overCap = new Set(checks.filter(c => c.kind === 'capacity').map(c => c.date));
  // السجل: كل تفويلة (كل كمية) في سطر مستقل كما في الملفات، مع عدد تفويلات يومها.
  // الفاصل من التاريخ المرفوع الذي قبله، لذا يُحسب من كل التفويلات لا من الفترة المختارة فقط
  const rows = useMemo(() => {
    const perDay = new Map<string, number>();
    for (const r of refills) perDay.set(r.date, (perDay.get(r.date) || 0) + 1);
    return [...rangedRefills]
      .sort((a, b) => b.date.localeCompare(a.date) || b.qty - a.qty)
      .map(r => {
        const parts = perDay.get(r.date) || 1;
        const before = sortedDates[sortedDates.indexOf(r.date) - 1];
        return {
          key: r.id, date: r.date, qty: r.qty, days: r.days, driver: r.driver, site: r.site,
          prevQty: r.prevQty, prevSite: r.prevSite, parts,
          gap: parts > 1 ? 0 : before ? daysBetween(before, r.date) : null,
        };
      });
  }, [refills, rangedRefills, sortedDates]);
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

  return (
    <div className="space-y-5 pb-12 font-cairo vehicle-page">
      {/* الشريط العلوي: الرجوع واسم العربة والتاريخ داخل مستطيل واحد */}
      <div className={`${card} relative z-20 flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3`}>
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer">
          <ArrowRight className="w-4 h-4" />{backLabel}
        </button>
        <span className="hidden sm:block w-px h-9 bg-slate-200 dark:bg-slate-700" />
        <div className="min-w-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{category ? `العربة · ${category.label}` : 'العربة'}</div>
          {/* الاسم إن وُجد يحل محل الرمز في العنوان */}
          {profile?.name ? (
            <div className="mt-0.5 text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none truncate">{profile.name}</div>
          ) : (
            <div className="mt-0.5 text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none text-right" dir="ltr">{stat.vehicle}</div>
          )}
        </div>
        <button type="button" onClick={() => onLab(stat.vehicle)} className="mr-auto flex items-center gap-1.5 h-10 px-4 rounded-xl bg-gradient-to-l from-indigo-500 to-sky-500 text-xs font-black text-white shadow-sm shadow-indigo-500/25 hover:opacity-90 transition-opacity cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2">
          <FlaskConical className="w-4 h-4" />بيانات عامة
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="تاريخ الصفحة"
            onClick={() => setRangeOpen(o => !o)}
            className={`flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${range ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400'}`}
          >
            <CalendarDays className={`w-4 h-4 ${range ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`} />
            <span className={range ? 'font-mono' : ''}>{periodLabel}</span>
            {range ? (
              <span role="button" title="مسح التاريخ" onClick={e => { e.stopPropagation(); setRange(null); }} className="p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50"><X className="w-3 h-3" /></span>
            ) : (
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${rangeOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
          {rangeOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setRangeOpen(false)} />
              <div className="absolute z-50 top-full mt-2 left-0">
                <DateRangeCalendar
                  from={range?.from ?? ''}
                  to={range?.to ?? ''}
                  marked={fillDates}
                  min={sortedDates[0]}
                  max={sortedDates[sortedDates.length - 1]}
                  onApply={(from, to) => { setRange({ from, to: to || from }); setRangeOpen(false); }}
                  onClear={() => { setRange(null); setRangeOpen(false); }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* بطاقة العربة */}
        <div className={`${card} xl:col-span-8 p-5`}>
          {/* ملف العربة */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button type="button" onClick={() => setEditing(true)} className="mr-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black hover:opacity-90 hover:-translate-x-0.5 transition-all cursor-pointer">
              <IdCard className="w-3.5 h-3.5" />تفاصيل العربة
            </button>
          </div>
          {profile?.notes && <p className="-mt-2 mb-4 text-xs text-slate-500 dark:text-slate-400 leading-6">{profile.notes}</p>}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-center">
            <div className="md:col-span-2 grid grid-cols-2 gap-2.5">
              <Spec tone="bg-sky-500/10 text-sky-600" icon={<Fuel className="w-4 h-4" />} label="إجمالي الكمية" value={(view?.total ?? 0).toLocaleString()} unit="لتر" />
              <Spec tone="bg-indigo-500/10 text-indigo-600" icon={<Hash className="w-4 h-4" />} label="عدد التفويلات" value={view?.count ?? 0} unit="تفويلة" />
              <Spec tone="bg-violet-500/10 text-violet-600" icon={<Gauge className="w-4 h-4" />} label="متوسط التفويلة" value={(view?.avg ?? 0).toLocaleString()} unit="لتر" />
              <Spec tone="bg-amber-500/10 text-amber-600" icon={<Trophy className="w-4 h-4" />} label="أعلى تفويلة" value={(view?.max ?? 0).toLocaleString()} unit="لتر" />
              <Spec tone="bg-emerald-500/10 text-emerald-600" icon={<Timer className="w-4 h-4" />} label="متوسط الفاصل" value={view?.avgGap ?? '—'} unit="يوم" />
              <Spec tone="bg-rose-500/10 text-rose-600" icon={<Container className="w-4 h-4" />} label="عدد الخزانات" value={tanks ?? '—'} unit={tanks ? `${capacity.toLocaleString()} لتر` : undefined} />
            </div>
            <div className="md:col-span-3 relative">
              {profile?.photo ? (
                <img src={profile.photo} alt={`العربة ${stat.vehicle}`} className="relative w-full h-56 sm:h-64 object-contain" />
              ) : (
                <VehicleArt code={profile?.name || stat.vehicle} className="w-full h-56 sm:h-64" />
              )}
              <div className="absolute top-2 left-2 flex flex-col gap-1.5">
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

        {/* توزيع المواقع + الرسم الخطي */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <SiteDonut refills={rangedRefills} />
          <RefillTrend fills={fills} period={periodLabel} />
        </div>
      </div>

      <VehicleRefillTable key={stat.vehicle} rows={rows} vehicle={profile?.name || stat.vehicle} overCap={overCap} violationDates={violationDates} />

      {editing && (
        <VehicleProfileEditor
          stat={stat}
          profile={profile}
          editable={editable}
          onSave={saveProfile}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
};
