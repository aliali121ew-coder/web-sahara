import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Server, Gauge, Database, DatabaseBackup, FolderOpen, Wrench, HardDrive, Cloud, Clock, Activity, RefreshCw, Loader2,
  FileText, MessageSquare, Trash2, ArrowUpFromLine, Play, CalendarClock, Sparkles, Construction, ChevronDown,
  ShieldCheck, Fingerprint, RotateCcw, Trash,
} from 'lucide-react';
import { SwipeTabs } from '../ui/SwipeTabs';
import { chatApi } from '../chat/chatApi';
import { systemApi, fmtBytes, fmtDuration, fmtNum, type BackupRow, type JobRow, type Overview, type R2File, type TrashItem, type VerifyResult } from './systemApi';
import { BarList, JOB_LABELS, PREFIX_LABELS, StatusPill, TABLE_LABELS } from './systemUi';
import { DbBrowser } from './DbBrowser';
import { BackupsPanel } from './BackupsPanel';
import { Empty, KpiCard, Skeleton, btnCls, cardCls, fullDate, timeAgo } from '../admin/adminUi';

const TAB_KEY = 'sahara_system_tab';
const readTab = () => { try { return sessionStorage.getItem(TAB_KEY) || 'overview'; } catch { return 'overview'; } };

/** لوحة إدارة النظام: حالة D1 و R2، متصفح الجداول، النسخ الاحتياطية، الملفات، والمهام (لمدير النظام فقط) */
export const SystemConsole: React.FC = () => {
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

  const healthy = ov && !error;
  return (
    <div className="space-y-4">
      {/* الترويسة */}
      <div className={`${cardCls} p-5 relative overflow-hidden`}>
        <div aria-hidden className="absolute -left-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-emerald-500/15 to-sky-500/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 dark:from-slate-700 dark:to-slate-900 text-white flex items-center justify-center shadow-lg">
            <Server className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">إدارة النظام وقاعدة البيانات</h3>
            <p className="text-xs text-slate-500">D1 للنظام والقراءة السريعة، و R2 للملفات والنسخ الاحتياطية والأرشيف.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {ov?.maintenance ? <StatusPill status="warn" label="وضع الصيانة" /> : healthy ? <StatusPill status="ok" label="النظام يعمل" /> : error ? <StatusPill status="error" label="تعذّر الاتصال" /> : <StatusPill status="running" label="جارٍ الفحص" />}
            <button onClick={() => { loadOverview(); loadBackups(); }} aria-label="تحديث" className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {ov?.maintenance && (
          <p className="relative mt-3 text-xs font-bold rounded-xl px-3 py-2 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 flex items-center gap-2">
            <Construction className="w-4 h-4" />وضع الصيانة مفعّل: {ov.maintenance.reason} · منذ {timeAgo(ov.maintenance.since)}. الكتابة متوقفة على كل المستخدمين.
          </p>
        )}
      </div>

      {error && <p className="text-sm font-bold text-rose-500 px-1">{error}</p>}

      <SwipeTabs active={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'نظرة عامة', icon: Gauge, content: <OverviewTab ov={ov} /> },
        { id: 'db', label: 'قاعدة البيانات', icon: Database, content: ov ? <DbBrowser tables={ov.db.tables} /> : <div className={`${cardCls} p-5`}><Skeleton /></div> },
        { id: 'backups', label: 'النسخ', icon: DatabaseBackup, content: <BackupsPanel items={backups} names={names} reload={loadBackups} onChanged={loadOverview} /> },
        { id: 'files', label: 'الملفات', icon: FolderOpen, content: <FilesTab legacy={ov?.legacyFiles || 0} onChanged={loadOverview} /> },
        { id: 'jobs', label: 'الصيانة', icon: Wrench, content: <JobsTab ov={ov} onChanged={() => { loadOverview(); loadBackups(); }} names={names} /> },
      ]} />
    </div>
  );
};

// ───── نظرة عامة ─────
const OverviewTab: React.FC<{ ov: Overview | null }> = ({ ov }) => {
  if (!ov) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>;
  const realTables = ov.db.tables.filter(t => !t.view);
  const rows = realTables.reduce((a, t) => a + t.rows, 0);
  const last = ov.lastBackup;
  const lastAgeH = last ? (Date.now() - last.created_at) / 3600_000 : Infinity;
  const r2Items = [...Object.entries(ov.r2.files.byPrefix), ...Object.entries(ov.r2.backups.byPrefix)]
    .map(([p, u]) => ({ label: PREFIX_LABELS[p] || p, sub: `${fmtNum(u.count)} ملف`, value: u.bytes, display: fmtBytes(u.bytes) }))
    .sort((a, b) => b.value - a.value);
  const tableItems = realTables.filter(t => t.rows > 0).sort((a, b) => b.rows - a.rows).slice(0, 10)
    .map(t => ({ label: TABLE_LABELS[t.name] || t.name, sub: t.name, value: t.rows, display: fmtNum(t.rows) }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="قاعدة البيانات D1" value={fmtBytes(ov.db.sizeBytes)} icon={Database} tone="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" sub={`${fmtNum(rows)} سطر · استجابة ${ov.db.latencyMs} ms`} />
        <KpiCard label="ملفات R2" value={fmtBytes(ov.r2.files.bytes)} icon={HardDrive} tone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" sub={`${fmtNum(ov.r2.files.count)} ملف · استجابة ${ov.r2.latencyMs} ms`} />
        <KpiCard label="النسخ والأرشيف" value={fmtBytes(ov.r2.backups.bytes)} icon={Cloud} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" sub={`${fmtNum(ov.r2.backups.count)} ملف في حاوية منفصلة`} />
        <KpiCard label="آخر نسخة احتياطية" value={last ? timeAgo(last.created_at) : 'لا يوجد'} icon={Clock}
          tone={lastAgeH < 26 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'}
          sub={`التالية ${new Date(ov.nextRun).toLocaleString('ar-IQ', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className={`${cardCls} p-5`}>
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1">أكبر الجداول (عدد السطور)</h4>
          <p className="text-[11px] text-slate-400 mb-4">D1 · {realTables.length} جدول · {ov.db.tables.length - realTables.length} عرض</p>
          <BarList items={tableItems} />
        </section>
        <section className={`${cardCls} p-5`}>
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1">التخزين في R2 (الحجم)</h4>
          <p className="text-[11px] text-slate-400 mb-4">etihad-files · etihad-backups</p>
          <BarList items={r2Items} empty="لا توجد ملفات بعد" />
        </section>
      </div>

      <section className={`${cardCls} p-5`}>
        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-slate-400" />آخر المهام</h4>
        {!ov.jobs.length ? <p className="text-sm text-slate-400">لم تُشغَّل أي مهمة بعد</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(ov.jobs as JobRow[]).map(j => (
              <li key={j.id} className="py-2 flex items-center gap-3 text-xs">
                <StatusPill status={j.status === 'ok' ? 'ok' : j.status === 'error' ? 'error' : 'running'} label={j.status === 'ok' ? 'نجحت' : j.status === 'error' ? 'فشلت' : 'جارية'} />
                <b className="text-slate-800 dark:text-slate-100">{JOB_LABELS[j.name] || j.name}</b>
                <span className="text-slate-400 mr-auto" title={fullDate(j.started_at)}>{timeAgo(j.started_at)}</span>
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
            <div className="text-sm font-bold text-slate-900 dark:text-white">سلامة الملفات (SHA-256)</div>
            <div className="text-[11px] text-slate-500">
              {!verify ? 'مقارنة بصمة كل ملف في R2 بالمسجّلة في D1'
                : verify.corrupt.length || verify.missing.length ? `${verify.corrupt.length} تالف · ${verify.missing.length} مفقود من ${verify.checked}`
                  : `${fmtNum(verify.ok + verify.backfilled)} من ${fmtNum(verify.checked)} سليم${verify.backfilled ? ` (سُجّلت ${verify.backfilled} بصمة جديدة)` : ''}`}
            </div>
          </div>
          <button disabled={!!busy} onClick={() => run('verify', async () => { const r = await systemApi.verifyFiles(); setVerify(r); return r.corrupt.length || r.missing.length ? `مشاكل: ${[...r.corrupt, ...r.missing].join('، ')}` : 'كل الملفات سليمة'; })} className={`${btnCls} py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
            {busy === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}فحص
          </button>
        </div>
        <div className={`${cardCls} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-600 flex items-center justify-center"><ArrowUpFromLine className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">ملفات قديمة داخل D1</div>
            <div className="text-[11px] text-slate-500">{legacy ? `${fmtNum(legacy)} ملف لم يُنقل بعد إلى R2` : 'كل الملفات في R2'}</div>
          </div>
          <button disabled={!legacy || !!busy} onClick={() => run('mig', async () => { const r = await systemApi.migrateFiles(); return `نُقل ${r.moved} ملف (${fmtBytes(r.bytes)}) إلى R2`; })} className={`${btnCls} py-2 bg-blue-600 text-white`}>
            {busy === 'mig' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}نقل الآن
          </button>
        </div>
        <div className={`${cardCls} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">ملفات يتيمة في R2</div>
            <div className="text-[11px] text-slate-500">{orphans === null ? 'ملفات بلا سجل (أقدم من يوم)' : orphans.length ? `${orphans.length} ملف يمكن حذفه` : 'لا توجد ملفات يتيمة'}</div>
          </div>
          {orphans?.length ? (
            <button disabled={!!busy} onClick={() => { if (window.confirm(`حذف ${orphans.length} ملف يتيم من R2؟`)) run('del', async () => { const r = await systemApi.deleteOrphans(); setOrphans([]); return `حُذف ${r.deleted} ملف يتيم`; }); }} className={`${btnCls} py-2 bg-rose-600 text-white`}>
              {busy === 'del' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}حذف
            </button>
          ) : (
            <button disabled={!!busy} onClick={() => run('scan', async () => { const r = await systemApi.orphans(); setOrphans(r.items); return r.items.length ? `وُجد ${r.items.length} ملف يتيم` : 'لا توجد ملفات يتيمة'; })} className={`${btnCls} py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
              {busy === 'scan' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}فحص
            </button>
          )}
        </div>
      </div>
      {msg && <p role="status" className="text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">{msg}</p>}

      <div className={`${cardCls} overflow-hidden`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {([['sahara/', 'مرفقات الصحاري', FileText], ['chat/', 'مرفقات المحادثة', MessageSquare], ['trash', 'سلة المحذوفات', Trash]] as const).map(([p, l, Icon]) => (
              <button key={p} onClick={() => setPrefix(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${prefix === p ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}>
                <Icon className="w-3.5 h-3.5" />{l}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400 mr-auto font-mono hidden sm:inline" dir="ltr">etihad-files/{prefix === 'trash' ? 'trash/' : prefix}</span>
        </div>
        <div className="p-4">
          {prefix === 'trash' ? (
            <TrashList items={trash} busy={busy}
              onRestore={t => run('r' + t.key, async () => { const r = await systemApi.restoreTrash(t.key); return `استُرجع ${r.name}`; })}
              onPurge={t => { if (window.confirm(`حذف «${t.name}» نهائيًا؟ لا يمكن التراجع.`)) run('p' + t.key, async () => { await systemApi.purgeTrash(t.key); return 'حُذف نهائيًا'; }); }} />
          ) : !items ? <Skeleton rows={3} /> : !items.length ? <Empty icon={FolderOpen} title="لا توجد ملفات" /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map(f => (
                <li key={f.key} className="py-2.5 flex items-center gap-3 text-xs">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{f.name ?? <span className="text-amber-600">بلا سجل في D1</span>}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-2" dir="ltr">
                      <span className="truncate">{f.key} · {f.type || '—'}</span>
                      {f.sha256 ? <span className="inline-flex items-center gap-0.5 shrink-0" title={`SHA-256: ${f.sha256}`}><Fingerprint className="w-3 h-3" />{f.sha256.slice(0, 8)}</span>
                        : <span className="shrink-0 text-amber-500">بلا بصمة</span>}
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
              {busy === 'list' && <Loader2 className="w-4 h-4 animate-spin" />}عرض المزيد
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** سلة المحذوفات: تُحذف نهائيًا تلقائيًا بعد 30 يومًا */
const TrashList: React.FC<{ items: TrashItem[] | null; busy: string; onRestore: (t: TrashItem) => void; onPurge: (t: TrashItem) => void }> = ({ items, busy, onRestore, onPurge }) => {
  if (!items) return <Skeleton rows={3} />;
  if (!items.length) return <Empty icon={Trash} title="السلة فارغة" hint="الملفات المحذوفة تبقى هنا 30 يومًا ويمكن استرجاعها" />;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map(t => {
        const left = Math.max(0, 30 - Math.floor((Date.now() - t.deletedAt) / 86400_000));
        return (
          <li key={t.key} className="py-2.5 flex items-center gap-3 text-xs">
            {t.scope === 'chat' ? <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" /> : <FileText className="w-4 h-4 text-slate-400 shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{t.name}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {t.scope === 'chat' ? 'مرفق محادثة' : 'مرفق رصيد الصحاري'} · {fmtBytes(t.size)} · حُذف {timeAgo(t.deletedAt)} · يُحذف نهائيًا بعد {left} يوم
              </div>
            </div>
            {t.scope === 'sahara' && (
              <button disabled={!!busy} onClick={() => onRestore(t)} className="h-8 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold inline-flex items-center gap-1">
                {busy === 'r' + t.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}استرجاع
              </button>
            )}
            <button disabled={!!busy} onClick={() => onPurge(t)} aria-label="حذف نهائي" title="حذف نهائي" className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 inline-flex items-center justify-center">
              {busy === 'p' + t.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
    { id: 'daily', icon: DatabaseBackup, tone: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', title: 'النسخة اليومية', desc: `تلقائيًا كل يوم 3:00 فجرًا بتوقيت العراق. التالية: ${ov ? new Date(ov.nextRun).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }) : '...'}`, action: 'تشغيل الآن', fn: () => systemApi.runJob('daily'), ok: 'تمت النسخة اليومية' },
    { id: 'cleanup', icon: Sparkles, tone: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', title: 'تنظيف البيانات المؤقتة', desc: 'الجلسات والتحديات المنتهية، الأجزاء والملفات اليتيمة، وتحسين الفهارس.', action: 'تنظيف الآن', fn: () => systemApi.runJob('cleanup'), ok: 'تم التنظيف' },
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
            <div className="text-sm font-bold text-slate-900 dark:text-white">الصيانة الشهرية</div>
            <div className="text-[11px] text-slate-500 leading-relaxed">تلقائيًا أول كل شهر: دمج النسخ اليومية في أرشيف دائم مضغوط، أرشفة الإشعارات (+90 يومًا) والسجل (+180 يومًا)، ثم التنظيف.</div>
            <div className="mt-2 flex items-center gap-2">
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
          <button disabled={!!busy} onClick={() => { if (window.confirm(`أرشفة شهر ${month}؟ النسخ اليومية لهذا الشهر تُدمج في أرشيف واحد ثم تُحذف.`)) run('monthly', () => systemApi.runJob('monthly', month), `تمت صيانة شهر ${month}`); }} className={`${btnCls} py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0`}>
            {busy === 'monthly' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}تشغيل
          </button>
        </div>
        <div className={`${cardCls} p-4 flex items-start gap-3 ${maint ? 'ring-2 ring-amber-400' : ''}`}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"><Construction className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">وضع الصيانة</div>
            <div className="text-[11px] text-slate-500 leading-relaxed">يوقف الكتابة على كل المستخدمين (القراءة تبقى). ينتهي تلقائيًا بعد 15 دقيقة كحد أقصى.</div>
          </div>
          <button disabled={!!busy} onClick={() => run('mode', () => systemApi.setMaintenance(!maint, 'صيانة يدوية من لوحة الإدارة'), maint ? 'أُلغي وضع الصيانة' : 'فُعّل وضع الصيانة')}
            className={`${btnCls} py-2 shrink-0 ${maint ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
            {busy === 'mode' && <Loader2 className="w-4 h-4 animate-spin" />}{maint ? 'إلغاء' : 'تفعيل'}
          </button>
        </div>
      </div>
      {msg && <p role="status" className={`text-sm font-bold rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>{msg.text}</p>}

      <section className={`${cardCls} overflow-hidden`}>
        <h4 className="px-5 pt-5 pb-3 font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2"><Activity className="w-4 h-4 text-slate-400" />سجل المهام</h4>
        {!jobs ? <div className="p-5"><Skeleton rows={3} /></div> : !jobs.length ? <Empty icon={Activity} title="لم تُشغَّل أي مهمة بعد" /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {jobs.map(j => (
              <li key={j.id}>
                <button onClick={() => setOpen(open === j.id ? null : j.id)} aria-expanded={open === j.id} className="w-full text-right px-5 py-3 flex items-center gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <StatusPill status={j.status === 'ok' ? 'ok' : j.status === 'error' ? 'error' : 'running'} label={j.status === 'ok' ? 'نجحت' : j.status === 'error' ? 'فشلت' : 'جارية'} />
                  <b className="text-slate-800 dark:text-slate-100">{JOB_LABELS[j.name] || j.name}</b>
                  <span className="text-slate-400">{j.triggered_by === 'scheduler' ? 'تلقائي' : names[j.triggered_by] || j.triggered_by}</span>
                  <span className="mr-auto text-slate-400 tabular-nums">{j.finished_at ? fmtDuration(j.finished_at - j.started_at) : '…'}</span>
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
