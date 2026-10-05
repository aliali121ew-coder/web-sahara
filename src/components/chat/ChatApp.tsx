import i18n from '../../i18n';
import { fmtList } from '../../i18n/format';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Plus, Palette, ArrowRight, ArrowDown, Info, Pin, BellOff, Wifi, WifiOff, Loader2, X, ChevronUp, ChevronDown,
  MessagesSquare, Upload, Mic, Paperclip, CheckCheck, Star, Type, CalendarDays, AtSign,
} from 'lucide-react';
import { SaharaFilePreview } from '../finance/SaharaFilePreview';
import './chat.css';
import { useChat, type RoomView } from './useChat';
import { downloadFile, fileUrl, type Attachment, type ChatMessage } from './chatApi';
import { Avatar } from './Avatar';
import { Composer, type ComposerHandle } from './Composer';
import { MessageBubble, type ReadState } from './MessageBubble';
import { Lightbox } from './Lightbox';
import { isMedia } from './Attachments';
import { formatClock, formatDay, formatListTime, isViewable, lastSeenText } from './chatUtils';
import { DEFAULT_LOOK, lookStyle, themeById, themeStyle, type RoomLook } from './chatThemes';
import { AdminModal } from './AdminModal';
import { AccountModal, ConfirmDelete, ForwardModal, GroupModal, LookModal, MessageInfoModal, NewChatModal, StarredModal, ThemeModal, UserModal } from './ChatModals';

const THEME_KEY = 'sahara_chat_theme';
const LOOKS_KEY = 'sahara_chat_looks';

const loadLooks = (): Record<string, RoomLook> => {
  try { return JSON.parse(localStorage.getItem(LOOKS_KEY) || '{}'); } catch { return {}; }
};
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RUN_GAP = 5 * 60_000;

type ModalState =
  | { kind: 'account' }
  | { kind: 'admin' }
  | { kind: 'theme' }
  | { kind: 'new' }
  | { kind: 'group'; room?: RoomView }
  | { kind: 'user'; id: string; room?: RoomView }
  | { kind: 'forward'; msg: ChatMessage }
  | { kind: 'delete'; msg: ChatMessage }
  | { kind: 'info'; msg: ChatMessage }
  | { kind: 'look' }
  | { kind: 'starred' }
  | null;

type Filter = 'all' | 'unread' | 'groups' | 'direct';

const preview = (m: ChatMessage | undefined, mine: boolean, sender?: string) => {
  if (!m) return i18n.t('chat:noMessages');
  if (m.deleted) return `🚫 ${i18n.t('chat:deleted')}`;
  const who = m.kind === 'system' ? `${sender || ''} ` : mine ? `${i18n.t('chat:you')}: ` : sender ? `${sender}: ` : '';
  const body = m.kind === 'voice' ? `🎤 ${i18n.t('chat:voiceNote')}` : m.text || (m.attachments.length ? `📎 ${m.attachments[0].name}` : '');
  return `${who}${m.urgent ? '🚨 ' : ''}${body}`;
};

export const ChatApp: React.FC = () => {
  const { t } = useTranslation(['chat', 'common']);
  const store = useChat();
  const { meId, users, roomViews } = store;

  const [themeId, setThemeId] = useState(() => localStorage.getItem(THEME_KEY) || 'nebula');
  const theme = themeById(themeId);
  const [activeId, setActiveId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modal, setModal] = useState<ModalState>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage>();
  const [editing, setEditing] = useState<ChatMessage>();
  const [lightbox, setLightbox] = useState<{ items: Attachment[]; index: number } | null>(null);
  const [flashId, setFlashId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState('');
  const [findIdx, setFindIdx] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [findDate, setFindDate] = useState('');
  const [viewFile, setViewFile] = useState<Attachment | null>(null);
  const [looks, setLooks] = useState<Record<string, RoomLook>>(loadLooks);
  const saveLooks = (next: Record<string, RoomLook>) => {
    setLooks(next);
    try { localStorage.setItem(LOOKS_KEY, JSON.stringify(next)); } catch { /* تجاهل */ }
  };

  const composer = useRef<ComposerHandle | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);

  const active = roomViews.find(r => r.room.id === activeId);
  const list = useMemo(() => (activeId ? (store.messages[activeId] || []).filter(m => !store.hidden.has(m.id)) : []), [store.messages, activeId, store.hidden]);
  const look = looks[activeId] || looks['*'] || DEFAULT_LOOK;
  const pinnedMsg = active?.room.pinned_msg ? byIdLookup(store.messages[activeId] || [], active.room.pinned_msg) : undefined;

  // نمط الإشارات: أسماء أعضاء المحادثة (الأطول أولًا) + @الكل
  const mentionRe = useMemo(() => {
    if (!active) return undefined;
    const names = active.members.map(m => users[m.user_id]?.name).filter(Boolean) as string[];
    names.push('الكل');
    names.sort((a, b) => b.length - a.length);
    return new RegExp(`(@(?:${names.map(escapeRe).join('|')}))`, 'g');
  }, [active, users]);
  const mentionable = useMemo(
    () => (active?.room.type === 'group' ? active.members.map(m => users[m.user_id]).filter(u => u && u.id !== meId) : []),
    [active, users, meId],
  );
  const byId = useMemo(() => new Map(list.map(m => [m.id, m])), [list]);

  // عند فتح الصفحة أول مرة: افتح أول غرفة على الشاشات الكبيرة
  useEffect(() => {
    if (!activeId && roomViews.length && window.innerWidth >= 768) setActiveId(roomViews[0].room.id);
  }, [roomViews, activeId]);
  // إذا خرجنا من غرفة (غادرنا / أُزلنا) أغلقها
  useEffect(() => {
    if (activeId && store.loaded && !active) setActiveId('');
  }, [activeId, active, store.loaded]);

  useEffect(() => { store.setActiveRoom(activeId); }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openRoom = (id: string) => {
    setActiveId(id);
    setReplyTo(undefined);
    setEditing(undefined);
    setFindOpen(false);
    setFindQ('');
    setFindDate('');
    setAtBottom(true);
  };

  const pickTheme = (id: string) => {
    setThemeId(id);
    localStorage.setItem(THEME_KEY, id);
  };

  // عنوان التبويب بعدد غير المقروء
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = store.totalUnread ? `(${store.totalUnread}) ${base}` : base;
  }, [store.totalUnread]);

  // ───── التمرير وإيصالات القراءة ─────
  const scrollToBottom = (smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };
  useLayoutEffect(() => { scrollToBottom(); }, [activeId]);

  const lastId = list[list.length - 1]?.id;
  useLayoutEffect(() => {
    const last = list[list.length - 1];
    if (!last) return;
    if (atBottom || last.user_id === meId) scrollToBottom(true);
  }, [lastId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const last = list[list.length - 1];
    if (!activeId || !last || !atBottom || document.visibilityState !== 'visible') return;
    if ((active?.myMember?.last_read || 0) < last.created_at) store.markRead(activeId, last.created_at);
  }, [activeId, lastId, atBottom, active?.myMember?.last_read]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const jump = useCallback((id: string) => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(id);
    setTimeout(() => setFlashId(f => (f === id ? '' : f)), 1500);
  }, []);

  // ───── البحث داخل المحادثة (بالنص و/أو التاريخ) ─────
  const results = useMemo(() => {
    const q = findQ.trim();
    if (!q && !findDate) return [];
    return list.filter(m => {
      if (m.deleted || m.kind === 'system') return false;
      if (findDate && new Date(m.created_at).toLocaleDateString('en-CA') !== findDate) return false;
      if (!q) return true;
      return m.text.includes(q) || m.attachments.some(a => a.name.includes(q));
    });
  }, [list, findQ, findDate]);
  const matches = useMemo(() => results.map(m => m.id), [results]);
  const [showResults, setShowResults] = useState(false);
  const closeFind = () => { setFindOpen(false); setFindQ(''); setFindDate(''); setShowResults(false); };
  useEffect(() => { setFindIdx(matches.length ? matches.length - 1 : 0); }, [matches.length, findQ, findDate]);
  useEffect(() => { if (matches[findIdx]) jump(matches[findIdx]); }, [findIdx, matches, jump]);

  // ───── إيصال القراءة لرسائلي ─────
  const readStateOf = (m: ChatMessage): ReadState => {
    if (m.failed) return 'failed';
    if (m.pending) return 'pending';
    const others = (active?.members || []).filter(x => x.user_id !== meId);
    return others.length && others.every(x => x.last_read >= m.created_at) ? 'read' : 'sent';
  };

  const media = useMemo(() => list.filter(m => !m.deleted).flatMap(m => m.attachments.filter(a => a.fileId && isMedia(a))), [list]);
  const openMedia = (a: Attachment) => {
    if (!a.fileId) return;
    const i = media.findIndex(x => x.fileId === a.fileId);
    if (i >= 0) return setLightbox({ items: media, index: i });
    // PDF و Excel في العارض المدمج داخل التطبيق، وبقية الملفات تُنزّل
    if (isViewable(a.name, a.type)) return setViewFile(a);
    downloadFile(a).catch(() => {});
  };
  const jumpInRoom = (room: string, id: string) => {
    if (room !== activeId) openRoom(room);
    setTimeout(() => jump(id), 350);
  };

  // ───── السحب والإفلات ─────
  const dragHandlers = active
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          dragDepth.current++;
          setDragOver(true);
        },
        onDragLeave: () => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragOver(false);
        },
        onDragOver: (e: React.DragEvent) => e.preventDefault(),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files || []);
          if (files.length) composer.current?.addFiles(files);
        },
      }
    : {};

  // ───── قائمة المحادثات ─────
  const shown = roomViews.filter(r => {
    if (filter === 'unread' && !r.unread) return false;
    if (filter === 'groups' && r.room.type !== 'group') return false;
    if (filter === 'direct' && r.room.type !== 'direct') return false;
    return !search || r.title.includes(search);
  });
  const people = search
    ? Object.values(users).filter(u => u.id !== meId && u.name.includes(search) && !roomViews.some(r => r.peer?.id === u.id))
    : [];

  const subtitle = (r: RoomView) => {
    if (r.typing.length) return r.room.type === 'group' ? t('chat:typingNames', { names: fmtList(r.typing.map(u => u.name.split(' ')[0])), count: r.typing.length }) : t('chat:typingNow');
    if (r.room.type === 'direct') return r.peer ? lastSeenText(r.peer.last_seen) : '';
    const online = r.members.filter(m => m.user_id !== meId && Date.now() - (users[m.user_id]?.last_seen || 0) < 25_000).length;
    return online ? `${t('chat:members', { count: r.members.length })} · ${t('chat:onlineCount', { count: online })}` : t('chat:members', { count: r.members.length });
  };

  const openInfo = () => {
    if (!active) return;
    if (active.room.type === 'group') setModal({ kind: 'group', room: active });
    else if (active.peer) setModal({ kind: 'user', id: active.peer.id, room: active });
  };

  // ───── عرض الرسائل مع فواصل الأيام وتجميع المتتاليات ─────
  const renderMessages = () => {
    const out: React.ReactNode[] = [];
    let lastDay = '';
    const firstUnread = active && active.unread ? list.find(m => m.user_id !== meId && m.created_at > (active.myMember?.last_read || 0) && m.kind !== 'system') : undefined;
    list.forEach((m, i) => {
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        out.push(
          <div key={`d-${day}`} className="flex justify-center my-3 sticky top-2 z-10">
            <span className="cx-glass border cx-border text-[11px] font-bold px-3 py-1 rounded-full">{formatDay(m.created_at)}</span>
          </div>,
        );
      }
      if (m === firstUnread) {
        out.push(
          <div key="unread" className="flex items-center gap-3 my-3 text-[11px] font-bold cx-accent">
            <span className="flex-1 h-px" style={{ background: 'var(--accent)' }} /> {t('chat:unreadDivider')} <span className="flex-1 h-px" style={{ background: 'var(--accent)' }} />
          </div>,
        );
      }
      if (m.kind === 'system') {
        out.push(
          <div key={m.id} id={`m-${m.id}`} className="flex justify-center my-2">
            <span className="cx-soft text-[11px] cx-muted px-3 py-1 rounded-full">
              {m.user_id === meId ? t('chat:you') : users[m.user_id]?.name || t('chat:member')} {m.text}
            </span>
          </div>,
        );
        return;
      }
      const prev = list[i - 1];
      const next = list[i + 1];
      const sameRun = (a?: ChatMessage, b?: ChatMessage) =>
        !!a && !!b && a.kind !== 'system' && b.kind !== 'system' && a.user_id === b.user_id &&
        Math.abs(a.created_at - b.created_at) < RUN_GAP && new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString();
      const mine = m.user_id === meId;
      const reply = m.reply_to ? byId.get(m.reply_to) : undefined;
      out.push(
        <div key={m.id} id={`m-${m.id}`}>
          <MessageBubble
            msg={m}
            mine={mine}
            sender={users[m.user_id]}
            isGroup={active?.room.type === 'group'}
            firstInRun={!sameRun(prev, m)}
            lastInRun={!sameRun(m, next)}
            reply={reply}
            replyUser={reply ? users[reply.user_id] : undefined}
            readState={mine ? readStateOf(m) : 'sent'}
            users={users}
            meId={meId}
            highlight={findQ.trim() || undefined}
            flash={flashId === m.id}
            onReply={() => { setEditing(undefined); setReplyTo(m); }}
            onReact={e => store.react(m, e).catch(() => {})}
            onEdit={() => { setReplyTo(undefined); setEditing(m); }}
            onDelete={() => setModal({ kind: 'delete', msg: m })}
            onForward={() => setModal({ kind: 'forward', msg: m })}
            onOpenMedia={openMedia}
            onJump={jump}
            onRetry={() => store.retry(m)}
            onDiscard={() => store.discard(m)}
            onOpenUser={id => setModal({ kind: 'user', id })}
            onInfo={() => setModal({ kind: 'info', msg: m })}
            onStar={() => store.toggleStar(m)}
            onPin={() => store.pinMessage(activeId, active?.room.pinned_msg === m.id ? '' : m.id).catch(() => {})}
            onHide={() => store.hideForMe(m)}
            starred={store.starred.has(m.id)}
            pinned={active?.room.pinned_msg === m.id}
            mentionRe={mentionRe}
            myName={store.me?.name}
          />
        </div>,
      );
    });
    // فقاعة "يكتب..." كما في واتساب
    active?.typing.forEach(u => {
      out.push(
        <div key={`typing-${u.id}`} className="flex items-end gap-2 mb-2 cx-pop" dir={i18n.dir()}>
          <Avatar id={u.id} name={u.name} src={u.avatar} color={u.color} size={30} />
          <div className="cx-in rounded-[20px] rounded-bs-md px-4 py-3 flex items-center gap-2">
            {active.room.type === 'group' && <span className="text-[11px] font-bold" style={{ color: u.color || 'var(--accent)' }}>{u.name.split(' ')[0]}</span>}
            <span className="cx-dots" style={{ color: 'var(--muted)' }}><span /><span /><span /></span>
          </div>
        </div>,
      );
    });
    return out;
  };

  const connBadge =
    store.conn === 'online' ? { icon: <Wifi className="w-3.5 h-3.5" />, text: t('chat:online'), color: '#22c55e' }
    : store.conn === 'offline' ? { icon: <WifiOff className="w-3.5 h-3.5" />, text: t('chat:offlineRetry'), color: '#f43f5e' }
    : { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: t('chat:connecting'), color: '#f59e0b' };

  const sky = (
    <div className="cx-sky">
      <div className="cx-orb a" />
      <div className="cx-orb b" />
      <div className="cx-stars" />
      <div className="cx-grid" />
    </div>
  );

  return (
    <div className="cx-root h-[calc(100dvh-8rem)] min-h-[540px] flex" style={themeStyle(theme)} dir={i18n.dir()}>
      {sky}

      {/* ═════ قائمة المحادثات ═════ */}
      <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] lg:w-[370px] shrink-0 flex-col border-e cx-border cx-glass`}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button onClick={() => setModal({ kind: 'account' })} title={t('chat:myAccount')}>
            <Avatar id={meId} name={store.me?.name || ''} src={store.me?.avatar} color={store.me?.color} size={42} ring />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg leading-tight">{t('chat:title')}</div>
            <div className="text-[11px] font-bold flex items-center gap-1" style={{ color: connBadge.color }}>{connBadge.icon} {connBadge.text}</div>
          </div>
          <button onClick={() => setModal({ kind: 'starred' })} className="w-10 h-10 rounded-full flex items-center justify-center cx-hover" title={t('chat:starred')}><Star className="w-5 h-5" /></button>
          <button onClick={() => setModal({ kind: 'theme' })} className="w-10 h-10 rounded-full flex items-center justify-center cx-hover" title={t('chat:pageTheme')}><Palette className="w-5 h-5" /></button>
          <button onClick={() => setModal({ kind: 'new' })} className="w-10 h-10 rounded-full flex items-center justify-center cx-accent-bg shadow-lg" title={t('chat:newChat')}><Plus className="w-5 h-5" /></button>
        </div>

        <div className="px-4 space-y-2 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 cx-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('chat:searchAll')} className="cx-input w-full h-10 rounded-2xl ps-9 pe-8 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute top-1/2 -translate-y-1/2 end-2 cx-muted"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex gap-1.5 overflow-x-auto cx-scroll pb-1">
            {([['all', t('chat:filter.all')], ['unread', t('chat:filter.unread')], ['groups', t('chat:filter.groups')], ['direct', t('chat:filter.direct')]] as [Filter, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold transition ${filter === k ? 'cx-accent-bg' : 'cx-soft cx-hover'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto cx-scroll px-2 pb-3">
          {!store.loaded && meId && (
            <div className="space-y-2 p-2">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl cx-soft animate-pulse" />)}
            </div>
          )}
          {store.loaded && !shown.length && !people.length && (
            <p className="text-center text-sm cx-muted py-10">{search ? t('chat:noResults') : t('chat:noChats')}</p>
          )}
          {shown.map(r => {
            const selected = r.room.id === activeId;
            const lastSender = r.last ? (r.last.user_id === meId ? t('chat:you') : users[r.last.user_id]?.name.split(' ')[0]) : '';
            return (
              <button
                key={r.room.id}
                onClick={() => openRoom(r.room.id)}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-2xl text-start transition ${selected ? 'cx-soft' : 'cx-hover'}`}
                style={selected ? { boxShadow: 'inset -3px 0 0 var(--accent)' } : undefined}
              >
                <Avatar id={r.room.id} name={r.title} src={r.avatar} color={r.color} group={r.room.type === 'group'} size={50} online={r.room.type === 'direct' ? r.online : undefined} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 font-bold text-sm truncate">{r.title}</span>
                    <span className={`text-[10px] shrink-0 ${r.unread && !r.myMember?.muted ? 'cx-accent font-bold' : 'cx-muted'}`}>{formatListTime(r.last?.created_at || r.room.updated_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`flex-1 text-xs truncate ${r.typing.length ? 'cx-accent font-bold' : 'cx-muted'}`}>
                      {r.typing.length
                        ? subtitle(r)
                        : preview(r.last, r.last?.user_id === meId, r.room.type === 'group' || r.last?.kind === 'system' ? lastSender : undefined)}
                    </span>
                    {r.last?.user_id === meId && !r.typing.length && r.last.kind !== 'system' && readStateOf(r.last) === 'read' && r.room.id === activeId && <CheckCheck className="w-3.5 h-3.5 cx-accent shrink-0" />}
                    {r.myMember?.muted ? <BellOff className="w-3.5 h-3.5 cx-muted shrink-0" /> : null}
                    {r.myMember?.pinned ? <Pin className="w-3.5 h-3.5 cx-muted shrink-0" /> : null}
                    {r.mentioned && <span className="w-5 h-5 rounded-full cx-accent-bg flex items-center justify-center shrink-0" title={t('chat:mentioned')}><AtSign className="w-3 h-3" /></span>}
                    {r.unread > 0 && (
                      <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 ${r.myMember?.muted ? 'cx-soft cx-muted' : 'cx-accent-bg'}`}>
                        {r.unread > 99 ? '99+' : r.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {people.length > 0 && (
            <>
              <div className="text-[11px] font-bold cx-muted px-3 pt-3 pb-1">{t('chat:people')}</div>
              {people.map(u => (
                <button key={u.id} onClick={async () => openRoom(await store.openDirect(u.id))} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl cx-hover text-start">
                  <Avatar id={u.id} name={u.name} src={u.avatar} color={u.color} size={42} />
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{u.name}</div>
                    <div className="text-xs cx-muted truncate">{u.role || t('chat:startChat')}</div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* ═════ المحادثة المفتوحة ═════ */}
      <section className={`${active ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col relative`} style={active ? lookStyle(look) : undefined} {...dragHandlers}>
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
            <div className="w-24 h-24 rounded-[2rem] cx-accent-bg flex items-center justify-center shadow-2xl cx-pop">
              <MessagesSquare className="w-12 h-12" />
            </div>
            <div className="font-black text-2xl">{t('chat:opsRoom')}</div>
            <p className="cx-muted text-sm max-w-sm">{t('chat:emptyHint')}</p>
            <div className="flex gap-4 cx-muted text-xs">
              <span className="flex items-center gap-1"><Paperclip className="w-4 h-4" /> {t('chat:files')}</span>
              <span className="flex items-center gap-1"><Mic className="w-4 h-4" /> {t('chat:voiceNotes')}</span>
              <span className="flex items-center gap-1"><Upload className="w-4 h-4" /> {t('chat:dragDrop')}</span>
            </div>
          </div>
        ) : (
          <>
            <header className="cx-glass border-b cx-border flex items-center gap-2 px-3 py-2.5 z-20">
              <button onClick={() => setActiveId('')} className="md:hidden w-10 h-10 rounded-full flex items-center justify-center cx-hover" aria-label={t('chat:back')}><ArrowRight className="w-5 h-5 ltr:rotate-180" /></button>
              <button onClick={openInfo} className="flex-1 min-w-0 flex items-center gap-3 text-start">
                <Avatar id={active.room.id} name={active.title} src={active.avatar} color={active.color} group={active.room.type === 'group'} size={42} online={active.room.type === 'direct' ? active.online : undefined} />
                <div className="min-w-0">
                  <div className="font-black text-sm truncate">{active.title}</div>
                  <div className={`text-xs truncate ${active.typing.length || active.online ? 'cx-accent font-bold' : 'cx-muted'}`}>
                    {active.typing.length ? <span className="inline-flex items-center gap-1"><span className="cx-dots"><span /><span /><span /></span> {subtitle(active)}</span> : subtitle(active)}
                  </div>
                </div>
              </button>
              <button onClick={() => (findOpen ? closeFind() : setFindOpen(true))} className={`w-10 h-10 rounded-full flex items-center justify-center ${findOpen ? 'cx-soft cx-accent' : 'cx-hover'}`} title={t('chat:searchChat')}><Search className="w-5 h-5" /></button>
              <button onClick={() => setModal({ kind: 'look' })} className="w-10 h-10 rounded-full flex items-center justify-center cx-hover" title={t('chat:lookHint')}><Type className="w-5 h-5" /></button>
              <button onClick={openInfo} className="w-10 h-10 rounded-full flex items-center justify-center cx-hover" title={t('chat:info')}><Info className="w-5 h-5" /></button>
            </header>

            {findOpen && (
              <div className="relative z-30 cx-fade">
                <div className="cx-glass border-b cx-border flex items-center gap-2 px-3 py-2 flex-wrap">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 cx-muted" />
                    <input autoFocus value={findQ} onChange={e => { setFindQ(e.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)} placeholder={t('chat:searchThis')} className="cx-input w-full h-9 rounded-xl ps-9 pe-3 text-sm"
                      onKeyDown={e => { if (e.key === 'Enter' && matches.length) { setShowResults(false); setFindIdx(i => (i - 1 + matches.length) % matches.length); } if (e.key === 'Escape') closeFind(); }} />
                  </div>
                  <label className={`h-9 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer border cx-border ${findDate ? 'cx-accent-bg border-transparent' : 'cx-hover'}`} title={t('chat:searchDate')}>
                    <CalendarDays className="w-4 h-4" />
                    {findDate ? formatDay(new Date(findDate + 'T12:00').getTime()) : t('chat:date')}
                    <input type="date" value={findDate} max={new Date().toLocaleDateString('en-CA')} onChange={e => { setFindDate(e.target.value); setShowResults(true); }} className="w-0 h-0 opacity-0 absolute" onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()} />
                  </label>
                  {findDate && <button onClick={() => setFindDate('')} className="w-7 h-7 rounded-full flex items-center justify-center cx-hover" title={t('chat:clearDate')}><X className="w-3.5 h-3.5" /></button>}
                  <span className="text-xs cx-muted min-w-[3rem] text-center">{findQ || findDate ? `${matches.length ? findIdx + 1 : 0}/${matches.length}` : ''}</span>
                  <button disabled={!matches.length} onClick={() => { setShowResults(false); setFindIdx(i => (i - 1 + matches.length) % matches.length); }} className="w-8 h-8 rounded-full flex items-center justify-center cx-hover disabled:opacity-40" title={t('chat:older')}><ChevronUp className="w-4 h-4" /></button>
                  <button disabled={!matches.length} onClick={() => { setShowResults(false); setFindIdx(i => (i + 1) % matches.length); }} className="w-8 h-8 rounded-full flex items-center justify-center cx-hover disabled:opacity-40" title={t('chat:newer')}><ChevronDown className="w-4 h-4" /></button>
                  <button onClick={closeFind} className="w-8 h-8 rounded-full flex items-center justify-center cx-hover"><X className="w-4 h-4" /></button>
                </div>
                {showResults && (findQ.trim() || findDate) && (
                  <div className="absolute inset-x-3 top-full mt-1 max-h-80 overflow-y-auto cx-scroll rounded-2xl border cx-border shadow-2xl p-1.5" style={{ background: 'var(--panel-solid)' }}>
                    {!results.length && <p className="text-center text-sm cx-muted py-6">{t('chat:noResults')}</p>}
                    {results.slice().reverse().slice(0, 100).map(m => {
                      const u = users[m.user_id];
                      return (
                        <button key={m.id} onClick={() => { setShowResults(false); setFindIdx(matches.indexOf(m.id)); jump(m.id); }} className="w-full flex items-start gap-2.5 px-2 py-2 rounded-xl cx-hover text-start">
                          <Avatar id={m.user_id} name={u?.name || t('chat:unknownInitial')} src={u?.avatar} color={u?.color} size={32} />
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 text-[11px]">
                              <b className="truncate">{m.user_id === meId ? t('chat:you') : u?.name || t('chat:member')}</b>
                              <span className="ms-auto shrink-0 flex items-center gap-1 cx-muted"><CalendarDays className="w-3 h-3" /> {formatDay(m.created_at)} · {formatClock(m.created_at)}</span>
                            </span>
                            <span className="block text-[12.5px] cx-muted truncate">{m.text || (m.kind === 'voice' ? t('chat:voiceNoteIcon') : `📎 ${m.attachments[0]?.name || t('chat:attachment')}`)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {pinnedMsg && !pinnedMsg.deleted && (
              <div className="cx-glass border-b cx-border flex items-center gap-2 px-3 py-1.5 z-20 cx-fade">
                <Pin className="w-4 h-4 cx-accent shrink-0" />
                <button onClick={() => jump(pinnedMsg.id)} className="flex-1 min-w-0 text-start">
                  <span className="block text-[11px] font-bold cx-accent">{t('chat:pinned')} · {pinnedMsg.user_id === meId ? t('chat:you') : users[pinnedMsg.user_id]?.name}</span>
                  <span className="block text-xs truncate">{pinnedMsg.text || `📎 ${pinnedMsg.attachments[0]?.name || t('chat:attachment')}`}</span>
                </button>
                <button onClick={() => store.pinMessage(activeId, '').catch(() => {})} className="w-7 h-7 rounded-full flex items-center justify-center cx-hover" title={t('chat:unpin')}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto cx-scroll px-3 sm:px-6 py-3">
              {list.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center gap-2 cx-muted text-sm">
                  <span className="text-4xl">👋</span> {t('chat:startHint')}
                </div>
              )}
              {renderMessages()}
            </div>

            {!atBottom && (
              <button onClick={() => scrollToBottom(true)} className="absolute end-5 bottom-24 z-30 w-11 h-11 rounded-full cx-glass border cx-border shadow-xl flex items-center justify-center cx-pop">
                <ArrowDown className="w-5 h-5" />
                {active.unread > 0 && <span className="absolute -top-1.5 -start-1.5 min-w-[20px] h-5 px-1 rounded-full cx-accent-bg text-[11px] font-black flex items-center justify-center">{active.unread}</span>}
              </button>
            )}

            <Composer
              roomId={active.room.id}
              meId={meId}
              replyTo={replyTo}
              replyUser={replyTo ? users[replyTo.user_id] : undefined}
              editing={editing}
              onCancelReply={() => setReplyTo(undefined)}
              onCancelEdit={() => setEditing(undefined)}
              onSend={o => { store.sendMessage(active.room.id, { ...o, replyTo: replyTo?.id }); setReplyTo(undefined); setAtBottom(true); }}
              onSendVoice={v => { store.sendMessage(active.room.id, { voice: v, replyTo: replyTo?.id }); setReplyTo(undefined); }}
              onEdit={t => { if (editing) store.editMessage(editing, t).catch(() => {}); setEditing(undefined); }}
              onTyping={() => store.notifyTyping(active.room.id)}
              handleRef={composer}
              mentionable={mentionable}
            />

            {dragOver && (
              <div className="cx-drop pointer-events-none">
                <Upload className="w-12 h-12 cx-accent" />
                <div className="font-black">{t('chat:dropTo', { name: active.title })}</div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ═════ النوافذ ═════ */}
      {modal?.kind === 'account' && <AccountModal store={store} onClose={() => setModal(null)} onAdmin={() => setModal({ kind: 'admin' })} />}
      {modal?.kind === 'admin' && store.isAdmin && <AdminModal store={store} onClose={() => setModal(null)} />}
      {modal?.kind === 'theme' && <ThemeModal current={theme.id} onPick={t => pickTheme(t.id)} onClose={() => setModal(null)} />}
      {modal?.kind === 'new' && <NewChatModal store={store} onClose={() => setModal(null)} onOpen={openRoom} onNewGroup={() => setModal({ kind: 'group' })} />}
      {modal?.kind === 'group' && (
        <GroupModal
          store={store}
          room={modal.room ? roomViews.find(r => r.room.id === modal.room!.room.id) || modal.room : undefined}
          onClose={() => setModal(null)}
          onCreated={openRoom}
        />
      )}
      {modal?.kind === 'user' && (
        <UserModal
          store={store}
          userId={modal.id}
          room={modal.room ? roomViews.find(r => r.room.id === modal.room!.room.id) : undefined}
          onClose={() => setModal(null)}
          onMessage={openRoom}
        />
      )}
      {modal?.kind === 'forward' && <ForwardModal store={store} onClose={() => setModal(null)} onPick={room => store.forwardMessage(room, modal.msg)} />}
      {modal?.kind === 'delete' && <ConfirmDelete onClose={() => setModal(null)} onConfirm={() => store.deleteMessage(modal.msg).catch(() => {})} />}
      {modal?.kind === 'info' && active && <MessageInfoModal store={store} msg={modal.msg} room={active} onClose={() => setModal(null)} />}
      {modal?.kind === 'starred' && <StarredModal store={store} onJump={jumpInRoom} onClose={() => setModal(null)} />}
      {modal?.kind === 'look' && active && (
        <LookModal
          title={active.title}
          look={look}
          onChange={l => saveLooks({ ...looks, [activeId]: l })}
          onApplyAll={() => { const { [activeId]: cur = look } = looks; saveLooks({ '*': cur }); }}
          onClose={() => setModal(null)}
        />
      )}
      {viewFile && (
        <SaharaFilePreview
          file={{ id: viewFile.fileId, record_id: '', name: viewFile.name, type: viewFile.type, size: viewFile.size, created_at: 0 }}
          load={() => fileUrl(viewFile.fileId, viewFile.type).then(u => fetch(u).then(r => r.blob()))}
          onClose={() => setViewFile(null)}
        />
      )}
      {lightbox && <Lightbox items={lightbox.items} index={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
};

export default ChatApp;

function byIdLookup(list: ChatMessage[], id: string) {
  return list.find(m => m.id === id);
}
