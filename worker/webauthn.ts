/**
 * التحقق من الدخول بالبصمة / بصمة الوجه (WebAuthn / Passkeys) بدون مكتبات خارجية.
 * البصمة نفسها لا تغادر الجهاز أبدًا: الجهاز يوقّع تحدّيًا عشوائيًا بمفتاح خاص محفوظ فيه،
 * والخادم يحفظ المفتاح العام فقط ويتحقق من التوقيع.
 */

export const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const fromB64url = (s: string): Uint8Array<ArrayBuffer> => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
export const randomChallenge = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

const sha256 = async (data: Uint8Array<ArrayBuffer>) => new Uint8Array(await crypto.subtle.digest('SHA-256', data));
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

export type ClientData = { type: string; challenge: string; origin: string };
export const parseClientData = (b64: string): ClientData | null => {
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(b64)));
  } catch {
    return null;
  }
};

/** توقيع ECDSA من الجهاز بصيغة DER ← الصيغة الخام r||s التي تقبلها WebCrypto */
const derToRaw = (der: Uint8Array) => {
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  const read = () => {
    if (der[i++] !== 0x02) throw new Error('bad der');
    const len = der[i++];
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = read();
  const s = read();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
};

/**
 * التحقق من توقيع تسجيل الدخول بالبصمة.
 * يعيد عدّاد التوقيعات الجديد عند النجاح، أو رسالة الخطأ.
 */
export async function verifyAssertion(opts: {
  publicKey: string; // SPKI بصيغة base64url
  alg: number; // -7 = ES256 ، -257 = RS256
  rpId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
}): Promise<{ ok: true; signCount: number } | { ok: false; error: string }> {
  const auth = fromB64url(opts.authenticatorData);
  if (auth.length < 37) return { ok: false, error: 'بيانات الجهاز غير صالحة' };
  // أول 32 بايت = بصمة اسم الموقع: تمنع استخدام البصمة على موقع مزيّف
  if (!sameBytes(auth.slice(0, 32), await sha256(new TextEncoder().encode(opts.rpId)))) return { ok: false, error: 'الموقع غير مطابق' };
  const flags = auth[32];
  // UP = لمس المستخدم ، UV = تحقّق بالبصمة أو الوجه أو رمز الجهاز
  if (!(flags & 0x01) || !(flags & 0x04)) return { ok: false, error: 'لم يتم التحقق بالبصمة' };
  const signCount = new DataView(auth.buffer, auth.byteOffset + 33, 4).getUint32(0);

  const clientHash = await sha256(fromB64url(opts.clientDataJSON));
  const signed = new Uint8Array(auth.length + clientHash.length);
  signed.set(auth, 0);
  signed.set(clientHash, auth.length);
  const sig = fromB64url(opts.signature);
  const spki = fromB64url(opts.publicKey);

  try {
    let valid = false;
    if (opts.alg === -7) {
      const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sig), signed);
    } else if (opts.alg === -257) {
      const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signed);
    } else {
      return { ok: false, error: 'نوع المفتاح غير مدعوم' };
    }
    return valid ? { ok: true, signCount } : { ok: false, error: 'توقيع البصمة غير صحيح' };
  } catch {
    return { ok: false, error: 'تعذّر التحقق من البصمة' };
  }
}

/** التأكد من صلاحية المفتاح العام عند التسجيل (يُرفض أي مفتاح لا يمكن استيراده) */
export async function checkPublicKey(publicKey: string, alg: number) {
  try {
    const spki = fromB64url(publicKey);
    if (alg === -7) await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    else if (alg === -257) await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    else return false;
    return true;
  } catch {
    return false;
  }
}
