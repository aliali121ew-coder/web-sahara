/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, IdCard, Fuel, Hash, Timer, Repeat2, User, Container, ShieldCheck, Building2, StickyNote, Save } from 'lucide-react';
import { getProfile } from '../../lib/session';
import { FREQUENT_DAYS, VEHICLE_TYPES, formatDay, type VehicleProfile, type VehicleStat } from '../../lib/vehicleFuel';

export const emptyProfile = (vehicle: string): VehicleProfile => ({
  id: vehicle, type: '', tankLiters: null, dailyLimit: null, driver: '', department: '', notes: '', photo: '', updatedAt: '', by: '',
});

type Tab = 'info' | 'fills';

/**
 * قائمة سحب جانبية «تفاصيل العربة»: بيانات العربة (النوع، سعة الخزان، الحصة، السائق المعتمد، القسم)
 * وسجل تفويلاتها. التعديل لمن يملك صلاحية التعديل، والعرض للبقية.
 */
export const VehicleProfileEditor: React.FC<{
  stat: VehicleStat;
  profile: VehicleProfile | undefined;
  drivers: string[];
  editable: boolean;
  onSave: (p: VehicleProfile) => void;
  onClose: () => void;
}> = ({ stat, profile, drivers, editable, onSave, onClose }) => {
  const [p, setP] = useState<VehicleProfile>(profile || emptyProfile(stat.vehicle));
  const [tab, setTab] = useState<Tab>('info');
  const [closing, setClosing] = useState(false);
  const dirty = JSON.stringify(p) !== JSON.stringify(profile || emptyProfile(stat.vehicle));

  const close = () => { setClosing(true); window.setTimeout(onClose, 220); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)) || null);
  const save = () => {
    const u = getProfile();
    onSave({ ...p, driver: p.driver.trim(), department: p.department.trim(), notes: p.notes.trim(), updatedAt: new Date().toISOString(), by: u?.name || u?.username || '' });
  };

  const field = 'w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 transition-all';
  const label = 'text-[11px] font-black text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5';
  const overCap = (q: number) => !!p.tankLiters && q > p.tankLiters;

  // على body مباشرة: حركة دخول الصفحة (transform) تجعل fixed نسبيًا لها فتُقص القائمة
  return createPortal(
    <div className={`fixed inset-0 z-[1000] flex justify-start ${closing ? 'vehicle-fade-out' : 'vehicle-fade-in'}`} role="dialog" aria-modal="true" aria-label={`تفاصيل العربة ${stat.vehicle}`}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px]" onClick={close} />
      <aside className={`relative h-full w-full sm:w-[460px] bg-slate-50 dark:bg-slate-950 shadow-2xl flex flex-col ${closing ? 'vehicle-sheet-out' : 'vehicle-sheet-in'}`}>
        {/* الرأس */}
        <div className="relative overflow-hidden bg-slate-950 text-white px-5 pt-5 pb-4">
          <div className="absolute inset-0 vehicle-hero-grid opacity-60" />
          <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full bg-sky-500/25 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30"><IdCard className="w-5 h-5" /></span>
              <div>
                <div className="text-[11px] text-slate-400 font-bold">تفاصيل العربة</div>
                <div className="text-2xl font-black font-mono leading-tight" dir="ltr">{stat.vehicle}</div>
              </div>
            </div>
            <button type="button" onClick={close} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer" aria-label="إغلاق"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative grid grid-cols-4 gap-2 mt-4">
            {[
              { i: <Fuel className="w-3.5 h-3.5" />, v: stat.total.toLocaleString(), l: 'لتر' },
              { i: <Hash className="w-3.5 h-3.5" />, v: stat.count, l: 'تفويلة' },
              { i: <Timer className="w-3.5 h-3.5" />, v: stat.avgGap ?? '—', l: 'يوم بينها' },
              { i: <Repeat2 className="w-3.5 h-3.5" />, v: stat.frequent, l: 'متكرر' },
            ].map(c => (
              <div key={c.l} className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-center">
                <div className="flex justify-center text-sky-300 mb-1">{c.i}</div>
                <div className="text-sm font-black font-mono">{c.v}</div>
                <div className="text-[10px] text-slate-400">{c.l}</div>
              </div>
            ))}
          </div>
          <div className="relative flex gap-1 mt-4 p-1 rounded-xl bg-white/5 border border-white/10">
            {([['info', 'البيانات'], ['fills', `التفويلات (${stat.fills.length})`]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${tab === k ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}>{l}</button>
            ))}
          </div>
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' ? (
            <div className="space-y-4 vehicle-page">
              <div>
                <span className={label}><Hash className="w-3.5 h-3.5" />نوع العربة</span>
                <div className="flex flex-wrap gap-1.5">
                  {VEHICLE_TYPES.map(t => (
                    <button key={t} type="button" disabled={!editable} onClick={() => setP({ ...p, type: p.type === t ? '' : t })} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:cursor-default ${p.type === t ? 'bg-sky-500 border-sky-500 text-white shadow-md shadow-sky-500/25' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 enabled:hover:border-sky-400'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className={label}><Container className="w-3.5 h-3.5" />سعة الخزان (لتر)</span>
                  <input type="number" min={0} disabled={!editable} value={p.tankLiters ?? ''} onChange={e => setP({ ...p, tankLiters: num(e.target.value) })} className={field} placeholder="مثال: 400" />
                </label>
                <label>
                  <span className={label}><ShieldCheck className="w-3.5 h-3.5" />الحصة اليومية (لتر)</span>
                  <input type="number" min={0} disabled={!editable} value={p.dailyLimit ?? ''} onChange={e => setP({ ...p, dailyLimit: num(e.target.value) })} className={field} placeholder="اختياري" />
                </label>
              </div>
              <label className="block">
                <span className={label}><User className="w-3.5 h-3.5" />السائق المعتمد</span>
                <input list="vehicle-profile-drivers" disabled={!editable} value={p.driver} onChange={e => setP({ ...p, driver: e.target.value })} className={field} placeholder="اختر من سائقي الكشوف أو اكتب" />
                <datalist id="vehicle-profile-drivers">{drivers.map(d => <option key={d} value={d} />)}</datalist>
              </label>
              <label className="block">
                <span className={label}><Building2 className="w-3.5 h-3.5" />القسم / الموقع</span>
                <input disabled={!editable} value={p.department} onChange={e => setP({ ...p, department: e.target.value })} className={field} placeholder="مثال: قسم النقل" />
              </label>
              <label className="block">
                <span className={label}><StickyNote className="w-3.5 h-3.5" />ملاحظات</span>
                <textarea rows={3} disabled={!editable} value={p.notes} onChange={e => setP({ ...p, notes: e.target.value })} className={field} />
              </label>
              <p className="text-[11px] text-slate-500 leading-6 rounded-xl bg-sky-500/5 border border-sky-500/15 p-3">
                سعة الخزان والحصة اليومية والسائق المعتمد تُستخدم لكشف التفويل المخالف تلقائيًا وحساب مؤشر الانضباط.
              </p>
              {profile?.updatedAt && <p className="text-[10px] text-slate-400">آخر تعديل {new Date(profile.updatedAt).toLocaleString('en-GB')}{profile.by ? ` · ${profile.by}` : ''}</p>}
            </div>
          ) : (
            <ol className="relative space-y-3 pr-5 vehicle-page">
              <span className="absolute right-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-sky-500 via-indigo-400 to-slate-200 dark:to-slate-800" />
              {stat.fills.map((f, i) => {
                const freq = f.days !== null && f.days <= FREQUENT_DAYS;
                const cap = overCap(f.qty);
                return (
                  <li key={f.date} className="relative vehicle-kpi" style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}>
                    <span className={`absolute -right-5 top-3 w-4 h-4 rounded-full border-4 border-slate-50 dark:border-slate-950 ${cap ? 'bg-rose-600' : freq ? 'bg-rose-400' : 'bg-sky-500'}`} />
                    <div className={`rounded-2xl bg-white dark:bg-slate-900 border p-3 shadow-sm ${cap ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-800'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-500">{f.date}</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white">{f.qty.toLocaleString()} <span className="text-[10px] text-slate-400">L</span></span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 truncate"><User className="w-3 h-3 shrink-0" />{f.drivers.join('، ') || '—'}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-md font-bold ${freq ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>بعد {f.days ?? '—'} يوم</span>
                      </div>
                      {(cap || f.parts > 1) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cap && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500 text-white">فوق سعة الخزان</span>}
                          {f.parts > 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">{f.parts} تفويلات · {f.sites.join('، ')}</span>}
                        </div>
                      )}
                      {f.prevQty !== null && <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">السابقة {f.prevQty.toLocaleString()} L · {formatDay(f.prevDate)}{f.prevDriver ? ` · ${f.prevDriver}` : ''}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* الحفظ */}
        {editable && tab === 'info' && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
            <button type="button" onClick={close} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">إلغاء</button>
            <button type="button" onClick={save} disabled={!dirty} className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-sky-500 to-indigo-600 text-white text-sm font-black shadow-lg shadow-sky-500/25 disabled:opacity-40 disabled:shadow-none cursor-pointer transition-all">
              <Save className="w-4 h-4" />حفظ التفاصيل
            </button>
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
};
