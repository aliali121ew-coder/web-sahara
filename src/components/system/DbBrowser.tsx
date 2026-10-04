import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Search, Lock, KeyRound, ChevronRight, ChevronLeft, RefreshCw, Table2, Eye } from 'lucide-react';
import { systemApi, fmtNum, type TablePage } from './systemApi';
import { TABLE_LABELS } from './systemUi';
import { Empty, Skeleton, cardCls, inputCls } from '../admin/adminUi';

const useDebounced = <T,>(v: T, ms = 350) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

const cell = (v: unknown) => {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300 dark:text-slate-600">—</span>;
  if (typeof v === 'number') {
    // أرقام تشبه الوقت بالمللي ثانية تُعرض كتاريخ
    if (v > 1_500_000_000_000 && v < 4_000_000_000_000) return <span title={String(v)}>{new Date(v).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</span>;
    return <span className="tabular-nums">{fmtNum(v)}</span>;
  }
  const s = String(v);
  if (s.startsWith('•••• ')) return <span className="inline-flex items-center gap-1 text-slate-400"><Lock className="w-3 h-3" />مخفي</span>;
  return s;
};

/** متصفح جداول D1 للقراءة فقط: الحقول السرّية مخفية والنصوص الطويلة مختصرة من الخادم */
export const DbBrowser: React.FC<{ tables: { name: string; rows: number }[] }> = ({ tables }) => {
  const [active, setActive] = useState(() => (tables.find(t => t.name === 'collection_items') || tables[0])?.name || '');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<TablePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError('');
    try { setPage(await systemApi.table(active, { offset, limit, q })); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [active, offset, q]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOffset(0); setOpen(null); }, [active, q]);

  const sorted = useMemo(() => [...tables].sort((a, b) => (TABLE_LABELS[a.name] ? 0 : 1) - (TABLE_LABELS[b.name] ? 0 : 1) || b.rows - a.rows), [tables]);
  const cols = page?.columns || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
      {/* قائمة الجداول */}
      <nav aria-label="الجداول" className={`${cardCls} p-2 lg:sticky lg:top-20 max-h-[70vh] overflow-y-auto`}>
        <div className="px-2 py-2 text-[11px] font-black text-slate-400 flex items-center gap-1.5"><Database className="w-3.5 h-3.5" />{tables.length} جدول</div>
        <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible no-scrollbar">
          {sorted.map(t => (
            <li key={t.name} className="shrink-0">
              <button onClick={() => setActive(t.name)} aria-current={active === t.name}
                className={`w-full text-right px-3 py-2 rounded-xl transition flex items-center gap-2 ${active === t.name ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'}`}>
                <Table2 className="w-4 h-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold truncate">{TABLE_LABELS[t.name] || t.name}</span>
                  <span className="block text-[10px] text-slate-400 font-mono truncate" dir="ltr">{t.name}</span>
                </span>
                <span className="text-[10px] font-bold tabular-nums text-slate-500">{fmtNum(t.rows)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* محتوى الجدول */}
      <section className={`${cardCls} overflow-hidden min-w-0`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{TABLE_LABELS[active] || active}</h4>
            <p className="text-[11px] text-slate-400 flex items-center gap-1"><Eye className="w-3 h-3" />للقراءة فقط · {page ? `${fmtNum(page.total)} سطر` : '...'}</p>
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في الجدول" className={`${inputCls} pr-9 py-2`} />
          </div>
          <button onClick={load} aria-label="تحديث" className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center self-end sm:self-auto">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <p className="p-4 text-sm font-bold text-rose-500">{error}</p>}
        {!page ? <div className="p-4"><Skeleton rows={5} /></div> : !page.rows.length ? <Empty icon={Table2} title="لا توجد سطور" hint={q ? 'جرّب كلمة بحث أخرى' : undefined} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 sticky top-0">
                <tr>
                  {cols.map(c => (
                    <th key={c.name} scope="col" className="px-3 py-2 text-right font-bold whitespace-nowrap">
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        {c.pk && <KeyRound className="w-3 h-3 text-amber-500" aria-label="مفتاح أساسي" />}
                        {c.secret && <Lock className="w-3 h-3 text-rose-400" aria-label="حقل سرّي" />}
                        {c.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {page.rows.map((r, i) => (
                  <React.Fragment key={i}>
                    <tr onClick={() => setOpen(open === i ? null : i)} className={`cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20 ${open === i ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}`}>
                      {cols.map(c => (
                        <td key={c.name} className="px-3 py-2 align-top max-w-[260px] truncate text-slate-700 dark:text-slate-200">{cell(r[c.name])}</td>
                      ))}
                    </tr>
                    {open === i && (
                      <tr className="bg-slate-50 dark:bg-slate-900/80">
                        <td colSpan={cols.length} className="px-3 py-3">
                          <pre dir="ltr" className="text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono text-slate-700 dark:text-slate-300 max-h-72 overflow-auto">{JSON.stringify(r, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page && page.total > limit && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 tabular-nums">{fmtNum(offset + 1)}–{fmtNum(Math.min(offset + limit, page.total))} من {fmtNum(page.total)}</span>
            <div className="flex gap-1">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold disabled:opacity-40 inline-flex items-center gap-1"><ChevronRight className="w-4 h-4" />السابق</button>
              <button disabled={offset + limit >= page.total} onClick={() => setOffset(offset + limit)} className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold disabled:opacity-40 inline-flex items-center gap-1">التالي<ChevronLeft className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
