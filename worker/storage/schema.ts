/**
 * بوابة إصدار المخطط: تهيئة الجداول (CREATE/ALTER/INDEX) كانت تُنفَّذ عند كل تشغيل بارد للـ Worker،
 * وكل أمر رحلة مستقلة إلى D1 (~40 أمرًا = 6–10 ثوانٍ قبل أول رد، خصوصًا شاشة الدخول).
 * الآن يُحفظ إصدار كل مجموعة جداول في system_meta (schema:<name>)، وعند التشغيل البارد
 * يُقرأ الكل باستعلام واحد؛ التهيئة لا تُعاد إلا إذا تغيّر الإصدار في الكود.
 *
 * عند إضافة جدول أو عمود أو فهرس أو تعديل عرض: زِد رقم الإصدار في نفس المكان الذي تُعدَّل فيه التهيئة.
 */
import type { D1Database } from '../types';

const META_DDL = 'CREATE TABLE IF NOT EXISTS system_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)';

/** الإصدارات المسجّلة في القاعدة: تُقرأ مرة واحدة لكل نسخة Worker */
let stored: Promise<Map<string, string>> | null = null;
const loadStored = (db: D1Database) => {
  stored ??= db.prepare("SELECT key, value FROM system_meta WHERE key LIKE 'schema:%'").all<{ key: string; value: string }>()
    .then(r => new Map(r.results.map(x => [x.key, x.value])))
    // قاعدة جديدة بلا system_meta: كل البوابات تُهيّئ
    .catch(() => new Map<string, string>());
  return stored;
};

const done = new Set<string>();
const running = new Map<string, Promise<void>>();

/** ينفّذ setup مرة واحدة لكل إصدار (وطلبات التشغيل البارد المتزامنة تنتظر نفس التنفيذ) */
export const schemaGate = (db: D1Database, name: string, version: string, setup: () => Promise<void>): Promise<void> => {
  const key = `schema:${name}`;
  if (done.has(key)) return Promise.resolve();
  let p = running.get(key);
  if (!p) {
    p = (async () => {
      const versions = await loadStored(db);
      if (versions.get(key) !== version) {
        await setup();
        await db.exec(META_DDL);
        await db.prepare('INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)').bind(key, version, Date.now()).run();
        versions.set(key, version);
      }
      done.add(key);
    })().finally(() => running.delete(key));
    running.set(key, p);
  }
  return p;
};
