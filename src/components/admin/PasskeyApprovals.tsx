import React, { useMemo, useState } from 'react';
import { Fingerprint, Clock, ShieldCheck, Check, X, Trash2, Loader2, Search, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { chatApi, type AdminPasskey } from '../chat/chatApi';
import { errorText } from '../../i18n/errors';
import { Empty, KpiCard, Skeleton, UserAvatar, btnCls, cardCls, fullDate, inputCls, timeAgo } from './adminUi';

/** وصف الجهاز من بصمة المتصفح المحفوظة مع البصمة */
const deviceName = (ua: string) => {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android' : 'Android Tablet';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  return ua.split(/[ (]/)[0] || '—';
};

/**
 * بصمات الأجهزة (الدخول بالوجه / الإصبع): بصمة جهاز جديد لحساب موظف لا تعمل حتى يعتمدها مدير النظام،
 * لأن الموقع لا يرى الوجه نفسه، فمن يعرف كلمة المرور يستطيع إضافة وجهه من هاتفه
 */
export const PasskeyApprovals: React.FC<{ items: AdminPasskey[] | null; reload: () => Promise<unknown> }> = ({ items, reload }) => {
  const { t } = useTranslation('admin');
  const [view, setView] = useState<'pending' | 'approved'>('pending');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const all = items || [];
  const pending = all.filter(p => !p.approved);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter(p => (view === 'pending' ? !p.approved : !!p.approved)
      && (!term || p.name.toLowerCase().includes(term) || p.username.toLowerCase().includes(term)));
  }, [all, view, q]);

  const act = async (p: AdminPasskey, approve: boolean) => {
    if (!approve && p.approved && !window.confirm(t('devices.confirmRemove'))) return;
    setBusy(p.id);
    setError('');
    try {
      await (approve ? chatApi.adminPasskeyApprove(p.id) : chatApi.adminPasskeyRemove(p.id));
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label={t('devices.pending')} value={pending.length} icon={Clock} onClick={() => setView('pending')} active={view === 'pending'}
          tone={pending.length ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'} />
        <KpiCard label={t('devices.approved')} value={all.length - pending.length} icon={ShieldCheck} onClick={() => setView('approved')} active={view === 'approved'}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" />
        <KpiCard label={t('devices.total')} value={all.length} icon={Fingerprint} tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
      </div>

      <div className={`${cardCls} p-4 sm:p-5 space-y-4`}>
        <p className="text-[13px] leading-6 text-slate-600 dark:text-slate-400 flex gap-2">
          <Fingerprint className="w-4 h-4 shrink-0 mt-1 text-violet-500" /> {t('devices.hint')}
        </p>
        <div className="relative">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('devices.search')} className={`${inputCls} ps-9`} />
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}

        {!items ? <Skeleton /> : !list.length ? (
          <Empty icon={Fingerprint} title={view === 'pending' ? t('devices.noPending') : t('devices.empty')} />
        ) : (
          <ul className="space-y-2">
            {list.map(p => (
              <li key={p.id} className={`rounded-2xl border p-3 sm:p-3.5 flex flex-wrap items-center gap-3 ${p.approved
                ? 'border-slate-200 dark:border-slate-800' : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-500/5'}`}>
                <UserAvatar name={p.name} color={p.color} src={p.avatar || undefined} size={42} />
                <div className="flex-1 min-w-[10rem]">
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{p.name} <span dir="ltr" className="text-xs font-semibold text-slate-400">@{p.username}</span></div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-slate-500">
                    <span className="inline-flex items-center gap-1" title={p.label}><Smartphone className="w-3.5 h-3.5" /> {deviceName(p.label)}</span>
                    <span title={fullDate(p.created_at)}>{t('devices.added', { time: timeAgo(p.created_at) })}</span>
                    {!!p.approved && <span>{p.last_used ? t('devices.lastUsed', { time: timeAgo(p.last_used) }) : t('devices.neverUsed')}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ms-auto">
                  {busy === p.id ? <Loader2 className="w-5 h-5 animate-spin text-slate-400 m-2" /> : p.approved ? (
                    <button type="button" onClick={() => act(p, false)} className={`${btnCls} bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300`}>
                      <Trash2 className="w-4 h-4" /> {t('devices.remove')}
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => act(p, true)} className={`${btnCls} bg-emerald-600 text-white`}>
                        <Check className="w-4 h-4" /> {t('devices.approve')}
                      </button>
                      <button type="button" onClick={() => act(p, false)} className={`${btnCls} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>
                        <X className="w-4 h-4" /> {t('devices.reject')}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
