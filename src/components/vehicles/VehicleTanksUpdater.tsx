/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Container, Search, Truck, X, XCircle } from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { getProfile } from '../../lib/session';
import { usePermissions } from '../../lib/usePermission';
import { VEHICLE_PROFILES_KEY, sheetTanks, vehicleCategory, vehicleImage, type VehicleProfile } from '../../lib/vehicleFuel';
import { FLEET, FLEET_TYPES } from '../../lib/vehicleFleet';
import { groupByCategory, useCategoryNames, useVehicleNames } from './categories';
import { useVehicleData } from './useVehicleData';
import { TopSevenCard } from './TopSevenCard';
import { CategoryDonut } from './CategoryDonut';
import { formatDay } from '../../lib/vehicleFuel';

/** عربة في قائمة البحث */
interface Item { code: string; cat: string; catKey: string; group: string }

const codeOf = (p: VehicleProfile) => (p.name?.trim() || p.id).toUpperCase();
/** سُجّلت لها سعة خزان في ملفها (يدويًا) */
const isUpdated = (p: VehicleProfile | undefined) => !!(p?.tankLiters || p?.tank2Liters || p?.tank3Liters);
/** أسطول الشركة من ملفي Excel (كل آلية: نوعها، محدثة أم لا، سعاتها المكتوبة، مجموعتها) */
const FLEET_BY_CODE = new Map(FLEET.map(v => [v.code, v]));
/** محدثة في ملفي Excel (شيتا «المحدث») */
const inSheet = (code: string) => !!FLEET_BY_CODE.get(code)?.updated;
/** صورة العربة، و«أخرى» (بلا فئة) شعار سما كربلاء */
const imageOf = (code: string, photo?: string) => photo || (vehicleCategory(code) ? vehicleImage(code) : '/logos/sama.png');
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * صفحة «تحديث بيانات العربات»: لحسابات تحديث الخزانات فقط. زر يفتح نافذة بخلفية ضبابية:
 * بحث عن أي عربة (مع فئتها وصورتها)، ثم حتى 3 خزانات، والحفظ يُظهر علامة صح متحركة ثم تُغلق النافذة.
 * العربة المحدثة يظهر كارتها بالأخضر، وغير المحدثة بالأحمر.
 */
export const VehicleTanksUpdater: React.FC = () => {
  const [profiles, setProfiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  const [labels] = useCategoryNames();
  const [open, setOpen] = useState(false);
  // الحفظ يحتاج «تعديل» على تحديث بيانات العربات أو تقرير العربات (الخادم يرفض غير ذلك)
  const { canEdit } = usePermissions();
  const canSave = canEdit('vehicles-tanks') || canEdit('vehicles-report');

  // التفويلات (قراءة فقط) للأعلى استهلاكًا والرسم (آخر يوم كشف كما في تقرير العربات)
  const { stats, active } = useVehicleData(null);
  const names = useVehicleNames();

  // كل آليات الشركة من ملفي Excel مصنفة بنوعها، ومعها أي عربة حُفظت خزاناتها يدويًا وليست فيهما
  const items = useMemo<Item[]>(() => {
    const map = new Map<string, Item>(FLEET.map(v => [v.code, { code: v.code, catKey: v.typeKey, cat: v.type, group: v.group }]));
    for (const p of profiles.filter(isUpdated)) {
      const code = codeOf(p);
      if (map.has(code)) continue;
      const key = /^\d+$/.test(code) ? 'HEAD' : /^([A-Z]+)/.exec(code)?.[1] || 'OTHER';
      map.set(code, { code, catKey: FLEET_TYPES[key] ? key : 'OTHER', cat: FLEET_TYPES[key] || 'أخرى', group: '' });
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
  }, [profiles]);

  const profileOf = (code: string) => profiles.find(p => codeOf(p) === code);
  /** محدثة = محدثة في ملفي Excel، أو حُفظت سعاتها يدويًا بعدهما */
  const isUp = (code: string) => isUpdated(profileOf(code)) || inSheet(code);
  const updated = items.filter(i => isUp(i.code)).length;
  const pct = items.length ? Math.round((updated / items.length) * 100) : 0;

  const save = (code: string, caps: (number | null)[], count: number) => {
    const u = getProfile();
    setProfiles(prev => {
      const base = prev.find(p => codeOf(p) === code)
        || { id: code, name: '', type: '', tankLiters: null, dailyLimit: null, driver: '', department: '', notes: '', photo: '', updatedAt: '', by: '' };
      const next: VehicleProfile = {
        ...base,
        tankCount: count,
        tankLiters: caps[0] ?? null,
        tank2Liters: count > 1 ? caps[1] ?? null : null,
        tank3Liters: count > 2 ? caps[2] ?? null : null,
        updatedAt: new Date().toISOString(),
        by: u?.name || u?.username || '',
      };
      return [next, ...prev.filter(p => p.id !== base.id)];
    });
  };

  const statGroups = useMemo(() => groupByCategory(stats, names, labels), [stats, names, labels]);
  const [topCat, setTopCat] = useState<string | null>(null);
  const shownCat = topCat && statGroups.some(g => g.key === topCat) ? topCat : statGroups[0]?.key ?? null;

  // كارتات الفئات: صورة الفئة واسمها، وعدد المحدثة وغير المحدثة فيها
  const catCards = useMemo(() => {
    const m = new Map<string, { key: string; name: string; sample: string; up: number; down: number }>();
    for (const i of items) {
      const c = m.get(i.catKey) || { key: i.catKey, name: i.cat, sample: i.code, up: 0, down: 0 };
      if (isUp(i.code)) c.up++; else c.down++;
      m.set(i.catKey, c);
    }
    // «أخرى» دائمًا آخر الكارتات
    // الكارتات بلا صورة (شعار سما كربلاء) آخرًا، و«أخرى» آخرها
    const noPhoto = (c: { key: string; sample: string }) => (c.key === 'OTHER' ? 2 : vehicleCategory(c.sample) ? 0 : 1);
    return [...m.values()].sort((a, b) => noPhoto(a) - noPhoto(b) || (b.up + b.down) - (a.up + a.down));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, profiles]);
  const down = items.length - updated;
  const downPct = items.length ? 100 - pct : 0;
  const day = active.kind === 'day' ? formatDay(active.date) : '';

  return (
    <div className="space-y-5 pb-12 font-cairo">
      {/* العنوان وزر التحديث */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">تحديث بيانات العربات</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">ابحث عن العربة وأدخل سعات خزاناتها</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto h-12 px-6 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-l from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-base font-black shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5 active:scale-[.98] cursor-pointer"
        >
          <Truck className="w-5 h-5" />تحديث العربات
        </button>
      </div>
      {!canSave && (
        <div role="alert" className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-300">
          هذا الحساب يستطيع العرض فقط. لحفظ سعات الخزانات يحتاج صلاحية «تعديل» على «تحديث بيانات العربات» أو «تقرير العربات» من إدارة الحسابات.
        </div>
      )}

      {/* كارتان فقط: المحدثة وغير المحدثة مع نسبة كل منهما */}
      <div className="grid grid-cols-2 gap-3">
        <StatusKpi ok label="العربات المحدثة" value={updated} pct={pct} total={items.length} />
        <StatusKpi ok={false} label="العربات غير المحدثة" value={down} pct={downPct} total={items.length} />
      </div>

      {/* الفئات: كارتات بلا بيانات تفويل ولا تُفتح، وعلى كل كارت المحدثة وغير المحدثة */}
      <section className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">فئات العربات <span className="text-[11px] font-bold text-slate-400">· {catCards.length} فئة</span></h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {catCards.map(c => {
            const all = c.up + c.down;
            const share = all ? Math.round((c.up / all) * 100) : 0;
            return (
              <div key={c.key} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-black text-slate-900 dark:text-white truncate">{c.name}</span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">{all}</span>
                </div>
                {/* «أخرى» بلا صورة عربة: شعار سما كربلاء فقط */}
                {c.key === 'OTHER' || !vehicleCategory(c.sample)
                  ? <img src="/logos/sama.png" alt="سما كربلاء" loading="lazy" className="w-full h-20 object-contain mt-2 p-2" />
                  : <img src={vehicleImage(c.sample)} alt="" loading="lazy" className="w-full h-20 object-contain mt-2" />}
                <div className="mt-2 h-1.5 rounded-full bg-rose-200/70 dark:bg-rose-950/50 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-center">
                    <div className="font-mono font-black text-base text-emerald-700 dark:text-emerald-300 leading-tight">{c.up}</div>
                    <div className="text-[10px] font-bold text-emerald-700/80 dark:text-emerald-300/80">محدثة</div>
                  </div>
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-2 py-1 text-center">
                    <div className="font-mono font-black text-base text-rose-700 dark:text-rose-300 leading-tight">{c.down}</div>
                    <div className="text-[10px] font-bold text-rose-700/80 dark:text-rose-300/80">غير محدثة</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* الأعلى استهلاكًا: 5 فقط من فئة واحدة يختارها، ثم الرسم */}
      {statGroups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 overflow-x-auto vehicle-scroll pb-1">
              {statGroups.map(g => (
                <button key={g.key} type="button" onClick={() => setTopCat(g.key)} className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${shownCat === g.key ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{g.label}</button>
              ))}
            </div>
            <div className="flex flex-col min-h-[420px]">
              <TopSevenCard stats={stats} category={shownCat} limit={5} />
            </div>
            {day && <div className="text-[11px] text-slate-400 text-center">تفويلات يوم {day}</div>}
          </div>
          <CategoryDonut stats={stats} category={null} />
        </div>
      )}

      {open && <UpdateDialog items={items} profileOf={profileOf} isUp={isUp} onSave={save} onClose={() => setOpen(false)} />}
    </div>
  );
};

const StatusKpi: React.FC<{ ok: boolean; label: string; value: number; pct: number; total: number }> = ({ ok, label, value, pct, total }) => (
  <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-soft-card ${ok ? 'bg-white dark:bg-slate-900/90 border-emerald-200 dark:border-emerald-900/60' : 'bg-white dark:bg-slate-900/90 border-rose-200 dark:border-rose-900/60'}`}>
    <div className={`absolute -top-8 -left-8 w-24 h-24 rounded-full blur-2xl opacity-20 ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
    <div className="relative flex items-center justify-between mb-2">
      <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`p-1.5 rounded-xl text-white ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`}>{ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}</span>
    </div>
    <div className="relative flex items-baseline gap-2">
      <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">{value}</span>
      <span className={`text-sm font-black font-mono ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">{pct}%</span>
    </div>
    <div className={`relative mt-2 h-1.5 rounded-full overflow-hidden ${ok ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-rose-100 dark:bg-rose-950/40'}`}>
      <div className={`h-full rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
    </div>
    <div className="relative text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1.5">من {total} عربة</div>
  </div>
);

const UpdateDialog: React.FC<{
  items: Item[];
  profileOf: (code: string) => VehicleProfile | undefined;
  isUp: (code: string) => boolean;
  onSave: (code: string, caps: (number | null)[], count: number) => void;
  onClose: () => void;
}> = ({ items, profileOf, isUp, onSave, onClose }) => {
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [caps, setCaps] = useState<string[]>(['', '', '']);
  const [done, setDone] = useState(false);
  /** السعات عند فتح العربة: لمعرفة هل غيّرها المستخدم */
  const [orig, setOrig] = useState<{ caps: (number | null)[]; count: number }>({ caps: [null, null, null], count: 1 });
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => { setClosing(true); window.setTimeout(onClose, 200); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // لا تركيز تلقائي على البحث: لوحة المفاتيح على الهاتف تظهر فقط عند الضغط على الحقل
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cats = useMemo(() => {
    const m = new Map<string, { key: string; name: string; count: number }>();
    for (const i of items) { const c = m.get(i.catKey); if (c) c.count++; else m.set(i.catKey, { key: i.catKey, name: i.cat, count: 1 }); }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [items]);
  const needle = q.trim().toUpperCase();
  const results = useMemo(() => items.filter(i => (!catFilter || i.catKey === catFilter)
    && (!needle || i.code.includes(needle) || i.cat.includes(q.trim()))).slice(0, 60), [items, catFilter, needle, q]);

  const pick = (c: string) => {
    const prof = profileOf(c);
    const saved = [prof?.tankLiters ?? null, prof?.tank2Liters ?? null, prof?.tank3Liters ?? null];
    const sheet = sheetTanks(c) || (FLEET_BY_CODE.get(c)?.tanks.length ? FLEET_BY_CODE.get(c)!.tanks : null);
    const start = isUpdated(prof) ? saved : sheet ? [sheet[0] ?? null, sheet[1] ?? null, sheet[2] ?? null] : [null, null, null];
    const startCount = prof?.tankCount || (isUpdated(prof) ? (saved[2] ? 3 : saved[1] ? 2 : 1) : sheet?.length || 1);
    setCode(c);
    setCount(startCount);
    setCaps(start.map(v => (v ? String(v) : '')));
    setOrig({ caps: start.map(v => v || null), count: startCount });
    setConfirming(false);
  };

  const sel = code ? items.find(i => i.code === code) : null;
  const prof = code ? profileOf(code) : undefined;
  const ok = !!code && isUp(code);
  const nums = caps.map(v => (v.trim() === '' ? null : Math.max(0, Number(v)) || null));
  const valid = !!nums[0] && nums.slice(0, count).every(Boolean);
  const total = nums.slice(0, count).reduce<number>((s, v) => s + (v || 0), 0);

  // عربة محدثة تغيّرت سعاتها أو عدد خزاناتها: تأكيد قبل الحفظ
  const changed = ok && (count !== orig.count || [0, 1, 2].some(k => (k < count ? nums[k] : null) !== (k < orig.count ? orig.caps[k] : null)));
  const submit = () => {
    if (!code || !valid) return;
    if (changed && !confirming) { setConfirming(true); return; }
    setConfirming(false);
    onSave(code, nums, count);
    setDone(true);
    window.setTimeout(close, 1400);
  };

  return createPortal(
    <div className={`fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 font-cairo ${closing ? 'vehicle-fade-out' : 'vehicle-fade-in'}`} role="dialog" aria-modal="true" aria-label="تحديث العربات" dir="rtl">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-md" onClick={close} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-white/60 dark:border-slate-700 shadow-2xl overflow-hidden">
        <style>{`
          @keyframes vt-pop { 0% { transform: scale(.6); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
          @keyframes vt-draw { to { stroke-dashoffset: 0 } }
          .vt-pop { animation: vt-pop .45s cubic-bezier(.2,.9,.3,1.2) both }
          .vt-circle { stroke-dasharray: 166; stroke-dashoffset: 166; animation: vt-draw .5s ease-out .1s forwards }
          .vt-check { stroke-dasharray: 48; stroke-dashoffset: 48; animation: vt-draw .35s ease-out .5s forwards }
        `}</style>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6">
            <svg className="vt-pop w-24 h-24" viewBox="0 0 56 56" aria-hidden>
              <circle className="vt-circle" cx="28" cy="28" r="26" fill="none" stroke="#10b981" strokeWidth="3" />
              <path className="vt-check" d="M16 29l8 8 16-17" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-xl font-black text-slate-900 dark:text-white">تم الحفظ</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">العربة <bdi dir="ltr" className="font-mono font-bold">{code}</bdi> محدثة · <bdi className="font-mono">{total.toLocaleString()}</bdi> لتر</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><Truck className="w-5 h-5 text-indigo-600" />تحديث العربات</h3>
              <button type="button" onClick={close} aria-label="إغلاق" className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {!sel ? (
              <>
                <div className="px-5">
                  <label className="flex items-center gap-2 h-12 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400">
                    <Search className="w-5 h-5 text-slate-400" />
                    <span className="sr-only">ابحث عن عربة</span>
                    <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="اكتب رقم العربة، مثل BS214 أو 290" className="flex-1 min-w-0 bg-transparent outline-none text-base font-bold text-slate-900 dark:text-white placeholder:font-medium placeholder:text-slate-400" />
                  </label>
                  <div className="flex gap-1.5 overflow-x-auto vehicle-scroll py-3 -mx-1 px-1">
                    <button type="button" onClick={() => setCatFilter(null)} className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold cursor-pointer ${!catFilter ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>الكل</button>
                    {cats.map(c => (
                      <button key={c.key} type="button" onClick={() => setCatFilter(f => (f === c.key ? null : c.key))} className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${catFilter === c.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{c.name}</button>
                    ))}
                  </div>
                </div>
                <ul className="flex-1 min-h-0 overflow-y-auto vehicle-scroll px-3 pb-4 space-y-1.5">
                  {results.map(i => {
                    const up = isUp(i.code);
                    return (
                      <li key={i.code}>
                        <button type="button" onClick={() => pick(i.code)} className={`w-full flex items-center gap-3 p-2 rounded-2xl border text-right cursor-pointer transition-colors ${up ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-50' : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50'}`}>
                          <img src={imageOf(i.code)} alt="" loading="lazy" className="w-16 h-11 object-contain shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block font-mono font-black text-[15px] text-slate-900 dark:text-white" dir="ltr" style={{ textAlign: 'right' }}>{i.code}</span>
                            <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{i.cat}{i.group && ` · ${i.group}`}</span>
                          </span>
                          <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-full ${up ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                            {up ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{up ? 'محدثة' : 'غير محدثة'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {!results.length && <li className="py-10 text-center text-sm text-slate-400">لا توجد عربة بهذا الرقم</li>}
                </ul>
              </>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto vehicle-scroll px-5 pb-5">
                {/* كارت العربة: عنوانه أخضر إن كانت محدثة وأحمر إن لم تكن */}
                <div className={`rounded-2xl border overflow-hidden ${ok ? 'border-emerald-300 dark:border-emerald-800' : 'border-rose-300 dark:border-rose-800'}`}>
                  <div className={`flex items-center justify-between gap-2 px-4 py-2.5 text-white ${ok ? 'bg-gradient-to-l from-emerald-600 to-teal-500' : 'bg-gradient-to-l from-rose-600 to-red-500'}`}>
                    <span className="inline-flex items-center gap-1.5 text-sm font-black">{ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{ok ? 'محدثة' : 'غير محدثة'}</span>
                    {ok && (isUpdated(prof) && prof?.updatedAt
                      ? <span className="text-[11px] font-bold opacity-90">{fmtDate(prof.updatedAt)}{prof.by && ` · ${prof.by}`}</span>
                      : <span className="text-[11px] font-bold opacity-90">من كشف الخزانات</span>)}
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-slate-50/70 dark:bg-slate-800/40">
                    <img src={imageOf(sel.code, prof?.photo)} alt={`صورة العربة ${sel.code}`} className="w-32 h-24 object-contain shrink-0" />
                    <div className="min-w-0">
                      <div className="font-mono font-black text-3xl text-slate-900 dark:text-white" dir="ltr" style={{ textAlign: 'right' }}>{sel.code}</div>
                      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{sel.cat}</div>
                      {sel.group && <div className="text-[11.5px] text-slate-400 truncate">{sel.group}</div>}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-black text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5"><Container className="w-3.5 h-3.5" />عدد الخزانات</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(n => (
                      <button key={n} type="button" onClick={() => setCount(n)} className={`h-11 rounded-xl text-base font-black cursor-pointer transition-all ${count === n ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{n}</button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {['الخزان الرئيسي', 'الخزان الثاني', 'الخزان الثالث'].slice(0, count).map((label, k) => (
                    <label key={label} className="flex items-center gap-3 h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-indigo-400">
                      <span className="w-28 shrink-0 text-sm font-bold text-slate-600 dark:text-slate-300">{label}</span>
                      <input
                        inputMode="numeric"
                        value={caps[k]}
                        onChange={e => { const v = e.target.value.replace(/[^\d]/g, ''); setCaps(c => c.map((x, j) => (j === k ? v : x))); }}
                        placeholder="السعة"
                        className="flex-1 min-w-0 bg-transparent outline-none text-xl font-mono font-bold text-slate-900 dark:text-white text-left placeholder:font-cairo placeholder:text-sm placeholder:font-medium placeholder:text-slate-400"
                      />
                      <span className="text-xs font-bold text-slate-400">لتر</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-500 dark:text-slate-400">السعة الكلية</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">{total.toLocaleString()} <span className="font-cairo text-xs text-slate-400">لتر</span></span>
                </div>

                {confirming && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm vehicle-fade-in" role="alertdialog" aria-label="تأكيد تغيير السعات">
                    <div className="w-full max-w-sm rounded-3xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 shadow-2xl p-5 text-center">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center text-2xl font-black">!</div>
                      <div className="mt-3 text-lg font-black text-slate-900 dark:text-white">هل أنت متأكد؟</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">العربة <bdi dir="ltr" className="font-mono font-bold">{code}</bdi> محدثة، وستتغير سعات خزاناتها</div>
                      <div className="mt-4 space-y-1.5 text-sm">
                        {['الخزان الرئيسي', 'الخزان الثاني', 'الخزان الثالث'].map((label, k) => {
                          const was = k < orig.count ? orig.caps[k] : null;
                          const now = k < count ? nums[k] : null;
                          if (was === null && now === null) return null;
                          const diff = was !== now;
                          return (
                            <div key={label} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${diff ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                              <span className="font-bold text-slate-600 dark:text-slate-300">{label}</span>
                              <span className="font-mono font-bold" dir="ltr">
                                <span className={diff ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}>{was ?? '—'}</span>
                                {diff && <> → <span className="text-amber-700 dark:text-amber-300">{now ?? 'حذف'}</span></>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button type="button" onClick={submit} className="h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black cursor-pointer">نعم، متأكد</button>
                        <button type="button" onClick={() => setConfirming(false)} className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer">تراجع</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                  <button type="button" disabled={!valid} onClick={submit} className="h-12 rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-500 text-white text-base font-black shadow-md shadow-emerald-500/30 disabled:opacity-40 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed">حفظ</button>
                  <button type="button" onClick={() => setCode(null)} className="h-12 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer">عربة أخرى</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
