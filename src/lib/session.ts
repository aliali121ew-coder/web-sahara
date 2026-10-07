import i18n from '../i18n';
import { serverText } from '../i18n/errors';
import type { Perms } from './permCatalog';
import { useEffect, useState } from 'react';

/**
 * جلسة الدخول للبرنامج: حساب معتمد (اسم مستخدم + كلمة مرور) يصدره مدير النظام.
 * الجلسة نفسها تفتح البرنامج والمحادثة معًا. رمزها السرّي في كوكي HttpOnly يديره الخادم والمتصفح
 * (لا تقرؤه سكربتات الصفحة)، ويحفظ التطبيق محليًا معرّف الحساب ووقت بدء الجلسة فقط.
 */

export const SESSION_USER_KEY = 'sahara_chat_me';
/** مكان رمز الجلسة قديمًا (قبل الكوكي): يُمسح فقط */
const LEGACY_SESSION_KEY = 'sahara_chat_key';
/** نسخة محلية من بيانات الحساب لعرضها فورًا (الاسم، الوظيفة، الصلاحية) */
export const SESSION_PROFILE_KEY = 'sahara_session_profile';
export const LAST_USER_KEY = 'sahara_last_username';
/** اسم آخر مستخدم لعبارة «مرحبًا مجددًا» (يبقى بعد انتهاء الجلسة) */
export const LAST_NAME_KEY = 'sahara_last_name';
/** وقت بدء الجلسة: تنتهي بعد 24 ساعة ويُطلب تسجيل الدخول من جديد */
const SESSION_STARTED_KEY = 'sahara_session_started';
export const SESSION_MAX_MS = 24 * 3600_000;
/** بصمة هذا الجهاز: اسم المستخدم ومعرّف مفتاح البصمة المسجّل عليه */
export const BIO_USER_KEY = 'sahara_bio_user';
const BIO_CRED_KEY = 'sahara_bio_cred';

export interface SessionProfile {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  is_admin: number;
  /** صلاحيات الأقسام (راجع permCatalog.ts) */
  perms?: Perms;
}

/**
 * «تذكّرني»: معرّف الجلسة في localStorage (يبقى بعد إغلاق المتصفح).
 * بدونه: في sessionStorage (ينتهي بإغلاق التبويب).
 */
const read = (k: string) => {
  try { return localStorage.getItem(k) || sessionStorage.getItem(k) || ''; } catch { return ''; }
};
export const getSessionUser = () => read(SESSION_USER_KEY);
/** وقت بدء الجلسة الحالية (ms) أو 0 */
export const getSessionStarted = () => Number(read(SESSION_STARTED_KEY)) || 0;

/** هل توجد جلسة صالحة؟ الجلسة الأقدم من 24 ساعة تُمسح حتى بدون اتصال بالخادم */
export const hasSession = () => {
  if (!read(SESSION_USER_KEY)) return false;
  const started = Number(read(SESSION_STARTED_KEY)) || 0;
  if (Date.now() - started > SESSION_MAX_MS) {
    clearSession();
    return false;
  }
  return true;
};

/** ترويسة معرّف الحساب: يطابقها الخادم مع كوكي الجلسة (ترويسة مخصّصة = حماية من تزوير الطلبات من مواقع أخرى) */
export const sessionHeaders = (): Record<string, string> => ({
  'x-chat-user': read(SESSION_USER_KEY),
});

export const getProfile = (): SessionProfile | null => {
  try { return JSON.parse(read(SESSION_PROFILE_KEY) || 'null'); } catch { return null; }
};

export class AuthError extends Error {
  constructor(message: string, public code?: string, public retryAt?: number) { super(message); }
}

async function post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError(i18n.t('auth:errors.offline'), 'offline');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string; retryAt?: number };
  if (!res.ok) throw new AuthError(serverText(data, i18n.t('server:errors.network')), data.code || (data.error ? undefined : 'network'), data.retryAt);
  return data;
}

/** الخادم وضع رمز الجلسة في الكوكي؛ نحفظ هنا المعرّف ووقت البدء فقط */
const store = (r: { id: string }, remember: boolean) => {
  clearSession();
  const target = remember ? localStorage : sessionStorage;
  target.setItem(SESSION_USER_KEY, r.id);
  target.setItem(SESSION_STARTED_KEY, String(Date.now()));
};

/** هل النظام بحاجة لإعداد أول (لا توجد حسابات بعد)؟ */
export async function authStatus(): Promise<{ setup: boolean }> {
  const res = await fetch('/api/chat/auth/status', { cache: 'no-store' });
  if (!res.ok) throw new AuthError('تعذّر الاتصال بالخادم', 'network');
  return res.json();
}

export async function loginAccount(username: string, password: string, remember = true) {
  store(await post<{ id: string }>('/api/chat/auth/login', { username, password, remember }), remember);
  localStorage.setItem(LAST_USER_KEY, username);
}

/** الإعداد الأول: إنشاء حساب مدير النظام برمز تفعيل النظام */
export async function setupSystem(code: string, body: { username: string; password: string; name: string }) {
  store(await post<{ id: string }>('/api/chat/auth/setup', body, { 'x-app-token': code }), true);
  localStorage.setItem(LAST_USER_KEY, body.username);
}

/** إرسال طلب دعم لمدير النظام من شاشة الدخول */
export async function sendSupportRequest(body: { name: string; phone: string; username: string; kind: string; message: string }) {
  await post('/api/chat/auth/support', body);
}

/** جلب بيانات الحساب الحالي وتخزينها محليًا */
export async function refreshProfile(): Promise<SessionProfile | null> {
  try {
    const res = await fetch('/api/chat/auth/me', { cache: 'no-store', headers: sessionHeaders() });
    if (!res.ok) return getProfile();
    const { user } = (await res.json()) as { user: SessionProfile };
    localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(user));
    localStorage.setItem(LAST_NAME_KEY, user.name);
    window.dispatchEvent(new CustomEvent('session-profile', { detail: user }));
    return user;
  } catch {
    return getProfile();
  }
}

/** مسح الجلسة من هذا الجهاز فقط */
export const clearSession = () => {
  for (const s of [localStorage, sessionStorage]) {
    s.removeItem(SESSION_USER_KEY);
    s.removeItem(LEGACY_SESSION_KEY);
    s.removeItem(SESSION_STARTED_KEY);
  }
  localStorage.removeItem(SESSION_PROFILE_KEY);
};

// جلسة قديمة كان رمزها في التخزين المحلي: لا تصلح مع الكوكي، فتُمسح ويُطلب الدخول مرة واحدة
try {
  if (localStorage.getItem(LEGACY_SESSION_KEY) || sessionStorage.getItem(LEGACY_SESSION_KEY)) clearSession();
} catch { /* تجاهل */ }

/** تسجيل الخروج: إلغاء الجلسة على الخادم (ومسح الكوكي) ثم العودة لشاشة الدخول */
export async function logout() {
  try {
    await fetch('/api/chat/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json', ...sessionHeaders() }, body: '{}' });
  } catch { /* الجلسة تُمسح محليًا في كل الأحوال */ }
  clearSession();
  location.reload();
}

/** مراقبة انتهاء الجلسة أثناء فتح البرنامج: بعد 24 ساعة يعود لشاشة الترحيب */
export function watchSessionExpiry() {
  const check = () => { if (!hasSession()) location.reload(); };
  setInterval(check, 60_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
}

// ═════ الدخول بالبصمة / بصمة الوجه (WebAuthn) ═════
const toB64url = (buf: ArrayBuffer) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
const bioError = (e: unknown) => {
  const name = (e as Error)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return new AuthError('تم إلغاء التحقق بالبصمة', 'cancelled');
  if (name === 'InvalidStateError') return new AuthError('البصمة مفعّلة مسبقًا على هذا الجهاز', 'exists');
  return e instanceof AuthError ? e : new AuthError('تعذّر استخدام البصمة على هذا الجهاز', 'bio_device');
};

/** هل يدعم الجهاز البصمة أو بصمة الوجه (مستشعر مدمج)؟ */
export async function biometricAvailable() {
  try {
    return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
/** اسم المستخدم المفعّل له الدخول بالبصمة على هذا الجهاز */
export const biometricUser = () => { try { return localStorage.getItem(BIO_USER_KEY) || ''; } catch { return ''; } };

/**
 * تفعيل البصمة لحسابي على هذا الجهاز (يتطلب جلسة).
 * الخادم يشترط دخولًا بكلمة المرور خلال آخر 10 دقائق، وإلا تُمرَّر كلمة المرور هنا (رمز الخطأ reauth_required)
 */
export async function enableBiometric(password?: string) {
  const headers = sessionHeaders();
  const o = await post<{
    challenge: string; rp: { id: string; name: string }; user: { id: string; name: string; displayName: string };
    pubKeyCredParams: PublicKeyCredentialParameters[]; authenticatorSelection: AuthenticatorSelectionCriteria;
    excludeCredentials: { type: 'public-key'; id: string }[]; timeout: number;
  }>('/api/chat/auth/webauthn/register-options', password ? { password } : {}, headers);
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        challenge: fromB64url(o.challenge),
        rp: o.rp,
        user: { id: new TextEncoder().encode(o.user.id), name: o.user.name, displayName: o.user.displayName },
        pubKeyCredParams: o.pubKeyCredParams,
        authenticatorSelection: o.authenticatorSelection,
        excludeCredentials: o.excludeCredentials.map(c => ({ type: c.type, id: fromB64url(c.id) })),
        timeout: o.timeout,
        attestation: 'none',
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw bioError(e);
  }
  const res = cred.response as AuthenticatorAttestationResponse;
  const spki = res.getPublicKey?.();
  if (!spki) throw new AuthError('هذا المتصفح لا يدعم الدخول بالبصمة، حدّثه وحاول مجددًا', 'bio_unsupported');
  await post('/api/chat/auth/webauthn/register', {
    id: cred.id,
    clientDataJSON: toB64url(res.clientDataJSON),
    publicKey: toB64url(spki),
    alg: res.getPublicKeyAlgorithm(),
    label: navigator.userAgent.slice(0, 80),
  }, headers);
  localStorage.setItem(BIO_USER_KEY, o.user.name);
  localStorage.setItem(BIO_CRED_KEY, cred.id);
}

/** إيقاف البصمة على هذا الجهاز */
export async function disableBiometric() {
  const id = localStorage.getItem(BIO_CRED_KEY);
  if (id) {
    await fetch(`/api/chat/auth/webauthn/credentials/${encodeURIComponent(id)}`, { method: 'DELETE', headers: sessionHeaders() }).catch(() => {});
  }
  localStorage.removeItem(BIO_USER_KEY);
  localStorage.removeItem(BIO_CRED_KEY);
}

/** تسجيل الدخول بالبصمة أو بصمة الوجه */
export async function loginWithBiometric(username: string) {
  const o = await post<{ challenge: string; rpId: string; timeout: number; allowCredentials: { type: 'public-key'; id: string }[] }>(
    '/api/chat/auth/webauthn/login-options', { username });
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        challenge: fromB64url(o.challenge),
        rpId: o.rpId,
        timeout: o.timeout,
        userVerification: 'required',
        allowCredentials: o.allowCredentials.map(c => ({ type: c.type, id: fromB64url(c.id), transports: ['internal'] as AuthenticatorTransport[] })),
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw bioError(e);
  }
  const res = cred.response as AuthenticatorAssertionResponse;
  try {
    store(await post<{ id: string }>('/api/chat/auth/webauthn/login', {
      id: cred.id,
      clientDataJSON: toB64url(res.clientDataJSON),
      authenticatorData: toB64url(res.authenticatorData),
      signature: toB64url(res.signature),
    }), true);
  } catch (e) {
    // المفتاح حُذف من الخادم (مثلًا بعد إعادة تعيين الحساب): أوقف البصمة على هذا الجهاز
    if (e instanceof AuthError && /غير مسجلة/.test(e.message)) { localStorage.removeItem(BIO_USER_KEY); localStorage.removeItem(BIO_CRED_KEY); }
    throw e;
  }
  localStorage.setItem(LAST_USER_KEY, username);
}

/** بيانات الحساب الحالي مع التحديث عند وصول نسخة أحدث من الخادم */
export function useSessionProfile() {
  const [profile, setProfile] = useState<SessionProfile | null>(getProfile);
  useEffect(() => {
    const on = (e: Event) => setProfile((e as CustomEvent<SessionProfile>).detail);
    window.addEventListener('session-profile', on);
    return () => window.removeEventListener('session-profile', on);
  }, []);
  return profile;
}

/** الحرف الأول من الاسم للصورة الرمزية */
export const initials = (name?: string) => (name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || (document.documentElement.lang === 'ar' ? '؟' : '?');
