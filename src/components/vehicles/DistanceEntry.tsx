/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Route, Search, X } from 'lucide-react';
import { getProfile } from '../../lib/session';
import type { VehicleRoute } from '../../lib/vehicleFuel';

export interface DistanceVehicle {
  vehicle: string;
  code: string;
  cat: string;
  /** الاستهلاك في الكشف — للترتيب مثل الطباعة */
  amount: number;
}

/** معرّف مسافة الفترة: إدخال واحد لكل عربة في كل فترة، يُستبدل عند التعديل */
const entryId = (vehicle: string, from: string, to: string) => `km-${vehicle}-${from}-${to}`;
/** عدد العربات المطبوعة في الكشف */
const PRINTED = 20;

/**
 * رفع المسافات المقطوعة للفترة المحددة قبل الطباعة: خانة لكل عربة (أعلى 20 أولًا كما في الكشف).
 * تُحفظ في مسارات العربات بتاريخ نهاية الفترة، فتظهر في عمود «المسافة المقطوعة».
 * يمكن لصق عمودين من Excel (رقم العربة ثم المسافة) في أي خانة لتعبئتها دفعة واحدة.
 */
export const DistanceEntry: React.FC<{
  vehicles: DistanceVehicle[];
  from: string;
  to: string;
  routes: VehicleRoute[];
  setRoutes: (next: (prev: VehicleRoute[]) => VehicleRoute[]) => void;
  onClose: () => void;
}> = ({ vehicles, from, to, routes, setRoutes, onClose }) => {
  const ranked = useMemo(() => [...vehicles].sort((a, b) => b.amount - a.amount), [vehicles]);
  const saved = useMemo(() => new Map(routes.map(r => [r.id, r])), [routes]);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(
    ranked.map(v => [v.vehicle, saved.get(entryId(v.vehicle, from, to))?.km?.toString() || '']),
  ));
  const [all, setAll] = useState(false);
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');

  /** مسافات أخرى مسجلة للعربة داخل الفترة (غير إدخال الفترة نفسه) */
  const other = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of routes) {
      if (r.date < from || r.date > to || r.id === entryId(r.vehicle, from, to)) continue;
      m.set(r.vehicle, (m.get(r.vehicle) || 0) + r.km);
    }
    return m;
  }, [routes, from, to]);

  const needle = q.trim().toLowerCase();
  const list = ranked
    .map((v, i) => ({ ...v, rank: i + 1 }))
    .filter(v => (all || needle ? true : v.rank <= PRINTED) && (!needle || `${v.code} ${v.vehicle} ${v.cat}`.toLowerCase().includes(needle)));

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const lines = e.clipboardData.getData('text').split(/\r?\n/).map(l => (l.includes('\t') ? l.split('\t') : l.split(/[;,]/)).map(c => c.trim())).filter(c => c.length >= 2 && c[0]);
    if (lines.length < 2) return;
    e.preventDefault();
    const byCode = new Map(ranked.flatMap(v => [[v.code.toLowerCase(), v.vehicle], [v.vehicle.toLowerCase(), v.vehicle]] as const));
    let hit = 0;
    const next = { ...vals };
    for (const [code, km] of lines) {
      const id = byCode.get(code.toLowerCase());
      const n = Number(km.replace(/,/g, ''));
      if (id && Number.isFinite(n) && n >= 0) { next[id] = String(Math.round(n)); hit++; }
    }
    setVals(next);
    setNote(`تمت تعبئة ${hit} من ${lines.length} سطر`);
  };

  const save = () => {
    const u = getProfile();
    const by = u?.name || u?.username || '';
    const at = new Date().toISOString();
    setRoutes(prev => {
      const ids = new Set(ranked.map(v => entryId(v.vehicle, from, to)));
      const kept = prev.filter(r => !ids.has(r.id));
      const added: VehicleRoute[] = ranked.flatMap(v => {
        const km = Math.round(Number(vals[v.vehicle]) || 0);
        if (km <= 0) return [];
        const id = entryId(v.vehicle, from, to);
        const old = saved.get(id);
        return [{ id, vehicle: v.vehicle, km, date: to, from: null, to: null, note: `مسافة الفترة ${from} – ${to}`, by: old && old.km === km ? old.by : by, createdAt: old && old.km === km ? old.createdAt : at }];
      });
      return [...added, ...kept];
    });
    onClose();
  };

  const filled = ranked.filter(v => Number(vals[v.vehicle]) > 0).length;
  const total = ranked.reduce((s, v) => s + (Number(vals[v.vehicle]) || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 font-cairo vehicle-fade-in" role="dialog" aria-modal="true" aria-label="المسافات المقطوعة" dir="rtl">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"><Route className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base text-slate-900 dark:text-white">المسافات المقطوعة</h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">الفترة <bdi dir="ltr" className="font-mono">{from} ← {to}</bdi></p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 pb-2 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث برقم العربة" className="w-full h-10 ps-9 pe-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-hidden focus:border-emerald-400" />
            </div>
            <div role="group" className="flex gap-0.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {[[false, `أعلى ${PRINTED}`], [true, 'الكل']].map(([v, l]) => (
                <button key={String(v)} type="button" aria-pressed={all === v} onClick={() => setAll(v as boolean)} className={`h-8 px-3 rounded-lg text-xs font-bold cursor-pointer ${all === v ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-500'}`}>{l as string}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] font-semibold text-slate-400">{note || 'تُطبع أعلى 20 عربة. يمكن لصق عمودين من Excel (رقم العربة ثم المسافة) في أي خانة'}</p>
        </div>

        <ol className="flex-1 overflow-y-auto vehicle-scroll px-4 pb-3 space-y-1.5">
          {list.map(v => (
            <li key={v.vehicle} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 px-3 py-2">
              <span className={`w-6 h-6 shrink-0 rounded-full inline-flex items-center justify-center text-[11px] font-black ${v.rank <= PRINTED ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{v.rank}</span>
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm text-slate-900 dark:text-white font-mono" dir="ltr" style={{ textAlign: 'right' }}>{v.code}</div>
                <div className="text-[11px] font-bold text-slate-400 truncate">{v.cat} · <bdi className="font-mono">{Math.round(v.amount).toLocaleString()}</bdi> لتر{other.get(v.vehicle) ? <> · مسجلة <bdi className="font-mono">{other.get(v.vehicle)!.toLocaleString()}</bdi> كم</> : null}</div>
              </div>
              <div className="relative w-28 shrink-0">
                <input
                  inputMode="numeric"
                  value={vals[v.vehicle] ?? ''}
                  onChange={e => setVals(s => ({ ...s, [v.vehicle]: e.target.value.replace(/[^\d]/g, '') }))}
                  onPaste={onPaste}
                  placeholder="0"
                  aria-label={`المسافة للعربة ${v.code}`}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black font-mono text-right outline-hidden focus:border-emerald-400"
                  dir="ltr"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">كم</span>
              </div>
            </li>
          ))}
          {!list.length && <li className="text-xs text-slate-400 text-center py-6">لا توجد عربات</li>}
        </ol>

        <div className="flex items-center gap-3 p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex-1 text-xs font-bold text-slate-500"><bdi className="font-mono text-slate-900 dark:text-white">{filled}</bdi> عربة · <bdi className="font-mono text-slate-900 dark:text-white">{total.toLocaleString()}</bdi> كم</div>
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">إلغاء</button>
          <button type="button" onClick={save} className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black cursor-pointer">حفظ المسافات</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
