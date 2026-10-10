/**
 * النسخ الاحتياطي والاسترجاع: كل جداول D1 في ملف JSON مضغوط (gzip) داخل حاوية R2 المنفصلة BACKUPS.
 * - daily/YYYY/MM/YYYY-MM-DD.json.gz  نسخة يومية (المهمة المجدولة)
 * - manual/<وقت>.json.gz               نسخة يدوية من لوحة الإدارة
 * - pre-restore/<وقت>.json.gz          تؤخذ تلقائيًا قبل أي استرجاع
 * كل نسخة تحمل بصمة SHA-256 للمحتوى غير المضغوط، ويُتحقق منها قبل الاسترجاع.
 */
import { codedError } from '../errors';
import type { D1Database, Env } from '../types';
import { gunzipText, gzipText, sha256Hex } from './compress';
import { schemaGate } from '../storage/schema';

// demo-base: البيانات الأساسية للنسخة التجريبية (تُعاد إليها كل ليلة — worker/demo.ts)
export type BackupKind = 'daily' | 'manual' | 'pre-restore' | 'monthly' | 'demo-base';
export interface BackupRow {
  id: string; kind: BackupKind; r2_key: string; size: number; raw_size: number; rows: number; tables: number;
  sha256: string; status: string; note: string; created_at: number; created_by: string;
}
interface Snapshot { format: 'etihad-backup'; version: 1; createdAt: number; kind: BackupKind; counts: Record<string, number>; tables: Record<string, Record<string, unknown>[]> }

/**
 * سياسة الاسترجاع حسب نوع البيانات:
 * - بيانات التطبيق: تُعاد كاملة من النسخة.
 * - الحالة الأمنية ومفاتيح الهوية (الجلسات، التحديات، بصمات الدخول) وسجل العمليات: لا تُعاد أبدًا،
 *   حتى لا يعود مفتاح أو جلسة سُحبت لأسباب أمنية.
 * - الحسابات (IDENTITY_MERGE): الحساب الموجود الآن يحتفظ بحالته الحالية كاملة (كلمة المرور، الإدارة، الإيقاف، الصلاحيات)،
 *   ويُضاف فقط حساب موجود في النسخة ومفقود الآن (لا يوجد حذف حسابات في التطبيق، فغيابه يعني فقدان بيانات).
 */
const SKIP_ON_RESTORE = new Set(['backups', 'system_jobs', 'system_meta', 'chat_sessions', 'chat_resume', 'webauthn_challenges', 'webauthn_credentials', 'audit_log', 'sahara_file_chunks', 'chat_file_chunks']);
const IDENTITY_MERGE = new Set(['chat_users']);
/** جداول لا تُنسخ أصلًا: أجزاء الملفات القديمة (المحتوى في R2) */
const SKIP_ON_BACKUP = new Set(['sahara_file_chunks', 'chat_file_chunks']);
const PAGE = 500;

export const ensureSystemTables = (db: D1Database) => schemaGate(db, 'system', '1', async () => {
  await db.exec("CREATE TABLE IF NOT EXISTS backups (id TEXT PRIMARY KEY, kind TEXT NOT NULL, r2_key TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, raw_size INTEGER NOT NULL DEFAULT 0, rows INTEGER NOT NULL DEFAULT 0, tables INTEGER NOT NULL DEFAULT 0, sha256 TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'ok', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, created_by TEXT NOT NULL DEFAULT '')");
  await db.exec('CREATE INDEX IF NOT EXISTS backups_created ON backups (created_at)');
  await db.exec("CREATE TABLE IF NOT EXISTS system_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'running', details TEXT NOT NULL DEFAULT '', triggered_by TEXT NOT NULL DEFAULT '')");
  await db.exec('CREATE TABLE IF NOT EXISTS system_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)');
});

/** عروض SQL (للتصفح والتقارير فقط؛ لا تُنسخ ولا تُسترجع لأنها لا تحمل بيانات) */
export const userViews = async (db: D1Database) => {
  const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'view' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{ name: string }>();
  return results.map(r => r.name);
};

/** أسماء جداول المستخدم (بدون جداول SQLite و Cloudflare الداخلية) */
export const userTables = async (db: D1Database) => {
  const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name").all<{ name: string }>();
  return results.map(r => r.name);
};

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

const dateParts = (t: number) => {
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), day = String(d.getUTCDate()).padStart(2, '0');
  return { y, m, day, iso: d.toISOString().replace(/[:.]/g, '-') };
};

export const backupKeyFor = (kind: BackupKind, t: number) => {
  const { y, m, day, iso } = dateParts(t);
  if (kind === 'daily') return `daily/${y}/${m}/${y}-${m}-${day}.json.gz`;
  return `${kind}/${iso}.json.gz`;
};

/** لقطة كاملة من D1 (كل الجداول، صفحة صفحة) */
export const snapshotDb = async (db: D1Database, kind: BackupKind, now: number): Promise<Snapshot> => {
  const tables: Snapshot['tables'] = {};
  const counts: Record<string, number> = {};
  for (const name of await userTables(db)) {
    if (SKIP_ON_BACKUP.has(name)) continue;
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { results } = await db.prepare(`SELECT * FROM ${quote(name)} LIMIT ? OFFSET ?`).bind(PAGE, offset).all();
      rows.push(...results);
      if (results.length < PAGE) break;
    }
    tables[name] = rows;
    counts[name] = rows.length;
  }
  return { format: 'etihad-backup', version: 1, createdAt: now, kind, counts, tables };
};

/** أخذ نسخة كاملة وحفظها في R2 وتسجيلها في جدول backups */
export const createBackup = async (env: Env, kind: Exclude<BackupKind, 'monthly'>, by: string, note = ''): Promise<BackupRow> => {
  await ensureSystemTables(env.DB);
  const now = Date.now();
  const snap = await snapshotDb(env.DB, kind, now);
  const text = JSON.stringify(snap);
  const sha256 = await sha256Hex(text);
  const gz = await gzipText(text);
  const key = backupKeyFor(kind, now);
  const rows = Object.values(snap.counts).reduce((a, n) => a + n, 0);
  await env.BACKUPS.put(key, gz, {
    httpMetadata: { contentType: 'application/gzip' },
    customMetadata: { sha256, kind, rows: String(rows), createdAt: String(now) },
  });
  // التحقق من وصول الملف كاملًا
  const head = await env.BACKUPS.head(key);
  if (!head || head.size !== gz.length) throw codedError('فشل التحقق من حفظ النسخة في R2', 'backup_verify_failed');
  const row: BackupRow = {
    id: crypto.randomUUID(), kind, r2_key: key, size: gz.length, raw_size: text.length, rows, tables: Object.keys(snap.counts).length,
    sha256, status: 'ok', note, created_at: now, created_by: by,
  };
  // النسخة اليومية واحدة لكل يوم: تشغيل ثانٍ في نفس اليوم يستبدل السجل
  if (kind === 'daily') await env.DB.prepare('DELETE FROM backups WHERE r2_key = ?').bind(key).run();
  await env.DB.prepare('INSERT INTO backups (id, kind, r2_key, size, raw_size, rows, tables, sha256, status, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(row.id, row.kind, row.r2_key, row.size, row.raw_size, row.rows, row.tables, row.sha256, row.status, row.note, row.created_at, row.created_by).run();
  return row;
};

/** قراءة نسخة والتحقق من بصمتها */
export const readBackup = async (env: Env, row: Pick<BackupRow, 'r2_key' | 'sha256'>): Promise<Snapshot> => {
  const obj = await env.BACKUPS.get(row.r2_key);
  if (!obj) throw codedError('ملف النسخة غير موجود في R2', 'backup_file_missing');
  const text = await gunzipText(await obj.arrayBuffer());
  if (row.sha256 && (await sha256Hex(text)) !== row.sha256) throw codedError('بصمة النسخة لا تطابق: الملف تالف أو معدّل', 'backup_hash_mismatch');
  const snap = JSON.parse(text) as Snapshot;
  if (snap.format !== 'etihad-backup') throw codedError('صيغة ملف النسخة غير معروفة', 'backup_format');
  return snap;
};

// ───── وضع الصيانة (يمنع الكتابة أثناء الاسترجاع) ─────
const MAINT_KEY = 'maintenance';
export const getMaintenance = async (db: D1Database): Promise<{ by: string; since: number; reason: string } | null> => {
  try {
    const { results } = await db.prepare('SELECT value FROM system_meta WHERE key = ?').bind(MAINT_KEY).all<{ value: string }>();
    if (!results[0]) return null;
    const m = JSON.parse(results[0].value);
    // حماية من بقاء الوضع مفعّلًا بعد تعطل غير متوقع: ينتهي تلقائيًا بعد 15 دقيقة
    return Date.now() - m.since > 15 * 60_000 ? null : m;
  } catch {
    return null;
  }
};
export const setMaintenance = (db: D1Database, value: { by: string; since: number; reason: string } | null) =>
  value
    ? db.prepare('INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)').bind(MAINT_KEY, JSON.stringify(value), value.since).run()
    : db.prepare('DELETE FROM system_meta WHERE key = ?').bind(MAINT_KEY).run();

/** D1 يسمح بـ 100 قيمة مربوطة كحد أقصى لكل أمر */
const MAX_PARAMS = 100;

/**
 * استرجاع كامل: وضع صيانة ← نسخة pre-restore ← التحقق من البصمة ← تفريغ كل جدول وإعادة تعبئته على دفعات.
 * يعيد معرّف نسخة pre-restore للرجوع إليها عند الحاجة.
 */
export const restoreBackup = async (env: Env, backupId: string, by: string, opts: { skipPreRestore?: boolean } = {}) => {
  await ensureSystemTables(env.DB);
  const { results } = await env.DB.prepare('SELECT * FROM backups WHERE id = ?').bind(backupId).all<BackupRow>();
  const target = results[0];
  if (!target) throw codedError('النسخة غير موجودة', 'backup_not_found');
  if (target.kind === 'monthly') throw codedError('الأرشيف الشهري يُنزَّل فقط؛ للاسترجاع اختر نسخة يومية أو يدوية', 'monthly_download_only');

  // قراءة النسخة والتحقق منها قبل لمس أي بيانات
  const snap = await readBackup(env, target);
  await setMaintenance(env.DB, { by, since: Date.now(), reason: `استرجاع نسخة ${target.r2_key}` });
  let preRestore: BackupRow | null = null;
  try {
    // إعادة الضبط الليلية للنسخة التجريبية لا تحتاج نسخة قبلها (البيانات وهمية)
    if (!opts.skipPreRestore) preRestore = await createBackup(env, 'pre-restore', by, `قبل استرجاع ${target.r2_key}`);
    const existing = new Set(await userTables(env.DB));
    let restoredRows = 0;
    for (const [table, rows] of Object.entries(snap.tables)) {
      if (SKIP_ON_RESTORE.has(table) || !existing.has(table)) continue;
      const { results: cols } = await env.DB.prepare(`PRAGMA table_info(${quote(table)})`).all<{ name: string }>();
      const colNames = cols.map(c => c.name);
      const merge = IDENTITY_MERGE.has(table);
      const stmts = merge ? [] : [env.DB.prepare(`DELETE FROM ${quote(table)}`)];
      const perStmt = Math.max(1, Math.floor(MAX_PARAMS / Math.max(1, colNames.length)));
      for (let i = 0; i < rows.length; i += perStmt) {
        const chunk = rows.slice(i, i + perStmt);
        const placeholders = chunk.map(() => `(${colNames.map(() => '?').join(', ')})`).join(', ');
        const values = chunk.flatMap(r => colNames.map(c => (r[c] === undefined ? null : r[c])));
        stmts.push(env.DB.prepare(`INSERT${merge ? ' OR IGNORE' : ''} INTO ${quote(table)} (${colNames.map(quote).join(', ')}) VALUES ${placeholders}`).bind(...values));
      }
      // كل جدول في دفعة واحدة (معاملة) حتى لا يبقى جدول نصف مُعاد
      for (let i = 0; i < stmts.length; i += 200) await env.DB.batch(stmts.slice(i, i + 200));
      restoredRows += rows.length;
    }
    return { restoredRows, preRestoreId: preRestore?.id ?? null };
  } catch (e) {
    throw Object.assign(new Error(`${(e as Error).message}${preRestore ? ` — نسخة ما قبل الاسترجاع محفوظة (${preRestore.r2_key}) ويمكن استرجاعها` : ''}`), { code: (e as { code?: string }).code });
  } finally {
    await setMaintenance(env.DB, null);
  }
};
