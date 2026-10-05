import i18n from '../../i18n';
import { fmtDate, fmtDayLabel, fmtTime } from '../../i18n/format';
import {
  FileText, FileSpreadsheet, FileArchive, FileAudio, FileVideo, FileImage, FileCode, File as FileIcon, Presentation,
} from 'lucide-react';

export const AVATAR_COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#4f46e5', '#0d9488', '#9333ea'];

export const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('') || (i18n.language === 'ar' ? '؟' : '?');

export const ONLINE_MS = 25_000;
export const TYPING_MS = 5_000;

export const formatClock = (ts: number) => fmtTime(ts, { hour: 'numeric', minute: '2-digit' });

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const formatDay = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (sameDay(d, today) || sameDay(d, yesterday)) return fmtDayLabel(d);
  return fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

export const formatListTime = (ts: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (sameDay(d, now)) return formatClock(ts);
  if (now.getTime() - ts < 6 * 86_400_000) return fmtDate(d, { weekday: 'short' });
  return fmtDate(d, { day: 'numeric', month: 'numeric' });
};

export const lastSeenText = (ts: number) => {
  if (!ts) return i18n.t('chat:lastSeen.never');
  const diff = Date.now() - ts;
  if (diff < ONLINE_MS) return i18n.t('chat:lastSeen.online');
  const min = Math.floor(diff / 60_000);
  if (min < 1) return i18n.t('chat:lastSeen.moments');
  if (min < 60) return i18n.t('chat:lastSeen.minutes', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return i18n.t('chat:lastSeen.hours', { count: h });
  return i18n.t('chat:lastSeen.at', { day: formatDay(ts), time: formatClock(ts) });
};

export const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const formatDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const isImage = (t: string) => t.startsWith('image/');
export const isVideo = (t: string) => t.startsWith('video/');
export const isAudio = (t: string) => t.startsWith('audio/');

export const fileVisual = (name: string, type: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (type === 'application/pdf' || ext === 'pdf') return { icon: FileText, color: '#ef4444', label: 'PDF' };
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return { icon: FileSpreadsheet, color: '#16a34a', label: ext.toUpperCase() };
  if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)) return { icon: FileText, color: '#2563eb', label: ext.toUpperCase() };
  if (['ppt', 'pptx', 'key'].includes(ext)) return { icon: Presentation, color: '#ea580c', label: ext.toUpperCase() };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: FileArchive, color: '#a16207', label: ext.toUpperCase() };
  if (isAudio(type)) return { icon: FileAudio, color: '#9333ea', label: ext.toUpperCase() || 'AUDIO' };
  if (isVideo(type)) return { icon: FileVideo, color: '#db2777', label: ext.toUpperCase() || 'VIDEO' };
  if (isImage(type)) return { icon: FileImage, color: '#0891b2', label: ext.toUpperCase() || 'IMG' };
  if (['js', 'ts', 'json', 'html', 'css', 'py', 'sql', 'xml'].includes(ext)) return { icon: FileCode, color: '#475569', label: ext.toUpperCase() };
  return { icon: FileIcon, color: '#64748b', label: ext.toUpperCase() || 'FILE' };
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** تصغير صورة وإرجاعها كـ dataURL (للصور الشخصية والمصغّرات) */
export const resizeImage = async (file: Blob, max: number, quality = 0.82, square = false) => {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (square) {
      const s = Math.min(sw, sh);
      sx = (sw - s) / 2;
      sy = (sh - s) / 2;
      sw = sh = s;
    }
    const scale = Math.min(1, max / Math.max(sw, sh));
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** لقطة مصغّرة من أول الفيديو مع مدّته */
export const videoThumb = (file: Blob) =>
  new Promise<{ thumb?: string; width?: number; height?: number; duration?: number }>(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    v.src = url;
    const done = (r: { thumb?: string; width?: number; height?: number; duration?: number }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      const scale = Math.min(1, 360 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      done({ thumb: c.toDataURL('image/jpeg', 0.7), width: v.videoWidth, height: v.videoHeight, duration: v.duration });
    };
    v.onerror = () => done({});
    setTimeout(() => done({}), 6000);
  });

/** مدة وقمم موجة ملف صوتي مرفوع */
export const audioPeaks = async (file: Blob, bars = 48) => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buf.getChannelData(0);
    const step = Math.floor(data.length / bars) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < bars; i++) {
      let max = 0;
      for (let j = i * step; j < (i + 1) * step && j < data.length; j += 16) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    ctx.close();
    const top = Math.max(...peaks, 0.01);
    return { duration: buf.duration, peaks: peaks.map(p => +(p / top).toFixed(2)) };
  } catch {
    return {};
  }
};

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅'];

/** عنوان المجموعة: chat:emoji.<id> */
export const EMOJI_GROUPS: { id: string; list: string[] }[] = [
  { id: 'faces', list: ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🤔', '🤨', '😐', '🙄', '😏', '😴', '😮', '😢', '😭', '😡', '🤯', '🥳', '😇', '🤝', '🙏', '👏', '💪', '👍', '👎', '👌', '✌️', '🫡'] },
  { id: 'symbols', list: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💯', '🔥', '⭐', '✨', '⚡', '✅', '❌', '⚠️', '🚨', '📌', '📍', '🔔', '💡', '🎯', '🏆', '🎉', '🚀'] },
  { id: 'work', list: ['⛽', '🛢️', '🚚', '🚛', '🏭', '📦', '📊', '📈', '📉', '🧾', '💰', '💵', '📅', '⏰', '📞', '📝', '📎', '🔧', '🛠️', '🧯', '🦺', '🗺️', '🏗️', '🔒'] },
];

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/** ملفات يمكن عرضها داخل المحادثة بالعارض المدمج (PDF و Excel) */
export const isViewable = (name: string, type: string) =>
  type === 'application/pdf' || /\.(pdf|xlsx?|csv)$/i.test(name);

/** صورة مصغّرة لأول صفحة من PDF مع عدد الصفحات */
export const pdfThumb = async (file: Blob): Promise<{ thumb?: string; pages?: number }> => {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/',
    });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 360 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(Math.min(viewport.height, viewport.width * 1.2));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;
    const pages = doc.numPages;
    task.destroy();
    return { thumb: canvas.toDataURL('image/jpeg', 0.7), pages };
  } catch {
    return {};
  }
};
