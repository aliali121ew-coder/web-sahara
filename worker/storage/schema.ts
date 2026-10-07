/**
 * بوابة إصدار المخطط: تهيئة الجداول (CREATE/ALTER/INDEX) كانت تُنفَّذ عند كل تشغيل بارد للـ Worker،
 * وكل أمر رحلة مستقلة إلى D1 (~40 أمرًا = 6–10 ثوانٍ قبل أول رد، خصوصًا شاشة الدخول).
 * الآن يُحفظ إصدار كل مجموعة جداول في system_meta (schema:<name>)، والتهيئة لا تُعاد إلا إذا تغيّر الإصدار في الكود.
 *
 * مهم: لا تُشارَك وعود (Promise) قيد التنفيذ بين الطلبات. في Workers تُلغى عمليات الطلب عند انتهائه أو قطعه،
 * فيبقى الوعد المشترك معلّقًا للأبد وتعلق كل الطلبات التالية في نفس النسخة (هذا ما أوقف الدخول بعد النشر).
 * لذلك يُخزَّن بين الطلبات فقط ما اكتمل فعلًا: خريطة الإصدارات وأسماء البوابات المنتهية.
 *
 * عند إضافة جدول أو عمود أو فهرس أو تعديل عرض: زِد رقم الإصدار في نفس المكان الذي تُعدَّل فيه التهيئة.
 */
import type { D1Database } from '../types';

const META_DDL = 'CREATE TABLE IF NOT EXISTS system_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)';

/** الإصدارات المسجّلة في القاعدة (بيانات مكتملة فقط، لا وعود) */
let versions: Map<string, string> | null = null;
const done = new Set<string>();

const loadVersions = async (db: D1Database) => {
  try {
    const { results } = await db.prepare("SELECT key, value FROM system_meta WHERE key LIKE 'schema:%'").all<{ key: string; value: string }>();
    return new Map(results.map(x => [x.key, x.value]));
  } catch {
    // قاعدة جديدة بلا system_meta: كل البوابات تُهيّئ
    return new Map<string, string>();
  }
};

/** ينفّذ setup مرة واحدة لكل إصدار. كل طلب ينفّذ فحصه بنفسه (لا انتظار لعمل طلب آخر) */
export const schemaGate = async (db: D1Database, name: string, version: string, setup: () => Promise<void>): Promise<void> => {
  const key = `schema:${name}`;
  if (done.has(key)) return;
  versions ??= await loadVersions(db);
  if (versions.get(key) !== version) {
    // التهيئة كلها IF NOT EXISTS / محاطة بـ try، فتنفيذها مرتين من طلبين متزامنين آمن
    await setup();
    await db.exec(META_DDL);
    await db.prepare('INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)').bind(key, version, Date.now()).run();
    versions.set(key, version);
  }
  done.add(key);
};
