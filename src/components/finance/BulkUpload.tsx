import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Files, Loader2, X, CheckCircle2, AlertTriangle, MinusCircle, Play, FileText, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../lib/usePermission';
import { BULK_ACCEPT, MAX_BULK_FILES, inspectFile, orderForRun, type BulkItem } from '../../lib/bulkUpload';
import { processBulkFile, type BulkResult } from '../../lib/bulkProcess';
import { SaharaFilePreview } from './SaharaFilePreview';

type RunState = { progress: number; result?: BulkResult };

/**
 * زر "رفع متعدد" في صفحة شركة الصحاري (يظهر لمن لديه صلاحية "الرفع المتعدد"):
 * يختار حتى 5 ملفات، يعرض نوع كل ملف وتاريخه (مع معاينة)، ثم يعالجها بالترتيب مباشرة
 * بشريط تقدم لكل ملف — بنفس منطق نافذة كل قسم (lib/bulkProcess.ts).
 */
export const BulkUploadButton: React.FC = () => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const { level, canEdit } = usePermissions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BulkItem[] | null>(null);
  const [reading, setReading] = useState(false);
  const [extra, setExtra] = useState(0);
  // معاينة ملف قبل البدء (من الجهاز مباشرة، لم يُرفع بعد)
  const [preview, setPreview] = useState<BulkItem | null>(null);
  // التنفيذ: تقدم ونتيجة كل ملف
  const [run, setRun] = useState<Record<string, RunState> | null>(null);
  const [running, setRunning] = useState(false);

  if (level('sahara.bulk-upload') < 1) return null;

  const choose = async (list: File[]) => {
    if (!list.length) return;
    setExtra(Math.max(0, list.length - MAX_BULK_FILES));
    setReading(true);
    setItems(null);
    setRun(null);
    const picked = await Promise.all(list.slice(0, MAX_BULK_FILES).map(f => inspectFile(f, canEdit)));
    setItems(picked);
    setReading(false);
  };
  const runnable = items ? orderForRun(items) : [];

  // بالترتيب (حسب التاريخ): الرصيد السابق لكل يوم يأتي من اليوم الذي قبله
  const start = async () => {
    setRunning(true);
    setRun(Object.fromEntries(runnable.map(i => [i.id, { progress: 0 }])));
    for (const it of runnable) {
      const result = await processBulkFile(it.kind!, it.file, p =>
        setRun(prev => prev && { ...prev, [it.id]: { ...prev[it.id], progress: Math.max(prev[it.id]?.progress ?? 0, p) } }));
      setRun(prev => prev && { ...prev, [it.id]: { progress: 100, result } });
    }
    setRunning(false);
  };
  const close = () => { if (!running) { setItems(null); setRun(null); } };

  const savedCount = run ? Object.values(run).filter(r => r.result?.status === 'saved').length : 0;
  const finished = !!run && !running;

  /** سبب عدم الحفظ أو ملاحظات الحفظ لملف */
  const resultText = (r: BulkResult) => {
    if (r.status === 'skipped') {
      if (r.reasons?.includes('readFailed')) return r.error || t('finance:bulk.reason.readFailed');
      return (r.reasons || []).map(x => t(`finance:bulk.reason.${x}`)).join(' — ');
    }
    const n = r.notes || {};
    return [
      n.unmatched?.length ? t('finance:bulk.note.unmatched', { list: n.unmatched.join('، ') }) : '',
      n.diff ? t('finance:bulk.note.diff', { diff: n.diff.toLocaleString('en-US') }) : '',
      n.attachFailed ? t('finance:bulk.note.attachFailed') : ''
    ].filter(Boolean).join(' — ');
  };

  return (
    <>
      <button
        type="button"
        disabled={reading || running}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-4 h-11 rounded-2xl bg-gradient-to-l from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white text-sm font-black shadow-md shadow-teal-600/25 cursor-pointer whitespace-nowrap active:scale-95 transition"
      >
        {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Files className="w-4 h-4" />}
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
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl font-cairo overflow-hidden">
            <div className="flex items-start gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0"><Files className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base text-slate-900 dark:text-white">{t('finance:bulk.title')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{finished ? t('finance:bulk.summary', { saved: savedCount, total: runnable.length }) : t('finance:bulk.hint')}</p>
              </div>
              {!running && (
                <button type="button" onClick={close} aria-label={t('common:actions.close')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
              )}
            </div>

            <ul className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
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
                {finished ? t('finance:bulk.confirmHint') : running ? t('finance:bulk.processing') : t('finance:bulk.willProcess', { count: runnable.length })}
              </p>
              {finished ? (
                <button type="button" onClick={close} className="h-10 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black cursor-pointer">{t('common:actions.done')}</button>
              ) : !running && (
                <>
                  <button type="button" onClick={close} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">{t('common:actions.cancel')}</button>
                  <button type="button" disabled={!runnable.length} onClick={() => void start()} className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-black flex items-center gap-1.5 cursor-pointer">
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
