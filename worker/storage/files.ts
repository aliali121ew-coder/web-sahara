/**
 * تخزين الملفات في R2 (حاوية FILES): المحتوى في R2 والبيانات الوصفية في D1.
 * الملفات القديمة كانت تُحفظ داخل D1 كأجزاء base64؛ تُنقل إلى R2 تلقائيًا عند أول قراءة،
 * أو كلها مرة واحدة من لوحة إدارة النظام (migrateLegacyFiles).
 */
import type { D1Database, R2Bucket } from '../types';

export type FileScope = 'sahara' | 'chat';
const LEGACY_CHUNKS: Record<FileScope, string> = { sahara: 'sahara_file_chunks', chat: 'chat_file_chunks' };
const META_TABLE: Record<FileScope, string> = { sahara: 'sahara_files', chat: 'chat_files' };

export const fileKey = (scope: FileScope, id: string) => `${scope}/${id}`;

export const storeFile = (bucket: R2Bucket, scope: FileScope, id: string, bytes: Uint8Array, contentType: string, meta: Record<string, string> = {}) =>
  bucket.put(fileKey(scope, id), bytes, {
    httpMetadata: { contentType },
    // أسماء الملفات العربية تُرمَّز لأن البيانات الوصفية في R2 نص ASCII
    customMetadata: Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, encodeURIComponent(v)])),
  });

const base64ToBytes = (b64: string) => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

/** يقرأ ملفًا قديمًا من أجزاء D1، ينقله إلى R2، ثم يحذف أجزاءه. يعيد null إن لم يوجد */
const migrateOne = async (bucket: R2Bucket, db: D1Database, scope: FileScope, id: string): Promise<Uint8Array<ArrayBuffer> | null> => {
  const table = LEGACY_CHUNKS[scope];
  let chunks: { data: string }[];
  try {
    ({ results: chunks } = await db.prepare(`SELECT data FROM ${table} WHERE file_id = ? ORDER BY idx`).bind(id).all<{ data: string }>());
  } catch {
    return null; // الجدول غير موجود (تثبيت جديد)
  }
  if (!chunks.length) return null;
  const parts = chunks.map(c => base64ToBytes(c.data));
  const bytes = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let offset = 0;
  for (const p of parts) { bytes.set(p, offset); offset += p.length; }
  const { results: meta } = await db.prepare(`SELECT name, type FROM ${META_TABLE[scope]} WHERE id = ?`).bind(id).all<{ name: string; type: string }>();
  await storeFile(bucket, scope, id, bytes, meta[0]?.type || 'application/octet-stream', { name: meta[0]?.name || id });
  // الحذف بعد نجاح الكتابة في R2 فقط
  await db.prepare(`DELETE FROM ${table} WHERE file_id = ?`).bind(id).run();
  return bytes;
};

/** محتوى الملف من R2 (مع نقل الملفات القديمة عند أول طلب) */
export const loadFile = async (bucket: R2Bucket, db: D1Database, scope: FileScope, id: string): Promise<ReadableStream | Uint8Array<ArrayBuffer> | null> => {
  const obj = await bucket.get(fileKey(scope, id));
  if (obj) return obj.body;
  return migrateOne(bucket, db, scope, id);
};

export const removeFile = async (bucket: R2Bucket, db: D1Database, scope: FileScope, id: string) => {
  await bucket.delete(fileKey(scope, id));
  try { await db.prepare(`DELETE FROM ${LEGACY_CHUNKS[scope]} WHERE file_id = ?`).bind(id).run(); } catch { /* لا جدول قديم */ }
};

/** نقل كل الملفات القديمة المتبقية في D1 إلى R2 */
export const migrateLegacyFiles = async (bucket: R2Bucket, db: D1Database) => {
  let moved = 0;
  let bytes = 0;
  for (const scope of Object.keys(LEGACY_CHUNKS) as FileScope[]) {
    let ids: { file_id: string }[] = [];
    try {
      ({ results: ids } = await db.prepare(`SELECT DISTINCT file_id FROM ${LEGACY_CHUNKS[scope]}`).all<{ file_id: string }>());
    } catch {
      continue;
    }
    for (const { file_id } of ids) {
      const b = await migrateOne(bucket, db, scope, file_id);
      if (b) { moved++; bytes += b.length; }
    }
  }
  return { moved, bytes };
};

/** عدد الملفات القديمة التي لم تُنقل بعد */
export const legacyFileCount = async (db: D1Database) => {
  let n = 0;
  for (const table of Object.values(LEGACY_CHUNKS)) {
    try {
      const { results } = await db.prepare(`SELECT COUNT(DISTINCT file_id) AS n FROM ${table}`).all<{ n: number }>();
      n += results[0]?.n || 0;
    } catch { /* لا جدول */ }
  }
  return n;
};

/** ملفات في R2 بلا سجل في D1 (بقايا رفع فاشل أو حذف ناقص) */
export const findOrphanFiles = async (bucket: R2Bucket, db: D1Database) => {
  const orphans: string[] = [];
  for (const scope of Object.keys(META_TABLE) as FileScope[]) {
    const known = new Set((await db.prepare(`SELECT id FROM ${META_TABLE[scope]}`).all<{ id: string }>().catch(() => ({ results: [] as { id: string }[] }))).results.map(r => r.id));
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix: `${scope}/`, cursor, limit: 1000 });
      // يُستثنى ما رُفع خلال آخر يوم (قد يكون رفعًا جاريًا لم يُسجَّل في D1 بعد)
      for (const o of page.objects) if (!known.has(o.key.slice(scope.length + 1)) && Date.now() - new Date(o.uploaded).getTime() > 86400_000) orphans.push(o.key);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return orphans;
};
