/* eslint-disable i18next/no-literal-string */
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, CalendarDays, CheckCircle2, AlertTriangle, Loader2, FileText } from 'lucide-react';

export type QueueState = 'wait' | 'read' | 'ok' | 'err';
export interface QueueItem { name: string; state: QueueState; message: string }

const todayIso = () => new Date().toISOString().slice(0, 10);
const yesterdayIso = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

/**
 * لوحة الرفع في وسط أعلى الصفحة: سحب وإفلات أو اختيار من الجهاز، وبجانبها تاريخ الكشف
 * (يُستخدم فقط لسطور الكشف التي بلا تاريخ)، وتحتها ملفات الرفع وحالة كل ملف.
 */
export const UploadPanel: React.FC<{
  queue: QueueItem[];
  busy: boolean;
  onFiles: (files: File[], fallbackDate: string) => void;
  onClose: () => void;
  onShowFiles: () => void;
}> = ({ queue, busy, onFiles, onClose, onShowFiles }) => {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  // قيمة حقل التاريخ بصيغة YYYY-MM-DD، وتُرسل للقراءة بصيغة الكشوف YYYY/MM/DD
  const [date, setDate] = useState(todayIso);

  const send = (list: FileList | null) => {
    const pdfs = [...(list || [])].filter(f => /\.pdf$/i.test(f.name));
    if (pdfs.length) onFiles(pdfs, date.replace(/-/g, '/'));
    if (input.current) input.current.value = '';
  };

  const done = queue.filter(q => q.state === 'ok').length;
  const failed = queue.filter(q => q.state === 'err').length;
  const pending = queue.length - done - failed;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-24 px-4 bg-slate-950/40 backdrop-blur-[3px]" onClick={onClose}>
      <section
        aria-label="لوحة رفع الكشوف"
        className="vehicle-kpi w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden font-cairo"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center"><Upload className="w-5 h-5" /></span>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">رفع كشوف التفويل</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">PDF فقط · يُقرأ التاريخ من ملاحظات الكشف تلقائيًا</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3.5 px-6">
          <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => send(e.target.files)} />
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files); }}
            className={`h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2.5 text-center transition-all ${
              drag ? 'border-sky-500 bg-sky-100 dark:bg-sky-900/40 scale-[1.01]' : 'border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/20'
            }`}
          >
            <span className={`w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm text-sky-600 dark:text-sky-400 flex items-center justify-center ${drag ? '' : 'vehicle-float'}`}><FileText className="w-6 h-6" /></span>
            <div className="text-sm font-black text-sky-900 dark:text-sky-200">{drag ? 'أفلت الملفات هنا' : 'اسحب الكشوف وأفلتها هنا'}</div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              أو
              <button type="button" onClick={() => input.current?.click()} className="px-3.5 py-2 rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 text-xs font-black hover:bg-sky-50 dark:hover:bg-sky-950 cursor-pointer">اختيار من الجهاز</button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <label htmlFor="vehicle-sheet-date" className="text-xs font-black text-slate-700 dark:text-slate-200">تاريخ الكشف</label>
            <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus-within:border-sky-500">
              <CalendarDays className="w-4 h-4 text-sky-600 shrink-0" />
              <input id="vehicle-sheet-date" type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)} className="w-full bg-transparent outline-none text-sm font-bold font-mono text-slate-900 dark:text-white" />
            </div>
            <div className="flex gap-1.5">
              {[['اليوم', todayIso()], ['أمس', yesterdayIso()]].map(([l, v]) => (
                <button key={l} type="button" onClick={() => setDate(v)} className={`flex-1 h-8 rounded-lg text-xs font-black border cursor-pointer transition-colors ${date === v ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-300'}`}>{l}</button>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">يُستخدم فقط إن لم يحتوِ الكشف على تاريخ.</p>
          </div>
        </div>

        {queue.length > 0 && (
          <div className="mx-6 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                ملفات الرفع
                <span className="h-5 px-2 inline-flex items-center rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px]">{queue.length}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="text-emerald-700 dark:text-emerald-400 font-black">{done} مكتملة</span>
                {pending > 0 && <> · {pending} قيد المعالجة</>}
                {failed > 0 && <> · <span className="text-rose-600 dark:text-rose-400 font-black">{failed} تعذّرت</span></>}
              </div>
            </div>
            <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto">
              {queue.map((q, i) => (
                <li key={`${q.name}-${i}`} className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border ${q.state === 'read' ? 'border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30' : q.state === 'err' ? 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                  <span className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 text-[9px] font-black flex items-center justify-center shrink-0">PDF</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span className="truncate text-slate-800 dark:text-slate-100">{q.name}</span>
                      <span className={`shrink-0 truncate max-w-[55%] ${q.state === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : q.state === 'err' ? 'text-rose-600 dark:text-rose-400' : 'text-sky-700 dark:text-sky-300'}`} title={q.message}>
                        {q.state === 'wait' ? 'في الانتظار' : q.state === 'read' ? 'جارٍ قراءة الصفوف…' : q.message}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${q.state === 'ok' ? 'w-full bg-emerald-500' : q.state === 'err' ? 'w-full bg-rose-400' : q.state === 'read' ? 'w-2/3 bg-sky-500 animate-pulse' : 'w-0'}`} />
                    </div>
                  </div>
                  {q.state === 'ok' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    : q.state === 'err' ? <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                    : q.state === 'read' ? <Loader2 className="w-5 h-5 text-sky-600 animate-spin shrink-0" />
                    : <span className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700 shrink-0" />}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-4 px-6 py-3.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">{busy ? 'يمكنك إخفاء اللوحة وسيستمر الرفع' : queue.length ? 'اكتمل الرفع' : 'يمكن رفع عدة ملفات معًا'}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">إخفاء</button>
            <button type="button" onClick={onShowFiles} className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-black cursor-pointer">عرض الملفات</button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
};
