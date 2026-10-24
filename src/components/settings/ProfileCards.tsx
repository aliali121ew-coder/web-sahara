import React, { useState } from 'react';
import { AtSign, Briefcase, Check, KeyRound, Loader2, PenLine, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { chatApi } from '../chat/chatApi';
import { UserAvatar, btnCls, inputCls } from '../admin/adminUi';
import { refreshProfile, useSessionProfile } from '../../lib/session';
import { errorText } from '../../i18n/errors';

const cardCls = 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-soft-card';

// ───── معلومات حسابي: الاسم قابل للتعديل؛ اسم المستخدم والوظيفة والصلاحيات بيد مدير النظام ─────
export const ProfileInfoCard: React.FC = () => {
  const { t } = useTranslation('settings');
  const profile = useSessionProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!profile) return null;

  const save = async () => {
    if (!name.trim()) return setError(t('profile.nameRequired'));
    setBusy(true);
    setError('');
    try {
      await chatApi.saveProfile({ name: name.trim(), avatar: profile.avatar });
      await refreshProfile();
      setEditing(false);
    } catch (e) {
      setError(errorText(e, 'server'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-4">
        <UserAvatar name={profile.name} color={profile.color} src={profile.avatar} size={64} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus className={inputCls}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
              <button onClick={save} disabled={busy} aria-label={t('profile.save')} className={`${btnCls} px-3 bg-blue-600 hover:bg-blue-700 text-white`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditing(false)} aria-label={t('profile.cancel')} className={`${btnCls} px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white truncate">{profile.name}</h3>
              {!!profile.is_admin && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" aria-label={t('profile.admin')} />}
              <button onClick={() => { setName(profile.name); setError(''); setEditing(true); }} aria-label={t('profile.editName')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                <PenLine className="w-4 h-4" />
              </button>
            </div>
          )}
          {error && <p className="text-xs font-bold text-rose-500 mt-1">{error}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5 text-sm">
        <Info icon={AtSign} label={t('profile.username')} value={`@${profile.username}`} ltr />
        <Info icon={Briefcase} label={t('profile.role')} value={profile.role || '—'} />
        <Info icon={ShieldCheck} label={t('profile.accountType')} value={profile.is_admin ? t('profile.admin') : t('profile.user')} />
      </div>
      <p className="text-[11px] text-slate-500 mt-3">{t('profile.hint')}</p>
    </div>
  );
};

const Info: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; ltr?: boolean }> = ({ icon: Icon, label, value, ltr }) => (
  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5">
    <div className="text-[11px] text-slate-500 flex items-center gap-1"><Icon className="w-3.5 h-3.5" />{label}</div>
    <div dir={ltr ? 'ltr' : undefined} className="font-bold text-slate-900 dark:text-white truncate text-start">{value}</div>
  </div>
);

// ───── تغيير كلمة المرور: يُسجَّل في سجل العمليات ويُخرج الحساب من الأجهزة الأخرى ─────
export const PasswordCard: React.FC = () => {
  const { t } = useTranslation('settings');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setMsg({ ok: false, text: t('password.min') });
    if (next !== confirm) return setMsg({ ok: false, text: t('password.mismatch') });
    setBusy(true);
    setMsg(null);
    try {
      await chatApi.changePassword(cur, next);
      setMsg({ ok: true, text: t('password.changed') });
      setCur('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'server') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={cardCls}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t('password.title')}</h3>
          <p className="text-xs text-slate-500">{t('password.text')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input type="password" dir="ltr" value={cur} onChange={e => setCur(e.target.value)} placeholder={t('password.current')} aria-label={t('password.current')} autoComplete="current-password" className={inputCls} />
        <input type="password" dir="ltr" value={next} onChange={e => setNext(e.target.value)} placeholder={t('password.new')} aria-label={t('password.new')} autoComplete="new-password" className={inputCls} />
        <input type="password" dir="ltr" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t('password.confirm')} aria-label={t('password.confirm')} autoComplete="new-password" className={inputCls} />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
        <button type="submit" disabled={busy || !cur || !next || !confirm} className={`${btnCls} bg-blue-600 hover:bg-blue-700 text-white`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('password.submit')}
        </button>
        {msg && <p className={`text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{msg.text}</p>}
      </div>
    </form>
  );
};
