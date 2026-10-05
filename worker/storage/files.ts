/**
 * تخزين الملفات في R2 (حاوية FILES): المحتوى في R2 والبيانات الوصفية في D1.
 * الملفات القديمة كانت تُحفظ داخل D1 كأجزاء base64؛ تُنقل إلى R2 تلقائيًا عند أول قراءة،
 * أو كلها مرة واحدة من لوحة إدارة النظام (migrateLegacyFiles).
 */
import { codedError } from '../errors';
import type { D1Database, R2Bucket } from '../types';
import { sha256Hex } from '../system/compress';

export type FileScope = 'sahara' | 'chat';
const LEGACY_CHUNKS: Record<FileScope, string> = { sahara: 'sahara_file_chunks', chat: 'chat_file_chunks' };
const META_TABLE: Record<FileScope, string> = { sahara: 'sahara_files', chat: 'chat_files' };

export const fileKey = (scope: FileScope, id: string) => `${scope}/${id}`;
const TRASH = 'trash/';
const TRASH_KEEP_MS = 30 * 86400_000;

// القيم في البيانات الوصفية لـ R2 نص ASCII: الأسماء العربية تُرمَّز
const encodeMeta = (meta: Record<string, string>) => Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, encodeURIComponent(v)]));
const decodeMeta = (meta: Record<string, string> = {}) => Object.fromEntries(Object.entries(meta).map(([k, v]) => { try { return [k, decodeURIComponent(v)]; } catch { return [k, v]; } }));

/** عمود البصمة في جداول الملفات (يُضاف مرة واحدة) */
let shaReady = false;
export const ensureFileColumns = async (db: D1Database) => {
  if (shaReady) return;
  for (const t of Object.values(META_TABLE)) {
    try { await db.exec(`ALTER TABLE ${t} ADD COLUMN sha256 TEXT NOT NULL DEFAULT ''`); } catch { /* موجود أو الجدول غير مُنشأ بعد */ }
  }
  shaReady = true;
};

/** حفظ الملف في R2 مع بصمة SHA-256 لمحتواه. يعيد البصمة لتُسجَّل في D1 */
export const storeFile = async (bucket: R2Bucket, scope: FileScope, id: string, bytes: Uint8Array<ArrayBuffer>, contentType: string, meta: Record<string, string> = {}) => {
  const sha256 = await sha256Hex(bytes);
  await bucket.put(fileKey(scope, id), bytes, { httpMetadata: { contentType }, customMetadata: encodeMeta({ ...meta, sha256 }) });
  return sha256;
};

/** تسجيل البصمة في جدول البيانات الوصفية */
export const recordSha = async (db: D1Database, scope: FileScope, id: string, sha256: string) => {
  await ensureFileColumns(db);
  await db.prepare(`UPDATE ${META_TABLE[scope]} SET sha256 = ? WHERE id = ?`).bind(sha256, id).run();
};

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
  const sha = await storeFile(bucket, scope, id, bytes, meta[0]?.type || 'application/octet-stream', { name: meta[0]?.name || id });
  await recordSha(db, scope, id, sha);
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

/**
 * الحذف لا يكون نهائيًا: الملف يُنقل إلى سلة المحذوفات (trash/<scope>/<id>) مع بياناته الوصفية،
 * ويمكن استرجاعه خلال 30 يومًا، ثم تحذفه الصيانة الشهرية نهائيًا.
 */
export const removeFile = async (bucket: R2Bucket, db: D1Database, scope: FileScope, id: string, info: { by: string; name?: string; record?: string; type?: string; createdAt?: number } = { by: '' }) => {
  const obj = await bucket.get(fileKey(scope, id));
  if (obj) {
    const prev = decodeMeta(obj.customMetadata);
    await bucket.put(`${TRASH}${scope}/${id}`, await obj.arrayBuffer(), {
      httpMetadata: { contentType: obj.httpMetadata?.contentType || info.type || 'application/octet-stream' },
      customMetadata: encodeMeta({
        ...prev, name: info.name || prev.name || id, record: info.record || prev.record || '', type: info.type || obj.httpMetadata?.contentType || '',
        createdAt: String(info.createdAt || ''), deletedBy: info.by, deletedAt: String(Date.now()),
      }),
    });
    await bucket.delete(fileKey(scope, id));
  }
  try { await db.prepare(`DELETE FROM ${LEGACY_CHUNKS[scope]} WHERE file_id = ?`).bind(id).run(); } catch { /* لا جدول قديم */ }
};

export interface TrashItem { key: string; scope: FileScope; id: string; size: number; name: string; record: string; type: string; deletedBy: string; deletedAt: number; sha256: string }

/** محتويات سلة المحذوفات (الأحدث أولًا) */
export const listTrash = async (bucket: R2Bucket): Promise<TrashItem[]> => {
  const items: TrashItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: TRASH, cursor, limit: 1000 });
    for (const o of page.objects) {
      const [, scope, id] = o.key.split('/');
      // list لا يعيد البيانات الوصفية المخصصة دائمًا، فتُقرأ برأس الكائن
      const head = await bucket.head(o.key);
      const m = decodeMeta(head?.customMetadata);
      items.push({ key: o.key, scope: scope as FileScope, id, size: o.size, name: m.name || id, record: m.record || '', type: m.type || '', deletedBy: m.deletedBy || '', deletedAt: Number(m.deletedAt) || new Date(o.uploaded).getTime(), sha256: m.sha256 || '' });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return items.sort((a, b) => b.deletedAt - a.deletedAt);
};

/** استرجاع مرفق صحاري من السلة: يعود الملف وسطره في sahara_files */
export const restoreFromTrash = async (bucket: R2Bucket, db: D1Database, key: string) => {
  const m = key.match(/^trash\/sahara\/([^/]+)$/);
  if (!m) throw codedError('يمكن استرجاع مرفقات رصيد الصحاري فقط (مرفقات المحادثة تُحذف مع رسالتها)', 'restore_sahara_only');
  const obj = await bucket.get(key);
  if (!obj) throw codedError('الملف غير موجود في السلة', 'trash_not_found');
  const meta = decodeMeta(obj.customMetadata);
  if (!meta.record) throw codedError('لا يُعرف السجل الذي يتبع له الملف', 'trash_record_unknown');
  const bytes = new Uint8Array(await obj.arrayBuffer());
  const type = obj.httpMetadata?.contentType || meta.type || 'application/octet-stream';
  const sha = await storeFile(bucket, 'sahara', m[1], bytes, type, { name: meta.name || m[1], record: meta.record });
  await ensureFileColumns(db);
  await db.prepare('INSERT OR REPLACE INTO sahara_files (id, record_id, name, type, size, created_at, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(m[1], meta.record, meta.name || m[1], type, bytes.length, Number(meta.createdAt) || Date.now(), sha).run();
  await bucket.delete(key);
  return { id: m[1], name: meta.name || m[1] };
};

/** حذف نهائي من السلة: عنصر واحد، أو كل ما مضى عليه أكثر من 30 يومًا */
export const purgeTrash = async (bucket: R2Bucket, key?: string) => {
  if (key) {
    if (!key.startsWith(TRASH)) throw codedError('مسار غير صالح', 'invalid_path');
    await bucket.delete(key);
    return 1;
  }
  const old = (await listTrash(bucket)).filter(i => Date.now() - i.deletedAt > TRASH_KEEP_MS).map(i => i.key);
  for (let i = 0; i < old.length; i += 1000) await bucket.delete(old.slice(i, i + 1000));
  return old.length;
};

/**
 * فحص سلامة كل الملفات: يعيد حساب SHA-256 من R2 ويقارنها بالمسجّلة في D1.
 * الملفات بلا بصمة (رُفعت قبل هذه الميزة) تُحسب بصمتها وتُسجَّل.
 */
export const verifyFiles = async (bucket: R2Bucket, db: D1Database) => {
  await ensureFileColumns(db);
  const out = { checked: 0, ok: 0, backfilled: 0, missing: [] as string[], corrupt: [] as string[] };
  for (const scope of Object.keys(META_TABLE) as FileScope[]) {
    const { results } = await db.prepare(`SELECT id, name, sha256 FROM ${META_TABLE[scope]}`).all<{ id: string; name: string; sha256: string }>().catch(() => ({ results: [] as { id: string; name: string; sha256: string }[] }));
    for (const row of results) {
      out.checked++;
      let obj = await bucket.get(fileKey(scope, row.id));
      if (!obj && (await migrateOne(bucket, db, scope, row.id))) obj = await bucket.get(fileKey(scope, row.id));
      if (!obj) { out.missing.push(`${scope}/${row.id} (${row.name})`); continue; }
      const sha = await sha256Hex(new Uint8Array(await obj.arrayBuffer()));
      if (!row.sha256) { await recordSha(db, scope, row.id, sha); out.backfilled++; continue; }
      if (sha === row.sha256) out.ok++;
      else out.corrupt.push(`${scope}/${row.id} (${row.name})`);
    }
  }
  return out;
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
