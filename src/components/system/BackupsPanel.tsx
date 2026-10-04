import React, { useMemo, useState } from 'react';
import { DatabaseBackup, Download, RotateCcw, Trash2, Loader2, ShieldAlert, CheckCircle2, Archive, Plus, Fingerprint } from 'lucide-react';
import { systemApi, fmtBytes, fmtNum, type BackupRow } from './systemApi';
import { Dialog, KIND_META } from './systemUi';
import { Empty, KpiCard, Skeleton, btnCls, cardCls, chipCls, fullDate, inputCls, timeAgo } from '../admin/adminUi';

type Kind = '' | BackupRow['kind'];
const FILTERS: [Kind, string][] = [['', 'الكل'], ['daily', 'يومية'], ['manual', 'يدوية'], ['pre-restore', 'قبل الاسترجاع'], ['monthly', 'أرشيف شهري']];

export const BackupsPanel: React.FC<{ items: BackupRow[] | null; names: Record<string, string>; reload: () => Promise<unknown>; onChanged: () => void }> = ({ items, names, reload, onChanged }) => {
  const [kind, setKind] = useState<Kind>('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<BackupRow | null>(null);

  const list = useMemo(() => (items || []).filter(b => !kind || b.kind === kind), [items, kind]);
  const totals = useMemo(() => {
    const all = items || [];
    return {
      count: all.length,
      bytes: all.reduce((a, b) => a + b.size, 0),
      monthly: all.filter(b => b.kind === 'monthly').length,
      last: all.filter(b => b.kind !== 'monthly')[0],
    };
  }, [items]);

  const act = async (id: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(id);
    setError('');
    setNotice('');
    try {
      await fn();
      if (done) setNotice(done);
      await reload();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="عدد النسخ" value={fmtNum(totals.count)} icon={DatabaseBackup} tone="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" />
        <KpiCard label="حجمها في R2" value={fmtBytes(totals.bytes)} icon={Archive} tone="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" sub="مضغوطة بـ gzip" />
        <KpiCard label="أرشيفات شهرية" value={fmtNum(totals.monthly)} icon={Archive} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" sub="تُحفظ دائمًا" />
        <KpiCard label="آخر نسخة" value={totals.last ? timeAgo(totals.last.created_at) : '—'} icon={CheckCircle2} tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" sub={totals.last ? KIND_META[totals.last.kind]?.label : 'لا توجد نسخ بعد'} />
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {FILTERS.map(([id, label]) => (
              <button key={id} onClick={() => setKind(id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${kind === id ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>
          <button disabled={busy === 'run'} onClick={() => act('run', () => systemApi.runBackup(), 'تم أخذ نسخة يدوية وحفظها في R2')}
            className={`${btnCls} md:mr-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20`}>
            {busy === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} نسخة احتياطية الآن
          </button>
        </div>

        {(error || notice) && (
          <p role="status" className={`mx-4 sm:mx-5 mt-3 text-sm font-bold rounded-xl px-3 py-2 ${error ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>{error || notice}</p>
        )}

        <div className="p-4 sm:p-5">
          {!items ? <Skeleton rows={4} /> : !list.length ? <Empty icon={DatabaseBackup} title="لا توجد نسخ" hint="النسخة اليومية تُؤخذ تلقائيًا الساعة 3 فجرًا بتوقيت العراق" /> : (
            <ul className="space-y-2">
              {list.map(b => {
                const k = KIND_META[b.kind] || KIND_META.manual;
                const canRestore = b.kind !== 'monthly';
                const canDelete = b.kind === 'manual' || b.kind === 'pre-restore';
                return (
                  <li key={b.id} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                        {b.kind === 'monthly' ? <Archive className="w-5 h-5" /> : <DatabaseBackup className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <b className="text-sm text-slate-900 dark:text-white" title={fullDate(b.created_at)}>{new Date(b.created_at).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}</b>
                          <span className={`${chipCls} ${k.tone}`}>{k.label}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                          <span className="tabular-nums">{fmtBytes(b.size)}</span>
                          <span className="tabular-nums">{b.kind === 'monthly' ? `${fmtNum(b.tables)} نسخة مدمجة` : `${fmtNum(b.rows)} سطر · ${b.tables} جدول`}</span>
                          <span>{b.created_by === 'scheduler' ? 'تلقائي' : names[b.created_by] || '—'}</span>
                          <span className="inline-flex items-center gap-1 font-mono" dir="ltr" title={`SHA-256: ${b.sha256}`}><Fingerprint className="w-3 h-3" />{b.sha256.slice(0, 10)}</span>
                        </div>
                        {b.note && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{b.note}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button disabled={!!busy} onClick={() => act(b.id + 'd', () => systemApi.download(b))} title="تنزيل" className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-200">
                        {busy === b.id + 'd' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}<span className="hidden sm:inline">تنزيل</span>
                      </button>
                      {canRestore && (
                        <button disabled={!!busy} onClick={() => setRestoreTarget(b)} title="استرجاع" className="h-9 px-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-amber-100">
                          <RotateCcw className="w-4 h-4" /><span className="hidden sm:inline">استرجاع</span>
                        </button>
                      )}
                      {canDelete && (
                        <button disabled={!!busy} onClick={() => { if (window.confirm('حذف هذه النسخة نهائيًا من R2؟')) act(b.id, () => systemApi.deleteBackup(b.id), 'تم حذف النسخة'); }} title="حذف" aria-label="حذف النسخة"
                          className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 inline-flex items-center justify-center">
                          {busy === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {restoreTarget && (
        <RestoreDialog target={restoreTarget} onClose={() => setRestoreTarget(null)}
          onDone={msg => { setRestoreTarget(null); setNotice(msg); reload(); onChanged(); }} />
      )}
    </div>
  );
};

/** استرجاع بتأكيد مزدوج: كتابة «استرجاع» + إقرار، ثم التنفيذ */
const RestoreDialog: React.FC<{ target: BackupRow; onClose: () => void; onDone: (msg: string) => void }> = ({ target, onClose, onDone }) => {
  const [word, setWord] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = word.trim() === 'استرجاع' && ack;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await systemApi.restore(target.id);
      onDone(`تم الاسترجاع (${fmtNum(r.restoredRows)} سطر). نسخة ما قبل الاسترجاع محفوظة في قائمة النسخ. حدّث الصفحة لرؤية البيانات المُعادة.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog tone="danger" title="استرجاع نسخة احتياطية" onClose={busy ? () => {} : onClose}
      icon={<span className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/15 text-rose-600 flex items-center justify-center"><ShieldAlert className="w-5 h-5" /></span>}
      footer={<>
        <button disabled={!ready || busy} onClick={run} className={`${btnCls} flex-1 bg-rose-600 hover:bg-rose-700 text-white`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} {busy ? 'جارٍ الاسترجاع...' : 'استرجاع الآن'}
        </button>
        <button disabled={busy} onClick={onClose} className={`${btnCls} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>إلغاء</button>
      </>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
          <div className="font-bold text-slate-900 dark:text-white">{new Date(target.created_at).toLocaleString('ar-IQ', { dateStyle: 'full', timeStyle: 'short' })}</div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">{KIND_META[target.kind]?.label} · {fmtNum(target.rows)} سطر · {fmtBytes(target.size)}</div>
        </div>
        <ol className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-decimal pr-4">
          <li>تُستبدل بيانات النظام الحالية ببيانات هذه النسخة (الحسابات، الأقسام، الواردات، المحادثات).</li>
          <li>تؤخذ نسخة تلقائية من الوضع الحالي قبل البدء، للرجوع إليها عند الحاجة.</li>
          <li>تتوقف الكتابة على كل المستخدمين أثناء الاسترجاع (دقيقة أو أقل عادة).</li>
          <li>سجل العمليات والجلسات الحالية لا تتغير.</li>
        </ol>
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">للتأكيد اكتب كلمة <b className="text-rose-600">استرجاع</b></span>
          <input value={word} onChange={e => setWord(e.target.value)} disabled={busy} className={inputCls} autoComplete="off" />
        </label>
        <label className="flex items-start gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} disabled={busy} className="w-4 h-4 mt-0.5" />
          أفهم أن البيانات المُدخلة بعد تاريخ هذه النسخة ستُستبدل.
        </label>
        {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-xl px-3 py-2">{error}</p>}
      </div>
    </Dialog>
  );
};
