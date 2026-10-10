/**
 * النسخة التجريبية (wrangler env demo — Worker وقاعدة D1 وحاويات R2 منفصلة تمامًا عن التشغيل الفعلي):
 * - حسابات التجربة يُنشئها مدير النسخة التجريبية بمدة من ساعة إلى شهر، وتتوقف تلقائيًا بعد انتهائها.
 * - "البيانات الأساسية": لقطة يعتمدها المدير (نسخة من نوع demo-base)، وتُعاد البيانات إليها كل ليلة
 *   فيجرّب كل زائر على بيانات نظيفة. الحسابات لا تُمس (الاسترجاع يحتفظ بالحسابات الحالية كما هي).
 */
import type { Env } from './types';
import { createBackup, ensureSystemTables, restoreBackup, type BackupRow } from './system/backup';
import { runJob } from './system/maintenance';
import { findOrphanFiles } from './storage/files';

export const isDemo = (env: Pick<Env, 'DEMO_MODE'>) => env.DEMO_MODE === '1';

const HOUR = 3600_000;
/** مدة حساب التجربة: من ساعة إلى 31 يومًا */
export const DEMO_MIN_MS = HOUR;
export const DEMO_MAX_MS = 31 * 24 * HOUR;
export const validDemoExpiry = (expiresAt: number, now: number) =>
  Number.isFinite(expiresAt) && expiresAt - now >= DEMO_MIN_MS - 60_000 && expiresAt - now <= DEMO_MAX_MS + 60_000;

/** آخر لقطة أساسية معتمدة */
export const latestDemoBase = async (env: Env): Promise<BackupRow | null> => {
  await ensureSystemTables(env.DB);
  const { results } = await env.DB.prepare("SELECT * FROM backups WHERE kind = 'demo-base' ORDER BY created_at DESC LIMIT 1").all<BackupRow>();
  return results[0] || null;
};

/** اعتماد البيانات الحالية كبيانات أساسية (تُحذف اللقطات الأقدم) */
export const setDemoBase = async (env: Env, by: string) => {
  const row = await createBackup(env, 'demo-base', by, 'البيانات الأساسية للنسخة التجريبية');
  const { results: old } = await env.DB.prepare("SELECT id, r2_key FROM backups WHERE kind = 'demo-base' AND id != ?").bind(row.id).all<{ id: string; r2_key: string }>();
  for (const o of old) {
    await env.BACKUPS.delete(o.r2_key);
    await env.DB.prepare('DELETE FROM backups WHERE id = ?').bind(o.id).run();
  }
  return row;
};

/** إيقاف حسابات التجربة المنتهية وإخراجها من كل الأجهزة */
export const expireDemoAccounts = async (env: Env, now = Date.now()) => {
  const { results } = await env.DB.prepare('SELECT id FROM chat_users WHERE is_admin = 0 AND disabled = 0 AND expires_at > 0 AND expires_at <= ?').bind(now).all<{ id: string }>();
  for (const { id } of results) {
    await env.DB.batch([
      env.DB.prepare('UPDATE chat_users SET disabled = 1 WHERE id = ?').bind(id),
      env.DB.prepare('DELETE FROM chat_sessions WHERE user_id = ?').bind(id),
      env.DB.prepare('DELETE FROM chat_resume WHERE user_id = ?').bind(id),
    ]);
  }
  return results.length;
};

/**
 * إعادة الضبط: البيانات ← اللقطة الأساسية (بدون نسخة ما قبل الاسترجاع)، ثم إيقاف الحسابات المنتهية
 * وحذف الملفات التي لم تعد مرتبطة بأي سجل، ورفع رقم النسخة حتى تجلب الأجهزة المفتوحة البيانات المعادة.
 */
export const demoReset = (env: Env, by = 'scheduler') =>
  runJob(env, 'demo-reset', by, async () => {
    const now = Date.now();
    const base = await latestDemoBase(env);
    const restored = base ? await restoreBackup(env, base.id, by, { skipPreRestore: true }) : null;
    const expired = await expireDemoAccounts(env, now);
    const orphans = await findOrphanFiles(env.FILES, env.DB);
    for (let i = 0; i < orphans.length; i += 1000) await env.FILES.delete(orphans.slice(i, i + 1000));
    await env.DB.prepare('INSERT INTO system_meta (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3')
      .bind('state_version', `${now}-demo-reset`, now).run();
    return { base: base?.r2_key ?? null, restoredRows: restored?.restoredRows ?? 0, expiredAccounts: expired, orphanFiles: orphans.length };
  });
