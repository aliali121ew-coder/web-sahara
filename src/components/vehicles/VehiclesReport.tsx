/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Truck, FileText, Fuel, Gauge, Trophy, TrendingUp, TrendingDown, Repeat2, Upload, Loader2, ChartLine,
} from 'lucide-react';
import { usePermissions } from '../../lib/usePermission';
import { useFuelNav } from '../../context/FuelDataContext';
import { FREQUENT_DAYS, categoryLabel, formatDay } from '../../lib/vehicleFuel';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import { useVehicleData, type Scope } from './useVehicleData';
import { UploadPanel, type QueueItem } from './UploadPanel';
import { FilesDrawer } from './FilesDrawer';
import { ConsumptionAnalysis } from './ConsumptionAnalysis';
import { VehicleCrumbs, type Crumb } from './VehicleCrumbs';
import { useCategoryNames } from './categories';
import { CategoryDonut } from './CategoryDonut';
import { TopSevenCard } from './TopSevenCard';
import { TopVehicleCards } from './TopVehicleCards';
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
  const { recentFiles, dates, active, fills, stats, history, prevDay, prevTotal, allFills } = data;

  const [busy, setBusy] = useState(false);
  // ملفات الرفع الحالية وحالة كل ملف: تظهر في لوحة الرفع وعددها على زر الرفع
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [analysis, setAnalysis] = useState(false);
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  // الفئة المفتوحة في كارت الفئات: الدائرة وكارت الأعلى استهلاكًا يتبعانها
  const [category, setCategory] = useState<string | null>(null);
  /** يرفع الملفات واحدًا تلو الآخر ليظهر تقدّم كل ملف في لوحة الرفع */
  const doUpload = async (pdfs: File[], fallbackDate: string) => {
    if (busy) return;
    setBusy(true);
    setQueue(pdfs.map(f => ({ name: f.name, state: 'wait', message: '' })));
    try {
      for (let i = 0; i < pdfs.length; i++) {
        setQueue(q => q.map((x, j) => (j === i ? { ...x, state: 'read' } : x)));
        const [r] = await data.upload([pdfs[i]], fallbackDate);
        setQueue(q => q.map((x, j) => (j === i ? { ...x, state: r.ok ? 'ok' : 'err', message: r.message } : x)));
      }
      setScope(null);
    } finally {
      setBusy(false);
    }
  };
  // إغلاق اللوحة بعد اكتمال الرفع يمسح قائمة الملفات؛ وإن أُخفيت أثناء الرفع تُمسح بعد انتهائه بقليل
  const closePanel = () => { setPanelOpen(false); if (!busy) setQueue([]); };
  useEffect(() => {
    if (busy || panelOpen || !queue.length) return;
    const t = window.setTimeout(() => setQueue([]), 6000);
    return () => window.clearTimeout(t);
  }, [busy, panelOpen, queue.length]);

  const k = useMemo(() => {
    const total = fills.reduce((s, f) => s + f.qty, 0);
    const top = fills.reduce<(typeof fills)[number] | null>((m, f) => (!m || f.qty > m.qty ? f : m), null);
    const frequentVehicles = new Set(fills.filter(f => f.days !== null && f.days <= FREQUENT_DAYS).map(f => f.vehicle));
    const change = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null;
    return { total, top, frequent: frequentVehicles.size, change, avg: fills.length ? Math.round(total / fills.length) : 0 };
  }, [fills, prevTotal]);

  const selected = vehicle ? history.get(vehicle) : undefined;

  // زر الرفع المختصر: يفتح لوحة الرفع (وسحب الملفات فوقه يفتحها أيضًا)، ويعرض عدد ملفات الرفع الجارية
  const queueDone = queue.filter(q => q.state === 'ok' || q.state === 'err').length;
  const uploadBtn = editable && (
    <button
      type="button"
      aria-expanded={panelOpen}
      onClick={() => setPanelOpen(true)}
      onDragEnter={e => { e.preventDefault(); setPanelOpen(true); }}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-black text-white bg-sky-600 hover:bg-sky-700 shadow-sm shadow-sky-600/30 transition-all cursor-pointer ${panelOpen ? 'ring-4 ring-sky-500/20' : ''}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
      رفع الملفات
      {queue.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-mono" role="status">{queueDone}/{queue.length}</span>}
    </button>
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

  // صفحة تحليل الاستهلاك: مسار التنقل يعيد للتقرير (وصفحة العربة فوقها تعيد إليها)
  useEffect(() => {
    if (!analysis || selected) return;
    setCurrentSubpage({ title: 'تحليل الاستهلاك', parentTab: 'vehicles-report', onBack: () => setAnalysis(false) });
    return () => setCurrentSubpage(null);
  }, [analysis, selected, setCurrentSubpage]);

  const vehicleRefills = useMemo(() => (vehicle ? data.refills.filter(r => r.vehicle === vehicle) : []), [data.refills, vehicle]);

  // مسار الصفحات: تقرير العربات › [الفئة | تحليل الاستهلاك] › العربة
  const [catLabels] = useCategoryNames();
  const home = () => { setVehicle(null); setAnalysis(false); setCategory(null); };
  const crumbs: Crumb[] = [{ label: 'تقرير العربات', onClick: home }];
  if (analysis && dates.length) crumbs.push({ label: 'تحليل الاستهلاك', onClick: () => setVehicle(null) });
  else if (category) crumbs.push({ label: catLabels[category] || categoryLabel(category) || 'أخرى', onClick: () => setVehicle(null) });
  if (selected) crumbs.push({ label: <>العربة <bdi dir="ltr" className="font-mono">{selected.vehicle}</bdi></> });

  if (selected) {
    return (
      <div className="space-y-3">
        <VehicleCrumbs items={crumbs} />
        <VehicleDetailPage
          stat={selected}
          refills={vehicleRefills}
          ranking={ranking}
          fleetAvg={fleet.avg}
          fleetTotal={fleet.total}
          vehicles={ranking}
          editable={editable}
          backLabel={analysis && dates.length ? 'تحليل الاستهلاك' : 'تقرير العربات'}
          onBack={() => setVehicle(null)}
          onOpen={setVehicle}
        />
      </div>
    );
  }

  if (analysis && dates.length) {
    const end = active.kind === 'day' ? active.date : active.kind === 'range' ? active.to : dates[dates.length - 1];
    return (
      <div className="space-y-3">
        <VehicleCrumbs items={crumbs} />
        <ConsumptionAnalysis allFills={allFills} endDate={end} onOpen={setVehicle} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12 font-cairo">
      <VehicleCrumbs items={crumbs} />
      {/* أدوات الصفحة: تحليل الاستهلاك يمينًا، ثم التاريخ والملفات والرفع */}
      <div className="flex flex-wrap items-center gap-2">
        {dates.length > 0 && (
          <button
            type="button"
            onClick={() => setAnalysis(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-md shadow-indigo-600/30 transition-all hover:-translate-y-px cursor-pointer"
          >
            <ChartLine className="w-4 h-4" />تحليل الاستهلاك
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2 mr-auto">
        {dates.length > 0 && (
          <>
            {/* التاريخ: يوم واحد أو فترة «من – إلى» بنفس تقويم صفحة الوارد */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRangeOpen(o => !o)}
                aria-label="تاريخ الكشف"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-sm font-bold font-mono shadow-xs cursor-pointer transition-all ${active.kind !== 'all' ? 'bg-white dark:bg-slate-900 border-sky-400 text-slate-800 dark:text-slate-100' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
              >
                <CalendarDays className="w-4 h-4 text-sky-600" />
                {active.kind === 'day' ? active.date : active.kind === 'range' ? `${active.from} ← ${active.to}` : 'اختر يومًا أو فترة'}
              </button>
              {rangeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRangeOpen(false)} />
                  <div className="absolute z-50 top-full mt-2 right-0">
                    <DateRangeCalendar
                      from={active.kind === 'day' ? active.date : active.kind === 'range' ? active.from : ''}
                      to={active.kind === 'day' ? active.date : active.kind === 'range' ? active.to : ''}
                      marked={dateSet}
                      min={dates[0]}
                      max={dates[dates.length - 1]}
                      onApply={(from, to) => { setScope(!to || from === to ? { kind: 'day', date: from } : { kind: 'range', from, to }); setRangeOpen(false); }}
                      onClear={() => { setScope({ kind: 'all' }); setRangeOpen(false); }}
                    />
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setScope({ kind: 'all' })}
              className={`px-3.5 py-2 rounded-2xl text-sm font-bold border transition-all cursor-pointer ${active.kind === 'all' ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              كل الفترة
            </button>
          </>
        )}
          <span className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button type="button" onClick={() => setShowFiles(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-sky-400 cursor-pointer">
            <FileText className="w-4 h-4 text-sky-500" />الملفات
            <span className="min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 text-xs font-black font-mono">{recentFiles.length}</span>
          </button>
          {uploadBtn}
        </div>
      </div>

      {!allFills.length ? (
        <div className="rounded-3xl border-2 border-dashed p-12 text-center border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
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
            <Kpi tone="bg-sky-500" icon={<Truck className="w-4 h-4" />} label="إجمالي العربات" value={stats.length} sub={active.kind === 'day' ? `يوم ${formatDay(active.date)}` : active.kind === 'range' ? `${formatDay(active.from)} ← ${formatDay(active.to)}` : `${dates.length} يوم`} />
            <Kpi tone="bg-indigo-500" icon={<Fuel className="w-4 h-4" />} label="إجمالي التفويلات" value={k.total.toLocaleString()} sub={`لتر · ${fills.length} تفويلة`} />
            <Kpi tone="bg-violet-500" icon={<Gauge className="w-4 h-4" />} label="متوسط التفويلة" value={k.avg.toLocaleString()} sub="لتر للتفويلة" />
            <Kpi tone="bg-amber-500" icon={<Trophy className="w-4 h-4" />} label="أعلى تفويلة" value={k.top ? k.top.qty.toLocaleString() : '—'} sub={k.top ? <span dir="ltr">عربة {k.top.vehicle}</span> : '—'} onClick={k.top ? () => setVehicle(k.top!.vehicle) : undefined} />
            <Kpi
              tone={k.change === null ? 'bg-slate-400' : k.change > 0 ? 'bg-rose-500' : 'bg-emerald-500'}
              icon={k.change !== null && k.change < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              label="مقارنة باليوم السابق"
              value={k.change === null ? '—' : <span dir="ltr">{k.change > 0 ? '+' : ''}{k.change}%</span>}
              sub={prevDay ? `عن ${formatDay(prevDay)} (${prevTotal?.toLocaleString()} لتر)` : active.kind === 'day' ? 'لا يوجد كشف لليوم السابق' : 'اختر يومًا للمقارنة'}
            />
            <Kpi tone="bg-rose-500" icon={<Repeat2 className="w-4 h-4" />} label="تفويل متكرر" value={k.frequent} sub={`عربة خلال ${FREQUENT_DAYS} يوم أو أقل`} />
          </div>

          {/* دائرة الفئات وأعلى 7 (30%) + فئات العربات */}
          {/* العمود الجانبي لا يتجاوز كارت الفئات: على الشاشة الواسعة يأخذ ارتفاعه ولا يحدده */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-stretch">
            <div className="lg:col-span-3 relative lg:min-h-[820px]">
              <div className="flex flex-col gap-5 lg:absolute lg:inset-0">
              <CategoryDonut stats={stats} category={category} />
              <TopSevenCard stats={stats} category={category} onOpen={setVehicle} />
              </div>
            </div>
            <div className="lg:col-span-7"><TopVehicleCards stats={stats} onOpen={setVehicle} selected={category} onSelect={setCategory} /></div>
          </div>
        </>
      )}

      {showFiles && (
        <FilesDrawer
          files={recentFiles}
          editable={editable}
          onRemove={data.removeFile}
          onUpload={() => { setShowFiles(false); setPanelOpen(true); }}
          onClose={() => setShowFiles(false)}
        />
      )}
      {panelOpen && (
        <UploadPanel
          queue={queue}
          busy={busy}
          onFiles={(f, d) => void doUpload(f, d)}
          onClose={closePanel}
          onShowFiles={() => { closePanel(); setShowFiles(true); }}
        />
      )}
    </div>
  );
};

export default VehiclesReport;
