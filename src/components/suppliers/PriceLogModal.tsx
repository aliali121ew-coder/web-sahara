import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, History, Search, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, CircleDashed, Camera, Layers } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { formatNumber } from '../../lib/utils';
import { usePriceLog, lastByKey, logPrice, type PriceLogEntry, type PriceLogSource } from '../../lib/priceLog';
import { usePurchasePrices } from '../../lib/purchasePrices';
import { Avatar, ChangePill, CompanyBadges, fmtPrice } from './supplierUi';
import type { SupplierPriceRecord } from '../../types';

const PAGE = 15;
type Tab = 'ops' | 'match';
type SourceFilter = 'all' | PriceLogSource;
type Status = 'ok' | 'diff' | 'none';
interface MatchRow { key: string; source: PriceLogSource; name: string; company?: 'sahara' | 'etihad'; rec: SupplierPriceRecord | null; current: number; logged: number | null; at?: string; status: Status }

const ACTION_TONE: Record<PriceLogEntry['action'], string> = {
  create: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  update: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  delete: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
  reset: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  snapshot: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const pct = (a: number | null, b: number | null) => (a != null && b != null && b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : 0);
const stamp = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};

/**
 * سجل الأسعار والمشتريات: كل عملية حفظ في «كل الموردين» وأسعار كروت المشتريات (بنفس تصميم الجدول)،
 * وتبويب المطابقة يقارن الجدولين الحاليين بآخر عملية مسجّلة لكل سطر.
 */
export const PriceLogModal: React.FC<{ editable: boolean; onClose: () => void }> = ({ editable, onClose }) => {
  const { t } = useTranslation(['suppliers', 'common']);
  const log = usePriceLog();
  const { supplierPrices } = useFuelData();
  const { fuelMetrics, priceOf } = usePurchasePrices();
  const [tab, setTab] = useState<Tab>('ops');
  const [source, setSource] = useState<SourceFilter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  useEffect(() => { setPage(0); }, [source, q, tab]);

  // ── العمليات ──
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return log.filter(e => (source === 'all' || e.source === source)
      && (!s || e.name.toLowerCase().includes(s) || (e.product ?? '').toLowerCase().includes(s) || (e.by ?? '').toLowerCase().includes(s)));
  }, [log, source, q]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = rows.slice(safePage * PAGE, safePage * PAGE + PAGE);

  // ── المطابقة: الجدول الحالي مقابل آخر عملية مسجّلة ──
  const last = useMemo(() => lastByKey(log), [log]);
  const match = useMemo((): { sup: MatchRow[]; pur: MatchRow[] } => {
    const sup = supplierPrices.map(r => {
      const e = last.get(`suppliers:${r.id}`);
      const status: Status = !e ? 'none' : e.price === r.priceIqd ? 'ok' : 'diff';
      return { key: r.id, source: 'suppliers' as const, name: r.supplierName, company: r.company, rec: r, current: r.priceIqd, logged: e?.price ?? null, at: e?.at, status };
    });
    const pur = fuelMetrics.map(m => {
      const cur = priceOf(m).displayPrice;
      const e = last.get(`purchases:${m.id}`);
      const status: Status = !e ? 'none' : e.price === cur ? 'ok' : 'diff';
      return { key: m.id, source: 'purchases' as const, name: m.name, company: (m.company === 'شركة الاتحاد' ? 'etihad' : 'sahara') as 'sahara' | 'etihad', rec: null, current: cur, logged: e?.price ?? null, at: e?.at, status };
    });
    return { sup, pur };
  }, [supplierPrices, fuelMetrics, priceOf, last]);
  const counts = (list: { status: Status }[]) => ({ ok: list.filter(x => x.status === 'ok').length, diff: list.filter(x => x.status === 'diff').length, none: list.filter(x => x.status === 'none').length });
  const pending = [...match.sup, ...match.pur].filter(x => x.status !== 'ok');

  /** تثبيت الحالة الحالية: عملية «لقطة» لكل سطر غير مطابق، فيصير السجل مطابقًا للجدولين */
  const snapshot = () => {
    for (const x of pending) {
      const r = x.rec;
      logPrice({
        source: x.source, action: 'snapshot', key: x.key, name: x.name, company: x.company,
        product: r?.product, density: r?.density, color: r?.color, prevPrice: x.logged, price: x.current,
      });
    }
  };

  const th = 'px-3 xl:px-4 py-3 text-start text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-3 xl:px-4 py-3 text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap';
  const seg = (on: boolean) => `px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer ${on ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`;
  const statusChip = (s: Status) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${s === 'ok' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : s === 'diff' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
      {s === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : s === 'diff' ? <AlertTriangle className="w-3.5 h-3.5" /> : <CircleDashed className="w-3.5 h-3.5" />}
      {t(`log.status.${s}`)}
    </span>
  );
  const nameCell = (source: PriceLogSource, key: string, name: string) => (
    <div className="flex items-center gap-2.5">
      {source === 'suppliers'
        ? <Avatar s={{ id: key, supplierName: name, logo: supplierPrices.find(r => r.id === key)?.logo }} size="w-8 h-8" text="text-xs" />
        : <span className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0"><Layers className="w-4 h-4" /></span>}
      <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{name}</span>
    </div>
  );

  const matchTable = (title: string, list: MatchRow[]) => {
    const c = counts(list);
    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 bg-slate-50/70 dark:bg-slate-800/40">
          <h4 className="text-[14px] font-semibold text-slate-900 dark:text-white me-auto">{title}</h4>
          {(['ok', 'diff', 'none'] as Status[]).map(s => <span key={s} className="flex items-center gap-1">{statusChip(s)}<b className="text-[12px] tabular-nums text-slate-700 dark:text-slate-200">{c[s]}</b></span>)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className={th}>{t('table.receiver')}</th>
                <th className={th}>{t('log.col.name')}</th>
                <th className={th}>{t('log.col.current')}</th>
                <th className={th}>{t('log.col.logged')}</th>
                <th className={th}>{t('log.col.lastOp')}</th>
                <th className={th}>{t('log.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map(x => (
                <tr key={x.key} className={`border-t border-slate-100 dark:border-slate-800 ${x.status === 'diff' ? 'bg-rose-50/40 dark:bg-rose-950/10' : ''}`}>
                  <td className={td}><CompanyBadges companies={x.company ? [x.company] : []} /></td>
                  <td className={td}>{nameCell(x.source, x.key, x.name)}</td>
                  <td className={`${td} font-semibold text-slate-900 dark:text-white tabular-nums`}>{fmtPrice(x.current)}</td>
                  <td className={`${td} tabular-nums`}>{x.logged != null ? fmtPrice(x.logged) : '—'}</td>
                  <td className={`${td} tabular-nums`}>{x.at ? `${stamp(x.at).date} ${stamp(x.at).time}` : '—'}</td>
                  <td className={td}>{statusChip(x.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-md p-2 sm:p-5 flex animate-[overlayIn_.18s_ease]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('log.title')} onMouseDown={e => e.stopPropagation()}
        className="relative flex-1 flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] overflow-hidden animate-[dialogIn_.22s_ease]">
        {/* الرأس */}
        <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0 me-auto">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white flex items-center justify-center shadow-sm"><History className="w-4.5 h-4.5" /></span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{t('log.title')}</h2>
              <p className="text-xs text-slate-500 truncate">{t('log.subtitle', { count: log.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50">
            <button type="button" className={seg(tab === 'ops')} onClick={() => setTab('ops')}>{t('log.tab.ops')}</button>
            <button type="button" className={seg(tab === 'match')} onClick={() => setTab('match')}>
              {t('log.tab.match')}
              {pending.length > 0 && <span className="ms-1.5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] tabular-nums">{pending.length}</span>}
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')}
            className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {tab === 'ops' ? (
          <>
            <div className="shrink-0 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50">
                {(['all', 'suppliers', 'purchases'] as SourceFilter[]).map(s => (
                  <button key={s} type="button" className={seg(source === s)} onClick={() => setSource(s)}>{t(`log.source.${s}`)}</button>
                ))}
              </div>
              <div className="relative ms-auto w-full sm:w-72">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('log.search')}
                  className="w-full h-10 ps-9 pe-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[13px] outline-none focus:border-teal-500" />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className={th}>{t('log.col.when')}</th>
                    <th className={th}>{t('log.col.section')}</th>
                    <th className={th}>{t('log.col.action')}</th>
                    <th className={th}>{t('log.col.name')}</th>
                    <th className={th}>{t('table.product')}</th>
                    <th className={th}>{t('table.density')}</th>
                    <th className={th}>{t('table.color')}</th>
                    <th className={th}>{t('table.previous')}</th>
                    <th className={th}>{t('log.col.newPrice')}</th>
                    <th className={th}>{t('table.change')}</th>
                    <th className={th}>{t('log.col.by')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && <tr><td colSpan={11} className="py-14 text-center text-sm text-slate-400">{t('log.empty')}</td></tr>}
                  {pageRows.map(e => {
                    const s = stamp(e.at);
                    return (
                      <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className={`${td} tabular-nums`}><div className="text-slate-800 dark:text-slate-100">{s.date}</div><div className="text-[11px] text-slate-400">{s.time}</div></td>
                        <td className={td}>{t(`log.source.${e.source}`)}</td>
                        <td className={td}>
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${ACTION_TONE[e.action]}`}>{t(`log.action.${e.action}`)}</span>
                          {e.changes && e.changes.length > 0 && <div className="mt-1 text-[10.5px] text-slate-400 truncate max-w-[160px]">{e.changes.map(c => t(`log.field.${c}`)).join('، ')}</div>}
                        </td>
                        <td className={td}>{nameCell(e.source, e.key, e.name)}</td>
                        <td className={td}>{e.product || '—'}</td>
                        <td className={`${td} tabular-nums`}>{e.density || '—'}</td>
                        <td className={td}>{e.color || '—'}</td>
                        <td className={`${td} tabular-nums`}>{e.prevPrice != null ? fmtPrice(e.prevPrice) : '—'}</td>
                        <td className={`${td} font-semibold text-slate-900 dark:text-white tabular-nums`}>{e.price != null ? fmtPrice(e.price) : '—'}</td>
                        <td className={td}>{e.prevPrice != null && e.price != null ? <ChangePill pct={pct(e.price, e.prevPrice)} /> : '—'}</td>
                        <td className={td}>{e.by || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > PAGE && (
              <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 tabular-nums">{t('pager.range', { from: safePage * PAGE + 1, to: safePage * PAGE + pageRows.length, total: rows.length })}</span>
                <nav aria-label={t('pager.label')} className="flex items-center gap-1">
                  <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label={t('pager.prev')}
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-40 cursor-pointer"><ChevronRight className="w-4 h-4 ltr:rotate-180" /></button>
                  <span className="px-2 text-xs text-slate-500 tabular-nums">{safePage + 1} / {pages}</span>
                  <button type="button" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} aria-label={t('pager.next')}
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4 ltr:rotate-180" /></button>
                </nav>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 px-4 py-3">
              <p className="text-[13px] text-slate-600 dark:text-slate-300 me-auto">{pending.length ? t('log.matchHint', { count: pending.length }) : t('log.allMatch')}</p>
              {editable && pending.length > 0 && (
                <button type="button" onClick={snapshot}
                  className="h-9 px-3.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-[13px] font-medium flex items-center gap-2 cursor-pointer">
                  <Camera className="w-4 h-4" /> {t('log.snapshot')}
                </button>
              )}
            </div>
            {matchTable(t('log.source.suppliers'), match.sup)}
            {matchTable(t('log.source.purchases'), match.pur)}
            <p className="text-[11.5px] text-slate-400">{t('log.statusHelp', { n: formatNumber(log.length) })}</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
