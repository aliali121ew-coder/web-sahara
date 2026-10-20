import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, LogIn, ShieldAlert, Save, FileUp, Activity, Globe, Loader2, ChevronDown, Clock, Laptop } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { chatApi, type Account, type AuditEntry } from '../chat/chatApi';
import { errorText } from '../../i18n/errors';
import { fmtDayLabel } from '../../i18n/format';
import { ACTIONS, SEV, actionLabel } from './AuditLog';
import { UserAvatar, clock, fullDate, timeAgo } from './adminUi';

const DAYS = 14;
const PAGE = 100;
type Filter = 'all' | 'auth' | 'work';
const dayKey = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * سجل حساب واحد (من أيقونة السجل في بطاقة المستخدم): لوحة جانبية فيها آخر دخول وجهازه،
 * أرقام آخر 14 يومًا، شريط نشاط يومي، وخط زمني لكل عملية (دخول، فشل، حفظ، ملفات) مجمّع حسب اليوم.
 */
export const UserActivityPanel: React.FC<{ acc: Account; online: boolean; onClose: () => void }> = ({ acc, online, onClose }) => {
  const { t, i18n } = useTranslation('admin');
  const rtl = i18n.dir() === 'rtl';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const since = useMemo(() => dayKey(Date.now()) - (DAYS - 1) * 86400_000, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => { setOpen(false); setTimeout(onClose, 220); };

  useEffect(() => {
    chatApi.adminAudit({ user: acc.id, limit: PAGE })
      .then(r => { setItems(r.items); setMore(r.more); })
      .catch(e => setError(errorText(e)));
  }, [acc.id]);

  const loadMore = useCallback(() => {
    if (!items?.length) return;
    setLoadingMore(true);
    chatApi.adminAudit({ user: acc.id, limit: PAGE, before: items[items.length - 1].id })
      .then(r => { setItems(prev => [...(prev ?? []), ...r.items]); setMore(r.more); })
      .catch(e => setError(errorText(e)))
      .finally(() => setLoadingMore(false));
  }, [acc.id, items]);

  // ── الأرقام (آخر 14 يومًا من المحمّل) ──
  const recent = useMemo(() => (items ?? []).filter(e => e.at >= since), [items, since]);
  const count = (pred: (e: AuditEntry) => boolean) => recent.filter(pred).length;
  const stats = {
    logins: count(e => e.action === 'auth.login'),
    failed: count(e => e.action === 'auth.failed' || e.action === 'auth.locked'),
    saves: count(e => e.action === 'data.save'),
    files: count(e => e.action.startsWith('file.')),
  };
  const lastLogin = (items ?? []).find(e => e.action === 'auth.login');
  const lastWork = (items ?? []).find(e => !e.action.startsWith('auth.'));
  const ips = useMemo(() => new Set(recent.filter(e => e.action === 'auth.login' && e.ip).map(e => e.ip)).size, [recent]);

  // ── شريط النشاط اليومي ──
  const bars = useMemo(() => {
    const out = Array.from({ length: DAYS }, (_, i) => ({ day: since + i * 86400_000, n: 0, login: false, fail: false }));
    for (const e of recent) {
      const b = out[Math.round((dayKey(e.at) - since) / 86400_000)];
      if (!b) continue;
      b.n++;
      if (e.action === 'auth.login') b.login = true;
      if (e.action === 'auth.failed' || e.action === 'auth.locked') b.fail = true;
    }
    return out;
  }, [recent, since]);
  const maxBar = Math.max(1, ...bars.map(b => b.n));

  // ── الخط الزمني مجمّعًا حسب اليوم ──
  const shown = (items ?? []).filter(e => filter === 'all' || (filter === 'auth' ? e.action.startsWith('auth.') : !e.action.startsWith('auth.')));
  const groups = useMemo(() => {
    const m = new Map<number, AuditEntry[]>();
    for (const e of shown) { const k = dayKey(e.at); m.set(k, [...(m.get(k) ?? []), e]); }
    return [...m];
  }, [shown]);

  const kpi = (icon: React.ReactNode, label: string, value: number, tone: string) => (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
      <div className="mt-2 text-xl font-black tabular-nums text-slate-900 dark:text-white">{value}</div>
      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
  const seg = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold transition ${on ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`;

  return createPortal(
    <div className="fixed inset-0 z-[170]" dir={rtl ? 'rtl' : 'ltr'}>
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={close} />
      <aside role="dialog" aria-label={t('activity.title', { name: acc.name })}
        className={`absolute top-0 bottom-0 end-0 w-full sm:w-[460px] bg-slate-50 dark:bg-slate-950 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : rtl ? '-translate-x-full' : 'translate-x-full'}`}>
        {/* الرأس */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white px-5 pt-5 pb-6">
          <div className="absolute -top-16 -end-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <div className="relative">
              <UserAvatar name={acc.name} color={acc.color} src={acc.avatar} size={52} className="ring-2 ring-white/40" />
              <span className={`absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-indigo-700 ${online ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-blue-100/80">{t('activity.heading')}</div>
              <div className="text-lg font-black truncate">{acc.name}</div>
              <div className="text-[11.5px] text-blue-100/80 truncate"><span dir="ltr">@{acc.username}</span>{acc.role ? ` · ${acc.role}` : ''}</div>
            </div>
            <button type="button" onClick={close} aria-label={t('activity.close')} className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          {/* آخر دخول */}
          <div className="relative mt-4 rounded-2xl bg-white/10 ring-1 ring-white/15 px-3.5 py-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-400/20 text-emerald-200 flex items-center justify-center shrink-0"><LogIn className="w-4.5 h-4.5" /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-blue-100/80">{online ? t('activity.onlineNow') : t('activity.lastLogin')}</div>
              <div className="text-sm font-black truncate">{lastLogin ? fullDate(lastLogin.at) : t('activity.never')}</div>
            </div>
            {lastLogin?.ip && <span className="text-[10.5px] font-mono bg-white/10 px-2 py-1 rounded-lg inline-flex items-center gap-1" dir="ltr"><Globe className="w-3 h-3" />{lastLogin.ip}</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {error && <p className="text-sm text-rose-500">{error}</p>}
          {!items ? (
            <div className="py-16 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <>
              {/* الأرقام */}
              <div>
                <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2">{t('activity.lastDays', { count: DAYS })}</div>
                <div className="grid grid-cols-4 gap-2">
                  {kpi(<LogIn className="w-4 h-4" />, t('activity.kpi.logins'), stats.logins, 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300')}
                  {kpi(<ShieldAlert className="w-4 h-4" />, t('activity.kpi.failed'), stats.failed, stats.failed ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}
                  {kpi(<Save className="w-4 h-4" />, t('activity.kpi.saves'), stats.saves, 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300')}
                  {kpi(<FileUp className="w-4 h-4" />, t('activity.kpi.files'), stats.files, 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300')}
                </div>
              </div>

              {/* شريط النشاط */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />{t('activity.daily')}</span>
                  <span className="inline-flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5" />{t('activity.devices', { count: ips })}</span>
                </div>
                <div className="mt-3 h-20 flex items-end gap-1" dir="ltr">
                  {bars.map(b => (
                    <div key={b.day} className="flex-1 h-full flex flex-col justify-end items-center gap-1" title={`${fmtDayLabel(new Date(b.day))} · ${b.n}`}>
                      <div className={`w-full rounded-md transition-all ${b.fail ? 'bg-gradient-to-t from-rose-500 to-rose-300' : b.n ? 'bg-gradient-to-t from-blue-600 to-sky-400' : 'bg-slate-100 dark:bg-slate-800'}`}
                        style={{ height: `${b.n ? Math.max(10, (b.n / maxBar) * 100) : 6}%` }} />
                      <span className={`w-1.5 h-1.5 rounded-full ${b.login ? 'bg-emerald-500' : 'bg-transparent'}`} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400 font-mono" dir="ltr">
                  <span>{new Date(since).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</span>
                  <span>{t('activity.today')}</span>
                </div>
                {lastWork && (
                  <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[11.5px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-500">{t('activity.lastWork')}</span>
                    <b className="text-slate-800 dark:text-slate-100 truncate">{actionLabel(lastWork.action)}{lastWork.detail ? ` — ${lastWork.detail}` : ''}</b>
                    <span className="ms-auto text-slate-400 shrink-0">{timeAgo(lastWork.at)}</span>
                  </div>
                )}
              </div>

              {/* الخط الزمني */}
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-max">
                {(['all', 'auth', 'work'] as Filter[]).map(f => (
                  <button key={f} type="button" onClick={() => setFilter(f)} className={seg(filter === f)}>{t(`activity.filter.${f}`)}</button>
                ))}
              </div>
              {!groups.length ? (
                <div className="py-10 text-center text-sm text-slate-400">{t('activity.empty')}</div>
              ) : groups.map(([day, list]) => (
                <section key={day}>
                  <div className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur text-[11px] font-black text-slate-500 dark:text-slate-400">
                    {fmtDayLabel(new Date(day))} <span className="font-bold text-slate-400">· {list.length}</span>
                  </div>
                  <ol className="relative ms-4 border-s-2 border-slate-200 dark:border-slate-800 space-y-2 py-1">
                    {list.map(e => {
                      const meta = ACTIONS[e.action] ?? { icon: Activity, sev: 'info' as const };
                      const Icon = meta.icon;
                      const sev = SEV[meta.sev];
                      return (
                        <li key={e.id} className="relative ps-5">
                          <span className={`absolute -start-[15px] top-2 w-7 h-7 rounded-full ring-4 ring-slate-50 dark:ring-slate-950 flex items-center justify-center ${sev.dot}`}><Icon className="w-3.5 h-3.5" /></span>
                          <div className={`rounded-xl border ${sev.ring} bg-white dark:bg-slate-900 px-3 py-2`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-[12.5px] font-black ${sev.text}`}>{actionLabel(e.action)}</span>
                              <span className="ms-auto text-[10.5px] font-mono text-slate-400" title={fullDate(e.at)}>{clock(e.at)}</span>
                            </div>
                            {e.detail && <div className="mt-0.5 text-[11.5px] text-slate-600 dark:text-slate-300 break-words">{e.detail}</div>}
                            {e.ip && <div className="mt-1 text-[10px] font-mono text-slate-400 inline-flex items-center gap-1" dir="ltr"><Globe className="w-3 h-3" />{e.ip}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
              {more && (
                <button type="button" onClick={loadMore} disabled={loadingMore}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-blue-300 inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60">
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}{t('activity.more')}
                </button>
              )}
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
};
