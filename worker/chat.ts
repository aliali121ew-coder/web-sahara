/**
 * خادم المحادثة: حسابات، غرف (مباشرة ومجموعات)، رسائل، تفاعلات، إيصالات قراءة، مؤشر الكتابة، ومرفقات.
 * التحديث الفوري يتم عبر مزامنة تزايدية (/api/chat/sync?since=) يستدعيها التطبيق كل ثانية تقريبًا.
 * كل الطلبات تمر أولًا بفحص رمز الدخول في worker/index.ts.
 *
 * هوية المستخدم: لكل حساب مفتاح سرّي يُولَّد عند إنشائه ويُحفظ على الخادم كبصمة SHA-256 فقط.
 * يرسل التطبيق (x-chat-user + x-chat-key) مع كل طلب، والخادم يأخذ هوية "me" منهما حصرًا
 * ويتجاهل أي me في الجسم أو الرابط؛ فلا يمكن لأحد الإرسال أو القراءة باسم غيره.
 */

import { checkPublicKey, parseClientData, randomChallenge, verifyAssertion } from './webauthn';
import { ensureFileColumns, loadFile, removeFile, storeFile } from './storage/files';
import type { D1Database, D1PreparedStatement, R2Bucket } from './types';
import { levelOf, parsePerms, sanitizePerms, type Perms } from '../src/lib/permCatalog';

export type ChatDB = D1Database;

type UserRow = { id: string; name: string; role: string; bio: string; avatar: string; color: string; last_seen: number; typing_room: string; typing_at: number; updated_at: number };
type RoomRow = { id: string; type: string; name: string; description: string; avatar: string; created_by: string; created_at: number; updated_at: number; pinned_msg: string };
type MemberRow = { room_id: string; user_id: string; role: string; last_read: number; muted: number; pinned: number; joined_at: number };
type MessageRow = { id: string; room_id: string; user_id: string; kind: string; text: string; reply_to: string; attachments: string; reactions: string; urgent: number; edited: number; deleted: number; created_at: number; updated_at: number };
type FileRow = { id: string; name: string; type: string; size: number; created_at: number };

const GENERAL_ROOM = 'general';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_AVATAR_CHARS = 400_000;
/** الحذف للجميع مسموح خلال ساعة من الإرسال */
const DELETE_WINDOW_MS = 60 * 60_000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const uid = () => crypto.randomUUID();

let ready = false;
const ensureTables = async (db: ChatDB) => {
  if (ready) return;
  await db.exec("CREATE TABLE IF NOT EXISTS chat_users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '', last_seen INTEGER NOT NULL DEFAULT 0, typing_room TEXT NOT NULL DEFAULT '', typing_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)");
  await db.exec("CREATE TABLE IF NOT EXISTS chat_rooms (id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
  await db.exec("CREATE TABLE IF NOT EXISTS chat_members (room_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', last_read INTEGER NOT NULL DEFAULT 0, muted INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0, joined_at INTEGER NOT NULL, PRIMARY KEY (room_id, user_id))");
  await db.exec("CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', reply_to TEXT NOT NULL DEFAULT '', attachments TEXT NOT NULL DEFAULT '[]', reactions TEXT NOT NULL DEFAULT '{}', urgent INTEGER NOT NULL DEFAULT 0, edited INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
  await db.exec('CREATE INDEX IF NOT EXISTS chat_messages_updated ON chat_messages (updated_at)');
  await db.exec('CREATE INDEX IF NOT EXISTS chat_messages_room ON chat_messages (room_id, created_at)');
  await db.exec('CREATE INDEX IF NOT EXISTS chat_members_user ON chat_members (user_id)');
  await db.exec('CREATE TABLE IF NOT EXISTS chat_files (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)');
  await db.exec('CREATE TABLE IF NOT EXISTS chat_file_chunks (file_id TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (file_id, idx))');
  // من شاهد كل رسالة ومتى (لنافذة معلومات الرسالة)
  await db.exec('CREATE TABLE IF NOT EXISTS chat_seen (message_id TEXT NOT NULL, user_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (message_id, user_id))');
  // الرسالة المثبّتة في الغرفة (عمود أُضيف لاحقًا)
  try { await db.exec("ALTER TABLE chat_rooms ADD COLUMN pinned_msg TEXT NOT NULL DEFAULT ''"); } catch { /* موجود */ }
  // بصمة مفتاح الحساب (فارغة = حساب قديم لم يُطالَب به بعد)
  try { await db.exec("ALTER TABLE chat_users ADD COLUMN key_hash TEXT NOT NULL DEFAULT ''"); } catch { /* موجود */ }
  try { await db.exec("ALTER TABLE chat_files ADD COLUMN owner TEXT NOT NULL DEFAULT ''"); } catch { /* موجود */ }
  // حسابات المصادقة: اسم مستخدم + كلمة مرور يُنشئها مدير النظام فقط
  for (const col of [
    "username TEXT NOT NULL DEFAULT ''", "pass_hash TEXT NOT NULL DEFAULT ''", 'is_admin INTEGER NOT NULL DEFAULT 0',
    'disabled INTEGER NOT NULL DEFAULT 0', 'fail_count INTEGER NOT NULL DEFAULT 0', 'lock_until INTEGER NOT NULL DEFAULT 0',
    // صلاحيات الأقسام (JSON) يحددها مدير النظام — راجع src/lib/permCatalog.ts
    "perms TEXT NOT NULL DEFAULT '{}'",
  ]) {
    try { await db.exec(`ALTER TABLE chat_users ADD COLUMN ${col}`); } catch { /* موجود */ }
  }
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS chat_users_username ON chat_users (username) WHERE username != ''");
  // جلسة لكل جهاز: يُحفظ على الخادم بصمة الرمز فقط
  await db.exec('CREATE TABLE IF NOT EXISTS chat_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, last_used INTEGER NOT NULL)');
  await db.exec('CREATE INDEX IF NOT EXISTS chat_sessions_user ON chat_sessions (user_id)');
  // مفاتيح الدخول بالبصمة / بصمة الوجه (المفتاح العام فقط) والتحديات المؤقتة
  await db.exec("CREATE TABLE IF NOT EXISTS webauthn_credentials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, public_key TEXT NOT NULL, alg INTEGER NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0, label TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, last_used INTEGER NOT NULL DEFAULT 0)");
  await db.exec('CREATE INDEX IF NOT EXISTS webauthn_credentials_user ON webauthn_credentials (user_id)');
  await db.exec("CREATE TABLE IF NOT EXISTS webauthn_challenges (challenge TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, expires_at INTEGER NOT NULL)");
  // طلبات الدعم من شاشة الدخول (حساب جديد / نسيت كلمة المرور) تصل لمدير النظام
  await db.exec("CREATE TABLE IF NOT EXISTS support_requests (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', username TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL)");
  // سجل عمليات المستخدمين (دخول، إدارة حسابات، حفظ بيانات الأقسام...) يطّلع عليه مدير النظام
  await db.exec("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, user_id TEXT NOT NULL DEFAULT '', username TEXT NOT NULL DEFAULT '', action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '')");
  await db.exec('CREATE INDEX IF NOT EXISTS audit_log_at ON audit_log (at)');
  await db.exec('CREATE INDEX IF NOT EXISTS audit_log_user ON audit_log (user_id, at)');
  await db.exec('CREATE INDEX IF NOT EXISTS audit_log_ip ON audit_log (ip, at)');
  const now = Date.now();
  await db.prepare("INSERT OR IGNORE INTO chat_rooms (id, type, name, description, avatar, created_by, created_at, updated_at) VALUES (?1, 'group', ?2, ?3, '', '', ?4, ?4)")
    .bind(GENERAL_ROOM, 'غرفة العمليات العامة', 'القناة الرئيسية لكل فريق الموقع', now).run();
  ready = true;
};

const parseMessage = (m: MessageRow) => ({
  ...m,
  attachments: JSON.parse(m.attachments || '[]'),
  reactions: JSON.parse(m.reactions || '{}'),
});

// ───── سجل العمليات ─────
// السجل الأقدم من 180 يومًا يُنقل إلى الأرشيف الشهري في R2 (worker/system/maintenance.ts)
const AUDIT_MERGE_MS = 10 * 60_000; // حفظ البيانات المتكرر من نفس الحساب يُدمج في سطر واحد كل 10 دقائق

/** تسجيل عملية. merge: يدمج تفاصيل (قائمة مفصولة بفاصلة) مع آخر سطر لنفس الحساب والعملية خلال 10 دقائق */
export const audit = async (db: ChatDB, request: Request, userId: string, action: string, detail = '', opts: { username?: string; merge?: boolean } = {}) => {
  try {
    await ensureTables(db);
    const now = Date.now();
    const ip = (request.headers.get('cf-connecting-ip') || '').slice(0, 64);
    let username = opts.username || '';
    if (!username && userId) {
      const { results } = await db.prepare('SELECT username FROM chat_users WHERE id = ?').bind(userId).all<{ username: string }>();
      username = results[0]?.username || '';
    }
    if (opts.merge && userId) {
      const { results } = await db.prepare('SELECT id, detail FROM audit_log WHERE user_id = ? AND action = ? AND at > ? ORDER BY at DESC LIMIT 1')
        .bind(userId, action, now - AUDIT_MERGE_MS).all<{ id: number; detail: string }>();
      if (results[0]) {
        const merged = Array.from(new Set([...results[0].detail.split('، '), ...detail.split('، ')].filter(Boolean))).join('، ').slice(0, 1000);
        await db.prepare('UPDATE audit_log SET detail = ?, at = ?, ip = ? WHERE id = ?').bind(merged, now, ip, results[0].id).run();
        return;
      }
    }
    await db.prepare('INSERT INTO audit_log (at, user_id, username, action, detail, ip) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(now, userId, username, action, detail.slice(0, 1000), ip).run();
  } catch {
    /* السجل لا يجب أن يُفشل العملية الأصلية */
  }
};

// ───── حد محاولات الدخول لكل جهاز (عنوان IP) ─────
// يكمّل القفل الحالي لكل حساب: يمنع تجربة كلمات مرور على حسابات كثيرة من نفس الجهاز
const IP_WINDOW_MS = 15 * 60_000;
const IP_MAX_FAILS = 20;
const ipBlocked = async (db: ChatDB, request: Request) => {
  const ip = (request.headers.get('cf-connecting-ip') || '').slice(0, 64);
  if (!ip) return false;
  const { results } = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE ip = ? AND action IN ('auth.failed', 'auth.locked') AND at > ?")
    .bind(ip, Date.now() - IP_WINDOW_MS).all<{ n: number }>();
  return (results[0]?.n || 0) >= IP_MAX_FAILS;
};
const ipBlockedResponse = () =>
  json({ error: 'محاولات دخول خاطئة كثيرة من هذا الجهاز. حاول مجددًا بعد 15 دقيقة', code: 'ip_locked', retryAt: Date.now() + IP_WINDOW_MS }, 429);

const isMember = async (db: ChatDB, room: string, user: string) => {
  const { results } = await db.prepare('SELECT user_id FROM chat_members WHERE room_id = ? AND user_id = ?').bind(room, user).all();
  return results.length > 0;
};

const systemMessage = (db: ChatDB, room: string, user: string, text: string, now: number) =>
  db.prepare("INSERT INTO chat_messages (id, room_id, user_id, kind, text, created_at, updated_at) VALUES (?, ?, ?, 'system', ?, ?, ?)")
    .bind(uid(), room, user, text, now, now);

const touchRoom = (db: ChatDB, room: string, now: number) =>
  db.prepare('UPDATE chat_rooms SET updated_at = ? WHERE id = ?').bind(now, room);

// ───── مفاتيح الحسابات ─────
const newKey = () => {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const hashKey = async (key: string) => {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sahara-chat:' + key)));
  return Array.from(d, x => x.toString(16).padStart(2, '0')).join('');
};
/** مقارنة بزمن ثابت */
const sameHash = (a: string, b: string) => {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
// ───── كلمات المرور (PBKDF2-SHA256 بملح عشوائي) ─────
const PBKDF2_ITER = 100_000; // الحد الأعلى المسموح في Workers
const toHex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string): Uint8Array<ArrayBuffer> => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
const pbkdf2 = async (password: string, salt: Uint8Array<ArrayBuffer>, iter: number) => {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256));
};
const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${toHex(salt)}$${await pbkdf2(password, salt, PBKDF2_ITER)}`;
};
// بصمة وهمية: تُحسب عند اسم مستخدم غير موجود حتى لا يكشف زمن الرد وجود الحساب
const DUMMY_HASH = `pbkdf2$${PBKDF2_ITER}$00000000000000000000000000000000$${'0'.repeat(64)}`;
const verifyPassword = async (password: string, stored: string) => {
  const [algo, iter, salt, hash] = (stored || DUMMY_HASH).split('$');
  if (algo !== 'pbkdf2' || !hash) return false;
  return sameHash(hash, await pbkdf2(password, fromHex(salt), Number(iter))) && !!stored;
};

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD = 8;
/** الحد الأقصى لحسابات المصادقة */
const MAX_ACCOUNTS = 100;
const MAX_FAILS = 5;
/** مدة الجلسة القصوى: يُطلب تسجيل الدخول من جديد كل 24 ساعة */
const SESSION_MAX_MS = 24 * 3600_000;
const LOCK_MS = 5 * 60_000;
const normUser = (v: unknown) => str(v, 40).trim().toLowerCase();
/** صورة شخصية: data URL لصورة PNG/JPEG/WebP فقط وضمن الحجم المسموح، وإلا تُرفض ('' = بلا صورة) */
const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const avatarValue = (v: unknown): string | null => {
  if (v === '') return '';
  return typeof v === 'string' && v.length <= MAX_AVATAR_CHARS && AVATAR_RE.test(v) ? v : null;
};
const passwordError = (p: string) => (p.length < MIN_PASSWORD ? `كلمة المرور يجب أن تكون ${MIN_PASSWORD} أحرف على الأقل` : p.length > 128 ? 'كلمة المرور طويلة جدًا' : '');

type AccountRow = { id: string; username: string; name: string; role: string; avatar: string; color: string; is_admin: number; disabled: number; last_seen: number; updated_at: number; perms: string };
const ACCOUNT_COLS = 'id, username, name, role, avatar, color, is_admin, disabled, last_seen, updated_at, perms';
const withPerms = (a: AccountRow | undefined) => a && { ...a, perms: parsePerms(a.perms) };

/** جلسة جديدة لهذا الجهاز: الرمز يُعاد للعميل مرة واحدة ويُحفظ على الخادم كبصمة */
const newSession = async (db: ChatDB, userId: string, now: number) => {
  const key = newKey();
  await db.prepare('INSERT INTO chat_sessions (token_hash, user_id, created_at, last_used) VALUES (?, ?, ?, ?)').bind(await hashKey(key), userId, now, now).run();
  return key;
};

const authUser = async (request: Request, db: ChatDB) => {
  const id = str(request.headers.get('x-chat-user'), 64);
  const key = str(request.headers.get('x-chat-key'), 128);
  if (!id || !key) return null;
  const { results } = await db.prepare(
    `SELECT u.id, u.is_admin, u.perms, s.token_hash, s.created_at, s.last_used FROM chat_sessions s JOIN chat_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND u.disabled = 0 AND u.pass_hash != ''`,
  ).bind(await hashKey(key)).all<{ id: string; is_admin: number; perms: string; token_hash: string; created_at: number; last_used: number }>();
  const s = results[0];
  if (!s || s.id !== id) return null;
  if (Date.now() - s.created_at > SESSION_MAX_MS) {
    await db.prepare('DELETE FROM chat_sessions WHERE token_hash = ?').bind(s.token_hash).run();
    return null;
  }
  // تحديث آخر استخدام للجلسة مرة كل ساعة على الأكثر
  if (Date.now() - s.last_used > 3600_000) await db.prepare('UPDATE chat_sessions SET last_used = ? WHERE token_hash = ?').bind(Date.now(), s.token_hash).run();
  return { id: s.id, admin: !!s.is_admin, perms: parsePerms(s.perms) as Perms, tokenHash: s.token_hash };
};
export type Session = NonNullable<Awaited<ReturnType<typeof authUser>>>;
/** التحقق من جلسة حساب (يستخدمه worker/index.ts لحماية كل واجهات البرنامج) */
export const verifySession = async (request: Request, db: ChatDB) => {
  await ensureTables(db);
  return authUser(request, db);
};

const unauthorized = () => json({ error: 'انتهت جلسة حساب المحادثة، سجّل الدخول مجددًا', code: 'chat_auth' }, 401);

const readBody = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

export async function handleChat(request: Request, url: URL, db: ChatDB, appToken = '', files?: R2Bucket): Promise<Response> {
  await ensureTables(db);
  const path = url.pathname.slice('/api/chat'.length) || '/';
  const method = request.method;
  const now = Date.now();
  const session = await authUser(request, db);
  const authId = session?.id || '';
  /** قراءة الجسم مع فرض هوية المرسل الموثّقة بدل أي me مرسل من العميل */
  const body = async <T>(r: Request): Promise<T | null> => {
    const b = await readBody<T>(r);
    if (b && typeof b === 'object') (b as { me?: string }).me = authId;
    return b;
  };
  const accountCount = async () => {
    const { results } = await db.prepare("SELECT COUNT(*) AS n FROM chat_users WHERE pass_hash != ''").all<{ n: number }>();
    return results[0]?.n || 0;
  };

  // ───── المصادقة (بدون جلسة) ─────
  // هل النظام بحاجة لإنشاء حساب المدير الأول؟
  if (path === '/auth/status' && method === 'GET') {
    return json({ setup: (await accountCount()) === 0 });
  }

  // إنشاء حساب المدير الأول — يعمل مرة واحدة فقط ما دام لا يوجد أي حساب
  if (path === '/auth/setup' && method === 'POST') {
    if ((await accountCount()) > 0) return json({ error: 'تم إعداد النظام مسبقًا' }, 403);
    // الإعداد الأول يتطلب رمز تفعيل النظام (APP_TOKEN) حتى لا يستولي أحد على حساب المدير
    if (!appToken || !sameHash(appToken, str(request.headers.get('x-app-token'), 200))) return json({ error: 'رمز تفعيل النظام غير صحيح' }, 401);
    const b = await readBody<{ username?: string; password?: string; name?: string }>(request);
    const username = normUser(b?.username);
    const password = str(b?.password, 200);
    const name = str(b?.name, 60).trim();
    if (!USERNAME_RE.test(username)) return json({ error: 'اسم المستخدم: 3–32 حرفًا إنجليزيًا صغيرًا أو أرقامًا أو . _ -' }, 400);
    if (!name) return json({ error: 'الاسم مطلوب' }, 400);
    const pErr = passwordError(password);
    if (pErr) return json({ error: pErr }, 400);
    const id = uid();
    await db.batch([
      db.prepare("INSERT INTO chat_users (id, name, role, last_seen, updated_at, username, pass_hash, is_admin) VALUES (?1, ?2, 'مدير النظام', ?3, ?3, ?4, ?5, 1)")
        .bind(id, name, now, username, await hashPassword(password)),
      db.prepare("INSERT OR IGNORE INTO chat_members (room_id, user_id, role, last_read, joined_at) VALUES (?, ?, 'admin', 0, ?)").bind(GENERAL_ROOM, id, now),
    ]);
    return json({ ok: true, id, key: await newSession(db, id, now) });
  }

  // تسجيل الدخول: اسم المستخدم + كلمة المرور، مع قفل مؤقت بعد محاولات فاشلة متتالية
  if (path === '/auth/login' && method === 'POST') {
    if (await ipBlocked(db, request)) return ipBlockedResponse();
    const b = await readBody<{ username?: string; password?: string }>(request);
    const username = normUser(b?.username);
    const password = str(b?.password, 200);
    if (!username || !password) return json({ error: 'أدخل اسم المستخدم وكلمة المرور' }, 400);
    const { results } = await db.prepare('SELECT id, pass_hash, disabled, fail_count, lock_until FROM chat_users WHERE username = ?')
      .bind(username).all<{ id: string; pass_hash: string; disabled: number; fail_count: number; lock_until: number }>();
    const u = results[0];
    if (u && u.lock_until > now) {
      const mins = Math.ceil((u.lock_until - now) / 60_000);
      return json({ error: `تم إيقاف الدخول مؤقتًا بسبب محاولات خاطئة متكررة. حاول بعد ${mins} دقيقة`, code: 'locked', retryAt: u.lock_until }, 429);
    }
    const ok = await verifyPassword(password, u?.pass_hash || '');
    if (!u || !ok) {
      if (u) {
        const fails = u.fail_count + 1;
        const locked = fails >= MAX_FAILS;
        await db.prepare('UPDATE chat_users SET fail_count = ?, lock_until = ? WHERE id = ?')
          .bind(locked ? 0 : fails, locked ? now + LOCK_MS : 0, u.id).run();
        await audit(db, request, u.id, locked ? 'auth.locked' : 'auth.failed', locked ? 'قفل مؤقت 5 دقائق' : `محاولة ${fails}`, { username });
        if (locked) return json({ error: 'محاولات خاطئة كثيرة. تم إيقاف الدخول لهذا الحساب 5 دقائق', code: 'locked', retryAt: now + LOCK_MS }, 429);
      } else {
        // اسم مستخدم غير موجود: يُسجَّل أيضًا حتى يُحتسب ضمن حد الجهاز
        await audit(db, request, '', 'auth.failed', 'اسم مستخدم غير موجود', { username });
      }
      return json({ error: 'بيانات الدخول غير صحيحة، يرجى التحقق من اسم المستخدم وكلمة المرور', code: 'bad_credentials' }, 401);
    }
    if (u.disabled) return json({ error: 'هذا الحساب موقوف. راجع مدير النظام', code: 'disabled' }, 403);
    await db.prepare('UPDATE chat_users SET fail_count = 0, lock_until = 0, last_seen = ? WHERE id = ?').bind(now, u.id).run();
    await db.prepare("INSERT OR IGNORE INTO chat_members (room_id, user_id, role, last_read, joined_at) VALUES (?, ?, 'member', 0, ?)").bind(GENERAL_ROOM, u.id, now).run();
    await audit(db, request, u.id, 'auth.login', 'كلمة المرور', { username });
    return json({ ok: true, id: u.id, key: await newSession(db, u.id, now) });
  }

  // ───── الدخول بالبصمة / بصمة الوجه ─────
  const rpId = url.hostname;
  const expectedOrigin = url.origin;
  /** استهلاك تحدٍّ صالح لمرة واحدة فقط */
  const takeChallenge = async (challenge: string, kind: string) => {
    const { results } = await db.prepare('SELECT user_id, expires_at FROM webauthn_challenges WHERE challenge = ? AND kind = ?')
      .bind(challenge, kind).all<{ user_id: string; expires_at: number }>();
    await db.prepare('DELETE FROM webauthn_challenges WHERE challenge = ? OR expires_at < ?').bind(challenge, now).run();
    const c = results[0];
    return c && c.expires_at >= now ? c : null;
  };

  if (path === '/auth/webauthn/login-options' && method === 'POST') {
    // لا نُرجع معرّفات البصمات حتى لا يُكشف وجود الحسابات أو معرّفات بصماتها؛ الجهاز يعرض مفاتيحه المحفوظة بنفسه
    const challenge = randomChallenge();
    await db.prepare("INSERT INTO webauthn_challenges (challenge, kind, expires_at) VALUES (?, 'get', ?)").bind(challenge, now + 2 * 60_000).run();
    return json({ challenge, rpId, timeout: 60000, userVerification: 'required', allowCredentials: [] });
  }

  if (path === '/auth/webauthn/login' && method === 'POST') {
    if (await ipBlocked(db, request)) return ipBlockedResponse();
    const b = await readBody<{ id?: string; clientDataJSON?: string; authenticatorData?: string; signature?: string }>(request);
    const fail = async (error: string) => {
      await audit(db, request, '', 'auth.failed', `بصمة: ${error}`);
      return json({ error, code: 'bio_failed' }, 401);
    };
    const cd = parseClientData(str(b?.clientDataJSON, 4000));
    if (!b?.id || !cd || cd.type !== 'webauthn.get' || cd.origin !== expectedOrigin) return fail('بيانات البصمة غير صالحة');
    if (!(await takeChallenge(cd.challenge, 'get'))) return fail('انتهت مهلة التحقق، حاول مجددًا');
    const { results } = await db.prepare(
      'SELECT c.id, c.user_id, c.public_key, c.alg, c.sign_count, u.disabled FROM webauthn_credentials c JOIN chat_users u ON u.id = c.user_id WHERE c.id = ?',
    ).bind(str(b.id, 512)).all<{ id: string; user_id: string; public_key: string; alg: number; sign_count: number; disabled: number }>();
    const cred = results[0];
    if (!cred) return fail('البصمة غير مسجلة لأي حساب. سجّل الدخول بكلمة المرور ثم فعّلها من جديد');
    if (cred.disabled) return json({ error: 'هذا الحساب موقوف. راجع مدير النظام', code: 'disabled' }, 403);
    const v = await verifyAssertion({
      publicKey: cred.public_key, alg: cred.alg, rpId,
      authenticatorData: str(b.authenticatorData, 4000), clientDataJSON: str(b.clientDataJSON, 4000), signature: str(b.signature, 2000),
    });
    if (!v.ok) return fail(v.error);
    // عدّاد التوقيعات يجب أن يزيد (إن كان الجهاز يدعمه) لكشف نسخ المفتاح
    if (v.signCount && cred.sign_count && v.signCount <= cred.sign_count) return fail('تم رفض البصمة لأسباب أمنية');
    await db.prepare('UPDATE webauthn_credentials SET sign_count = ?, last_used = ? WHERE id = ?').bind(v.signCount, now, cred.id).run();
    await db.prepare('UPDATE chat_users SET fail_count = 0, lock_until = 0, last_seen = ? WHERE id = ?').bind(now, cred.user_id).run();
    await audit(db, request, cred.user_id, 'auth.login', 'البصمة');
    return json({ ok: true, id: cred.user_id, key: await newSession(db, cred.user_id, now) });
  }

  // طلب دعم من شاشة الدخول (بدون جلسة)
  if (path === '/auth/support' && method === 'POST') {
    const b = await readBody<{ name?: string; phone?: string; username?: string; kind?: string; message?: string }>(request);
    const name = str(b?.name, 60).trim();
    const phone = str(b?.phone, 20).replace(/[^\d+]/g, '');
    const kind = ['account', 'password', 'other'].includes(String(b?.kind)) ? String(b?.kind) : 'other';
    if (!name) return json({ error: 'اكتب اسمك الكامل' }, 400);
    if (phone.length < 7) return json({ error: 'اكتب رقم هاتف صحيح للتواصل معك' }, 400);
    // حد أعلى للطلبات المفتوحة حتى لا تُغرق الطلبات العشوائية القائمة
    const { results } = await db.prepare("SELECT COUNT(*) AS n FROM support_requests WHERE status = 'open'").all<{ n: number }>();
    if ((results[0]?.n || 0) >= 300) return json({ error: 'قائمة الطلبات ممتلئة حاليًا، تواصل مع مدير النظام مباشرة' }, 429);
    await db.prepare('INSERT INTO support_requests (id, name, phone, username, kind, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(uid(), name, phone, normUser(b?.username), kind, str(b?.message, 500).trim(), now).run();
    return json({ ok: true });
  }

  // كل ما بعد هذا يتطلب جلسة حساب موثّقة
  if (!session) return unauthorized();

  // ───── جلستي وحسابي ─────
  if (path === '/auth/me' && method === 'GET') {
    const { results } = await db.prepare(`SELECT ${ACCOUNT_COLS} FROM chat_users WHERE id = ?`).bind(authId).all<AccountRow>();
    return json({ user: withPerms(results[0]) });
  }
  if (path === '/auth/logout' && method === 'POST') {
    await db.prepare('DELETE FROM chat_sessions WHERE token_hash = ?').bind(session.tokenHash).run();
    await audit(db, request, authId, 'auth.logout');
    return json({ ok: true });
  }
  // تغيير كلمة المرور: يُخرج كل الأجهزة الأخرى ويُبقي هذا الجهاز
  if (path === '/auth/password' && method === 'POST') {
    const b = await readBody<{ current?: string; next?: string }>(request);
    const next = str(b?.next, 200);
    const pErr = passwordError(next);
    if (pErr) return json({ error: pErr }, 400);
    const { results } = await db.prepare('SELECT pass_hash FROM chat_users WHERE id = ?').bind(authId).all<{ pass_hash: string }>();
    if (!(await verifyPassword(str(b?.current, 200), results[0]?.pass_hash || ''))) return json({ error: 'كلمة المرور الحالية غير صحيحة' }, 403);
    await db.batch([
      db.prepare('UPDATE chat_users SET pass_hash = ? WHERE id = ?').bind(await hashPassword(next), authId),
      db.prepare('DELETE FROM chat_sessions WHERE user_id = ? AND token_hash != ?').bind(authId, session.tokenHash),
    ]);
    await audit(db, request, authId, 'auth.password');
    return json({ ok: true });
  }

  // تسجيل بصمة هذا الجهاز لحسابي
  if (path === '/auth/webauthn/register-options' && method === 'POST') {
    const { results } = await db.prepare('SELECT username, name FROM chat_users WHERE id = ?').bind(authId).all<{ username: string; name: string }>();
    const { results: creds } = await db.prepare('SELECT id FROM webauthn_credentials WHERE user_id = ?').bind(authId).all<{ id: string }>();
    const challenge = randomChallenge();
    await db.prepare("INSERT INTO webauthn_challenges (challenge, user_id, kind, expires_at) VALUES (?, ?, 'create', ?)").bind(challenge, authId, now + 2 * 60_000).run();
    return json({
      challenge,
      rp: { id: rpId, name: 'صحاري كربلاء' },
      user: { id: authId, name: results[0]?.username || authId, displayName: results[0]?.name || '' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      excludeCredentials: creds.map(c => ({ type: 'public-key', id: c.id })),
      timeout: 60000,
      attestation: 'none',
    });
  }
  if (path === '/auth/webauthn/register' && method === 'POST') {
    const b = await readBody<{ id?: string; clientDataJSON?: string; publicKey?: string; alg?: number; label?: string }>(request);
    const cd = parseClientData(str(b?.clientDataJSON, 4000));
    if (!b?.id || !cd || cd.type !== 'webauthn.create' || cd.origin !== expectedOrigin) return json({ error: 'بيانات البصمة غير صالحة' }, 400);
    const c = await takeChallenge(cd.challenge, 'create');
    if (!c || c.user_id !== authId) return json({ error: 'انتهت مهلة التسجيل، حاول مجددًا' }, 400);
    const alg = Number(b.alg);
    const publicKey = str(b.publicKey, 2000);
    if (!(await checkPublicKey(publicKey, alg))) return json({ error: 'هذا الجهاز لا يدعم الدخول بالبصمة' }, 400);
    const credId = str(b.id, 512);
    // معرّف بصمة مسجّل لحساب آخر لا يُستبدل (كان يسمح بإلغاء بصمة شخص آخر)
    const { results: existing } = await db.prepare('SELECT user_id FROM webauthn_credentials WHERE id = ?').bind(credId).all<{ user_id: string }>();
    if (existing[0] && existing[0].user_id !== authId) return json({ error: 'هذه البصمة مسجّلة مسبقًا' }, 409);
    await db.prepare('INSERT OR REPLACE INTO webauthn_credentials (id, user_id, public_key, alg, sign_count, label, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .bind(credId, authId, publicKey, alg, str(b.label, 80), now).run();
    return json({ ok: true });
  }
  if (path === '/auth/webauthn/credentials' && method === 'GET') {
    const { results } = await db.prepare('SELECT id, label, created_at, last_used FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC').bind(authId).all();
    return json({ items: results });
  }
  const credMatch = path.match(/^\/auth\/webauthn\/credentials\/(.+)$/);
  if (credMatch && method === 'DELETE') {
    await db.prepare('DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?').bind(decodeURIComponent(credMatch[1]), authId).run();
    return json({ ok: true });
  }

  // ───── صلاحية المحادثة: العرض للقراءة، والتعديل للإرسال وإدارة الغرف ─────
  if (!path.startsWith('/admin/')) {
    const chatLevel = levelOf(session.perms, session.admin, 'chat');
    const readOnlyOk = method === 'GET' || ['/read', '/typing', '/prefs'].includes(path);
    if (chatLevel < (readOnlyOk ? 1 : 2)) return json({ error: chatLevel ? 'صلاحيتك على المحادثة للعرض فقط' : 'لا تملك صلاحية الدخول إلى المحادثة', code: 'forbidden' }, 403);
  }

  // قائمة الحسابات الفعّالة (لزملاء العمل) — بدون أي بيانات سرّية
  if (path === '/users' && method === 'GET') {
    const { results } = await db.prepare("SELECT id, name, role, avatar, color, last_seen FROM chat_users WHERE pass_hash != '' AND disabled = 0 ORDER BY name").all();
    return json({ items: results });
  }

  // ───── إدارة الحسابات (مدير النظام فقط) ─────
  if (path.startsWith('/admin/')) {
    if (!session.admin) return json({ error: 'هذه الصلاحية لمدير النظام فقط' }, 403);

    if (path === '/admin/users' && method === 'GET') {
      const { results } = await db.prepare(`SELECT ${ACCOUNT_COLS} FROM chat_users WHERE pass_hash != '' ORDER BY is_admin DESC, name`).all<AccountRow>();
      return json({ items: results.map(withPerms), max: MAX_ACCOUNTS });
    }

    if (path === '/admin/users' && method === 'POST') {
      if ((await accountCount()) >= MAX_ACCOUNTS) return json({ error: `وصلت إلى الحد الأقصى (${MAX_ACCOUNTS} حساب)` }, 403);
      const b = await readBody<{ username?: string; password?: string; name?: string; role?: string; is_admin?: boolean; perms?: unknown; avatar?: unknown }>(request);
      const username = normUser(b?.username);
      const password = str(b?.password, 200);
      const name = str(b?.name, 60).trim();
      if (!USERNAME_RE.test(username)) return json({ error: 'اسم المستخدم: 3–32 حرفًا إنجليزيًا صغيرًا أو أرقامًا أو . _ -' }, 400);
      if (!name) return json({ error: 'الاسم مطلوب' }, 400);
      const pErr = passwordError(password);
      if (pErr) return json({ error: pErr }, 400);
      const avatar = b?.avatar === undefined ? '' : avatarValue(b.avatar);
      if (avatar === null) return json({ error: 'الصورة غير صالحة (PNG أو JPEG أو WebP بحجم صغير)' }, 400);
      const { results: taken } = await db.prepare('SELECT id FROM chat_users WHERE username = ?').bind(username).all();
      if (taken.length) return json({ error: 'اسم المستخدم مستخدم مسبقًا' }, 409);
      const id = uid();
      const color = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'][Math.floor(Math.random() * 8)];
      await db.batch([
        db.prepare('INSERT INTO chat_users (id, name, role, color, last_seen, updated_at, username, pass_hash, is_admin, perms, avatar) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10)')
          .bind(id, name, str(b?.role, 60).trim(), color, now, username, await hashPassword(password), b?.is_admin ? 1 : 0, JSON.stringify(sanitizePerms(b?.perms)), avatar),
        db.prepare("INSERT OR IGNORE INTO chat_members (room_id, user_id, role, last_read, joined_at) VALUES (?, ?, 'member', 0, ?)").bind(GENERAL_ROOM, id, now),
      ]);
      await audit(db, request, authId, 'admin.create', `@${username}${b?.is_admin ? ' (مدير النظام)' : ''}`);
      return json({ ok: true, id });
    }

    if (path === '/admin/support' && method === 'GET') {
      const { results } = await db.prepare("SELECT * FROM support_requests ORDER BY status = 'open' DESC, created_at DESC LIMIT 200").all();
      return json({ items: results });
    }
    const sm = path.match(/^\/admin\/support\/([^/]+)$/);
    if (sm && method === 'PATCH') {
      const b = await readBody<{ status?: string }>(request);
      await db.prepare('UPDATE support_requests SET status = ? WHERE id = ?').bind(b?.status === 'done' ? 'done' : 'open', decodeURIComponent(sm[1])).run();
      await audit(db, request, authId, 'admin.support', b?.status === 'done' ? 'تمت معالجة طلب' : 'إعادة فتح طلب');
      return json({ ok: true });
    }

    // سجل العمليات: الأحدث أولًا، مع تصفية حسب الحساب وتحميل تدريجي (before = آخر id معروض)
    if (path === '/admin/audit' && method === 'GET') {
      const user = str(url.searchParams.get('user'), 64);
      const action = str(url.searchParams.get('action'), 40);
      const q = str(url.searchParams.get('q'), 80).trim();
      const since = Number(url.searchParams.get('since')) || 0;
      const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
      const where = ['id < ?'];
      const args: unknown[] = [before];
      if (user) { where.push('user_id = ?'); args.push(user); }
      if (action) { where.push('action LIKE ?'); args.push(`${action}%`); }
      if (since) { where.push('at >= ?'); args.push(since); }
      if (q) { where.push('(detail LIKE ? OR username LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
      const { results } = await db.prepare(`SELECT id, at, user_id, username, action, detail, ip FROM audit_log WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`)
        .bind(...args, limit).all();
      return json({ items: results, more: results.length === limit });
    }

    // ملخص آخر 24 ساعة لبطاقات سجل العمليات
    if (path === '/admin/audit/stats' && method === 'GET') {
      const { results } = await db.prepare('SELECT action, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM audit_log WHERE at >= ? GROUP BY action')
        .bind(now - 24 * 3600_000).all<{ action: string; n: number; users: number }>();
      return json({ since: now - 24 * 3600_000, items: results });
    }

    const m = path.match(/^\/admin\/users\/([^/]+)$/);
    if (m && method === 'PATCH') {
      const id = decodeURIComponent(m[1]);
      const b = await readBody<{ name?: string; role?: string; password?: string; is_admin?: boolean; disabled?: boolean; perms?: unknown; avatar?: unknown }>(request);
      if (!b) return json({ error: 'بيانات غير صالحة' }, 400);
      const { results } = await db.prepare("SELECT id FROM chat_users WHERE id = ? AND pass_hash != ''").bind(id).all();
      if (!results.length) return json({ error: 'الحساب غير موجود' }, 404);
      if (id === authId && (b.disabled === true || b.is_admin === false)) return json({ error: 'لا يمكنك إيقاف حسابك أو سحب صلاحية الإدارة منه' }, 400);
      const stmts: D1PreparedStatement[] = [];
      if (b.name !== undefined) {
        const name = str(b.name, 60).trim();
        if (!name) return json({ error: 'الاسم مطلوب' }, 400);
        stmts.push(db.prepare('UPDATE chat_users SET name = ?, updated_at = ? WHERE id = ?').bind(name, now, id));
      }
      if (b.role !== undefined) stmts.push(db.prepare('UPDATE chat_users SET role = ?, updated_at = ? WHERE id = ?').bind(str(b.role, 60).trim(), now, id));
      if (b.avatar !== undefined) {
        const avatar = avatarValue(b.avatar);
        if (avatar === null) return json({ error: 'الصورة غير صالحة (PNG أو JPEG أو WebP بحجم صغير)' }, 400);
        stmts.push(db.prepare('UPDATE chat_users SET avatar = ?, updated_at = ? WHERE id = ?').bind(avatar, now, id));
      }
      if (b.perms !== undefined) stmts.push(db.prepare('UPDATE chat_users SET perms = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(sanitizePerms(b.perms)), now, id));
      if (b.is_admin !== undefined) stmts.push(db.prepare('UPDATE chat_users SET is_admin = ? WHERE id = ?').bind(b.is_admin ? 1 : 0, id));
      if (b.password !== undefined) {
        const pErr = passwordError(str(b.password, 200));
        if (pErr) return json({ error: pErr }, 400);
        // إعادة التعيين تفك القفل وتُخرج الحساب من كل الأجهزة
        stmts.push(db.prepare('UPDATE chat_users SET pass_hash = ?, fail_count = 0, lock_until = 0 WHERE id = ?').bind(await hashPassword(str(b.password, 200)), id));
        stmts.push(db.prepare('DELETE FROM chat_sessions WHERE user_id = ?').bind(id));
      }
      if (b.disabled !== undefined) {
        stmts.push(db.prepare('UPDATE chat_users SET disabled = ? WHERE id = ?').bind(b.disabled ? 1 : 0, id));
        if (b.disabled) stmts.push(db.prepare('DELETE FROM chat_sessions WHERE user_id = ?').bind(id));
      }
      if (stmts.length) {
        await db.batch(stmts);
        const { results: target } = await db.prepare('SELECT username FROM chat_users WHERE id = ?').bind(id).all<{ username: string }>();
        const changes = [
          b.name !== undefined && 'الاسم', b.role !== undefined && 'الوظيفة', b.avatar !== undefined && 'الصورة', b.perms !== undefined && 'الصلاحيات',
          b.is_admin !== undefined && (b.is_admin ? 'منح الإدارة' : 'سحب الإدارة'), b.password !== undefined && 'إعادة تعيين كلمة المرور',
          b.disabled !== undefined && (b.disabled ? 'إيقاف الحساب' : 'تفعيل الحساب'),
        ].filter(Boolean).join('، ');
        await audit(db, request, authId, 'admin.update', `@${target[0]?.username || id}: ${changes}`);
      }
      return json({ ok: true });
    }
    return json({ error: 'غير موجود' }, 404);
  }

  // ───── الحساب ─────
  if (path === '/profile' && method === 'PUT') {
    const b = await body<Partial<UserRow>>(request);
    if (!b) return json({ error: 'بيانات غير صالحة' }, 400);
    const id = authId;
    const name = str(b.name, 60).trim();
    if (!name) return json({ error: 'الاسم مطلوب' }, 400);
    const avatar = str(b.avatar, MAX_AVATAR_CHARS);
    await db.batch([
      db.prepare(
        'INSERT INTO chat_users (id, name, role, bio, avatar, color, last_seen, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ' +
        'ON CONFLICT(id) DO UPDATE SET name = ?2, role = ?3, bio = ?4, avatar = ?5, color = ?6, last_seen = ?7, updated_at = ?7'
      ).bind(id, name, str(b.role, 60), str(b.bio, 200), avatar, str(b.color, 20), now),
      db.prepare("INSERT OR IGNORE INTO chat_members (room_id, user_id, role, last_read, joined_at) VALUES (?, ?, 'member', 0, ?)").bind(GENERAL_ROOM, id, now),
    ]);
    return json({ ok: true, id });
  }


  // ───── المزامنة التزايدية ─────
  if (path === '/sync' && method === 'GET') {
    const me = authId;
    const since = Number(url.searchParams.get('since')) || 0;
    if (!me) return json({ error: 'الحساب غير محدد' }, 400);

    const [, usersRes, presenceRes, memberOf] = await Promise.all([
      db.prepare('UPDATE chat_users SET last_seen = ? WHERE id = ?').bind(now, me).run(),
      db.prepare('SELECT id, name, role, bio, avatar, color, last_seen, typing_room, typing_at, updated_at FROM chat_users WHERE updated_at > ?').bind(since).all<UserRow>(),
      db.prepare('SELECT id, last_seen, typing_room, typing_at FROM chat_users').all<Pick<UserRow, 'id' | 'last_seen' | 'typing_room' | 'typing_at'>>(),
      db.prepare('SELECT room_id FROM chat_members WHERE user_id = ?').bind(me).all<{ room_id: string }>(),
    ]);
    const roomIds = memberOf.results.map(r => r.room_id);
    if (!roomIds.length) return json({ now, roomIds, users: usersRes.results, presence: presenceRes.results, rooms: [], members: [], messages: [] });

    const mine = 'SELECT room_id FROM chat_members WHERE user_id = ?';
    const [rooms, members, messages] = await Promise.all([
      db.prepare(`SELECT * FROM chat_rooms WHERE id IN (${mine}) AND updated_at > ?`).bind(me, since).all<RoomRow>(),
      db.prepare(`SELECT * FROM chat_members WHERE room_id IN (${mine})`).bind(me).all<MemberRow>(),
      since
        ? db.prepare(`SELECT * FROM chat_messages WHERE room_id IN (${mine}) AND updated_at > ? ORDER BY updated_at LIMIT 2000`).bind(me, since).all<MessageRow>()
        // أول تحميل: آخر 300 رسالة لكل غرفة
        : db.prepare(`SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at DESC) AS rn FROM chat_messages WHERE room_id IN (${mine})) WHERE rn <= 300 ORDER BY created_at`).bind(me).all<MessageRow>(),
    ]);
    return json({
      now,
      roomIds,
      users: usersRes.results,
      presence: presenceRes.results,
      rooms: rooms.results,
      members: members.results,
      messages: messages.results.map(parseMessage),
    });
  }

  // ───── مؤشر الكتابة ─────
  if (path === '/typing' && method === 'POST') {
    const b = await body<{ me?: string; room?: string }>(request);
    if (!b?.me) return json({ error: 'بيانات غير صالحة' }, 400);
    const room = str(b.room, 64);
    if (room && !(await isMember(db, room, b.me))) return json({ error: 'غير مسموح' }, 403);
    await db.prepare('UPDATE chat_users SET typing_room = ?, typing_at = ?, last_seen = ? WHERE id = ?').bind(room, now, now, b.me).run();
    return json({ ok: true });
  }

  // ───── إيصال القراءة ─────
  if (path === '/read' && method === 'POST') {
    const b = await body<{ me?: string; room?: string; at?: number }>(request);
    if (!b?.me || !b.room) return json({ error: 'بيانات غير صالحة' }, 400);
    if (!(await isMember(db, b.room, b.me))) return json({ error: 'غير مسموح' }, 403);
    const at = Math.min(Number(b.at) || now, now);
    await db.batch([
      // تسجيل وقت المشاهدة للرسائل الجديدة فقط (قبل تقديم last_read)
      db.prepare(
        'INSERT OR IGNORE INTO chat_seen (message_id, user_id, at) SELECT id, ?1, ?2 FROM chat_messages ' +
        "WHERE room_id = ?3 AND user_id != ?1 AND kind != 'system' AND created_at <= ?4 " +
        'AND created_at > COALESCE((SELECT last_read FROM chat_members WHERE room_id = ?3 AND user_id = ?1), 0) LIMIT 1000'
      ).bind(b.me, now, b.room, at),
      db.prepare('UPDATE chat_members SET last_read = MAX(last_read, ?) WHERE room_id = ? AND user_id = ?').bind(at, b.room, b.me),
    ]);
    return json({ ok: true });
  }

  // ───── إعدادات العضوية (كتم / تثبيت) ─────
  if (path === '/prefs' && method === 'POST') {
    const b = await body<{ me?: string; room?: string; muted?: boolean; pinned?: boolean }>(request);
    if (!b?.me || !b.room) return json({ error: 'بيانات غير صالحة' }, 400);
    if (typeof b.muted === 'boolean') await db.prepare('UPDATE chat_members SET muted = ? WHERE room_id = ? AND user_id = ?').bind(b.muted ? 1 : 0, b.room, b.me).run();
    if (typeof b.pinned === 'boolean') await db.prepare('UPDATE chat_members SET pinned = ? WHERE room_id = ? AND user_id = ?').bind(b.pinned ? now : 0, b.room, b.me).run();
    return json({ ok: true });
  }

  // ───── الغرف ─────
  if (path === '/rooms' && method === 'POST') {
    const b = await body<{ me?: string; type?: string; name?: string; description?: string; avatar?: string; members?: string[] }>(request);
    if (!b?.me) return json({ error: 'بيانات غير صالحة' }, 400);
    const others = Array.from(new Set((b.members || []).filter(m => typeof m === 'string' && m !== b.me))).slice(0, 200);

    if (b.type === 'direct') {
      if (others.length !== 1) return json({ error: 'اختر شخصًا واحدًا' }, 400);
      const directId = 'dm:' + [b.me, others[0]].sort().join(':');
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO chat_rooms (id, type, created_by, created_at, updated_at) VALUES (?, 'direct', ?, ?, ?)").bind(directId, b.me, now, now),
        db.prepare("INSERT OR IGNORE INTO chat_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").bind(directId, b.me, now),
        db.prepare("INSERT OR IGNORE INTO chat_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").bind(directId, others[0], now),
      ]);
      return json({ ok: true, id: directId });
    }

    const name = str(b.name, 80).trim();
    if (!name) return json({ error: 'اسم المجموعة مطلوب' }, 400);
    const id = uid();
    await db.batch([
      db.prepare("INSERT INTO chat_rooms (id, type, name, description, avatar, created_by, created_at, updated_at) VALUES (?, 'group', ?, ?, ?, ?, ?, ?)")
        .bind(id, name, str(b.description, 300), str(b.avatar, MAX_AVATAR_CHARS), b.me, now, now),
      db.prepare("INSERT INTO chat_members (room_id, user_id, role, last_read, joined_at) VALUES (?, ?, 'admin', ?, ?)").bind(id, b.me, now, now),
      ...others.map(m => db.prepare("INSERT OR IGNORE INTO chat_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").bind(id, m, now)),
      systemMessage(db, id, b.me, 'أنشأ المجموعة', now),
    ]);
    return json({ ok: true, id });
  }

  const roomMatch = path.match(/^\/rooms\/([^/]+)(\/members|\/pin)?$/);
  if (roomMatch) {
    const room = decodeURIComponent(roomMatch[1]);
    const b = await body<{ me?: string; name?: string; description?: string; avatar?: string; add?: string[]; remove?: string[]; admin?: string }>(request);
    if (!b?.me || !(await isMember(db, room, b.me))) return json({ error: 'غير مسموح' }, 403);

    const { results: myRole } = await db.prepare('SELECT role FROM chat_members WHERE room_id = ? AND user_id = ?').bind(room, b.me).all<{ role: string }>();
    const isAdmin = myRole[0]?.role === 'admin';

    if (!roomMatch[2] && method === 'PATCH') {
      if (!isAdmin) return json({ error: 'تعديل المجموعة للمشرفين فقط' }, 403);
      const name = str(b.name, 80).trim();
      if (!name) return json({ error: 'اسم المجموعة مطلوب' }, 400);
      await db.batch([
        db.prepare('UPDATE chat_rooms SET name = ?, description = ?, avatar = ?, updated_at = ? WHERE id = ? AND type = ?')
          .bind(name, str(b.description, 300), str(b.avatar, MAX_AVATAR_CHARS), now, room, 'group'),
        systemMessage(db, room, b.me, 'حدّث معلومات المجموعة', now),
      ]);
      return json({ ok: true });
    }

    // تثبيت رسالة في أعلى المحادثة (msg فارغ = إلغاء التثبيت)
    if (roomMatch[2] === '/pin' && method === 'POST') {
      const msgId = str((b as { msg?: string }).msg, 64);
      await db.batch([
        db.prepare('UPDATE chat_rooms SET pinned_msg = ?, updated_at = ? WHERE id = ?').bind(msgId, now, room),
        systemMessage(db, room, b.me, msgId ? 'ثبّت رسالة' : 'ألغى تثبيت الرسالة', now),
      ]);
      return json({ ok: true });
    }

    if (roomMatch[2] === '/members' && method === 'POST') {
      if (room === GENERAL_ROOM && (b.remove || []).length) return json({ error: 'لا يمكن مغادرة الغرفة العامة' }, 400);
      const add = (b.add || []).filter(x => typeof x === 'string').slice(0, 200);
      const remove = (b.remove || []).filter(x => typeof x === 'string').slice(0, 200);
      // غير المشرف يستطيع مغادرة المجموعة فقط
      const selfLeave = !add.length && !b.admin && remove.length === 1 && remove[0] === b.me;
      if (!isAdmin && !selfLeave) return json({ error: 'إدارة الأعضاء للمشرفين فقط' }, 403);
      const statements: D1PreparedStatement[] = [];
      for (const u of add) statements.push(db.prepare("INSERT OR IGNORE INTO chat_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").bind(room, u, now));
      for (const u of remove) statements.push(db.prepare('DELETE FROM chat_members WHERE room_id = ? AND user_id = ?').bind(room, u));
      if (b.admin) statements.push(db.prepare("UPDATE chat_members SET role = CASE role WHEN 'admin' THEN 'member' ELSE 'admin' END WHERE room_id = ? AND user_id = ?").bind(room, b.admin));
      if (add.length) statements.push(systemMessage(db, room, b.me, `أضاف ${add.length} ${add.length === 1 ? 'عضوًا' : 'أعضاء'}`, now));
      if (remove.length) statements.push(systemMessage(db, room, b.me, remove.length === 1 && remove[0] === b.me ? 'غادر المجموعة' : `أزال ${remove.length} ${remove.length === 1 ? 'عضوًا' : 'أعضاء'}`, now + 1));
      statements.push(touchRoom(db, room, now));
      await db.batch(statements);
      return json({ ok: true });
    }
  }

  // ───── الرسائل ─────
  if (path === '/messages' && method === 'POST') {
    const b = await body<{ id?: string; me?: string; room?: string; kind?: string; text?: string; replyTo?: string; attachments?: unknown[]; urgent?: boolean }>(request);
    if (!b?.me || !b.room) return json({ error: 'بيانات غير صالحة' }, 400);
    if (!(await isMember(db, b.room, b.me))) return json({ error: 'لست عضوًا في هذه المحادثة' }, 403);
    const kind = ['text', 'file', 'voice'].includes(b.kind || '') ? b.kind! : 'text';
    const text = str(b.text, 8000);
    const list = (Array.isArray(b.attachments) ? b.attachments.slice(0, 20) : []) as { fileId?: unknown }[];
    // المرفقات تشير فقط لملفات رفعها المرسل نفسه (وإلا قد يحذف ملف غيره عند حذف رسالته)
    const fileIds = list.map(a => (a && typeof a.fileId === 'string' ? a.fileId : '')).filter(Boolean);
    if (fileIds.length) {
      const { results: own } = await db.prepare(`SELECT id FROM chat_files WHERE owner = ? AND id IN (${fileIds.map(() => '?').join(',')})`).bind(authId, ...fileIds).all<{ id: string }>();
      if (own.length !== new Set(fileIds).size) return json({ error: 'مرفق غير صالح' }, 400);
    }
    const attachments = JSON.stringify(list);
    if (!text.trim() && attachments === '[]') return json({ error: 'الرسالة فارغة' }, 400);
    if (attachments.length > 600_000) return json({ error: 'بيانات المرفقات كبيرة جدًا' }, 413);
    const id = str(b.id, 64) || uid();
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO chat_messages (id, room_id, user_id, kind, text, reply_to, attachments, urgent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, b.room, b.me, kind, text, str(b.replyTo, 64), attachments, b.urgent ? 1 : 0, now, now),
      db.prepare('UPDATE chat_members SET last_read = ? WHERE room_id = ? AND user_id = ?').bind(now, b.room, b.me),
      db.prepare("UPDATE chat_users SET typing_room = '' WHERE id = ?").bind(b.me),
      touchRoom(db, b.room, now),
    ]);
    return json({ ok: true, id, created_at: now });
  }

  // معلومات الرسالة: من شاهدها ومتى
  const infoMatch = path.match(/^\/messages\/([^/]+)\/info$/);
  if (infoMatch && method === 'GET') {
    const me = authId;
    const id = decodeURIComponent(infoMatch[1]);
    const { results } = await db.prepare('SELECT room_id FROM chat_messages WHERE id = ?').bind(id).all<{ room_id: string }>();
    if (!results[0] || !(await isMember(db, results[0].room_id, me))) return json({ error: 'الرسالة غير موجودة' }, 404);
    const seen = await db.prepare('SELECT user_id, at FROM chat_seen WHERE message_id = ?').bind(id).all<{ user_id: string; at: number }>();
    return json({ seen: seen.results });
  }

  const msgMatch = path.match(/^\/messages\/([^/]+)(\/react)?$/);
  if (msgMatch) {
    const id = decodeURIComponent(msgMatch[1]);
    const b = await body<{ me?: string; text?: string; emoji?: string }>(request);
    if (!b?.me) return json({ error: 'بيانات غير صالحة' }, 400);
    const { results } = await db.prepare('SELECT * FROM chat_messages WHERE id = ?').bind(id).all<MessageRow>();
    const msg = results[0];
    if (!msg || !(await isMember(db, msg.room_id, b.me))) return json({ error: 'الرسالة غير موجودة' }, 404);

    if (msgMatch[2] && method === 'POST') {
      const emoji = str(b.emoji, 16);
      if (!emoji) return json({ error: 'بيانات غير صالحة' }, 400);
      const reactions: Record<string, string[]> = JSON.parse(msg.reactions || '{}');
      // تفاعل واحد لكل شخص: إزالة القديم ثم تبديل الجديد
      const had = (reactions[emoji] || []).includes(b.me);
      for (const k of Object.keys(reactions)) {
        reactions[k] = reactions[k].filter(u => u !== b.me);
        if (!reactions[k].length) delete reactions[k];
      }
      if (!had) reactions[emoji] = [...(reactions[emoji] || []), b.me];
      await db.prepare('UPDATE chat_messages SET reactions = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(reactions), now, id).run();
      return json({ ok: true });
    }

    if (msg.user_id !== b.me) return json({ error: 'يمكنك تعديل رسائلك فقط' }, 403);

    if (!msgMatch[2] && method === 'PATCH') {
      const text = str(b.text, 8000);
      if (!text.trim()) return json({ error: 'الرسالة فارغة' }, 400);
      await db.prepare('UPDATE chat_messages SET text = ?, edited = 1, updated_at = ? WHERE id = ?').bind(text, now, id).run();
      return json({ ok: true });
    }

    if (!msgMatch[2] && method === 'DELETE') {
      if (now - msg.created_at > DELETE_WINDOW_MS) return json({ error: 'انتهت مهلة الحذف للجميع (ساعة واحدة)' }, 403);
      const fileIds = (JSON.parse(msg.attachments || '[]') as { fileId?: string }[]).map(a => a.fileId).filter(Boolean) as string[];
      // تُحذف فقط ملفات المرسل نفسه (المرفقات مقيّدة بمالكها عند الإرسال أيضًا)
      const { results: own } = fileIds.length
        ? await db.prepare(`SELECT id FROM chat_files WHERE owner = ? AND id IN (${fileIds.map(() => '?').join(',')})`).bind(authId, ...fileIds).all<{ id: string }>()
        : { results: [] as { id: string }[] };
      await db.batch([
        db.prepare("UPDATE chat_messages SET deleted = 1, text = '', attachments = '[]', reactions = '{}', updated_at = ? WHERE id = ?").bind(now, id),
        ...own.map(f => db.prepare('DELETE FROM chat_files WHERE id = ?').bind(f.id)),
      ]);
      if (files) for (const f of own) await removeFile(files, db, 'chat', f.id, { by: authId });
      return json({ ok: true });
    }
  }

  // ───── المرفقات ─────
  if (path === '/files' && method === 'POST') {
    const name = str(url.searchParams.get('name'), 200) || 'file';
    const type = (request.headers.get('content-type') || 'application/octet-stream').slice(0, 120);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return json({ error: 'الملف فارغ' }, 400);
    if (bytes.length > MAX_FILE_BYTES) return json({ error: 'الحد الأقصى لحجم الملف 50MB' }, 413);
    if (!files) return json({ error: 'تخزين الملفات غير مهيأ على الخادم' }, 503);
    const row: FileRow = { id: uid(), name, type, size: bytes.length, created_at: now };
    // المحتوى في R2، والسجل في D1 بعد نجاح الرفع
    const sha256 = await storeFile(files, 'chat', row.id, bytes, type, { name, owner: authId });
    await ensureFileColumns(db);
    await db.prepare('INSERT INTO chat_files (id, name, type, size, created_at, owner, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(row.id, row.name, row.type, row.size, row.created_at, authId, sha256).run();
    return json({ ok: true, item: row });
  }

  const fileMatch = path.match(/^\/files\/([^/]+)$/);
  if (fileMatch && method === 'GET') {
    const id = decodeURIComponent(fileMatch[1]);
    const { results: meta } = await db.prepare('SELECT * FROM chat_files WHERE id = ?').bind(id).all<FileRow>();
    if (!meta.length) return json({ error: 'الملف غير موجود' }, 404);
    if (!files) return json({ error: 'تخزين الملفات غير مهيأ على الخادم' }, 503);
    const body = await loadFile(files, db, 'chat', id);
    if (!body) return json({ error: 'محتوى الملف غير موجود' }, 404);
    return new Response(body, {
      headers: {
        'content-type': meta[0].type,
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta[0].name)}`,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
        'cache-control': 'private, max-age=31536000, immutable',
      },
    });
  }

  return json({ error: 'غير موجود' }, 404);
}
