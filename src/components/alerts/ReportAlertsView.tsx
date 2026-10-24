import React, { useMemo, useState } from 'react';
import {
  BellRing, ShieldCheck, ShieldAlert, ShieldQuestion, Flame, Building2, Fuel, Droplets, Search, FileText, Layers, CheckCheck,
  Link2, ArrowLeftRight, Inbox, Percent, Users, MessageSquare, Download, Upload, PenLine, Trash2, PlusCircle, Send, Lock, RotateCcw,
  ExternalLink, Hourglass, CircleCheck, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { usePermissions } from '../../lib/usePermission';
import { useSessionProfile } from '../../lib/session';
import { setSessionValue } from '../../lib/useSessionState';
import { useFuelNav } from '../../context/FuelDataContext';
import { CHECK_SECTION_PERM, REPORT_ALERTS_KEY, markAlertsReviewed, type CheckSection, type CheckStatus, type ReportAlert } from '../../lib/reportCheck';
import {
  REPORT_ACTIVITY_KEY, REPORT_THREADS_KEY, postThread, threadAssignee, threadStatus,
  type ReportActivity, type ThreadMessage, type ThreadStatus,
} from '../../lib/reportActivity';
import { siteName as blackOilSiteName } from '../../lib/blackOilLedger';
import { fmtDayLabel, fmtNumber, fmtRelative, fmtTime } from '../../i18n/format';
import { enumText } from '../../i18n/enums';
import type { NavTabId } from '../../types';

// ───── الأقسام والحالات ─────
type Group = 'all' | 'sahara-gas' | 'etihad-gas' | 'petrol' | 'black-oil';
const GROUP_ICON: Record<Group, React.ComponentType<{ className?: string }>> = { all: Layers, 'sahara-gas': Flame, 'etihad-gas': Building2, petrol: Fuel, 'black-oil': Droplets };
const groupOf = (s: CheckSection): Group => (s.startsWith('black-oil') ? 'black-oil' : (s as Group));
const SECTION_STYLE: Record<CheckSection, { icon: React.ComponentType<{ className?: string }>; chip: string }> = {
  'sahara-gas': { icon: Flame, chip: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  'etihad-gas': { icon: Building2, chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  petrol: { icon: Fuel, chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  'black-oil-sahara': { icon: Droplets, chip: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
  'black-oil-etihad': { icon: Droplets, chip: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
};
const CHECK_STYLE: Record<CheckStatus, { icon: React.ComponentType<{ className?: string }>; bar: string; badge: string }> = {
  mismatch: { icon: ShieldAlert, bar: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  match: { icon: ShieldCheck, bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  noFileValue: { icon: ShieldQuestion, bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  noPrevDay: { icon: ShieldQuestion, bar: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
const THREAD_STYLE: Record<Exclude<ThreadStatus, 'none'>, { icon: React.ComponentType<{ className?: string }>; bar: string; badge: string }> = {
  waiting_user: { icon: Hourglass, bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  waiting_admin: { icon: MessageSquare, bar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  closed: { icon: CircleCheck, bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
};
/** صفحة كل قسم وتبويبه (لزر "فتح القسم للتعديل") */
const SECTION_PAGE: Record<CheckSection, { tab: NavTabId; key: string; subtab: string }> = {
  'sahara-gas': { tab: 'finance-sahara', key: 'sahara_subtab', subtab: 'balance' },
  petrol: { tab: 'finance-sahara', key: 'sahara_subtab', subtab: 'petrol' },
  'black-oil-sahara': { tab: 'finance-sahara', key: 'sahara_subtab', subtab: 'black-oil' },
  'etihad-gas': { tab: 'finance-etihad', key: 'etihad_subtab', subtab: 'balance' },
  'black-oil-etihad': { tab: 'finance-etihad', key: 'etihad_subtab', subtab: 'black-oil' },
};
const PERIODS = { '7d': 7 * 86400_000, '30d': 30 * 86400_000, all: Infinity } as const;
type Period = keyof typeof PERIODS;
type Tab = 'alerts' | 'users' | 'corrections';
type StatusFilter = 'all' | 'mismatch' | 'match' | 'noFileValue';

const cardCls = 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';
const AVATAR = ['#2563eb', '#0d9488', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#059669'];
const avatarColor = (s: string) => AVATAR[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '؟';
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 34 }) => (
  <span className="rounded-full text-white font-black flex items-center justify-center shrink-0" style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.36 }}>{initialsOf(name)}</span>
);
const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : fmtNumber(Math.round(v)));
const signed = (v: number) => `${v > 0 ? '+' : ''}${fmtNumber(v)}`;
const fieldLabel = (k: string) => (i18n.exists(`alerts:field.${k}`) ? i18n.t(`alerts:field.${k}`) : k);
const textareaCls = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500';

/** حدث في الخط الزمني (تقرير، تعديل، رسالة تصحيح) */
interface TimelineEvent { id: string; at: number; tone: 'blue' | 'red' | 'green' | 'amber' | 'slate'; title: string; meta: string; body?: string; changes?: ReportActivity['changes'] }
const DOT: Record<TimelineEvent['tone'], string> = { blue: 'border-blue-500', red: 'border-rose-500', green: 'border-emerald-500', amber: 'border-amber-500', slate: 'border-slate-400' };

const Timeline: React.FC<{ events: TimelineEvent[] }> = ({ events }) => (
  <ol className="relative ps-5 space-y-3 before:absolute before:start-[7px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200 dark:before:bg-slate-700">
    {events.map(e => (
      <li key={e.id} className="relative">
        <span className={`absolute -start-5 top-1 w-[15px] h-[15px] rounded-full bg-white dark:bg-slate-900 border-[3px] ${DOT[e.tone]}`} />
        <div className="text-[12.5px] font-black text-slate-800 dark:text-slate-100">{e.title}</div>
        <div className="text-[11px] text-slate-500">{e.meta}</div>
        {e.body && <div className="mt-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{e.body}</div>}
        {e.changes && e.changes.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {e.changes.map(c => (
              <li key={c.field} className="text-[11px] flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-600 dark:text-slate-300">{fieldLabel(c.field)}:</span>
                <span className="font-mono tabular-nums text-slate-400 line-through">{n(c.from)}</span>
                <span className="text-slate-400">←</span>
                <span className="font-mono tabular-nums font-black text-slate-800 dark:text-slate-100">{n(c.to)}</span>
              </li>
            ))}
          </ul>
        )}
      </li>
    ))}
  </ol>
);

const Empty: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; hint?: string }> = ({ icon: Icon, title, hint }) => (
  <div className={`${cardCls} py-14 flex flex-col items-center text-center gap-2 px-4`}>
    <span className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Icon className="w-7 h-7 text-slate-400" /></span>
    <div className="font-black text-slate-800 dark:text-slate-100">{title}</div>
    {hint && <p className="text-xs text-slate-500 max-w-sm">{hint}</p>}
  </div>
);

/**
 * سجل التنبيهات: التحقق من صحة التقارير اليومية للأقسام الأربعة، ونشاط كل مستخدم عليها،
 * وطلبات التصحيح: المدير يطلب، المستخدم يصحّح ويردّ بإكمال الإجراء، ثم يُغلق الطلب أو يُعاد فتحه.
 */
export const ReportAlertsView: React.FC = () => {
  const { t } = useTranslation(['alerts', 'common']);
  const rtl = i18n.dir() === 'rtl';
  const Back = rtl ? ArrowRight : ArrowLeft;
  const [alertsAll] = useSyncedStorage<ReportAlert[]>(REPORT_ALERTS_KEY, []);
  const [activityAll] = useSyncedStorage<ReportActivity[]>(REPORT_ACTIVITY_KEY, []);
  const [threadsAll] = useSyncedStorage<ThreadMessage[]>(REPORT_THREADS_KEY, []);
  const { canView, canEdit, isAdmin } = usePermissions();
  const me = useSessionProfile()?.username || '';
  const { setActiveTab } = useFuelNav();

  const [tab, setTab] = useState<Tab>('alerts');
  const [period, setPeriod] = useState<Period>('7d');
  const [group, setGroup] = useState<Group>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const since = period === 'all' ? 0 : Date.now() - PERIODS[period];
  const alerts = useMemo(() => alertsAll.filter(a => canView(CHECK_SECTION_PERM[a.section])).sort((a, b) => b.at - a.at), [alertsAll, canView]);
  const activity = useMemo(() => activityAll.filter(a => canView(CHECK_SECTION_PERM[a.section])).sort((a, b) => b.at - a.at), [activityAll, canView]);
  const alertById = useMemo(() => new Map(alerts.map(a => [a.id, a])), [alerts]);
  const threads = useMemo(() => {
    const m = new Map<string, ThreadMessage[]>();
    for (const msg of threadsAll) if (alertById.has(msg.alertId)) m.set(msg.alertId, [...(m.get(msg.alertId) || []), msg]);
    for (const [k, v] of m) m.set(k, v.sort((x, y) => x.at - y.at));
    return m;
  }, [threadsAll, alertById]);
  const tStatus = (id: string) => threadStatus(threads.get(id) || []);

  const inPeriod = useMemo(() => alerts.filter(a => a.at >= since), [alerts, since]);
  const stats = useMemo(() => {
    const checked = inPeriod.filter(a => a.status === 'match' || a.status === 'mismatch');
    const st = [...threads.values()].map(threadStatus);
    return {
      uploads: inPeriod.length,
      mismatch: inPeriod.filter(a => a.status === 'mismatch').length,
      waitingUser: st.filter(s => s === 'waiting_user').length,
      waitingAdmin: st.filter(s => s === 'waiting_admin').length,
      closed: st.filter(s => s === 'closed').length,
      rate: checked.length ? Math.round((checked.filter(a => a.status === 'match').length / checked.length) * 100) : null,
    };
  }, [inPeriod, threads]);

  // ───── التنبيهات ─────
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inPeriod.filter(a => {
      const ts = threadStatus(threads.get(a.id) || []);
      return (group === 'all' || groupOf(a.section) === group)
        && (status === 'all' || a.status === status)
        && (!onlyOpen || (a.status === 'mismatch' && !a.read && ts === 'none') || ts === 'waiting_user' || ts === 'waiting_admin')
        && (!term || a.fileName.toLowerCase().includes(term) || a.date.includes(term) || a.by.toLowerCase().includes(term));
    });
  }, [inPeriod, group, status, onlyOpen, q, threads]);
  const current = selected ? alertById.get(selected) ?? null : null;

  const alertEvents = (a: ReportAlert): TimelineEvent[] => [
    { id: `${a.id}-up`, at: a.at, tone: 'blue', title: t('alerts:ev.upload', { file: a.fileName }), meta: `${a.by || '—'} · ${t(`alerts:source.${a.source}`)} · ${fmtDayLabel(a.at)} ${fmtTime(a.at)}` },
    { id: `${a.id}-ck`, at: a.at + 1, tone: a.status === 'match' ? 'green' : a.status === 'mismatch' ? 'red' : 'amber', title: t(`alerts:ev.check.${a.status}`), meta: a.status === 'mismatch' ? t('alerts:ev.diff', { diff: signed(a.diff) }) : t('alerts:ev.auto') },
    ...(threads.get(a.id) || []).map(m => ({
      id: m.id, at: m.at, tone: (m.kind === 'reply' ? 'green' : m.kind === 'close' ? 'slate' : 'amber') as TimelineEvent['tone'],
      title: t(`alerts:ev.${m.kind}`, { to: m.to || '' }), meta: `${m.by || '—'} · ${fmtRelative(m.at)}`, body: m.text || undefined,
    })),
  ];

  const openSection = (s: CheckSection) => {
    const p = SECTION_PAGE[s];
    setSessionValue(p.key, p.subtab);
    setActiveTab(p.tab);
  };
  const send = (a: ReportAlert, kind: ThreadMessage['kind']) => {
    if ((kind === 'request' || kind === 'reply') && !draft.trim()) return;
    const to = kind === 'request' ? a.byUser : kind === 'reopen' ? threadAssignee(threads.get(a.id) || []) || a.byUser : undefined;
    postThread(a.id, kind, draft, to);
    // طلب التصحيح يعني أن المدير راجع التنبيه
    if (kind === 'request' && !a.read) markAlertsReviewed([a.id]);
    setDraft('');
  };

  // ───── المستخدمون ─────
  const users = useMemo(() => {
    const m = new Map<string, { user: string; name: string; uploads: number; mismatch: number; edits: number; deletes: number; creates: number; open: number; last: number }>();
    const get = (user: string, name: string) => {
      const key = user || name || '—';
      if (!m.has(key)) m.set(key, { user: key, name: name || user || '—', uploads: 0, mismatch: 0, edits: 0, deletes: 0, creates: 0, open: 0, last: 0 });
      const u = m.get(key)!;
      if (name && u.name === key) u.name = name;
      return u;
    };
    for (const a of inPeriod) { const u = get(a.byUser, a.by); u.uploads++; if (a.status === 'mismatch') u.mismatch++; u.last = Math.max(u.last, a.at); }
    for (const x of activity) {
      if (x.at < since) continue;
      const u = get(x.byUser, x.by);
      if (x.action === 'edit') u.edits++; else if (x.action === 'delete') u.deletes++; else u.creates++;
      u.last = Math.max(u.last, x.at);
    }
    for (const msgs of threads.values()) {
      if (threadStatus(msgs) !== 'waiting_user') continue;
      const to = threadAssignee(msgs);
      if (to) get(to, '').open++;
    }
    return [...m.values()].sort((a, b) => b.last - a.last);
  }, [inPeriod, activity, threads, since]);
  const userEvents = (user: string): TimelineEvent[] => {
    const ev: TimelineEvent[] = [];
    for (const a of inPeriod) {
      if ((a.byUser || a.by) !== user) continue;
      ev.push({ id: a.id, at: a.at, tone: a.status === 'match' ? 'green' : a.status === 'mismatch' ? 'red' : 'amber', title: t('alerts:ev.userUpload', { section: t(`alerts:section.${a.section}`), date: a.date }), meta: `${t(`alerts:status.${a.status}`)}${a.status === 'mismatch' ? ` (${signed(a.diff)})` : ''} · ${fmtDayLabel(a.at)} ${fmtTime(a.at)}` });
    }
    for (const x of activity) {
      if (x.at < since || (x.byUser || x.by) !== user) continue;
      ev.push({ id: x.id, at: x.at, tone: x.action === 'delete' ? 'amber' : x.action === 'edit' ? 'blue' : 'slate', title: t(`alerts:ev.${x.action}`, { section: t(`alerts:section.${x.section}`), date: x.date }), meta: `${fmtDayLabel(x.at)} ${fmtTime(x.at)}`, changes: x.changes });
    }
    for (const msgs of threads.values()) for (const m of msgs) {
      if (m.at < since || (m.byUser || m.by) !== user) continue;
      const a = alertById.get(m.alertId);
      ev.push({ id: m.id, at: m.at, tone: m.kind === 'reply' ? 'green' : 'amber', title: t(`alerts:ev.user_${m.kind}`, { section: a ? t(`alerts:section.${a.section}`) : '', date: a?.date || '' }), meta: `${fmtDayLabel(m.at)} ${fmtTime(m.at)}`, body: m.text || undefined });
    }
    return ev.sort((a, b) => b.at - a.at).slice(0, 80);
  };
  const currentUser = selectedUser ? users.find(u => u.user === selectedUser) ?? null : null;

  // ───── طلبات التصحيح ─────
  const corrections = useMemo(() => [...threads.entries()]
    .map(([id, msgs]) => ({ alert: alertById.get(id)!, msgs, status: threadStatus(msgs), last: msgs[msgs.length - 1] }))
    .filter(c => c.alert && c.last)
    .sort((a, b) => b.last.at - a.last.at), [threads, alertById]);

  const exportCsv = () => {
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const head = ['date', 'section', 'report', 'status', 'file', 'system', 'diff', 'correction', 'fileName', 'by', 'source'].map(k => esc(t(`alerts:csv.${k}`))).join(',');
    const rows = inPeriod.map(a => [new Date(a.at).toLocaleString(), t(`alerts:section.${a.section}`), a.date, t(`alerts:status.${a.status}`), a.file ?? '', a.system ?? '', a.diff, t(`alerts:thread.${tStatus(a.id)}`), a.fileName, a.by, t(`alerts:source.${a.source}`)].map(esc).join(','));
    const blob = new Blob(['﻿' + [head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${t('alerts:csv.fileNameExport')}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const chip = (cls: string, Icon: React.ComponentType<{ className?: string }>, label: string) => (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}><Icon className="w-3 h-3" />{label}</span>
  );
  const statusChip = (a: ReportAlert) => {
    const ts = tStatus(a.id);
    if (ts !== 'none') return chip(THREAD_STYLE[ts].badge, THREAD_STYLE[ts].icon, t(`alerts:thread.${ts}`));
    const s = CHECK_STYLE[a.status];
    return chip(s.badge, s.icon, `${t(`alerts:status.${a.status}`)}${a.status === 'mismatch' && a.read ? ` · ${t('alerts:reviewed')}` : ''}`);
  };
  const barOf = (a: ReportAlert) => { const ts = tStatus(a.id); return ts !== 'none' ? THREAD_STYLE[ts].bar : CHECK_STYLE[a.status].bar; };

  // ───── تفاصيل تنبيه ─────
  const detail = (a: ReportAlert) => {
    const msgs = threads.get(a.id) || [];
    const ts = threadStatus(msgs);
    const assignee = threadAssignee(msgs);
    const canFix = canEdit(CHECK_SECTION_PERM[a.section]);
    const isAssignee = !!assignee && assignee === me;
    const sec = SECTION_STYLE[a.section];
    const SecIcon = sec.icon;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${sec.chip}`}><SecIcon className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="font-black text-slate-900 dark:text-white">{t(`alerts:section.${a.section}`)} · {t('alerts:reportOf', { date: a.date })}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 min-w-0"><FileText className="w-3.5 h-3.5 shrink-0" /><span className="truncate" dir="auto">{a.fileName}</span></div>
          </div>
          {statusChip(a)}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-3 py-2.5 min-w-0">
            <div className="text-[10.5px] font-bold text-slate-500 truncate">{t('alerts:fileCarried')}</div>
            <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white truncate">{n(a.file)}</div>
          </div>
          <span className={a.status === 'match' ? 'text-emerald-600' : 'text-rose-600'}>{a.status === 'match' ? <Link2 className="w-5 h-5" /> : <ArrowLeftRight className="w-5 h-5" />}</span>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-3 py-2.5 min-w-0">
            <div className="text-[10.5px] font-bold text-slate-500 truncate">{t('alerts:systemCurrent', { date: a.prevDate || '—' })}</div>
            <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white truncate">{n(a.system)}</div>
          </div>
        </div>
        {a.status === 'mismatch' && (
          <div className="flex items-center justify-between rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs">
            <span className="font-bold text-rose-700 dark:text-rose-300">{t('alerts:diff')}</span>
            <span className="font-mono tabular-nums font-black text-rose-700 dark:text-rose-300" dir="ltr">{signed(a.diff)}</span>
          </div>
        )}
        {a.parts && a.parts.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500"><tr>
                <th className="text-start px-3 py-1.5 font-bold">{t('alerts:site')}</th><th className="text-start px-3 py-1.5 font-bold">{t('alerts:fileCarried')}</th><th className="text-start px-3 py-1.5 font-bold">{t('alerts:prevCurrent')}</th><th className="text-start px-3 py-1.5 font-bold">{t('alerts:diff')}</th>
              </tr></thead>
              <tbody>
                {a.parts.map(p => (
                  <tr key={p.key} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-1.5 font-bold text-slate-800 dark:text-slate-100">{enumText(blackOilSiteName(p.key))}</td>
                    <td className="px-3 py-1.5 font-mono tabular-nums">{n(p.file)}</td>
                    <td className="px-3 py-1.5 font-mono tabular-nums">{n(p.system)}</td>
                    <td className={`px-3 py-1.5 font-mono tabular-nums font-black ${Math.abs(p.diff) >= 1 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">{signed(p.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <div className="text-[11px] font-black text-slate-500 mb-2">{t('alerts:timeline')}</div>
          <Timeline events={alertEvents(a)} />
        </div>

        {/* الإجراءات حسب حالة الطلب ودور الحساب */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/30">
          {ts === 'none' && a.status !== 'match' && (isAdmin ? (
            <>
              <div className="text-xs font-black text-slate-700 dark:text-slate-200">{t('alerts:act.requestTitle', { name: a.by || a.byUser })}</div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder={t('alerts:act.requestPh', { date: a.prevDate || '—', value: n(a.system) })} className={textareaCls} />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!draft.trim()} onClick={() => send(a, 'request')} className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"><Send className="w-4 h-4" />{t('alerts:act.request')}</button>
                {a.status === 'mismatch' && !a.read && <button type="button" onClick={() => markAlertsReviewed([a.id])} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"><CheckCheck className="w-4 h-4" />{t('alerts:review')}</button>}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">{a.read ? t('alerts:act.reviewedNoRequest') : t('alerts:act.awaitAdmin')}</div>
          ))}
          {ts === 'none' && a.status === 'match' && <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />{t('alerts:act.matchNoAction')}</div>}

          {ts === 'waiting_user' && ((isAssignee || canFix) ? (
            <>
              <div className="text-xs font-black text-slate-700 dark:text-slate-200">{t('alerts:act.replyTitle')}</div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder={t('alerts:act.replyPh')} className={textareaCls} />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!draft.trim()} onClick={() => send(a, 'reply')} className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"><CircleCheck className="w-4 h-4" />{t('alerts:act.complete')}</button>
                {canFix && <button type="button" onClick={() => openSection(a.section)} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"><ExternalLink className="w-4 h-4" />{t('alerts:act.openSection')}</button>}
              </div>
            </>
          ) : <div className="text-xs text-slate-500">{t('alerts:act.waitingFor', { name: assignee || '—' })}</div>)}

          {ts === 'waiting_admin' && (isAdmin ? (
            <>
              <div className="text-xs font-black text-slate-700 dark:text-slate-200">{t('alerts:act.closeTitle')}</div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder={t('alerts:act.closePh')} className={textareaCls} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => send(a, 'close')} className="h-9 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"><Lock className="w-4 h-4" />{t('alerts:act.close')}</button>
                <button type="button" onClick={() => send(a, 'reopen')} className="h-9 px-3 rounded-xl border border-amber-300 dark:border-amber-800 text-xs font-bold text-amber-700 dark:text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw className="w-4 h-4" />{t('alerts:act.reopen')}</button>
              </div>
            </>
          ) : <div className="text-xs text-slate-500">{t('alerts:act.waitingAdmin')}</div>)}

          {ts === 'closed' && (
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><CircleCheck className="w-4 h-4" />{t('alerts:act.closed')}</span>
              {isAdmin && <button type="button" onClick={() => send(a, 'reopen')} className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />{t('alerts:act.reopen')}</button>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const kpis: [string, number | string, React.ComponentType<{ className?: string }>, string][] = [
    ['uploads', stats.uploads, Upload, 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800'],
    ['mismatch', stats.mismatch, ShieldAlert, 'text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300'],
    ['waitingUser', stats.waitingUser, Hourglass, 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300'],
    ['waitingAdmin', stats.waitingAdmin, MessageSquare, 'text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300'],
    ['closed', stats.closed, CircleCheck, 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300'],
    ['rate', stats.rate === null ? '—' : `${stats.rate}%`, Percent, 'text-indigo-600 bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300'],
  ];
  const openCorrections = corrections.filter(c => c.status !== 'closed').length;
  const openAlerts = inPeriod.filter(a => a.status === 'mismatch' && !a.read && tStatus(a.id) === 'none').length;
  const pickAlert = (id: string) => { setSelected(id); setDraft(''); };

  return (
    <div className="space-y-4 mx-auto w-full xl:w-[95%]">
      {/* الترويسة */}
      <div className={`${cardCls} p-4 sm:p-5`}>
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0"><BellRing className="w-6 h-6" /></div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{t('alerts:title')}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {(Object.keys(PERIODS) as Period[]).map(p => (
                <button key={p} type="button" onClick={() => setPeriod(p)} className={`px-3 h-8 rounded-lg text-xs font-bold cursor-pointer ${period === p ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>{t(`alerts:period.${p}`)}</button>
              ))}
            </div>
            <button type="button" onClick={exportCsv} disabled={!inPeriod.length} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"><Download className="w-4 h-4" />{t('alerts:export')}</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 mt-4">
          {kpis.map(([k, v, Icon, tone]) => (
            <div key={k} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 flex items-center gap-2.5">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4.5 h-4.5" /></span>
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold text-slate-500 truncate">{t(`alerts:kpi.${k}`)}</div>
                <div className="text-lg font-black font-mono tabular-nums text-slate-900 dark:text-white">{typeof v === 'number' ? fmtNumber(v) : v}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-full sm:w-max overflow-x-auto">
          {([['alerts', ShieldCheck, openAlerts], ['users', Users, 0], ['corrections', MessageSquare, openCorrections]] as const).map(([id, Icon, count]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-lg text-sm font-bold whitespace-nowrap cursor-pointer ${tab === id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
              <Icon className="w-4 h-4" />{t(`alerts:tab.${id}`)}
              {count > 0 && <span className="min-w-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono">{count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ التنبيهات ═══ */}
      {tab === 'alerts' && (
        <>
          <div className={`${cardCls} p-3 space-y-2.5`}>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'sahara-gas', 'etihad-gas', 'petrol', 'black-oil'] as Group[]).map(g => {
                const Icon = GROUP_ICON[g];
                const count = g === 'all' ? inPeriod.length : inPeriod.filter(a => groupOf(a.section) === g).length;
                const on = group === g;
                return (
                  <button key={g} type="button" onClick={() => setGroup(g)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold border cursor-pointer ${on ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                    <Icon className="w-3.5 h-3.5" />{t(`alerts:group.${g}`)}<span className={`min-w-5 px-1 rounded-full text-[10px] font-mono ${on ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
                {(['all', 'mismatch', 'match', 'noFileValue'] as StatusFilter[]).map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s)} className={`px-3 h-7 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${status === s ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>{t(`alerts:status.${s}`)}</button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none px-1">
                <input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} className="w-4 h-4 accent-rose-600" />{t('alerts:onlyOpen')}
              </label>
              <div className="relative md:ms-auto md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('alerts:search')} aria-label={t('alerts:search')} className="w-full h-9 ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          {!list.length ? (
            <Empty icon={Inbox} title={alerts.length ? t('alerts:emptyFiltered') : t('alerts:empty')} hint={t('alerts:emptyHint')} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 items-start">
              <div className={`${cardCls} overflow-hidden ${current ? 'hidden lg:block' : ''}`}>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map(a => {
                    const sec = SECTION_STYLE[a.section];
                    const SecIcon = sec.icon;
                    return (
                      <li key={a.id}>
                        <button type="button" onClick={() => pickAlert(a.id)} className={`relative w-full text-start flex items-center gap-3 px-4 py-3 ps-5 cursor-pointer transition ${selected === a.id ? 'bg-slate-50 dark:bg-slate-800/60' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'}`}>
                          <span className={`absolute start-0 top-2 bottom-2 w-1 rounded-full ${barOf(a)}`} />
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sec.chip}`}><SecIcon className="w-4.5 h-4.5" /></span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-black text-slate-900 dark:text-white truncate">{t(`alerts:section.${a.section}`)} · {a.date}</div>
                            <div className="text-[11px] text-slate-500 truncate">{a.by || '—'} · {t(`alerts:source.${a.source}`)} · {fmtDayLabel(a.at)} {fmtTime(a.at)}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {statusChip(a)}
                            {a.status === 'mismatch' && <span className="font-mono tabular-nums text-[11px] font-black text-rose-600" dir="ltr">{signed(a.diff)}</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className={`${cardCls} p-4 sm:p-5 lg:sticky lg:top-4 ${current ? '' : 'hidden lg:block'}`}>
                {current ? (
                  <>
                    <button type="button" onClick={() => setSelected(null)} className="lg:hidden mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer"><Back className="w-4 h-4" />{t('alerts:backToList')}</button>
                    {detail(current)}
                  </>
                ) : (
                  <div className="py-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2"><ShieldCheck className="w-8 h-8 text-slate-300" />{t('alerts:pickAlert')}</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ نشاط المستخدمين ═══ */}
      {tab === 'users' && (!users.length ? <Empty icon={Users} title={t('alerts:noActivity')} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-start">
          <div className={`${cardCls} overflow-hidden ${currentUser ? 'hidden lg:block' : ''}`}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map(u => {
                const ok = u.uploads - u.mismatch;
                return (
                  <li key={u.user}>
                    <button type="button" onClick={() => setSelectedUser(u.user)} className={`w-full text-start flex items-center gap-3 px-4 py-3 cursor-pointer ${selectedUser === u.user ? 'bg-slate-50 dark:bg-slate-800/60' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'}`}>
                      <Avatar name={u.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="text-[13px] font-black text-slate-900 dark:text-white truncate">{u.name}</span>{u.open > 0 && <span className="text-[10px] font-black px-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{t('alerts:userOpen', { count: u.open })}</span>}</div>
                        <div className="text-[11px] text-slate-500">{u.last ? t('alerts:lastActive', { when: fmtRelative(u.last) }) : '—'}</div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                          {u.uploads > 0 && <><span className="bg-emerald-500" style={{ width: `${(ok / u.uploads) * 100}%` }} /><span className="bg-rose-500" style={{ width: `${(u.mismatch / u.uploads) * 100}%` }} /></>}
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white">{u.uploads}</div>
                        <div className="text-[10.5px] text-slate-500">{t('alerts:userSummary', { mismatch: u.mismatch, edits: u.edits })}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className={`${cardCls} p-4 sm:p-5 lg:sticky lg:top-4 ${currentUser ? '' : 'hidden lg:block'}`}>
            {currentUser ? (
              <>
                <button type="button" onClick={() => setSelectedUser(null)} className="lg:hidden mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer"><Back className="w-4 h-4" />{t('alerts:backToList')}</button>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={currentUser.name} size={44} />
                  <div className="min-w-0"><div className="font-black text-slate-900 dark:text-white">{currentUser.name}</div><div className="text-[11px] text-slate-500" dir="ltr">@{currentUser.user}</div></div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {([
                    ['upl', currentUser.uploads, Upload, 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'],
                    ['ok', currentUser.uploads - currentUser.mismatch, ShieldCheck, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'],
                    ['bad', currentUser.mismatch, ShieldAlert, 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'],
                    ['create', currentUser.creates, PlusCircle, 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'],
                    ['edit', currentUser.edits, PenLine, 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'],
                    ['delete', currentUser.deletes, Trash2, 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
                    ['open', currentUser.open, Hourglass, 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
                  ] as const).map(([k, v, Icon, tone]) => (
                    <span key={k} className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-full ${tone}`}><Icon className="w-3.5 h-3.5" />{t(`alerts:userChip.${k}`, { count: v })}</span>
                  ))}
                </div>
                <div className="text-[11px] font-black text-slate-500 mb-2">{t('alerts:actions')}</div>
                {userEvents(currentUser.user).length ? <Timeline events={userEvents(currentUser.user)} /> : <div className="text-xs text-slate-500">{t('alerts:noUserActions')}</div>}
              </>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2"><Users className="w-8 h-8 text-slate-300" />{t('alerts:pickUser')}</div>
            )}
          </div>
        </div>
      ))}

      {/* ═══ طلبات التصحيح ═══ */}
      {tab === 'corrections' && (!corrections.length ? <Empty icon={MessageSquare} title={t('alerts:noCorrections')} hint={t('alerts:noCorrectionsHint')} /> : (
        <div className="space-y-4">
          {(['waiting_user', 'waiting_admin', 'closed'] as const).map(s => {
            const items = corrections.filter(c => c.status === s);
            if (!items.length) return null;
            const st = THREAD_STYLE[s];
            const Icon = st.icon;
            return (
              <section key={s} className="space-y-2">
                <h3 className="text-xs font-black text-slate-500 px-1 flex items-center gap-2"><Icon className="w-4 h-4" />{t(`alerts:thread.${s}`)}<span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" /><span className="font-mono">{items.length}</span></h3>
                <ul className={`${cardCls} overflow-hidden divide-y divide-slate-100 dark:divide-slate-800`}>
                  {items.map(c => {
                    const assignee = threadAssignee(c.msgs);
                    return (
                      <li key={c.alert.id}>
                        <button type="button" onClick={() => { setTab('alerts'); setPeriod('all'); setGroup('all'); setStatus('all'); setOnlyOpen(false); setQ(''); pickAlert(c.alert.id); }}
                          className="relative w-full text-start flex items-center gap-3 px-4 py-3 ps-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 cursor-pointer">
                          <span className={`absolute start-0 top-2 bottom-2 w-1 rounded-full ${st.bar}`} />
                          <Avatar name={(assignee === c.alert.byUser ? c.alert.by : assignee) || c.alert.by || '—'} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-black text-slate-900 dark:text-white truncate">{t(`alerts:section.${c.alert.section}`)} · {c.alert.date}{c.alert.status === 'mismatch' && <span className="font-mono text-rose-600 ms-2" dir="ltr">{signed(c.alert.diff)}</span>}</div>
                            <div className="text-[11px] text-slate-500 truncate">{t(`alerts:corrLast.${c.last.kind}`, { name: c.last.by || '—' })}{c.last.text ? `: «${c.last.text}»` : ''} · {fmtRelative(c.last.at)}</div>
                          </div>
                          {chip(st.badge, Icon, t(`alerts:thread.${s}`))}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
};
