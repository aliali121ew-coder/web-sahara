/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Truck, FileText, Fuel, Gauge, Trophy, TrendingUp, TrendingDown, Repeat2, Upload, X, Trash2, Loader2,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { usePermissions } from '../../lib/usePermission';
import { useFuelNav } from '../../context/FuelDataContext';
import { FREQUENT_DAYS, formatDay } from '../../lib/vehicleFuel';
import { DateField } from '../ui/DateField';
import { useVehicleData, type Scope, type UploadResult } from './useVehicleData';
import { VehicleMap } from './VehicleMap';
import { TopVehicleCards } from './TopVehicleCards';
import { RefillsTable } from './RefillsTable';
import { FuelChart } from './FuelChart';
import { VehicleDetailPage } from './VehicleDetailPage';
import './vehicles.css';

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub: React.ReactNode; tone: string; onClick?: () => void }> = ({ icon, label, value, sub, tone, onClick }) => (
  <div
    onClick={onClick}
    className={`vehicle-kpi relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-soft-card ${onClick ? 'cursor-pointer hover:border-sky-400' : ''}`}
  >
    <div className={`absolute -top-8 -left-8 w-24 h-24 rounded-full blur-2xl opacity-20 ${tone}`} />
    <div className="flex items-center justify-between mb-2 relative">
      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">{label}</span>
      <span className={`p-1.5 rounded-xl text-white ${tone}`}>{icon}</span>
    </div>
    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono relative truncate">{value}</div>
    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1 relative truncate">{sub}</div>
  </div>
);

export const VehiclesReport: React.FC = () => {
  const { canEdit } = usePermissions();
  const editable = canEdit('vehicles-report');
  const [scope, setScope] = useState<Scope | null>(null);
  const data = useVehicleData(scope);
  const { files, dates, active, fills, stats, history, prevDay, prevTotal, allFills } = data;

  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const doUpload = async (list: FileList | File[] | null) => {
    const pdfs = [...(list || [])].filter(f => /\.pdf$/i.test(f.name));
    if (!pdfs.length) return;
    setBusy(true);
    try {
      setResults(await data.upload(pdfs));
      setScope(null);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const k = useMemo(() => {
    const total = fills.reduce((s, f) => s + f.qty, 0);
    const top = fills.reduce<(typeof fills)[number] | null>((m, f) => (!m || f.qty > m.qty ? f : m), null);
    const frequentVehicles = new Set(fills.filter(f => f.days !== null && f.days <= FREQUENT_DAYS).map(f => f.vehicle));
    const change = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null;
    return { total, top, frequent: frequentVehicles.size, change, avg: fills.length ? Math.round(total / fills.length) : 0 };
  }, [fills, prevTotal]);

  const selected = vehicle ? history.get(vehicle) : undefined;

  // زر الرفع: يُضغط لاختيار الملفات أو تُسحب الملفات وتُفلت عليه
  const uploadBtn = editable && (
    <>
      <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => doUpload(e.target.files)} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); void doUpload(e.dataTransfer.files); }}
        className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-dashed text-sm font-black transition-all cursor-pointer disabled:opacity-60 ${
          drag
            ? 'border-sky-500 bg-sky-500 text-white scale-105 shadow-lg shadow-sky-500/30'
            : 'border-sky-400/70 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40'
        }`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {drag ? 'أفلت الملفات هنا' : 'رفع كشوف PDF أو اسحبها هنا'}
      </button>
    </>
  );

  const dateSet = useMemo(() => new Set(dates), [dates]);

  // صفحة العربة الكاملة: مسار التنقل في الأعلى وزر الرجوع يعيدان للتقرير
  const { setCurrentSubpage } = useFuelNav();
  useEffect(() => {
    if (!selected) return;
    setCurrentSubpage({ title: `العربة ${selected.vehicle}`, parentTab: 'vehicles-report', onBack: () => setVehicle(null) });
    return () => setCurrentSubpage(null);
  }, [selected?.vehicle, setCurrentSubpage]);

  const ranking = useMemo(() => [...history.values()].sort((a, b) => b.total - a.total).map(s => s.vehicle), [history]);
  const fleet = useMemo(() => {
    const total = allFills.reduce((s, f) => s + f.qty, 0);
    return { total, avg: allFills.length ? Math.round(total / allFills.length) : 0 };
  }, [allFills]);

  if (selected) {
    return (
      <VehicleDetailPage
        stat={selected}
        ranking={ranking}
        fleetAvg={fleet.avg}
        fleetTotal={fleet.total}
        vehicles={ranking}
        editable={editable}
        onBack={() => setVehicle(null)}
        onOpen={setVehicle}
      />
    );
  }

  return (
    <div className="space-y-5 pb-12 font-cairo">
      {/* أدوات الصفحة: التاريخ الموحّد، الملفات، الرفع */}
      <div className="flex flex-wrap items-center gap-2">
        {dates.length > 0 && (
          <>
            <DateField
              value={active.kind === 'day' ? active.date : ''}
              onChange={v => setScope({ kind: 'day', date: v })}
              marked={dateSet}
              onlyMarked
              min={dates[0]}
              max={dates[dates.length - 1]}
              placeholder="كل الفترة"
              ariaLabel="تاريخ الكشف"
              iconClassName="text-sky-600"
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold font-mono text-slate-700 dark:text-slate-200 shadow-xs"
            />
            <button
              type="button"
              onClick={() => setScope({ kind: 'all' })}
              className={`px-3.5 py-2 rounded-2xl text-sm font-bold border transition-all cursor-pointer ${active.kind === 'all' ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              كل الفترة
            </button>
          </>
        )}
        <div className="flex items-center gap-2 mr-auto">
          <button type="button" onClick={() => setShowFiles(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-sky-400 cursor-pointer">
            <FileText className="w-4 h-4 text-sky-500" />الملفات ({files.length})
          </button>
          {uploadBtn}
        </div>
      </div>

      {results && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 dark:text-slate-200">نتيجة الرفع</span>
            <button type="button" onClick={() => setResults(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="إغلاق"><X className="w-4 h-4" /></button>
          </div>
          {results.map(r => (
            <div key={r.name} className={`flex items-start gap-2 text-xs ${r.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {r.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span><b>{r.name}</b> — {r.message}</span>
            </div>
          ))}
        </div>
      )}

      {!allFills.length ? (
        <div className={`rounded-3xl border-2 border-dashed p-12 text-center transition-colors ${drag ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-sky-500/30 vehicle-float">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">لا توجد كشوف بعد</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 mb-5">
            {editable ? 'اسحب ملفات «كشف مطابقة الكاز» هنا أو ارفعها — يمكن رفع عدة ملفات معًا' : 'لم يرفع أحد كشوف العربات بعد'}
          </p>
          <div className="inline-flex">{uploadBtn}</div>
        </div>
      ) : (
        <>
          {/* الكارتات */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi tone="bg-sky-500" icon={<Truck className="w-4 h-4" />} label="إجمالي العربات" value={stats.length} sub={active.kind === 'day' ? `يوم ${formatDay(active.date)}` : `${dates.length} يوم`} />
            <Kpi tone="bg-indigo-500" icon={<Fuel className="w-4 h-4" />} label="إجمالي التفويلات" value={k.total.toLocaleString()} sub={`لتر · ${fills.length} تفويلة`} />
            <Kpi tone="bg-violet-500" icon={<Gauge className="w-4 h-4" />} label="متوسط التفويلة" value={k.avg.toLocaleString()} sub="لتر للتفويلة" />
            <Kpi tone="bg-amber-500" icon={<Trophy className="w-4 h-4" />} label="أعلى تفويلة" value={k.top ? k.top.qty.toLocaleString() : '—'} sub={k.top ? <span dir="ltr">عربة {k.top.vehicle}</span> : '—'} onClick={k.top ? () => setVehicle(k.top!.vehicle) : undefined} />
            <Kpi
              tone={k.change === null ? 'bg-slate-400' : k.change > 0 ? 'bg-rose-500' : 'bg-emerald-500'}
              icon={k.change !== null && k.change < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              label="مقارنة باليوم السابق"
              value={k.change === null ? '—' : <span dir="ltr">{k.change > 0 ? '+' : ''}{k.change}%</span>}
              sub={prevDay ? `عن ${formatDay(prevDay)} (${prevTotal?.toLocaleString()} لتر)` : active.kind === 'all' ? 'اختر يومًا للمقارنة' : 'لا يوجد كشف لليوم السابق'}
            />
            <Kpi tone="bg-rose-500" icon={<Repeat2 className="w-4 h-4" />} label="تفويل متكرر" value={k.frequent} sub={`عربة خلال ${FREQUENT_DAYS} يوم أو أقل`} />
          </div>

          {/* الخريطة 30% + أعلى الاستهلاك */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-stretch">
            <div className="lg:col-span-3"><VehicleMap date={active.kind === 'day' ? active.date : null} vehicles={stats.map(s => s.vehicle)} editable={editable} /></div>
            <div className="lg:col-span-7"><TopVehicleCards stats={stats} onOpen={setVehicle} /></div>
          </div>

          {/* الجدول 50% + الرسم 50% */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
            <RefillsTable fills={fills} onOpen={setVehicle} />
            <FuelChart stats={stats} allFills={allFills} />
          </div>
        </>
      )}

      {/* نافذة الملفات */}
      {showFiles && (
        <div className="fixed inset-0 z-50 flex justify-start bg-slate-950/50 backdrop-blur-sm" onClick={() => setShowFiles(false)}>
          <div className="vehicle-drawer w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white">الكشوف المرفوعة</h3>
              <button type="button" onClick={() => setShowFiles(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="إغلاق"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-2">
              {[...files].sort((a, b) => b.reportDate.localeCompare(a.reportDate)).map(f => (
                <div key={f.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex items-start gap-3">
                  <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500"><FileText className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{f.site} · <span className="font-mono">{f.reportDate}</span>{f.docNo && <span className="text-[10px] text-slate-400"> · مستند {f.docNo}</span>}{f.dateSource === 'notes' && <span className="mr-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">التاريخ من الملاحظات</span>}</div>
                    <div className="text-[11px] text-slate-500 truncate">{f.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{f.rows} سطر · {f.totalQty.toLocaleString()} لتر · رُفع {new Date(f.uploadedAt).toLocaleString('en-GB')}{f.by ? ` · ${f.by}` : ''}</div>
                  </div>
                  {editable && (
                    <button type="button" onClick={() => { if (window.confirm(`حذف كشف ${f.site} ليوم ${f.reportDate}؟`)) data.removeFile(f.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              {!files.length && <p className="text-sm text-slate-400 text-center py-8">لا توجد ملفات</p>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VehiclesReport;
