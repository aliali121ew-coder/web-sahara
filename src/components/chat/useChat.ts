import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearSession, getSessionUser, hasSession, logout as appLogout } from '../../lib/session';
import { chatApi, isChatAuthError, uploadFile, primeFileUrl, type Attachment, type ChatMember, type ChatMessage, type ChatRoom, type ChatUser, type SyncPayload, type Account } from './chatApi';
import { audioPeaks, pdfThumb, isAudio, isImage, isVideo, resizeImage, uid, videoThumb, ONLINE_MS, TYPING_MS } from './chatUtils';

const SOUND_KEY = 'sahara_chat_sound';
const HIDDEN_KEY = 'sahara_chat_hidden';
const STAR_KEY = 'sahara_chat_starred';
/** الحذف للجميع مسموح خلال ساعة (يطابق الخادم) */
export const DELETE_WINDOW_MS = 60 * 60_000;

const loadSet = (key: string) => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set<string>(); }
};
const saveSet = (key: string, set: Set<string>) => {
  try { localStorage.setItem(key, JSON.stringify([...set].slice(-3000))); } catch { /* تجاهل */ }
};

/** هل تشير الرسالة إليّ؟ (@اسمي أو @الكل) */
export const mentionsMe = (text: string, name?: string) =>
  !!text && (text.includes('@الكل') || (!!name && text.includes('@' + name)));
const POLL_VISIBLE = 1200;
const POLL_HIDDEN = 8000;

export type ConnState = 'connecting' | 'online' | 'offline';

export interface RoomView {
  room: ChatRoom;
  title: string;
  avatar: string;
  color: string;
  peer?: ChatUser;
  members: ChatMember[];
  myMember?: ChatMember;
  last?: ChatMessage;
  unread: number;
  mentioned: boolean;
  online: boolean;
  typing: ChatUser[];
}

let audioCtx: AudioContext | null = null;
const chime = () => {
  try {
    audioCtx = audioCtx || new AudioContext();
    const t = audioCtx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.35);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.4);
    });
  } catch {
    /* لا صوت */
  }
};

const sortMsgs = (list: ChatMessage[]) => list.sort((a, b) => a.created_at - b.created_at);

export function useChat() {
  const [meId] = useState<string>(getSessionUser);
  const [users, setUsers] = useState<Record<string, ChatUser>>({});
  const [rooms, setRooms] = useState<Record<string, ChatRoom>>({});
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [conn, setConn] = useState<ConnState>('connecting');
  const [loaded, setLoaded] = useState(false);
  const [sound, setSoundState] = useState(() => localStorage.getItem(SOUND_KEY) !== 'off');
  const [, setTick] = useState(0);
  const [hidden, setHidden] = useState(() => loadSet(HIDDEN_KEY));
  const [starred, setStarred] = useState(() => loadSet(STAR_KEY));
  const meNameRef = useRef('');

  const sinceRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const inflight = useRef<AbortController | null>(null);
  const activeRoomRef = useRef('');
  const soundRef = useRef(sound);
  const mutedRef = useRef<Set<string>>(new Set());
  soundRef.current = sound;

  const setSound = (v: boolean) => {
    setSoundState(v);
    localStorage.setItem(SOUND_KEY, v ? 'on' : 'off');
  };

  const apply = useCallback((p: SyncPayload, meIdNow: string) => {
    const firstLoad = sinceRef.current === 0;
    sinceRef.current = Math.max(0, p.now - 5000);

    setUsers(prev => {
      const next = { ...prev };
      for (const u of p.users) next[u.id] = u;
      for (const pr of p.presence) if (next[pr.id]) next[pr.id] = { ...next[pr.id], ...pr };
      return next;
    });
    setRooms(prev => {
      const next: Record<string, ChatRoom> = {};
      for (const id of p.roomIds) if (prev[id]) next[id] = prev[id];
      for (const r of p.rooms) next[r.id] = r;
      return next;
    });
    setMembers(p.members);
    mutedRef.current = new Set(p.members.filter(m => m.user_id === meIdNow && m.muted).map(m => m.room_id));

    let incoming: ChatMessage | null = null;
    setMessages(prev => {
      const next: Record<string, ChatMessage[]> = {};
      for (const id of p.roomIds) next[id] = prev[id] || [];
      const touched = new Set<string>();
      for (const m of p.messages) {
        if (!next[m.room_id]) continue;
        const list = touched.has(m.room_id) ? next[m.room_id] : [...next[m.room_id]];
        touched.add(m.room_id);
        const i = list.findIndex(x => x.id === m.id);
        if (i >= 0) {
          if (list[i].pending || list[i].updated_at <= m.updated_at) list[i] = m;
        } else {
          list.push(m);
          if (!firstLoad && m.user_id !== meIdNow && m.kind !== 'system') incoming = m;
        }
        next[m.room_id] = list;
      }
      touched.forEach(id => sortMsgs(next[id]));
      return next;
    });

    const inc = incoming as ChatMessage | null;
    // الإشارة إليّ تتجاوز الكتم
    if (inc && (!mutedRef.current.has(inc.room_id) || mentionsMe(inc.text, meNameRef.current))) {
      if (soundRef.current) chime();
      if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(mentionsMe(inc.text, meNameRef.current) ? 'أشار إليك أحدهم' : 'رسالة جديدة', { body: inc.text || '📎 مرفق', icon: '/icon-192.png', tag: inc.room_id });
        } catch {
          /* تجاهل */
        }
      }
    }
    setLoaded(true);
  }, []);

  const poll = useCallback(async () => {
    clearTimeout(timerRef.current);
    const id = getSessionUser();
    if (!id) return;
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      const p = await chatApi.sync(id, sinceRef.current, ctrl.signal);
      apply(p, id);
      setConn('online');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      // مفتاح الحساب غير صالح (تغيّر من جهاز آخر أو حُذف): اخرج وأظهر شاشة الدخول
      if (isChatAuthError(e)) { logoutRef.current(); return; }
      setConn('offline');
    }
    if (inflight.current === ctrl) inflight.current = null;
    timerRef.current = setTimeout(poll, document.visibilityState === 'visible' ? POLL_VISIBLE : POLL_HIDDEN);
  }, [apply]);

  // جلسة هذا الجهاز (رمز يصدره الخادم عند تسجيل الدخول)
  const [keyReady] = useState(hasSession);
  const [account, setAccount] = useState<Account>();
  useEffect(() => {
    if (!meId || !keyReady) return;
    chatApi.account()
      .then(r => setAccount(r.user))
      .catch(e => { if (isChatAuthError(e)) logoutRef.current(); });
  }, [meId, keyReady]);

  useEffect(() => {
    if (!meId || !keyReady) return;
    sinceRef.current = 0;
    poll();
    const onVis = () => document.visibilityState === 'visible' && poll();
    const onOnline = () => poll();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    // تحديث نصوص "آخر ظهور" ومؤشرات الكتابة
    const tick = setInterval(() => setTick(t => t + 1), 5000);
    return () => {
      clearTimeout(timerRef.current);
      inflight.current?.abort();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      clearInterval(tick);
    };
  }, [meId, keyReady, poll]);

  const me = meId ? users[meId] : undefined;
  meNameRef.current = me?.name || '';

  // ───── الحساب ─────
  const saveProfile = async (p: Partial<ChatUser>) => {
    const { id } = await chatApi.saveProfile({ ...p, id: undefined });
    poll();
    return id;
  };
  const changePassword = (current: string, next: string) => chatApi.changePassword(current, next);
  /** تسجيل الخروج من البرنامج كله (الجلسة واحدة للبرنامج والمحادثة) */
  const logout = () => { appLogout(); };
  const clearLocal = () => { clearSession(); location.reload(); };

  const logoutRef = useRef(clearLocal);
  logoutRef.current = clearLocal;

  // ───── الإرسال ─────
  const patchLocal = (room: string, id: string, patch: Partial<ChatMessage>) =>
    setMessages(prev => ({ ...prev, [room]: (prev[room] || []).map(m => (m.id === id ? { ...m, ...patch } : m)) }));

  const describe = async (file: File): Promise<Partial<Attachment>> => {
    if (isImage(file.type) && !file.type.includes('svg')) {
      try {
        const r = await resizeImage(file, 420, 0.7);
        return { thumb: r.dataUrl, width: r.width, height: r.height };
      } catch {
        return {};
      }
    }
    if (isVideo(file.type)) return videoThumb(file);
    if (isAudio(file.type)) return audioPeaks(file);
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return pdfThumb(file);
    return {};
  };

  const deliver = async (msg: ChatMessage, extra: Attachment[] = []) => {
    const files = msg.localFiles || [];
    try {
      const attachments: Attachment[] = [...extra];
      let done = 0;
      const total = files.reduce((a, f) => a + f.size, 0) || 1;
      for (const f of files) {
        const meta = await describe(f);
        const up = await uploadFile(f, f.name, p => patchLocal(msg.room_id, msg.id, { progress: (done + p * f.size) / total }));
        primeFileUrl(up.id, f);
        done += f.size;
        attachments.push({ fileId: up.id, name: f.name, type: f.type || 'application/octet-stream', size: f.size, ...meta });
      }
      const res = await chatApi.sendMessage({
        id: msg.id, me: meId, room: msg.room_id, kind: msg.kind, text: msg.text,
        replyTo: msg.reply_to || undefined, attachments, urgent: !!msg.urgent,
      });
      patchLocal(msg.room_id, msg.id, { pending: false, failed: false, progress: undefined, attachments, created_at: res.created_at, localFiles: undefined });
      poll();
    } catch {
      patchLocal(msg.room_id, msg.id, { failed: true, progress: undefined });
    }
  };

  const sendMessage = (room: string, opts: { text?: string; files?: File[]; replyTo?: string; urgent?: boolean; voice?: { blob: Blob; duration: number; peaks: number[] } }) => {
    const now = Date.now();
    const localAttachments: Attachment[] = (opts.files || []).map(f => ({ fileId: '', name: f.name, type: f.type, size: f.size }));
    const msg: ChatMessage = {
      id: uid(), room_id: room, user_id: meId,
      kind: opts.voice ? 'voice' : opts.files?.length ? 'file' : 'text',
      text: (opts.text || '').trim(), reply_to: opts.replyTo || '',
      attachments: opts.voice ? [{ fileId: '', name: 'voice', type: opts.voice.blob.type, size: opts.voice.blob.size, duration: opts.voice.duration, peaks: opts.voice.peaks }] : localAttachments,
      reactions: {}, urgent: opts.urgent ? 1 : 0, edited: 0, deleted: 0, created_at: now, updated_at: now,
      pending: true, progress: opts.files?.length || opts.voice ? 0 : undefined, localFiles: opts.files,
    };
    setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), msg] }));

    if (opts.voice) {
      const { blob, duration, peaks } = opts.voice;
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
      const name = `بصمة-صوتية-${new Date(now).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
      uploadFile(blob, name, p => patchLocal(room, msg.id, { progress: p }))
        .then(up => {
          primeFileUrl(up.id, blob);
          return deliver({ ...msg, localFiles: [] }, [{ fileId: up.id, name, type: blob.type, size: blob.size, duration, peaks }]);
        })
        .catch(() => patchLocal(room, msg.id, { failed: true }));
      return;
    }
    deliver(msg);
  };

  const forwardMessage = async (room: string, src: ChatMessage) => {
    await chatApi.sendMessage({ id: uid(), me: meId, room, kind: src.kind, text: src.text, attachments: src.attachments });
    poll();
  };

  const retry = (msg: ChatMessage) => {
    patchLocal(msg.room_id, msg.id, { failed: false, pending: true });
    deliver(msg);
  };
  const discard = (msg: ChatMessage) =>
    setMessages(prev => ({ ...prev, [msg.room_id]: (prev[msg.room_id] || []).filter(m => m.id !== msg.id) }));

  const editMessage = async (msg: ChatMessage, text: string) => {
    patchLocal(msg.room_id, msg.id, { text, edited: 1 });
    await chatApi.editMessage(msg.id, meId, text);
    poll();
  };
  const deleteMessage = async (msg: ChatMessage) => {
    patchLocal(msg.room_id, msg.id, { deleted: 1, text: '', attachments: [] });
    await chatApi.deleteMessage(msg.id, meId);
    poll();
  };
  /** حذف لدي فقط (محلي) */
  const hideForMe = (msg: ChatMessage) => {
    setHidden(prev => { const n = new Set(prev); n.add(msg.id); saveSet(HIDDEN_KEY, n); return n; });
  };
  const toggleStar = (msg: ChatMessage) => {
    setStarred(prev => {
      const n = new Set(prev);
      if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
      saveSet(STAR_KEY, n);
      return n;
    });
  };
  const pinMessage = async (room: string, msgId: string) => {
    setRooms(prev => (prev[room] ? { ...prev, [room]: { ...prev[room], pinned_msg: msgId } } : prev));
    await chatApi.pin(room, meId, msgId);
    poll();
  };
  const messageInfo = (id: string) => chatApi.info(id, meId);

  const react = async (msg: ChatMessage, emoji: string) => {
    const reactions: Record<string, string[]> = {};
    const had = (msg.reactions[emoji] || []).includes(meId);
    for (const [k, v] of Object.entries(msg.reactions)) {
      const rest = v.filter(u => u !== meId);
      if (rest.length) reactions[k] = rest;
    }
    if (!had) reactions[emoji] = [...(reactions[emoji] || []), meId];
    patchLocal(msg.room_id, msg.id, { reactions });
    await chatApi.react(msg.id, meId, emoji);
    poll();
  };

  // ───── الكتابة والقراءة ─────
  const lastTyping = useRef(0);
  const notifyTyping = (room: string) => {
    if (Date.now() - lastTyping.current < 2500) return;
    lastTyping.current = Date.now();
    chatApi.typing(meId, room).catch(() => {});
  };
  const markRead = useCallback((room: string, at: number) => {
    setMembers(prev => prev.map(m => (m.room_id === room && m.user_id === meId && m.last_read < at ? { ...m, last_read: at } : m)));
    chatApi.read(meId, room, at).catch(() => {});
  }, [meId]);

  // ───── الغرف ─────
  const openDirect = async (userId: string) => {
    const { id } = await chatApi.createRoom({ me: meId, type: 'direct', members: [userId] });
    await poll();
    return id;
  };
  const createGroup = async (g: { name: string; description: string; avatar: string; members: string[] }) => {
    const { id } = await chatApi.createRoom({ me: meId, type: 'group', ...g });
    await poll();
    return id;
  };
  const updateGroup = async (room: string, g: { name: string; description: string; avatar: string }) => {
    await chatApi.updateRoom(room, { me: meId, ...g });
    poll();
  };
  const changeMembers = async (room: string, change: { add?: string[]; remove?: string[]; admin?: string }) => {
    await chatApi.members(room, { me: meId, ...change });
    poll();
  };
  const setPrefs = async (room: string, prefs: { muted?: boolean; pinned?: boolean }) => {
    setMembers(prev => prev.map(m => (m.room_id === room && m.user_id === meId
      ? { ...m, ...(prefs.muted !== undefined ? { muted: prefs.muted ? 1 : 0 } : {}), ...(prefs.pinned !== undefined ? { pinned: prefs.pinned ? Date.now() : 0 } : {}) }
      : m)));
    await chatApi.prefs(meId, room, prefs);
  };

  const setActiveRoom = (id: string) => { activeRoomRef.current = id; };

  // ───── عرض الغرف ─────
  const roomViews: RoomView[] = useMemo(() => {
    const now = Date.now();
    return Object.values(rooms).map(room => {
      const ms = members.filter(m => m.room_id === room.id);
      const myMember = ms.find(m => m.user_id === meId);
      const list = (messages[room.id] || []).filter(m => !hidden.has(m.id));
      const last = list[list.length - 1];
      const lastRead = myMember?.last_read || 0;
      const unreadList = list.filter(m => m.user_id !== meId && m.created_at > lastRead && m.kind !== 'system' && !m.deleted);
      const unread = unreadList.length;
      const mentioned = unreadList.some(m => mentionsMe(m.text, users[meId]?.name));
      const peerId = room.type === 'direct' ? ms.find(m => m.user_id !== meId)?.user_id : undefined;
      const peer = peerId ? users[peerId] : undefined;
      const typing = ms
        .map(m => users[m.user_id])
        .filter((u): u is ChatUser => !!u && u.id !== meId && u.typing_room === room.id && now - u.typing_at < TYPING_MS);
      return {
        room, members: ms, myMember, last, unread, mentioned, typing, peer,
        title: room.type === 'direct' ? peer?.name || 'محادثة خاصة' : room.name,
        avatar: room.type === 'direct' ? peer?.avatar || '' : room.avatar,
        color: room.type === 'direct' ? peer?.color || '' : '',
        online: room.type === 'direct'
          ? !!peer && now - peer.last_seen < ONLINE_MS
          : ms.some(m => m.user_id !== meId && users[m.user_id] && now - users[m.user_id].last_seen < ONLINE_MS),
      };
    }).sort((a, b) =>
      (b.myMember?.pinned || 0) - (a.myMember?.pinned || 0) ||
      Math.max(b.last?.created_at || 0, b.room.updated_at) - Math.max(a.last?.created_at || 0, a.room.updated_at));
  }, [rooms, members, messages, users, meId, hidden]);

  const totalUnread = roomViews.reduce((a, r) => a + (r.myMember?.muted ? 0 : r.unread), 0);

  return {
    meId, me, users, messages, roomViews, hidden, starred, hideForMe, toggleStar, pinMessage, messageInfo, conn, loaded, totalUnread, sound, setSound,
    account, isAdmin: !!account?.is_admin, saveProfile, changePassword, logout,
    sendMessage, forwardMessage, retry, discard, editMessage, deleteMessage, react,
    notifyTyping, markRead, openDirect, createGroup, updateGroup, changeMembers, setPrefs, setActiveRoom,
  };
}

export type ChatStore = ReturnType<typeof useChat>;
