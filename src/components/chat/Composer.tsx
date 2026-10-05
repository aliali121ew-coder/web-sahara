import { fmtList } from '../../i18n/format';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, Smile, Mic, SendHorizontal, X, Trash2, Image as ImageIcon, FileText, Camera, Reply, Pencil, Siren, Pause, Play } from 'lucide-react';
import type { ChatMessage, ChatUser } from './chatApi';
import { Avatar } from './Avatar';
import { EMOJI_GROUPS, fileVisual, formatDuration, formatSize, isImage } from './chatUtils';

export interface ComposerHandle {
  addFiles: (files: File[]) => void;
}

interface Props {
  roomId: string;
  replyTo?: ChatMessage;
  replyUser?: ChatUser;
  editing?: ChatMessage;
  meId: string;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (o: { text: string; files: File[]; urgent: boolean }) => void;
  onSendVoice: (v: { blob: Blob; duration: number; peaks: number[] }) => void;
  onEdit: (text: string) => void;
  onTyping: () => void;
  handleRef: React.MutableRefObject<ComposerHandle | null>;
  /** أعضاء المجموعة القابلون للإشارة بـ @ */
  mentionable?: ChatUser[];
}

const MAX_FILES = 10;
const MAX_SIZE = 50 * 1024 * 1024;
const drafts = new Map<string, string>();

const pickMime = () => {
  const list = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  return list.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) || '';
};

export const Composer: React.FC<Props> = (p) => {
  const { t, i18n } = useTranslation(['chat', 'common']);
  const [text, setText] = useState(() => drafts.get(p.roomId) || '');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [error, setError] = useState('');
  // ───── الإشارات @ ─────
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const mentionList = mention && p.mentionable
    ? [{ id: '__all', name: 'الكل', role: t('chat:mentionAllRole') } as ChatUser, ...p.mentionable]
        .filter(u => u.name.includes(mention.q))
        .slice(0, 8)
    : [];
  const detectMention = (value: string, caret: number) => {
    if (!p.mentionable?.length) return setMention(null);
    const m = /(^|\s)@([^\s@]*)$/.exec(value.slice(0, caret));
    setMention(m ? { q: m[2], start: caret - m[2].length - 1 } : null);
    setMentionIdx(0);
  };
  const pickMention = (u: ChatUser) => {
    if (!mention) return;
    const el = ta.current;
    const caret = el?.selectionStart ?? text.length;
    const ins = `@${u.name} `;
    const next = text.slice(0, mention.start) + ins + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = mention.start + ins.length;
      el?.setSelectionRange(pos, pos);
    });
  };
  const ta = useRef<HTMLTextAreaElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // ───── التسجيل الصوتي ─────
  const [rec, setRec] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const samples = useRef<number[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const clock = useRef<{ start: number; acc: number }>({ start: 0, acc: 0 });
  const cancelled = useRef(false);

  // تبديل الغرفة: حفظ المسودة واستعادة مسودة الغرفة الجديدة
  const prevRoom = useRef(p.roomId);
  useEffect(() => {
    if (prevRoom.current !== p.roomId) {
      drafts.set(prevRoom.current, text);
      setText(drafts.get(p.roomId) || '');
      setFiles([]);
      setUrgent(false);
      prevRoom.current = p.roomId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.roomId]);

  useEffect(() => {
    if (p.editing) {
      setText(p.editing.text);
      setTimeout(() => ta.current?.focus(), 0);
    }
  }, [p.editing]);
  useEffect(() => { if (p.replyTo) ta.current?.focus(); }, [p.replyTo]);

  // ارتفاع تلقائي لمربع الكتابة
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text]);

  useEffect(() => {
    const urls = files.map(f => (isImage(f.type) ? URL.createObjectURL(f) : ''));
    setPreviews(urls);
    return () => urls.forEach(u => u && URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (list: File[]) => {
    const tooBig = list.filter(f => f.size > MAX_SIZE);
    if (tooBig.length) setError(t('chat:tooBig', { list: fmtList(tooBig.map(f => f.name)) }));
    setFiles(prev => [...prev, ...list.filter(f => f.size <= MAX_SIZE)].slice(0, MAX_FILES));
    setAttachOpen(false);
  };
  p.handleRef.current = { addFiles };

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const submit = () => {
    const body = text.trim();
    if (p.editing) {
      if (body && body !== p.editing.text) p.onEdit(body);
      else p.onCancelEdit();
      setText('');
      return;
    }
    if (!body && !files.length) return;
    p.onSend({ text: body, files, urgent });
    setText('');
    setFiles([]);
    setUrgent(false);
    setEmojiOpen(false);
    drafts.delete(p.roomId);
    ta.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionList.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + mentionList.length) % mentionList.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(mentionList[mentionIdx] || mentionList[0]);
        return;
      }
      if (e.key === 'Escape') { setMention(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      if (p.editing) { p.onCancelEdit(); setText(''); }
      else if (p.replyTo) p.onCancelReply();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const list = Array.from(e.clipboardData.files || []);
    if (list.length) {
      e.preventDefault();
      addFiles(list);
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = ta.current;
    if (!el) return setText(t => t + emoji);
    const s = el.selectionStart ?? text.length;
    const eEnd = el.selectionEnd ?? text.length;
    const next = text.slice(0, s) + emoji + text.slice(eEnd);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + emoji.length, s + emoji.length);
    });
  };

  const stopTracks = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
  };

  const startRec = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t('chat:noRecording'));
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      recorder.current = r;
      chunks.current = [];
      samples.current = [];
      cancelled.current = false;
      r.ondataavailable = e => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stopTracks();
        const duration = (clock.current.acc + (clock.current.start ? Date.now() - clock.current.start : 0)) / 1000;
        if (cancelled.current || duration < 0.6) { setRec('idle'); return; }
        const blob = new Blob(chunks.current, { type: r.mimeType || mime || 'audio/webm' });
        const src = samples.current;
        const bars = 48;
        const peaks = Array.from({ length: bars }, (_, i) => {
          const from = Math.floor((i * src.length) / bars);
          const to = Math.max(from + 1, Math.floor(((i + 1) * src.length) / bars));
          return Math.max(0, ...src.slice(from, to));
        });
        const top = Math.max(...peaks, 0.01);
        p.onSendVoice({ blob, duration, peaks: peaks.map(v => +(v / top).toFixed(2)) });
        setRec('idle');
      };

      // موجة حيّة من المايكروفون
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let lastSample = 0;
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += ((buf[i] - 128) / 128) ** 2;
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        if (recorder.current?.state === 'recording' && performance.now() - lastSample > 80) {
          lastSample = performance.now();
          samples.current.push(rms);
          setLive(l => [...l.slice(-39), rms]);
        }
        setElapsed((clock.current.acc + (clock.current.start ? Date.now() - clock.current.start : 0)) / 1000);
        raf.current = requestAnimationFrame(loop);
      };
      s.getTracks()[0].addEventListener('ended', () => ctx.close());
      clock.current = { start: Date.now(), acc: 0 };
      r.start(250);
      setLive([]);
      setRec('recording');
      loop();
    } catch {
      setError(t('chat:micDenied'));
    }
  };

  const pauseRec = () => {
    const r = recorder.current;
    if (!r) return;
    if (r.state === 'recording') {
      r.pause();
      clock.current = { start: 0, acc: clock.current.acc + Date.now() - clock.current.start };
      setRec('paused');
    } else if (r.state === 'paused') {
      r.resume();
      clock.current = { ...clock.current, start: Date.now() };
      setRec('recording');
    }
  };
  const finishRec = () => {
    const r = recorder.current;
    if (r && r.state !== 'inactive') r.stop();
  };
  const cancelRec = () => {
    cancelled.current = true;
    finishRec();
  };
  useEffect(() => () => { cancelled.current = true; recorder.current?.state !== 'inactive' && recorder.current?.stop(); stopTracks(); }, []);

  const canSend = !!text.trim() || files.length > 0;

  return (
    <div className="relative px-2 sm:px-4 pb-2 sm:pb-3 pt-1">
      {error && <div className="absolute -top-9 start-4 end-4 text-center text-[12px] font-bold text-white bg-rose-500/95 rounded-xl py-1.5 cx-pop z-10">{error}</div>}

      {mentionList.length > 0 && (
        <div className="absolute bottom-full mb-2 start-3 sm:start-5 w-[min(300px,88vw)] max-h-72 overflow-y-auto cx-scroll rounded-2xl border cx-border shadow-2xl p-1.5 z-30 cx-slide-up" style={{ background: 'var(--panel-solid)' }}>
          {mentionList.map((u, i) => (
            <button key={u.id} onMouseDown={e => { e.preventDefault(); pickMention(u); }} onMouseEnter={() => setMentionIdx(i)}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-start ${i === mentionIdx ? 'cx-soft' : ''}`}>
              <Avatar id={u.id} name={u.name} src={u.avatar} color={u.color} group={u.id === '__all'} size={32} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold truncate">@{u.name}</span>
                {u.role && <span className="block text-[10.5px] cx-muted truncate">{u.role}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="cx-glass border cx-border rounded-[26px] shadow-xl overflow-visible">
        {/* شريط الرد / التعديل */}
        {(p.replyTo || p.editing) && (
          <div className="flex items-center gap-3 px-4 pt-3 cx-fade">
            {p.editing ? <Pencil className="w-4 h-4 cx-accent shrink-0" /> : <Reply className="w-4 h-4 cx-accent shrink-0" />}
            <div className="flex-1 min-w-0 border-s-[3px] ps-2.5" style={{ borderColor: 'var(--accent)' }}>
              <p className="text-[12px] font-bold cx-accent">{p.editing ? t('chat:editMessage') : p.replyTo!.user_id === p.meId ? t('chat:replyToSelf') : t('chat:replyTo', { name: p.replyUser?.name || t('chat:member') })}</p>
              <p className="text-[12px] cx-muted truncate">{(p.editing || p.replyTo)!.text || (p.replyTo?.kind === 'voice' ? t('chat:voiceNoteIcon') : t('chat:attachmentIcon'))}</p>
            </div>
            <button onClick={() => { if (p.editing) { p.onCancelEdit(); setText(''); } else p.onCancelReply(); }} className="p-1.5 rounded-full cx-hover"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* المرفقات قبل الإرسال */}
        {files.length > 0 && (
          <div className="flex gap-2 px-3 pt-3 overflow-x-auto cx-scroll">
            {files.map((f, i) => {
              const v = fileVisual(f.name, f.type);
              const Icon = v.icon;
              return (
                <div key={f.name + i} className="relative shrink-0 w-[84px] cx-pop">
                  <div className="w-[84px] h-[84px] rounded-2xl overflow-hidden border cx-border flex flex-col items-center justify-center" style={{ background: previews[i] ? undefined : `linear-gradient(160deg, ${v.color}, color-mix(in srgb, ${v.color} 55%, #000))` }}>
                    {previews[i] ? <img src={previews[i]} className="w-full h-full object-cover" alt="" /> : (<><Icon className="w-7 h-7 text-white" /><span className="text-[9px] font-black text-white mt-1">{v.label.slice(0, 5)}</span></>)}
                  </div>
                  <p className="text-[10px] truncate mt-1 cx-muted" dir="auto">{f.name}</p>
                  <p className="text-[9px] cx-muted font-mono">{formatSize(f.size)}</p>
                  <button onClick={() => setFiles(fs => fs.filter((_, k) => k !== i))} className="absolute -top-1.5 -end-1.5 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg"><X className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
        )}

        {rec !== 'idle' ? (
          /* واجهة التسجيل */
          <div className="flex items-center gap-2 sm:gap-3 p-2 cx-fade" dir={i18n.dir()}>
            <button onClick={cancelRec} className="w-11 h-11 rounded-full flex items-center justify-center text-rose-500 cx-hover shrink-0" title={t('common:actions.cancel')}><Trash2 className="w-5 h-5" /></button>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`w-3 h-3 rounded-full bg-rose-500 ${rec === 'recording' ? 'cx-rec-pulse' : 'opacity-40'}`} />
              <span className="font-mono text-sm font-bold tabular-nums">{formatDuration(elapsed)}</span>
            </div>
            <div className="flex-1 flex items-center gap-[3px] h-9 overflow-hidden justify-end" dir="ltr">
              {live.map((v, i) => (
                <span key={i} className="w-[3px] rounded-full transition-all duration-100" style={{ height: `${Math.max(10, v * 100)}%`, background: 'linear-gradient(to top, var(--accent), var(--accent2))' }} />
              ))}
            </div>
            <button onClick={pauseRec} className="w-11 h-11 rounded-full flex items-center justify-center cx-hover shrink-0" title={rec === 'paused' ? t('chat:resume') : t('chat:pauseRec')}>
              {rec === 'paused' ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
            <button onClick={finishRec} className="w-12 h-12 rounded-full flex items-center justify-center cx-accent-bg shadow-lg shrink-0 active:scale-90 transition-transform" title={t('chat:sendVoice')}>
              <SendHorizontal className="w-5 h-5 -scale-x-100" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1 sm:gap-1.5 p-1.5 sm:p-2">
            {/* المرفقات */}
            <div className="relative">
              <button onClick={() => { setAttachOpen(o => !o); setEmojiOpen(false); }} className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cx-hover ${attachOpen ? 'rotate-45 cx-accent' : 'cx-muted'}`} title={t('chat:attach')}>
                <Paperclip className="w-5 h-5" />
              </button>
              {attachOpen && (
                <div className="absolute bottom-14 start-0 w-52 rounded-2xl border cx-border shadow-2xl p-1.5 cx-slide-up z-20" style={{ background: 'var(--panel-solid)' }}>
                  <AttachItem icon={ImageIcon} color="#8b5cf6" label={t('chat:photosVideos')} onClick={() => mediaInput.current?.click()} />
                  <AttachItem icon={FileText} color="#2563eb" label={t('chat:document')} onClick={() => fileInput.current?.click()} />
                  <AttachItem icon={Camera} color="#db2777" label={t('chat:camera')} onClick={() => cameraInput.current?.click()} />
                </div>
              )}
              <input ref={mediaInput} type="file" accept="image/*,video/*" multiple hidden onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
              <input ref={fileInput} type="file" multiple hidden onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
            </div>

            {/* الإيموجي */}
            <div className="relative">
              <button onClick={() => { setEmojiOpen(o => !o); setAttachOpen(false); }} className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center cx-hover ${emojiOpen ? 'cx-accent' : 'cx-muted'}`} title={t('chat:emoji')}>
                <Smile className="w-5 h-5" />
              </button>
              {emojiOpen && (
                <div className="absolute bottom-14 -start-12 sm:start-0 w-[min(320px,86vw)] max-h-72 overflow-y-auto cx-scroll rounded-2xl border cx-border shadow-2xl p-2 cx-slide-up z-20" style={{ background: 'var(--panel-solid)' }}>
                  {EMOJI_GROUPS.map(g => (
                    <div key={g.id} className="mb-2">
                      <p className="text-[10px] font-bold cx-muted px-1 mb-1">{t(`chat:emoji.${g.id}`)}</p>
                      <div className="grid grid-cols-8 gap-0.5">
                        {g.list.map(e => (
                          <button key={e} onClick={() => insertEmoji(e)} className="text-[22px] h-9 rounded-lg cx-hover hover:scale-125 transition-transform">{e}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <textarea
              ref={ta}
              value={text}
              rows={1}
              dir="auto"
              onChange={e => { setText(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length); if (e.target.value) p.onTyping(); }}
              onClick={e => detectMention(text, e.currentTarget.selectionStart ?? text.length)}
              onKeyDown={onKey}
              onPaste={onPaste}
              placeholder={p.editing ? t('chat:editPh') : urgent ? t('chat:urgentPh') : t('chat:messagePh')}
              className="flex-1 min-w-0 resize-none bg-transparent outline-none text-[14.5px] leading-6 py-2 px-1 max-h-40 cx-scroll placeholder:opacity-60"
              style={{ color: 'var(--text)' }}
            />

            {!p.editing && (
              <button
                onClick={() => setUrgent(u => !u)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${urgent ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40' : 'cx-muted cx-hover'}`}
                title={t('chat:urgent')}
              >
                <Siren className="w-5 h-5" />
              </button>
            )}

            {canSend || p.editing ? (
              <button onClick={submit} className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all cx-pop ${urgent ? 'bg-rose-500 text-white' : 'cx-accent-bg'}`} title={t('chat:send')}>
                <SendHorizontal className="w-5 h-5 -scale-x-100" />
              </button>
            ) : (
              <button onClick={startRec} className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center cx-accent-bg shadow-lg active:scale-90 transition-all" title={t('chat:recordVoice')}>
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AttachItem: React.FC<{ icon: React.ElementType; color: string; label: string; onClick: () => void }> = ({ icon: Icon, color, label, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl cx-hover text-[13px] font-semibold">
    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow" style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))` }}><Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" /></span>
    {label}
  </button>
);
