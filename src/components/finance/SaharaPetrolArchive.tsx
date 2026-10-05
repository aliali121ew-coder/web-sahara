import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Fuel, Printer, X, CalendarDays, ChevronRight, ChevronLeft, LayoutTemplate, Paperclip, FileText, FileSpreadsheet, Loader2, AlertTriangle, Pencil, Check, RefreshCw, Trash2 } from 'lucide-react';
import { useSaharaFiles, fileKind, ACCEPT_FILES, type SaharaFile } from '../../lib/saharaFiles';
import { SaharaFilePreview } from './SaharaFilePreview';
import { OfficialReportHeaderRow } from '../print/OfficialReportHeader';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import { formatNumber, getBusinessDate } from '../../lib/utils';
import { useTranslation, Trans } from 'react-i18next';
import { usePetrolLedger, PETROL_STATIONS, type ComputedPetrolRecord } from '../../lib/petrolLedger';
import { useCentralTanks, resolveSaharaPetrolSectionKey } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';

/**
 * أرشيف بنزين الصحاري: كل الأيام المسجلة مع استهلاك كل محطة، فلتر الفترة، ترقيم الصفحات، ومعاينة الطباعة الرسمية.
 * (بنفس نمط أرشيف كشف رصيد شركة الصحاري)
 */
export const SaharaPetrolArchive: React.FC = () => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const { computed, update } = usePetrolLedger();

  // المحطات بنفس ترتيب ومعرّفات صفحة البنزين (خزان المنظومة المطابق أو معرّف ثابت بالاسم)
  const [centralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const stations = useMemo(() => {
    const clean = (n: string) => n.replace(/^موقع\s+/, '').trim();
    const petrolKey = resolveSaharaPetrolSectionKey(centralTanks);
    const petrolTanks = petrolKey ? centralTanks.filter(t => t.sectionKey === petrolKey) : [];
    return PETROL_STATIONS.map(({ name }) => ({ id: petrolTanks.find(p => clean(p.name) === name)?.id ?? `st:${name}`, name }));
  }, [centralTanks]);
  const stationQty = (r: ComputedPetrolRecord, id: string) => r.consumption?.[id] || 0;
  const inboundOf = (r: ComputedPetrolRecord) => (r.inboundQty || 0) + (r.inboundInternal || 0);
  // مرفقات كل يوم (PDF و Excel) من الخادم
  const { files, busy, error: filesError, clearError, upload, remove, replace } = useSaharaFiles();
  // وضع إدارة المرفقات (زر "تعديل" بجانب الطباعة): يُظهر تغيير وحذف الملفات
  const [manageFiles, setManageFiles] = useState(false);
  const filesByRecord = useMemo(() => {
    const map = new Map<string, SaharaFile[]>();
    for (const f of files) map.set(f.record_id, [...(map.get(f.record_id) || []), f]);
    return map;
  }, [files]);
  const MAX_INLINE_FILES = 2;
  // معاينة الملف قبل الطباعة
  const [previewFile, setPreviewFile] = useState<SaharaFile | null>(null);
  // تأكيد حذف ملف أو يوم كامل (نافذة داخل التطبيق: بعض المتصفحات تمنع window.confirm)
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: 'file'; file: SaharaFile } | { kind: 'day'; id: string; date: string } | null
  >(null);

  // حذف اليوم: من سجل رصيد الشركة (فيختفي من صفحة الإدخال أيضًا) مع مرفقاته
  const deleteDay = (id: string) => {
    update(prev => prev.filter(r => r.id !== id));
    (filesByRecord.get(id) || []).forEach(f => remove(f.id));
  };
  // نافذة كل ملفات اليوم (عند أكثر من ملفين)
  const [filesPop, setFilesPop] = useState<{ recordId: string; date: string; top: number; left: number } | null>(null);

  // شارة ملف: الضغط يفتحه، والتغيير والحذف في وضع التعديل فقط
  const fileChip = (f: SaharaFile, withName = false) => {
    const isPdf = fileKind(f) === 'pdf';
    const FileIcon = isPdf ? FileText : FileSpreadsheet;
    return (
      <span
        key={f.id}
        className={`inline-flex items-center rounded-lg ring-1 overflow-hidden ${withName ? 'w-full' : ''} ${isPdf ? 'bg-rose-50 ring-rose-200 text-rose-600 dark:bg-rose-950/40 dark:ring-rose-900 dark:text-rose-300' : 'bg-emerald-50 ring-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:ring-emerald-900 dark:text-emerald-300'}`}
      >
        <button
          type="button"
          onClick={() => { setFilesPop(null); setPreviewFile(f); }}
          title={`${f.name} (${formatSize(f.size)})`}
          className={`flex items-center gap-1 ps-1.5 pe-1 py-1 text-[10px] font-black cursor-pointer hover:brightness-95 min-w-0 ${withName ? 'flex-1 gap-1.5 py-1.5' : ''}`}
        >
          {busy === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <FileIcon className="w-3.5 h-3.5 shrink-0" />}
          {withName ? (
            <>
              <span className="truncate text-start font-bold">{f.name}</span>
              <span className="ms-auto shrink-0 text-[9px] font-mono opacity-70">{formatSize(f.size)}</span>
            </>
          ) : (isPdf ? 'PDF' : 'Excel')}
        </button>
        {manageFiles && (
          <>
            <label title={t('finance:archive.changeFile')} className="px-1 py-1 border-s border-black/10 dark:border-white/10 opacity-60 hover:opacity-100 cursor-pointer">
              <RefreshCw className="w-3 h-3" />
              <input
                type="file"
                accept={ACCEPT_FILES}
                className="hidden"
                onChange={e => {
                  const next = e.target.files?.[0];
                  e.target.value = '';
                  if (next) replace(f, next);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => { setFilesPop(null); setConfirmDelete({ kind: 'file', file: f }); }}
              title={t('finance:archive.deleteFile')}
              className="px-1 py-1 opacity-60 hover:opacity-100 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </span>
    );
  };

  const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
  const [range, setRange] = useState<'all' | 'week' | 'month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePop, setDatePop] = useState<{ top: number; left: number } | null>(null);
  const [page, setPage] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const PAGE_SIZE = 10;

  const visible = useMemo(() => {
    const rows = [...computed].reverse();
    if (range === 'custom') return rows.filter(r => (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate));
    const days = range === 'week' ? 6 : range === 'month' ? 29 : null;
    if (!days) return rows;
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = getBusinessDate(from);
    return rows.filter(r => r.date >= fromStr);
  }, [computed, range, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(startIndex, startIndex + PAGE_SIZE);
  const endIndex = startIndex + pageRows.length;

  const totals = useMemo(() => ({
    stations: stations.map(s => visible.reduce((a, r) => a + stationQty(r, s.id), 0)),
    consumption: visible.reduce((a, r) => a + r.totalConsumption, 0),
    inbound: visible.reduce((a, r) => a + inboundOf(r), 0)
  }), [visible, stations]);

  const rangeLabel = range === 'all' ? t('common:print.rangeAll') : range === 'month' ? t('common:print.rangeMonth') : range === 'week' ? t('common:print.rangeWeek') : t('common:print.rangeFromTo', { from: fromDate || '—', to: toDate || '—' });

  const HEADERS = ['#', t('finance:archive.col.date'), t('finance:ledger.previousBalance'), ...stations.map(s => s.name), t('finance:archive.col.totalConsumption'), t('finance:ledger.inbound'), t('finance:ledger.currentBalance')];

  // نسخة الطباعة الرسمية (كل الأيام حسب الفلتر)
  const sheet = (
    <div className={`print-page-box bg-white text-slate-900 w-full ${orientation === 'landscape' ? 'min-h-[196mm]' : 'min-h-[279mm]'} flex flex-col gap-3 text-start font-cairo`} dir={i18n.dir()}>
      <header className="print-header border-b-[3px] border-double border-slate-900 pb-2">
        <OfficialReportHeaderRow compact={orientation === 'portrait'} badge={t('common:print.badgeOfficial')} title={t('finance:archive.petrol.printTitle')} />
        <div className="mt-2 flex justify-between border border-slate-300 px-2.5 py-1 text-[9.5px]">
          <span className="text-slate-500 font-bold">{rangeLabel}</span>
          <span className="font-mono font-black">{visible.length ? `${visible[visible.length - 1].date} — ${visible[0].date}` : ''}</span>
          <span className="text-slate-500"><Trans t={t} i18nKey="common:print.printDate" values={{ date: getBusinessDate() }} components={{ 1: <span className="font-mono font-black text-slate-900" /> }} /></span>
        </div>
      </header>
      <table className="w-full border-collapse text-[9.5px]">
        <thead>
          <tr>
            {HEADERS.map(h => (
              <th key={h} className="bg-slate-900 text-white px-1.5 py-1.5 text-[9px] font-black text-center border border-slate-900 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={r.id} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
              <td className="px-1.5 py-1 text-center border border-slate-200">{i + 1}</td>
              <td className="px-1.5 py-1 text-center font-mono font-bold border border-slate-200">{r.date}</td>
              {[r.previous, ...stations.map(s => stationQty(r, s.id)), r.totalConsumption, inboundOf(r)].map((val, k) => (
                <td key={k} className="px-1.5 py-1 text-center font-mono border border-slate-200">{formatNumber(val || 0)}</td>
              ))}
              <td className="px-1.5 py-1 text-center font-mono font-black border border-slate-200">{formatNumber(r.current)}</td>
            </tr>
          ))}
        </tbody>
        {visible.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100 font-black">
              <td className="px-1.5 py-1 text-center border border-slate-300" colSpan={3}>{t('finance:archive.total')}</td>
              {[...totals.stations, totals.consumption, totals.inbound].map((val, k) => (
                <td key={k} className="px-1.5 py-1 text-center font-mono border border-slate-300">{formatNumber(val)}</td>
              ))}
              <td className="px-1.5 py-1 text-center font-mono border border-slate-300">{formatNumber(visible[0].current)}</td>
            </tr>
          </tfoot>
        )}
      </table>
      <div className="grid grid-cols-3 gap-2 text-center mt-auto pt-4">
        {[t('common:print.role.accountant'), t('common:print.role.site'), t('common:print.role.general')].map(role => (
          <div key={role} className="border border-dashed border-slate-400 rounded p-1">
            <span className="text-[8.5px] font-black text-slate-800 block">{role}</span>
            <div className="h-5 border-b border-slate-200 my-0.5" />
            <span className="text-[7.5px] text-slate-500 block">{t('common:print.signature')}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const printDoc = (
    <div className="print-only">
      <style>{`@media print { @page { size: A4 ${orientation}; margin: 6mm 8mm; } }`}</style>
      {sheet}
    </div>
  );

  const previewModal = showPreview && createPortal(
    <div className="no-print fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" dir={i18n.dir()} onClick={() => setShowPreview(false)}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-6xl max-h-full flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
            <Printer className="w-5 h-5 text-teal-600" />
            {t('finance:archive.petrol.preview')}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700">
              <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{t('common:print.orientation')}:</span>
              <select
                value={orientation}
                onChange={e => setOrientation(e.target.value as 'landscape' | 'portrait')}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-black focus:outline-none cursor-pointer text-xs"
              >
                <option value="landscape" className="dark:bg-slate-800">{t('common:print.landscape')}</option>
                <option value="portrait" className="dark:bg-slate-800">{t('common:print.portrait')}</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t('common:print.print')}
            </button>
            <button type="button" onClick={() => setShowPreview(false)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer" title={t('common:actions.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-700/50 dark:bg-slate-950/90 flex justify-center">
          <div
            className="bg-white rounded-lg shadow-2xl border border-slate-400 p-6 shrink-0"
            style={orientation === 'landscape' ? { width: '297mm', minHeight: '210mm' } : { width: '210mm', minHeight: '297mm' }}
          >
            {sheet}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  const th = 'p-3';
  const td = 'p-3';

  return (
    <>
      {printDoc}
      {previewModal}
      {previewFile && <SaharaFilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
      {confirmDelete && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150" dir={i18n.dir()} onClick={() => setConfirmDelete(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-1">
                {confirmDelete.kind === 'file' ? (
                  <>
                    <div className="font-black text-slate-900 dark:text-white">{t('finance:archive.deleteFileTitle')}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-all">{confirmDelete.file.name}</p>
                  </>
                ) : (
                  <>
                    <div className="font-black text-slate-900 dark:text-white"><Trans t={t} i18nKey="finance:blackOil.deleteDay" values={{ date: confirmDelete.date }} components={{ 1: <span className="font-mono" /> }} /></div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t('finance:archive.petrol.deleteText')}
                    </p>
                  </>
                )}
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">{t('finance:blackOil.deleteWarning')}</p>
              </div>
            </div>
            <div className="px-5 pb-5 grid grid-cols-[auto_1fr] gap-2.5">
              <button type="button" autoFocus onClick={() => setConfirmDelete(null)} className="px-5 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer">
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDelete.kind === 'file') remove(confirmDelete.file.id);
                  else deleteDay(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
              >
                <Trash2 className="w-4 h-4" />
                {t('finance:blackOil.deleteYes')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* كل ملفات اليوم عند الضغط على شارة +العدد */}
      {filesPop && createPortal(
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setFilesPop(null)} />
          <div
            dir={i18n.dir()}
            style={{ top: filesPop.top, left: Math.min(Math.max(filesPop.left - 150, 12), window.innerWidth - 312) }}
            className="fixed z-[111] w-[300px] rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 shadow-2xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                <Trans t={t} i18nKey="finance:archive.dayFiles" values={{ date: filesPop.date }} components={{ 1: <span className="font-mono" /> }} />
              </span>
              <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                {filesByRecord.get(filesPop.recordId)?.length ?? 0}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {(filesByRecord.get(filesPop.recordId) || []).map(f => fileChip(f, true))}
            </div>
          </div>
        </>,
        document.body
      )}
      <div className="no-print rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Fuel className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span>{t('finance:archive.petrol.title')}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('finance:archive.petrol.hint')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
              {([['all', t('common:enum.category.all')], ['month', t('common:print.rangeMonth')], ['week', t('common:print.rangeWeek')]] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setRange(k); setPage(1); }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${range === k ? 'bg-teal-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setDatePop(p => (p ? null : { top: r.bottom + 8, left: Math.max(8, r.left) }));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                  range === 'custom'
                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                title={t('finance:blackOil.pickRange')}
              >
                <CalendarDays className="w-4 h-4" />
                {range === 'custom' && <span className="font-mono">{fromDate || '…'} — {toDate || '…'}</span>}
              </button>
              {datePop && createPortal(
                <>
                  <div className="fixed inset-0 z-[150]" onClick={() => setDatePop(null)} />
                  <div className="fixed z-[151]" style={{ top: datePop.top, left: datePop.left }}>
                    <DateRangeCalendar
                      from={fromDate}
                      to={toDate}
                      onApply={(f, t) => { setFromDate(f); setToDate(t); setRange('custom'); setPage(1); setDatePop(null); }}
                      onClear={() => { setFromDate(''); setToDate(''); setRange('all'); setPage(1); setDatePop(null); }}
                    />
                  </div>
                </>,
                document.body
              )}
            </div>
            {/* تعديل: وضع إدارة المرفقات (تغيير وحذف الملفات في عمود الإجراءات) */}
            <button
              type="button"
              onClick={() => setManageFiles(m => !m)}
              title={manageFiles ? t('finance:archive.finishFiles') : t('finance:archive.manageFiles')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer ${manageFiles ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/25' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-slate-900/5'}`}
            >
              {manageFiles ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              {manageFiles ? t('common:actions.done') : t('common:actions.edit')}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={visible.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t('common:print.print')}
            </button>
          </div>
        </div>

        {filesError && (
          <div className="mx-4 sm:mx-5 mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-200 dark:ring-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold">
            <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />{filesError}</span>
            <button type="button" onClick={clearError} className="p-0.5 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-[#eef2f8] dark:bg-[#1c2b44] text-[#1c3b6f] dark:text-blue-100 border-b-2 border-[#1c3b6f]/70 dark:border-blue-900 font-black text-[11.5px] whitespace-nowrap font-sans select-none">
                {HEADERS.map(h => <th key={h} className={th}>{h}</th>)}
                <th className={`${th} text-center`}>{t('finance:archive.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={HEADERS.length + 1} className="p-10 text-center text-sm text-slate-500 dark:text-slate-400 font-sans">
                    {t('finance:archive.petrol.empty')}
                  </td>
                </tr>
              ) : (
                pageRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition-colors whitespace-nowrap">
                    <td className={`${td} text-slate-400 font-sans text-center`}>{startIndex + idx + 1}</td>
                    <td className={`${td} font-bold text-slate-900 dark:text-white font-sans`}>{r.date}</td>
                    <td className={`${td} text-slate-600 dark:text-slate-300`}>{formatNumber(r.previous)}</td>
                    {stations.map(s => (
                      <td key={s.id} className={`${td} ${stationQty(r, s.id) ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'}`}>{formatNumber(stationQty(r, s.id))}</td>
                    ))}
                    <td className={`${td} font-bold text-red-600 dark:text-red-400`}>{formatNumber(r.totalConsumption)}</td>
                    <td
                      className={`${td} font-bold text-emerald-600 dark:text-emerald-400`}
                      title={r.inboundInternal ? t('finance:archive.petrol.inboundSplit', { external: formatNumber(r.inboundQty || 0), internal: formatNumber(r.inboundInternal) }) : undefined}
                    >
                      {formatNumber(inboundOf(r))}
                    </td>
                    <td className={`${td} font-black ${r.current < 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{formatNumber(r.current)}</td>
                    {/* الإجراءات: الملفات تُفتح بالضغط؛ التغيير والحذف فقط في وضع إدارة الملفات */}
                    <td className={`${td} font-sans`}>
                      <div className="flex items-center justify-center gap-1.5">
                        {/* أول ملفين فقط، والباقي خلف شارة +العدد */}
                        {(filesByRecord.get(r.id) || []).slice(0, MAX_INLINE_FILES).map(f => fileChip(f))}
                        {(filesByRecord.get(r.id)?.length ?? 0) > MAX_INLINE_FILES && (
                          <button
                            type="button"
                            onClick={e => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setFilesPop({ recordId: r.id, date: r.date, top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                            }}
                            title={t('finance:archive.viewFiles')}
                            className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-[10px] font-black font-mono cursor-pointer hover:brightness-110"
                            dir="ltr"
                          >
                            +{filesByRecord.get(r.id)!.length - MAX_INLINE_FILES}
                          </button>
                        )}
                        {/* الإرفاق: دائمًا لليوم بلا ملفات، ولليوم الذي فيه ملفات من وضع الإدارة فقط */}
                        {(manageFiles || !filesByRecord.get(r.id)?.length) && (
                        <label
                          title={t('finance:archive.attachHint')}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:ring-teal-400 hover:text-teal-700 dark:hover:text-teal-300 text-[10px] font-bold transition-colors ${busy === r.id ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
                        >
                          {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                          {busy === r.id ? t('finance:archive.uploading') : t('finance:archive.attach')}
                          <input
                            type="file"
                            multiple
                            accept={ACCEPT_FILES}
                            className="hidden"
                            onChange={e => {
                              const list = Array.from(e.target.files || []);
                              e.target.value = '';
                              if (list.length) upload(r.id, list);
                            }}
                          />
                        </label>
                        )}
                        {/* حذف اليوم كاملًا (وضع التعديل فقط) */}
                        {manageFiles && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ kind: 'day', id: r.id, date: r.date })}
                            title={t('finance:archive.deleteDay')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg ring-1 ring-rose-200 dark:ring-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950 text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('finance:archive.deleteDay')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {visible.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-t-2 border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-white whitespace-nowrap">
                  <td className={`${td} font-sans`} colSpan={3}>{t('finance:archive.total')} <span className="text-[10px] font-bold text-slate-400">({t('common:units.days', { count: visible.length })})</span></td>
                  {totals.stations.map((v, k) => <td key={k} className={td}>{formatNumber(v)}</td>)}
                  <td className={`${td} text-red-600 dark:text-red-400`}>{formatNumber(totals.consumption)}</td>
                  <td className={`${td} text-emerald-600 dark:text-emerald-400`}>{formatNumber(totals.inbound)}</td>
                  <td className={td}>{formatNumber(visible[0].current)}</td>
                  <td className={td} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {visible.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-600 dark:text-slate-400">
              <Trans
                t={t}
                i18nKey="common:pagination.showing"
                values={{ from: startIndex + 1, to: endIndex, total: visible.length }}
                components={{ 1: <strong className="font-bold text-slate-900 dark:text-white font-mono" />, 2: <strong className="font-bold text-teal-700 dark:text-teal-400 font-mono" /> }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4 ltr:rotate-180" />
                <span>{t('common:pagination.prev')}</span>
              </button>
              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => totalPages <= 5 || p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && p - arr[i - 1] > 1 && <span className="px-1 text-slate-400 font-mono">...</span>}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-xl font-bold font-mono text-xs cursor-pointer ${
                          safePage === p
                            ? 'bg-teal-600 text-white font-black'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
              >
                <span>{t('common:pagination.next')}</span>
                <ChevronLeft className="w-4 h-4 ltr:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
