/**
 * خادم حفظ البيانات: يخزّن نسخة من بيانات التطبيق (مفاتيح localStorage) في قاعدة D1
 * حتى لا تضيع عند إغلاق المتصفح أو مسح بياناته، وتظهر نفسها في كل الأجهزة.
 * كل الطلبات محمية بجلسة حساب معتمد (اسم مستخدم + كلمة مرور)، و APP_TOKEN يُستخدم فقط لتفعيل النظام أول مرة.
 */

import { extractSaharaReport } from './extractSaharaReport';
import { audit, handleChat, verifySession, type Session } from './chat';
import { canReadKey, canWriteKey, isServerForbiddenKey, keySectionLabel, levelOf } from '../src/lib/permCatalog';

interface D1Result<T> { results: T[] }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
  exec(query: string): Promise<unknown>;
}

interface Env {
  DB: D1Database;
  APP_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

type StateRow = { key: string; value: string; updated_at: number };

// رؤوس أمان ردود الواجهة البرمجية (الصفحات نفسها تأخذ رؤوسها من public/_headers)
const API_SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...API_SECURITY_HEADERS },
  });

let tableReady = false;
const ensureTable = async (db: D1Database) => {
  if (tableReady) return;
  await db.exec('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  // تنظيف مفاتيح سرّية خاصة بالأجهزة رُفعت قديمًا قبل استثنائها من المزامنة
  const { results } = await db.prepare('SELECT key FROM app_state').all<{ key: string }>();
  const leaked = results.map(r => r.key).filter(isServerForbiddenKey);
  if (leaked.length) await db.batch(leaked.map(k => db.prepare('DELETE FROM app_state WHERE key = ?').bind(k)));
  tableReady = true;
};

const MAX_STATE_BODY = 8 * 1024 * 1024;
const MAX_IMAGE_BODY = 6 * 1024 * 1024;
const forbidden = (error = 'لا تملك صلاحية لهذا القسم') => json({ error, code: 'forbidden' }, 403);
/** طول جسم الطلب المعلن (للرفض المبكر للطلبات الضخمة) */
const tooLarge = (request: Request, max: number) => Number(request.headers.get('content-length') || 0) > max;

/**
 * المرفقات: الملف يُخزَّن في D1 مقسّمًا إلى أجزاء base64 (كل قيمة في D1 حدّها ~2MB)،
 * والبيانات الوصفية في جدول منفصل حتى تكون القائمة خفيفة.
 */
type FileRow = { id: string; record_id: string; name: string; type: string; size: number; created_at: number };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024; // 1MB خام ≈ 1.4MB base64
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

let filesTableReady = false;
const ensureFilesTables = async (db: D1Database) => {
  if (filesTableReady) return;
  await db.exec('CREATE TABLE IF NOT EXISTS sahara_files (id TEXT PRIMARY KEY, record_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)');
  await db.exec('CREATE TABLE IF NOT EXISTS sahara_file_chunks (file_id TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (file_id, idx))');
  filesTableReady = true;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const base64ToBytes = (b64: string) => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

const handleFiles = async (request: Request, url: URL, db: D1Database, session: Session): Promise<Response> => {
  // مرفقات رصيد الصحاري: العرض يتطلب صلاحية عرض، والرفع والحذف يتطلبان صلاحية تعديل
  const level = levelOf(session.perms, session.admin, 'sahara.balance');
  if (level < (request.method === 'GET' ? 1 : 2)) return forbidden();
  await ensureFilesTables(db);
  const id = url.pathname.slice('/api/files/'.length);

  // قائمة كل المرفقات (بدون المحتوى)
  if (!id && request.method === 'GET') {
    const { results } = await db.prepare('SELECT id, record_id, name, type, size, created_at FROM sahara_files ORDER BY created_at').all<FileRow>();
    return json({ items: results });
  }

  // رفع ملف: المحتوى في جسم الطلب، والسجل والاسم في الرابط
  if (!id && request.method === 'POST') {
    const recordId = url.searchParams.get('record') || '';
    const name = (url.searchParams.get('name') || '').slice(0, 200);
    const type = request.headers.get('content-type') || '';
    if (!recordId || !name) return json({ error: 'بيانات الملف ناقصة' }, 400);
    if (!ALLOWED_FILE_TYPES.has(type)) return json({ error: 'يُسمح بملفات PDF و Excel فقط' }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return json({ error: 'الملف فارغ' }, 400);
    if (bytes.length > MAX_FILE_BYTES) return json({ error: 'حجم الملف أكبر من 20MB' }, 413);
    // نفس الملف (نفس الاسم والصيغة) لا يُرفع مرتين لنفس اليوم
    // عند تغيير ملف بآخر بنفس الاسم يُستثنى الملف القديم (replace=رقمه)، ويحذفه التطبيق بعد نجاح الرفع
    const { results: dup } = await db.prepare('SELECT id FROM sahara_files WHERE record_id = ? AND lower(name) = lower(?) AND id != ?')
      .bind(recordId, name, url.searchParams.get('replace') || '').all<{ id: string }>();
    if (dup.length) return json({ error: 'الملف مرفوع مسبقًا لهذا اليوم' }, 409);

    const row: FileRow = { id: crypto.randomUUID(), record_id: recordId, name, type, size: bytes.length, created_at: Date.now() };
    const statements = [
      db.prepare('INSERT INTO sahara_files (id, record_id, name, type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(row.id, row.record_id, row.name, row.type, row.size, row.created_at)
    ];
    for (let i = 0, idx = 0; i < bytes.length; i += CHUNK_BYTES, idx++) {
      statements.push(db.prepare('INSERT INTO sahara_file_chunks (file_id, idx, data) VALUES (?, ?, ?)')
        .bind(row.id, idx, bytesToBase64(bytes.subarray(i, i + CHUNK_BYTES))));
    }
    await db.batch(statements);
    await audit(db, request, session.id, 'file.upload', name);
    return json({ ok: true, item: row });
  }

  if (!id) return json({ error: 'غير موجود' }, 404);

  // تنزيل الملف
  if (request.method === 'GET') {
    const { results: meta } = await db.prepare('SELECT id, record_id, name, type, size, created_at FROM sahara_files WHERE id = ?').bind(id).all<FileRow>();
    if (!meta.length) return json({ error: 'الملف غير موجود' }, 404);
    const { results: chunks } = await db.prepare('SELECT data FROM sahara_file_chunks WHERE file_id = ? ORDER BY idx').bind(id).all<{ data: string }>();
    const parts = chunks.map(c => base64ToBytes(c.data));
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let offset = 0;
    for (const p of parts) { out.set(p, offset); offset += p.length; }
    return new Response(out, {
      headers: {
        'content-type': meta[0].type,
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(meta[0].name)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox"
      }
    });
  }

  // حذف الملف
  if (request.method === 'DELETE') {
    const { results: gone } = await db.prepare('SELECT name FROM sahara_files WHERE id = ?').bind(id).all<{ name: string }>();
    await db.batch([
      db.prepare('DELETE FROM sahara_file_chunks WHERE file_id = ?').bind(id),
      db.prepare('DELETE FROM sahara_files WHERE id = ?').bind(id)
    ]);
    await audit(db, request, session.id, 'file.delete', gone[0]?.name || id);
    return json({ ok: true });
  }

  return json({ error: 'غير موجود' }, 404);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (!env.APP_TOKEN) return json({ error: 'لم يُضبط رمز تفعيل النظام على الخادم (APP_TOKEN)' }, 503);

    // تسجيل الدخول والإعداد الأول متاحان بدون جلسة (الإعداد يتحقق من APP_TOKEN بنفسه)
    if (url.pathname.startsWith('/api/chat/auth/') && ['/api/chat/auth/status', '/api/chat/auth/login', '/api/chat/auth/setup', '/api/chat/auth/support', '/api/chat/auth/webauthn/login-options', '/api/chat/auth/webauthn/login'].includes(url.pathname)) {
      return handleChat(request, url, env.DB, env.APP_TOKEN);
    }

    // كل ما عدا ذلك يتطلب جلسة حساب معتمد (اسم مستخدم + كلمة مرور)
    const session = await verifySession(request, env.DB);
    if (!session) return json({ error: 'انتهت الجلسة، سجّل الدخول مجددًا', code: 'chat_auth' }, 401);

    await ensureTable(env.DB);

    if (url.pathname === '/api/state' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT key, value, updated_at FROM app_state').all<StateRow>();
      // كل حساب يستلم فقط مفاتيح الأقسام المسموح له بعرضها
      const visible = results.filter(r => canReadKey(session.perms, session.admin, r.key));
      return json({
        items: Object.fromEntries(visible.map(r => [r.key, r.value])),
        admin: session.admin,
        readOnly: visible.filter(r => !canWriteKey(session.perms, session.admin, r.key)).map(r => r.key),
      });
    }

    if (url.pathname === '/api/state' && request.method === 'PUT') {
      if (tooLarge(request, MAX_STATE_BODY)) return json({ error: 'حجم البيانات كبير جدًا' }, 413);
      let body: { set?: Record<string, string>; remove?: string[] };
      try {
        body = await request.json();
      } catch {
        return json({ error: 'بيانات غير صالحة' }, 400);
      }
      const now = Date.now();
      const statements: D1PreparedStatement[] = [];
      // المفاتيح التي لا يملك الحساب صلاحية تعديلها تُرفض وتُعاد للتطبيق ليستعيد نسخة الخادم
      const rejected: string[] = [];
      for (const [key, value] of Object.entries(body.set || {})) {
        if (typeof value !== 'string') continue;
        if (!canWriteKey(session.perms, session.admin, key)) { rejected.push(key); continue; }
        statements.push(
          env.DB.prepare(
            'INSERT INTO app_state (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3'
          ).bind(key, value, now)
        );
      }
      for (const key of body.remove || []) {
        if (typeof key !== 'string') continue;
        if (!canWriteKey(session.perms, session.admin, key)) { rejected.push(key); continue; }
        statements.push(env.DB.prepare('DELETE FROM app_state WHERE key = ?1').bind(key));
      }
      if (statements.length) {
        await env.DB.batch(statements);
        // سجل العمليات: الأقسام التي حُفظت (يُدمج الحفظ التلقائي المتكرر في سطر واحد)
        const touched = [...Object.keys(body.set || {}), ...(body.remove || [])].filter(k => typeof k === 'string' && !rejected.includes(k));
        const sections = Array.from(new Set(touched.map(keySectionLabel).filter(l => l !== 'بيانات عامة')));
        if (sections.length) await audit(env.DB, request, session.id, 'data.save', sections.join('، '), { merge: true });
      }
      if (rejected.length) await audit(env.DB, request, session.id, 'data.denied', Array.from(new Set(rejected.map(keySectionLabel))).join('، '), { merge: true });
      return json({ ok: true, saved: statements.length, rejected });
    }

    // المحادثة: الحسابات والغرف والرسائل والمرفقات
    if (url.pathname.startsWith('/api/chat/')) {
      return handleChat(request, url, env.DB, env.APP_TOKEN);
    }

    // مرفقات سجلات رصيد الصحاري (PDF و Excel)
    if (url.pathname === '/api/files' || url.pathname.startsWith('/api/files/')) {
      return handleFiles(request, url, env.DB, session);
    }

    // قراءة صورة الكشف اليومي للصحاري وتعبئة نافذة الإدخال
    if (url.pathname === '/api/extract-sahara-report' && request.method === 'POST') {
      if (levelOf(session.perms, session.admin, 'sahara.balance') < 2) return forbidden();
      if (tooLarge(request, MAX_IMAGE_BODY)) return json({ error: 'حجم الصورة كبير جدًا' }, 413);
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'لم يُضبط مفتاح الذكاء الاصطناعي على الخادم (ANTHROPIC_API_KEY)' }, 503);
      let body: { image?: string; mediaType?: string; stations?: string[] };
      try {
        body = await request.json();
      } catch {
        return json({ error: 'بيانات غير صالحة' }, 400);
      }
      const mediaType = body.mediaType as 'image/jpeg' | 'image/png' | 'image/webp';
      if (!body.image || body.image.length > MAX_IMAGE_BODY || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
        return json({ error: 'الصورة غير صالحة' }, 400);
      }
      try {
        const result = await extractSaharaReport(env.ANTHROPIC_API_KEY, { data: body.image, mediaType }, (body.stations || []).slice(0, 50));
        return json({ ok: true, result });
      } catch (e) {
        console.error('extract-sahara-report failed', e);
        return json({ error: e instanceof Error && /[؀-ۿ]/.test(e.message) ? e.message : 'تعذّر تحليل الصورة، حاول مرة أخرى' }, 502);
      }
    }

    return json({ error: 'غير موجود' }, 404);
  },
};
