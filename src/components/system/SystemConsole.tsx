import { fmtDate, fmtList } from '../../i18n/format';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Server, Gauge, Database, DatabaseBackup, FolderOpen, Wrench, HardDrive, Cloud, Clock, Activity, RefreshCw, Loader2,
  FileText, MessageSquare, Trash2, ArrowUpFromLine, Play, CalendarClock, Sparkles, Construction, ChevronDown,
  ShieldCheck, Fingerprint, RotateCcw, Trash,
} from 'lucide-react';
import { SwipeTabs } from '../ui/SwipeTabs';
import { chatApi } from '../chat/chatApi';
import { systemApi, fmtBytes, fmtDuration, fmtNum, type BackupRow, type JobRow, type Overview, type R2File, type TrashItem, type VerifyResult } from './systemApi';
import { BarList, StatusPill, jobLabel, prefixLabel, tableLabel } from './systemUi';
import { DbBrowser } from './DbBrowser';
import { BackupsPanel } from './BackupsPanel';
import { DemoPanel } from './DemoPanel';
import { useDemoMode } from '../../lib/demo';
import { Empty, KpiCard, Skeleton, btnCls, cardCls, fullDate, timeAgo } from '../admin/adminUi';

const TAB_KEY = 'sahara_system_tab';
const readTab = () => { try { return sessionStorage.getItem(TAB_KEY) || 'overview'; } catch { return 'overview'; } };

/** لوحة إدارة النظام: حالة D1 و R2، متصفح الجداول، النسخ الاحتياطية، الملفات، والمهام (لمدير النظام فقط) */
export const SystemConsole: React.FC = () => {
  const { t } = useTranslation(['system', 'common']);
  const [tab, setTabState] = useState(readTab);
  const setTab = (t: string) => { setTabState(t); try { sessionStorage.setItem(TAB_KEY, t); } catch { /* تجاهل */ } };
  const [ov, setOv] = useState<Overview | null>(null);
  const [backups, setBackups] = useState<BackupRow[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setOv(await systemApi.overview()); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  const loadBackups = useCallback(() => systemApi.backups().then(r => setBackups(r.items)).catch(e => setError((e as Error).message)), []);
  useEffect(() => {
    loadOverview();
    loadBackups();
    chatApi.adminUsers().then(r => setNames(Object.fromEntries(r.items.map(u => [u.id, u.name])))).catch(() => {});
  }, [loadOverview, loadBackups]);

  const demo = useDemoMode();
  const healthy = ov && !error;
  return (
    <div className="space-y-4">
      {/* الترويسة */}
      <div className={`${cardCls} p-5 relative overflow-hidden`}>
        <div aria-hidden className="absolute -end-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-emerald-500/15 to-sky-500/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 dark:from-slate-700 dark:to-slate-900 text-white flex items-center justify-center shadow-lg">
            <Server className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">{t('system:title')}</h3>
            <p className="text-xs text-slate-500">{t('system:subtitle')}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {ov?.maintenance ? <StatusPill status="warn" label={t('system:maint.title')} /> : healthy ? <StatusPill status="ok" label={t('system:status.ok')} /> : error ? <StatusPill status="error" label={t('system:status.error')} /> : <StatusPill status="running" label={t('system:status.checking')} />}
            <button onClick={() => { loadOverview(); loadBackups(); }} aria-label={t('system:refresh')} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {ov?.maintenance && (
          <p className="relative mt-3 text-xs font-bold rounded-xl px-3 py-2 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 flex items-center gap-2">
            <Construction className="w-4 h-4" />{t('system:maintenanceOn', { reason: ov.maintenance.reason, since: timeAgo(ov.maintenance.since) })}
          </p>
        )}
      </div>

      {error && <p className="text-sm font-bold text-rose-500 px-1">{error}</p>}

      {demo && <DemoPanel onChanged={() => { loadOverview(); loadBackups(); }} />}

      <SwipeTabs active={tab} onChange={setTab} tabs={[
        { id: 'overview', label: t('system:tabs.overview'), icon: Gauge, content: <OverviewTab ov={ov} /> },
        { id: 'db', label: t('system:tabs.db'), icon: Database, content: ov ? <DbBrowser tables={ov.db.tables} /> : <div className={`${cardCls} p-5`}><Skeleton /></div> },
        { id: 'backups', label: t('system:tabs.backups'), icon: DatabaseBackup, content: <BackupsPanel items={backups} names={names} reload={loadBackups} onChanged={loadOverview} /> },
        { id: 'files', label: t('system:tabs.files'), icon: FolderOpen, content: <FilesTab legacy={ov?.legacyFiles || 0} onChanged={loadOverview} /> },
        { id: 'jobs', label: t('system:tabs.jobs'), icon: Wrench, content: <JobsTab ov={ov} onChanged={() => { loadOverview(); loadBackups(); }} names={names} /> },
      ]} />
    </div>
  );
};

// ───── نظرة عامة ─────
const OverviewTab: React.FC<{ ov: Overview | null }> = ({ ov }) => {
  const { t } = useTranslation(['system', 'common']);
  if (!ov) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>;
  const realTables = ov.db.tables.filter(t => !t.view);
  const rows = realTables.reduce((a, t) => a + t.rows, 0);
  const last = ov.lastBackup;
  const lastAgeH = last ? (Date.now() - last.created_at) / 3600_000 : Infinity;
  const r2Items = [...Object.entries(ov.r2.files.byPrefix), ...Object.entries(ov.r2.backups.byPrefix)]
    .map(([p, u]) => ({ label: prefixLabel(p), sub: t('system:files', { count: u.count, n: fmtNum(u.count) }), value: u.bytes, display: fmtBytes(u.bytes) }))
    .sort((a, b) => b.value - a.value);
  const tableItems = realTables.filter(t => t.rows > 0).sort((a, b) => b.rows - a.rows).slice(0, 10)
    .map(tb => ({ label: tableLabel(tb.name), sub: tb.name, value: tb.rows, display: fmtNum(tb.rows) }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label={t('system:dbD1')} value={fmtBytes(ov.db.sizeBytes)} icon={Database} tone="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" sub={`${t('system:rows', { count: rows, n: fmtNum(rows) })} · ${t('system:latency', { ms: ov.db.latencyMs })}`} />
        <KpiCard label={t('system:r2Files')} value={fmtBytes(ov.r2.files.bytes)} icon={HardDrive} tone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" sub={`${t('system:files', { count: ov.r2.files.count, n: fmtNum(ov.r2.files.count) })} · ${t('system:latency', { ms: ov.r2.latencyMs })}`} />
        <KpiCard label={t('system:backupsArchive')} value={fmtBytes(ov.r2.backups.bytes)} icon={Cloud} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" sub={t('system:separateBucket', { files: t('system:files', { count: ov.r2.backups.count, n: fmtNum(ov.r2.backups.count) }) })} />
        <KpiCard label={t('system:lastBackup')} value={last ? timeAgo(last.created_at) : t('system:none')} icon={Clock}
          tone={lastAgeH < 26 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'}
          sub={t('system:next', { when: fmtDate(ov.nextRun, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className={`${cardCls} p-5`}>
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1">{t('system:biggestTables')}</h4>
          <p className="text-[11px] text-slate-400 mb-4">D1 · {t('system:db.tablesViews', { tables: realTables.length, views: ov.db.tables.length - realTables.length })}</p>
          <BarList items={tableItems} />
        </section>
        <section className={`${cardCls} p-5`}>
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1">{t('system:r2Storage')}</h4>
          <p className="text-[11px] text-slate-400 mb-4">etihad-files · etihad-backups</p>
          <BarList items={r2Items} empty={t('system:files.noneYet')} />
        </section>
      </div>

      <section className={`${cardCls} p-5`}>
        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-slate-400" />{t('system:recentJobs')}</h4>
        {!ov.jobs.length ? <p className="text-sm text-slate-400">{t('system:jobs.none')}</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(ov.jobs as JobRow[]).map(j => (
              <li key={j.id} className="py-2 flex items-center gap-3 text-xs">
                <StatusPill status={j.status === 'ok' ? 'ok' : j.status === 'error' ? 'error' : 'running'} label={j.status === 'ok' ? t('system:job.ok') : j.status === 'error' ? t('system:job.failed') : t('system:job.running')} />
                <b className="text-slate-800 dark:text-slate-100">{jobLabel(j.name)}</b>
                <span className="text-slate-400 ms-auto" title={fullDate(j.started_at)}>{timeAgo(j.started_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

// ───── الملفات ─────
type FilesView = 'sahara/' | 'chat/' | 'trash';
const FilesTab: React.FC<{ legacy: number; onChanged: () => void }> = ({ legacy, onChanged }) => {
  const { t } = useTranslation(['system', 'common']);
  const [prefix, setPrefix] = useState<FilesView>('sahara/');
  const [items, setItems] = useState<R2File[] | null>(null);
  const [trash, setTrash] = useState<TrashItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [orphans, setOrphans] = useState<string[] | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);

  const load = useCallback(async (more?: string) => {
    setBusy('list');
    try {
      if (prefix === 'trash') {
        setTrash((await systemApi.trash()).items);
        setCursor(null);
      } else {
        const r = await systemApi.files(prefix, more);
        setItems(prev => (more && prev ? [...prev, ...r.items] : r.items));
        setCursor(r.cursor);
      }
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(''); }
  }, [prefix]);
  useEffect(() => { setItems(null); setTrash(null); load(); }, [load]);

  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id);
    setMsg('');
    try { setMsg(await fn()); onChanged(); load(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        <div className={`${cardCls} p-4 flex items-center gap-3 ${verify && (verify.corrupt.length || verify.missing.length) ? 'ring-2 ring-rose-400' : ''}`}>
          <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{t('system:verify.title')}</div>
            <div className="text-[11px] text-slate-500">
              {!verify ? t('system:verify.hint')
                : verify.corrupt.length || verify.missing.length ? t('system:verify.problems', { corrupt: verify.corrupt.length, missing: verify.missing.length, checked: verify.checked })
                  : `${t('system:verify.ok', { ok: fmtNum(verify.ok + verify.backfilled), checked: fmtNum(verify.checked) })}${verify.backfilled ? ` ${t('system:verify.backfilled', { count: verify.backfilled })}` : ''}`}
            </div>
          </div>
          <button disabled={!!busy} onClick={() => run('verify', async () => { const r = await systemApi.verifyFiles(); setVerify(r); return r.corrupt.length || r.missing.length ? t('system:verify.issues', { list: fmtList([...r.corrupt, ...r.missing]) }) : t('system:verify.allOk'); })} className={`${btnCls} py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
            {busy === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{t('system:verify.check')}
          </button>
        </div>
        <div className={`${cardCls} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-600 flex items-center justify-center"><ArrowUpFromLine className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{t('system:legacy.title')}</div>
            <div className="text-[11px] text-slate-500">{legacy ? t('system:legacy.pending', { files: t('system:files', { count: legacy, n: fmtNum(legacy) }) }) : t('system:legacy.allInR2')}</div>
          </div>
          <button disabled={!legacy || !!busy} onClick={() => run('mig', async () => { const r = await systemApi.migrateFiles(); return t('system:legacy.moved', { files: t('system:files', { count: r.moved, n: fmtNum(r.moved) }), size: fmtBytes(r.bytes) }); })} className={`${btnCls} py-2 bg-blue-600 text-white`}>
            {busy === 'mig' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{t('system:legacy.move')}
          </button>
        </div>
        <div className={`${cardCls} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{t('system:orphans.title')}</div>
            <div className="text-[11px] text-slate-500">{orphans === null ? t('system:orphans.hint') : orphans.length ? t('system:orphans.canDelete', { files: t('system:files', { count: orphans.length, n: orphans.length }) }) : t('system:orphans.none')}</div>
          </div>
          {orphans?.length ? (
            <button disabled={!!busy} onClick={() => { if (window.confirm(t('system:orphans.confirm', { count: orphans.length }))) run('del', async () => { const r = await systemApi.deleteOrphans(); setOrphans([]); return t('system:orphans.deleted', { count: r.deleted }); }); }} className={`${btnCls} py-2 bg-rose-600 text-white`}>
              {busy === 'del' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}{t('common:actions.delete')}
            </button>
          ) : (
            <button disabled={!!busy} onClick={() => run('scan', async () => { const r = await systemApi.orphans(); setOrphans(r.items); return r.items.length ? t('system:orphans.found', { count: r.items.length }) : t('system:orphans.none'); })} className={`${btnCls} py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
              {busy === 'scan' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{t('system:verify.check')}
            </button>
          )}
        </div>
      </div>
      {msg && <p role="status" className="text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">{msg}</p>}

      <div className={`${cardCls} overflow-hidden`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {([['sahara/', t('system:prefix.sahara'), FileText], ['chat/', t('system:prefix.chat'), MessageSquare], ['trash', t('system:trash.title'), Trash]] as const).map(([p, l, Icon]) => (
              <button key={p} onClick={() => setPrefix(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${prefix === p ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}>
                <Icon className="w-3.5 h-3.5" />{l}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400 ms-auto font-mono hidden sm:inline" dir="ltr">etihad-files/{prefix === 'trash' ? 'trash/' : prefix}</span>
        </div>
        <div className="p-4">
          {prefix === 'trash' ? (
            <TrashList items={trash} busy={busy}
              onRestore={it => run('r' + it.key, async () => { const r = await systemApi.restoreTrash(it.key); return t('system:trash.restored', { name: r.name }); })}
              onPurge={it => { if (window.confirm(t('system:trash.purgeConfirm', { name: it.name }))) run('p' + it.key, async () => { await systemApi.purgeTrash(it.key); return t('system:trash.purged'); }); }} />
          ) : !items ? <Skeleton rows={3} /> : !items.length ? <Empty icon={FolderOpen} title={t('system:files.none')} /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map(f => (
                <li key={f.key} className="py-2.5 flex items-center gap-3 text-xs">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{f.name ?? <span className="text-amber-600">{t('system:files.noRecord')}</span>}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-2" dir="ltr">
                      <span className="truncate">{f.key} · {f.type || '—'}</span>
                      {f.sha256 ? <span className="inline-flex items-center gap-0.5 shrink-0" title={`SHA-256: ${f.sha256}`}><Fingerprint className="w-3 h-3" />{f.sha256.slice(0, 8)}</span>
                        : <span className="shrink-0 text-amber-500">{t('system:files.noHash')}</span>}
                    </div>
                  </div>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300 shrink-0">{fmtBytes(f.size)}</span>
                  <span className="text-slate-400 shrink-0 hidden sm:inline" title={fullDate(new Date(f.uploaded).getTime())}>{timeAgo(new Date(f.uploaded).getTime())}</span>
                </li>
              ))}
            </ul>
          )}
          {cursor && (
            <button disabled={busy === 'list'} onClick={() => load(cursor)} className={`${btnCls} w-full mt-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
              {busy === 'list' && <Loader2 className="w-4 h-4 animate-spin" />}{t('system:files.more')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** سلة المحذوفات: تُحذف نهائيًا تلقائيًا بعد 30 يومًا */
const TrashList: React.FC<{ items: TrashItem[] | null; busy: string; onRestore: (t: TrashItem) => void; onPurge: (t: TrashItem) => void }> = ({ items, busy, onRestore, onPurge }) => {
  const { t } = useTranslation(['system', 'common']);
  if (!items) return <Skeleton rows={3} />;
  if (!items.length) return <Empty icon={Trash} title={t('system:trash.empty')} hint={t('system:trash.hint')} />;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map(it => {
        const left = Math.max(0, 30 - Math.floor((Date.now() - it.deletedAt) / 86400_000));
        return (
          <li key={it.key} className="py-2.5 flex items-center gap-3 text-xs">
            {it.scope === 'chat' ? <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" /> : <FileText className="w-4 h-4 text-slate-400 shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{it.name}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {t(it.scope === 'chat' ? 'system:trash.chatFile' : 'system:trash.saharaFile')} · {fmtBytes(it.size)} · {t('system:trash.deletedAgo', { ago: timeAgo(it.deletedAt) })} · {t('system:trash.purgeIn', { count: left })}
              </div>
            </div>
            {it.scope === 'sahara' && (
              <button disabled={!!busy} onClick={() => onRestore(it)} className="h-8 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold inline-flex items-center gap-1">
                {busy === 'r' + it.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}{t('system:restore.action')}
              </button>
            )}
            <button disabled={!!busy} onClick={() => onPurge(it)} aria-label={t('system:trash.purge')} title={t('system:trash.purge')} className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 inline-flex items-center justify-center">
              {busy === 'p' + it.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

// ───── الصيانة والمهام ─────
const prevMonth = () => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};

const JobsTab: React.FC<{ ov: Overview | null; onChanged: () => void; names: Record<string, string> }> = ({ ov, onChanged, names }) => {
  const { t } = useTranslation(['system', 'common']);
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [month, setMonth] = useState(prevMonth);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => systemApi.jobs().then(r => setJobs(r.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(''); load(); onChanged(); }
  };

  const maint = ov?.maintenance;
  const cards = useMemo(() => [
    { id: 'daily', icon: DatabaseBackup, tone: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', title: t('system:jobs.daily'), desc: t('system:jobs.dailyDesc', { next: ov ? fmtDate(ov.nextRun, { dateStyle: 'medium', timeStyle: 'short' }) : '...' }), action: t('system:jobs.runNow'), fn: () => systemApi.runJob('daily'), ok: t('system:jobs.dailyDone') },
    { id: 'cleanup', icon: Sparkles, tone: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', title: t('system:jobs.cleanup'), desc: t('system:jobs.cleanupDesc'), action: t('system:jobs.cleanNow'), fn: () => systemApi.runJob('cleanup'), ok: t('system:jobs.cleaned') },
  ], [ov]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.id} className={`${cardCls} p-4 flex items-start gap-3`}>
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.tone}`}><Icon className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white">{c.title}</div>
                <div className="text-[11px] text-slate-500 leading-relaxed">{c.desc}</div>
              </div>
              <button disabled={!!busy} onClick={() => run(c.id, c.fn, c.ok)} className={`${btnCls} py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0`}>
                {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}{c.action}
              </button>
            </div>
          );
        })}
        <div className={`${cardCls} p-4 flex items-start gap-3`}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><CalendarClock className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{t('system:jobs.monthly')}</div>
            <div className="text-[11px] text-slate-500 leading-relaxed">{t('system:jobs.monthlyDesc')}</div>
            <div className="mt-2 flex items-center gap-2">
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
          <button disabled={!!busy} onClick={() => { if (window.confirm(t('system:jobs.monthlyConfirm', { month }))) run('monthly', () => systemApi.runJob('monthly', month), t('system:jobs.monthlyDone', { month })); }} className={`${btnCls} py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0`}>
            {busy === 'monthly' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}{t('system:jobs.run')}
          </button>
        </div>
        <div className={`${cardCls} p-4 flex items-start gap-3 ${maint ? 'ring-2 ring-amber-400' : ''}`}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"><Construction className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{t('system:maint.title')}</div>
            <div className="text-[11px] text-slate-500 leading-relaxed">{t('system:maint.hint')}</div>
          </div>
          <button disabled={!!busy} onClick={() => run('mode', () => systemApi.setMaintenance(!maint, 'صيانة يدوية من لوحة الإدارة'), maint ? t('system:maint.off') : t('system:maint.on'))}
            className={`${btnCls} py-2 shrink-0 ${maint ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
            {busy === 'mode' && <Loader2 className="w-4 h-4 animate-spin" />}{maint ? t('common:actions.cancel') : t('system:maint.enable')}
          </button>
        </div>
      </div>
      {msg && <p role="status" className={`text-sm font-bold rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>{msg.text}</p>}

      <section className={`${cardCls} overflow-hidden`}>
        <h4 className="px-5 pt-5 pb-3 font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2"><Activity className="w-4 h-4 text-slate-400" />{t('system:jobLog')}</h4>
        {!jobs ? <div className="p-5"><Skeleton rows={3} /></div> : !jobs.length ? <Empty icon={Activity} title={t('system:jobs.none')} /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {jobs.map(j => (
              <li key={j.id}>
                <button onClick={() => setOpen(open === j.id ? null : j.id)} aria-expanded={open === j.id} className="w-full text-start px-5 py-3 flex items-center gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <StatusPill status={j.status === 'ok' ? 'ok' : j.status === 'error' ? 'error' : 'running'} label={j.status === 'ok' ? t('system:job.ok') : j.status === 'error' ? t('system:job.failed') : t('system:job.running')} />
                  <b className="text-slate-800 dark:text-slate-100">{jobLabel(j.name)}</b>
                  <span className="text-slate-400">{j.triggered_by === 'scheduler' ? t('system:auto') : names[j.triggered_by] || j.triggered_by}</span>
                  <span className="ms-auto text-slate-400 tabular-nums">{j.finished_at ? fmtDuration(j.finished_at - j.started_at) : '…'}</span>
                  <span className="text-slate-400 hidden sm:inline" title={fullDate(j.started_at)}>{timeAgo(j.started_at)}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open === j.id ? 'rotate-180' : ''}`} />
                </button>
                {open === j.id && (
                  <pre dir="ltr" className="mx-5 mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] font-mono whitespace-pre-wrap break-all text-slate-600 dark:text-slate-300">
                    {(() => { try { return JSON.stringify(JSON.parse(j.details), null, 2); } catch { return j.details || '—'; } })()}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
