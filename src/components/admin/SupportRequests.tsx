import React, { useMemo, useState } from 'react';
import { Inbox, UserPlus, KeyRound, HelpCircle, Phone, MessageCircle, CheckCircle2, RotateCcw, Loader2, Search, Clock, AlertTriangle, CheckCheck, AtSign, UserCheck } from 'lucide-react';
import { chatApi, type Account, type SupportRequest } from '../chat/chatApi';
import { CopyButton, Empty, KpiCard, Skeleton, UserAvatar, btnCls, cardCls, chipCls, fullDate, inputCls, timeAgo } from './adminUi';

const KIND: Record<SupportRequest['kind'], { label: string; icon: React.ComponentType<{ className?: string }>; tone: string; bar: string }> = {
  account: { label: 'حساب جديد', icon: UserPlus, tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', bar: 'bg-blue-500' },
  password: { label: 'نسيت كلمة المرور', icon: KeyRound, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', bar: 'bg-amber-500' },
  other: { label: 'مشكلة أخرى', icon: HelpCircle, tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', bar: 'bg-slate-400' },
};
const DAY = 24 * 3600_000;

/** رقم عراقي محلي ← دولي لواتساب (07xx → 9647xx) */
const waNumber = (phone: string) => phone.replace(/^\+/, '').replace(/^00/, '').replace(/^0(7\d{9})$/, '964$1');

export const SupportRequests: React.FC<{
  items: SupportRequest[] | null;
  users: Account[];
  reload: () => Promise<unknown>;
  onCreate: (p: { name: string; username: string; requestId: string }) => void;
  onResetPassword: (acc: Account, requestId: string) => void;
}> = ({ items, users, reload, onCreate, onResetPassword }) => {
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open');
  const [kind, setKind] = useState<SupportRequest['kind'] | ''>('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const byUsername = useMemo(() => Object.fromEntries(users.map(u => [u.username, u])), [users]);
  const all = items || [];
  const open = all.filter(r => r.status === 'open');
  const stats = {
    open: open.length,
    account: open.filter(r => r.kind === 'account').length,
    password: open.filter(r => r.kind === 'password').length,
    late: open.filter(r => Date.now() - r.created_at > DAY).length,
  };

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter(r => (status === 'all' || r.status === status) && (!kind || r.kind === kind)
        && (!t || r.name.toLowerCase().includes(t) || r.phone.includes(t) || r.username.includes(t) || r.message.toLowerCase().includes(t)))
      // المفتوح: الأقدم أولًا (الأولى بالمعالجة)، والمكتمل: الأحدث أولًا
      .sort((a, b) => (status === 'open' ? a.created_at - b.created_at : b.created_at - a.created_at));
  }, [all, status, kind, q]);

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
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="طلبات مفتوحة" value={stats.open} icon={Inbox} tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
          onClick={() => { setStatus('open'); setKind(''); }} active={status === 'open' && !kind} />
        <KpiCard label="حسابات جديدة" value={stats.account} icon={UserPlus} tone="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
          onClick={() => { setStatus('open'); setKind('account'); }} active={status === 'open' && kind === 'account'} />
        <KpiCard label="كلمات مرور" value={stats.password} icon={KeyRound} tone="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
          onClick={() => { setStatus('open'); setKind('password'); }} active={status === 'open' && kind === 'password'} />
        <KpiCard label="متأخرة +24 ساعة" value={stats.late} icon={AlertTriangle} tone={stats.late ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'} />
      </div>

      <div className={`${cardCls} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالاسم أو الهاتف أو نص الطلب" className={`${inputCls} pr-10`} />
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
            {([['open', 'مفتوحة'], ['done', 'مكتملة'], ['all', 'الكل']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setStatus(id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${status === id ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm font-bold text-rose-500">{error}</p>}

        {!items ? <Skeleton rows={3} /> : !list.length ? (
          <Empty icon={status === 'open' ? CheckCheck : Inbox} title={status === 'open' ? 'لا توجد طلبات بانتظارك' : 'لا توجد طلبات'} hint={status === 'open' ? 'كل طلبات الموظفين تمت معالجتها' : undefined} />
        ) : (
          <ul className="space-y-2.5">
            {list.map(r => {
              const k = KIND[r.kind] || KIND.other;
              const KIcon = k.icon;
              const late = r.status === 'open' && Date.now() - r.created_at > DAY;
              const existing = r.username ? byUsername[r.username] : undefined;
              return (
                <li key={r.id} className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 transition ${r.status === 'done' ? 'border-slate-200/60 dark:border-slate-800 opacity-70' : late ? 'border-rose-200 dark:border-rose-900/60' : 'border-slate-200 dark:border-slate-800'}`}>
                  <span className={`absolute right-0 top-0 bottom-0 w-1 ${r.status === 'done' ? 'bg-slate-300 dark:bg-slate-700' : k.bar}`} />
                  <div className="p-4 pr-5">
                    <div className="flex items-start gap-3">
                      <UserAvatar name={r.name} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <b className="text-sm text-slate-900 dark:text-white">{r.name}</b>
                          <span className={`${chipCls} ${k.tone}`}><KIcon className="w-3 h-3" />{k.label}</span>
                          {r.status === 'done' && <span className={`${chipCls} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`}><CheckCircle2 className="w-3 h-3" />مكتمل</span>}
                          {late && <span className={`${chipCls} bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300`}><AlertTriangle className="w-3 h-3" />متأخر</span>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1" title={fullDate(r.created_at)}><Clock className="w-3.5 h-3.5" />{timeAgo(r.created_at)}</span>
                          {r.username && (
                            <span className="inline-flex items-center gap-1" dir="ltr"><AtSign className="w-3.5 h-3.5" />{r.username}
                              {existing && <span className={`${chipCls} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mr-1`} dir="rtl"><UserCheck className="w-3 h-3" />حساب موجود</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {r.message && (
                      <blockquote className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 border-r-2 border-slate-300 dark:border-slate-600">
                        {r.message}
                      </blockquote>
                    )}

                    {/* التواصل */}
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <span dir="ltr" className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100 ml-1">{r.phone}</span>
                      <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200"><Phone className="w-3.5 h-3.5" />اتصال</a>
                      <a href={`https://wa.me/${waNumber(r.phone)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"><MessageCircle className="w-3.5 h-3.5" />واتساب</a>
                      <CopyButton text={r.phone} className="w-8 h-8 bg-slate-100 dark:bg-slate-800 text-slate-500" />
                    </div>

                    {/* الإجراءات */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                      {r.status === 'open' && r.kind === 'account' && !existing && (
                        <button onClick={() => onCreate({ name: r.name, username: r.username, requestId: r.id })} className={`${btnCls} flex-1 bg-blue-600 hover:bg-blue-700 text-white`}>
                          <UserPlus className="w-4 h-4" /> إنشاء الحساب
                        </button>
                      )}
                      {r.status === 'open' && existing && (r.kind === 'password' || r.kind === 'account') && (
                        <button onClick={() => onResetPassword(existing, r.id)} className={`${btnCls} flex-1 bg-amber-500 hover:bg-amber-600 text-white`}>
                          <KeyRound className="w-4 h-4" /> إعادة تعيين كلمة مرور @{existing.username}
                        </button>
                      )}
                      <button disabled={busy === r.id} onClick={() => toggle(r)}
                        className={`${btnCls} flex-1 ${r.status === 'open' ? 'bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : r.status === 'open' ? <CheckCircle2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                        {r.status === 'open' ? 'تمت المعالجة' : 'إعادة فتح الطلب'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
