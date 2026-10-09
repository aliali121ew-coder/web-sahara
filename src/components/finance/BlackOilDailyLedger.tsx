import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Droplets, Plus, Save, X, Pencil, Trash2, CalendarDays, Printer, ChevronRight, ChevronLeft, LayoutTemplate, Check, FileUp, Loader2, AlertTriangle, CheckCircle2, Warehouse } from 'lucide-react';
import { OfficialReportHeaderRow } from '../print/OfficialReportHeader';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import { formatNumber, getBusinessDate } from '../../lib/utils';
import { useTranslation, Trans } from 'react-i18next';
import { fmtList, fmtDate } from '../../i18n/format';
import { enumText } from '../../i18n/enums';
import { useBlackOilLedger, BlackOilRecord, BLACK_OIL_SITES, BLACK_OIL_SECTION_KEYS, type BlackOilCompany, type ComputedBlackOilRecord } from '../../lib/blackOilLedger';
import { readCentralTanks, useCentralTanks } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';
import { parseBlackOilReport } from '../../lib/blackOilReportFile';
import { useSaharaFiles, useReportAttach, removeDayFiles, type SaharaFile } from '../../lib/saharaFiles';
import { DayFilesCell, ReportAttachNotice } from './DayFilesCell';
import {
  withCommas, fmtInput, emptySiteForm, newBlackOilForm, applyBlackOilReport, blackOilDerived, blackOilRecord, blackOilSaveBlockers,
  type BlackOilForm, type SiteForm
} from '../../lib/blackOilForm';

export { getBlackOilAvgDaily, DEFAULT_BLACK_OIL_AVG_DAILY } from '../../lib/blackOilLedger';

const toInputDate = (d: string) => d.replace(/\//g, '-');
const fromInputDate = (d: string) => d.replace(/-/g, '/');
// منطق النموذج (يوم جديد، التعبئة من التقرير، الحسابات، السجل، شروط الحفظ) في lib/blackOilForm.ts
type FormState = BlackOilForm;

export const BlackOilDailyLedger: React.FC<{ variant?: 'recent' | 'archive'; company?: BlackOilCompany }> = ({ variant = 'recent', company = 'etihad' }) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const isArchive = variant === 'archive';
  const { records, computed, avgDaily, update } = useBlackOilLedger(company);
  // مرفقات الأيام في الأرشيف، وملف الكشف الذي عبّأ نافذة التسجيل (يُرفق باليوم عند الحفظ)
  const filesApi = useSaharaFiles(isArchive);
  const filesByRecord = useMemo(() => {
    const map = new Map<string, SaharaFile[]>();
    for (const f of filesApi.files) map.set(f.record_id, [...(map.get(f.record_id) || []), f]);
    return map;
  }, [filesApi.files]);
  const reportAttach = useReportAttach();
  const [reportFile, setReportFile] = useState<File | null>(null);
  // عنوان الطباعة: الصحاري لها كشفها الخاص
  // مواقع التخزين لهذه الشركة (الاتحاد: موقع الريان، موقع السكر)
  const sites = BLACK_OIL_SITES[company];
  const hasSites = sites.length > 0;
  const printTitle = t(company === 'sahara' ? 'finance:blackOil.print.titleSahara' : 'finance:blackOil.print.title');
  // صفحة النفط الأسود: آخر 7 أيام فقط، والأرشيف الكامل في صفحة التقارير
  const [range, setRange] = useState<'all' | 'week' | 'month' | 'custom'>(isArchive ? 'all' : 'week');
  // فترة مخصصة (من / إلى) في الأرشيف
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // موضع نافذة التقويم (تُعرض فوق الصفحة حتى لا تقصّها حواف البطاقة)
  const [datePop, setDatePop] = useState<{ top: number; left: number } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [page, setPage] = useState(1);
  // معاينة الطباعة (بنفس نمط كشف الوارد) واتجاه الورقة
  const [showPreview, setShowPreview] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const PAGE_SIZE = 10;

  const visible = useMemo(() => {
    if (range === 'custom') {
      return [...computed].reverse().filter(r => (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate));
    }
    const days = range === 'week' ? 6 : range === 'month' ? 29 : null; // 7 أيام أو 30 يومًا مع اليوم الحالي
    const rows = [...computed].reverse();
    if (!days) return rows;
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = getBusinessDate(from);
    return rows.filter(r => r.date >= fromStr);
  }, [computed, range, fromDate, toDate]);

  // الأرشيف: 10 سجلات لكل صفحة بنفس نمط أرشيف الوارد
  const totalPages = isArchive ? Math.max(1, Math.ceil(visible.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, totalPages);
  const startIndex = isArchive ? (safePage - 1) * PAGE_SIZE : 0;
  const pageRows = isArchive ? visible.slice(startIndex, startIndex + PAGE_SIZE) : visible;
  const endIndex = startIndex + pageRows.length;

  const totals = useMemo(() => {
    const inbound = visible.reduce((a, r) => a + r.inbound, 0);
    const consumption = visible.reduce((a, r) => a + r.consumption, 0);
    return { inbound, consumption, actualAvg: visible.length ? Math.round(consumption / visible.length) : 0 };
  }, [visible]);

  // تسجيل جديد: يوم جديد، حالية آخر يوم تصبح "سابقة"، والوارد والاستهلاك فارغان
  const openNew = () => {
    setForm(newBlackOilForm(computed, avgDaily, sites));
    setReportState({ status: 'idle' });
    setReportFile(null);
  };

  const openEdit = (id: string) => {
    const c = computed.find(x => x.id === id);
    if (!c) return;
    setForm({
      id: c.id,
      date: c.date,
      previous: c.previousOverride != null ? withCommas(String(c.previousOverride)) : '',
      editPrevious: c.previousOverride != null,
      inbound: c.inbound ? withCommas(String(c.inbound)) : '',
      consumption: c.consumption ? withCommas(String(c.consumption)) : '',
      avgDaily: withCommas(String(c.avgDaily)),
      price: fmtInput(c.price ?? null),
      sites: Object.fromEntries(sites.map(x => {
        const v = c.sites?.[x.key];
        return [x.key, v ? { inbound: fmtInput(v.inbound), consumption: fmtInput(v.consumption), actual: fmtInput(v.actual), empty: fmtInput(v.empty) } : emptySiteForm()];
      }))
    });
    setReportState({ status: 'idle' });
    setReportFile(null);
  };

  const derived = form ? blackOilDerived(form, computed, sites) : null;
  // مناسيب الخزانات الحالية: تُحفظ مع التسجيل الجديد
  const tankSnapshot = () => Object.fromEntries(readCentralTanks(OFFICIAL_TABLE_TANK_UNITS).map(t => [t.id, t.levelMeters]));
  const autoPrevious = derived?.autoPrevious ?? null;
  const fInbound = derived?.fInbound ?? 0;
  const fConsumption = derived ? derived.fConsumption : null;
  const fAvg = derived ? derived.fAvg : null;
  const derivedPrevious = derived?.derivedPrevious ?? null;
  const fCurrent = derived ? derived.fCurrent : null;
  const fPct = derived ? derived.fPct : null;
  const dateTaken = !!form && records.some(r => r.date === form.date && r.id !== form.id);
  const canSave = !!form && !!derived && blackOilSaveBlockers(form, derived, records).length === 0;

  const save = () => {
    if (!form || !canSave || !derived) return;
    const old = form.id ? records.find(r => r.id === form.id) : undefined;
    const rec: BlackOilRecord = blackOilRecord(form, derived!, old, tankSnapshot);
    update(prev => (form.id ? prev.map(r => (r.id === form.id ? rec : r)) : [...prev, rec]));
    if (reportFile) reportAttach.attach(rec.id, reportFile);
    setReportFile(null);
    setForm(null);
  };


  // ── تعبئة النافذة تلقائيًا من ملف التقرير اليومي (موقف الريان / موقف السكر) ──
  const [reportState, setReportState] = useState<
    { status: 'idle' } | { status: 'reading'; fileName: string } | { status: 'done'; fileName: string; found: string[] } | { status: 'error'; message: string }
  >({ status: 'idle' });
  const fillFromReport = async (file: File) => {
    if (!form) return;
    setReportState({ status: 'reading', fileName: file.name });
    setReportFile(null);
    try {
      const { sites: report, date } = await parseBlackOilReport(file, sites.map(x => ({ key: x.key, words: x.words })));
      setForm(f => f && applyBlackOilReport(f, report, date));
      setReportState({ status: 'done', fileName: file.name, found: sites.filter(x => report[x.key]).map(x => x.name) });
      setReportFile(file);
    } catch (err) {
      setReportState({ status: 'error', message: err instanceof Error ? err.message : t('finance:blackOil.readFailed') });
    }
  };

  // وضع التعديل (زر "تعديل" بجانب "تسجيل يوم"): يُظهر القلم والسلة في الجدول
  const [manage, setManage] = useState(false);
  const showActions = isArchive || manage;
  // تأكيد الحذف داخل التطبيق؛ الحذف من السجل اليومي يحذف اليوم من الأرشيف والتقارير تلقائيًا (نفس المصدر)
  const [confirmDel, setConfirmDel] = useState<{ id: string; date: string } | null>(null);
  const remove = (id: string) => {
    const r = records.find(x => x.id === id);
    if (r) setConfirmDel({ id, date: r.date });
  };
  const doRemove = () => {
    if (confirmDel) {
      update(prev => prev.filter(r => r.id !== confirmDel.id));
      removeDayFiles(confirmDel.id).catch(() => {});
    }
    setConfirmDel(null);
  };

  // أنماط نافذة الإدخال (مطابقة لنافذة الوارد)
  const field =
    'w-full h-11 sm:h-12 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all disabled:bg-slate-100 dark:disabled:bg-slate-900/60 disabled:text-slate-500';
  const fieldLabel = 'text-xs font-bold text-slate-700 dark:text-slate-200';
  const cardTitle = 'flex items-center gap-1.5 text-xs font-black text-purple-800 dark:text-purple-400 mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-700';
  const cardNum = 'w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-sans font-bold';
  const th = 'p-3.5 text-center';

  // ── أسطر عرض اليوم: صف لكل موقع + صف "إجمالي اليوم" عند أكثر من موقع ──
  // السعة: من التقرير (الرصيد الحقيقي + الفراغ)، وإلا من خزانات قسم النفط الأسود للشركة
  const [centralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const companyCapacity = useMemo(
    () => centralTanks.filter(t => t.sectionKey === BLACK_OIL_SECTION_KEYS[company]).reduce((a, t) => a + t.capacityLiters, 0),
    [centralTanks, company]
  );
  type Line = {
    kind: 'site' | 'total' | 'plain';
    key: string;
    name: string;
    previous: number;
    inbound: number;
    consumption: number;
    current: number;
    diff: number;
    empty: number | null;
    capacity: number | null;
  };
  const linesOf = (r: ComputedBlackOilRecord): Line[] => {
    if (!hasSites || !r.siteRows.length) {
      return [{ kind: 'plain', key: 'all', name: '—', previous: r.previous, inbound: r.inbound, consumption: r.consumption, current: r.current, diff: r.diff, empty: null, capacity: companyCapacity || null }];
    }
    const lines: Line[] = r.siteRows.map(x => ({ kind: 'site', key: x.key, name: x.name, previous: x.previous, inbound: x.inbound, consumption: x.consumption, current: x.current, diff: x.diff, empty: x.empty, capacity: x.capacity }));
    if (lines.length > 1) {
      const sum = (f: (l: Line) => number) => lines.reduce((a, l) => a + f(l), 0);
      const allEmpty = lines.every(l => l.empty !== null);
      const allCap = lines.every(l => l.capacity !== null);
      lines.push({
        kind: 'total', key: 'total', name: t('finance:blackOil.dayTotal'),
        previous: sum(l => l.previous), inbound: sum(l => l.inbound), consumption: sum(l => l.consumption),
        current: sum(l => l.current), diff: sum(l => l.diff),
        empty: allEmpty ? sum(l => l.empty as number) : null,
        capacity: allCap ? sum(l => l.capacity as number) : companyCapacity || null
      });
    }
    return lines;
  };
  const fillPct = (l: Line) => (l.capacity ? (l.current / l.capacity) * 100 : null);
  const weekday = (d: string) => fmtDate(d.replace(/\//g, '-') + 'T12:00:00', { weekday: 'long' });
  /** الفرق: سالب = نقص (أحمر)، موجب = زيادة (أخضر)، صفر = مطابق */
  const diffCell = (v: number) =>
    Math.abs(v) < 1 ? (
      <span className="text-slate-400" title={t('finance:blackOil.diffMatch')}>0</span>
    ) : (
      <span
        dir="ltr"
        className={`font-bold ${v < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}
        title={v < 0 ? t('finance:blackOil.diffShort') : t('finance:blackOil.diffOver')}
      >
        {v > 0 ? '+' : '−'}{formatNumber(Math.abs(v))}
      </span>
    );

  // نسخة الطباعة الرسمية للأرشيف (كل الأيام حسب الفلتر)
  const sheet = (
      <div className={`print-page-box bg-white text-slate-900 w-full ${orientation === 'landscape' ? 'min-h-[196mm]' : 'min-h-[279mm]'} flex flex-col gap-3 text-start font-cairo`} dir={i18n.dir()}>
        <header className="print-header border-b-[3px] border-double border-slate-900 pb-2">
          <OfficialReportHeaderRow compact={orientation === 'portrait'} badge={t('common:print.badgeOfficial')} title={printTitle} />
          <div className="mt-2 flex justify-between border border-slate-300 px-2.5 py-1 text-[9.5px]">
            <span className="text-slate-500 font-bold">{range === 'all' ? t('common:print.rangeAll') : range === 'month' ? t('common:print.rangeMonth') : range === 'week' ? t('common:print.rangeWeek') : t('common:print.rangeFromTo', { from: fromDate || '—', to: toDate || '—' })}</span>
            <span className="font-mono font-black">{visible.length ? `${visible[visible.length - 1].date} — ${visible[0].date}` : ''}</span>
            <span className="text-slate-500"><Trans t={t} i18nKey="common:print.printDate" values={{ date: getBusinessDate() }} components={{ 1: <span className="font-mono font-black text-slate-900" /> }} /></span>
          </div>
        </header>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              {[t('finance:blackOil.col.date'), ...(hasSites ? [t('finance:blackOil.col.site')] : []), t('finance:blackOil.col.previous'), t('finance:blackOil.col.inbound'), t('finance:blackOil.col.price'), t('finance:blackOil.col.consumption'), t('finance:blackOil.col.current'), t('finance:blackOil.col.diff'), ...(hasSites ? [t('finance:blackOil.col.empty')] : []), t('finance:blackOil.col.fill')].map(h => (
                <th key={h} className="bg-slate-900 text-white px-2 py-1.5 text-[9.5px] font-black text-center border border-slate-900">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const lines = linesOf(r);
              return lines.map((l, j) => {
                const f = fillPct(l);
                const isTotal = l.kind === 'total';
                return (
                  <tr key={`${r.id}-${l.key}`} className={isTotal ? 'bg-slate-100 font-black' : i % 2 ? 'bg-slate-50' : 'bg-white'}>
                    {j === 0 && <td rowSpan={lines.length} className="px-2 py-1 text-center font-mono font-bold border border-slate-200">{r.date}<div className="text-[8.5px] font-sans text-slate-500">{weekday(r.date)}</div></td>}
                    {hasSites && <td className="px-2 py-1 text-center font-bold border border-slate-200">{enumText(l.name)}</td>}
                    <td className="px-2 py-1 text-center font-mono border border-slate-200">{formatNumber(l.previous)}</td>
                    <td className="px-2 py-1 text-center font-mono border border-slate-200">{formatNumber(l.inbound)}</td>
                    {j === 0 && <td rowSpan={lines.length} className="px-2 py-1 text-center font-mono border border-slate-200">{r.price ? formatNumber(r.price) : '—'}</td>}
                    <td className="px-2 py-1 text-center font-mono border border-slate-200">{formatNumber(l.consumption)}</td>
                    <td className="px-2 py-1 text-center font-mono font-black border border-slate-200">{formatNumber(l.current)}</td>
                    <td className="px-2 py-1 text-center font-mono border border-slate-200" dir="ltr">{Math.abs(l.diff) < 1 ? '0' : `${l.diff > 0 ? '+' : '−'}${formatNumber(Math.abs(l.diff))}`}</td>
                    {hasSites && <td className="px-2 py-1 text-center font-mono border border-slate-200">{l.empty !== null ? formatNumber(l.empty) : '—'}</td>}
                    <td className="px-2 py-1 text-center font-mono border border-slate-200">{f === null ? '—' : `${f.toFixed(1)}%`}</td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
        <div className="grid grid-cols-3 gap-2 text-center mt-auto pt-4">
          {[t('common:print.role.tanks'), t('common:print.role.site'), t('common:print.role.general')].map(role => (
            <div key={role} className="border border-dashed border-slate-400 rounded p-1">
              <span className="text-[8.5px] font-black text-slate-800 block">{role}</span>
              <div className="h-5 border-b border-slate-200 my-0.5" />
              <span className="text-[7.5px] text-slate-500 block">{t('common:print.signature')}</span>
            </div>
          ))}
        </div>
      </div>
  );

  const printDoc = isArchive && (
    <div className="print-only">
      {/* اتجاه الورقة المختار في المعاينة (يتقدّم على الإعداد العام) */}
      <style>{`@media print { @page { size: A4 ${orientation}; margin: 6mm 8mm; } }`}</style>
      {sheet}
    </div>
  );

  const previewModal = isArchive && showPreview && createPortal(
    <div className="no-print fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" dir={i18n.dir()} onClick={() => setShowPreview(false)}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-6xl max-h-full flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
            <Printer className="w-5 h-5 text-purple-600" />
            {t('finance:blackOil.print.preview')}
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t('common:print.print')}
            </button>
            <button type="button" onClick={() => setShowPreview(false)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer" title={t('common:actions.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* ورقة محاكاة بنفس نسبة A4 */}
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

  return (
    <>
    {printDoc}
    {previewModal}
    {confirmDel && createPortal(
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150" dir={i18n.dir()} onClick={() => setConfirmDel(null)}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
          <div className="p-5 flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="font-black text-slate-900 dark:text-white"><Trans t={t} i18nKey="finance:blackOil.deleteDay" values={{ date: confirmDel.date }} components={{ 1: <span className="font-mono" /> }} /></div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('finance:blackOil.deleteText')}</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">{t('finance:blackOil.deleteWarning')}</p>
            </div>
          </div>
          <div className="px-5 pb-5 grid grid-cols-[auto_1fr] gap-2.5">
            <button type="button" autoFocus onClick={() => setConfirmDel(null)} className="px-5 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer">
              {t('common:actions.cancel')}
            </button>
            <button type="button" onClick={doRemove} className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all">
              <Trash2 className="w-4 h-4" />
              {t('finance:blackOil.deleteYes')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    <div className={`${isArchive ? 'no-print ' : ''}rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card overflow-hidden`}>
      <div className="p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Droplets className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>{isArchive ? t('finance:blackOil.archiveTitle') : t('finance:blackOil.title')}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isArchive ? t('finance:blackOil.archiveHint') : t('finance:blackOil.hint')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isArchive && (
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
              {([['all', t('common:enum.category.all')], ['month', t('common:print.rangeMonth')], ['week', t('common:print.rangeWeek')]] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setRange(k); setPage(1); }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    range === k ? 'bg-purple-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          {isArchive && (
            <div className="relative">
              {/* أيقونة التاريخ: تفتح نافذة صغيرة لتحديد الفترة (من / إلى) */}
              <button
                type="button"
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setDatePop(p => (p ? null : { top: r.bottom + 8, left: Math.max(8, r.left) }));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                  range === 'custom'
                    ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
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
          )}
          {isArchive ? (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={visible.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t('common:print.print')}
            </button>
          ) : (
          <>
          <button
            type="button"
            onClick={() => setManage(m => !m)}
            disabled={!visible.length && !manage}
            title={manage ? t('finance:blackOil.finishEditing') : t('finance:blackOil.manageDays')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              manage
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-slate-900/5'
            }`}
          >
            {manage ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {manage ? t('common:actions.done') : t('common:actions.edit')}
          </button>
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('finance:blackOil.recordDay')}
          </button>
          </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-xs border-collapse font-mono">
          <thead>
            <tr className="bg-[#eef2f8] dark:bg-[#1c2b44] text-[#1c3b6f] dark:text-blue-100 border-b-2 border-[#1c3b6f]/70 dark:border-blue-900 font-black text-[11.5px] whitespace-nowrap font-sans select-none">
              <th className={th}>{t('finance:blackOil.col.date')}</th>
              {hasSites && <th className={th}>{t('finance:blackOil.col.site')}</th>}
              <th className={th}>{t('finance:blackOil.col.previous')}</th>
              <th className={th}>{t('finance:blackOil.col.inbound')}</th>
              <th className={th}>{t('finance:blackOil.col.price')}</th>
              <th className={th}>{t('finance:blackOil.col.consumption')}</th>
              <th className={th}>{t('finance:blackOil.col.current')}</th>
              <th className={th} title={t('finance:blackOil.col.diffHint')}>{t('finance:blackOil.col.diff')}</th>
              {hasSites && <th className={th}>{t('finance:blackOil.col.empty')}</th>}
              <th className={th}>{t('finance:blackOil.col.fill')}</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={hasSites ? 11 : 9} className="p-10 text-center text-sm text-slate-500 dark:text-slate-400 font-sans">
                  {t('finance:blackOil.empty')}
                </td>
              </tr>
            ) : (
              pageRows.map(r => {
                // يوم فيه مواقع: صف لكل موقع + إجمالي اليوم، والتاريخ والإجراءات مدمجة لليوم
                const lines = linesOf(r);
                return lines.map((l, j) => {
                  const f = fillPct(l);
                  const isTotal = l.kind === 'total';
                  const ePct = l.empty !== null && l.capacity ? (l.empty / l.capacity) * 100 : null;
                  return (
                    <tr
                      key={`${r.id}-${l.key}`}
                      className={`transition-colors whitespace-nowrap ${
                        isTotal
                          ? 'bg-slate-50/80 dark:bg-slate-800/40 font-black'
                          : 'hover:bg-purple-50/30 dark:hover:bg-purple-950/20'
                      } ${j > 0 ? 'border-t border-dashed border-slate-100 dark:border-slate-800' : ''}`}
                    >
                      {j === 0 && (
                        <td rowSpan={lines.length} className="p-3.5 font-sans align-middle border-l border-slate-100 dark:border-slate-800">
                          <div className="font-bold text-slate-900 dark:text-white font-mono">{r.date}</div>
                          <div className="text-[10.5px] text-slate-400">{weekday(r.date)}</div>
                        </td>
                      )}
                      {hasSites && (
                        <td className="p-3.5 font-sans">
                          {l.kind === 'site' ? (
                            <span className="font-bold text-slate-800 dark:text-slate-100">{enumText(l.name)}</span>
                          ) : isTotal ? (
                            <span className="font-black text-slate-900 dark:text-white">{enumText(l.name)}</span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                      )}
                      <td className={`p-3.5 ${isTotal ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>{formatNumber(l.previous)}</td>
                      <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(l.inbound)}</td>
                      {j === 0 && (
                        <td rowSpan={lines.length} className="p-3.5 align-middle font-bold text-slate-900 dark:text-white border-x border-slate-100 dark:border-slate-800">
                          {r.price ? <>{formatNumber(r.price)} <span className="text-[10px] font-sans font-bold text-slate-400">{t('common:units.iqd')}</span></> : <span className="text-slate-400">—</span>}
                        </td>
                      )}
                      <td className="p-3.5 font-bold text-red-600 dark:text-red-400">{formatNumber(l.consumption)}</td>
                      <td className="p-3.5 font-black text-slate-900 dark:text-white">{formatNumber(l.current)}</td>
                      <td className="p-3.5">{diffCell(l.diff)}</td>
                      {hasSites && (
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {l.empty !== null ? (
                            <>
                              {formatNumber(l.empty)}
                              {ePct !== null && (
                                <span className="ms-2 inline-block px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold tabular-nums align-middle">
                                  {ePct.toFixed(1)}%
                                </span>
                              )}
                            </>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                      )}
                      <td className="p-3.5">
                        {f === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2.5 min-w-[140px]" title={`${t('finance:blackOil.capacity')}: ${formatNumber(l.capacity ?? 0)} ${t('common:units.liter')}`}>
                            <div className="flex-1 h-2.5 rounded-full bg-slate-200/80 dark:bg-slate-700/70 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-l from-purple-600 to-indigo-500" style={{ width: `${Math.min(100, Math.max(0, f))}%` }} />
                            </div>
                            <span className="w-12 text-end font-black tabular-nums text-slate-900 dark:text-white">{f.toFixed(1)}%</span>
                          </div>
                        )}
                      </td>
                      {j === 0 && (
                        <td rowSpan={lines.length} className="p-3.5 align-middle">
                          {showActions && (
                          <div className="flex items-center gap-1 justify-center animate-in fade-in duration-150">
                            {isArchive && <DayFilesCell recordId={r.id} files={filesByRecord.get(r.id) || []} manage api={filesApi} />}
                            <button type="button" onClick={() => openEdit(r.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer" title={t('common:actions.edit')}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer" title={t('common:actions.delete')}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                });
              })
            )}
          </tbody>
          {!isArchive && visible.length > 0 && (() => {
            // آخر يوم (الأحدث): الكمية الحالية والفراغ الحاليان
            const latestLines = linesOf(visible[0]);
            const latest = latestLines[latestLines.length - 1];
            const diffSum = visible.reduce((a, r) => a + r.diff, 0);
            return (
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-t-2 border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-white whitespace-nowrap">
                  <td className="p-3.5 font-sans" colSpan={hasSites ? 3 : 2}>{t('finance:blackOil.total')} <span className="text-[10px] font-bold text-slate-400">({t('common:units.days', { count: visible.length })})</span></td>
                  <td className="p-3.5 text-emerald-600 dark:text-emerald-400">{formatNumber(totals.inbound)}</td>
                  <td className="p-3.5" title={t('finance:blackOil.totalPriceHint')}>
                    {(() => {
                      const priced = visible.filter(r => r.price && r.inbound > 0);
                      const q = priced.reduce((a, r) => a + r.inbound, 0);
                      return q ? formatNumber(Math.round((priced.reduce((a, r) => a + r.price! * r.inbound, 0) / q) * 10) / 10) : '—';
                    })()}
                  </td>
                  <td className="p-3.5 text-red-600 dark:text-red-400">{formatNumber(totals.consumption)}</td>
                  <td className="p-3.5" title={t('finance:blackOil.totalCurrentHint')}>{formatNumber(latest.current)}</td>
                  <td className="p-3.5" title={t('finance:blackOil.totalDiffHint')}>{diffCell(diffSum)}</td>
                  {hasSites && <td className="p-3.5 text-slate-900 dark:text-white" title={t('finance:blackOil.totalEmptyHint')}>{latest.empty !== null ? formatNumber(latest.empty) : '—'}</td>}
                  <td className="p-3.5 font-sans text-[11px] text-slate-500" colSpan={2}>
                    {t('finance:blackOil.approvedAvg')}: <span className="font-mono font-black text-slate-900 dark:text-white">{formatNumber(avgDaily)}</span> {t('common:units.liter')}
                    <span className="text-slate-400 ms-2">({t('finance:blackOil.actual')}: <span className="font-mono">{formatNumber(totals.actualAvg)}</span>)</span>
                  </td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>

      {isArchive && visible.length > 0 && (
        <div className="p-4 sm:p-5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 dark:text-slate-400">
            <Trans
              t={t}
              i18nKey="common:pagination.showing"
              values={{ from: startIndex + 1, to: endIndex, total: visible.length }}
              components={{ 1: <strong className="font-bold text-slate-900 dark:text-white font-mono" />, 2: <strong className="font-bold text-purple-700 dark:text-purple-400 font-mono" /> }}
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
                          ? 'bg-purple-600 text-white font-black'
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

      {/* نافذة التسجيل / التعديل بنفس نمط نافذة الوارد */}
      {form && createPortal(
        <div className="no-print fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-3 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setForm(null)}>
          <div
            dir={i18n.dir()}
            onClick={e => e.stopPropagation()}
            className="relative w-[min(880px,94vw)] max-h-[96vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden font-cairo animate-in zoom-in-95 duration-150"
          >
            {/* الرأس */}
            <div className="px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Droplets className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                      {form.id ? t('finance:blackOil.form.editTitle') : t('finance:blackOil.form.newTitle')}
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono">
                      {form.date}
                    </span>
                  </div>
                  <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {t('finance:blackOil.form.formula')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ms-auto">
              {hasSites && (
                <label
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                    reportState.status === 'reading' ? 'opacity-60 pointer-events-none' : ''
                  } bg-purple-700 hover:bg-purple-800 text-white border-purple-700 shadow-sm`}
                  title={t('finance:blackOil.form.fillHint')}
                >
                  {reportState.status === 'reading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                  {t('finance:blackOil.form.fill')}
                  <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fillFromReport(f); }} />
                </label>
              )}
              <button
                type="button"
                onClick={() => setForm(null)}
                aria-label={t('common:actions.close')}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 cursor-pointer transition-all"
              >
                <X className="w-4.5 h-4.5 stroke-[2.5]" />
              </button>
              </div>
            </div>

            {/* البطاقات */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/40 dark:bg-slate-900/40">
              {/* نتيجة قراءة ملف التقرير */}
              {reportState.status === 'done' && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span><Trans t={t} i18nKey="finance:blackOil.form.filledFrom" values={{ file: reportState.fileName, sites: fmtList(reportState.found.map(n => enumText(n))) }} components={{ 1: <span className="font-mono" /> }} /></span>
                </div>
              )}
              {reportState.status === 'error' && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {reportState.message}
                </div>
              )}
              {/* 1. بيانات اليوم */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}>
                  <span className={cardNum}>1</span>
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>{t('finance:blackOil.form.dayData')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <label className="space-y-1">
                    <div className="min-h-5 flex items-center"><span className={fieldLabel}>{t('finance:blackOil.col.date')}</span></div>
                    <input type="date" className={field} value={toInputDate(form.date)} onChange={e => setForm({ ...form, date: fromInputDate(e.target.value) })} />
                  </label>
                  <div className="space-y-1">
                    <div className="min-h-5 flex items-center justify-between">
                      <span className={fieldLabel}>{t('finance:blackOil.form.previousL')}</span>
                      {autoPrevious !== null && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, editPrevious: !form.editPrevious, previous: form.editPrevious ? '' : withCommas(String(autoPrevious)) })}
                          className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          {form.editPrevious ? t('finance:blackOil.form.auto') : t('finance:blackOil.form.correct')}
                        </button>
                      )}
                    </div>
                    <input
                      inputMode="numeric"
                      dir="ltr"
                      className={field}
                      disabled={!form.editPrevious}
                      value={form.editPrevious ? form.previous : autoPrevious !== null ? formatNumber(autoPrevious) : ''}
                      placeholder={derivedPrevious !== null && autoPrevious === null ? t('finance:blackOil.form.fromReport', { value: formatNumber(derivedPrevious) }) : t('finance:blackOil.form.openingBalance')}
                      title={!form.editPrevious && autoPrevious !== null ? t('finance:blackOil.form.autoHint') : undefined}
                      onChange={e => setForm({ ...form, previous: withCommas(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* 2. حركة اليوم */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}>
                  <span className={cardNum}>2</span>
                  <Droplets className="w-3.5 h-3.5" />
                  <span>{t('finance:blackOil.form.dayMovement')}</span>
                </div>
                {hasSites && (
                  <div className="space-y-3 mb-3.5">
                    {sites.map(x => {
                      const f = form.sites[x.key] ?? emptySiteForm();
                      const setSite = (k: keyof SiteForm, v: string) => setForm({ ...form, sites: { ...form.sites, [x.key]: { ...f, [k]: withCommas(v) } } });
                      return (
                        <div key={x.key} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 p-3">
                          <div className="flex items-center gap-1.5 mb-2 text-xs font-black text-slate-800 dark:text-slate-100">
                            <Warehouse className="w-3.5 h-3.5 text-purple-600" />{enumText(x.name)}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {([
                              ['actual', t('finance:blackOil.form.actual')],
                              ['empty', t('finance:blackOil.form.empty')],
                              ['inbound', t('finance:blackOil.col.inbound')],
                              ['consumption', t('finance:blackOil.col.consumption')]
                            ] as const).map(([k, label]) => (
                              <label key={k} className="space-y-1">
                                <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">{label} <span className="text-slate-400">({t('common:units.liter')})</span></span>
                                <input inputMode="numeric" dir="ltr" className={field} value={f[k]} placeholder="0" onChange={e => setSite(k, e.target.value)} />
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <label className="space-y-1">
                    <div className="min-h-5 flex items-center"><span className={fieldLabel}>{hasSites ? t('finance:blackOil.form.totalInboundL') : t('finance:blackOil.form.inboundL')}</span></div>
                    <input inputMode="numeric" dir="ltr" autoFocus={!hasSites} disabled={hasSites} className={field} value={hasSites ? formatNumber(fInbound) : form.inbound} placeholder="0" onChange={e => setForm({ ...form, inbound: withCommas(e.target.value) })} />
                  </label>
                  <label className="space-y-1">
                    <div className="min-h-5 flex items-center"><span className={fieldLabel}>{hasSites ? t('finance:blackOil.form.totalConsumptionL') : t('finance:blackOil.form.consumptionL')}</span></div>
                    <input inputMode="numeric" dir="ltr" disabled={hasSites} className={field} value={hasSites ? formatNumber(fConsumption ?? 0) : form.consumption} placeholder="0" onChange={e => setForm({ ...form, consumption: withCommas(e.target.value) })} />
                  </label>
                  <label className="space-y-1">
                    <div className="min-h-5 flex items-center"><span className={fieldLabel}>{t('finance:blackOil.form.avgDailyL')}</span></div>
                    <input inputMode="numeric" dir="ltr" className={field} value={form.avgDaily} onChange={e => setForm({ ...form, avgDaily: withCommas(e.target.value) })} />
                  </label>
                  <label className="space-y-1">
                    <div className="min-h-5 flex items-center"><span className={fieldLabel}>{t('finance:blackOil.form.priceIqd')}</span></div>
                    <input
                      inputMode="decimal"
                      dir="ltr"
                      className={field}
                      value={form.price}
                      placeholder="0"
                      title={t('finance:blackOil.form.priceHint')}
                      onChange={e => setForm({ ...form, price: e.target.value.replace(/[^\d.,]/g, '') })}
                    />
                  </label>
                </div>
              </div>

              {/* 3. النتيجة المحسوبة */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}>
                  <span className={cardNum}>3</span>
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('finance:blackOil.form.result')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/50 p-3">
                    <div className="text-[11px] font-bold text-purple-700/80 dark:text-purple-300/80">{t('finance:blackOil.form.currentL')}</div>
                    <div className={`text-xl font-black font-mono ${fCurrent !== null && fCurrent < 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                      {fCurrent === null ? '0' : formatNumber(fCurrent)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                    <div className="text-[11px] font-bold text-slate-500">{t('finance:blackOil.form.consumptionRate')}</div>
                    <div className="text-xl font-black font-mono text-slate-900 dark:text-white">{fPct === null ? '—' : `${fPct.toFixed(1)}%`}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                    <div className="text-[11px] font-bold text-slate-500">{t('finance:blackOil.form.coverageDays')}</div>
                    <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
                      {fCurrent !== null && fAvg ? Math.max(0, Math.floor(fCurrent / fAvg)) : '—'} <span className="text-xs font-bold text-slate-400 font-sans">{t('finance:blackOil.form.daysUnit')}</span>
                    </div>
                  </div>
                </div>
                {dateTaken && <p className="mt-2 text-xs font-bold text-red-600">{t('finance:blackOil.form.duplicate')}</p>}
                {fCurrent !== null && fCurrent < 0 && <p className="mt-2 text-xs font-bold text-red-600">{t('finance:blackOil.form.negative')}</p>}
              </div>
            </div>

            {/* شريط الأزرار الثابت */}
            <div className="px-3 sm:px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 [&_button]:whitespace-nowrap">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 text-xs font-bold">
                    <span className="text-[11px]">{t('finance:blackOil.col.current')}:</span>
                    <span className="font-mono font-black">{fCurrent === null ? '0' : formatNumber(fCurrent)} {t('common:units.liter')}</span>
              </div>
              <div className="flex items-center gap-2.5 ms-auto">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer active:scale-95 transition-all"
                >
                  {t('common:actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  className="px-6 sm:px-8 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black shadow-lg shadow-purple-900/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{form.id ? t('common:actions.saveChanges') : t('finance:ledger.form.saveDay')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      <ReportAttachNotice state={reportAttach.state} onClose={reportAttach.dismiss} />
    </div>
    </>
  );
};

export default BlackOilDailyLedger;
