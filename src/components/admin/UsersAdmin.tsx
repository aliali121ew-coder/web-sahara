import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, Search, Loader2, Crown, Ban, CheckCircle2, ArrowRight, ArrowLeft, KeyRound, RefreshCw, Check, ShieldCheck, Inbox, History, Pencil, Eye, EyeOff, Timer } from 'lucide-react';
import { chatApi, type Account, type SupportRequest } from '../chat/chatApi';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../i18n/errors';
import { ProfileCard } from '../layout/ProfileCard';
import { type Perms } from '../../lib/permCatalog';
import { useSessionProfile } from '../../lib/session';
import { SwipeTabs } from '../ui/SwipeTabs';
import { PermissionsEditor } from './PermissionsEditor';
import { CreateAccountWizard } from './CreateAccountWizard';
import { DEMO_DURATIONS, demoDurationMs, remainingText, useDemoMode, type DemoDurationKey } from '../../lib/demo';
import { SupportRequests } from './SupportRequests';
import { AuditLog } from './AuditLog';
import { AvatarPicker, CopyButton, Empty, Issued, Skeleton, UserAvatar, btnCls, cardCls, genPassword, inputCls, timeAgo } from './adminUi';

export { PermissionsEditor };

const TAB_KEY = 'sahara_users_admin_tab';
const readTab = () => { try { return sessionStorage.getItem(TAB_KEY) || 'users'; } catch { return 'users'; } };

type Prefill = { name?: string; username?: string; requestId?: string };
type EditTarget = { acc: Account; resetPw?: boolean; requestId?: string };

/** إدارة المستخدمين والصلاحيات (لمدير النظام فقط): أربعة أقسام يُتنقّل بينها بالسحب */
export const UsersAdmin: React.FC = () => {
  const { t } = useTranslation('admin');
  const [tab, setTabState] = useState(readTab);
  const setTab = (t: string) => { setTabState(t); try { sessionStorage.setItem(TAB_KEY, t); } catch { /* تجاهل */ } };
  const [items, setItems] = useState<Account[] | null>(null);
  const [max, setMax] = useState(100);
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [error, setError] = useState('');
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [createRound, setCreateRound] = useState(0);
  const [issued, setIssued] = useState<{ name: string; username: string; password: string } | null>(null);

  const loadUsers = useCallback(() => chatApi.adminUsers().then(r => { setItems(r.items); setMax(r.max); }).catch(e => setError(errorText(e))), []);
  const loadRequests = useCallback(() => chatApi.adminSupport().then(r => setRequests(r.items)).catch(e => setError(errorText(e))), []);
  useEffect(() => { loadUsers(); loadRequests(); }, [loadUsers, loadRequests]);

  /** إغلاق طلب الدعم تلقائيًا بعد تنفيذه (إنشاء الحساب أو إعادة تعيين كلمة المرور) */
  const closeRequest = async (id?: string) => {
    if (!id) return;
    try { await chatApi.adminSupportStatus(id, 'done'); await loadRequests(); } catch { /* يبقى مفتوحًا ويُغلق يدويًا */ }
  };

  const openRequests = (requests || []).filter(r => r.status === 'open').length;
  const stats = useMemo(() => {
    const list = items || [];
    return {
      total: list.length,
      active: list.filter(a => !a.disabled).length,
      disabled: list.filter(a => a.disabled).length,
      admins: list.filter(a => a.is_admin).length,
    };
  }, [items]);

  return (
    <div className="space-y-4">
      {/* بطاقة الملخص */}
      <div className={`${cardCls} p-5 overflow-hidden relative`}>
        <div aria-hidden className="absolute -end-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-violet-500/15 to-blue-500/10 blur-2xl" />
        <div className="relative flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/25">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">{t('header.title')}</h3>
            <p className="text-xs text-slate-500">{t('header.text')}</p>
          </div>
        </div>
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label={t('header.total')} value={stats.total} sub={t('header.of', { max })} tone="slate" />
          <Stat label={t('header.active')} value={stats.active} tone="emerald" />
          <Stat label={t('header.disabled')} value={stats.disabled} tone="rose" />
          <Stat label={t('header.admins')} value={stats.admins} tone="amber" />
        </div>
      </div>

      {error && <p className="text-sm text-rose-500 px-1">{error}</p>}

      <SwipeTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'users', label: t('tabs.users'), icon: Users, content: (
            <UsersTab items={items} reload={loadUsers} editTarget={editTarget} setEditTarget={setEditTarget} onRequestDone={closeRequest} />
          ) },
          { id: 'requests', label: t('tabs.requests'), icon: Inbox, badge: openRequests, content: (
            <SupportRequests items={requests} users={items || []} reload={loadRequests}
              onCreate={p => { setPrefill(p); setIssued(null); setCreateRound(r => r + 1); setTab('create'); }}
              onResetPassword={(acc, requestId) => { setEditTarget({ acc, resetPw: true, requestId }); setTab('users'); }} />
          ) },
          { id: 'audit', label: t('tabs.audit'), icon: History, content: <AuditLog users={items || []} /> },
          { id: 'create', label: t('tabs.create'), icon: UserPlus, content: (
            (items || []).length >= max ? <div className={`${cardCls} p-5`}><Empty icon={Users} title={t('limitReached')} /></div>
              : issued ? (
                <div className={`${cardCls} p-6`}>
                  <Issued {...issued} backLabel={t('createAnother')} onBack={() => { setIssued(null); setPrefill(null); setCreateRound(r => r + 1); }}
                    extra={<button className={`${btnCls} flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`} onClick={() => { setIssued(null); setTab('users'); }}>{t('viewUsers')}</button>} />
                </div>
              ) : (
                <CreateAccountWizard key={createRound} prefill={prefill || undefined} takenUsernames={(items || []).map(a => a.username)}
                  onCreated={r => { loadUsers(); closeRequest(prefill?.requestId); setPrefill(null); setIssued(r); }} />
              )
          ) },
        ]}
      />
    </div>
  );
};

const TONES = {
  slate: 'text-slate-900 dark:text-white',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  rose: 'text-rose-600 dark:text-rose-400',
  amber: 'text-amber-600 dark:text-amber-400',
};
const Stat: React.FC<{ label: string; value: number; sub?: string; tone: keyof typeof TONES }> = ({ label, value, sub, tone }) => (
  <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 px-3.5 py-3">
    <div className="text-[11px] font-bold text-slate-500">{label}</div>
    <div className="flex items-baseline gap-1.5 mt-0.5">
      <span className={`text-2xl font-black tabular-nums ${TONES[tone]}`}>{value}</span>
      {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
    </div>
  </div>
);

// ───── المستخدمين ─────
type UserFilter = 'all' | 'active' | 'disabled' | 'admins';
const UsersTab: React.FC<{
  items: Account[] | null;
  reload: () => Promise<unknown>;
  editTarget: EditTarget | null;
  setEditTarget: (t: EditTarget | null) => void;
  onRequestDone: (id?: string) => void;
}> = ({ items, reload, editTarget, setEditTarget, onRequestDone }) => {
  const { t } = useTranslation('admin');
  const me = useSessionProfile();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [issued, setIssued] = useState<{ name: string; username: string; password: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<{ acc: Account; rect: DOMRect } | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items || []).filter(a =>
      (filter === 'all' || (filter === 'active' && !a.disabled) || (filter === 'disabled' && a.disabled) || (filter === 'admins' && a.is_admin))
      && (!t || a.name.toLowerCase().includes(t) || a.username.includes(t) || a.role.toLowerCase().includes(t)));
  }, [items, q, filter]);

  const toggleDisabled = async (a: Account) => {
    setBusy(a.id);
    setError('');
    try {
      await chatApi.adminUpdate(a.id, { disabled: !a.disabled });
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy('');
    }
  };

  if (issued) return <div className={`${cardCls} p-6`}><Issued {...issued} onBack={() => setIssued(null)} /></div>;
  if (editTarget) {
    return (
      <div className={`${cardCls} p-5 sm:p-6`}>
        <EditAccount key={editTarget.acc.id} acc={editTarget.acc} startReset={editTarget.resetPw} self={editTarget.acc.id === me?.id} onBack={() => setEditTarget(null)}
          onDone={(name, username, password) => {
            reload();
            if (password) onRequestDone(editTarget.requestId);
            setEditTarget(null);
            if (password) setIssued({ name, username, password });
          }} />
      </div>
    );
  }

  const FILTERS: [UserFilter, string][] = [['all', t('list.filterAll')], ['active', t('list.filterActive')], ['disabled', t('list.filterDisabled')], ['admins', t('list.filterAdmins')]];
  return (
    <div className={`${cardCls} p-4 sm:p-5 space-y-3`}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('list.search')} className={`${inputCls} ps-10`} />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
          {FILTERS.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === id ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {!items ? <Skeleton rows={3} /> : !filtered.length ? <Empty icon={Users} title={t('list.noResults')} /> : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {filtered.map(a => {
            const granted = Object.keys(a.perms || {}).length;
            return (
              <li key={a.id} className={`group flex items-center gap-3 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition ${a.disabled ? 'opacity-60' : ''}`}>
                <UserAvatar name={a.name} color={a.color} src={a.avatar} />
                <button onClick={() => setEditTarget({ acc: a })} className="flex-1 min-w-0 text-start">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white truncate">
                    {a.name}
                    {!!a.is_admin && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    {a.id === me?.id && <span className="text-[10px] text-slate-400">{t('list.you')}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate"><span dir="ltr">@{a.username}</span>{a.role ? ` · ${a.role}` : ''}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {/* حساب تجربة منتهٍ: شارة المدة تكفي بدل "نشط" */}
                    {!(!a.disabled && a.expires_at && a.expires_at <= Date.now()) && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.disabled ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                      {a.disabled ? t('list.filterDisabled') : t('list.filterActive')}
                    </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {a.is_admin ? t('list.allPermissions') : t('list.sections', { count: granted })}
                    </span>
                    {!!a.expires_at && <TrialBadge expiresAt={a.expires_at} />}
                    <span className="text-[10px] text-slate-400 truncate">{a.last_seen ? `${t('list.lastSeen')} ${timeAgo(a.last_seen)}` : t('list.neverSignedIn')}</span>
                  </div>
                </button>
                <div className="flex flex-col gap-1">
                  <button onClick={e => setViewing({ acc: a, rect: e.currentTarget.getBoundingClientRect() })} title={t('list.viewProfile')} aria-label={t('list.viewProfileOf', { name: a.name })} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditTarget({ acc: a })} title={t('list.edit')} aria-label={t('list.edit')} className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {a.id !== me?.id && (
                    <button disabled={busy === a.id} onClick={() => toggleDisabled(a)} title={a.disabled ? t('list.enable') : t('list.disable')} aria-label={a.disabled ? t('list.enable') : t('list.disable')}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 ${a.disabled ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {busy === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : a.disabled ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {viewing && (() => {
        const v = viewing.acc;
        return (
          <ProfileCard
            profile={v}
            anchor={viewing.rect}
            nextTo
            isRtl
            sectionsCount={v.is_admin ? null : Object.keys(v.perms || {}).length}
            status={v.disabled ? { label: t('list.filterDisabled'), on: false } : { label: t('list.filterActive'), on: true }}
            lastStat={{ label: t('list.lastSeen'), value: v.last_seen ? timeAgo(v.last_seen) : t('list.neverShort') }}
            actionLabel={t('list.edit')}
            onOpenProfile={() => setEditTarget({ acc: v })}
            onClose={() => setViewing(null)}
          />
        );
      })()}
    </div>
  );
};

// ───── تعديل حساب ─────
const EditAccount: React.FC<{
  acc: Account;
  self?: boolean;
  startReset?: boolean;
  onBack: () => void;
  onDone: (name: string, username: string, password?: string) => void;
}> = ({ acc, self, startReset, onBack, onDone }) => {
  const { t, i18n } = useTranslation('admin');
  const rtl = i18n.dir() === 'rtl';
  const Back = rtl ? ArrowRight : ArrowLeft;
  const [name, setName] = useState(acc.name);
  const [role, setRole] = useState(acc.role || '');
  const [avatar, setAvatar] = useState(acc.avatar || '');
  const [isAdmin, setIsAdmin] = useState(!!acc.is_admin);
  const [perms, setPerms] = useState<Perms>(acc.perms || {});
  const [resetPw, setResetPw] = useState(!!startReset);
  const [password, setPassword] = useState(() => (startReset ? genPassword() : ''));
  const [showPw, setShowPw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // النسخة التجريبية: تمديد مدة الحساب (تُحسب من الآن)؛ فارغ = بلا تغيير
  const demo = useDemoMode();
  const [extend, setExtend] = useState<DemoDurationKey | ''>('');

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError(t('edit.nameRequired'));
    if (resetPw && password.length < 8) return setError(t('edit.passwordLength'));
    setBusy(true);
    try {
      await chatApi.adminUpdate(acc.id, {
        name: name.trim(), role: role.trim(), perms,
        ...(avatar !== (acc.avatar || '') ? { avatar } : {}),
        ...(self ? {} : { is_admin: isAdmin }),
        ...(resetPw ? { password } : {}),
        ...(extend ? { expires_at: Date.now() + demoDurationMs(extend) } : {}),
      });
      onDone(name.trim(), acc.username, resetPw ? password : undefined);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">
        <Back className="w-4 h-4" /> {t('edit.back')}
      </button>
      <div className="flex items-center gap-3">
        <UserAvatar name={name || acc.name} color={acc.color} src={avatar} size={52} />
        <div className="min-w-0">
          <h4 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-1.5 truncate">{acc.name}{!!acc.is_admin && <Crown className="w-4 h-4 text-amber-500" />}</h4>
          <p className="text-xs text-slate-500"><span dir="ltr">@{acc.username}</span> · {acc.disabled ? t('list.filterDisabled') : t('list.filterActive')}</p>
        </div>
      </div>

      <AvatarPicker value={avatar} name={name} onChange={setAvatar} size={76} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('edit.fullName')}</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t('edit.role')}</span>
          <input value={role} onChange={e => setRole(e.target.value)} maxLength={60} className={inputCls} placeholder={t('edit.rolePlaceholder')} />
        </label>
      </div>

      <div className={`rounded-2xl border-2 transition ${resetPw ? 'border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
        <label className="flex items-center gap-3 px-4 h-12 text-sm font-bold cursor-pointer">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span className="flex-1">{t('edit.resetPassword')}</span>
          <input type="checkbox" checked={resetPw} onChange={e => { setResetPw(e.target.checked); if (e.target.checked && !password) setPassword(genPassword()); }} className="w-4 h-4" />
        </label>
        {resetPw && (
          <div className="px-4 pb-4 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input dir="ltr" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} maxLength={128} className={`${inputCls} font-mono ${rtl ? 'pl-20' : 'pr-20'}`} />
                <div className={`absolute ${rtl ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 flex gap-0.5`}>
                  <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? t('wizard.hide') : t('wizard.show')} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  <CopyButton text={password} className="w-8 h-8 text-slate-400 hover:text-slate-700" />
                </div>
              </div>
              <button type="button" onClick={() => setPassword(genPassword())} title={t('edit.generate')} aria-label={t('edit.generate')} className={`${btnCls} px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700`}><RefreshCw className="w-4 h-4" /></button>
            </div>
            <p className="text-[11px] text-slate-500">{t('edit.resetHint')}</p>
          </div>
        )}
      </div>

      {demo && !acc.is_admin && (
        <div className="rounded-2xl border-2 border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Timer className="w-4 h-4 text-violet-600" />
            <span className="flex-1">{t('demo.extendTitle')}</span>
            {!!acc.expires_at && <TrialBadge expiresAt={acc.expires_at} />}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {DEMO_DURATIONS.map(d => (
              <button key={d.key} type="button" onClick={() => setExtend(v => (v === d.key ? '' : d.key))} aria-pressed={extend === d.key}
                className={`px-2 py-2 rounded-xl text-xs font-bold border transition ${extend === d.key ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-violet-300'}`}>
                {t(`demo.duration.${d.key}`)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">{t('demo.extendHint')}</p>
        </div>
      )}

      <label className={`flex items-center gap-3 px-4 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-sm font-bold ${self ? 'opacity-50' : 'cursor-pointer'}`}>
        <Crown className="w-4 h-4 text-amber-500" />
        <span className="flex-1">{t('edit.makeAdmin')}</span>
        <input type="checkbox" checked={isAdmin} disabled={self} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4" />
      </label>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-extrabold text-slate-900 dark:text-white">{t('edit.sectionPermissions')}</span>
          {isAdmin && <span className="text-[11px] text-amber-600 font-bold">{t('edit.adminHasAll')}</span>}
        </div>
        <PermissionsEditor value={perms} onChange={setPerms} disabled={isAdmin} />
      </div>

      {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
      <div className="flex gap-2 sticky bottom-2">
        <button className={`${btnCls} flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20`} disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('edit.save')}
        </button>
        <button className={`${btnCls} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`} onClick={onBack}>{t('edit.cancel')}</button>
      </div>
    </div>
  );
};

/** شارة مدة حساب التجربة: المتبقي، أو "انتهت" */
const TrialBadge: React.FC<{ expiresAt: number }> = ({ expiresAt }) => {
  const { t } = useTranslation('admin');
  const expired = expiresAt <= Date.now();
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${expired ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>
      <Timer className="w-3 h-3" />
      {expired ? t('demo.expired') : t('demo.remaining', { time: remainingText(expiresAt) })}
    </span>
  );
};
