/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useState } from 'react';
import { Search, ChevronRight, ChevronLeft, Repeat2, ArrowUpDown } from 'lucide-react';
import { FREQUENT_DAYS, formatDay, type DayFill } from '../../lib/vehicleFuel';

const PAGE = 10;
type Sort = 'qty' | 'days' | 'vehicle' | 'date';

/** جدول التفويلات (عربة/يوم بعد الدمج): 10 سطور لكل صفحة */
export const RefillsTable: React.FC<{ fills: DayFill[]; onOpen: (v: string) => void }> = ({ fills, onOpen }) => {
  const [q, setQ] = useState('');
  const [onlyFrequent, setOnlyFrequent] = useState(false);
  const [sort, setSort] = useState<Sort>('qty');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const t = q.trim();
    let l = fills.filter(f => !t || f.vehicle.toLowerCase().includes(t.toLowerCase()) || f.drivers.some(d => d.includes(t)) || f.prevDriver.includes(t));
    if (onlyFrequent) l = l.filter(f => f.days !== null && f.days <= FREQUENT_DAYS);
    const by: Record<Sort, (a: DayFill, b: DayFill) => number> = {
      qty: (a, b) => b.qty - a.qty,
      days: (a, b) => (a.days ?? 99) - (b.days ?? 99) || b.qty - a.qty,
      vehicle: (a, b) => a.vehicle.localeCompare(b.vehicle, 'en', { numeric: true }),
      date: (a, b) => b.date.localeCompare(a.date) || b.qty - a.qty,
    };
    return [...l].sort(by[sort]);
  }, [fills, q, onlyFrequent, sort]);

  useEffect(() => setPage(0), [q, onlyFrequent, sort, fills]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);

  const th = (label: string, key?: Sort) => (
    <th className="py-2.5 px-3 font-bold whitespace-nowrap">
      {key ? (
        <button type="button" onClick={() => setSort(key)} className={`inline-flex items-center gap-1 cursor-pointer ${sort === key ? 'text-sky-600 dark:text-sky-400' : ''}`}>
          {label}<ArrowUpDown className="w-3 h-3" />
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="h-full rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-soft-card flex flex-col overflow-hidden">
      <div className="p-4 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white ml-auto">سجل التفويلات</h3>
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="عربة أو سائق" className="w-40 pr-8 pl-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-sky-500" />
        </div>
        <button
          type="button"
          onClick={() => setOnlyFrequent(v => !v)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${onlyFrequent ? 'bg-rose-500 text-white border-rose-500' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          <Repeat2 className="w-3.5 h-3.5" />المتكرر فقط
        </button>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
            <tr>
              {th('العربة', 'vehicle')}
              {th('السائق')}
              {th('الكمية', 'qty')}
              {th('التاريخ', 'date')}
              {th('الأيام', 'days')}
              {th('السابقة')}
              {th('تاريخها')}
              {th('السائق السابق')}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {view.map(f => {
              const freq = f.days !== null && f.days <= FREQUENT_DAYS;
              return (
                <tr key={f.vehicle + f.date} onClick={() => onOpen(f.vehicle)} className="hover:bg-sky-50/60 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                  <td className="py-2.5 px-3 font-mono font-black text-slate-900 dark:text-white" dir="ltr">
                    {f.vehicle}
                    {f.parts > 1 && <span className="mr-1 text-[9px] font-bold px-1 rounded bg-amber-500/15 text-amber-600" title={f.sites.join('، ')}>×{f.parts}</span>}
                  </td>
                  <td className="py-2.5 px-3 max-w-[9rem] truncate" title={f.drivers.join('، ')}>{f.drivers[0] || '—'}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-sky-700 dark:text-sky-400">{f.qty.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">{formatDay(f.date)}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded-md font-mono font-bold ${freq ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>{f.days ?? '—'}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">{f.prevQty?.toLocaleString() ?? '—'}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">{formatDay(f.prevDate)}</td>
                  <td className="py-2.5 px-3 max-w-[9rem] truncate text-slate-500">{f.prevDriver || '—'}</td>
                </tr>
              );
            })}
            {!view.length && (
              <tr><td colSpan={8} className="py-10 text-center text-slate-400">لا توجد تفويلات مطابقة</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
        <span>{rows.length} تفويلة</span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" aria-label="السابقة"><ChevronRight className="w-4 h-4" /></button>
          <span className="font-mono font-bold px-2">{page + 1} / {pages}</span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" aria-label="التالية"><ChevronLeft className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
