import type { D1Database } from '../types';

/**
 * رقم نسخة البيانات (system_meta): يتغيّر مع كل تغيير في app_state أو collection_items.
 * بصمة المزامنة (ETag) تُبنى منه وحده بسطر واحد. كانت تعدّ الجدولين كاملين (COUNT/MAX) عند كل فحص من كل جهاز،
 * وD1 يحتسب كل سطر يمرّ عليه، فتجاوزت القراءة الحد اليومي (5 ملايين) وتوقف الاتصال.
 * لذلك أي كتابة على الجدولين خارج حفظ التطبيق (الاسترجاع، الأرشفة، التنظيف) يجب أن ترفعه.
 */
export const STATE_VERSION_KEY = 'state_version';

export const bumpStateVersion = (db: D1Database, tag: string) => {
  const now = Date.now();
  return db.prepare('INSERT INTO system_meta (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3')
    .bind(STATE_VERSION_KEY, `${now}-${tag}`, now).run();
};

export const readStateVersion = async (db: D1Database) => {
  const { results } = await db.prepare('SELECT value FROM system_meta WHERE key = ?').bind(STATE_VERSION_KEY).all<{ value: string }>();
  return results[0]?.value || '0';
};
