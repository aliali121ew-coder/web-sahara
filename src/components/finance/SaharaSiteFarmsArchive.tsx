import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarDays, Download, Eye, FileSpreadsheet, FileText, FileX2, Loader2, Sprout, Table2 } from 'lucide-react';
import { FARM_SITES, useSiteFarms, type AnnualRecord } from '../../lib/siteFarms';
import { archiveMonths, monthReport, monthRows } from '../../lib/siteFarmsArchive';
import { buildMonthWorkbook } from '../../lib/siteFarmsExport';
import { SiteFarmsMonthReport } from './SiteFarmsMonthReport';
import { SITE_ANNUAL_PREFIX, fetchSaharaFileBlob, siteAnnualRecord, useSaharaFiles } from '../../lib/saharaFiles';

const fmt = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString('en-US'));
const pad = (n: number) => String(n).padStart(2, '0');
const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`; };

/** آخر يوم في بيانات الملف السنوي لموقع (أحدث سنة) */
const annualLastDay = (records: ReturnType<typeof useSiteFarms>, site: string): string | null => {
  const latest = records
    .filter((r): r is AnnualRecord => r.kind === 'annual' && r.site === site && r.f.length > 0)
    .sort((a, b) => b.year - a.year)[0];
  if (!latest) return null;
  const d = new Date(Date.UTC(latest.year, 0, latest.f.length));
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
};

/**
 * أرشيف مزارع الموقع (كارت تقارير الصحاري): قسمان
 * - الجدول: أيام شهر لموقع (مصروف الملف السنوي، ومزارع كشف رصيد الصحاري)
 * - الملفات: ثلاثة أقسام — الموقع، ثم السنة والشهر، ثم الملفات (تقرير الشهر: عرض / PDF / Excel، والملف السنوي المرفوع)
 */
export const SaharaSiteFarmsArchive: React.FC = () => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const records = useSiteFarms();
  const [tab, setTab] = useState<'table' | 'files'>('table');
  const [site, setSite] = useState<string>(FARM_SITES[0]);
  const months = useMemo(() => archiveMonths(records), [records]);
  const [monthPick, setMonthPick] = useState<string | null>(null);
  const month = monthPick && months.includes(monthPick) ? monthPick : (months[0] ?? null);
  const rows = useMemo(() => (month ? monthRows(records, site, month) : []), [records, site, month]);
  const [busy, setBusy] = useState<string | null>(null);
  // الملفات السنوية المرفوعة: تُجلب عند فتح قسم الملفات فقط
  const { files: stored, error: storedError } = useSaharaFiles(tab === 'files');
  const siteFiles = useMemo(() => {
    const map = new Map<string, (typeof stored)[number]>();
    for (const f of stored) if (f.record_id.startsWith(SITE_ANNUAL_PREFIX)) map.set(f.record_id, f); // الأحدث آخرًا
    return map;
  }, [stored]);

  // قسم الملفات: الموقع (null = كل المواقع) ← السنة والشهر ← الملفات
  const [fSite, setFSite] = useState<string | null>(null);
  const [fYm, setFYm] = useState<string | null>(null);
  const fMonths = useMemo(
    () => (fSite ? months.filter(ym => monthRows(records, fSite, ym).length > 0) : months),
    [months, records, fSite]
  );
  const fYears = useMemo(() => [...new Set(fMonths.map(ym => ym.slice(0, 4)))], [fMonths]);
  const curYm = fYm && fMonths.includes(fYm) ? fYm : (fMonths[0] ?? null);
  const fYear = curYm?.slice(0, 4) ?? null;
  const now = new Date();
  const thisYm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const curStats = useMemo(() => {
    const sites = curYm ? monthReport(records, curYm, fSite) : [];
    return { days: sites.reduce((a, x) => a + x.rows.length, 0), total: sites.some(x => x.total !== null) ? sites.reduce((a, x) => a + (x.total ?? 0), 0) : null };
  }, [records, curYm, fSite]);

  const downloadStored = async (id: string, name: string) => {
    setBusy(id);
    try {
      const url = URL.createObjectURL(await fetchSaharaFileBlob(id));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.alert(t('finance:siteFarms.archive.filesLoadFailed'));
    } finally {
      setBusy(null);
    }
  };

  const monthNames = t('finance:siteFarms.months', { returnObjects: true }) as unknown;
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return Array.isArray(monthNames) ? `${monthNames[Number(m) - 1]} ${y}` : ym;
  };
  const L2 = (k: string, o?: Record<string, unknown>) => t(`finance:siteFarms.archive.${k}`, o);
  const fileName = (ym: string, st: string | null) => `${t('finance:siteFarms.archive.fileName')}${st ? `-${st}` : ''}-${ym}.xlsx`;

  const sum = (k: 'f' | 'g' | 'total' | 'consumption') => {
    const v = rows.filter(r => r[k] !== null);
    return v.length ? v.reduce((s, r) => s + (r[k] ?? 0), 0) : null;
  };

  const [report, setReport] = useState<{ ym: string; site: string | null; pdf: boolean } | null>(null);

  // ملف Excel منسّق: ملخص المواقع، وورقة لكل موقع، وتفاصيل المزارع
  const download = async (ym: string, st: string | null) => {
    setBusy(ym);
    try {
      const L = (k: string) => t(`finance:siteFarms.archive.${k}`);
      const weekdays = t('finance:siteFarms.weekdays', { returnObjects: true }) as unknown;
      const buf = await buildMonthWorkbook(records, ym, {
        title: L('reportTitle'), company: L('company'), month: monthLabel(ym), exportedAt: L('exportedAt'),
        summarySheet: L('sheetSummary'), farmsSheet: L('sheetFarms'),
        site: L('colSite'), days: L('colDays'), farmsUse: t('finance:siteFarms.farmsUse'), genUse: t('finance:siteFarms.genUse'),
        total: t('finance:siteFarms.dayTotal'), avg: L('colAvg'), peak: L('colPeak'), reportUse: L('colReportUse'), balance: L('colLastBalance'),
        date: L('colDate'), weekday: L('colWeekday'), farm: t('finance:siteFarms.colFarm'), previous: t('finance:siteFarms.colPrevious'),
        inbound: t('finance:siteFarms.colInbound'), consumption: t('finance:siteFarms.colConsumption'),
        totalRow: L('totalRow'), avgRow: L('avgRow'), peakNote: L('peakNote'),
        weekdays: Array.isArray(weekdays) ? (weekdays as string[]) : [],
      }, st);
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName(ym, st);
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(null);
    }
  };

  const tabBtn = (k: 'table' | 'files', Icon: React.ElementType, label: string) => (
    <button type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
      className={`flex-1 sm:flex-none px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-black cursor-pointer transition-all ${tab === k ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );
  const stepBox = 'rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 sm:p-4 space-y-3';
  const stepHead = (n: number, label: string) => (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-500 text-white text-[11px] font-black flex items-center justify-center shadow-sm">{n}</span>
      <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">{label}</h3>
    </div>
  );
  const annualCard = (st: string) => {
    const file = siteFiles.get(siteAnnualRecord(st));
    const last = annualLastDay(records, st);
    if (!file) {
      return (
        <div key={st} className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0"><FileX2 className="w-5 h-5" /></div>
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-500 dark:text-slate-400">{L2('annualFileOf', { site: st })}</div>
            <div className="text-[11px] text-slate-400">{L2('noAnnualFile')}</div>
          </div>
        </div>
      );
    }
    return (
      <div key={st} className="relative overflow-hidden rounded-2xl border border-emerald-100 dark:border-emerald-900/60 bg-gradient-to-br from-white to-emerald-50/70 dark:from-slate-900 dark:to-emerald-950/30 p-4 flex flex-col gap-3 shadow-sm">
        <div className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-emerald-600 to-emerald-400" />
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0"><FileSpreadsheet className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-slate-900 dark:text-white">{L2('annualFileOf', { site: st })}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate" dir="auto" title={file.name}>{file.name}</div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">{fmtSize(file.size)}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-emerald-600" />{L2('uploadedAt', { date: fmtDate(file.created_at) })}</span>
          {last && <span className="flex items-center gap-1"><CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />{L2('coversTo', { date: last })}</span>}
        </div>
        <button type="button" disabled={busy === file.id} onClick={() => void downloadStored(file.id, file.name)}
          className="mt-auto h-9 rounded-xl flex items-center justify-center gap-2 text-xs font-black text-white bg-gradient-to-r from-emerald-700 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-700/20 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-wait">
          {busy === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {L2('downloadFile')}
        </button>
      </div>
    );
  };
  const select = 'h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-soft-card p-3 sm:p-5 space-y-4" dir={i18n.dir()}>
      {report && (
        <SiteFarmsMonthReport records={records} ym={report.ym} site={report.site} monthLabel={monthLabel(report.ym)} fileBase={t('finance:siteFarms.archive.fileName')}
          autoPdf={report.pdf} excelBusy={busy === report.ym} onExcel={() => void download(report.ym, report.site)} onClose={() => setReport(null)} />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-sm shrink-0"><Sprout className="w-5 h-5" /></div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{t('finance:reports.farms')}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('finance:siteFarms.archive.hint')}</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          {tabBtn('table', Table2, t('finance:siteFarms.archive.table'))}
          {tabBtn('files', FileSpreadsheet, t('finance:siteFarms.archive.files'))}
        </div>
      </div>

      {tab === 'table' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <select className={select} value={site} onChange={e => setSite(e.target.value)} aria-label={t('finance:siteFarms.archive.colSite')}>
              {FARM_SITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {months.length > 0 && (
              <select className={select} value={month ?? ''} onChange={e => setMonthPick(e.target.value)} aria-label={t('finance:siteFarms.archive.month')}>
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            )}
          </div>
          {rows.length ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                  <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-black [&>th]:text-start [&>th]:whitespace-nowrap">
                    <th>{t('finance:siteFarms.archive.colDate')}</th>
                    <th>{t('finance:siteFarms.farmsUse')}</th>
                    <th>{t('finance:siteFarms.genUse')}</th>
                    <th>{t('finance:siteFarms.dayTotal')}</th>
                    <th>{t('finance:siteFarms.archive.colReportUse')}</th>
                    <th>{t('finance:siteFarms.colBalance')}</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                  {rows.map(r => (
                    <tr key={r.date} className="border-t border-slate-100 dark:border-slate-800 [&>td]:px-3 [&>td]:py-2">
                      <td className="font-bold">{r.date}</td>
                      <td>{fmt(r.f)}</td>
                      <td>{fmt(r.g)}</td>
                      <td className="font-black">{fmt(r.total)}</td>
                      <td>{fmt(r.consumption)}</td>
                      <td>{fmt(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50/60 dark:bg-emerald-950/20 font-black text-slate-900 dark:text-white font-mono tabular-nums">
                  <tr className="border-t border-slate-200 dark:border-slate-700 [&>td]:px-3 [&>td]:py-2.5">
                    <td className="font-sans">{t('finance:siteFarms.archive.monthTotal')}</td>
                    <td>{fmt(sum('f'))}</td>
                    <td>{fmt(sum('g'))}</td>
                    <td>{fmt(sum('total'))}</td>
                    <td>{fmt(sum('consumption'))}</td>
                    <td>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t('finance:siteFarms.archive.empty', { site })}</div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {storedError && <div className="text-xs font-bold text-red-600">{L2('filesLoadFailed')}</div>}

          {/* القسم 1: الموقع */}
          <section className={stepBox}>
            {stepHead(1, L2('stepSite'))}
            <div className="flex flex-wrap gap-2">
              {[null, ...FARM_SITES].map(st => {
                const on = fSite === st;
                return (
                  <button key={st ?? 'all'} type="button" onClick={() => { setFSite(st); setFYm(null); }} aria-pressed={on}
                    className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer transition-all ${on ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white border-transparent shadow-md shadow-emerald-700/20' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300'}`}>
                    {st ?? L2('allSites')}
                  </button>
                );
              })}
            </div>
          </section>

          {/* القسم 2: السنة والشهر */}
          <section className={stepBox}>
            {stepHead(2, L2('stepMonth'))}
            {fYears.length ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 w-fit">
                  {fYears.map(y => (
                    <button key={y} type="button" onClick={() => setFYm(fMonths.find(m => m.startsWith(y)) ?? null)} aria-pressed={fYear === y}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black font-mono cursor-pointer transition-all ${fYear === y ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
                      {y}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {Array.from({ length: 12 }, (_, i) => {
                    const ym = `${fYear}-${String(i + 1).padStart(2, '0')}`;
                    const has = fMonths.includes(ym);
                    const on = curYm === ym;
                    return (
                      <button key={ym} type="button" disabled={!has} onClick={() => setFYm(ym)} aria-pressed={on}
                        className={`relative py-2.5 rounded-xl text-xs font-black border transition-all ${on ? 'bg-emerald-600 text-white border-transparent shadow-md shadow-emerald-700/20' : has ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-300 cursor-pointer' : 'bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-800 cursor-not-allowed'}`}>
                        {Array.isArray(monthNames) ? monthNames[i] : i + 1}
                        {ym === thisYm && has && <span className={`absolute top-1 end-1.5 text-[8px] font-bold ${on ? 'text-emerald-100' : 'text-amber-600'}`}>{L2('current')}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{L2('noMonths')}</div>
            )}
          </section>

          {/* القسم 3: الملفات */}
          <section className={stepBox}>
            {stepHead(3, L2('stepFiles'))}
            <div className="grid gap-3 lg:grid-cols-2">
              {curYm && (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/60 p-4 flex flex-col gap-3 shadow-sm">
                  <div className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-sky-600 to-emerald-500" />
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-700 to-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0"><FileText className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-slate-900 dark:text-white">{L2('monthReport')}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{fSite ?? L2('allSites')} — {monthLabel(curYm)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">{L2('colDays')}: <span className="font-mono font-black">{curStats.days}</span></span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">{t('finance:siteFarms.dayTotal')}: <span className="font-mono font-black">{fmt(curStats.total)}</span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-auto">
                    <button type="button" onClick={() => setReport({ ym: curYm, site: fSite, pdf: false })}
                      className="h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <Eye className="w-4 h-4" />{L2('view')}
                    </button>
                    <button type="button" onClick={() => setReport({ ym: curYm, site: fSite, pdf: true })}
                      className="h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer">
                      <FileText className="w-4 h-4" />PDF
                    </button>
                    <button type="button" disabled={busy === curYm} onClick={() => void download(curYm, fSite)}
                      className="h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait">
                      {busy === curYm ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}Excel
                    </button>
                  </div>
                </div>
              )}
              {(fSite ? [fSite] : FARM_SITES).map(annualCard)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default SaharaSiteFarmsArchive;
