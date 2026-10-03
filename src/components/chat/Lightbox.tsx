import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { downloadFile, fileUrl, type Attachment } from './chatApi';
import { formatSize, isVideo } from './chatUtils';

interface Props {
  items: Attachment[];
  index: number;
  onClose: () => void;
}

/** عارض الوسائط بملء الشاشة: صور، فيديو، PDF */
export const Lightbox: React.FC<Props> = ({ items, index, onClose }) => {
  const [i, setI] = useState(index);
  const [zoom, setZoom] = useState(1);
  const [url, setUrl] = useState('');
  const a = items[i];

  useEffect(() => {
    setUrl('');
    setZoom(1);
    if (!a?.fileId) return;
    let alive = true;
    fileUrl(a.fileId, a.type).then(u => alive && setUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [a?.fileId, a?.type]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setI(x => Math.min(items.length - 1, x + 1));
      if (e.key === 'ArrowRight') setI(x => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onClose]);

  if (!a) return null;
  const pdf = a.type === 'application/pdf';

  // يُعرض في body مباشرة حتى لا يختفي زر الإغلاق خلف شريط التطبيق العلوي
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col cx-fade" dir="rtl" onClick={onClose}>
      <div className="flex items-center gap-2 p-3 sm:p-4 text-white" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }} onClick={e => e.stopPropagation()}>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" dir="auto">{a.name}</p>
          <p className="text-[11px] text-white/60 font-mono">{formatSize(a.size)} · {i + 1} / {items.length}</p>
        </div>
        {!pdf && !isVideo(a.type) && (
          <>
            <button className="p-2.5 rounded-full hover:bg-white/10" onClick={() => setZoom(z => Math.min(4, z + 0.5))} title="تكبير"><ZoomIn className="w-5 h-5" /></button>
            <button className="p-2.5 rounded-full hover:bg-white/10" onClick={() => setZoom(z => Math.max(1, z - 0.5))} title="تصغير"><ZoomOut className="w-5 h-5" /></button>
          </>
        )}
        <button className="p-2.5 rounded-full hover:bg-white/10" onClick={() => downloadFile(a)} title="تنزيل"><Download className="w-5 h-5" /></button>
        <button className="w-11 h-11 rounded-full bg-white/15 hover:bg-rose-500 flex items-center justify-center transition" onClick={onClose} title="إغلاق (Esc)"><X className="w-6 h-6" /></button>
      </div>

      <div className="flex-1 min-h-0 relative flex items-center justify-center px-2 sm:px-16 pb-4 overflow-auto" onClick={e => e.stopPropagation()}>
        {!url ? (
          a.thumb ? <img src={a.thumb} className="max-w-full max-h-full object-contain blur-sm opacity-70" alt="" /> : <Loader2 className="w-10 h-10 text-white animate-spin" />
        ) : pdf ? (
          <iframe src={url} title={a.name} className="w-full h-full max-w-5xl rounded-xl bg-white" />
        ) : isVideo(a.type) ? (
          <video src={url} controls autoPlay className="max-w-full max-h-full rounded-xl shadow-2xl" />
        ) : (
          <img
            src={url}
            alt={a.name}
            onDoubleClick={() => setZoom(z => (z > 1 ? 1 : 2.5))}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-300 cursor-zoom-in"
            style={{ transform: `scale(${zoom})` }}
          />
        )}

        {items.length > 1 && (
          <>
            <button disabled={i === 0} onClick={() => setI(i - 1)} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white flex items-center justify-center">
              <ChevronRight className="w-6 h-6" />
            </button>
            <button disabled={i === items.length - 1} onClick={() => setI(i + 1)} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white flex items-center justify-center">
              <ChevronLeft className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex gap-2 justify-center p-3 overflow-x-auto" onClick={e => e.stopPropagation()}>
          {items.map((x, k) => (
            <button key={x.fileId + k} onClick={() => setI(k)} className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${k === i ? 'border-white scale-105' : 'border-transparent opacity-50'}`}>
              {x.thumb ? <img src={x.thumb} className="w-full h-full object-cover" alt="" /> : <span className="w-full h-full bg-white/10 block text-[9px] text-white p-1 truncate">{x.name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  , document.body);
};
