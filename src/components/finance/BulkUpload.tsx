import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Files, Loader2, X, CheckCircle2, AlertTriangle, MinusCircle, Play, Square, FileText, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../lib/usePermission';
import {
  BULK_ACCEPT, MAX_BULK_FILES, bulkQueue, inspectFile, orderForRun, useBulkQueue, type BulkItem
} from '../../lib/bulkUpload';
import { SaharaFilePreview } from './SaharaFilePreview';

/**
 * زر "رفع متعدد" في صفحة شركة الصحاري (يظهر لمن لديه صلاحية "الرفع المتعدد"):
 * يختار حتى 5 ملفات، يعرض نوع كل ملف وتاريخه، ثم يفتح نافذة كل قسم بالترتيب معبّأة من ملفه.
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
  const q = useBulkQueue();

  if (level('sahara.bulk-upload') < 1) return null;

  const choose = async (list: File[]) => {
    if (!list.length) return;
    setExtra(Math.max(0, list.length - MAX_BULK_FILES));
    setReading(true);
    setItems(null);
    const picked = await Promise.all(list.slice(0, MAX_BULK_FILES).map(f => inspectFile(f, canEdit)));
    setItems(picked);
    setReading(false);
  };
  const runnable = items ? orderForRun(items) : [];
  const start = () => {
    bulkQueue.start(runnable);
    setItems(null);
  };

  return (
    <>
      <button
        type="button"
        disabled={q.running || reading}
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
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-slate-950/50" dir={i18n.dir()} onClick={() => setItems(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl font-cairo overflow-hidden">
            <div className="flex items-start gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0"><Files className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base text-slate-900 dark:text-white">{t('finance:bulk.title')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{t('finance:bulk.hint')}</p>
              </div>
              <button type="button" onClick={() => setItems(null)} aria-label={t('common:actions.close')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <ul className="p-3 space-y-2 max-h-[55vh] overflow-y-auto">
              {items.map(it => (
                <li key={it.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border ${it.problem ? 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" dir="auto">{it.file.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {it.kind ? t(`finance:bulk.kind.${it.kind}`) : t('finance:bulk.kind.none')}
                      {it.date && <span className="font-mono"> · {it.date}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => setPreview(it)} title={t('finance:bulk.preview')} aria-label={t('finance:bulk.preview')} className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer shrink-0">
                    <Eye className="w-4 h-4" />
                  </button>
                  {it.problem
                    ? <span className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300 text-end max-w-[45%]">{t(`finance:bulk.problem.${it.problem}`)}</span>
                    : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                </li>
              ))}
            </ul>
            {extra > 0 && <p className="px-5 text-[11px] font-bold text-amber-600">{t('finance:bulk.tooMany', { max: MAX_BULK_FILES, count: extra })}</p>}
            <div className="flex items-center gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <p className="flex-1 text-[11px] text-slate-500">{t('finance:bulk.willOpen', { count: runnable.length })}</p>
              <button type="button" onClick={() => setItems(null)} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">{t('common:actions.cancel')}</button>
              <button type="button" disabled={!runnable.length} onClick={start} className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-black flex items-center gap-1.5 cursor-pointer">
                <Play className="w-4 h-4" />{t('finance:bulk.start')}
              </button>
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

/** شريط التقدم أثناء الرفع المتعدد، والملخص بعد انتهائه */
export const BulkUploadBar: React.FC = () => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const q = useBulkQueue();
  if (!q.items.length) return null;
  const done = q.items.filter(i => i.status === 'saved' || i.status === 'skipped').length;
  const active = q.items.find(i => i.status === 'active');

  return createPortal(
    <div dir={i18n.dir()} className="no-print fixed z-[125] top-2 inset-x-3 sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 sm:w-[440px] rounded-2xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-900 shadow-xl p-3 font-cairo">
      {q.running ? (
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-slate-900 dark:text-white">{t('finance:bulk.progress', { n: done + 1, total: q.items.length })}</div>
            {active && <div className="text-[11px] text-slate-500 truncate" dir="auto">{t(`finance:bulk.kind.${active.kind}`)} · {active.file.name}</div>}
            <div className="text-[10.5px] text-slate-400">{t('finance:bulk.reviewHint')}</div>
          </div>
          <button type="button" onClick={() => bulkQueue.stop()} className="h-8 px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap">
            <Square className="w-3 h-3" />{t('finance:bulk.stop')}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="flex-1 text-xs font-black text-slate-900 dark:text-white">{t('finance:bulk.summary', { saved: q.items.filter(i => i.status === 'saved').length, total: q.items.length })}</span>
            <button type="button" onClick={() => bulkQueue.clear()} aria-label={t('common:actions.close')} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <ul className="space-y-1">
            {q.items.map(i => (
              <li key={i.id} className="flex items-center gap-2 text-[11px]">
                {i.status === 'saved' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : i.status === 'skipped' ? <MinusCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                <span className="flex-1 truncate text-slate-700 dark:text-slate-200" dir="auto">{i.file.name}</span>
                <span className="font-bold text-slate-500">{t(`finance:bulk.status.${i.status}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>,
    document.body
  );
};
