import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Files, Loader2, X, CheckCircle2, AlertTriangle, MinusCircle, Play, FileText, Eye, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../lib/usePermission';
import { BULK_ACCEPT, MAX_BULK_FILES, inspectFile, orderForRun, type BulkItem } from '../../lib/bulkUpload';
import { processBulkFile, type BulkInboundStore, type BulkResult } from '../../lib/bulkProcess';
import { useFuelStore } from '../../context/FuelDataContext';
import { warmFileReaders } from '../../lib/pdfDoc';
import { SaharaFilePreview } from './SaharaFilePreview';

type RunState = { progress: number; result?: BulkResult };

/**
 * زر "رفع متعدد" في صفحة شركة الصحاري (يظهر لمن لديه صلاحية "الرفع المتعدد"):
 * يفتح نافذة تقبل سحب الملفات وإفلاتها أو اختيارها (ويقبل الإفلات على الزر نفسه)، حتى 5 ملفات،
 * ومنها كشف وقود الاتحاد ووارد الاتحاد. يعرض نوع كل ملف وتاريخه (مع معاينة)، ثم يعالجها بالترتيب
 * مباشرة بشريط تقدم لكل ملف — بنفس منطق نافذة كل قسم (lib/bulkProcess.ts).
 */
export const BulkUploadButton: React.FC = () => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const { level, canEdit } = usePermissions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BulkItem[] | null>(null);
  // عدد الملفات التي لم تُقرأ بعد
  const [reading, setReading] = useState(0);
  const [extra, setExtra] = useState(0);
  // معاينة ملف قبل البدء (من الجهاز مباشرة، لم يُرفع بعد)
  const [preview, setPreview] = useState<BulkItem | null>(null);
  // التنفيذ: تقدم ونتيجة كل ملف
  const [run, setRun] = useState<Record<string, RunState> | null>(null);
  const [running, setRunning] = useState(false);
  // سحب ملفات فوق الزر أو منطقة الإفلات
  const [dragOver, setDragOver] = useState(false);
  // وارد الاتحاد يُضاف عبر مخزن التطبيق؛ ما أُضيف في نفس الرفع يُحسب حتى لا يتكرر من ملف آخر
  const { deliveries, addDelivery } = useFuelStore();
  const deliveriesRef = useRef(deliveries);
  deliveriesRef.current = deliveries;
  const addedRef = useRef<Parameters<BulkInboundStore['add']>[0][]>([]);

  const allowed = level('sahara.bulk-upload') >= 1;
  // تجهيز مكتبات القراءة في الخلفية قبل أن يضغط المستخدم (أول ضغطة كانت تجمّد الهاتف)
  useEffect(() => { if (allowed) warmFileReaders(); }, [allowed]);

  if (!allowed) return null;

  const choose = async (list: File[]) => {
    if (!list.length) return;
    const files = list.slice(0, MAX_BULK_FILES);
    setExtra(Math.max(0, list.length - MAX_BULK_FILES));
    setRun(null);
    // النافذة تفتح فورًا، والملفات تُقرأ واحدًا بعد الآخر وتظهر تباعًا
    // (قراءتها معًا كانت تجمّد الهاتف)
    setItems([]);
    setReading(files.length);
    for (const f of files) {
      const item = await inspectFile(f, canEdit);
      setItems(prev => [...(prev || []), item]);
      setReading(n => n - 1);
    }
  };
  const runnable = items ? orderForRun(items) : [];

  const inbound: BulkInboundStore = {
    existing: () => [...deliveriesRef.current, ...addedRef.current],
    add: d => { addedRef.current.push(d); addDelivery(d, d.company as 'صحاري كربلاء' | 'شركة الاتحاد'); },
  };

  // بالترتيب (حسب التاريخ): الرصيد السابق لكل يوم يأتي من اليوم الذي قبله
  const start = async () => {
    setRunning(true);
    addedRef.current = [];
    setRun(Object.fromEntries(runnable.map(i => [i.id, { progress: 0 }])));
    for (const it of runnable) {
      const result = await processBulkFile(it.kind!, it.file, p =>
        setRun(prev => prev && { ...prev, [it.id]: { ...prev[it.id], progress: Math.max(prev[it.id]?.progress ?? 0, p) } }), canEdit, { fileDate: it.date, inbound });
      setRun(prev => prev && { ...prev, [it.id]: { progress: 100, result } });
    }
    setRunning(false);
  };
  const close = () => { if (!running && !reading) { setItems(null); setRun(null); } };
  const busy = running || reading > 0;
  // الإفلات: يقبل الملفات المدعومة فقط، ولا يُقبل أثناء القراءة أو المعالجة
  const dropProps = {
    onDragOver: (e: React.DragEvent) => { if (busy || !e.dataTransfer.types.includes('Files')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (busy) return;
      void choose(Array.from(e.dataTransfer.files).filter(f => /\.(pdf|xlsx|xlsm|xls|csv)$/i.test(f.name)));
    },
  };

  const savedCount = run ? Object.values(run).filter(r => r.result?.status === 'saved').length : 0;
  const finished = !!run && !running;

  /** سبب عدم الحفظ أو ملاحظات الحفظ لملف */
  const resultText = (r: BulkResult) => {
    const n = r.notes || {};
    // تقرير النفط الأسود: نتيجة كل شركة على حدة
    const perCompany = n.companies
      ? (['sahara', 'etihad'] as const).filter(c => n.companies?.[c]).map(c => {
        const o = n.companies![c]!;
        return `${t(`finance:bulk.company.${c}`)}: ${o.saved ? t('finance:bulk.company.saved') : (o.reasons || []).map(x => t(`finance:bulk.reason.${x}`)).join('، ')}`;
      }).join(' — ')
      : '';
    if (r.status === 'skipped') {
      if (r.reasons?.includes('readFailed')) return r.error || t('finance:bulk.reason.readFailed');
      return perCompany || (r.reasons || []).map(x => t(`finance:bulk.reason.${x}`)).join(' — ');
    }
    return [
      perCompany,
      n.unmatched?.length ? t('finance:bulk.note.unmatched', { list: n.unmatched.join('، ') }) : '',
      n.diff ? t('finance:bulk.note.diff', { diff: n.diff.toLocaleString('en-US') }) : '',
      n.attachFailed ? t('finance:bulk.note.attachFailed') : '',
      n.tanksMissing?.length ? t('finance:bulk.note.tanksMissing', { list: n.tanksMissing.join('، ') }) : '',
      n.tanksOver?.length ? t('finance:bulk.note.tanksOver', { list: n.tanksOver.join('، ') }) : '',
      n.farmsFailed ? t('finance:bulk.note.farmsFailed') : '',
      n.inbound ? t('finance:bulk.note.inbound', { added: n.inbound.added, recorded: n.inbound.recorded }) : '',
      ...(n.annual || []).map(a => t('finance:bulk.note.annual', { site: n.site, year: a.year, added: a.added, changed: a.changed }))
    ].filter(Boolean).join(' — ');
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => { setRun(null); setExtra(0); setItems([]); }}
        {...dropProps}
        className={`flex items-center gap-2 px-4 h-11 rounded-2xl bg-gradient-to-l from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white text-sm font-black shadow-md shadow-teal-600/25 cursor-pointer whitespace-nowrap active:scale-95 transition ${dragOver && !items ? 'ring-4 ring-teal-300 scale-105' : ''}`}
      >
        {reading > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Files className="w-4 h-4" />}
        {t('finance:bulk.button')}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={BULK_ACCEPT}
        className="hidden"
        onChange={e => { const list = Array.from(e.target.files || []); e.target.value = ''; void choose(list); }}
      />

      {items && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-slate-950/50" dir={i18n.dir()} onClick={close}>
          <div onClick={e => e.stopPropagation()} {...dropProps} className={`relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border shadow-2xl font-cairo overflow-hidden ${dragOver ? 'border-teal-400 ring-4 ring-teal-400/30' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="flex items-start gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0"><Files className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base text-slate-900 dark:text-white">{t('finance:bulk.title')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{finished ? t('finance:bulk.summary', { saved: savedCount, total: runnable.length }) : t('finance:bulk.hint')}</p>
              </div>
              {!running && !reading && (
                <button type="button" onClick={close} aria-label={t('common:actions.close')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
              )}
            </div>

            {/* منطقة الإفلات: قبل اختيار الملفات، أو فوق القائمة أثناء السحب */}
            {!run && (!items.length && !reading ? (
              <button type="button" onClick={() => inputRef.current?.click()}
                className={`m-4 w-[calc(100%-2rem)] flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border-2 border-dashed transition cursor-pointer ${dragOver ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30' : 'border-teal-300 dark:border-teal-800 hover:bg-teal-50/60 dark:hover:bg-teal-950/20'}`}>
                <UploadCloud className={`w-9 h-9 text-teal-600 transition-transform ${dragOver ? 'scale-110 -translate-y-0.5' : ''}`} />
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('finance:bulk.dropTitle')}</span>
                <span className="text-[11px] text-slate-500">{t('finance:bulk.dropHint', { max: MAX_BULK_FILES })}</span>
              </button>
            ) : dragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-teal-50/90 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300">
                <UploadCloud className="w-10 h-10" />
                <span className="text-sm font-black">{t('finance:bulk.dropReplace')}</span>
              </div>
            ))}
            <ul className={`p-3 space-y-2 max-h-[60vh] overflow-y-auto ${!items.length ? 'hidden' : ''}`}>
              {items.map(it => {
                const st = run?.[it.id];
                const res = st?.result;
                const pct = Math.round(st?.progress ?? 0);
                return (
                  <li key={it.id} className={`px-3 py-2.5 rounded-2xl border ${it.problem ? 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20' : res?.status === 'skipped' ? 'border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20' : res?.status === 'saved' ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" dir="auto">{it.file.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {it.kind ? t(`finance:bulk.kind.${it.kind}`) : t('finance:bulk.kind.none')}
                          {(res?.date || it.date) && <span className="font-mono"> · {res?.date || it.date}</span>}
                        </div>
                      </div>
                      {!run && (
                        <button type="button" onClick={() => setPreview(it)} title={t('finance:bulk.preview')} aria-label={t('finance:bulk.preview')} className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer shrink-0">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {it.problem
                        ? <span className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300 text-end max-w-[45%]">{t(`finance:bulk.problem.${it.problem}`)}</span>
                        : res?.status === 'saved' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 animate-in zoom-in duration-200" />
                        : res?.status === 'skipped' ? <MinusCircle className="w-5 h-5 text-rose-500 shrink-0" />
                        : st ? <span className="text-xs font-black font-mono text-teal-700 dark:text-teal-300 w-10 text-end tabular-nums">{pct}%</span>
                        : <CheckCircle2 className="w-4 h-4 text-emerald-600/60 shrink-0" />}
                    </div>
                    {/* شريط التقدم 0 → 100 */}
                    {st && !it.problem && (
                      <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ease-out ${res?.status === 'skipped' ? 'bg-rose-400' : 'bg-gradient-to-l from-emerald-500 to-teal-500'} ${!res && pct > 0 ? 'animate-pulse' : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {res && resultText(res) && (
                      <p className={`mt-1.5 text-[11px] font-bold ${res.status === 'saved' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`}>
                        {res.status === 'saved' && <AlertTriangle className="inline w-3 h-3 me-1 -mt-0.5" />}
                        {resultText(res)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {extra > 0 && !run && <p className="px-5 text-[11px] font-bold text-amber-600">{t('finance:bulk.tooMany', { max: MAX_BULK_FILES, count: extra })}</p>}

            <div className="flex items-center gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <p className="flex-1 text-[11px] text-slate-500">
                {finished ? t('finance:bulk.confirmHint') : running ? t('finance:bulk.processing') : reading > 0 ? t('finance:bulk.reading', { count: reading }) : t('finance:bulk.willProcess', { count: runnable.length })}
              </p>
              {finished ? (
                <button type="button" onClick={close} className="h-10 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black cursor-pointer">{t('common:actions.done')}</button>
              ) : !running && (
                <>
                  <button type="button" onClick={close} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">{t('common:actions.cancel')}</button>
                  {items.length > 0 && !reading && (
                    <button type="button" onClick={() => inputRef.current?.click()} className="h-10 px-3 rounded-xl border border-teal-200 dark:border-teal-800 text-sm font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 cursor-pointer">
                      <UploadCloud className="w-4 h-4" />{t('finance:bulk.chooseOther')}
                    </button>
                  )}
                  <button type="button" disabled={!runnable.length || reading > 0} onClick={() => void start()} className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-black flex items-center gap-1.5 cursor-pointer">
                    <Play className="w-4 h-4" />{t('finance:bulk.start')}
                  </button>
                </>
              )}
              {running && <Loader2 className="w-5 h-5 animate-spin text-teal-600" />}
            </div>
          </div>
        </div>,
        document.body
      )}
      {preview && (
        <SaharaFilePreview
          file={{ id: preview.id, record_id: '', name: preview.file.name, type: preview.file.type, size: preview.file.size, created_at: Date.now() }}
          load={async () => preview.file}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
};
