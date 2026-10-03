import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Camera, Check, Search, LogOut, Bell, BellOff, Pin, PinOff, Volume2, VolumeX, Users, UserPlus, UserMinus,
  ShieldCheck, KeyRound, Loader2, MessageSquarePlus, Trash2, Forward, Palette, Type, CheckCheck, Check as Tick, Star, Eye,
} from 'lucide-react';
import { Avatar } from './Avatar';
import type { ChatUser } from './chatApi';
import { AVATAR_COLORS, formatClock, formatDay, lastSeenText, resizeImage, ONLINE_MS } from './chatUtils';
import { BUBBLE_STYLES, CHAT_THEMES, TEXT_SIZES, lookStyle, themeStyle, type ChatTheme, type RoomLook } from './chatThemes';
import type { ChatMessage } from './chatApi';
import type { ChatStore, RoomView } from './useChat';

// ───── الإطار العام للنوافذ ─────
export const Modal: React.FC<{
  title: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ title, icon, onClose, children, footer, wide }) => {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 cx-fade" style={{ background: 'rgba(0,0,0,.45)' }} onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div className={`cx-glass cx-slide-up w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92%] flex flex-col rounded-t-3xl sm:rounded-3xl border cx-border shadow-2xl`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b cx-border">
          {icon && <span className="cx-accent">{icon}</span>}
          <h3 className="flex-1 font-black text-base">{title}</h3>
          {onClose && (
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center cx-hover" aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto cx-scroll px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t cx-border flex items-center gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }> = ({ variant = 'primary', className = '', ...rest }) => (
  <button
    {...rest}
    className={`h-11 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
      variant === 'primary' ? 'cx-accent-bg shadow-lg' : variant === 'danger' ? 'text-rose-500 cx-hover border cx-border' : 'cx-hover border cx-border'
    } ${className}`}
  />
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-bold cx-muted">{label}</span>
    {children}
  </label>
);

export const inputCls = 'cx-input w-full h-11 rounded-2xl px-4 text-sm';

/** اختيار صورة وقصّها مربعة */
const AvatarPicker: React.FC<{ id: string; name: string; value: string; color?: string; group?: boolean; onChange: (v: string) => void }> = ({ id, name, value, color, group, onChange }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      onChange((await resizeImage(f, 256, 0.82, true)).dataUrl);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={() => input.current?.click()} className="relative group">
        <Avatar id={id} name={name} src={value} color={color} group={group} size={96} ring />
        <span className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition text-white" style={{ borderRadius: group ? 30 : 999 }}>
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
        </span>
      </button>
      {value && (
        <button type="button" onClick={() => onChange('')} className="text-xs cx-muted hover:underline">إزالة الصورة</button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
};

/** قائمة أشخاص قابلة للبحث والاختيار */
const PeoplePicker: React.FC<{
  users: ChatUser[];
  selected: string[];
  onToggle: (id: string) => void;
  single?: boolean;
}> = ({ users, selected, onToggle, single }) => {
  const [q, setQ] = useState('');
  const list = users.filter(u => !q || u.name.includes(q) || (u.role || '').includes(q));
  const now = Date.now();
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 cx-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالاسم أو الوظيفة..." className={`${inputCls} pr-9`} />
      </div>
      <div className="max-h-72 overflow-y-auto cx-scroll -mx-2">
        {list.length === 0 && <p className="text-center text-sm cx-muted py-6">لا يوجد أشخاص</p>}
        {list.map(u => {
          const on = selected.includes(u.id);
          return (
            <button key={u.id} type="button" onClick={() => onToggle(u.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl cx-hover text-right">
              <Avatar id={u.id} name={u.name} src={u.avatar} color={u.color} size={42} online={now - u.last_seen < ONLINE_MS} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{u.name}</div>
                <div className="text-xs cx-muted truncate">{u.role || lastSeenText(u.last_seen)}</div>
              </div>
              {!single && (
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? 'cx-accent-bg border-transparent' : 'cx-border'}`}>
                  {on && <Check className="w-4 h-4" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ───── نافذة الحساب ─────
export const AccountModal: React.FC<{ store: ChatStore; onClose: () => void; onAdmin: () => void }> = ({ store, onClose, onAdmin }) => {
  const me = store.me;
  const [name, setName] = useState(me?.name || '');
  const [role, setRole] = useState(me?.role || '');
  const [bio, setBio] = useState(me?.bio || '');
  const [avatar, setAvatar] = useState(me?.avatar || '');
  const [color, setColor] = useState(me?.color || AVATAR_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notif, setNotif] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));
  // تغيير كلمة المرور
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCur, setPwCur] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('اكتب اسمك أولًا');
    setBusy(true);
    setError('');
    try {
      await store.saveProfile({ name: name.trim(), role: role.trim(), bio: bio.trim(), avatar, color });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (pwNew.length < 8) return setPwMsg({ ok: false, text: 'كلمة المرور الجديدة 8 أحرف على الأقل' });
    setBusy(true);
    setPwMsg(null);
    try {
      await store.changePassword(pwCur, pwNew);
      setPwMsg({ ok: true, text: 'تم تغيير كلمة المرور، وخرج حسابك من الأجهزة الأخرى' });
      setPwCur('');
      setPwNew('');
    } catch (e) {
      setPwMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const askNotif = async () => {
    if (!('Notification' in window)) return;
    setNotif(await Notification.requestPermission());
  };

  return (
    <Modal
      title="حسابي"
      icon={<Users className="w-5 h-5" />}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={save} disabled={busy} className="flex-1">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} حفظ
          </Btn>
          <Btn variant="danger" onClick={() => { store.logout(); onClose(); }}>
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <AvatarPicker id={store.meId} name={name} value={avatar} color={color} onChange={setAvatar} />
        {store.account && (
          <div className="flex justify-center">
            <span dir="ltr" className="text-xs font-bold px-3 py-1 rounded-full cx-soft cx-muted">@{store.account.username}{store.isAdmin ? ' · admin' : ''}</span>
          </div>
        )}
        {!avatar && (
          <div className="flex justify-center gap-2 flex-wrap">
            {AVATAR_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} className="w-7 h-7 rounded-full transition" style={{ background: c, outline: color === c ? '3px solid var(--accent)' : 'none', outlineOffset: 2 }} aria-label="لون" />
            ))}
          </div>
        )}
        <Field label="الاسم *">
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} className={inputCls} placeholder="مثال: علي حسين" onKeyDown={e => e.key === 'Enter' && save()} />
        </Field>
        <Field label="الوظيفة">
          <input value={role} onChange={e => setRole(e.target.value)} maxLength={60} className={inputCls} placeholder="مسؤول خزانات، سائق صهريج..." />
        </Field>
        <Field label="نبذة">
          <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={200} rows={2} className="cx-input w-full rounded-2xl px-4 py-3 text-sm resize-none" placeholder="سطر قصير عنك" />
        </Field>

        <div className="space-y-2 pt-2">
          {store.isAdmin && (
            <button type="button" onClick={onAdmin} className="w-full flex items-center gap-3 px-4 h-12 rounded-2xl cx-accent-bg text-sm font-bold shadow">
              <ShieldCheck className="w-5 h-5" />
              <span className="flex-1 text-right">إدارة الحسابات</span>
            </button>
          )}
          <button type="button" onClick={() => store.setSound(!store.sound)} className="w-full flex items-center gap-3 px-4 h-12 rounded-2xl cx-soft cx-hover text-sm font-bold">
            {store.sound ? <Volume2 className="w-5 h-5 cx-accent" /> : <VolumeX className="w-5 h-5 cx-muted" />}
            <span className="flex-1 text-right">صوت الرسائل</span>
            <span className="cx-muted text-xs">{store.sound ? 'مفعّل' : 'مكتوم'}</span>
          </button>
          <button type="button" onClick={askNotif} disabled={notif !== 'default'} className="w-full flex items-center gap-3 px-4 h-12 rounded-2xl cx-soft cx-hover text-sm font-bold">
            {notif === 'granted' ? <Bell className="w-5 h-5 cx-accent" /> : <BellOff className="w-5 h-5 cx-muted" />}
            <span className="flex-1 text-right">إشعارات سطح المكتب</span>
            <span className="cx-muted text-xs">{notif === 'granted' ? 'مفعّلة' : notif === 'denied' ? 'محظورة من المتصفح' : 'اضغط للتفعيل'}</span>
          </button>

          {/* تغيير كلمة المرور */}
          <div className="rounded-2xl cx-soft p-3 space-y-2">
            <button type="button" onClick={() => setPwOpen(v => !v)} className="w-full flex items-center gap-2 text-sm font-bold">
              <KeyRound className="w-5 h-5 cx-accent" /> <span className="flex-1 text-right">تغيير كلمة المرور</span>
              <span className="text-xs cx-accent">{pwOpen ? 'إغلاق' : 'تغيير'}</span>
            </button>
            {pwOpen && (
              <div className="space-y-2 pt-1">
                <input type="password" dir="ltr" value={pwCur} onChange={e => setPwCur(e.target.value)} placeholder="كلمة المرور الحالية" autoComplete="current-password" className={inputCls} />
                <input type="password" dir="ltr" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)" autoComplete="new-password" className={inputCls} />
                <Btn className="w-full" disabled={busy || !pwCur || !pwNew} onClick={changePassword}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} تحديث كلمة المرور
                </Btn>
                {pwMsg && <p className={`text-xs font-bold ${pwMsg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{pwMsg.text}</p>}
              </div>
            )}
          </div>
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </div>
    </Modal>
  );
};

// ───── محادثة جديدة ─────
export const NewChatModal: React.FC<{ store: ChatStore; onClose: () => void; onOpen: (roomId: string) => void; onNewGroup: () => void }> = ({ store, onClose, onOpen, onNewGroup }) => {
  const [busy, setBusy] = useState(false);
  const people = useMemo(() => Object.values(store.users).filter(u => u.id !== store.meId).sort((a, b) => b.last_seen - a.last_seen), [store.users, store.meId]);
  const open = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      onOpen(await store.openDirect(id));
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="محادثة جديدة" icon={<MessageSquarePlus className="w-5 h-5" />} onClose={onClose}>
      <button onClick={onNewGroup} className="w-full flex items-center gap-3 px-2 py-2 mb-3 rounded-2xl cx-hover">
        <span className="w-[42px] h-[42px] rounded-2xl cx-accent-bg flex items-center justify-center"><Users className="w-5 h-5" /></span>
        <span className="font-bold text-sm">مجموعة جديدة</span>
      </button>
      <PeoplePicker users={people} selected={[]} single onToggle={open} />
    </Modal>
  );
};

// ───── إنشاء / إدارة مجموعة ─────
export const GroupModal: React.FC<{ store: ChatStore; room?: RoomView; onClose: () => void; onCreated?: (id: string) => void }> = ({ store, room, onClose, onCreated }) => {
  const editing = !!room;
  const iAmAdmin = !editing || room!.myMember?.role === 'admin';
  const [step, setStep] = useState<'members' | 'info'>(editing ? 'info' : 'members');
  const [name, setName] = useState(room?.room.name || '');
  const [description, setDescription] = useState(room?.room.description || '');
  const [avatar, setAvatar] = useState(room?.room.avatar || '');
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const memberIds = new Set(room?.members.map(m => m.user_id) || []);
  const candidates = Object.values(store.users).filter(u => u.id !== store.meId && !memberIds.has(u.id));
  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => run(async () => {
    if (!name.trim()) throw new Error('اسم المجموعة مطلوب');
    if (editing) {
      await store.updateGroup(room!.room.id, { name: name.trim(), description: description.trim(), avatar });
      onClose();
    } else {
      const id = await store.createGroup({ name: name.trim(), description: description.trim(), avatar, members: selected });
      onCreated?.(id);
      onClose();
    }
  });

  // إضافة أعضاء لمجموعة قائمة
  if (adding) {
    return (
      <Modal
        title="إضافة أعضاء"
        icon={<UserPlus className="w-5 h-5" />}
        onClose={() => { setAdding(false); setSelected([]); }}
        footer={
          <Btn className="flex-1" disabled={!selected.length || busy} onClick={() => run(async () => { await store.changeMembers(room!.room.id, { add: selected }); setSelected([]); setAdding(false); })}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} إضافة {selected.length || ''}
          </Btn>
        }
      >
        <PeoplePicker users={candidates} selected={selected} onToggle={toggle} />
        {error && <p className="text-sm text-rose-500 mt-2">{error}</p>}
      </Modal>
    );
  }

  if (step === 'members') {
    return (
      <Modal
        title="مجموعة جديدة — اختر الأعضاء"
        icon={<Users className="w-5 h-5" />}
        onClose={onClose}
        footer={<Btn className="flex-1" onClick={() => setStep('info')}>التالي {selected.length ? `(${selected.length})` : ''}</Btn>}
      >
        <PeoplePicker users={candidates} selected={selected} onToggle={toggle} />
      </Modal>
    );
  }

  const now = Date.now();
  const general = room?.room.id === 'general';
  return (
    <Modal
      title={editing ? 'معلومات المجموعة' : 'مجموعة جديدة'}
      icon={<Users className="w-5 h-5" />}
      onClose={onClose}
      wide={editing}
      footer={
        <>
          {iAmAdmin && (
            <Btn className="flex-1" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editing ? 'حفظ' : 'إنشاء المجموعة'}
            </Btn>
          )}
          {!editing && <Btn variant="ghost" onClick={() => setStep('members')}>رجوع</Btn>}
          {editing && !general && (
            <Btn variant="danger" disabled={busy} onClick={() => confirm('مغادرة المجموعة؟') && run(async () => { await store.changeMembers(room!.room.id, { remove: [store.meId] }); onClose(); })}>
              <LogOut className="w-4 h-4" /> مغادرة
            </Btn>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {iAmAdmin ? (
          <>
            <AvatarPicker id={room?.room.id || name} name={name} value={avatar} group onChange={setAvatar} />
            <Field label="اسم المجموعة *">
              <input autoFocus={!editing} value={name} onChange={e => setName(e.target.value)} maxLength={80} className={inputCls} placeholder="مثال: فريق الخزانات" />
            </Field>
            <Field label="الوصف">
              <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={300} rows={2} className="cx-input w-full rounded-2xl px-4 py-3 text-sm resize-none" />
            </Field>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar id={room!.room.id} name={room!.title} src={room!.avatar} group size={96} />
            <div className="font-black text-lg">{room!.title}</div>
            {room!.room.description && <p className="text-sm cx-muted">{room!.room.description}</p>}
          </div>
        )}

        {editing && <PrefsRow store={store} room={room!} />}

        {editing && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold cx-muted">{room!.members.length} عضو</span>
              {iAmAdmin && candidates.length > 0 && (
                <button onClick={() => setAdding(true)} className="text-xs font-bold cx-accent flex items-center gap-1"><UserPlus className="w-4 h-4" /> إضافة</button>
              )}
            </div>
            <div className="-mx-2">
              {room!.members
                .slice()
                .sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1))
                .map(m => {
                  const u = store.users[m.user_id];
                  if (!u) return null;
                  const self = u.id === store.meId;
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-2xl cx-hover">
                      <Avatar id={u.id} name={u.name} src={u.avatar} color={u.color} size={40} online={now - u.last_seen < ONLINE_MS} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{self ? 'أنت' : u.name}</div>
                        <div className="text-xs cx-muted truncate">{u.role || lastSeenText(u.last_seen)}</div>
                      </div>
                      {m.role === 'admin' && <span className="text-[10px] font-black px-2 py-0.5 rounded-full cx-accent-bg">مشرف</span>}
                      {iAmAdmin && !self && (
                        <>
                          <button title={m.role === 'admin' ? 'إلغاء الإشراف' : 'تعيين مشرفًا'} disabled={busy} onClick={() => run(() => store.changeMembers(room!.room.id, { admin: u.id }))} className="w-8 h-8 rounded-full flex items-center justify-center cx-hover">
                            <ShieldCheck className={`w-4 h-4 ${m.role === 'admin' ? 'cx-accent' : 'cx-muted'}`} />
                          </button>
                          {!general && (
                            <button title="إزالة" disabled={busy} onClick={() => confirm(`إزالة ${u.name}؟`) && run(() => store.changeMembers(room!.room.id, { remove: [u.id] }))} className="w-8 h-8 rounded-full flex items-center justify-center cx-hover text-rose-500">
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </div>
    </Modal>
  );
};

/** كتم وتثبيت المحادثة */
const PrefsRow: React.FC<{ store: ChatStore; room: RoomView }> = ({ store, room }) => {
  const muted = !!room.myMember?.muted;
  const pinned = !!room.myMember?.pinned;
  return (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={() => store.setPrefs(room.room.id, { muted: !muted })} className="h-11 rounded-2xl cx-soft cx-hover text-sm font-bold flex items-center justify-center gap-2">
        {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />} {muted ? 'إلغاء الكتم' : 'كتم'}
      </button>
      <button onClick={() => store.setPrefs(room.room.id, { pinned: !pinned })} className="h-11 rounded-2xl cx-soft cx-hover text-sm font-bold flex items-center justify-center gap-2">
        {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />} {pinned ? 'إلغاء التثبيت' : 'تثبيت'}
      </button>
    </div>
  );
};

// ───── ملف شخص (محادثة خاصة أو من داخل مجموعة) ─────
export const UserModal: React.FC<{ store: ChatStore; userId: string; room?: RoomView; onClose: () => void; onMessage?: (roomId: string) => void }> = ({ store, userId, room, onClose, onMessage }) => {
  const u = store.users[userId];
  if (!u) return null;
  const online = Date.now() - u.last_seen < ONLINE_MS;
  const self = u.id === store.meId;
  return (
    <Modal title="الملف الشخصي" onClose={onClose}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar id={u.id} name={u.name} src={u.avatar} color={u.color} size={104} ring={online} online={online} />
        <div className="font-black text-xl mt-1">{u.name}</div>
        {u.role && <div className="text-sm cx-accent font-bold">{u.role}</div>}
        <div className="text-xs cx-muted">{lastSeenText(u.last_seen)}</div>
        {u.bio && <p className="text-sm mt-2 px-4 py-3 rounded-2xl cx-soft w-full">{u.bio}</p>}
      </div>
      <div className="mt-4 space-y-2">
        {room && <PrefsRow store={store} room={room} />}
        {!self && !room && onMessage && (
          <Btn className="w-full" onClick={async () => { onMessage(await store.openDirect(u.id)); onClose(); }}>
            <MessageSquarePlus className="w-4 h-4" /> مراسلة
          </Btn>
        )}
      </div>
    </Modal>
  );
};

// ───── الثيمات ─────
export const ThemeModal: React.FC<{ current: string; onPick: (t: ChatTheme) => void; onClose: () => void }> = ({ current, onPick, onClose }) => (
  <Modal title="مظهر الصفحة" icon={<Palette className="w-5 h-5" />} onClose={onClose} wide>
    <p className="text-xs cx-muted mb-3">يغيّر خلفية وألوان واجهة المحادثات كاملة. للون الفقاعات وحجم النص في محادثة معيّنة استخدم زر المظهر أعلى المحادثة.</p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {CHAT_THEMES.map(t => {
        const on = t.id === current;
        return (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            style={{ ...themeStyle(t), background: t.vars['--bg'], outline: on ? `3px solid ${t.vars['--accent']}` : 'none', outlineOffset: 2 }}
            className="relative overflow-hidden rounded-2xl p-3 text-right h-36 flex flex-col justify-between border transition hover:scale-[1.03]"
          >
            <span className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl" style={{ background: t.vars['--glow1'] }} />
            <span className="absolute -bottom-10 -left-8 w-28 h-28 rounded-full blur-2xl" style={{ background: t.vars['--glow2'] }} />
            <div className="relative space-y-1.5">
              <div className="w-3/5 h-5 rounded-xl rounded-br-sm" style={{ background: t.vars['--in'], border: `1px solid ${t.vars['--in-border']}` }} />
              <div className="w-2/3 h-5 rounded-xl rounded-bl-sm mr-auto" style={{ background: t.vars['--out'] }} />
            </div>
            <div className="relative">
              <div className="font-black text-sm flex items-center gap-1" style={{ color: t.vars['--text'] }}>
                {on && <Check className="w-4 h-4" />} {t.name}
              </div>
              <div className="text-[10px] leading-tight" style={{ color: t.vars['--muted'] }}>{t.tagline}</div>
            </div>
          </button>
        );
      })}
    </div>
  </Modal>
);

// ───── إعادة التوجيه ─────
export const ForwardModal: React.FC<{ store: ChatStore; onPick: (roomId: string) => Promise<void>; onClose: () => void }> = ({ store, onPick, onClose }) => {
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState<string[]>([]);
  return (
    <Modal title="إعادة توجيه إلى..." icon={<Forward className="w-5 h-5" />} onClose={onClose}>
      <div className="-mx-2">
        {store.roomViews.map(r => (
          <button
            key={r.room.id}
            disabled={!!busy || done.includes(r.room.id)}
            onClick={async () => { setBusy(r.room.id); try { await onPick(r.room.id); setDone(d => [...d, r.room.id]); } finally { setBusy(''); } }}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl cx-hover text-right"
          >
            <Avatar id={r.room.id} name={r.title} src={r.avatar} color={r.color} group={r.room.type === 'group'} size={40} />
            <span className="flex-1 font-bold text-sm truncate">{r.title}</span>
            {busy === r.room.id ? <Loader2 className="w-4 h-4 animate-spin" /> : done.includes(r.room.id) ? <Check className="w-4 h-4 cx-accent" /> : null}
          </button>
        ))}
      </div>
    </Modal>
  );
};

export const ConfirmDelete: React.FC<{ onConfirm: () => void; onClose: () => void }> = ({ onConfirm, onClose }) => (
  <Modal
    title="حذف الرسالة"
    icon={<Trash2 className="w-5 h-5" />}
    onClose={onClose}
    footer={
      <>
        <Btn variant="danger" className="flex-1" onClick={() => { onConfirm(); onClose(); }}><Trash2 className="w-4 h-4" /> حذف للجميع</Btn>
        <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
      </>
    }
  >
    <p className="text-sm cx-muted">ستُحذف الرسالة لدى جميع المشاركين ولا يمكن التراجع.</p>
  </Modal>
);

// ───── مظهر النص والفقاعات لمحادثة واحدة ─────
export const LookModal: React.FC<{ title: string; look: RoomLook; onChange: (l: RoomLook) => void; onApplyAll: () => void; onClose: () => void }> = ({ title, look, onChange, onApplyAll, onClose }) => (
  <Modal title={`مظهر النص — ${title}`} icon={<Type className="w-5 h-5" />} onClose={onClose} wide
    footer={<><Btn className="flex-1" onClick={onClose}><Check className="w-4 h-4" /> تم</Btn><Btn variant="ghost" onClick={onApplyAll}>تطبيق على كل المحادثات</Btn></>}>
    {/* معاينة حيّة */}
    <div className="rounded-2xl p-4 mb-4 space-y-2 border cx-border" style={{ ...lookStyle(look), background: 'var(--bg)' }}>
      <div className="w-fit max-w-[75%] px-3.5 py-2 rounded-[18px] rounded-br-md cx-in" style={{ fontSize: 'var(--msg-size)' }}>صباح الخير، كم رصيد الخزان رقم 2؟</div>
      <div className="w-fit max-w-[75%] px-3.5 py-2 rounded-[18px] rounded-bl-md mr-auto cx-out" style={{ fontSize: 'var(--msg-size)' }}>12,400 لتر ✅ تم التحديث الآن</div>
    </div>
    <div className="text-xs font-bold cx-muted mb-2">لون الفقاعات</div>
    <div className="grid grid-cols-4 gap-2 mb-4">
      {BUBBLE_STYLES.map(b => (
        <button key={b.id} onClick={() => onChange({ ...look, bubble: b.id })}
          className={`rounded-2xl p-2 border text-[11px] font-bold flex flex-col items-center gap-1.5 transition ${look.bubble === b.id ? 'cx-soft' : 'cx-hover'}`}
          style={{ borderColor: look.bubble === b.id ? 'var(--accent)' : 'var(--border)' }}>
          <span className="flex gap-1">
            <span className="w-5 h-5 rounded-full border cx-border" style={{ background: b.in || 'var(--in)' }} />
            <span className="w-5 h-5 rounded-full" style={{ background: b.out || 'var(--out)' }} />
          </span>
          {b.name}
        </button>
      ))}
    </div>
    <div className="text-xs font-bold cx-muted mb-2">حجم النص</div>
    <div className="grid grid-cols-4 gap-2">
      {TEXT_SIZES.map(t => (
        <button key={t.id} onClick={() => onChange({ ...look, size: t.id })}
          className={`h-12 rounded-2xl border font-bold ${look.size === t.id ? 'cx-accent-bg border-transparent' : 'cx-hover cx-border'}`} style={{ fontSize: t.px }}>
          {t.name}
        </button>
      ))}
    </div>
  </Modal>
);

// ───── معلومات الرسالة: من استلمها ومن قرأها ومتى ─────
export const MessageInfoModal: React.FC<{ store: ChatStore; msg: ChatMessage; room: RoomView; onClose: () => void }> = ({ store, msg, room, onClose }) => {
  const [seen, setSeen] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = () => store.messageInfo(msg.id)
      .then(r => { if (alive) setSeen(Object.fromEntries(r.seen.map(x => [x.user_id, x.at]))); })
      .catch(e => { if (alive) setError((e as Error).message); });
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [msg.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const others = room.members.filter(m => m.user_id !== store.meId);
  // مقروءة إذا سُجّلت مشاهدتها، أو كان آخر قراءة للعضو بعدها (رسائل أقدم من تفعيل السجل → -1)
  const readAt = (id: string, lastRead: number) => seen?.[id] || (lastRead >= msg.created_at ? -1 : 0);
  const read = others.filter(m => readAt(m.user_id, m.last_read));
  const delivered = others.filter(m => !readAt(m.user_id, m.last_read) && (store.users[m.user_id]?.last_seen || 0) >= msg.created_at);
  const waiting = others.filter(m => !readAt(m.user_id, m.last_read) && (store.users[m.user_id]?.last_seen || 0) < msg.created_at);
  const when = (ts: number) => (ts > 0 ? `${formatDay(ts)} ${formatClock(ts)}` : 'قُرئت');

  const row = (id: string, sub: string) => {
    const u = store.users[id];
    return (
      <div key={id} className="flex items-center gap-3 px-2 py-2 rounded-2xl">
        <Avatar id={id} name={u?.name || '؟'} src={u?.avatar} color={u?.color} size={38} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{u?.name || 'عضو'}</div>
          <div className="text-[11px] cx-muted">{sub}</div>
        </div>
      </div>
    );
  };
  const section = (icon: React.ReactNode, title: string, rows: React.ReactNode[]) => (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-xs font-black mb-1">{icon} {title} <span className="cx-muted">({rows.length})</span></div>
      {rows.length ? rows : <p className="text-xs cx-muted px-2 py-1">لا أحد</p>}
    </div>
  );

  return (
    <Modal title="معلومات الرسالة" icon={<Eye className="w-5 h-5" />} onClose={onClose}>
      <div className="rounded-2xl px-3.5 py-2.5 mb-4 cx-out text-sm">
        <p className="line-clamp-3 whitespace-pre-wrap">{msg.text || (msg.kind === 'voice' ? '🎤 بصمة صوتية' : `📎 ${msg.attachments[0]?.name || 'مرفق'}`)}</p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--out-muted)' }}>أُرسلت {formatDay(msg.created_at)} {formatClock(msg.created_at)}{msg.edited ? ' · معدّلة' : ''}</p>
      </div>
      {!seen && !error && <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin cx-accent" /></div>}
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {seen && (
        <>
          {section(<CheckCheck className="w-4 h-4" style={{ color: '#38bdf8' }} />, 'قرأها', read.map(m => row(m.user_id, when(readAt(m.user_id, m.last_read)))))}
          {section(<CheckCheck className="w-4 h-4 cx-muted" />, 'وصلت إليه ولم يقرأها', delivered.map(m => row(m.user_id, lastSeenText(store.users[m.user_id]?.last_seen || 0))))}
          {section(<Tick className="w-4 h-4 cx-muted" />, 'لم تصل بعد', waiting.map(m => row(m.user_id, lastSeenText(store.users[m.user_id]?.last_seen || 0))))}
        </>
      )}
    </Modal>
  );
};

// ───── الرسائل المميّزة بنجمة ─────
export const StarredModal: React.FC<{ store: ChatStore; onJump: (room: string, id: string) => void; onClose: () => void }> = ({ store, onJump, onClose }) => {
  const list = Object.values(store.messages).flat().filter(m => store.starred.has(m.id) && !m.deleted).sort((a, b) => b.created_at - a.created_at);
  const roomTitle = (id: string) => store.roomViews.find(r => r.room.id === id)?.title || '';
  return (
    <Modal title="الرسائل المميّزة" icon={<Star className="w-5 h-5" />} onClose={onClose}>
      {!list.length && <p className="text-center text-sm cx-muted py-8">اضغط مطولًا على أي رسالة واختر «تمييز بنجمة» لتجدها هنا.</p>}
      <div className="space-y-2">
        {list.map(m => (
          <button key={m.id} onClick={() => { onJump(m.room_id, m.id); onClose(); }} className="w-full text-right rounded-2xl p-3 cx-soft cx-hover">
            <div className="flex items-center gap-2 text-[11px] cx-muted mb-1">
              <b style={{ color: 'var(--text)' }}>{m.user_id === store.meId ? 'أنت' : store.users[m.user_id]?.name}</b> ← {roomTitle(m.room_id)}
              <span className="mr-auto">{formatDay(m.created_at)} {formatClock(m.created_at)}</span>
            </div>
            <p className="text-sm line-clamp-2">{m.text || (m.kind === 'voice' ? '🎤 بصمة صوتية' : `📎 ${m.attachments[0]?.name || 'مرفق'}`)}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
};
