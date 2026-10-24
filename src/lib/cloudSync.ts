/**
 * الحفظ السحابي التلقائي.
 * كل البيانات ما زالت تُكتب في localStorage كما هي، لكن أي تغيير يُرسل تلقائيًا للخادم
 * (بعد لحظة قصيرة لتجميع التعديلات)، وعند فتح التطبيق تُسحب آخر نسخة من الخادم.
 * بهذا لا تضيع البيانات عند إغلاق المتصفح أو مسحه، وتظهر نفسها في كل الأجهزة.
 */

import { hasSession, sessionHeaders, clearSession, SESSION_PROFILE_KEY, LAST_USER_KEY, LAST_NAME_KEY, BIO_USER_KEY, BIO_DECLINED_PREFIX } from './session';
import { COLLECTION_KEYS, SHADOW_PREFIX } from './permCatalog';

/** رمز الدخول القديم (قبل حسابات المستخدمين) — يُمسح فقط */
export const TOKEN_KEY = 'sahara_cloud_token';
const PENDING_KEY = 'sahara_cloud_pending';

// مفاتيح خاصة بالجهاز نفسه فلا تُزامَن
const LOCAL_ONLY = new Set([
  TOKEN_KEY,
  SESSION_PROFILE_KEY,
  // بيانات الدخول الخاصة بهذا الجهاز فقط: لا تُزامَن أبدًا مع الأجهزة الأخرى
  LAST_USER_KEY,
  LAST_NAME_KEY,
  BIO_USER_KEY,
  'sahara_bio_cred',
  // طريقة البصمة المختارة خاصة بهذا الجهاز
  'sahara_bio_method',
  'sahara_session_started',
  'sahara_session_resume',
  'sahara_remember_me',
  'sahara_welcome_seen',
  // بطاقة "ثبّت التطبيق": تأجيلها خاص بهذا الجهاز
  'sahara_install_dismissed_at',
  PENDING_KEY,
  'sahara_active_tab',
  'sahara_theme_mode',
  'sahara_language',
  'sahara_sidebar_style',
  // حساب المحادثة وثيمها خاصّان بكل جهاز، والرسائل نفسها تُحفظ في خادم المحادثة
  'sahara_chat_me',
  // مكان رمز الجلسة القديم (أصبح الآن في كوكي HttpOnly): لا يُرفع أبدًا
  'sahara_chat_key',
  'sahara_chat_theme',
  'sahara_chat_sound',
  'sahara_chat_looks',
  'sahara_chat_hidden',
  'sahara_chat_starred',
]);

// رفض البصمة خاص بكل جهاز: لو زُومن لاختفى عرض التفعيل من الهاتف بعد رفضه في الحاسوب
const shouldSync = (key: string) => !LOCAL_ONLY.has(key) && !key.startsWith(SHADOW_PREFIX) && !key.startsWith(BIO_DECLINED_PREFIX);

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';
let status: SyncStatus = 'saved';
const listeners = new Set<(s: SyncStatus) => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach(l => l(s));
};
export const getSyncStatus = () => status;
export const onSyncStatus = (l: (s: SyncStatus) => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

// الدوال الأصلية قبل اعتراضها (لكتابة البيانات القادمة من الخادم دون إعادة إرسالها)
const rawSet = Storage.prototype.setItem;
const rawRemove = Storage.prototype.removeItem;
const rawGet = Storage.prototype.getItem;

const getToken = () => hasSession();

// المفاتيح التي تغيّرت ولم تصل للخادم بعد: { key: رقم نسخة التغيير }
type Pending = Record<string, number>;
const readPending = (): Pending => {
  try {
    return JSON.parse(rawGet.call(localStorage, PENDING_KEY) || '{}');
  } catch {
    return {};
  }
};
const writePending = (p: Pending) => rawSet.call(localStorage, PENDING_KEY, JSON.stringify(p));

let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushDue = 0;
/**
 * إرسال التعديلات بعد لحظة قصيرة (لتجميع التعديلات المتتالية في طلب واحد). تعديل جديد لا يؤخّر إرسالًا
 * مجدولًا أقرب (كان كل تعديل يعيد العدّ ثانية كاملة، فالإدخال المتعدد يتأخر وصوله لشاشة العرض)
 */
const scheduleFlush = (delay = 300) => {
  const due = Date.now() + delay;
  if (flushTimer !== undefined && flushDue <= due) return;
  clearTimeout(flushTimer);
  flushDue = due;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flush();
  }, delay);
};

// مفاتيح لا يملك هذا الحساب صلاحية تعديلها (يحددها الخادم): التغييرات عليها تبقى محلية ولا تُرسل
const blocked = new Set<string>();
type StateResponse = { items: Record<string, string>; admin?: boolean; readOnly?: string[] };
const setBlocked = (r: StateResponse) => {
  blocked.clear();
  (r.readOnly || []).forEach(k => blocked.add(k));
};

const markPending = (key: string) => {
  if (blocked.has(key)) return;
  const p = readPending();
  p[key] = (p[key] || 0) + 1;
  writePending(p);
  if (getToken()) {
    setStatus('saving');
    scheduleFlush();
  }
};

const api = (path: string, init: RequestInit = {}) =>
  fetch(path, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...sessionHeaders(), ...(init.headers || {}) },
  });

// ───── المجموعات الكبيرة: إرسال الفرق فقط ─────
// لكل مجموعة نحتفظ محليًا بآخر نسخة وصلت من الخادم (shadow)، والفرق بينها وبين القيمة الحالية هو ما يُرسل.
// لا تُحدَّث النسخة أثناء وجود تعديلات معلّقة، حتى لا تُحذف عناصر أضافها مستخدمون آخرون.
const isCollection = (k: string) => (COLLECTION_KEYS as readonly string[]).includes(k);
const getShadow = (k: string) => rawGet.call(localStorage, SHADOW_PREFIX + k);
const setShadow = (k: string, v: string | null) => (v === null ? rawRemove.call(localStorage, SHADOW_PREFIX + k) : rawSet.call(localStorage, SHADOW_PREFIX + k, v));

type CollectionOps = { upsert: { id: string; pos: number; data: string }[]; remove: string[] };
/** نفس قاعدة الخادم: حقل id، أو موضع العنصر إن لم يوجد */
const itemId = (item: unknown, i: number) => {
  const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
  return id !== undefined && id !== null && String(id) ? String(id).slice(0, 200) : `auto-${i}`;
};
const diffCollection = (current: string, shadow: string | null): CollectionOps | null => {
  let cur: unknown;
  let old: unknown = [];
  try { cur = JSON.parse(current); if (shadow) old = JSON.parse(shadow); } catch { return null; }
  if (!Array.isArray(cur) || !Array.isArray(old)) return null;
  const before = new Map<string, string>();
  old.forEach((item, i) => { const id = itemId(item, i); if (!before.has(id)) before.set(id, JSON.stringify(item)); });
  const seen = new Set<string>();
  const upsert: CollectionOps['upsert'] = [];
  cur.forEach((item, i) => {
    const id = itemId(item, i);
    if (seen.has(id)) return;
    seen.add(id);
    const data = JSON.stringify(item);
    if (before.get(id) !== data) upsert.push({ id, pos: i, data });
  });
  return { upsert, remove: [...before.keys()].filter(id => !seen.has(id)) };
};

const buildPayload = (pending: Pending) => {
  const set: Record<string, string> = {};
  const remove: string[] = [];
  const collections: Record<string, CollectionOps> = {};
  /** القيم التي حُسب منها الفرق: تصبح النسخة المرجعية بعد نجاح الإرسال */
  const snapshots: Record<string, string | null> = {};
  for (const key of Object.keys(pending)) {
    const value = rawGet.call(localStorage, key);
    if (value === null) { remove.push(key); if (isCollection(key)) snapshots[key] = null; continue; }
    if (isCollection(key)) {
      const ops = diffCollection(value, getShadow(key));
      snapshots[key] = value;
      if (ops) { if (ops.upsert.length || ops.remove.length) collections[key] = ops; continue; }
    }
    set[key] = value;
  }
  return { body: { set, remove, collections }, snapshots };
};

/** رقم نسخة البيانات التي وصلت لهذا الجهاز (يرسله الخادم عبر القناة اللحظية مع كل حفظ) */
let knownVersion: string | null = null;
/** يُستدعى بعد انتهاء كل إرسال (نجح أو فشل): يُكمل جلبًا أُجّل أثناء الإرسال */
let onFlushDone: (() => void) | null = null;
/** لا جلب جارٍ ولا مطلوب (الجهاز متزامن مع آخر ما وصله) — يضبطه initCloudSync */
let pullIdle: () => boolean = () => false;

let flushing = false;
/** يزيد مع كل إرسال ناجح: جلبٌ بدأ قبله قد يحمل نسخة أقدم مما أُرسل فلا يُطبَّق */
let flushGen = 0;
async function flush(): Promise<void> {
  if (flushing || !getToken()) return;
  const pending = readPending();
  if (!Object.keys(pending).length) {
    // لا شيء للإرسال: «غير متصل» يبقى حتى يرد الخادم فعلًا (fetchState يعيدها «محفوظ»)
    if (status !== 'offline') setStatus('saved');
    return;
  }
  flushing = true;
  setStatus('saving');
  try {
    const { body, snapshots } = buildPayload(pending);
    const res = await api('/api/state', { method: 'PUT', body: JSON.stringify(body) });
    if (res.status === 401) {
      // الرمز لم يعد صالحًا: نطلب الدخول مجددًا دون فقدان التعديلات المعلّقة
      clearSession();
      location.reload();
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const { rejected = [], version, etag } = (await res.json().catch(() => ({}))) as { rejected?: string[]; version?: string | null; etag?: string };
    // إشعار هذا الحفظ سيصل لهذا الجهاز أيضًا: لا داعي لجلب ما أرسله بنفسه
    if (version) knownVersion = version;
    // إزالة ما وصل فقط، وإبقاء ما تغيّر أثناء الإرسال
    const latest = readPending();
    for (const [key, ver] of Object.entries(pending)) if (latest[key] === ver) delete latest[key];
    // ما رفضه الخادم (لا صلاحية تعديل): لا يُعاد إرساله، وتُستعاد نسخة الخادم بهدوء
    rejected.forEach(k => { blocked.add(k); delete latest[k]; });
    for (const [k, v] of Object.entries(snapshots)) if (!rejected.includes(k)) setShadow(k, v);
    writePending(latest);
    flushGen++;
    // الجهاز متزامن (لا معلّق ولا جلب منتظر): بصمة نسخة حفظه هي بصمته، فلا تنزّل المزامنة الدورية النسخة الكاملة
    if (etag && !rejected.length && !Object.keys(latest).length && pullIdle()) stateEtag = etag;
    if (rejected.length) restoreRejected(rejected);
    flushing = false;
    if (Object.keys(latest).length) scheduleFlush(200);
    else setStatus('saved');
    // وصل تغيير من جهاز آخر أثناء الإرسال، أو مفاتيح تُركت لأنها كانت معلّقة هنا: تُجلب الآن
    onFlushDone?.();
  } catch (e) {
    flushing = false;
    // فشل الاتصال نفسه (TypeError) = غير متصل، حتى لو ظن المتصفح أن الشبكة متاحة (إشارة ضعيفة أو الخادم لا يُصل)
    setStatus(e instanceof TypeError || !navigator.onLine ? 'offline' : 'error');
    scheduleFlush(15000); // إعادة المحاولة لاحقًا، والتعديلات محفوظة محليًا حتى تصل
    // تعثّر الإرسال لا يوقف استلام تعديلات الأجهزة الأخرى (كانت الرئيسية تتجمّد حتى إعادة التحميل)
    onFlushDone?.();
  }
}

/** اعتراض الكتابة في localStorage حتى يُرسل أي تغيير للخادم تلقائيًا */
const installInterceptors = () => {
  Storage.prototype.setItem = function (key: string, value: string) {
    const changed = this === localStorage && shouldSync(key) && rawGet.call(this, key) !== String(value);
    rawSet.call(this, key, value);
    if (changed) markPending(key);
  };
  Storage.prototype.removeItem = function (key: string) {
    const existed = this === localStorage && shouldSync(key) && rawGet.call(this, key) !== null;
    rawRemove.call(this, key);
    if (existed) markPending(key);
  };
};

const localSyncKeys = () => Object.keys(localStorage).filter(shouldSync);

/** حدث يُطلق بعد تطبيق تعديلات أجهزة أخرى أثناء فتح الصفحة؛ detail = المفاتيح التي تغيّرت */
/** فُتح اتصال التحديث اللحظي (أول مرة أو بعد انقطاع) */
export const REALTIME_OPEN_EVENT = 'sahara:realtime-open';
/** صلاحيات هذا الحساب تغيّرت (إشارة من القناة اللحظية): خط النبض ثم تحديث الصفحة (PermsPulse) */
export const PERMS_CHANGED_EVENT = 'sahara:perms-changed';
export const CLOUD_APPLIED_EVENT = 'cloud-state-applied';

/**
 * إبلاغ الصفحات بمفاتيح وصلت من الخادم: الحدث المخصّص، وحدث storage لكل مفتاح
 * (كثير من الصفحات تستمع لـ storage فقط، فكانت لا تتحدث إلا بإعادة تحميل الصفحة)
 */
const notifyApplied = (keys: string[]) => {
  if (!keys.length) return;
  window.dispatchEvent(new CustomEvent(CLOUD_APPLIED_EVENT, { detail: keys }));
  for (const key of keys) {
    try {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: rawGet.call(localStorage, key), storageArea: localStorage }));
    } catch { /* متصفح قديم */ }
  }
};

/** مفاتيح وصل لها من الخادم ما يخالف القيمة المحلية وتُركت لأنها معلّقة هنا: تُجلب ثانيةً بعد الإرسال */
const skippedWhilePending = new Set<string>();

/**
 * يطبّق نسخة الخادم محليًا (عدا ما تغيّر هنا ولم يُرسل بعد). يعيد المفاتيح التي تغيّرت.
 * removed: للجلب الجزئي — المفاتيح المطلوبة غير الموجودة في الخادم (الحذف يُفحص ضمنها فقط، لا في كل المفاتيح)
 */
const applyServerState = (items: Record<string, string>, removed?: string[]): string[] => {
  const pending = readPending();
  const changed: string[] = [];
  // الأصغر أولًا والإشعارات آخرًا: إن امتلأت مساحة المتصفح (iPhone ≈5MB) لا يضيع ما بعد المفتاح الكبير
  const entries = Object.entries(items).sort((a, b) => (a[0] === 'sahara_notifications' ? 1 : 0) - (b[0] === 'sahara_notifications' ? 1 : 0) || a[1].length - b[1].length);
  for (const [key, value] of entries) {
    if (!shouldSync(key)) continue;
    if (key in pending) {
      // لا يُستبدل تعديل لم يُرسل، لكن لا يُنسى ما وصل: كان يبقى قديمًا حتى المزامنة الدورية (≈30 ثانية) أو الرفرش
      if (rawGet.call(localStorage, key) !== value) skippedWhilePending.add(key);
      continue;
    }
    // فشل حفظ مفتاح (امتلاء المساحة) لا يوقف بقية المفاتيح (كانت سجلات الأرصدة لا تصل لأجهزة iPhone الجديدة)
    try {
      if (rawGet.call(localStorage, key) !== value) {
        rawSet.call(localStorage, key, value);
        changed.push(key);
      }
      if (isCollection(key)) setShadow(key, value);
    } catch (e) {
      console.warn('cloud sync: could not store', key, e);
    }
  }
  // مفاتيح حُذفت من جهاز آخر
  for (const key of removed ?? localSyncKeys()) {
    if (!(key in items) && !(key in pending) && rawGet.call(localStorage, key) !== null) {
      rawRemove.call(localStorage, key);
      changed.push(key);
    }
  }
  return changed;
};

/** استعادة نسخة الخادم للمفاتيح المرفوضة (أو حذفها محليًا إن لم يكن مسموحًا بعرضها) */
const restoreRejected = async (keys: string[]) => {
  try {
    const res = await fetchState();
    if (!res.ok) return;
    const data = (await res.json()) as StateResponse;
    setBlocked(data);
    for (const k of keys) {
      if (k in data.items) rawSet.call(localStorage, k, data.items[k]);
      else rawRemove.call(localStorage, k);
      if (isCollection(k)) setShadow(k, k in data.items ? data.items[k] : null);
    }
    notifyApplied(keys);
  } catch {
    /* تجاهل */
  }
};

/**
 * بصمة آخر نسخة طُبّقت من الخادم (ETag). المزامنة الدورية ترسلها فيرد الخادم 304 بلا جسم إن لم يتغيّر شيء.
 * تُحفظ فقط بعد تطبيق النسخة فعلًا، حتى لا تُفوَّت نسخة تُركت بسبب تعديلات معلّقة
 */
let stateEtag: string | null = null;
const rememberEtag = (res: Response) => { stateEtag = res.headers.get('etag'); };
/** وقت آخر مزامنة خلفية: العودة المتكررة للتطبيق (التنقل بين التطبيقات في الهاتف) لا تكرر الطلب خلال 10 ثوانٍ */
let lastBackgroundSync = 0;

const fetchState = async (timeoutMs = 8000, conditional = false) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await api('/api/state', { signal: ctrl.signal, headers: conditional && stateEtag ? { 'if-none-match': stateEtag } : {} });
    // وصل الخادم بعد انقطاع (حتى لو لم يُطلق المتصفح حدث online): إرسال المعلّق وتحديث الحالة
    if (status === 'offline') {
      setStatus('saved');
      void flush();
    }
    return res;
  } finally {
    clearTimeout(t);
  }
};

export type InitResult = 'ready' | 'need-login';

/** يُستدعى قبل عرض التطبيق: يسحب آخر نسخة من الخادم ثم يفعّل الحفظ التلقائي */
export async function initCloudSync(): Promise<InitResult> {
  rawRemove.call(localStorage, TOKEN_KEY);
  // بقايا إعدادات Supabase القديمة (غير مستخدمة)
  for (const k of ['sahara_supabase_url', 'sahara_supabase_anon_key']) rawRemove.call(localStorage, k);
  if (!getToken()) return 'need-login';

  // جهاز بلا بيانات محلية (أول دخول أو بعد مسح المتصفح): لا نعرض التطبيق قبل وصول نسخة الخادم،
  // وإلا يبدأ بالبيانات الافتراضية ويرفعها فوق بيانات الخادم (حدث عند بطء تشغيل الخادم)
  const freshDevice = localSyncKeys().length === 0;

  /** تطبيق نسخة الخادم (أو رفع بيانات الجهاز إن كان الخادم فارغًا). يعيد المفاتيح التي تغيّرت */
  const adopt = (data: StateResponse): string[] => {
    setBlocked(data);
    if (!Object.keys(data.items).length && data.admin) {
      // الخادم فارغ (أول استخدام): رفع كل البيانات الموجودة في هذا الجهاز.
      // لمدير النظام فقط: الحساب المقيّد يستلم مفاتيح أقسامه فقط وقد تبدو له النسخة فارغة
      const p = readPending();
      localSyncKeys().forEach(k => { p[k] = (p[k] || 0) + 1; });
      writePending(p);
      return [];
    }
    return applyServerState(data.items);
  };

  if (freshDevice) {
    // جهاز بلا بيانات محلية: لا يُعرض التطبيق قبل وصول نسخة الخادم
    try {
      let res = await fetchState(30000);
      for (let attempt = 1; !res.ok && res.status !== 401 && attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        res = await fetchState(30000);
      }
      if (res.status === 401) {
        clearSession();
        return 'need-login';
      }
      if (!res.ok) throw new Error(String(res.status));
      adopt((await res.json()) as StateResponse);
      rememberEtag(res);
    } catch {
      // لم يصل الخادم: نعود لشاشة الدخول بدل البدء بالبيانات الافتراضية
      return 'need-login';
    }
    installInterceptors();
    flush();
  } else {
    // جهاز فيه بيانات: يُعرض التطبيق فورًا بالنسخة المحلية، ونسخة الخادم تُطبَّق عند وصولها
    // (كان العرض ينتظرها حتى 8 ثوانٍ عند كل فتح). التعديلات أثناء الانتظار تُعلَّم معلّقة فلا تُستبدل
    installInterceptors();
    void (async () => {
      try {
        const res = await fetchState(30000);
        if (res.status === 401) {
          clearSession();
          location.reload();
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const changed = adopt((await res.json()) as StateResponse);
        rememberEtag(res);
        if (changed.length) notifyApplied(changed);
        flush();
      } catch {
        // لا اتصال: نعمل بالنسخة المحلية، وعند عودة الاتصال تُجلب نسخة الخادم وتُرسل التعديلات
        setStatus('offline');
      }
    })();
  }

  // ───── جلب تعديلات الأجهزة الأخرى أثناء فتح الصفحة (بدون إعادة تحميل) ─────
  // إشعار التغيير يحمل أسماء المفاتيح التي تغيّرت، فيُجلب ما تغيّر فقط (بدل النسخة الكاملة لكل حفظ على كل جهاز).
  // الطلبات تتجمّع في قائمة واحدة: إشعار يصل أثناء جلب جارٍ يُضاف ولا يضيع، والفشل يُعاد بعد ثوانٍ لا بعد 30 ثانية.
  // التعديلات المعلّقة في هذا الجهاز لا توقف الجلب: تبقى كما هي، وما وصل لها يُجلب ثانيةً بعد إرسالها.
  let wantFull = false;
  const wantKeys = new Set<string>();
  let pulling: Promise<void> | null = null;
  let pullFailures = 0;
  let pullRetryTimer: ReturnType<typeof setTimeout> | undefined;

  /** جلب واحد: true = طُبّق (أو لا جديد)، false = فشل، 'again' = اكتمل إرسال أثناءه فيُعاد، 'later' = إرسال جارٍ */
  const fetchOnce = async (keys: string[] | null): Promise<boolean | 'again' | 'later'> => {
    if (flushing) return 'later';
    const gen = flushGen;
    lastBackgroundSync = Date.now();
    try {
      let res: Response;
      if (keys) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        try {
          res = await api(`/api/state?keys=${encodeURIComponent(keys.join(','))}`, { signal: ctrl.signal });
        } finally {
          clearTimeout(t);
        }
      } else {
        res = await fetchState(8000, true);
        if (res.status === 304) return true;
      }
      if (!res.ok) return false;
      const data = (await res.json()) as { items: Record<string, string>; removed?: string[]; v?: string };
      // اكتمل إرسال من هذا الجهاز أثناء الجلب: النسخة قد تسبقه، فيُعاد الجلب
      if (gen !== flushGen) return 'again';
      if (flushing) return 'later';
      const changed = applyServerState(data.items, keys ? (data.removed ?? []) : undefined);
      // الجلب الجزئي لآخر نسخة معروفة يُبقي الجهاز متزامنًا: تُحفظ بصمتها (وإلا نزّلت المزامنة الدورية كل شيء)
      if (!keys || (data.v && data.v === knownVersion && !wantFull && !wantKeys.size)) rememberEtag(res);
      if (changed.length) notifyApplied(changed);
      return true;
    } catch {
      return false;
    }
  };

  const drain = async () => {
    for (let guard = 0; guard < 10 && (wantFull || wantKeys.size); guard++) {
      const keys = wantFull ? null : [...wantKeys];
      wantFull = false;
      wantKeys.clear();
      const r = await fetchOnce(keys);
      if (r === true) {
        pullFailures = 0;
        continue;
      }
      // يُعاد ما لم يُجلب إلى القائمة
      if (keys) keys.forEach(k => wantKeys.add(k));
      else wantFull = true;
      if (r === 'again') continue;
      if (r === 'later') return; // يُكمل بعد انتهاء الإرسال (onFlushDone)
      // فشل (شبكة/ضغط على الخادم): إعادة بعد 1، 2، 4... ثوانٍ حتى 15 ثانية
      clearTimeout(pullRetryTimer);
      pullRetryTimer = setTimeout(() => void runPull(), Math.min(15_000, 1000 * 2 ** pullFailures++));
      return;
    }
  };
  const runPull = (): Promise<void> => {
    if (!pulling) pulling = drain().finally(() => { pulling = null; });
    else void pulling.then(() => { if (wantFull || wantKeys.size) void runPull(); });
    return pulling;
  };
  /** طلب جلب: مفاتيح محددة، أو النسخة الكاملة بلا مفاتيح */
  const pull = (keys?: string[]) => {
    if (keys?.length) keys.forEach(k => wantKeys.add(k));
    else wantFull = true;
    return runPull();
  };
  pullIdle = () => !pulling && !wantFull && !wantKeys.size && !skippedWhilePending.size;
  onFlushDone = () => {
    if (skippedWhilePending.size) {
      skippedWhilePending.forEach(k => wantKeys.add(k));
      skippedWhilePending.clear();
    }
    if (wantFull || wantKeys.size) void runPull();
  };

  // عودة الاتصال: إرسال التعديلات المعلّقة ثم جلب تعديلات الأجهزة الأخرى
  window.addEventListener('online', async () => {
    await flush();
    void pull();
  });
  // عند الإغلاق: محاولة أخيرة لإرسال ما تبقّى
  window.addEventListener('pagehide', () => {
    const pending = readPending();
    if (!Object.keys(pending).length || !getToken()) return;
    const body = JSON.stringify(buildPayload(pending).body);
    if (body.length < 60000) {
      fetch('/api/state', {
        method: 'PUT',
        keepalive: true,
        body,
        headers: { 'content-type': 'application/json', ...sessionHeaders() },
      }).catch(() => {});
    }
  });
  // عند العودة للتطبيق: جلب تعديلات الأجهزة الأخرى (الهاتف يوقف الاتصال في الخلفية فتفوته الإشعارات)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastBackgroundSync < 10_000 && !wantFull && !wantKeys.size) return;
    void pull();
  });

  /** إشعار تغيير ("رقم النسخة|المفاتيح"): يُجلب ما تغيّر فقط، أو النسخة الكاملة إن لم تُذكر المفاتيح */
  const onVersion = (msg: string) => {
    const sep = msg.indexOf('|');
    const v = sep < 0 ? msg : msg.slice(0, sep);
    if (!v || v === knownVersion) return;
    knownVersion = v;
    const keys = sep < 0 ? [] : msg.slice(sep + 1).split(',').filter(Boolean);
    void pull(keys.length ? keys : undefined);
  };

  // ───── القناة اللحظية (WebSocket): الخادم يبلّغ هذا الجهاز فور أي حفظ من أي جهاز ─────
  let socket: WebSocket | null = null;
  let socketOpen = false;
  let retries = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let lastSeen = 0;
  /** إسقاط اتصال ميت وفتح غيره فورًا (لا ننتظر إغلاقه، فقد لا يصل حدث الإغلاق أبدًا) */
  const dropSocket = (ws: WebSocket) => {
    if (socket !== ws) return;
    clearInterval(pingTimer);
    ws.onclose = null;
    ws.onmessage = null;
    try { ws.close(); } catch { /* مغلق */ }
    socket = null;
    socketOpen = false;
    retries = 0;
    connect();
  };
  const connect = () => {
    if (socket || !getToken() || typeof WebSocket === 'undefined') return;
    clearTimeout(retryTimer);
    const user = encodeURIComponent(sessionHeaders()['x-chat-user'] || '');
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/state/ws?u=${user}`);
    socket = ws;
    ws.onopen = () => {
      socketOpen = true;
      retries = 0;
      lastSeen = Date.now();
      // ما فات أثناء الانقطاع
      void pull();
      // عودة الاتصال: رفع نسخة جديدة يعيد تشغيل قناة التحديث فيعود اتصال كل الأجهزة، فتُفحص النسخة الآن (appUpdate)
      window.dispatchEvent(new Event(REALTIME_OPEN_EVENT));
      // نبضة تُبقي الاتصال حيًا عبر الشبكات (يرد عليها الخادم تلقائيًا دون تكلفة تشغيل).
      // اتصال "مفتوح" لا يرد (شبكة الهاتف أسقطته بصمت) لا يصله أي إشعار: يُغلق ويُعاد فورًا مع جلب ما فات
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (Date.now() - lastSeen > 45_000) {
          dropSocket(ws);
          return;
        }
        try { ws.send('ping'); } catch { dropSocket(ws); }
      }, 20_000);
    };
    ws.onmessage = e => {
      lastSeen = Date.now();
      if (e.data === 'perms') window.dispatchEvent(new Event(PERMS_CHANGED_EVENT));
      else if (typeof e.data === 'string' && e.data !== 'pong') onVersion(e.data);
    };
    ws.onclose = () => {
      clearInterval(pingTimer);
      socket = null;
      socketOpen = false;
      if (!getToken()) return;
      // إعادة الاتصال بتباعد متزايد (1، 2، 4... حتى 30 ثانية)
      retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retries++));
    };
    ws.onerror = () => ws.close();
  };
  connect();
  // العودة للتطبيق (الهاتف يغلق الاتصال في الخلفية): إعادة الاتصال فورًا
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!socket) {
      retries = 0;
      connect();
    } else if (socketOpen) {
      // فحص فوري للاتصال بعد الخلفية: إن لم يرد خلال 5 ثوانٍ يُعاد فتحه
      const ws = socket;
      const sentAt = Date.now();
      try { ws.send('ping'); } catch { dropSocket(ws); return; }
      setTimeout(() => { if (lastSeen < sentAt) dropSocket(ws); }, 5_000);
    }
  });
  window.addEventListener('online', () => {
    if (!socket) {
      retries = 0;
      connect();
    }
  });

  // احتياط إن لم تعمل القناة (شبكة تحجب WebSocket): سؤال خفيف عن رقم النسخة كل 3 ثوانٍ
  setInterval(async () => {
    if (socketOpen || document.visibilityState !== 'visible' || !getToken()) return;
    try {
      const res = await api('/api/state/version');
      if (!res.ok) return;
      const { v } = (await res.json()) as { v: string };
      // أول سؤال يحفظ الرقم فقط
      if (knownVersion === null) knownVersion = v;
      else onVersion(v);
    } catch {
      /* تجاهل */
    }
  }, 3_000);
  // احتياط أخير: نسخة كاملة كل 30 ثانية (تعديلات لا تغيّر رقم النسخة، مثل استرجاع نسخة احتياطية)
  setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 30_000);

  return 'ready';
}
