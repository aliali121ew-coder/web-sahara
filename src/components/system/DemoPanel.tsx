import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical, BookmarkCheck, RotateCcw, Loader2 } from 'lucide-react';
import { fmtDate } from '../../i18n/format';
import { systemApi, type DemoStatus } from './systemApi';
import { btnCls, cardCls, fullDate, timeAgo } from '../admin/adminUi';

/**
 * النسخة التجريبية (تظهر فيها فقط): اعتماد البيانات الحالية كبيانات أساسية،
 * وإعادة الضبط إليها الآن (تتم تلقائيًا كل ليلة).
 */
export const DemoPanel: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const { t } = useTranslation(['system', 'common']);
  const [st, setSt] = useState<DemoStatus | null>(null);
  const [busy, setBusy] = useState<'base' | 'reset' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'base' | 'reset' | null>(null);

  const load = useCallback(() => systemApi.demoStatus().then(setSt).catch(() => setSt(null)), []);
  useEffect(() => { load(); }, [load]);

  const run = async (kind: 'base' | 'reset') => {
    setConfirm(null);
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === 'base') {
        await systemApi.setDemoBase();
        setMsg({ ok: true, text: t('system:demo.baseDone') });
      } else {
        const r = await systemApi.demoReset();
        setMsg({ ok: true, text: t('system:demo.resetDone', { count: r.expiredAccounts }) });
      }
      await load();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={`${cardCls} p-5 border-2 !border-violet-200 dark:!border-violet-900`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0"><FlaskConical className="w-5 h-5" /></div>
        <div className="min-w-0">
          <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">{t('system:demo.title')}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{t('system:demo.text')}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-xs">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
          <dt className="text-slate-500 font-bold">{t('system:demo.base')}</dt>
          <dd className="font-black text-slate-900 dark:text-white mt-0.5" title={st?.base ? fullDate(st.base.created_at) : undefined}>
            {st?.base ? timeAgo(st.base.created_at) : <span className="text-amber-600">{t('system:demo.noBase')}</span>}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
          <dt className="text-slate-500 font-bold">{t('system:demo.lastReset')}</dt>
          <dd className="font-black text-slate-900 dark:text-white mt-0.5">{st?.lastReset ? timeAgo(st.lastReset.finished_at) : '—'}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
          <dt className="text-slate-500 font-bold">{t('system:demo.nextReset')}</dt>
          <dd className="font-black text-slate-900 dark:text-white mt-0.5">{st ? fmtDate(st.nextReset, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</dd>
        </div>
      </dl>

      {confirm ? (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900 p-3 space-y-2.5">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-200">{confirm === 'base' ? t('system:demo.confirmBase') : t('system:demo.confirmReset')}</p>
          <div className="flex gap-2">
            <button onClick={() => run(confirm)} className={`${btnCls} bg-violet-600 hover:bg-violet-700 text-white`}>{t('common:actions.confirm')}</button>
            <button onClick={() => setConfirm(null)} className={`${btnCls} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700`}>{t('common:actions.cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button disabled={!!busy} onClick={() => setConfirm('base')} className={`${btnCls} bg-violet-600 hover:bg-violet-700 text-white`}>
            {busy === 'base' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkCheck className="w-4 h-4" />}{t('system:demo.setBase')}
          </button>
          <button disabled={!!busy || !st?.base} onClick={() => setConfirm('reset')} className={`${btnCls} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}>
            {busy === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}{t('system:demo.resetNow')}
          </button>
        </div>
      )}
      {msg && <p className={`mt-3 text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{msg.text}</p>}
    </section>
  );
};
