import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Play, Pause, Loader2, Mic } from 'lucide-react';
import { downloadFile, fileUrl, type Attachment } from './chatApi';
import { fileVisual, formatDuration, formatSize, isAudio, isImage, isVideo, isViewable } from './chatUtils';

/** يحمّل رابط الملف عند الحاجة فقط */
const useFileUrl = (a: Attachment, enabled = true) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!enabled || !a.fileId) return;
    let alive = true;
    fileUrl(a.fileId, a.type).then(u => alive && setUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [a.fileId, a.type, enabled]);
  return url;
};

const SPEEDS = [1, 1.5, 2];

/** مشغّل البصمات الصوتية بموجة تفاعلية */
export const VoicePlayer: React.FC<{ a: Attachment; mine: boolean; avatar?: React.ReactNode }> = ({ a, mine, avatar }) => {
  const { t } = useTranslation(['chat', 'common']);
  const [want, setWant] = useState(false);
  const url = useFileUrl(a, want);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [dur, setDur] = useState(a.duration || 0);
  const peaks = a.peaks?.length ? a.peaks : Array.from({ length: 40 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7)));

  useEffect(() => {
    if (!url || !want) return;
    const el = new Audio(url);
    audio.current = el;
    el.playbackRate = speed;
    el.ontimeupdate = () => setPos(el.currentTime);
    el.onloadedmetadata = () => isFinite(el.duration) && setDur(el.duration);
    el.onended = () => { setPlaying(false); setPos(0); };
    el.play().then(() => setPlaying(true)).catch(() => {});
    return () => { el.pause(); audio.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, want]);

  const toggle = () => {
    if (!a.fileId) return;
    if (!want) return setWant(true);
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().then(() => setPlaying(true)).catch(() => {});
    else { el.pause(); setPlaying(false); }
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (r.right - e.clientX) / r.width));
    if (audio.current && dur) audio.current.currentTime = ratio * dur;
    else setWant(true);
  };
  const cycle = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };
  const progress = dur ? pos / dur : 0;
  const loading = want && !url;

  return (
    <div className="flex items-center gap-2.5 min-w-[230px] sm:min-w-[270px] py-1">
      {avatar}
      <button
        onClick={toggle}
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90"
        style={{ background: mine ? 'rgba(255,255,255,.22)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff' }}
        aria-label={playing ? t('chat:pause') : t('chat:play')}
      >
        {loading || !a.fileId ? <Loader2 className="w-5 h-5 animate-spin" /> : playing ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 -ms-0.5" fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[2px] h-8 cursor-pointer" onClick={seek} dir="rtl">
          {peaks.map((p, i) => {
            const on = i / peaks.length < progress;
            return (
              <span
                key={i}
                className="flex-1 rounded-full transition-colors"
                style={{
                  height: `${Math.max(12, p * 100)}%`,
                  background: on ? (mine ? '#fff' : 'var(--accent)') : mine ? 'rgba(255,255,255,.4)' : 'color-mix(in srgb, var(--muted) 45%, transparent)',
                }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5 font-mono" style={{ color: mine ? 'var(--out-muted)' : 'var(--muted)' }}>
          <span className="flex items-center gap-1"><Mic className="w-3 h-3" />{formatDuration(playing || pos ? pos : dur)}</span>
          <button onClick={cycle} className="px-1.5 rounded-full font-bold" style={{ background: mine ? 'rgba(255,255,255,.2)' : 'var(--panel2)' }}>
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
};

/** شبكة الصور والفيديو */
export const MediaGrid: React.FC<{ items: Attachment[]; onOpen: (a: Attachment) => void; progress?: number }> = ({ items, onOpen, progress }) => {
  const count = items.length;
  const shown = items.slice(0, 4);
  return (
    <div className={`grid gap-1 overflow-hidden rounded-2xl ${count === 1 ? 'grid-cols-1' : 'grid-cols-2'}`} style={{ maxWidth: 360 }}>
      {shown.map((a, i) => (
        <MediaTile key={a.fileId || a.name + i} a={a} single={count === 1} more={i === 3 && count > 4 ? count - 4 : 0} onOpen={() => onOpen(a)} progress={progress} />
      ))}
    </div>
  );
};

const MediaTile: React.FC<{ a: Attachment; single: boolean; more: number; onOpen: () => void; progress?: number }> = ({ a, single, more, onOpen, progress }) => {
  const full = useFileUrl(a, isImage(a.type) && !a.thumb);
  const src = a.thumb || full;
  const ratio = a.width && a.height ? a.width / a.height : 4 / 3;
  return (
    <button
      onClick={onOpen}
      className="relative block overflow-hidden group"
      style={{ aspectRatio: single ? String(Math.min(1.8, Math.max(0.6, ratio))) : '1', background: 'rgba(0,0,0,.25)' }}
    >
      {src ? (
        <img src={src} alt={a.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin opacity-60" /></div>
      )}
      {isVideo(a.type) && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-12 h-12 rounded-full bg-black/55 backdrop-blur flex items-center justify-center text-white">
            <Play className="w-5 h-5" fill="currentColor" />
          </span>
          {a.duration ? <span className="absolute bottom-1.5 end-1.5 text-[10px] font-mono bg-black/60 text-white rounded-md px-1.5">{formatDuration(a.duration)}</span> : null}
        </span>
      )}
      {more > 0 && <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-2xl font-black">+{more}</span>}
      {progress !== undefined && !a.fileId && (
        <span className="absolute inset-0 bg-black/45 flex items-center justify-center">
          <ProgressRing value={progress} />
        </span>
      )}
    </button>
  );
};

export const ProgressRing: React.FC<{ value: number; size?: number }> = ({ value, size = 44 }) => {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.25)" strokeWidth="3.5" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: 'stroke-dashoffset .2s' }} />
    </svg>
  );
};

/** بطاقة ملف عام (PDF، Excel، ZIP ...) */
export const FileCard: React.FC<{ a: Attachment; mine: boolean; progress?: number; onOpen?: () => void }> = ({ a, mine, progress, onOpen }) => {
  const { t } = useTranslation(['chat', 'common']);
  const v = fileVisual(a.name, a.type);
  const Icon = v.icon;
  const [busy, setBusy] = useState(false);
  const canPreview = isViewable(a.name, a.type) && !!a.fileId;
  const get = async () => {
    if (!a.fileId) return;
    setBusy(true);
    try { await downloadFile(a); } finally { setBusy(false); }
  };
  const card = (
    <div
      className="flex items-center gap-3 p-2.5 rounded-2xl min-w-[220px] max-w-[320px]"
      style={{ background: mine ? 'rgba(255,255,255,.14)' : 'var(--panel2)', border: `1px solid ${mine ? 'rgba(255,255,255,.18)' : 'var(--border)'}` }}
    >
      <button onClick={canPreview ? onOpen : get} className="relative w-11 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-white shadow-lg" style={{ background: `linear-gradient(160deg, ${v.color}, color-mix(in srgb, ${v.color} 60%, #000))` }}>
        <Icon className="w-5 h-5" />
        <span className="text-[8px] font-black mt-0.5 tracking-wide">{v.label.slice(0, 4)}</span>
      </button>
      <div className="flex-1 min-w-0">
        <button onClick={canPreview ? onOpen : get} className="block max-w-full text-start text-[13px] font-bold truncate hover:underline" title={canPreview ? t('chat:viewFile') : a.name} dir="auto">{a.name}</button>
        <p className="text-[10.5px] mt-0.5 font-mono" style={{ color: mine ? 'var(--out-muted)' : 'var(--muted)' }}>
          {progress !== undefined && !a.fileId ? `${Math.round(progress * 100)}% · ` : ''}{formatSize(a.size)}
        </p>
        {progress !== undefined && !a.fileId && (
          <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,.2)' }}>
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      {a.fileId && (
        <button onClick={get} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors" style={{ background: mine ? 'rgba(255,255,255,.2)' : 'var(--panel2)' }} title={t('chat:download')}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
  if (!a.thumb) return card;
  // معاينة أول صفحة داخل الفقاعة
  return (
    <div className="max-w-[320px] space-y-1.5">
      <button onClick={canPreview ? onOpen : get} className="relative block w-full rounded-2xl overflow-hidden border group/pv" style={{ borderColor: mine ? 'rgba(255,255,255,.2)' : 'var(--border)' }}>
        <img src={a.thumb} alt={a.name} className="w-full max-h-[260px] object-cover object-top bg-white" draggable={false} />
        <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <span className="absolute bottom-2 start-2 end-2 flex items-center justify-between text-white text-[11px] font-bold">
          <span className="px-2 py-0.5 rounded-full bg-black/45 backdrop-blur">{a.pages ? t('chat:pages', { count: a.pages }) : 'PDF'}</span>
          <span className="px-2.5 py-1 rounded-full bg-white/90 text-slate-900 opacity-0 group-hover/pv:opacity-100 transition">{t('chat:viewFile')}</span>
        </span>
      </button>
      {card}
    </div>
  );
};

/** مشغّل ملف صوتي مرفوع (ليس بصمة) */
export const AudioFile: React.FC<{ a: Attachment; mine: boolean }> = ({ a, mine }) => (
  <div className="space-y-1">
    <VoicePlayer a={a} mine={mine} />
    <p className="text-[10.5px] truncate max-w-[260px]" style={{ color: mine ? 'var(--out-muted)' : 'var(--muted)' }} dir="auto">🎵 {a.name}</p>
  </div>
);

export const isMedia = (a: Attachment) => (isImage(a.type) && !a.type.includes('svg')) || isVideo(a.type);
export { isAudio };
