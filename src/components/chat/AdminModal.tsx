import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserPlus, Search, Loader2, KeyRound, Ban, CheckCircle2, Crown, Copy, Check, ArrowRight, RefreshCw, Inbox, Phone, RotateCcw } from 'lucide-react';
import { Avatar } from './Avatar';
import { chatApi, type Account, type SupportRequest } from './chatApi';
import { Btn, Field, Modal, inputCls } from './ChatModals';
import { formatDay, lastSeenText } from './chatUtils';
import type { ChatStore } from './useChat';

/** كلمة مرور عشوائية سهلة الإملاء (بدون أحرف ملتبسة مثل 0/O و 1/l) */
const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, x => chars[x % chars.length]).join('');
};

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; acc: Account } | { kind: 'issued'; acc: { name: string; username: string }; password: string };

export const AdminModal: React.FC<{ store: ChatStore; onClose: () => void }> = ({ store, onClose }) => {
  const { t } = useTranslation(['chat', 'common']);
  const [items, setItems] = useState<Account[] | null>(null);
  const [max, setMax] = useState(100);
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'accounts' | 'support'>('accounts');
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const loadRequests = () => chatApi.adminSupport().then(r => setRequests(r.items)).catch(e => setError((e as Error).message));
  useEffect(() => { loadRequests(); }, []);
  const openRequests = (requests || []).filter(r => r.status === 'open').length;

  const load = () =>
    chatApi.adminUsers().then(r => { setItems(r.items); setMax(r.max); }).catch(e => setError((e as Error).message));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items || []).filter(a => !t || a.name.toLowerCase().includes(t) || a.username.includes(t) || a.role.toLowerCase().includes(t));
  }, [items, q]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (view.kind === 'create') return <AccountForm onBack={() => setView({ kind: 'list' })} onDone={(acc, password) => { load(); setView({ kind: 'issued', acc, password: password || '' }); }} />;
  if (view.kind === 'edit') {
    return (
      <AccountForm
        acc={view.acc}
        self={view.acc.id === store.meId}
        onBack={() => setView({ kind: 'list' })}
        onDone={(acc, password) => { load(); setView(password ? { kind: 'issued', acc, password } : { kind: 'list' }); }}
      />
    );
  }
  if (view.kind === 'issued') return <Issued acc={view.acc} password={view.password} onBack={() => setView({ kind: 'list' })} />;

  const active = (items || []).length;
  return (
    <Modal
      wide
      title={t('chat:modals.manageAccounts')}
      icon={<ShieldCheck className="w-5 h-5" />}
      onClose={onClose}
      footer={tab === 'accounts' ? (
        <Btn className="flex-1" disabled={active >= max} onClick={() => setView({ kind: 'create' })}>
          <UserPlus className="w-4 h-4" /> {t('chat:admin.addAccount')}
        </Btn>
      ) : undefined}
    >
      {/* التبويبات */}
      <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-2xl cx-soft mb-3">
        {([['accounts', t('chat:admin.accounts')], ['support', t('chat:admin.support')]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${tab === id ? 'cx-accent-bg shadow' : 'cx-hover'}`}>
            {label}
            {id === 'support' && openRequests > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">{openRequests}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'support' ? (
        <SupportList items={requests} onToggle={(r) => run(() => chatApi.adminSupportStatus(r.id, r.status === 'open' ? 'done' : 'open')).then(ok => { if (ok) loadRequests(); })} busy={busy} error={error}
          onCreate={() => { setTab('accounts'); setView({ kind: 'create' }); }} />
      ) : (<>
      {/* عدّاد السعة */}
      <div className="rounded-2xl cx-soft p-3 mb-3">
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span>{t('chat:admin.used')}</span>
          <span dir="ltr" className="cx-accent">{active} / {max}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full cx-accent-bg transition-all" style={{ width: `${Math.min(100, (active / max) * 100)}%` }} />
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 cx-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('chat:admin.search')} className={`${inputCls} ps-10`} />
      </div>
      {error && <p className="text-sm text-rose-500 mb-2">{error}</p>}
      {!items && !error && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin cx-accent" /></div>}

      <ul className="space-y-1.5">
        {filtered.map(a => (
          <li key={a.id} className={`flex items-center gap-3 p-2 rounded-2xl cx-hover ${a.disabled ? 'opacity-55' : ''}`}>
            <Avatar id={a.id} name={a.name} src={a.avatar} color={a.color} size={42} />
            <button onClick={() => setView({ kind: 'edit', acc: a })} className="flex-1 min-w-0 text-start">
              <div className="flex items-center gap-1.5 font-bold text-sm truncate">
                {a.name}
                {!!a.is_admin && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                {a.id === store.meId && <span className="text-[10px] cx-muted">{t('chat:admin.youParen')}</span>}
              </div>
              <div className="text-[11px] cx-muted truncate">
                <span dir="ltr">@{a.username}</span>{a.role ? ` · ${a.role}` : ''} · {a.disabled ? t('chat:admin.suspended') : a.last_seen ? lastSeenText(a.last_seen) : t('chat:admin.neverSignedIn')}
              </div>
            </button>
            {a.id !== store.meId && (
              <button
                disabled={busy}
                onClick={() => run(() => chatApi.adminUpdate(a.id, { disabled: !a.disabled })).then(ok => { if (ok) load(); })}
                title={a.disabled ? t('chat:admin.activate') : t('chat:admin.suspend')}
                className={`w-9 h-9 rounded-xl flex items-center justify-center cx-hover ${a.disabled ? 'text-emerald-500' : 'text-rose-500'}`}
              >
                {a.disabled ? <CheckCircle2 className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
              </button>
            )}
          </li>
        ))}
        {items && !filtered.length && <li className="text-center text-sm cx-muted py-6">{t('chat:admin.noResults')}</li>}
      </ul>
      </>)}
    </Modal>
  );
};

// ───── طلبات الدعم الواردة من شاشة الدخول ─────

const SupportList: React.FC<{ items: SupportRequest[] | null; busy: boolean; error: string; onToggle: (r: SupportRequest) => void; onCreate: () => void }> = ({ items, busy, error, onToggle, onCreate }) => {
  const { t } = useTranslation(['chat', 'common']);
  return (
  <>
    {error && <p className="text-sm text-rose-500 mb-2">{error}</p>}
    {!items && !error && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin cx-accent" /></div>}
    {items && !items.length && (
      <div className="py-10 text-center cx-muted">
        <Inbox className="w-10 h-10 mx-auto mb-2 opacity-60" />
        <p className="text-sm font-bold">{t('chat:admin.noSupport')}</p>
      </div>
    )}
    <ul className="space-y-2">
      {(items || []).map(r => (
        <li key={r.id} className={`rounded-2xl cx-soft p-3 ${r.status === 'done' ? 'opacity-55' : ''}`}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <b className="text-sm">{r.name}</b>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full cx-accent-bg">{t(`chat:admin.kind.${r.kind}`, { defaultValue: r.kind })}</span>
                <span className="text-[11px] cx-muted">{formatDay(r.created_at)}</span>
              </div>
              <div className="mt-1 text-xs cx-muted flex items-center gap-3 flex-wrap">
                <a href={`tel:${r.phone}`} dir="ltr" className="inline-flex items-center gap-1 font-bold cx-accent"><Phone className="w-3.5 h-3.5" /> {r.phone}</a>
                {r.username && <span dir="ltr">@{r.username}</span>}
              </div>
              {r.message && <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{r.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {r.status === 'open' && r.kind === 'account' && (
                <button onClick={onCreate} title={t('chat:admin.create')} className="w-9 h-9 rounded-xl flex items-center justify-center cx-hover cx-accent"><UserPlus className="w-5 h-5" /></button>
              )}
              <button disabled={busy} onClick={() => onToggle(r)} title={r.status === 'open' ? t('chat:admin.handled') : t('chat:admin.reopen')}
                className={`w-9 h-9 rounded-xl flex items-center justify-center cx-hover ${r.status === 'open' ? 'text-emerald-500' : 'cx-muted'}`}>
                {r.status === 'open' ? <CheckCircle2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </>
);
};

// ───── إنشاء / تعديل حساب ─────
const AccountForm: React.FC<{
  acc?: Account;
  self?: boolean;
  onBack: () => void;
  onDone: (acc: { name: string; username: string }, password?: string) => void;
}> = ({ acc, self, onBack, onDone }) => {
  const { t } = useTranslation(['chat', 'common']);
  const editing = !!acc;
  const [name, setName] = useState(acc?.name || '');
  const [username, setUsername] = useState(acc?.username || '');
  const [role, setRole] = useState(acc?.role || '');
  const [isAdmin, setIsAdmin] = useState(!!acc?.is_admin);
  const [password, setPassword] = useState(() => (editing ? '' : genPassword()));
  const [resetPw, setResetPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError(t('chat:admin.nameReq'));
    setBusy(true);
    try {
      if (editing) {
        await chatApi.adminUpdate(acc.id, {
          name: name.trim(), role: role.trim(),
          ...(self ? {} : { is_admin: isAdmin }),
          ...(resetPw ? { password } : {}),
        });
        onDone({ name: name.trim(), username: acc.username }, resetPw ? password : undefined);
      } else {
        const u = username.trim().toLowerCase();
        await chatApi.adminCreate({ username: u, password, name: name.trim(), role: role.trim(), is_admin: isAdmin });
        onDone({ name: name.trim(), username: u }, password);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? t('chat:admin.edit') : t('chat:admin.new')}
      icon={<button onClick={onBack} aria-label={t('chat:back')}><ArrowRight className="w-5 h-5 ltr:rotate-180" /></button>}
      onClose={onBack}
      footer={
        <Btn className="flex-1" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editing ? t('common:actions.saveChanges') : t('chat:admin.createAccount')}
        </Btn>
      }
    >
      <div className="space-y-4">
        <Field label={t('chat:admin.fullName')}>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} className={inputCls} placeholder={t('chat:modals.namePh')} />
        </Field>
        <Field label={t('chat:admin.username')}>
          <input
            dir="ltr" value={username} disabled={editing} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            maxLength={32} className={`${inputCls} ${editing ? 'opacity-60' : ''}`} placeholder="ali.hussein" autoCapitalize="none" spellCheck={false}
          />
        </Field>
        <Field label={t('chat:admin.job')}>
          <input value={role} onChange={e => setRole(e.target.value)} maxLength={60} className={inputCls} placeholder={t('chat:admin.jobPh')} />
        </Field>

        {editing && (
          <label className="flex items-center gap-3 px-4 h-12 rounded-2xl cx-soft text-sm font-bold cursor-pointer">
            <KeyRound className="w-5 h-5 cx-accent" />
            <span className="flex-1">{t('chat:admin.resetPw')}</span>
            <input type="checkbox" checked={resetPw} onChange={e => { setResetPw(e.target.checked); if (e.target.checked && !password) setPassword(genPassword()); }} className="w-4 h-4 accent-current" />
          </label>
        )}
        {(!editing || resetPw) && (
          <Field label={editing ? t('chat:admin.newPw') : t('chat:admin.pw')}>
            <div className="flex gap-2">
              <input dir="ltr" value={password} onChange={e => setPassword(e.target.value)} maxLength={128} className={`${inputCls} font-mono`} />
              <button type="button" onClick={() => setPassword(genPassword())} title={t('chat:admin.genPw')} className="w-11 h-11 shrink-0 rounded-2xl cx-soft cx-hover flex items-center justify-center">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </Field>
        )}

        <label className={`flex items-center gap-3 px-4 h-12 rounded-2xl cx-soft text-sm font-bold ${self ? 'opacity-50' : 'cursor-pointer'}`}>
          <Crown className="w-5 h-5 text-amber-500" />
          <span className="flex-1">{t('chat:admin.isAdmin')}</span>
          <input type="checkbox" checked={isAdmin} disabled={self} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4" />
        </label>
        <p className="text-xs cx-muted">{t('chat:admin.permsHint')}</p>
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </div>
    </Modal>
  );
};

// ───── بيانات الدخول بعد الإصدار (تظهر مرة واحدة) ─────
const Issued: React.FC<{ acc: { name: string; username: string }; password: string; onBack: () => void }> = ({ acc, password, onBack }) => {
  const { t } = useTranslation(['chat', 'common']);
  const [copied, setCopied] = useState(false);
  const text = t('chat:admin.copyText', { name: acc.name, username: acc.username, password });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* تجاهل */ }
  };
  return (
    <Modal title={t('chat:admin.credentials')} icon={<KeyRound className="w-5 h-5" />} onClose={onBack} footer={<Btn className="flex-1" onClick={onBack}>{t('common:actions.done')}</Btn>}>
      <div className="space-y-3">
        <p className="text-sm cx-muted">{t('chat:admin.handover')}</p>
        <div className="rounded-2xl cx-soft p-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><span className="cx-muted">{t('chat:admin.name')}</span><b>{acc.name}</b></div>
          <div className="flex justify-between gap-3"><span className="cx-muted">{t('chat:admin.usernameLabel')}</span><b dir="ltr" className="font-mono">{acc.username}</b></div>
          <div className="flex justify-between gap-3"><span className="cx-muted">{t('chat:admin.pwLabel')}</span><b dir="ltr" className="font-mono">{password}</b></div>
        </div>
        <Btn variant="ghost" className="w-full" onClick={copy}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? t('chat:copied') : t('chat:admin.copy')}
        </Btn>
      </div>
    </Modal>
  );
};
