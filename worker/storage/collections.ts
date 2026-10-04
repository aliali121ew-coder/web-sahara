/**
 * المجموعات الكبيرة (الواردات، الإشعارات...): سطر لكل عنصر في جدول collection_items بدل نص JSON واحد في app_state.
 * - القراءة: تُجمَّع السطور مرتبة وتُعاد للتطبيق كنص JSON بنفس الشكل السابق (لا تغيير على الواجهة).
 * - الكتابة: التطبيق يرسل الفرق فقط (عناصر جديدة/معدّلة ومحذوفة)، فتندمج تعديلات المستخدمين ولا تمسح بعضها.
 * - الترحيل: مرة واحدة تلقائيًا من app_state، بعد حفظ نسخة من القيمة القديمة في R2 (BACKUPS/migrations/).
 */
import { COLLECTION_KEYS } from '../../src/lib/permCatalog';
import type { D1Database, D1PreparedStatement, R2Bucket } from '../types';
import { gzipJson } from '../system/compress';

export const isCollectionKey = (k: string) => (COLLECTION_KEYS as readonly string[]).includes(k);

const MAX_ITEM_CHARS = 200_000;
const BATCH = 50;

export interface CollectionOps {
  upsert?: { id: string; pos: number; data: string }[];
  remove?: string[];
}

let ready = false;
export const ensureCollections = async (db: D1Database, backups?: R2Bucket) => {
  if (ready) return;
  await db.exec('CREATE TABLE IF NOT EXISTS collection_items (key TEXT NOT NULL, id TEXT NOT NULL, pos REAL NOT NULL DEFAULT 0, data TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL DEFAULT \'\', PRIMARY KEY (key, id))');
  await db.exec('CREATE INDEX IF NOT EXISTS collection_items_order ON collection_items (key, pos, updated_at)');
  await db.exec('CREATE TABLE IF NOT EXISTS system_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  for (const key of COLLECTION_KEYS) await migrateKey(db, key, backups);
  await ensureViews(db);
  ready = true;
};

/**
 * عروض SQL بأعمدة حقيقية فوق collection_items (بدون نسخ البيانات): للتقارير والاستعلام،
 * وأساس جاهز للنقل إلى PostgreSQL لاحقًا (كل عرض يقابل جدولًا مستقبليًا).
 * تُعاد كتابتها عند كل تشغيل حتى تبقى مطابقة لآخر تعريف.
 */
const j = (field: string, as: string, cast?: 'REAL' | 'INTEGER') =>
  cast ? `CAST(json_extract(data, '$.${field}') AS ${cast}) AS ${as}` : `json_extract(data, '$.${field}') AS ${as}`;
const DELIVERY_COLUMNS = [
  'id', j('date', 'date'), j('time', 'time'), j('receiptUnloadDate', 'unload_date'),
  j('supplierCompany', 'supplier_company'), j('supplierName', 'supplier_name'),
  j('driverName', 'driver_name'), j('driverPhone', 'driver_phone'), j('truckNumber', 'truck_number'),
  j('voucherNumber', 'voucher_number'), j('receiptNumber', 'receipt_number'),
  j('stationName', 'station_name'), j('tankCode', 'tank_code'), j('product', 'product'), j('productColor', 'product_color'),
  j('productDensity', 'density', 'REAL'), j('receivedQuantity', 'received_quantity', 'REAL'), j('volumeLiters', 'volume_liters', 'REAL'),
  j('pricePerLiter', 'price_per_liter', 'REAL'), j('productPrice', 'product_price', 'REAL'), j('productCost', 'product_cost', 'REAL'),
  j('totalCostIqd', 'total_cost_iqd', 'REAL'), j('status', 'status'), 'updated_at', 'updated_by',
].join(', ');
const VIEWS: Record<string, string> = {
  v_sahara_inbound_deliveries: `SELECT ${DELIVERY_COLUMNS} FROM collection_items WHERE key = 'sahara_inbound_deliveries'`,
  v_etihad_inbound_deliveries: `SELECT ${DELIVERY_COLUMNS} FROM collection_items WHERE key = 'etihad_inbound_deliveries'`,
  v_notifications: `SELECT id, ${j('title', 'title')}, ${j('message', 'message')}, ${j('timestamp', 'created_at')}, ${j('read', 'is_read', 'INTEGER')}, ${j('type', 'type')}, updated_at FROM collection_items WHERE key = 'sahara_notifications'`,
};
const ensureViews = async (db: D1Database) => {
  for (const [name, sql] of Object.entries(VIEWS)) {
    await db.exec(`DROP VIEW IF EXISTS ${name}`);
    await db.exec(`CREATE VIEW ${name} AS ${sql}`);
  }
};

/** ترحيل مفتاح واحد من app_state إلى جدول المجموعات (مرة واحدة) */
const migrateKey = async (db: D1Database, key: string, backups?: R2Bucket) => {
  const flag = `collection_migrated:${key}`;
  const { results: done } = await db.prepare('SELECT 1 FROM system_meta WHERE key = ?').bind(flag).all();
  if (done.length) return;
  const { results } = await db.prepare('SELECT value FROM app_state WHERE key = ?').bind(key).all<{ value: string }>().catch(() => ({ results: [] as { value: string }[] }));
  const now = Date.now();
  if (results[0]) {
    let items: unknown[] = [];
    try { items = JSON.parse(results[0].value); } catch { /* قيمة تالفة: تُحفظ نسختها فقط */ }
    // نسخة من القيمة الأصلية قبل أي تغيير
    if (backups) await backups.put(`migrations/${new Date(now).toISOString().replace(/[:.]/g, '-')}-${key}.json.gz`, await gzipJson({ key, value: results[0].value }), { httpMetadata: { contentType: 'application/gzip' } });
    if (Array.isArray(items)) {
      const seen = new Set<string>();
      const rows: D1PreparedStatement[] = [];
      items.forEach((item, i) => {
        const id = itemId(item, i);
        if (seen.has(id)) return; // المكرر: يُبقى أول ظهور (الأحدث في القوائم المرتبة من الأحدث)
        seen.add(id);
        rows.push(upsertStmt(db, key, id, i, JSON.stringify(item), now, 'migration'));
      });
      for (let i = 0; i < rows.length; i += BATCH) await db.batch(rows.slice(i, i + BATCH));
    }
    await db.prepare('DELETE FROM app_state WHERE key = ?').bind(key).run();
  }
  await db.prepare('INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)').bind(flag, String(now), now).run();
};

/** معرّف العنصر: حقل id، أو بصمة ثابتة من محتواه إن لم يوجد */
const itemId = (item: unknown, index: number) => {
  const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
  return id !== undefined && id !== null && String(id) ? String(id).slice(0, 200) : `auto-${index}`;
};

const upsertStmt = (db: D1Database, key: string, id: string, pos: number, data: string, now: number, by: string) =>
  db.prepare('INSERT INTO collection_items (key, id, pos, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(key, id) DO UPDATE SET pos = excluded.pos, data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by')
    .bind(key, id, pos, data, now, by);

/** المجموعة كنص JSON مرتب (الأقدم موضعًا أولًا، والأحدث تعديلًا عند تساوي الموضع) */
export const readCollection = async (db: D1Database, key: string) => {
  const { results } = await db.prepare('SELECT data FROM collection_items WHERE key = ? ORDER BY pos, updated_at DESC').bind(key).all<{ data: string }>();
  return `[${results.map(r => r.data).join(',')}]`;
};

/** عدد العناصر لكل مجموعة (للوحة الإدارة) */
export const collectionCounts = async (db: D1Database) => {
  const { results } = await db.prepare('SELECT key, COUNT(*) AS n FROM collection_items GROUP BY key').all<{ key: string; n: number }>();
  return Object.fromEntries(results.map(r => [r.key, r.n]));
};

/** تطبيق الفرق المرسل من التطبيق. يعيد عدد العمليات أو رسالة خطأ */
export const applyCollectionOps = async (db: D1Database, key: string, ops: CollectionOps, userId: string, now: number): Promise<number | string> => {
  const stmts: D1PreparedStatement[] = [];
  for (const u of Array.isArray(ops.upsert) ? ops.upsert : []) {
    if (!u || typeof u.id !== 'string' || !u.id || u.id.length > 200 || typeof u.data !== 'string' || u.data.length > MAX_ITEM_CHARS) return 'عنصر غير صالح';
    try { if (typeof JSON.parse(u.data) !== 'object') return 'عنصر غير صالح'; } catch { return 'عنصر غير صالح'; }
    stmts.push(upsertStmt(db, key, u.id, Number.isFinite(u.pos) ? u.pos : 0, u.data, now, userId));
  }
  for (const id of Array.isArray(ops.remove) ? ops.remove : []) {
    if (typeof id !== 'string') continue;
    stmts.push(db.prepare('DELETE FROM collection_items WHERE key = ? AND id = ?').bind(key, id));
  }
  for (let i = 0; i < stmts.length; i += BATCH) await db.batch(stmts.slice(i, i + BATCH));
  return stmts.length;
};

/** استبدال المجموعة كاملة (للتوافق مع نسخ قديمة من التطبيق ترسل القيمة كاملة) */
export const replaceCollection = async (db: D1Database, key: string, value: string, userId: string, now: number): Promise<number | string> => {
  let items: unknown;
  try { items = JSON.parse(value); } catch { return 'بيانات غير صالحة'; }
  if (!Array.isArray(items)) return 'بيانات غير صالحة';
  const seen = new Set<string>();
  const upsert: { id: string; pos: number; data: string }[] = [];
  items.forEach((item, i) => {
    const id = itemId(item, i);
    if (seen.has(id)) return;
    seen.add(id);
    upsert.push({ id, pos: i, data: JSON.stringify(item) });
  });
  const { results } = await db.prepare('SELECT id FROM collection_items WHERE key = ?').bind(key).all<{ id: string }>();
  const remove = results.map(r => r.id).filter(id => !seen.has(id));
  return applyCollectionOps(db, key, { upsert, remove }, userId, now);
};

export const clearCollection = (db: D1Database, key: string) => db.prepare('DELETE FROM collection_items WHERE key = ?').bind(key).run();
