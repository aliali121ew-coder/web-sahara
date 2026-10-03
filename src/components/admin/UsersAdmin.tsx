import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, UserPlus, Search, Loader2, Crown, Ban, CheckCircle2, ArrowRight, KeyRound, RefreshCw, Check, Copy, ShieldCheck,
  Inbox, History, Phone, RotateCcw, LogIn, LogOut, ShieldAlert, Lock, Save, FileUp, FileX, UserCog, Pencil, Filter,
} from 'lucide-react';
import { chatApi, type Account, type AuditEntry, type SupportRequest } from '../chat/chatApi';
import { formatDay, lastSeenText } from '../chat/chatUtils';
import { PERM_GROUPS, ALL_SECTIONS, type Level, type Perms } from '../../lib/permCatalog';
import { initials, useSessionProfile } from '../../lib/session';
import { SwipeTabs } from '../ui/SwipeTabs';

/** كلمة مرور عشوائية سهلة الإملاء (بدون أحرف ملتبسة مثل 0/O و 1/l) */
const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, x => chars[x % chars.length]).join('');
};

const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none';
const btnCls = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50';
const cardCls = 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';
const LEVELS: { v: Level; label: string; on: string }[] = [
  { v: 0, label: 'لا يوجد', on: 'bg-slate-600 text-white' },
  { v: 1, label: 'عرض', on: 'bg-sky-600 text-white' },
  { v: 2, label: 'عرض وتعديل', on: 'bg-emerald-600 text-white' },
];

const TAB_KEY = 'sahara_users_admin_tab';
const readTab = () => { try { return sessionStorage.getItem(TAB_KEY) || 'users'; } catch { return 'users'; } };

type Prefill = { name?: string; username?: string };

/** إدارة المستخدمين والصلاحيات (لمدير النظام فقط): أربعة أقسام يُتنقّل بينها بالسحب */
export const UsersAdmin: React.FC = () => {
  const [tab, setTabState] = useState(readTab);
  const setTab = (t: string) => { setTabState(t); try { sessionStorage.setItem(TAB_KEY, t); } catch { /* تجاهل */ } };
  const [items, setItems] = useState<Account[] | null>(null);
  const [max, setMax] = useState(100);
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [error, setError] = useState('');
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  const loadUsers = useCallback(() => chatApi.adminUsers().then(r => { setItems(r.items); setMax(r.max); }).catch(e => setError((e as Error).message)), []);
  const loadRequests = useCallback(() => chatApi.adminSupport().then(r => setRequests(r.items)).catch(e => setError((e as Error).message)), []);
  useEffect(() => { loadUsers(); loadRequests(); }, [loadUsers, loadRequests]);

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
        <div aria-hidden className="absolute -left-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-violet-500/15 to-blue-500/10 blur-2xl" />
        <div className="relative flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/25">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">إدارة المستخدمين والصلاحيات</h3>
            <p className="text-xs text-slate-500">الحسابات يُنشئها مدير النظام فقط، ولا يرى الحساب الجديد أي قسم حتى تُحدَّد صلاحياته.</p>
          </div>
        </div>
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="كل الحسابات" value={stats.total} sub={`من ${max}`} tone="slate" />
          <Stat label="نشط" value={stats.active} tone="emerald" />
          <Stat label="موقوف" value={stats.disabled} tone="rose" />
          <Stat label="مدراء النظام" value={stats.admins} tone="amber" />
        </div>
      </div>

      {error && <p className="text-sm text-rose-500 px-1">{error}</p>}

      <SwipeTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'users', label: 'المستخدمين', icon: Users, content: <UsersTab items={items} reload={loadUsers} /> },
          { id: 'requests', label: 'الطلبات', icon: Inbox, badge: openRequests, content: (
            <RequestsTab items={requests} reload={loadRequests} onCreate={p => { setPrefill(p); setTab('create'); }} />
          ) },
          { id: 'audit', label: 'سجل العمليات', icon: History, content: <AuditTab users={items || []} /> },
          { id: 'create', label: 'إنشاء حساب', icon: UserPlus, content: (
            <CreateTab key={JSON.stringify(prefill)} prefill={prefill || undefined} full={(items || []).length >= max}
              onCreated={() => { loadUsers(); setPrefill(null); }} onShowUsers={() => setTab('users')} />
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

const UserAvatar: React.FC<{ a: Pick<Account, 'name' | 'color'>; size?: number }> = ({ a, size = 42 }) => (
  <div className="rounded-2xl flex items-center justify-center text-white font-black shrink-0 shadow-sm"
    style={{ width: size, height: size, fontSize: size * 0.36, background: a.color || 'linear-gradient(135deg,#6366f1,#3b82f6)' }}>
    {initials(a.name)}
  </div>
);

const Empty: React.FC<{ icon: React.ComponentType<{ className?: string }>; text: string }> = ({ icon: Icon, text }) => (
  <div className="py-12 text-center text-slate-400">
    <Icon className="w-10 h-10 mx-auto mb-2 opacity-60" />
    <p className="text-sm font-bold">{text}</p>
  </div>
);

const Spinner = () => <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

// ───── ١. المستخدمين ─────
type UserFilter = 'all' | 'active' | 'disabled' | 'admins';
const UsersTab: React.FC<{ items: Account[] | null; reload: () => Promise<unknown> }> = ({ items, reload }) => {
  const me = useSessionProfile();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [editing, setEditing] = useState<Account | null>(null);
  const [issued, setIssued] = useState<{ name: string; username: string; password: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

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
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  if (issued) return <div className={`${cardCls} p-5`}><Issued {...issued} onBack={() => setIssued(null)} /></div>;
  if (editing) {
    return (
      <div className={`${cardCls} p-5`}>
        <AccountForm acc={editing} self={editing.id === me?.id} onBack={() => setEditing(null)}
          onDone={(name, username, password) => { reload(); setEditing(null); if (password) setIssued({ name, username, password }); }} />
      </div>
    );
  }

  const FILTERS: [UserFilter, string][] = [['all', 'الكل'], ['active', 'نشط'], ['disabled', 'موقوف'], ['admins', 'مدراء']];
  return (
    <div className={`${cardCls} p-4 sm:p-5 space-y-3`}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالاسم أو اسم المستخدم أو الوظيفة" className={`${inputCls} pr-10`} />
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
      {!items ? <Spinner /> : !filtered.length ? <Empty icon={Users} text="لا توجد نتائج" /> : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {filtered.map(a => {
            const granted = Object.keys(a.perms || {}).length;
            return (
              <li key={a.id} className={`group flex items-center gap-3 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition ${a.disabled ? 'opacity-60' : ''}`}>
                <UserAvatar a={a} />
                <button onClick={() => setEditing(a)} className="flex-1 min-w-0 text-right">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white truncate">
                    {a.name}
                    {!!a.is_admin && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    {a.id === me?.id && <span className="text-[10px] text-slate-400">(أنت)</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate"><span dir="ltr">@{a.username}</span>{a.role ? ` · ${a.role}` : ''}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.disabled ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                      {a.disabled ? 'موقوف' : 'نشط'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {a.is_admin ? 'كل الصلاحيات' : granted ? `${granted} قسم` : 'بدون صلاحيات'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">{a.last_seen ? lastSeenText(a.last_seen) : 'لم يدخل بعد'}</span>
                  </div>
                </button>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditing(a)} title="تعديل الحساب والصلاحيات" className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {a.id !== me?.id && (
                    <button disabled={busy === a.id} onClick={() => toggleDisabled(a)} title={a.disabled ? 'تفعيل الحساب' : 'إيقاف الحساب'}
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
    </div>
  );
};

// ───── ٢. الطلبات (من شاشة الدخول) ─────
const KIND_LABEL: Record<SupportRequest['kind'], string> = { account: 'حساب جديد', password: 'نسيت كلمة المرور', other: 'مشكلة أخرى' };
const KIND_TONE: Record<SupportRequest['kind'], string> = {
  account: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  password: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const RequestsTab: React.FC<{ items: SupportRequest[] | null; reload: () => Promise<unknown>; onCreate: (p: Prefill) => void }> = ({ items, reload, onCreate }) => {
  const [show, setShow] = useState<'open' | 'done'>('open');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const list = (items || []).filter(r => r.status === show);

  const toggle = async (r: SupportRequest) => {
    setBusy(r.id);
    setError('');
    try {
      await chatApi.adminSupportStatus(r.id, r.status === 'open' ? 'done' : 'open');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={`${cardCls} p-4 sm:p-5 space-y-3`}>
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs text-slate-500">طلبات الموظفين من شاشة الدخول: حساب جديد أو نسيان كلمة المرور.</p>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {(['open', 'done'] as const).map(s => (
            <button key={s} onClick={() => setShow(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${show === s ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}>
              {s === 'open' ? 'مفتوحة' : 'مكتملة'}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {!items ? <Spinner /> : !list.length ? <Empty icon={Inbox} text={show === 'open' ? 'لا توجد طلبات مفتوحة' : 'لا توجد طلبات مكتملة'} /> : (
        <ul className="space-y-2">
          {list.map(r => (
            <li key={r.id} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3.5">
              <div className="flex items-start gap-3">
                <UserAvatar a={{ name: r.name, color: '' }} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-sm text-slate-900 dark:text-white">{r.name}</b>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${KIND_TONE[r.kind] || KIND_TONE.other}`}>{KIND_LABEL[r.kind] || r.kind}</span>
                    <span className="text-[11px] text-slate-400">{formatDay(r.created_at)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                    <a href={`tel:${r.phone}`} dir="ltr" className="inline-flex items-center gap-1 font-bold text-blue-600"><Phone className="w-3.5 h-3.5" /> {r.phone}</a>
                    {r.username && <span dir="ltr">@{r.username}</span>}
                  </div>
                  {r.message && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2">{r.message}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {r.status === 'open' && r.kind === 'account' && (
                  <button onClick={() => onCreate({ name: r.name, username: r.username })} className={`${btnCls} flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2`}>
                    <UserPlus className="w-4 h-4" /> إنشاء الحساب
                  </button>
                )}
                <button disabled={busy === r.id} onClick={() => toggle(r)}
                  className={`${btnCls} flex-1 py-2 ${r.status === 'open' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : r.status === 'open' ? <CheckCircle2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  {r.status === 'open' ? 'تمت المعالجة' : 'إعادة فتح'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ───── ٣. سجل العمليات ─────
const ACTIONS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  'auth.login': { label: 'تسجيل دخول', icon: LogIn, tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  'auth.logout': { label: 'تسجيل خروج', icon: LogOut, tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  'auth.failed': { label: 'محاولة دخول فاشلة', icon: ShieldAlert, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  'auth.locked': { label: 'قفل الحساب مؤقتًا', icon: Lock, tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  'auth.password': { label: 'تغيير كلمة المرور', icon: KeyRound, tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  'admin.create': { label: 'إنشاء حساب', icon: UserPlus, tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  'admin.update': { label: 'تعديل حساب', icon: UserCog, tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  'admin.support': { label: 'طلب دعم', icon: Inbox, tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  'data.save': { label: 'حفظ بيانات', icon: Save, tone: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  'data.denied': { label: 'تعديل مرفوض (بلا صلاحية)', icon: ShieldAlert, tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  'file.upload': { label: 'رفع ملف', icon: FileUp, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  'file.delete': { label: 'حذف ملف', icon: FileX, tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
};
const ACTION_FILTERS: [string, string][] = [['', 'كل العمليات'], ['auth', 'الدخول والخروج'], ['admin', 'إدارة الحسابات'], ['data', 'حفظ البيانات'], ['file', 'الملفات']];
const clock = (ts: number) => new Date(ts).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

const AuditTab: React.FC<{ users: Account[] }> = ({ users }) => {
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (append = false, before?: number) => {
    setLoading(true);
    setError('');
    try {
      const r = await chatApi.adminAudit({ user, action, before, limit: 50 });
      setItems(prev => (append && prev ? [...prev, ...r.items] : r.items));
      setMore(r.more);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, action]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const names = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);
  // تجميع حسب اليوم
  const groups = useMemo(() => {
    const out: { day: string; rows: AuditEntry[] }[] = [];
    for (const row of items || []) {
      const day = formatDay(row.at);
      if (out[out.length - 1]?.day === day) out[out.length - 1].rows.push(row);
      else out.push({ day, rows: [row] });
    }
    return out;
  }, [items]);

  return (
    <div className={`${cardCls} p-4 sm:p-5 space-y-3`}>
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <Users className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select value={user} onChange={e => setUser(e.target.value)} className={`${inputCls} pr-10 appearance-none`}>
            <option value="">كل المستخدمين</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)}
          </select>
        </label>
        <label className="relative flex-1">
          <Filter className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select value={action} onChange={e => setAction(e.target.value)} className={`${inputCls} pr-10 appearance-none`}>
            {ACTION_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button onClick={() => load()} title="تحديث" className="w-11 h-11 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center self-end sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {!items ? <Spinner /> : !items.length ? <Empty icon={History} text="لا توجد عمليات مسجّلة" /> : (
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.day}>
              <div className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-[11px] font-black text-slate-500">{g.day}</div>
              <ol className="relative border-r-2 border-slate-100 dark:border-slate-800 mr-4 space-y-2">
                {g.rows.map(row => {
                  const meta = ACTIONS[row.action] || { label: row.action, icon: History, tone: ACTIONS['auth.logout'].tone };
                  const Icon = meta.icon;
                  const who = names[row.user_id];
                  return (
                    <li key={row.id} className="relative pr-6">
                      <span className={`absolute -right-[15px] top-2 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 ${meta.tone}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 px-3.5 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <b className="text-sm text-slate-900 dark:text-white">{meta.label}</b>
                          <span className="text-xs text-slate-500">{who?.name || (row.username ? `@${row.username}` : 'غير معروف')}</span>
                          <span className="text-[11px] text-slate-400 mr-auto tabular-nums" dir="ltr">{clock(row.at)}</span>
                        </div>
                        {row.detail && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 break-words">{row.detail}</p>}
                        {row.ip && <p className="text-[10px] text-slate-400 mt-0.5" dir="ltr">IP {row.ip}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {more && (
            <button disabled={loading} onClick={() => load(true, items[items.length - 1]?.id)} className={`${btnCls} w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} عرض المزيد
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ───── ٤. إنشاء حساب ─────
const CreateTab: React.FC<{ prefill?: Prefill; full: boolean; onCreated: () => void; onShowUsers: () => void }> = ({ prefill, full, onCreated, onShowUsers }) => {
  const [issued, setIssued] = useState<{ name: string; username: string; password: string } | null>(null);
  const [round, setRound] = useState(0);
  if (full) return <div className={`${cardCls} p-5`}><Empty icon={Users} text="وصلت إلى الحد الأقصى لعدد الحسابات" /></div>;
  return (
    <div className={`${cardCls} p-5`}>
      {issued ? (
        <Issued {...issued} onBack={() => { setIssued(null); setRound(r => r + 1); }} backLabel="إنشاء حساب آخر" extra={
          <button className={`${btnCls} flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`} onClick={onShowUsers}>عرض المستخدمين</button>
        } />
      ) : (
        <AccountForm key={round} prefill={prefill} onDone={(name, username, password) => { onCreated(); setIssued({ name, username, password: password || '' }); }} />
      )}
    </div>
  );
};

// ───── محرر الصلاحيات ─────
export const PermissionsEditor: React.FC<{ value: Perms; onChange: (p: Perms) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const set = (id: string, v: Level) => {
    const next = { ...value };
    if (v) next[id] = v; else delete next[id];
    onChange(next);
  };
  const setMany = (ids: string[], v: Level) => {
    const next: Perms = {};
    for (const id of ids) if (v) next[id] = v;
    onChange(next);
  };
  const ids = (groups: string[]) => PERM_GROUPS.filter(g => groups.includes(g.id)).flatMap(g => g.sections.map(s => s.id));
  const presets: { label: string; run: () => void }[] = [
    { label: 'إلغاء الكل', run: () => onChange({}) },
    { label: 'الكل عرض', run: () => setMany(ALL_SECTIONS, 1) },
    { label: 'الكل تعديل', run: () => setMany(ALL_SECTIONS, 2) },
    { label: 'صحاري فقط', run: () => setMany([...ids(['sahara']), 'deliveries-sahara', 'chat'], 2) },
    { label: 'اتحاد فقط', run: () => setMany([...ids(['etihad']), 'deliveries-etihad', 'chat'], 2) },
  ];

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(p => (
          <button key={p.label} type="button" onClick={p.run} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {PERM_GROUPS.map(g => (
          <div key={g.id} className={`rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${g.id === 'pages' ? 'xl:col-span-2' : ''}`}>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-extrabold text-slate-700 dark:text-slate-200">{g.label}</div>
            <ul className={`divide-y divide-slate-100 dark:divide-slate-800 ${g.id === 'pages' ? 'xl:grid xl:grid-cols-2 xl:divide-y-0' : ''}`}>
              {g.sections.map(s => {
                const cur = value[s.id] || 0;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2 flex-wrap">
                    <span className="flex-1 min-w-[7rem] text-sm font-bold text-slate-800 dark:text-slate-100">{s.label}</span>
                    <div role="radiogroup" aria-label={s.label} className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                      {LEVELS.map(l => (
                        <button key={l.v} type="button" role="radio" aria-checked={cur === l.v} onClick={() => set(s.id, l.v)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${cur === l.v ? l.on : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

// ───── نموذج الحساب (إنشاء / تعديل) ─────
const AccountForm: React.FC<{
  acc?: Account;
  self?: boolean;
  prefill?: Prefill;
  onBack?: () => void;
  onDone: (name: string, username: string, password?: string) => void;
}> = ({ acc, self, prefill, onBack, onDone }) => {
  const editing = !!acc;
  const [name, setName] = useState(acc?.name || prefill?.name || '');
  const [username, setUsername] = useState(acc?.username || (prefill?.username || '').toLowerCase().replace(/[^a-z0-9._-]/g, ''));
  const [role, setRole] = useState(acc?.role || '');
  const [isAdmin, setIsAdmin] = useState(!!acc?.is_admin);
  const [perms, setPerms] = useState<Perms>(acc?.perms || {});
  const [password, setPassword] = useState(() => (editing ? '' : genPassword()));
  const [resetPw, setResetPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError('الاسم مطلوب');
    setBusy(true);
    try {
      if (editing) {
        await chatApi.adminUpdate(acc.id, {
          name: name.trim(), role: role.trim(), perms,
          ...(self ? {} : { is_admin: isAdmin }),
          ...(resetPw ? { password } : {}),
        });
        onDone(name.trim(), acc.username, resetPw ? password : undefined);
      } else {
        const u = username.trim().toLowerCase();
        await chatApi.adminCreate({ username: u, password, name: name.trim(), role: role.trim(), is_admin: isAdmin, perms });
        onDone(name.trim(), u, password);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">
          <ArrowRight className="w-4 h-4" /> رجوع للقائمة
        </button>
      )}
      <div className="flex items-center gap-3">
        <UserAvatar a={{ name: name || '؟', color: acc?.color || '' }} size={48} />
        <div>
          <h4 className="font-black text-base text-slate-900 dark:text-white">{editing ? acc.name : 'حساب جديد'}</h4>
          <p className="text-xs text-slate-500">{editing ? <span dir="ltr">@{acc.username}</span> : 'بيانات الدخول تظهر مرة واحدة بعد الإنشاء لتسليمها للموظف'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم الكامل *</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} className={inputCls} placeholder="مثال: علي حسين" />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المستخدم *</span>
          <input dir="ltr" value={username} disabled={editing} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            maxLength={32} className={`${inputCls} ${editing ? 'opacity-60' : ''}`} placeholder="ali.hussein" autoCapitalize="none" spellCheck={false} />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الوظيفة</span>
          <input value={role} onChange={e => setRole(e.target.value)} maxLength={60} className={inputCls} placeholder="مسؤول خزانات، محاسب..." />
        </label>
      </div>

      {editing && (
        <label className="flex items-center gap-3 px-4 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-bold cursor-pointer">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span className="flex-1">إعادة تعيين كلمة المرور</span>
          <input type="checkbox" checked={resetPw} onChange={e => { setResetPw(e.target.checked); if (e.target.checked && !password) setPassword(genPassword()); }} className="w-4 h-4" />
        </label>
      )}
      {(!editing || resetPw) && (
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{editing ? 'كلمة المرور الجديدة' : 'كلمة المرور *'}</span>
          <div className="flex gap-2">
            <input dir="ltr" value={password} onChange={e => setPassword(e.target.value)} maxLength={128} className={`${inputCls} font-mono`} />
            <button type="button" onClick={() => setPassword(genPassword())} title="توليد كلمة مرور" className="w-11 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </label>
      )}

      <label className={`flex items-center gap-3 px-4 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-sm font-bold ${self ? 'opacity-50' : 'cursor-pointer'}`}>
        <Crown className="w-4 h-4 text-amber-500" />
        <span className="flex-1">مدير النظام (كل الصلاحيات + إدارة المستخدمين)</span>
        <input type="checkbox" checked={isAdmin} disabled={self} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4" />
      </label>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-extrabold text-slate-900 dark:text-white">صلاحيات الأقسام</span>
          {isAdmin && <span className="text-[11px] text-amber-600 font-bold">(مدير النظام يملك كل الصلاحيات تلقائيًا)</span>}
        </div>
        <PermissionsEditor value={perms} onChange={setPerms} disabled={isAdmin} />
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="flex gap-2 sticky bottom-2">
        <button className={`${btnCls} flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20`} disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editing ? 'حفظ التعديلات' : 'إنشاء الحساب'}
        </button>
        {onBack && <button className={`${btnCls} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`} onClick={onBack}>إلغاء</button>}
      </div>
    </div>
  );
};

// ───── بيانات الدخول بعد الإصدار (تظهر مرة واحدة) ─────
const Issued: React.FC<{ name: string; username: string; password: string; onBack: () => void; backLabel?: string; extra?: React.ReactNode }> = ({ name, username, password, onBack, backLabel = 'تم', extra }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`الاسم: ${name}\nاسم المستخدم: ${username}\nكلمة المرور: ${password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* تجاهل */ }
  };
  return (
    <div className="space-y-4 max-w-lg mx-auto text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
        <CheckCircle2 className="w-7 h-7" />
      </div>
      <div>
        <h4 className="font-black text-base text-slate-900 dark:text-white">تم إصدار بيانات الدخول</h4>
        <p className="text-sm text-slate-500 mt-1">سلّمها للموظف. لن تظهر كلمة المرور مرة أخرى، ويستطيع تغييرها من «حسابي».</p>
      </div>
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 space-y-2 text-sm text-right">
        <div className="flex justify-between gap-3"><span className="text-slate-500">الاسم</span><b>{name}</b></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">اسم المستخدم</span><b dir="ltr" className="font-mono">{username}</b></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">كلمة المرور</span><b dir="ltr" className="font-mono">{password}</b></div>
      </div>
      <button className={`${btnCls} w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`} onClick={copy}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'تم النسخ' : 'نسخ البيانات'}
      </button>
      <div className="flex gap-2">
        {extra}
        <button className={`${btnCls} flex-1 bg-blue-600 text-white`} onClick={onBack}>{backLabel}</button>
      </div>
    </div>
  );
};
