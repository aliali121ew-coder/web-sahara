/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Layers, Search } from 'lucide-react';
import { FREQUENT_DAYS } from '../../lib/vehicleFuel';
import { vehicleCard } from './VehicleCharts';

export interface RefillRow {
  key: string;
  date: string;
  qty: number;
  /** عدد الأيام كما في الكشف */
  days: number | null;
  /** الفاصل المحسوب من تواريخ التفويل المرفوعة */
  gap: number | null;
  driver: string;
  site: string;
  prevQty: number | null;
  prevSite: string;
  /** عدد تفويلات هذا اليوم */
  parts: number;
}

const PAGE_SIZE = 15;
const ALL = 'الكل';
type Tab = 'all' | 'frequent' | 'multi' | 'violations';

const isFrequent = (r: RefillRow) => r.days !== null && r.days <= FREQUENT_DAYS;

const Select: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
    <span className="font-bold text-slate-400">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer max-w-[160px] truncate font-cairo">
      {[ALL, ...options].map(o => <option key={o} value={o} className="bg-white dark:bg-slate-900">{o}</option>)}
    </select>
  </div>
);

/** سجل التفويل: تبويبات وفلاتر بطابع صفحة الوارد، وكل صفحة 15 سطرًا */
export const VehicleRefillTable: React.FC<{ rows: RefillRow[]; vehicle: string; overCap: Set<string>; violationDates: Set<string> }> = ({ rows, vehicle, overCap, violationDates }) => {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [site, setSite] = useState(ALL);
  const [driver, setDriver] = useState(ALL);
  const [page, setPage] = useState(1);

  const sites = useMemo(() => [...new Set(rows.map(r => r.site).filter(Boolean))].sort(), [rows]);
  const drivers = useMemo(() => [...new Set(rows.map(r => r.driver).filter(Boolean))].sort(), [rows]);
  const tabs: [Tab, string, RefillRow[]][] = [
    ['all', 'الكل', rows],
    ['frequent', 'المتكرر', rows.filter(isFrequent)],
    ['multi', 'أكثر من تفويلة باليوم', rows.filter(r => r.parts > 1)],
    ['violations', 'مخالفات الملف', rows.filter(r => violationDates.has(r.date))],
  ];
  const q = search.trim();
  const shown = (tabs.find(t => t[0] === tab)?.[2] ?? rows).filter(r =>
    (site === ALL || r.site === site) && (driver === ALL || r.driver === driver)
    && (!q || [r.site, r.prevSite, r.driver, r.date, String(r.qty)].some(v => v.includes(q))));

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  useEffect(() => setPage(1), [tab, q, site, driver, rows]);
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE_SIZE;
  const view = shown.slice(start, start + PAGE_SIZE);
  const span = Math.min(10, pages);
  const first = Math.min(Math.max(1, current - Math.floor(span / 2)), pages - span + 1);
  const pageBtn = (off: boolean) => `px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${off ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer'}`;

  return (
    <div className={`${vehicleCard} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500" />سجل التفويل</h3>
        <div role="tablist" aria-label="تصفية السجل" className="flex gap-5 overflow-x-auto vehicle-scroll">
          {tabs.map(([k, l, list]) => {
            const on = tab === k;
            return (
              <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)} className={`h-14 inline-flex items-center gap-1.5 border-b-2 text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${on ? 'border-indigo-600 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                {l}<span className={`px-1.5 py-px rounded-full text-[11px] font-mono transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{list.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* شريط الفلاتر مثل صفحة الوارد */}
      <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالموقع أو السائق أو الكمية" className="w-full pr-9 pl-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-cairo" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select label="الموقع:" value={site} options={sites} onChange={setSite} />
          <Select label="السائق:" value={driver} options={drivers} onChange={setDriver} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-gradient-to-r from-[#1c3b6f] via-[#244e91] to-[#1c3b6f] text-white font-black text-[11.5px] select-none">
              {['العربة', 'الكمية السابقة', 'عدد الأيام', 'التاريخ', 'الموقع السابق', 'الكمية', 'الفاصل', 'الموقع'].map(h => <th key={h} className="py-3 px-4 whitespace-nowrap font-cairo">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {view.map((f, i) => {
              const near = f.gap !== null && f.gap <= FREQUENT_DAYS;
              return (
                <tr key={f.key} className={`border-b border-slate-100 dark:border-slate-800/60 hover:bg-sky-50/60 dark:hover:bg-slate-800/40 transition-colors ${i % 2 ? 'bg-slate-50/70 dark:bg-slate-900/40' : ''}`}>
                  <td className="py-2 px-4 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white"><bdi>{vehicle}</bdi></td>
                  <td className="py-2 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">{f.prevQty === null ? <span className="text-slate-400">—</span> : <>{f.prevQty.toLocaleString()} <span className="font-cairo text-[11px] font-bold text-slate-400">لتر</span></>}</td>
                  <td className="py-2 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">{f.days ?? <span className="text-slate-400">—</span>}</td>
                  <td className="py-2 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-300">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" /><span>{f.date}</span>
                      {f.parts > 1 && <span className="text-[10px] font-bold px-1.5 py-px rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" title="عدد تفويلات هذا اليوم">{f.parts} باليوم</span>}
                      {overCap.has(f.date) ? <span className="text-[10px] font-bold px-1.5 py-px rounded-md bg-rose-500 text-white">فوق السعة</span>
                        : violationDates.has(f.date) && <span className="text-[10px] font-bold px-1.5 py-px rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">مخالفة</span>}
                    </div>
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">{f.prevSite || <span className="text-slate-400">—</span>}</td>
                  <td className="py-2 px-4 whitespace-nowrap font-mono text-[13px] font-semibold text-slate-900 dark:text-white">{f.qty.toLocaleString()} <span className="font-cairo text-[11px] font-bold text-slate-400">لتر</span></td>
                  <td className="py-2 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                      {f.gap !== null && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${near ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`} />}
                      {f.gap === null ? <span className="text-slate-400">—</span> : f.gap === 0 ? 'اليوم نفسه' : <>بعد <bdi className="font-mono">{f.gap}</bdi> يوم</>}
                    </span>
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">{f.site}</td>
                </tr>
              );
            })}
            {!view.length && <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-400">لا توجد تفويلات مطابقة</td></tr>}
          </tbody>
        </table>
      </div>

      {shown.length > 0 && (
        <div className="p-3 sm:p-4 bg-slate-50/90 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            عرض <span className="font-sans font-black text-blue-600 dark:text-blue-400">{start + 1}</span> - <span className="font-sans font-black text-blue-600 dark:text-blue-400">{start + view.length}</span> من أصل <span className="font-sans font-black text-slate-900 dark:text-white">{shown.length}</span> تفويلة
          </div>
          {pages > 1 && (
            <div className="flex items-center gap-1.5 select-none">
              <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className={pageBtn(current === 1)}><ChevronRight className="w-3.5 h-3.5" />السابق</button>
              <div className="flex items-center gap-1">
                {Array.from({ length: span }, (_, i) => first + i).map(n => (
                  <button key={n} type="button" onClick={() => setPage(n)} className={`w-8 h-8 rounded-xl font-sans font-black text-xs transition-all cursor-pointer ${n === current ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>{n}</button>
                ))}
              </div>
              <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className={pageBtn(current === pages)}>التالي<ChevronLeft className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
