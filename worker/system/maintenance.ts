/**
 * المهام المجدولة وسجلها:
 * - يوميًا: نقل أي ملفات قديمة متبقية إلى R2 ثم نسخة احتياطية يومية.
 * - أول كل شهر: دمج النسخ اليومية للشهر السابق في أرشيف واحد مضغوط (دائم) ثم حذفها،
 *   أرشفة الإشعارات الأقدم من 90 يومًا وسجل العمليات الأقدم من 180 يومًا، وتنظيف البيانات المؤقتة.
 */
import type { Env } from '../types';
import { createBackup, ensureSystemTables } from './backup';
import { gunzipText, gzipText, sha256Hex } from './compress';
import { findOrphanFiles, migrateLegacyFiles, purgeTrash, verifyFiles } from '../storage/files';

const DAY = 86400_000;
const NOTIF_KEEP_MS = 90 * DAY;
const AUDIT_KEEP_MS = 180 * DAY;
const SESSION_MAX_MS = DAY;

/** تشغيل مهمة مع تسجيلها في system_jobs (البداية، النهاية، الحالة، التفاصيل) */
export const runJob = async <T>(env: Env, name: string, by: string, fn: () => Promise<T>): Promise<T> => {
  await ensureSystemTables(env.DB);
  const started = Date.now();
  const res = await env.DB.prepare('INSERT INTO system_jobs (name, started_at, status, triggered_by) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(name, started, 'running', by).all<{ id: number }>();
  const id = res.results[0]?.id;
  try {
    const out = await fn();
    await env.DB.prepare('UPDATE system_jobs SET finished_at = ?, status = ?, details = ? WHERE id = ?').bind(Date.now(), 'ok', JSON.stringify(out ?? {}).slice(0, 4000), id).run();
    return out;
  } catch (e) {
    await env.DB.prepare('UPDATE system_jobs SET finished_at = ?, status = ?, details = ? WHERE id = ?').bind(Date.now(), 'error', String((e as Error).message || e).slice(0, 4000), id).run();
    throw e;
  }
};

/** المهمة اليومية */
export const dailyJob = (env: Env, by = 'scheduler') =>
  runJob(env, 'daily-backup', by, async () => {
    const migrated = await migrateLegacyFiles(env.FILES, env.DB);
    const b = await createBackup(env, 'daily', by);
    return { backup: b.r2_key, rows: b.rows, size: b.size, migratedFiles: migrated.moved };
  });

const monthOf = (t: number) => {
  const d = new Date(t);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
};
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * الصيانة الشهرية. month = 'YYYY-MM' للشهر المراد أرشفته (افتراضيًا الشهر السابق لتاريخ التشغيل).
 */
export const monthlyJob = (env: Env, by = 'scheduler', month?: string) =>
  runJob(env, 'monthly-maintenance', by, async () => {
    const now = Date.now();
    let y: number, m: number;
    if (month && /^\d{4}-\d{2}$/.test(month)) [y, m] = month.split('-').map(Number);
    else { const cur = monthOf(now); y = cur.m === 1 ? cur.y - 1 : cur.y; m = cur.m === 1 ? 12 : cur.m - 1; }
    const ym = `${y}-${pad(m)}`;
    const result: Record<string, unknown> = { month: ym };

    // 1) أرشفة البيانات القديمة (تُضاف لنفس الأرشيف الشهري)
    const lines: string[] = [];
    const cutoffNotif = new Date(now - NOTIF_KEEP_MS).toISOString();
    const { results: oldNotifs } = await env.DB.prepare("SELECT id, data FROM collection_items WHERE key = 'sahara_notifications' AND json_extract(data, '$.timestamp') < ?")
      .bind(cutoffNotif).all<{ id: string; data: string }>().catch(() => ({ results: [] as { id: string; data: string }[] }));
    if (oldNotifs.length) lines.push(JSON.stringify({ type: 'archived', table: 'sahara_notifications', before: cutoffNotif, rows: oldNotifs.map(r => JSON.parse(r.data)) }));
    const { results: oldAudit } = await env.DB.prepare('SELECT * FROM audit_log WHERE at < ?').bind(now - AUDIT_KEEP_MS).all().catch(() => ({ results: [] as Record<string, unknown>[] }));
    if (oldAudit.length) lines.push(JSON.stringify({ type: 'archived', table: 'audit_log', before: now - AUDIT_KEEP_MS, rows: oldAudit }));

    // 2) النسخ اليومية للشهر
    const prefix = `daily/${y}/${pad(m)}/`;
    const dailies: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await env.BACKUPS.list({ prefix, cursor, limit: 1000 });
      dailies.push(...page.objects.map(o => o.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    dailies.sort();
    for (const key of dailies) {
      const obj = await env.BACKUPS.get(key);
      if (!obj) continue;
      const text = await gunzipText(await obj.arrayBuffer());
      lines.push(`{"type":"daily","key":${JSON.stringify(key)},"snapshot":${text}}`);
    }

    // 3) كتابة الأرشيف والتحقق منه، ثم فقط حذف المصادر
    if (lines.length) {
      const text = lines.join('\n') + '\n';
      const gz = await gzipText(text);
      let key = `monthly/${ym}.ndjson.gz`;
      for (let n = 2; await env.BACKUPS.head(key); n++) key = `monthly/${ym}-${n}.ndjson.gz`; // تشغيل ثانٍ لنفس الشهر لا يكتب فوق الأول
      const sha256 = await sha256Hex(text);
      await env.BACKUPS.put(key, gz, { httpMetadata: { contentType: 'application/gzip' }, customMetadata: { sha256, month: ym, lines: String(lines.length) } });
      const check = await env.BACKUPS.get(key);
      const back = check ? await gunzipText(await check.arrayBuffer()) : '';
      if (back.length !== text.length || (await sha256Hex(back)) !== sha256) throw new Error('فشل التحقق من الأرشيف الشهري؛ لم يُحذف شيء');

      await env.DB.prepare('INSERT INTO backups (id, kind, r2_key, size, raw_size, rows, tables, sha256, status, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), 'monthly', key, gz.length, text.length, lines.length, dailies.length, sha256, 'ok',
          `${dailies.length} نسخة يومية، ${oldNotifs.length} إشعار، ${oldAudit.length} سجل عمليات`, now, by).run();

      if (dailies.length) {
        await env.BACKUPS.delete(dailies);
        await env.DB.batch(dailies.map(k => env.DB.prepare('DELETE FROM backups WHERE r2_key = ?').bind(k)));
      }
      if (oldNotifs.length) {
        const ids = oldNotifs.map(r => r.id);
        for (let i = 0; i < ids.length; i += 90) {
          const part = ids.slice(i, i + 90);
          await env.DB.prepare(`DELETE FROM collection_items WHERE key = 'sahara_notifications' AND id IN (${part.map(() => '?').join(',')})`).bind(...part).run();
        }
      }
      if (oldAudit.length) await env.DB.prepare('DELETE FROM audit_log WHERE at < ?').bind(now - AUDIT_KEEP_MS).run();
      Object.assign(result, { archive: key, size: gz.length, dailies: dailies.length, notifications: oldNotifs.length, audit: oldAudit.length });
    }

    // 4) تنظيف البيانات المؤقتة، ثم فحص سلامة الملفات
    result.cleanup = await cleanup(env, now);
    const integrity = await verifyFiles(env.FILES, env.DB);
    result.integrity = { checked: integrity.checked, ok: integrity.ok, backfilled: integrity.backfilled, missing: integrity.missing.length, corrupt: integrity.corrupt };
    if (integrity.corrupt.length || integrity.missing.length) console.error('file integrity problems', integrity);
    return result;
  });

/** تنظيف: الجلسات والتحديات المنتهية، أجزاء الملفات اليتيمة، ملفات R2 بلا سجل، وتحسين الفهارس */
export const cleanup = async (env: Env, now = Date.now()) => {
  const out: Record<string, number | string> = {};
  const run = async (label: string, sql: string, ...args: unknown[]) => {
    try { const r = await env.DB.prepare(sql).bind(...args).run(); out[label] = r.meta?.changes ?? 0; } catch { out[label] = 0; }
  };
  await run('expiredSessions', 'DELETE FROM chat_sessions WHERE created_at < ?', now - SESSION_MAX_MS);
  await run('expiredChallenges', 'DELETE FROM webauthn_challenges WHERE expires_at < ?', now);
  await run('orphanSaharaChunks', 'DELETE FROM sahara_file_chunks WHERE file_id NOT IN (SELECT id FROM sahara_files)');
  await run('orphanChatChunks', 'DELETE FROM chat_file_chunks WHERE file_id NOT IN (SELECT id FROM chat_files)');
  const orphans = await findOrphanFiles(env.FILES, env.DB).catch(() => [] as string[]);
  for (let i = 0; i < orphans.length; i += 1000) await env.FILES.delete(orphans.slice(i, i + 1000));
  out.orphanR2Files = orphans.length;
  out.trashPurged = await purgeTrash(env.FILES).catch(() => 0);
  try { await env.DB.exec('PRAGMA optimize'); out.optimize = 'ok'; } catch { out.optimize = 'غير مدعوم'; }
  return out;
};

/** نقطة الدخول للمهمة المجدولة اليومية؛ في أول كل شهر تُتبع بالصيانة الشهرية */
export const onSchedule = async (env: Env, scheduledTime: number) => {
  await dailyJob(env);
  if (new Date(scheduledTime).getUTCDate() === 1) await monthlyJob(env);
};

/** موعد التشغيل التالي (00:00 UTC) */
export const nextRun = (now = Date.now()) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};
