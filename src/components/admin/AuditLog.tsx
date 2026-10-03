import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  History, LogIn, LogOut, ShieldAlert, Lock, KeyRound, UserPlus, UserCog, Inbox, Save, FileUp, FileX, Search, RefreshCw,
  Download, Users, Loader2, ChevronDown, Activity, Globe, Clock, Hash, X,
} from 'lucide-react';
import { chatApi, type Account, type AuditEntry } from '../chat/chatApi';
import { formatDay } from '../chat/chatUtils';
import { Empty, KpiCard, Skeleton, UserAvatar, btnCls, cardCls, chipCls, clock, fullDate, inputCls, timeAgo } from './adminUi';

type Severity = 'info' | 'success' | 'warn' | 'danger';
const ACTIONS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; sev: Severity }> = {
  'auth.login': { label: 'تسجيل دخول', icon: LogIn, sev: 'success' },
  'auth.logout': { label: 'تسجيل خروج', icon: LogOut, sev: 'info' },
  'auth.failed': { label: 'محاولة دخول فاشلة', icon: ShieldAlert, sev: 'warn' },
  'auth.locked': { label: 'قفل الحساب مؤقتًا', icon: Lock, sev: 'danger' },
  'auth.password': { label: 'تغيير كلمة المرور', icon: KeyRound, sev: 'info' },
  'admin.create': { label: 'إنشاء حساب', icon: UserPlus, sev: 'success' },
  'admin.update': { label: 'تعديل حساب', icon: UserCog, sev: 'info' },
  'admin.support': { label: 'معالجة طلب دعم', icon: Inbox, sev: 'info' },
  'data.save': { label: 'حفظ بيانات', icon: Save, sev: 'info' },
  'data.denied': { label: 'تعديل مرفوض', icon: ShieldAlert, sev: 'danger' },
  'file.upload': { label: 'رفع ملف', icon: FileUp, sev: 'info' },
  'file.delete': { label: 'حذف ملف', icon: FileX, sev: 'warn' },
};
const SEV: Record<Severity, { dot: string; ring: string; text: string }> = {
  info: { dot: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', ring: 'border-slate-200 dark:border-slate-800', text: 'text-slate-900 dark:text-white' },
  success: { dot: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', ring: 'border-slate-200 dark:border-slate-800', text: 'text-slate-900 dark:text-white' },
  warn: { dot: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', ring: 'border-amber-200/70 dark:border-amber-900/50', text: 'text-amber-800 dark:text-amber-200' },
  danger: { dot: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', ring: 'border-rose-200/80 dark:border-rose-900/60', text: 'text-rose-700 dark:text-rose-300' },
};
const CATEGORIES: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: '', label: 'الكل', icon: Activity },
  { id: 'auth', label: 'الدخول', icon: LogIn },
  { id: 'admin', label: 'الحسابات', icon: UserCog },
  { id: 'data', label: 'البيانات', icon: Save },
  { id: 'file', label: 'الملفات', icon: FileUp },
];
const PERIODS: { id: string; label: string; ms: number }[] = [
  { id: 'today', label: 'اليوم', ms: 0 },
  { id: '7d', label: '7 أيام', ms: 7 * 86400_000 },
  { id: '30d', label: '30 يوم', ms: 30 * 86400_000 },
  { id: 'all', label: 'الكل', ms: -1 },
];
const periodSince = (id: string) => {
  const p = PERIODS.find(x => x.id === id)!;
  if (p.ms < 0) return undefined;
  if (p.ms === 0) { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  return Date.now() - p.ms;
};

const useDebounced = <T,>(value: T, ms = 350) => {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
};

/** تصدير الصفوف المعروضة إلى CSV (يفتح في Excel مع العربية) */
const exportCsv = (rows: AuditEntry[], names: Record<string, Account>) => {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [['التاريخ', 'المستخدم', 'اسم المستخدم', 'العملية', 'التفاصيل', 'IP'].map(esc).join(',')];
  for (const r of rows) {
    lines.push([fullDate(r.at), names[r.user_id]?.name || '', r.username, ACTIONS[r.action]?.label || r.action, r.detail, r.ip].map(esc).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `سجل-العمليات-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export const AuditLog: React.FC<{ users: Account[] }> = ({ users }) => {
  const [user, setUser] = useState('');
  const [category, setCategory] = useState('');
  const [period, setPeriod] = useState('7d');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [stats, setStats] = useState<Record<string, { n: number; users: number }>>({});

  const load = useCallback(async (append = false, before?: number) => {
    setLoading(true);
    setError('');
    try {
      const r = await chatApi.adminAudit({ user, action: category, q, since: periodSince(period), before, limit: 50 });
      setItems(prev => (append && prev ? [...prev, ...r.items] : r.items));
      setMore(r.more);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, category, q, period]);
  const loadStats = useCallback(() => chatApi.adminAuditStats().then(r => setStats(Object.fromEntries(r.items.map(i => [i.action, i])))).catch(() => {}), []);

  useEffect(() => { setItems(null); load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const names = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);
  const groups = useMemo(() => {
    const out: { day: string; rows: AuditEntry[] }[] = [];
    for (const row of items || []) {
      const day = formatDay(row.at);
      if (out[out.length - 1]?.day === day) out[out.length - 1].rows.push(row);
      else out.push({ day, rows: [row] });
    }
    return out;
  }, [items]);

  const n = (a: string) => stats[a]?.n || 0;
  const activeFilters = [user && 'user', category && 'cat', q && 'q', period !== '7d' && 'period'].filter(Boolean).length;
  const reset = () => { setUser(''); setCategory(''); setSearch(''); setPeriod('7d'); };

  return (
    <div className="space-y-3">
      {/* ملخص آخر 24 ساعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="دخول ناجح (24 ساعة)" value={n('auth.login')} sub={`${stats['auth.login']?.users || 0} مستخدم`} icon={LogIn}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" />
        <KpiCard label="محاولات فاشلة" value={n('auth.failed') + n('auth.locked')} sub={n('auth.locked') ? `${n('auth.locked')} قفل مؤقت` : 'لا أقفال'} icon={ShieldAlert}
          tone={n('auth.failed') + n('auth.locked') ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'} />
        <KpiCard label="عمليات حفظ" value={n('data.save')} sub={`${stats['data.save']?.users || 0} مستخدم نشط`} icon={Save}
          tone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" />
        <KpiCard label="تعديلات مرفوضة" value={n('data.denied')} sub="محاولات بلا صلاحية" icon={Lock}
          tone={n('data.denied') ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'} />
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        {/* شريط التصفية */}
        <div className="p-4 sm:p-5 space-y-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في التفاصيل أو اسم المستخدم..." className={`${inputCls} pr-10`} />
            </div>
            <label className="relative md:w-60">
              <Users className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select value={user} onChange={e => setUser(e.target.value)} className={`${inputCls} pr-10 appearance-none`}>
                <option value="">كل المستخدمين</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)}
              </select>
              <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </label>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
            <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
              {CATEGORIES.map(c => {
                const Icon = c.icon;
                const on = category === c.id;
                return (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${on ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
                    <Icon className="w-3.5 h-3.5" />{c.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 lg:mr-auto">
              <div className="flex gap-0.5 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                {PERIODS.map(p => (
                  <button key={p.id} onClick={() => setPeriod(p.id)}
                    className={`px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold transition ${period === p.id ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <button onClick={() => { load(); loadStats(); }} title="تحديث" aria-label="تحديث" className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button disabled={!items?.length} onClick={() => items && exportCsv(items, names)} title="تصدير CSV" className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 text-xs font-bold hover:bg-slate-200 disabled:opacity-40">
                <Download className="w-4 h-4" /><span className="hidden sm:inline">تصدير</span>
              </button>
            </div>
          </div>
          {activeFilters > 0 && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500 font-bold">{items ? `${items.length}${more ? '+' : ''} نتيجة` : '...'}</span>
              <button onClick={reset} className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"><X className="w-3 h-3" />مسح التصفية</button>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {error && <p className="text-sm font-bold text-rose-500 mb-3">{error}</p>}
          {!items ? <Skeleton rows={5} /> : !items.length ? (
            <Empty icon={History} title="لا توجد عمليات" hint={activeFilters ? 'جرّب تغيير التصفية أو الفترة الزمنية' : 'ستظهر هنا عمليات الدخول والتعديل فور حدوثها'} />
          ) : (
            <div className="space-y-5">
              {groups.map(g => (
                <section key={g.day}>
                  <div className="sticky top-14 z-10 flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black shadow-sm">{g.day}</span>
                    <span className="text-[11px] font-bold text-slate-400">{g.rows.length} عملية</span>
                    <span className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <ol className="relative space-y-1.5 before:absolute before:right-[19px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                    {g.rows.map(row => {
                      const meta = ACTIONS[row.action] || { label: row.action, icon: History, sev: 'info' as Severity };
                      const sev = SEV[meta.sev];
                      const Icon = meta.icon;
                      const who = names[row.user_id];
                      const parts = row.action.startsWith('data.') ? row.detail.split('، ').filter(Boolean) : [];
                      const open = expanded === row.id;
                      return (
                        <li key={row.id} className="relative flex gap-3">
                          <span className={`relative z-[1] w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-4 ring-white dark:ring-slate-900 ${sev.dot}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <button onClick={() => setExpanded(open ? null : row.id)} aria-expanded={open}
                            className={`flex-1 min-w-0 text-right rounded-2xl border px-3.5 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 ${sev.ring} ${open ? 'bg-slate-50 dark:bg-slate-800/40' : ''}`}>
                            <div className="flex items-center gap-2">
                              <b className={`text-sm ${sev.text}`}>{meta.label}</b>
                              <span className="flex items-center gap-1.5 min-w-0 text-xs text-slate-500">
                                {who && <UserAvatar name={who.name} color={who.color} size={18} className="!rounded-md" />}
                                <span className="truncate">{who?.name || (row.username ? `@${row.username}` : 'غير معروف')}</span>
                              </span>
                              <span className="mr-auto shrink-0 text-[11px] text-slate-400 tabular-nums" title={fullDate(row.at)}>{clock(row.at)}</span>
                            </div>
                            {parts.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {parts.slice(0, open ? undefined : 4).map(p => <span key={p} className={`${chipCls} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300`}>{p}</span>)}
                                {!open && parts.length > 4 && <span className={`${chipCls} text-slate-400`}>+{parts.length - 4}</span>}
                              </div>
                            ) : row.detail ? <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 break-words line-clamp-2">{row.detail}</p> : null}
                            {open && (
                              <dl className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 text-slate-500"><Clock className="w-3.5 h-3.5" /><dd className="text-slate-700 dark:text-slate-200">{fullDate(row.at)} · {timeAgo(row.at)}</dd></div>
                                <div className="flex items-center gap-1.5 text-slate-500"><Users className="w-3.5 h-3.5" /><dd className="text-slate-700 dark:text-slate-200" dir="ltr">@{row.username || '—'}</dd></div>
                                <div className="flex items-center gap-1.5 text-slate-500"><Globe className="w-3.5 h-3.5" /><dd className="text-slate-700 dark:text-slate-200 font-mono" dir="ltr">{row.ip || '—'}</dd></div>
                                <div className="flex items-center gap-1.5 text-slate-500"><Hash className="w-3.5 h-3.5" /><dd className="text-slate-700 dark:text-slate-200 font-mono" dir="ltr">{row.action} #{row.id}</dd></div>
                              </dl>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
              {more && (
                <button disabled={loading} onClick={() => load(true, items[items.length - 1]?.id)} className={`${btnCls} w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} عرض عمليات أقدم
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
