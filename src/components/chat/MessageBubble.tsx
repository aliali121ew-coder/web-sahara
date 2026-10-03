import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Clock, AlertTriangle, Reply, Smile, MoreVertical, Copy, Pencil, Trash2, Forward, RotateCcw, X, Ban, Siren, Info, Star, StarOff, Pin, PinOff, EyeOff } from 'lucide-react';
import { DELETE_WINDOW_MS } from './useChat';
import type { Attachment, ChatMessage, ChatUser } from './chatApi';
import { Avatar } from './Avatar';
import { AudioFile, FileCard, MediaGrid, VoicePlayer, isAudio, isMedia } from './Attachments';
import { colorFor, formatClock, REACTIONS } from './chatUtils';

export type ReadState = 'pending' | 'sent' | 'read' | 'failed';

interface Props {
  msg: ChatMessage;
  mine: boolean;
  sender?: ChatUser;
  isGroup: boolean;
  firstInRun: boolean;
  lastInRun: boolean;
  reply?: ChatMessage;
  replyUser?: ChatUser;
  readState: ReadState;
  users: Record<string, ChatUser>;
  meId: string;
  highlight?: string;
  flash?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onOpenMedia: (a: Attachment) => void;
  onJump: (id: string) => void;
  onRetry: () => void;
  onDiscard: () => void;
  onOpenUser: (id: string) => void;
  onInfo: () => void;
  onStar: () => void;
  onPin: () => void;
  onHide: () => void;
  starred?: boolean;
  pinned?: boolean;
  /** نمط الإشارات: أسماء الأعضاء */
  mentionRe?: RegExp;
  myName?: string;
}

const URL_RE = /(https?:\/\/[^\s]+)/g;
const EMOJI_ONLY = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\s){1,12}$/u;

const renderText = (text: string, highlight?: string, mentionRe?: RegExp, myName?: string): React.ReactNode =>
  text.split(URL_RE).map((part, i) => {
    if (i % 2 === 1) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all opacity-90 hover:opacity-100">{part}</a>;
    }
    // الإشارات @الاسم
    if (mentionRe) {
      const bits = part.split(mentionRe);
      if (bits.length > 1) {
        return (
          <React.Fragment key={i}>
            {bits.map((b, j) => (j % 2 === 1
              ? <span key={j} className="font-extrabold rounded px-0.5" style={b === '@' + myName || b === '@الكل' ? { background: 'color-mix(in srgb, var(--accent2) 35%, transparent)' } : { color: 'var(--accent2)', filter: 'brightness(1.3)' }}>{b}</span>
              : <React.Fragment key={j}>{renderText(b, highlight)}</React.Fragment>))}
          </React.Fragment>
        );
      }
    }
    if (!highlight) return <React.Fragment key={i}>{part}</React.Fragment>;
    const q = highlight.toLowerCase();
    const out: React.ReactNode[] = [];
    let rest = part;
    let k = 0;
    while (rest) {
      const at = rest.toLowerCase().indexOf(q);
      if (at < 0) { out.push(rest); break; }
      out.push(rest.slice(0, at), <mark key={k++} className="bg-yellow-300 text-black rounded px-0.5">{rest.slice(at, at + q.length)}</mark>);
      rest = rest.slice(at + q.length);
    }
    return <React.Fragment key={i}>{out}</React.Fragment>;
  });

export const MessageBubble: React.FC<Props> = (p) => {
  const { msg, mine, sender, isGroup, firstInRun, lastInRun, reply, replyUser, readState, users, meId } = p;
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const openMenu = () => {
    // افتح القائمة للأعلى إذا كانت الرسالة قرب أسفل منطقة الرسائل
    const r = rowRef.current?.getBoundingClientRect();
    const box = rowRef.current?.closest('.cx-scroll')?.getBoundingClientRect();
    setMenuUp(!!r && !!box && box.bottom - r.bottom < 330 && r.top - box.top > 200);
    setMenu(true);
  };
  const [copied, setCopied] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [menu]);

  if (msg.kind === 'system') {
    return (
      <div className="flex justify-center my-2 cx-fade">
        <span className="text-[11px] px-3 py-1 rounded-full cx-glass cx-muted border cx-border">
          <b style={{ color: 'var(--text)' }}>{sender?.name || 'عضو'}</b> {msg.text}
        </span>
      </div>
    );
  }

  const media = msg.attachments.filter(isMedia);
  const audios = msg.kind === 'voice' ? [] : msg.attachments.filter(a => isAudio(a.type));
  const files = msg.attachments.filter(a => !isMedia(a) && !(isAudio(a.type)));
  const voice = msg.kind === 'voice' ? msg.attachments[0] : undefined;
  const emojiOnly = !msg.attachments.length && EMOJI_ONLY.test(msg.text) && msg.text.trim().length <= 16;
  const reactions = Object.entries(msg.reactions || {}).filter(([, v]) => v.length);
  const onlyMedia = media.length > 0 && !msg.text && !files.length && !audios.length;
  const nameColor = sender?.color || colorFor(msg.user_id);
  // الرسائل الطويلة تُطوى كما في واتساب (قراءة المزيد)
  const LIMIT_CHARS = 600;
  const LIMIT_LINES = 12;
  const lines = msg.text.split('\n');
  const long = msg.text.length > LIMIT_CHARS + 100 || lines.length > LIMIT_LINES + 3;
  // البحث أو الانتقال لرسالة يفتحها كاملة
  const collapsed = long && !expanded && !p.highlight;
  const shortText = collapsed ? lines.slice(0, LIMIT_LINES).join('\n').slice(0, LIMIT_CHARS).replace(/\s+\S*$/, '') : msg.text;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* تجاهل */ }
    setMenu(false);
  };

  const touchStart = () => { pressTimer.current = setTimeout(() => openMenu(), 420); };
  const touchEnd = () => clearTimeout(pressTimer.current);

  // رسائلي على اليسار ورسائل الآخرين على اليمين (اتجاه عربي)
  const corner = mine
    ? `${firstInRun ? 'rounded-tl-[22px]' : 'rounded-tl-md'} rounded-bl-md rounded-tr-[22px] rounded-br-[22px]`
    : `${firstInRun ? 'rounded-tr-[22px]' : 'rounded-tr-md'} rounded-br-md rounded-tl-[22px] rounded-bl-[22px]`;

  const meta = (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono select-none whitespace-nowrap ${onlyMedia ? 'bg-black/45 text-white px-1.5 py-0.5 rounded-full backdrop-blur' : ''}`}
      style={onlyMedia ? undefined : { color: mine ? 'var(--out-muted)' : 'var(--muted)' }}>
      {p.pinned ? <Pin className="w-3 h-3" /> : null}
      {p.starred ? <Star className="w-3 h-3 fill-current" /> : null}
      {msg.edited ? <span className="font-sans">معدّلة</span> : null}
      {formatClock(msg.created_at)}
      {mine && (readState === 'pending' ? <Clock className="w-3 h-3" /> :
        readState === 'failed' ? <AlertTriangle className="w-3 h-3 text-rose-300" /> :
        readState === 'read' ? <CheckCheck className="w-3.5 h-3.5" style={{ color: '#7dd3fc' }} /> :
        <Check className="w-3.5 h-3.5" />)}
    </span>
  );

  return (
    <div
      id={`msg-${msg.id}`}
      ref={rowRef}
      className={`group relative flex items-end justify-start gap-2 ${lastInRun ? 'mb-2.5' : 'mb-0.5'} cx-pop`}
      dir="rtl"
      // عند فتح القائمة نرفع الصف فوق الرسائل التالية (كل صف له سياق تكديس بسبب الحركة)
      style={{ flexDirection: mine ? 'row-reverse' : 'row', zIndex: menu ? 40 : undefined }}
    >
      {/* صورة المرسل في المجموعات */}
      {!mine && isGroup && (
        <div className="w-8 shrink-0 self-end">
          {lastInRun && (
            <button onClick={() => p.onOpenUser(msg.user_id)}>
              <Avatar id={msg.user_id} name={sender?.name || '؟'} src={sender?.avatar} color={sender?.color} size={32} />
            </button>
          )}
        </div>
      )}

      <div className={`relative flex flex-col max-w-[86%] sm:max-w-[70%] lg:max-w-[62%] ${mine ? 'items-end' : 'items-start'}`}>
        <div
          onContextMenu={e => { e.preventDefault(); openMenu(); }}
          onTouchStart={touchStart}
          onTouchEnd={touchEnd}
          onTouchMove={touchEnd}
          className={`relative ${emojiOnly ? '' : `${mine ? 'cx-out' : 'cx-in'} ${corner}`} ${msg.urgent ? 'cx-urgent' : ''} ${p.flash ? 'cx-flash' : ''} ${onlyMedia ? 'p-1' : emojiOnly ? '' : 'px-3.5 py-2'} ${msg.pending ? 'opacity-90' : ''} transition-all`}
        >
          {msg.urgent ? (
            <div className="flex items-center gap-1.5 text-[10.5px] font-black mb-1 px-2 py-0.5 rounded-full w-fit bg-rose-500 text-white">
              <Siren className="w-3 h-3" /> بلاغ عاجل
            </div>
          ) : null}

          {!mine && isGroup && firstInRun && !emojiOnly && (
            <button onClick={() => p.onOpenUser(msg.user_id)} className={`text-[12px] font-extrabold mb-0.5 block ${onlyMedia ? 'px-2 pt-1' : ''}`} style={{ color: nameColor, filter: 'brightness(1.25)' }}>
              {sender?.name || 'عضو'}
              {sender?.role && <span className="font-medium cx-muted mr-1.5 text-[10px]">· {sender.role}</span>}
            </button>
          )}

          {msg.deleted ? (
            <p className="flex items-center gap-1.5 text-[13px] italic opacity-70"><Ban className="w-3.5 h-3.5" /> تم حذف هذه الرسالة</p>
          ) : (
            <>
              {reply && (
                <button
                  onClick={() => p.onJump(reply.id)}
                  className="block w-full text-right rounded-xl px-2.5 py-1.5 mb-1.5 border-r-[3px] text-[12px] overflow-hidden"
                  style={{ background: mine ? 'rgba(0,0,0,.16)' : 'var(--panel2)', borderColor: replyUser?.color || 'var(--accent)' }}
                >
                  <span className="font-bold block" style={{ color: mine ? '#fff' : replyUser?.color || 'var(--accent)' }}>{reply.user_id === meId ? 'أنت' : replyUser?.name || 'عضو'}</span>
                  <span className="block truncate opacity-80">
                    {reply.deleted ? 'رسالة محذوفة' : reply.text || (reply.kind === 'voice' ? '🎤 بصمة صوتية' : `📎 ${reply.attachments[0]?.name || 'مرفق'}`)}
                  </span>
                </button>
              )}

              {voice && <VoicePlayer a={voice} mine={mine} avatar={<Avatar id={msg.user_id} name={sender?.name || ''} src={sender?.avatar} color={sender?.color} size={38} />} />}
              {voice && msg.progress !== undefined && !voice.fileId && (
                <div className="h-1 rounded-full overflow-hidden bg-white/20 mt-1"><div className="h-full bg-white transition-all" style={{ width: `${(msg.progress || 0) * 100}%` }} /></div>
              )}

              {media.length > 0 && <div className={msg.text || files.length ? 'mb-1.5 -mx-1.5 -mt-0.5' : ''}><MediaGrid items={media} onOpen={p.onOpenMedia} progress={msg.progress} /></div>}

              {audios.length > 0 && <div className="space-y-2 mb-1">{audios.map((a, i) => <AudioFile key={a.fileId || i} a={a} mine={mine} />)}</div>}

              {files.length > 0 && (
                <div className="space-y-1.5 mb-1">
                  {files.map((a, i) => <FileCard key={a.fileId || a.name + i} a={a} mine={mine} progress={msg.progress} onOpen={() => p.onOpenMedia(a)} />)}
                </div>
              )}

              {msg.text && (
                <>
                  <p dir="auto" className={`whitespace-pre-wrap break-words leading-relaxed ${emojiOnly ? 'text-5xl leading-tight py-1' : ''}`} style={emojiOnly ? undefined : { fontSize: 'var(--msg-size, 14px)', overflowWrap: 'anywhere' }}>
                    {renderText(collapsed ? shortText : msg.text, p.highlight, p.mentionRe, p.myName)}
                    {collapsed && '…'}
                  </p>
                  {long && (
                    <button onClick={() => setExpanded(e => !e)} className="text-[12.5px] font-extrabold mt-0.5" style={{ color: mine ? 'var(--out-text)' : 'var(--accent)' }}>
                      {collapsed ? 'قراءة المزيد' : 'عرض أقل'}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          <div className={`flex justify-end ${onlyMedia ? 'absolute bottom-2.5 left-2.5' : emojiOnly ? '' : 'mt-0.5 -mb-0.5'}`}>{meta}</div>

          {copied && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[11px] px-2 py-0.5 rounded-full bg-black/80 text-white cx-fade">تم النسخ</span>}
        </div>

        {/* التفاعلات */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 -mt-1.5 z-[1] ${mine ? 'pl-2' : 'pr-2'}`}>
            {reactions.map(([emoji, who]) => (
              <button
                key={emoji}
                onClick={() => p.onReact(emoji)}
                title={who.map(id => (id === meId ? 'أنت' : users[id]?.name || '؟')).join('، ')}
                className={`flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full border cx-glass cx-border shadow-sm transition-transform hover:scale-110 ${who.includes(meId) ? 'ring-1' : ''}`}
                style={{ ['--tw-ring-color' as string]: 'var(--accent)' }}
              >
                <span>{emoji}</span>
                {who.length > 1 && <span className="font-bold text-[10px]">{who.length}</span>}
              </button>
            ))}
          </div>
        )}

        {msg.failed && (
          <div className="flex items-center gap-2 mt-1 text-[11px] text-rose-400 font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> لم تُرسل
            <button onClick={p.onRetry} className="flex items-center gap-1 underline"><RotateCcw className="w-3 h-3" /> إعادة</button>
            <button onClick={p.onDiscard} className="flex items-center gap-1 underline"><X className="w-3 h-3" /> حذف</button>
          </div>
        )}

        {/* القائمة السياقية */}
        {menu && !msg.deleted && (
          <div ref={menuRef} className={`absolute z-30 ${menuUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${mine ? 'left-0' : 'right-0'} w-56 rounded-2xl cx-glass border cx-border shadow-2xl p-1.5 cx-pop`} style={{ background: 'var(--panel-solid)' }}>
            <div className="flex justify-between px-1 pb-1.5 mb-1 border-b cx-border">
              {REACTIONS.slice(0, 6).map(e => (
                <button key={e} onClick={() => { p.onReact(e); setMenu(false); }} className="text-xl w-8 h-8 rounded-full hover:scale-125 transition-transform">{e}</button>
              ))}
            </div>
            <MenuItem icon={Reply} label="رد" onClick={() => { p.onReply(); setMenu(false); }} />
            <MenuItem icon={Forward} label="إعادة توجيه" onClick={() => { p.onForward(); setMenu(false); }} />
            {msg.text && <MenuItem icon={Copy} label="نسخ النص" onClick={copy} />}
            {mine && msg.text && !msg.pending && <MenuItem icon={Pencil} label="تعديل" onClick={() => { p.onEdit(); setMenu(false); }} />}
            {!msg.pending && <MenuItem icon={p.starred ? StarOff : Star} label={p.starred ? 'إلغاء التمييز' : 'تمييز بنجمة'} onClick={() => { p.onStar(); setMenu(false); }} />}
            {!msg.pending && <MenuItem icon={p.pinned ? PinOff : Pin} label={p.pinned ? 'إلغاء التثبيت' : 'تثبيت في المحادثة'} onClick={() => { p.onPin(); setMenu(false); }} />}
            {mine && !msg.pending && <MenuItem icon={Info} label="معلومات الرسالة" onClick={() => { p.onInfo(); setMenu(false); }} />}
            {!msg.pending && <MenuItem icon={EyeOff} label="حذف لدي" onClick={() => { p.onHide(); setMenu(false); }} />}
            {mine && !msg.pending && Date.now() - msg.created_at < DELETE_WINDOW_MS && <MenuItem icon={Trash2} label="حذف للجميع" danger onClick={() => { p.onDelete(); setMenu(false); }} />}
          </div>
        )}
      </div>

      {/* أزرار سريعة عند التمرير (للحاسوب) */}
      {!msg.deleted && !msg.pending && (
        <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity self-center">
          <HoverBtn title="تفاعل" onClick={openMenu}><Smile className="w-4 h-4" /></HoverBtn>
          <HoverBtn title="رد" onClick={p.onReply}><Reply className="w-4 h-4" /></HoverBtn>
          <HoverBtn title="المزيد" onClick={openMenu}><MoreVertical className="w-4 h-4" /></HoverBtn>
        </div>
      )}
    </div>
  );
};

const HoverBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button title={title} onClick={onClick} className="w-8 h-8 rounded-full flex items-center justify-center cx-muted cx-hover transition-colors">{children}</button>
);

const MenuItem: React.FC<{ icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }> = ({ icon: Icon, label, onClick, danger }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold cx-hover transition-colors ${danger ? 'text-rose-500' : ''}`}>
    <Icon className="w-4 h-4 opacity-80" /> {label}
  </button>
);
