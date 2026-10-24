import React, { useMemo, useState } from 'react';
import {
  BellRing, ShieldCheck, ShieldAlert, ShieldQuestion, Flame, Building2, Fuel, Droplets, Search, FileText, User, Clock,
  Layers, CheckCheck, Link2, ArrowLeftRight, ChevronDown, Inbox, Percent,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { usePermissions } from '../../lib/usePermission';
import { CHECK_SECTION_PERM, REPORT_ALERTS_KEY, markAlertsReviewed, type CheckSection, type CheckStatus, type ReportAlert } from '../../lib/reportCheck';
import { siteName as blackOilSiteName } from '../../lib/blackOilLedger';
import { fmtDayLabel, fmtNumber, fmtTime } from '../../i18n/format';
import { enumText } from '../../i18n/enums';

/** مجموعات الفلتر: النفط الأسود يجمع الشركتين */
type Group = 'all' | 'sahara-gas' | 'etihad-gas' | 'petrol' | 'black-oil';
const GROUPS: { id: Group; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', icon: Layers },
  { id: 'sahara-gas', icon: Flame },
  { id: 'etihad-gas', icon: Building2 },
  { id: 'petrol', icon: Fuel },
  { id: 'black-oil', icon: Droplets },
];
const groupOf = (s: CheckSection): Group => (s.startsWith('black-oil') ? 'black-oil' : (s as Group));
const SECTION_STYLE: Record<CheckSection, { icon: React.ComponentType<{ className?: string }>; chip: string }> = {
  'sahara-gas': { icon: Flame, chip: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  'etihad-gas': { icon: Building2, chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  petrol: { icon: Fuel, chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  'black-oil-sahara': { icon: Droplets, chip: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
  'black-oil-etihad': { icon: Droplets, chip: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
};
const STATUS_STYLE: Record<CheckStatus, { icon: React.ComponentType<{ className?: string }>; bar: string; text: string; badge: string }> = {
  mismatch: { icon: ShieldAlert, bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  match: { icon: ShieldCheck, bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  noFileValue: { icon: ShieldQuestion, bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  noPrevDay: { icon: ShieldQuestion, bar: 'bg-slate-300', text: 'text-slate-600 dark:text-slate-300', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
type StatusFilter = 'all' | 'mismatch' | 'match' | 'noFileValue';

const cardCls = 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';

/**
 * سجل التنبيهات: نتائج التحقق من صحة التقارير اليومية للأقسام الأربعة (كاز الصحاري، كاز الاتحاد، البنزين، النفط الأسود):
 * "المدور السابق" في كل كشف محفوظ مقابل "الرصيد الحالي" لليوم الذي قبله في المنظومة.
 */
export const ReportAlertsView: React.FC = () => {
  const { t } = useTranslation(['alerts', 'common']);
  const [alerts] = useSyncedStorage<ReportAlert[]>(REPORT_ALERTS_KEY, []);
  const { canView } = usePermissions();
  const [group, setGroup] = useState<Group>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  // الأقسام التي يراها الحساب فقط
  const mine = useMemo(() => alerts.filter(a => canView(CHECK_SECTION_PERM[a.section])).sort((a, b) => b.at - a.at), [alerts, canView]);
  const groups = GROUPS.filter(g => g.id === 'all' || mine.some(a => groupOf(a.section) === g.id) || (Object.keys(CHECK_SECTION_PERM) as CheckSection[]).some(s => groupOf(s) === g.id && canView(CHECK_SECTION_PERM[s])));

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return mine.filter(a => (group === 'all' || groupOf(a.section) === group)
      && (status === 'all' || a.status === status)
      && (!onlyOpen || (a.status === 'mismatch' && !a.read))
      && (!term || a.fileName.toLowerCase().includes(term) || a.date.includes(term) || a.by.toLowerCase().includes(term)));
  }, [mine, group, status, onlyOpen, q]);

  const stats = useMemo(() => {
    const checked = mine.filter(a => a.status === 'match' || a.status === 'mismatch');
    const mismatch = mine.filter(a => a.status === 'mismatch');
    return {
      total: mine.length,
      mismatch: mismatch.length,
      open: mismatch.filter(a => !a.read).length,
      rate: checked.length ? Math.round((checked.filter(a => a.status === 'match').length / checked.length) * 100) : null,
    };
  }, [mine]);

  // تجميع حسب يوم التحقق
  const days = useMemo(() => {
    const out: { label: string; items: ReportAlert[] }[] = [];
    for (const a of list) {
      const label = fmtDayLabel(a.at);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(a); else out.push({ label, items: [a] });
    }
    return out;
  }, [list]);

  const openIds = list.filter(a => a.status === 'mismatch' && !a.read).map(a => a.id);
  const n = (v: number | null) => (v === null ? '—' : fmtNumber(Math.round(v)));

  return (
    <div className="space-y-5 mx-auto w-full xl:w-[95%]">
      {/* الترويسة */}
      <div className={`${cardCls} p-5 sm:p-6 relative overflow-hidden`}>
        <div aria-hidden className="absolute -end-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-rose-500 to-amber-400 opacity-[0.07]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{t('alerts:title')}</h2>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl leading-relaxed">{t('alerts:subtitle')}</p>
            </div>
          </div>
          {openIds.length > 0 && (
            <button type="button" onClick={() => markAlertsReviewed(openIds)}
              className="self-start lg:self-auto inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 active:scale-[0.98] transition cursor-pointer">
              <CheckCheck className="w-4 h-4" />{t('alerts:reviewAll', { count: openIds.length })}
            </button>
          )}
        </div>

        {/* المؤشرات */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {([
            ['total', stats.total, Layers, 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800'],
            ['mismatch', stats.mismatch, ShieldAlert, 'text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300'],
            ['open', stats.open, BellRing, 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300'],
            ['rate', stats.rate === null ? '—' : `${stats.rate}%`, Percent, 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300'],
          ] as const).map(([k, v, Icon, tone]) => (
            <div key={k} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-500 truncate">{t(`alerts:kpi.${k}`)}</div>
                <div className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-white">{typeof v === 'number' ? fmtNumber(v) : v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الفلاتر */}
      <div className={`${cardCls} p-3 sm:p-4 space-y-3`}>
        <div className="flex flex-wrap gap-1.5">
          {groups.map(g => {
            const on = group === g.id;
            const count = g.id === 'all' ? mine.length : mine.filter(a => groupOf(a.section) === g.id).length;
            return (
              <button key={g.id} type="button" onClick={() => setGroup(g.id)}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${on ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <g.icon className="w-3.5 h-3.5" />{t(`alerts:group.${g.id}`)}
                <span className={`min-w-5 px-1 rounded-full text-[10px] font-mono ${on ? 'bg-white/20 dark:bg-slate-900/15' : 'bg-slate-100 dark:bg-slate-800'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
            {(['all', 'mismatch', 'match', 'noFileValue'] as StatusFilter[]).map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={`px-3 h-8 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${status === s ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
                {t(`alerts:status.${s}`)}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none px-1">
            <input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} className="w-4 h-4 accent-rose-600" />
            {t('alerts:onlyOpen')}
          </label>
          <div className="relative md:ms-auto md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('alerts:search')} aria-label={t('alerts:search')}
              className="w-full h-9 ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* القائمة */}
      {!days.length ? (
        <div className={`${cardCls} py-14 flex flex-col items-center text-center gap-2`}>
          <span className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Inbox className="w-7 h-7 text-slate-400" /></span>
          <div className="font-black text-slate-800 dark:text-slate-100">{mine.length ? t('alerts:emptyFiltered') : t('alerts:empty')}</div>
          <p className="text-xs text-slate-500 max-w-sm">{t('alerts:emptyHint')}</p>
        </div>
      ) : days.map(d => (
        <section key={d.label} className="space-y-2">
          <h3 className="text-xs font-black text-slate-500 px-1 flex items-center gap-2">
            <span>{d.label}</span><span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" /><span className="font-mono">{d.items.length}</span>
          </h3>
          <ul className="space-y-2">
            {d.items.map(a => {
              const st = STATUS_STYLE[a.status];
              const sec = SECTION_STYLE[a.section];
              const StIcon = st.icon;
              const SecIcon = sec.icon;
              const expanded = open === a.id;
              const needsReview = a.status === 'mismatch' && !a.read;
              return (
                <li key={a.id} className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 ${needsReview ? 'border-rose-200 dark:border-rose-900/60' : 'border-slate-200 dark:border-slate-800'}`}>
                  <span className={`absolute start-0 top-0 bottom-0 w-1 ${st.bar}`} />
                  <div className="p-3.5 ps-5 flex flex-col lg:flex-row lg:items-center gap-3">
                    {/* القسم والحالة */}
                    <div className="flex items-start gap-3 lg:w-72 shrink-0">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sec.chip}`}><SecIcon className="w-5 h-5" /></span>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900 dark:text-white">{t(`alerts:section.${a.section}`)}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{t('alerts:reportOf', { date: a.date })}</div>
                        <span className={`mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-black px-2 py-0.5 rounded-full ${st.badge}`}>
                          <StIcon className="w-3 h-3" />{t(`alerts:status.${a.status}`)}
                        </span>
                      </div>
                    </div>

                    {/* المقارنة */}
                    <div className="flex-1 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 min-w-0">
                        <div className="text-[10.5px] font-bold text-slate-500 truncate">{t('alerts:fileCarried')}</div>
                        <div className="font-black font-mono tabular-nums text-slate-900 dark:text-white truncate">{n(a.file)}</div>
                      </div>
                      <span className={st.text}>{a.status === 'match' ? <Link2 className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}</span>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 min-w-0">
                        <div className="text-[10.5px] font-bold text-slate-500 truncate">{t('alerts:systemCurrent', { date: a.prevDate || '—' })}</div>
                        <div className="font-black font-mono tabular-nums text-slate-900 dark:text-white truncate">{n(a.system)}</div>
                      </div>
                      <span className={`min-w-[5.5rem] text-center font-mono tabular-nums font-black text-xs px-2 py-1.5 rounded-xl ${a.status === 'mismatch' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`} dir="ltr">
                        {a.status === 'mismatch' ? `${a.diff > 0 ? '+' : ''}${fmtNumber(a.diff)}` : a.status === 'match' ? '0' : '—'}
                      </span>
                    </div>

                    {/* التفاصيل والمراجعة */}
                    <div className="flex items-center gap-2 lg:w-auto shrink-0">
                      {a.parts && a.parts.length > 0 && (
                        <button type="button" onClick={() => setOpen(expanded ? null : a.id)} aria-expanded={expanded} aria-label={t('alerts:sites')}
                          className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer">
                          {t('alerts:sites')}<ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                      {needsReview ? (
                        <button type="button" onClick={() => markAlertsReviewed([a.id])}
                          className="h-9 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                          <CheckCheck className="w-4 h-4" />{t('alerts:review')}
                        </button>
                      ) : a.status === 'mismatch' && (
                        <span className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold inline-flex items-center gap-1.5"><CheckCheck className="w-4 h-4" />{t('alerts:reviewed')}</span>
                      )}
                    </div>
                  </div>

                  {expanded && a.parts && (
                    <div className="mx-3.5 ms-5 mb-3 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                          <tr><th className="text-start px-3 py-1.5 font-bold">{t('alerts:site')}</th><th className="text-start px-3 py-1.5 font-bold">{t('alerts:fileCarried')}</th><th className="text-start px-3 py-1.5 font-bold">{t('alerts:prevCurrent')}</th><th className="text-start px-3 py-1.5 font-bold">{t('alerts:diff')}</th></tr>
                        </thead>
                        <tbody>
                          {a.parts.map(p => (
                            <tr key={p.key} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-1.5 font-bold text-slate-800 dark:text-slate-100">{enumText(blackOilSiteName(p.key))}</td>
                              <td className="px-3 py-1.5 font-mono tabular-nums">{n(p.file)}</td>
                              <td className="px-3 py-1.5 font-mono tabular-nums">{n(p.system)}</td>
                              <td className={`px-3 py-1.5 font-mono tabular-nums font-black ${Math.abs(p.diff) >= 1 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">{p.diff > 0 ? '+' : ''}{fmtNumber(p.diff)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* الملف ومن رفعه */}
                  <div className="px-3.5 ps-5 pb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 min-w-0 max-w-full"><FileText className="w-3.5 h-3.5 shrink-0" /><span className="truncate" dir="auto">{a.fileName}</span></span>
                    {a.by && <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" />{a.by}</span>}
                    <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{fmtTime(a.at)}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">{t(`alerts:source.${a.source}`)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
