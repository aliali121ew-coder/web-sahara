import React, { useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, Search, Loader2, Crown, Ban, CheckCircle2, ArrowRight, KeyRound, RefreshCw, Check, Copy, ShieldCheck } from 'lucide-react';
import { chatApi, type Account } from '../chat/chatApi';
import { PERM_GROUPS, ALL_SECTIONS, type Level, type Perms } from '../../lib/permCatalog';
import { useSessionProfile } from '../../lib/session';

/** كلمة مرور عشوائية سهلة الإملاء (بدون أحرف ملتبسة مثل 0/O و 1/l) */
const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, x => chars[x % chars.length]).join('');
};

const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none';
const btnCls = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50';
const LEVELS: { v: Level; label: string; on: string }[] = [
  { v: 0, label: 'لا يوجد', on: 'bg-slate-600 text-white' },
  { v: 1, label: 'عرض', on: 'bg-sky-600 text-white' },
  { v: 2, label: 'عرض وتعديل', on: 'bg-emerald-600 text-white' },
];

type View = { kind: 'list' } | { kind: 'form'; acc?: Account } | { kind: 'issued'; name: string; username: string; password: string };

/** إدارة المستخدمين والصلاحيات (لمدير النظام فقط) */
export const UsersAdmin: React.FC = () => {
  const me = useSessionProfile();
  const [items, setItems] = useState<Account[] | null>(null);
  const [max, setMax] = useState(100);
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => chatApi.adminUsers().then(r => { setItems(r.items); setMax(r.max); }).catch(e => setError((e as Error).message));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items || []).filter(a => !t || a.name.toLowerCase().includes(t) || a.username.includes(t) || a.role.toLowerCase().includes(t));
  }, [items, q]);

  const toggleDisabled = async (a: Account) => {
    setBusy(true);
    setError('');
    try {
      await chatApi.adminUpdate(a.id, { disabled: !a.disabled });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-soft-card space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <Users className="w-5 h-5 text-violet-600" />
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex-1">إدارة المستخدمين والصلاحيات</h3>
        {view.kind === 'list' && (
          <button className={`${btnCls} bg-blue-600 hover:bg-blue-700 text-white`} disabled={(items || []).length >= max} onClick={() => setView({ kind: 'form' })}>
            <UserPlus className="w-4 h-4" /> حساب جديد
          </button>
        )}
      </div>

      {view.kind === 'form' && (
        <AccountForm
          acc={view.acc}
          self={view.acc?.id === me?.id}
          onBack={() => setView({ kind: 'list' })}
          onDone={(name, username, password) => { load(); setView(password ? { kind: 'issued', name, username, password } : { kind: 'list' }); }}
        />
      )}
      {view.kind === 'issued' && <Issued {...view} onBack={() => setView({ kind: 'list' })} />}

      {view.kind === 'list' && (<>
        <p className="text-xs text-slate-500 leading-relaxed">
          مدير النظام فقط ينشئ الحسابات. الحساب الجديد لا يرى أي قسم حتى تحدد صلاحياته، والحساب الموقوف لا يستطيع الدخول للبرنامج ولا للمحادثة.
        </p>
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالاسم أو اسم المستخدم أو الوظيفة" className={`${inputCls} pr-10`} />
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
        {!items && !error && <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map(a => {
            const granted = a.is_admin ? ALL_SECTIONS.length : Object.keys(a.perms || {}).length;
            return (
              <li key={a.id} className={`flex items-center gap-3 py-2.5 ${a.disabled ? 'opacity-55' : ''}`}>
                <button onClick={() => setView({ kind: 'form', acc: a })} className="flex-1 min-w-0 text-right">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white truncate">
                    {a.name}
                    {!!a.is_admin && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    {a.id === me?.id && <span className="text-[10px] text-slate-400">(أنت)</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    <span dir="ltr">@{a.username}</span>{a.role ? ` · ${a.role}` : ''} · {a.disabled ? 'موقوف' : a.is_admin ? 'كل الصلاحيات' : granted ? `${granted} قسم` : 'بدون صلاحيات'}
                  </div>
                </button>
                {a.id !== me?.id && (
                  <button
                    disabled={busy}
                    onClick={() => toggleDisabled(a)}
                    title={a.disabled ? 'تفعيل الحساب' : 'إيقاف الحساب'}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 ${a.disabled ? 'text-emerald-500' : 'text-rose-500'}`}
                  >
                    {a.disabled ? <CheckCircle2 className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                  </button>
                )}
              </li>
            );
          })}
          {items && !filtered.length && <li className="text-center text-sm text-slate-400 py-6">لا توجد نتائج</li>}
        </ul>
      </>)}
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
      {PERM_GROUPS.map(g => (
        <div key={g.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-extrabold text-slate-700 dark:text-slate-200">{g.label}</div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {g.sections.map(s => {
              const cur = value[s.id] || 0;
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2 flex-wrap">
                  <span className="flex-1 min-w-[7rem] text-sm font-bold text-slate-800 dark:text-slate-100">{s.label}</span>
                  <div role="radiogroup" aria-label={s.label} className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                    {LEVELS.map(l => (
                      <button
                        key={l.v} type="button" role="radio" aria-checked={cur === l.v} onClick={() => set(s.id, l.v)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${cur === l.v ? l.on : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                      >
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
  );
};

// ───── إنشاء / تعديل حساب ─────
const AccountForm: React.FC<{
  acc?: Account;
  self?: boolean;
  onBack: () => void;
  onDone: (name: string, username: string, password?: string) => void;
}> = ({ acc, self, onBack, onDone }) => {
  const editing = !!acc;
  const [name, setName] = useState(acc?.name || '');
  const [username, setUsername] = useState(acc?.username || '');
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
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">
        <ArrowRight className="w-4 h-4" /> رجوع للقائمة
      </button>
      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{editing ? `تعديل حساب ${acc.name}` : 'حساب جديد'}</h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم الكامل *</span>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} className={inputCls} placeholder="مثال: علي حسين" />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المستخدم *</span>
          <input
            dir="ltr" value={username} disabled={editing} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            maxLength={32} className={`${inputCls} ${editing ? 'opacity-60' : ''}`} placeholder="ali.hussein" autoCapitalize="none" spellCheck={false}
          />
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
      <div className="flex gap-2">
        <button className={`${btnCls} flex-1 bg-blue-600 hover:bg-blue-700 text-white`} disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editing ? 'حفظ التعديلات' : 'إنشاء الحساب'}
        </button>
        <button className={`${btnCls} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`} onClick={onBack}>إلغاء</button>
      </div>
    </div>
  );
};

// ───── بيانات الدخول بعد الإصدار (تظهر مرة واحدة) ─────
const Issued: React.FC<{ name: string; username: string; password: string; onBack: () => void }> = ({ name, username, password, onBack }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`الاسم: ${name}\nاسم المستخدم: ${username}\nكلمة المرور: ${password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* تجاهل */ }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">سلّم هذه البيانات للموظف. لن تظهر كلمة المرور مرة أخرى، ويستطيع تغييرها من «حسابي».</p>
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3"><span className="text-slate-500">الاسم</span><b>{name}</b></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">اسم المستخدم</span><b dir="ltr" className="font-mono">{username}</b></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">كلمة المرور</span><b dir="ltr" className="font-mono">{password}</b></div>
      </div>
      <div className="flex gap-2">
        <button className={`${btnCls} flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`} onClick={copy}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'تم النسخ' : 'نسخ البيانات'}
        </button>
        <button className={`${btnCls} flex-1 bg-blue-600 text-white`} onClick={onBack}>تم</button>
      </div>
    </div>
  );
};
