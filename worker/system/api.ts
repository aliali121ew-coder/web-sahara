/**
 * واجهات لوحة "إدارة النظام" (/api/system/*) — لمدير النظام فقط، وكل عملية تُسجَّل في سجل العمليات.
 */
import type { Env, R2Bucket } from '../types';
import type { Session } from '../chat';
import { audit } from '../chat';
import { createBackup, ensureSystemTables, getMaintenance, restoreBackup, setMaintenance, userTables, userViews, type BackupRow } from './backup';
import { cleanup, dailyJob, monthlyJob, nextRun } from './maintenance';
import { findOrphanFiles, legacyFileCount, listTrash, migrateLegacyFiles, purgeTrash, restoreFromTrash, verifyFiles } from '../storage/files';
import { collectionCounts } from '../storage/collections';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

/** حقول لا تُعرض أبدًا في متصفح الجداول */
const SECRET_COLS = new Set(['pass_hash', 'token_hash', 'key_hash', 'public_key']);
const MAX_CELL = 300;
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

const maskRow = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => {
    if (SECRET_COLS.has(k)) return [k, v ? '•••• مخفي' : ''];
    if (typeof v === 'string' && v.length > MAX_CELL) return [k, `${v.slice(0, MAX_CELL)}… (${v.length.toLocaleString('en')} حرف)`];
    return [k, v];
  }));

/** حجم وعدد الكائنات في حاوية R2 حسب المجلد الأول من المسار */
const bucketUsage = async (bucket: R2Bucket) => {
  const byPrefix: Record<string, { count: number; bytes: number }> = {};
  let count = 0, bytes = 0, cursor: string | undefined;
  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    for (const o of page.objects) {
      const p = o.key.split('/')[0];
      byPrefix[p] = byPrefix[p] || { count: 0, bytes: 0 };
      byPrefix[p].count++; byPrefix[p].bytes += o.size;
      count++; bytes += o.size;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { count, bytes, byPrefix };
};

export async function handleSystem(request: Request, url: URL, env: Env, session: Session): Promise<Response> {
  if (!session.admin) return json({ error: 'هذه الصفحة لمدير النظام فقط', code: 'forbidden' }, 403);
  await ensureSystemTables(env.DB);
  const path = url.pathname.slice('/api/system'.length) || '/';
  const method = request.method;
  const db = env.DB;

  // ───── نظرة عامة ─────
  if (path === '/overview' && method === 'GET') {
    const t0 = Date.now();
    const ping = await db.prepare('SELECT 1').run();
    const dbLatency = Date.now() - t0;
    const tables: { name: string; rows: number; view?: boolean }[] = [];
    for (const name of await userTables(db)) {
      const { results } = await db.prepare(`SELECT COUNT(*) AS n FROM ${quote(name)}`).all<{ n: number }>();
      tables.push({ name, rows: results[0]?.n || 0 });
    }
    for (const name of await userViews(db)) {
      const { results } = await db.prepare(`SELECT COUNT(*) AS n FROM ${quote(name)}`).all<{ n: number }>();
      tables.push({ name, rows: results[0]?.n || 0, view: true });
    }
    const t1 = Date.now();
    const [files, backups] = await Promise.all([bucketUsage(env.FILES), bucketUsage(env.BACKUPS)]);
    const r2Latency = Date.now() - t1;
    const { results: last } = await db.prepare("SELECT * FROM backups WHERE kind != 'monthly' ORDER BY created_at DESC LIMIT 1").all<BackupRow>();
    const { results: jobs } = await db.prepare('SELECT * FROM system_jobs ORDER BY id DESC LIMIT 5').all();
    return json({
      db: { latencyMs: dbLatency, sizeBytes: ping.meta?.size_after ?? null, tables },
      r2: { latencyMs: r2Latency, files, backups },
      collections: await collectionCounts(db),
      legacyFiles: await legacyFileCount(db),
      lastBackup: last[0] || null,
      nextRun: nextRun(),
      maintenance: await getMaintenance(db),
      jobs,
    });
  }

  // ───── متصفح الجداول (للقراءة فقط) ─────
  const tm = path.match(/^\/tables\/([^/]+)$/);
  if (tm && method === 'GET') {
    const name = decodeURIComponent(tm[1]);
    if (![...(await userTables(db)), ...(await userViews(db))].includes(name)) return json({ error: 'الجدول غير موجود' }, 404);
    const { results: cols } = await db.prepare(`PRAGMA table_info(${quote(name)})`).all<{ name: string; type: string; pk: number }>();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    // البحث في الأعمدة النصية فقط، وبدون الأعمدة السرّية
    const searchable = cols.filter(c => !SECRET_COLS.has(c.name) && !/INT|REAL/i.test(c.type)).slice(0, 40);
    const where = q && searchable.length ? `WHERE ${searchable.map(c => `${quote(c.name)} LIKE ?`).join(' OR ')}` : '';
    const args = q && searchable.length ? searchable.map(() => `%${q}%`) : [];
    const { results: total } = await db.prepare(`SELECT COUNT(*) AS n FROM ${quote(name)} ${where}`).bind(...args).all<{ n: number }>();
    const { results: rows } = await db.prepare(`SELECT * FROM ${quote(name)} ${where} LIMIT ? OFFSET ?`).bind(...args, limit, offset).all();
    return json({ name, columns: cols.map(c => ({ name: c.name, type: c.type, pk: !!c.pk, secret: SECRET_COLS.has(c.name) })), total: total[0]?.n || 0, offset, limit, rows: rows.map(maskRow) });
  }

  // ───── النسخ الاحتياطية ─────
  if (path === '/backups' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM backups ORDER BY created_at DESC LIMIT 500').all<BackupRow>();
    return json({ items: results });
  }
  if (path === '/backups/run' && method === 'POST') {
    const b = await createBackup(env, 'manual', session.id, 'نسخة يدوية من لوحة الإدارة');
    await audit(db, request, session.id, 'system.backup', `${b.r2_key} (${b.rows} سطر)`);
    return json({ ok: true, item: b });
  }
  const bm = path.match(/^\/backups\/([^/]+)(\/download|\/restore)?$/);
  if (bm) {
    const id = decodeURIComponent(bm[1]);
    const { results } = await db.prepare('SELECT * FROM backups WHERE id = ?').bind(id).all<BackupRow>();
    const row = results[0];
    if (!row) return json({ error: 'النسخة غير موجودة' }, 404);

    if (bm[2] === '/download' && method === 'GET') {
      const obj = await env.BACKUPS.get(row.r2_key);
      if (!obj) return json({ error: 'ملف النسخة غير موجود في R2' }, 404);
      await audit(db, request, session.id, 'system.download', row.r2_key);
      return new Response(obj.body, {
        headers: {
          'content-type': 'application/gzip',
          'content-disposition': `attachment; filename="${row.r2_key.split('/').pop()}"`,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    if (bm[2] === '/restore' && method === 'POST') {
      const b = await request.json().catch(() => null) as { confirm?: string } | null;
      if (b?.confirm !== 'استرجاع') return json({ error: 'اكتب كلمة «استرجاع» للتأكيد' }, 400);
      try {
        const r = await restoreBackup(env, id, session.id);
        await audit(db, request, session.id, 'system.restore', `${row.r2_key}: ${r.restoredRows} سطر`);
        return json({ ok: true, ...r });
      } catch (e) {
        await audit(db, request, session.id, 'system.restore_failed', `${row.r2_key}: ${(e as Error).message}`);
        return json({ error: (e as Error).message }, 500);
      }
    }

    if (!bm[2] && method === 'DELETE') {
      // النسخ اليومية تُدار تلقائيًا، والأرشيف الشهري دائم
      if (row.kind !== 'manual' && row.kind !== 'pre-restore') return json({ error: 'يمكن حذف النسخ اليدوية ونسخ ما قبل الاسترجاع فقط' }, 400);
      await env.BACKUPS.delete(row.r2_key);
      await db.prepare('DELETE FROM backups WHERE id = ?').bind(id).run();
      await audit(db, request, session.id, 'system.delete_backup', row.r2_key);
      return json({ ok: true });
    }
  }

  // ───── الملفات في R2 ─────
  if (path === '/files' && method === 'GET') {
    const prefix = url.searchParams.get('prefix') === 'chat/' ? 'chat/' : 'sahara/';
    const page = await env.FILES.list({ prefix, cursor: url.searchParams.get('cursor') || undefined, limit: 100 });
    const table = prefix === 'chat/' ? 'chat_files' : 'sahara_files';
    const ids = page.objects.map(o => o.key.slice(prefix.length));
    const names: Record<string, string> = {};
    const shas: Record<string, string> = {};
    if (ids.length) {
      for (let i = 0; i < ids.length; i += 90) {
        const part = ids.slice(i, i + 90);
        const { results } = await db.prepare(`SELECT id, name, sha256 FROM ${table} WHERE id IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ id: string; name: string; sha256: string }>().catch(() => ({ results: [] as { id: string; name: string; sha256: string }[] }));
        for (const r of results) { names[r.id] = r.name; shas[r.id] = r.sha256 || ''; }
      }
    }
    return json({
      items: page.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded, type: o.httpMetadata?.contentType || '', name: names[o.key.slice(prefix.length)] ?? null, sha256: shas[o.key.slice(prefix.length)] || '' })),
      cursor: page.truncated ? page.cursor : null,
    });
  }
  if (path === '/files/migrate' && method === 'POST') {
    const r = await migrateLegacyFiles(env.FILES, db);
    await audit(db, request, session.id, 'system.files', `نقل ${r.moved} ملف قديم إلى R2`);
    return json({ ok: true, ...r });
  }
  if (path === '/files/orphans' && method === 'GET') return json({ items: await findOrphanFiles(env.FILES, db) });
  // فحص سلامة الملفات بمقارنة بصمة SHA-256 (ويُكمل بصمات الملفات القديمة)
  if (path === '/files/verify' && method === 'POST') {
    const r = await verifyFiles(env.FILES, db);
    await audit(db, request, session.id, 'system.files', `فحص سلامة ${r.checked} ملف: ${r.ok} سليم، ${r.corrupt.length} تالف، ${r.missing.length} مفقود`);
    return json(r);
  }
  // سلة المحذوفات
  if (path === '/files/trash' && method === 'GET') return json({ items: await listTrash(env.FILES) });
  if (path === '/files/trash/restore' && method === 'POST') {
    const b = await request.json().catch(() => ({})) as { key?: string };
    try {
      const r = await restoreFromTrash(env.FILES, db, String(b.key || ''));
      await audit(db, request, session.id, 'system.files', `استرجاع ${r.name} من سلة المحذوفات`);
      return json({ ok: true, ...r });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }
  if (path === '/files/trash' && method === 'DELETE') {
    const key = url.searchParams.get('key') || undefined;
    try {
      const n = await purgeTrash(env.FILES, key);
      await audit(db, request, session.id, 'system.files', key ? `حذف نهائي: ${key}` : `تفريغ السلة: ${n} ملف أقدم من 30 يومًا`);
      return json({ ok: true, deleted: n });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }
  if (path === '/files/orphans' && method === 'DELETE') {
    const orphans = await findOrphanFiles(env.FILES, db);
    for (let i = 0; i < orphans.length; i += 1000) await env.FILES.delete(orphans.slice(i, i + 1000));
    await audit(db, request, session.id, 'system.files', `حذف ${orphans.length} ملف يتيم`);
    return json({ ok: true, deleted: orphans.length });
  }

  // ───── المهام والصيانة ─────
  if (path === '/jobs' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM system_jobs ORDER BY id DESC LIMIT 100').all();
    return json({ items: results, nextRun: nextRun() });
  }
  // وضع الصيانة اليدوي: يمنع الكتابة على كل المستخدمين (ينتهي تلقائيًا بعد 15 دقيقة كحد أقصى)
  if (path === '/maintenance/mode' && method === 'POST') {
    const b = await request.json().catch(() => ({})) as { on?: boolean; reason?: string };
    await setMaintenance(db, b.on ? { by: session.id, since: Date.now(), reason: String(b.reason || 'صيانة يدوية').slice(0, 120) } : null);
    await audit(db, request, session.id, 'system.maintenance', b.on ? 'تفعيل وضع الصيانة' : 'إلغاء وضع الصيانة');
    return json({ ok: true, maintenance: await getMaintenance(db) });
  }
  if (path === '/maintenance/run' && method === 'POST') {
    const b = await request.json().catch(() => ({})) as { job?: string; month?: string };
    try {
      const r = b.job === 'monthly' ? await monthlyJob(env, session.id, b.month)
        : b.job === 'cleanup' ? await cleanup(env)
          : await dailyJob(env, session.id);
      await audit(db, request, session.id, 'system.maintenance', `${b.job || 'daily'}${b.month ? ` ${b.month}` : ''}`);
      return json({ ok: true, result: r });
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  }

  return json({ error: 'غير موجود' }, 404);
}
