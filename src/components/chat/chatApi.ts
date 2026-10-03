import type { Perms } from '../../lib/permCatalog';
import { sessionHeaders } from '../../lib/session';

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  bio: string;
  avatar: string;
  color: string;
  last_seen: number;
  typing_room: string;
  typing_at: number;
  updated_at: number;
}

/** حساب مصادقة (كما يراه صاحبه أو مدير النظام) */
export interface Account {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  is_admin: number;
  disabled: number;
  last_seen: number;
  updated_at: number;
  /** صلاحيات الأقسام (راجع src/lib/permCatalog.ts) */
  perms?: Perms;
}

/** سطر في سجل عمليات المستخدمين */
export interface AuditEntry {
  id: number;
  at: number;
  user_id: string;
  username: string;
  action: string;
  detail: string;
  ip: string;
}

/** طلب دعم مُرسل من شاشة الدخول */
export interface SupportRequest {
  id: string;
  name: string;
  phone: string;
  username: string;
  kind: 'account' | 'password' | 'other';
  message: string;
  status: 'open' | 'done';
  created_at: number;
}

export interface ChatRoom {
  id: string;
  type: 'group' | 'direct';
  name: string;
  description: string;
  avatar: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  /** الرسالة المثبّتة أعلى المحادثة */
  pinned_msg?: string;
}

export interface ChatMember {
  room_id: string;
  user_id: string;
  role: 'admin' | 'member';
  last_read: number;
  muted: number;
  pinned: number;
  joined_at: number;
}

export interface Attachment {
  fileId: string;
  name: string;
  type: string;
  size: number;
  /** صورة مصغّرة سريعة للصور والفيديو */
  thumb?: string;
  width?: number;
  height?: number;
  /** مدة الصوت / الفيديو بالثواني */
  duration?: number;
  /** قمم الموجة الصوتية للبصمات (0..1) */
  peaks?: number[];
  /** عدد صفحات PDF */
  pages?: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  kind: 'text' | 'file' | 'voice' | 'system';
  text: string;
  reply_to: string;
  attachments: Attachment[];
  reactions: Record<string, string[]>;
  urgent: number;
  edited: number;
  deleted: number;
  created_at: number;
  updated_at: number;
  /** حالات محلية فقط */
  pending?: boolean;
  failed?: boolean;
  progress?: number;
  localFiles?: File[];
}

export interface SyncPayload {
  now: number;
  roomIds: string[];
  users: ChatUser[];
  presence: Pick<ChatUser, 'id' | 'last_seen' | 'typing_room' | 'typing_at'>[];
  rooms: ChatRoom[];
  members: ChatMember[];
  messages: ChatMessage[];
}


/** ترويسات جلسة الحساب الحالية (المعرّف + رمز الجلسة) */
const authHeaders = sessionHeaders;

export class ChatApiError extends Error {
  /** وقت انتهاء القفل المؤقت لتسجيل الدخول */
  constructor(message: string, public status: number, public code?: string, public retryAt?: number) { super(message); }
}
/** انتهت/رُفضت جلسة حساب المحادثة (وليس رمز دخول التطبيق) */
export const isChatAuthError = (e: unknown) => e instanceof ChatApiError && e.code === 'chat_auth';

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch('/api/chat' + path, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...authHeaders(), ...(init.headers || {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string; retryAt?: number };
  if (!res.ok) throw new ChatApiError(data.error || 'تعذّر الاتصال بالخادم', res.status, data.code, data.retryAt);
  return data;
}

const send = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const chatApi = {
  sync: (me: string, since: number, signal?: AbortSignal) =>
    call<SyncPayload>(`/sync?me=${encodeURIComponent(me)}&since=${since}`, { signal }),
  users: () => call<{ items: ChatUser[] }>('/users'),
  saveProfile: (p: Partial<ChatUser>) => call<{ id: string }>('/profile', send('PUT', p)),
  // ───── الحساب (الدخول نفسه في src/lib/session.ts) ─────
  account: () => call<{ user: Account }>('/auth/me'),
  changePassword: (current: string, next: string) => call('/auth/password', send('POST', { current, next })),
  // ───── إدارة الحسابات (للمدير) ─────
  adminUsers: () => call<{ items: Account[]; max: number }>('/admin/users'),
  adminCreate: (body: { username: string; password: string; name: string; role: string; is_admin: boolean; perms?: Perms }) => call<{ id: string }>('/admin/users', send('POST', body)),
  adminSupport: () => call<{ items: SupportRequest[] }>('/admin/support'),
  adminAudit: (q: { user?: string; action?: string; before?: number; limit?: number } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return call<{ items: AuditEntry[]; more: boolean }>(`/admin/audit?${p}`);
  },
  adminSupportStatus: (id: string, status: 'open' | 'done') => call(`/admin/support/${encodeURIComponent(id)}`, send('PATCH', { status })),
  adminUpdate: (id: string, body: { name?: string; role?: string; password?: string; is_admin?: boolean; disabled?: boolean; perms?: Perms }) =>
    call(`/admin/users/${encodeURIComponent(id)}`, send('PATCH', body)),
  typing: (me: string, room: string) => call('/typing', send('POST', { me, room })),
  read: (me: string, room: string, at: number) => call('/read', send('POST', { me, room, at })),
  prefs: (me: string, room: string, prefs: { muted?: boolean; pinned?: boolean }) => call('/prefs', send('POST', { me, room, ...prefs })),
  createRoom: (body: { me: string; type: 'group' | 'direct'; name?: string; description?: string; avatar?: string; members: string[] }) =>
    call<{ id: string }>('/rooms', send('POST', body)),
  updateRoom: (room: string, body: { me: string; name: string; description: string; avatar: string }) =>
    call(`/rooms/${encodeURIComponent(room)}`, send('PATCH', body)),
  members: (room: string, body: { me: string; add?: string[]; remove?: string[]; admin?: string }) =>
    call(`/rooms/${encodeURIComponent(room)}/members`, send('POST', body)),
  sendMessage: (body: { id: string; me: string; room: string; kind: string; text: string; replyTo?: string; attachments: Attachment[]; urgent?: boolean }) =>
    call<{ id: string; created_at: number }>('/messages', send('POST', body)),
  editMessage: (id: string, me: string, text: string) => call(`/messages/${encodeURIComponent(id)}`, send('PATCH', { me, text })),
  deleteMessage: (id: string, me: string) => call(`/messages/${encodeURIComponent(id)}`, send('DELETE', { me })),
  pin: (room: string, me: string, msg: string) => call(`/rooms/${encodeURIComponent(room)}/pin`, send('POST', { me, msg })),
  info: (id: string, me: string) => call<{ seen: { user_id: string; at: number }[] }>(`/messages/${encodeURIComponent(id)}/info?me=${encodeURIComponent(me)}`),
  react: (id: string, me: string, emoji: string) => call(`/messages/${encodeURIComponent(id)}/react`, send('POST', { me, emoji })),
};

/** رفع ملف مع نسبة التقدّم */
export const uploadFile = (file: Blob, name: string, onProgress?: (p: number) => void) =>
  new Promise<{ id: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/chat/files?name=${encodeURIComponent(name)}`);
    for (const [k, v] of Object.entries(authHeaders())) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data.item);
        else reject(new Error(data.error || 'فشل رفع الملف'));
      } catch {
        reject(new Error('فشل رفع الملف'));
      }
    };
    xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
    xhr.send(file);
  });

/** روابط محلية للملفات بعد تنزيلها مرة واحدة (الملفات لا تتغيّر أبدًا) */
const blobCache = new Map<string, Promise<string>>();
export const fileUrl = (fileId: string, type: string) => {
  let p = blobCache.get(fileId);
  if (!p) {
    p = fetch(`/api/chat/files/${encodeURIComponent(fileId)}`, { headers: authHeaders() })
      .then(r => {
        if (!r.ok) throw new Error('الملف غير متاح');
        return r.blob();
      })
      .then(b => URL.createObjectURL(new Blob([b], { type: type || b.type })));
    p.catch(() => blobCache.delete(fileId));
    blobCache.set(fileId, p);
  }
  return p;
};
/** تسجيل رابط محلي لملف أرسلناه للتو حتى لا يُعاد تنزيله */
export const primeFileUrl = (fileId: string, blob: Blob) => {
  blobCache.set(fileId, Promise.resolve(URL.createObjectURL(blob)));
};

export const downloadFile = async (a: Attachment) => {
  const url = await fileUrl(a.fileId, a.type);
  const link = document.createElement('a');
  link.href = url;
  link.download = a.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
};
