import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useStationGas } from '../../lib/stationGas';
import { ChangePill } from '../suppliers/supplierUi';

const PAGE = 12;
const stamp = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};
const pct = (a: number, b: number | null) => (b ? Math.round(((a - b) / b) * 10000) / 100 : 0);

/**
 * سجل كارت «كاز محطات»: كل تغيّر في قيم الكارت (اختيار المجهزين أو وارد جديد لهم) عملية محفوظة،
 * يُقارَن سعرها بسعر العملية التي قبلها وتظهر النسبة.
 */
export const StationGasLogModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, i18n } = useTranslation(['prices', 'common']);
  const rtl = i18n.dir() === 'rtl';
  const { log } = useStationGas();
  const [page, setPage] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const pages = Math.max(1, Math.ceil(log.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const rows = log.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const th = 'px-3 py-3 text-start text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-3 py-3 text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap align-top';

  return createPortal(
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label={t('prices:stationLog.title')} className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white flex items-center justify-center shrink-0"><History className="w-5 h-5" /></span>
            <div>
              <h3 className="text-[17px] font-black text-slate-900 dark:text-white">{t('prices:stationLog.title')}</h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">{t('prices:stationLog.count', { count: log.length })}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {log.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">{t('prices:stationLog.empty')}</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0">
                <tr>
                  <th className={th}>{t('prices:stationLog.col.at')}</th>
                  <th className={th}>{t('prices:stationLog.col.reason')}</th>
                  <th className={th}>{t('prices:stationLog.col.suppliers')}</th>
                  <th className={th}>{t('prices:stationLog.col.lastInbound')}</th>
                  <th className={th}>{t('prices:stationLog.col.qty')}</th>
                  <th className={th}>{t('prices:stationLog.col.price')}</th>
                  <th className={th}>{t('prices:stationLog.col.previous')}</th>
                  <th className={th}>{t('prices:stationLog.col.change')}</th>
                  <th className={th}>{t('prices:stationLog.col.by')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(e => {
                  const s = stamp(e.at);
                  return (
                    <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className={`${td} tabular-nums`}><div>{s.date}</div><div className="text-[11px] text-slate-400">{s.time}</div></td>
                      <td className={td}>
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${e.reason === 'auto' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'}`}>
                          {t(`prices:stationLog.reason.${e.reason}`)}
                        </span>
                      </td>
                      <td className={td}>
                        <div className="space-y-0.5">
                          {(e.parts.length ? e.parts : e.suppliers.map(name => ({ name, date: '', qty: 0, price: 0 }))).map(p => (
                            <div key={p.name} className="text-[12.5px]">
                              <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                              {p.date && <span className="text-[11px] text-slate-400 tabular-nums"> · {p.date} · {formatNumber(p.qty)} {t('common:units.liter')}{p.price ? ` · ${formatNumber(p.price)}` : ''}</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className={`${td} tabular-nums`}>{e.date || '—'}</td>
                      <td className={`${td} tabular-nums`}>{e.volume ? formatNumber(e.volume) : '—'}</td>
                      <td className={`${td} font-semibold text-slate-900 dark:text-white tabular-nums`}>{e.price ? formatNumber(e.price) : '—'}</td>
                      <td className={`${td} tabular-nums`}>{e.prevPrice ? formatNumber(e.prevPrice) : '—'}</td>
                      <td className={td}>{e.price && e.prevPrice ? <ChangePill pct={pct(e.price, e.prevPrice)} /> : '—'}</td>
                      <td className={td}>{e.by || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[12px] text-slate-500">
            <span className="tabular-nums">{safePage + 1} / {pages}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer">
                {rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <button type="button" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer">
                {rtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
