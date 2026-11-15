/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, X } from 'lucide-react';
import { PAGE_H, PAGE_W, PAPER, fitSheet } from './printConsumption';

/** عرض ورقة A4 عمودية بالبكسل (للكشوف متعددة الصفحات) */
const PORTRAIT_W = Math.round(210 * (96 / 25.4));

/**
 * معاينة الكشف قبل الطباعة (مثل معاينة تقرير الوارد): نافذة بـ 95% من الشاشة تعرض الورقة كما ستُطبع
 * (A4 أفقي بهوامشها) مصغّرة لتتسع، وزر الطباعة في الأعلى يطبع نفس الورقة المعروضة.
 */
export const PrintPreview: React.FC<{
  html: string; title: string; subtitle?: string; onClose: () => void;
  /** كشف بعدة صفحات (A4 عمودي): يُعرض كاملًا بالتمرير بلا تصغير لورقة واحدة */
  pages?: boolean;
}> = ({ html, title, subtitle, onClose, pages = false }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);

  // الورقة تتسع في المساحة المتاحة (عرضًا وارتفاعًا) دون أن تُكبَّر فوق حجمها الحقيقي
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1.25, (el.clientWidth - 32) / PAPER.w, (el.clientHeight - 32) / PAPER.h));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    if (pages) {
      // الإطار بطول الكشف كله، والتمرير في نافذة المعاينة
      const fitHeight = () => { if (frame.current) frame.current.style.height = `${doc.documentElement.scrollHeight}px`; };
      void Promise.race([doc.fonts?.ready, new Promise(r => setTimeout(r, 3000))]).then(() => { fitHeight(); setReady(true); });
      return;
    }
    void fitSheet(doc).then(() => setReady(true));
  };

  const print = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return createPortal(
    <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md font-cairo vehicle-fade-in" role="dialog" aria-modal="true" aria-label={title} dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-[95vw] h-[95vh] flex flex-col rounded-3xl bg-slate-100 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={print} disabled={!ready}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-black shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all">
              {ready ? <Printer className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              <span>طباعة</span>
            </button>
            <button type="button" onClick={onClose} aria-label="إغلاق" title="إغلاق"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {pages ? (
          <div className="flex-1 min-h-0 overflow-auto p-4 flex justify-center">
            <div className="relative bg-white rounded-sm shadow-[0_10px_40px_rgba(15,23,42,0.25)] h-fit" style={{ width: PORTRAIT_W }}>
              <iframe ref={frame} title={title} srcDoc={html} onLoad={onLoad} style={{ width: '100%', height: 600, border: 0, display: 'block', background: '#fff' }} />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-white">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
        ) : (
        <div ref={area} className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4">
          {/* الورقة بحجمها الحقيقي مصغّرة: الإطار بعرض مساحة الطباعة حتى يطابق ما سيُطبع */}
          <div dir="ltr" style={{ width: PAPER.w * scale, height: PAPER.h * scale }} className="shrink-0 overflow-hidden">
            <div className="relative bg-white rounded-sm shadow-[0_10px_40px_rgba(15,23,42,0.25)] origin-top-left"
              style={{ width: PAPER.w, height: PAPER.h, padding: `${PAPER.padY}px ${PAPER.padX}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <iframe ref={frame} title={title} srcDoc={html} onLoad={onLoad} style={{ width: PAGE_W, height: PAGE_H, border: 0, display: 'block', background: '#fff' }} />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-white">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
