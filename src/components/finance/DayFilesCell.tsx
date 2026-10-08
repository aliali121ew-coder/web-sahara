import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, FileText, FileSpreadsheet, Loader2, RefreshCw, Trash2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fileKind, ACCEPT_FILES, type SaharaFile, type ReportAttachState, type useSaharaFiles } from '../../lib/saharaFiles';
import { SaharaFilePreview } from './SaharaFilePreview';

type FilesApi = ReturnType<typeof useSaharaFiles>;

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * مرفقات يوم في جدول أرشيف: شارة لكل ملف تفتح المعاينة، وزر "إرفاق" لليوم بلا ملفات،
 * والتغيير والحذف في وضع الإدارة فقط (بنفس نمط أرشيف رصيد الصحاري).
 */
export const DayFilesCell: React.FC<{ recordId: string; files: SaharaFile[]; manage: boolean; api: FilesApi }> = ({ recordId, files, manage, api }) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const [preview, setPreview] = useState<SaharaFile | null>(null);
  const [confirm, setConfirm] = useState<SaharaFile | null>(null);
  const { busy, upload, remove, replace } = api;

  return (
    <>
      {files.map(f => {
        const isPdf = fileKind(f) === 'pdf';
        const Icon = isPdf ? FileText : FileSpreadsheet;
        return (
          <span
            key={f.id}
            className={`inline-flex items-center rounded-lg ring-1 overflow-hidden ${isPdf ? 'bg-rose-50 ring-rose-200 text-rose-600 dark:bg-rose-950/40 dark:ring-rose-900 dark:text-rose-300' : 'bg-emerald-50 ring-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:ring-emerald-900 dark:text-emerald-300'}`}
          >
            <button
              type="button"
              onClick={() => setPreview(f)}
              title={`${f.name} (${formatSize(f.size)})`}
              className="flex items-center gap-1 ps-1.5 pe-1 py-1 text-[10px] font-black cursor-pointer hover:brightness-95"
            >
              {busy === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
              {isPdf ? 'PDF' : 'Excel'}
            </button>
            {manage && (
              <>
                <label title={t('finance:archive.changeFile')} className="px-1 py-1 border-s border-black/10 dark:border-white/10 opacity-60 hover:opacity-100 cursor-pointer">
                  <RefreshCw className="w-3 h-3" />
                  <input
                    type="file"
                    accept={ACCEPT_FILES}
                    className="hidden"
                    onChange={e => { const next = e.target.files?.[0]; e.target.value = ''; if (next) replace(f, next); }}
                  />
                </label>
                <button type="button" onClick={() => setConfirm(f)} title={t('finance:archive.deleteFile')} className="px-1 py-1 opacity-60 hover:opacity-100 cursor-pointer">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </span>
        );
      })}
      {(manage || !files.length) && (
        <label
          title={t('finance:archive.attachHint')}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:ring-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-[10px] font-bold transition-colors ${busy === recordId ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
        >
          {busy === recordId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
          {busy === recordId ? t('finance:archive.uploading') : t('finance:archive.attach')}
          <input
            type="file"
            multiple
            accept={ACCEPT_FILES}
            className="hidden"
            onChange={e => { const list = Array.from(e.target.files || []); e.target.value = ''; if (list.length) upload(recordId, list); }}
          />
        </label>
      )}
      {preview && <SaharaFilePreview file={preview} onClose={() => setPreview(null)} />}
      {confirm && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150" dir={i18n.dir()} onClick={() => setConfirm(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 font-cairo">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5" /></div>
              <div className="min-w-0">
                <div className="font-black text-slate-900 dark:text-white">{t('finance:archive.deleteFileTitle')}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 break-all">{confirm.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer">
                {t('common:actions.cancel')}
              </button>
              <button type="button" onClick={() => { remove(confirm.id); setConfirm(null); }} className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer">
                <Trash2 className="w-4 h-4" />
                {t('finance:blackOil.deleteYes')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

/** إشعار صغير أسفل الشاشة: ملف الكشف يُحفظ في الأرشيف / حُفظ / فشل */
export const ReportAttachNotice: React.FC<{ state: ReportAttachState; onClose: () => void }> = ({ state, onClose }) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  if (state.status === 'idle') return null;
  const tone = state.status === 'error'
    ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200';
  return createPortal(
    <div dir={i18n.dir()} className={`no-print fixed z-[160] bottom-4 inset-x-4 sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 sm:max-w-md flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-xl text-xs font-bold font-cairo animate-in fade-in slide-in-from-bottom-2 duration-200 ${tone}`}>
      {state.status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin shrink-0 text-teal-600" />
        : state.status === 'done' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
        : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">
        {state.status === 'saving' ? t('finance:archive.reportSaving', { name: state.name })
          : state.status === 'done' ? t('finance:archive.reportSaved')
          : t('finance:archive.reportFailed', { message: state.message })}
      </span>
      {state.status !== 'saving' && (
        <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="p-0.5 rounded-md opacity-60 hover:opacity-100 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>,
    document.body
  );
};
