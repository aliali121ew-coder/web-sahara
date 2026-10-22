import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, FileText, Loader2, Sprout, X } from 'lucide-react';
import { OfficialReportHeaderRow } from '../print/OfficialReportHeader';
import { getBusinessDate } from '../../lib/utils';
import { monthReport, type SiteMonth } from '../../lib/siteFarmsArchive';
import { weekdayOf } from '../../lib/siteFarmsExport';
import type { SiteFarmsRecord } from '../../lib/siteFarms';

const fmt = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString('en-US'));

interface Props {
  records: SiteFarmsRecord[];
  ym: string;
  /** موقع واحد (null = كل المواقع) */
  site: string | null;
  monthLabel: string;
  fileBase: string;
  excelBusy: boolean;
  /** فتح نافذة الطباعة مباشرة (زر PDF في قائمة الأشهر) */
  autoPdf?: boolean;
  onExcel: () => void;
  onClose: () => void;
}

/** صفحات تقرير الشهر (A4 بالعرض): ملخص المواقع ثم صفحة لكل موقع — للعرض والطباعة والأرشفة التلقائية */
export const useMonthReportPages = (records: SiteFarmsRecord[], ym: string, site: string | null, monthLabel: string): React.ReactNode[] => {
  const { t } = useTranslation(['finance', 'common']);
  const L = (k: string, o?: Record<string, unknown>) => t(`finance:siteFarms.archive.${k}`, o);
  const sites = useMemo(() => monthReport(records, ym, site), [records, ym, site]);
  const weekdays = t('finance:siteFarms.weekdays', { returnObjects: true }) as unknown;
  const dayName = (d: string) => (Array.isArray(weekdays) ? weekdayOf(d, weekdays as string[]) : '');

  const grand = useMemo(() => {
    const s = (k: 'f' | 'g' | 'total' | 'report' | 'lastBalance') => sites.reduce((a, x) => a + (x[k] ?? 0), 0);
    return { f: s('f'), g: s('g'), total: s('total'), report: s('report'), balance: s('lastBalance'), days: sites.reduce((a, x) => a + x.rows.length, 0) };
  }, [sites]);

  const th = 'bg-[#0f5e4b] text-white px-2 py-1.5 text-[9.5px] font-black text-center border border-[#0f5e4b] whitespace-nowrap';
  const td = 'px-2 py-1 text-center font-mono border border-slate-200';
  const strip = (
    <div className="mt-2 flex justify-between border border-slate-300 px-2.5 py-1 text-[9.5px]">
      <span className="font-black text-[#0f5e4b]">{monthLabel}</span>
      <span className="text-slate-500">{L('exportedAt')}: <span className="font-mono font-black text-slate-900">{getBusinessDate()}</span></span>
    </div>
  );
  const head = (title: string) => (
    <header className="print-header border-b-[3px] border-double border-slate-900 pb-2">
      <OfficialReportHeaderRow badge={t('common:print.badgeOfficial')} title={title} />
      {strip}
    </header>
  );
  const kpi = (label: string, value: number | null, tone: string) => (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="text-[9px] font-bold opacity-80">{label}</div>
      <div className="font-mono font-black text-[15px] tabular-nums">{fmt(value)}</div>
    </div>
  );

  const summaryPage = (
    <div className="flex flex-col gap-3">
      {head(`${L('reportTitle')} — ${monthLabel}`)}
      <div className="grid grid-cols-4 gap-2">
        {kpi(L('kpiTotal'), grand.total, 'border-emerald-200 bg-emerald-50 text-emerald-900')}
        {kpi(t('finance:siteFarms.farmsUse'), grand.f, 'border-sky-200 bg-sky-50 text-sky-900')}
        {kpi(t('finance:siteFarms.genUse'), grand.g, 'border-violet-200 bg-violet-50 text-violet-900')}
        {kpi(L('colReportUse'), grand.report || null, 'border-amber-200 bg-amber-50 text-amber-900')}
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            {[L('colSite'), L('colDays'), t('finance:siteFarms.farmsUse'), t('finance:siteFarms.genUse'), t('finance:siteFarms.dayTotal'), L('colShare'), L('colAvg'), L('colPeak'), L('colReportUse'), L('colLastBalance')].map(h => <th key={h} className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {sites.map((s, i) => {
            const share = grand.total > 0 && s.total !== null ? (s.total / grand.total) * 100 : 0;
            return (
              <tr key={s.site} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                <td className="px-2 py-1 font-black text-[#1d576a] border border-slate-200 whitespace-nowrap">{s.site}</td>
                <td className={td}>{s.rows.length}</td>
                <td className={td}>{fmt(s.f)}</td>
                <td className={td}>{fmt(s.g)}</td>
                <td className={`${td} font-black`}>{fmt(s.total)}</td>
                <td className="px-2 py-1 border border-slate-200 min-w-[90px]">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-[#0f5e4b]" style={{ width: `${share}%` }} /></div>
                    <span className="font-mono text-[9px] font-bold">{share.toFixed(0)}%</span>
                  </div>
                </td>
                <td className={td}>{fmt(s.avg)}</td>
                <td className={td}>{s.peak ? <><span className="font-bold">{s.peak.date.slice(5)}</span> <span className="text-slate-500">({fmt(s.peak.total)})</span></> : '—'}</td>
                <td className={td}>{fmt(s.report)}</td>
                <td className={td}>{fmt(s.lastBalance)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-emerald-50 font-black">
            <td className="px-2 py-1.5 border border-slate-300">{L('totalRow')}</td>
            <td className={`${td} border-slate-300`}>{grand.days}</td>
            <td className={`${td} border-slate-300`}>{fmt(grand.f)}</td>
            <td className={`${td} border-slate-300`}>{fmt(grand.g)}</td>
            <td className={`${td} border-slate-300`}>{fmt(grand.total)}</td>
            <td className={`${td} border-slate-300`}>100%</td>
            <td className={`${td} border-slate-300`} colSpan={2} />
            <td className={`${td} border-slate-300`}>{fmt(grand.report || null)}</td>
            <td className={`${td} border-slate-300`}>{fmt(grand.balance || null)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const sitePage = (s: SiteMonth) => (
    <div className="flex flex-col gap-2.5">
      {head(`${s.site} — ${monthLabel}`)}
      <div className="flex flex-wrap gap-2 text-[9.5px]">
        {[[t('finance:siteFarms.dayTotal'), fmt(s.total)], [L('colAvg'), fmt(s.avg)], [L('colPeak'), s.peak ? `${s.peak.date} (${fmt(s.peak.total)})` : '—'], [L('colDays'), String(s.rows.length)]].map(([k, v]) => (
          <span key={k} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900"><span className="font-bold">{k}:</span> <span className="font-mono font-black">{v}</span></span>
        ))}
      </div>
      <table className="w-full border-collapse text-[9.5px]">
        <thead>
          <tr>
            {[L('colDate'), L('colWeekday'), t('finance:siteFarms.farmsUse'), t('finance:siteFarms.genUse'), t('finance:siteFarms.dayTotal'), ...(s.hasReport ? [L('colReportUse'), t('finance:siteFarms.colBalance')] : [])].map(h => <th key={h} className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r, i) => (
            <tr key={r.date} className={r === s.peak ? 'bg-amber-100' : i % 2 ? 'bg-slate-50' : 'bg-white'}>
              <td className={`${td} font-bold`}>{r.date}</td>
              <td className="px-2 py-1 text-center border border-slate-200 text-slate-600">{dayName(r.date)}</td>
              <td className={td}>{fmt(r.f)}</td>
              <td className={td}>{fmt(r.g)}</td>
              <td className={`${td} font-black`}>{fmt(r.total)}</td>
              {s.hasReport && <><td className={td}>{fmt(r.consumption)}</td><td className={td}>{fmt(r.balance)}</td></>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-emerald-50 font-black">
            <td className="px-2 py-1 border border-slate-300" colSpan={2}>{L('totalRow')}</td>
            <td className={`${td} border-slate-300`}>{fmt(s.f)}</td>
            <td className={`${td} border-slate-300`}>{fmt(s.g)}</td>
            <td className={`${td} border-slate-300`}>{fmt(s.total)}</td>
            {s.hasReport && <><td className={`${td} border-slate-300`}>{fmt(s.report)}</td><td className={`${td} border-slate-300`}>{fmt(s.lastBalance)}</td></>}
          </tr>
        </tfoot>
      </table>
      {s.peak && <div className="text-[9px] text-amber-800"><span className="inline-block w-2.5 h-2.5 bg-amber-100 border border-amber-300 align-middle me-1" />{L('peakNote')}</div>}
    </div>
  );

  const signatures = (
    <div className="grid grid-cols-3 gap-2 text-center mt-auto pt-6">
      {[t('common:print.role.accountant'), t('common:print.role.site'), t('common:print.role.general')].map(role => (
        <div key={role} className="border border-dashed border-slate-400 rounded p-1">
          <span className="text-[8.5px] font-black text-slate-800 block">{role}</span>
          <div className="h-6 border-b border-slate-200 my-0.5" />
          <span className="text-[7.5px] text-slate-500 block">{t('common:print.signature')}</span>
        </div>
      ))}
    </div>
  );
  // كل المواقع: ملخص ثم صفحة لكل موقع؛ موقع واحد: صفحته فقط. التواقيع في آخر صفحة
  const body = site ? sites.map(sitePage) : [summaryPage, ...sites.map(sitePage)];
  return body.map((p, i) => (i === body.length - 1 ? <div className="flex flex-col gap-3 min-h-[185mm]">{p}{signatures}</div> : p));
};

/** صفحة A4 بالعرض كما تظهر في العرض والأرشفة */
export const REPORT_PAGE_CLASS = 'bg-white text-slate-900 p-6 shrink-0 font-cairo text-start';
export const REPORT_PAGE_STYLE: React.CSSProperties = { width: '297mm', minHeight: '210mm' };

/**
 * تقرير شهر مزارع المواقع: يُعرض داخل البرنامج كصفحات A4، ويُصدَّر PDF بالطباعة (نفس الصفحات)،
 * وزر Excel يصدّر الملف المنسّق. الصفحة الأولى ملخص المواقع، ثم صفحة لكل موقع.
 */
export const SiteFarmsMonthReport: React.FC<Props> = ({ records, ym, site, monthLabel, fileBase, excelBusy, autoPdf, onExcel, onClose }) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const L = (k: string) => t(`finance:siteFarms.archive.${k}`);
  const pages = useMonthReportPages(records, ym, site, monthLabel);

  // اسم ملف PDF عند "حفظ كـ PDF" = عنوان الصفحة أثناء الطباعة
  const exportPdf = () => {
    const prev = document.title;
    document.title = `${fileBase}${site ? `-${site}` : ''}-${ym}`;
    window.print();
    document.title = prev;
  };

  useEffect(() => {
    if (!autoPdf) return;
    const timer = window.setTimeout(exportPdf, 300); // بعد رسم الصفحات
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPdf]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);


  return (
    <>
      {/* نسخة الطباعة / PDF: كل صفحة في ورقة */}
      <div className="print-only" dir={i18n.dir()}>
        <style>{'@media print { @page { size: A4 landscape; margin: 7mm 9mm; } }'}</style>
        {pages.map((p, i) => (
          <div key={i} className={`print-page-box bg-white text-slate-900 font-cairo text-start ${i < pages.length - 1 ? 'print-page-break' : ''}`}>{p}</div>
        ))}
      </div>

      {createPortal(
        <div className="no-print fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" dir={i18n.dir()} onClick={onClose}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-6xl max-h-full flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white min-w-0">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white flex items-center justify-center shrink-0"><Sprout className="w-4 h-4" /></span>
                <span className="truncate">{site ?? L('reportTitle')} — {monthLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={exportPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-sm cursor-pointer">
                  <FileText className="w-4 h-4" />{L('exportPdf')}
                </button>
                <button type="button" onClick={onExcel} disabled={excelBusy}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait">
                  {excelBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}{L('exportExcel')}
                </button>
                <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer" title={t('common:actions.close')} aria-label={t('common:actions.close')}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 sm:p-6 bg-slate-700/50 dark:bg-slate-950/90">
              <div className="flex flex-col items-center gap-5">
                {pages.map((p, i) => (
                  <div key={i} className={`${REPORT_PAGE_CLASS} rounded-lg shadow-2xl border border-slate-400`} style={REPORT_PAGE_STYLE} dir={i18n.dir()}>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SiteFarmsMonthReport;
