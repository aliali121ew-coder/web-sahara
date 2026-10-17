import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarDays, Download, FileSpreadsheet, FileX2, Loader2, Sprout, Table2 } from 'lucide-react';
import { FARM_SITES, useSiteFarms, type AnnualRecord } from '../../lib/siteFarms';
import { archiveMonths, closedMonths, monthRows, monthSheets } from '../../lib/siteFarmsArchive';
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
 * - الملفات: آخر ملف سنوي مرفوع لكل موقع (على الخادم)، وملف Excel لكل شهر منتهٍ يُبنى من البيانات المحفوظة عند التنزيل
 */
export const SaharaSiteFarmsArchive: React.FC = () => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const records = useSiteFarms();
  const [tab, setTab] = useState<'table' | 'files'>('table');
  const [site, setSite] = useState<string>(FARM_SITES[0]);
  const months = useMemo(() => archiveMonths(records), [records]);
  const files = useMemo(() => closedMonths(records), [records]);
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
  const years = useMemo(() => [...new Set(files.map(ym => ym.slice(0, 4)))], [files]);

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
  const fileName = (ym: string) => `${t('finance:siteFarms.archive.fileName')}-${ym}.xlsx`;

  const sum = (k: 'f' | 'g' | 'total' | 'consumption') => {
    const v = rows.filter(r => r[k] !== null);
    return v.length ? v.reduce((s, r) => s + (r[k] ?? 0), 0) : null;
  };

  const download = async (ym: string) => {
    setBusy(ym);
    try {
      const XLSX = await import('xlsx');
      const L = (k: string) => t(`finance:siteFarms.archive.${k}`);
      const sheets = monthSheets(records, ym, {
        summary: L('sheetSummary'), farms: L('sheetFarms'), date: L('colDate'), site: L('colSite'), farm: t('finance:siteFarms.colFarm'),
        farmsUse: t('finance:siteFarms.farmsUse'), genUse: t('finance:siteFarms.genUse'), total: t('finance:siteFarms.dayTotal'),
        reportUse: L('colReportUse'), balance: t('finance:siteFarms.colBalance'), previous: t('finance:siteFarms.colPrevious'),
        inbound: t('finance:siteFarms.colInbound'), consumption: t('finance:siteFarms.colConsumption'),
      });
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: i18n.dir() === 'rtl' }] };
      for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
      XLSX.writeFile(wb, fileName(ym));
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
  const select = 'h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-soft-card p-3 sm:p-5 space-y-4" dir={i18n.dir()}>
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
        <div className="space-y-6">
          {/* الملفات السنوية: كارت لكل موقع فيه آخر ملف مرفوع */}
          <section className="space-y-3">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">{t('finance:siteFarms.archive.annualTitle')}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('finance:siteFarms.archive.annualHint')}</p>
            </div>
            {storedError && <div className="text-xs font-bold text-red-600">{t('finance:siteFarms.archive.filesLoadFailed')}</div>}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {FARM_SITES.map(st => {
                const file = siteFiles.get(siteAnnualRecord(st));
                const last = annualLastDay(records, st);
                if (!file) {
                  return (
                    <div key={st} className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0"><FileX2 className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-500 dark:text-slate-400">{st}</div>
                        <div className="text-[11px] text-slate-400">{t('finance:siteFarms.archive.noAnnualFile')}</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={st} className="relative overflow-hidden rounded-2xl border border-emerald-100 dark:border-emerald-900/60 bg-gradient-to-br from-white to-emerald-50/70 dark:from-slate-900 dark:to-emerald-950/30 p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-emerald-600 to-emerald-400" />
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0"><FileSpreadsheet className="w-5 h-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-900 dark:text-white">{st}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate" dir="auto" title={file.name}>{file.name}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">{fmtSize(file.size)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-emerald-600" />{t('finance:siteFarms.archive.uploadedAt', { date: fmtDate(file.created_at) })}</span>
                      {last && <span className="flex items-center gap-1"><CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />{t('finance:siteFarms.archive.coversTo', { date: last })}</span>}
                    </div>
                    <button type="button" disabled={busy === file.id} onClick={() => void downloadStored(file.id, file.name)}
                      className="mt-auto h-9 rounded-xl flex items-center justify-center gap-2 text-xs font-black text-white bg-gradient-to-r from-emerald-700 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-700/20 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-wait">
                      {busy === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {t('finance:siteFarms.archive.downloadFile')}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* التقارير الشهرية: مجمّعة حسب السنة */}
          <section className="space-y-3">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">{t('finance:siteFarms.archive.monthlyTitle')}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('finance:siteFarms.archive.monthlyHint')}</p>
            </div>
            {files.length ? years.map(y => (
              <div key={y} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-black font-mono text-slate-600 dark:text-slate-300">{y}</span>
                  <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>
                <ul className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {files.filter(ym => ym.startsWith(y)).map(ym => (
                    <li key={ym}>
                      <button type="button" disabled={busy === ym} onClick={() => void download(ym)} title={`${t('finance:siteFarms.archive.download')} — ${fileName(ym)}`}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 cursor-pointer transition-colors text-start disabled:opacity-60 disabled:cursor-wait">
                        <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0"><FileSpreadsheet className="w-4 h-4" /></span>
                        <span className="min-w-0 flex-1 text-xs font-black text-slate-800 dark:text-slate-100 truncate">{monthLabel(ym)}</span>
                        {busy === ym ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" /> : <Download className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )) : (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('finance:siteFarms.archive.noFiles')}</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default SaharaSiteFarmsArchive;
