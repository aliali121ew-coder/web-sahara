import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Printer, Download, Loader2, FileText, FileSpreadsheet, AlertTriangle, ZoomIn, ZoomOut,
  RotateCw, PenLine, Undo2, Eraser, Search, ChevronUp, ChevronDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchSaharaFileBlob, fileKind, type SaharaFile } from '../../lib/saharaFiles';
import { renderExcel, excelSheetCss, type RenderedSheet } from '../../lib/excelRender';

type PdfDoc = import('pdfjs-dist').PDFDocumentProxy;
type PdfPage = import('pdfjs-dist').PDFPageProxy;
type Rotation = 0 | 90 | 180 | 270;

/** خط تأشير: نقاط ونسبة سُمك منسوبة لأبعاد الصفحة قبل التدوير (0..1)، فيبقى ثابتًا مع التكبير والتدوير */
interface Stroke { color: string; width: number; pts: [number, number][] }
/** مستطيل نتيجة بحث منسوب لأبعاد الصفحة (0..1) */
interface Hit { x: number; y: number; w: number; h: number }

const PX_PER_PT = 96 / 72; // 100% = الحجم الحقيقي للورقة
const PEN_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#0f172a', '#facc15'];
const PEN_WIDTH = 0.004; // من عرض الصفحة
const ZOOM_MIN = 0.25, ZOOM_MAX = 3, ZOOM_STEP = 0.1;

// توحيد النص العربي للبحث: أشكال الحروف، الهمزات، التشكيل والتطويل
const normalize = (s: string) =>
  s.normalize('NFKC').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) => {
  if (!s.pts.length) return;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = Math.max(1, s.width * w);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = s.color === '#facc15' ? 0.55 : 1; // الأصفر كقلم تظليل
  ctx.beginPath();
  s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * w + 0.1, s.pts[0][1] * h);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const rotateTransform = (r: Rotation, w: number, h: number) =>
  r === 90 ? `translateX(${h}px) rotate(90deg)`
    : r === 180 ? `translate(${w}px, ${h}px) rotate(180deg)`
      : r === 270 ? `translateY(${w}px) rotate(270deg)`
        : undefined;

/**
 * إطار صفحة: يدوّر المحتوى، ويضع فوقه طبقة نتائج البحث وطبقة التأشير بالقلم.
 * w و h أبعاد المحتوى (بعد التكبير وقبل التدوير).
 */
const PageFrame: React.FC<{
  w: number; h: number; rotation: Rotation;
  strokes: Stroke[]; onStroke: (s: Stroke) => void; penColor: string | null;
  hits?: (Hit & { current: boolean })[];
  children: React.ReactNode;
}> = ({ w, h, rotation, strokes, onStroke, penColor, hits, children }) => {
  const inkRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<Stroke | null>(null);
  const swapped = rotation % 180 !== 0;

  useEffect(() => {
    const c = inkRef.current;
    if (!c || !w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    strokes.forEach(s => drawStroke(ctx, s, w, h));
  }, [w, h, strokes]);

  // موضع المؤشر على الشاشة ← نقطة على الصفحة قبل التدوير
  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
    return rotation === 90 ? [cy, 1 - cx] : rotation === 180 ? [1 - cx, 1 - cy] : rotation === 270 ? [1 - cy, cx] : [cx, cy];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!penColor) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { color: penColor, width: PEN_WIDTH, pts: [toLocal(e)] };
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = live.current;
    if (!s) return;
    s.pts.push(toLocal(e));
    const ctx = inkRef.current!.getContext('2d')!;
    drawStroke(ctx, { ...s, pts: s.pts.slice(-2) }, w, h);
  };
  const onUp = () => {
    if (live.current) onStroke(live.current);
    live.current = null;
  };

  return (
    <div className="relative mx-auto shadow-[0_4px_24px_rgba(15,23,42,0.18)] bg-white" style={{ width: swapped ? h : w, height: swapped ? w : h }}>
      <div className="absolute top-0 left-0" style={{ width: w, height: h, transform: rotateTransform(rotation, w, h), transformOrigin: '0 0' }}>
        {children}
        {hits?.map((hit, i) => (
          <div
            key={i}
            data-hit-current={hit.current || undefined}
            className={`absolute pointer-events-none rounded-sm ${hit.current ? 'bg-orange-500/45 ring-2 ring-orange-600' : 'bg-yellow-300/45'}`}
            style={{ left: hit.x * w, top: hit.y * h, width: hit.w * w, height: hit.h * h }}
          />
        ))}
        <canvas
          ref={inkRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={`absolute inset-0 ${penColor ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
          style={{ width: w, height: h }}
        />
      </div>
    </div>
  );
};

/** صفحة PDF مرسومة بـ pdf.js بحجم التكبير الحالي */
const PdfCanvas: React.FC<{ page: PdfPage; w: number; h: number; zoom: number }> = ({ page, w, h, zoom }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: zoom * PX_PER_PT });
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    const task = page.render({ canvasContext: canvas.getContext('2d')!, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined, canvas } as Parameters<PdfPage['render']>[0]);
    task.promise.catch(() => { /* أُلغي عند تغيير التكبير */ });
    return () => task.cancel();
  }, [page, zoom]);
  return <canvas ref={ref} className="block" style={{ width: w, height: h }} />;
};

/** نصوص صفحة PDF بمواقعها (للبحث) */
type TextItem = { text: string; rtl: boolean; x: number; y: number; w: number; h: number };

const printHtml = (html: string) => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
  frame.srcdoc = html;
  frame.onload = () => {
    // انتظار تحميل الصور قبل الطباعة
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60_000);
    }, 300);
  };
  document.body.appendChild(frame);
};

/**
 * معاينة مرفق قبل الطباعة: PDF و Excel بنفس الشكل (صفحات بيضاء على خلفية رمادية) وللقراءة فقط،
 * مع التكبير والتدوير والتأشير بالقلم والبحث، والطباعة (مع التأشير والتدوير) والتنزيل.
 * التأشير للمعاينة والطباعة فقط ولا يُحفظ في الملف.
 */
export const SaharaFilePreview: React.FC<{ file: SaharaFile; onClose: () => void; load?: () => Promise<Blob> }> = ({ file, onClose, load }) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const isPdf = fileKind(file) === 'pdf';
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PDF
  const [pdfPages, setPdfPages] = useState<{ page: PdfPage; w: number; h: number }[]>([]);
  const [pdfText, setPdfText] = useState<TextItem[][]>([]);
  const pdfPrintRef = useRef<HTMLIFrameElement>(null);
  // Excel
  const [sheets, setSheets] = useState<RenderedSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [sheetSize, setSheetSize] = useState<{ w: number; h: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // أدوات المحرر
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [penColor, setPenColor] = useState<string | null>(null);
  const [lastColor, setLastColor] = useState(PEN_COLORS[0]);
  const [strokes, setStrokes] = useState<Record<string, Stroke[]>>({});
  const [history, setHistory] = useState<string[]>([]); // مفاتيح الصفحات بترتيب التأشير (للتراجع)
  const [query, setQuery] = useState('');
  const [hitIndex, setHitIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const changeZoom = (next: number) => setZoom(Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)) * 100) / 100);
  const rotate = () => setRotation(r => ((r + 90) % 360) as Rotation);
  const addStroke = (key: string) => (s: Stroke) => {
    setStrokes(prev => ({ ...prev, [key]: [...(prev[key] || []), s] }));
    setHistory(h => [...h, key]);
  };
  const undo = () => {
    const key = history[history.length - 1];
    if (!key) return;
    setStrokes(prev => ({ ...prev, [key]: (prev[key] || []).slice(0, -1) }));
    setHistory(h => h.slice(0, -1));
  };
  const clearInk = () => { setStrokes({}); setHistory([]); };
  const hasInk = history.length > 0;

  // تحميل الملف
  useEffect(() => {
    let url: string | null = null;
    let task: { destroy(): Promise<void> } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = load ? await load() : await fetchSaharaFileBlob(file.id);
        if (cancelled) return;
        url = URL.createObjectURL(isPdf ? new Blob([blob], { type: 'application/pdf' }) : blob);
        setBlobUrl(url);
        if (isPdf) {
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
          // الخطوط وجداول الحروف (public/pdfjs منسوخة من pdfjs-dist): بدونها لا يظهر نص الخطوط غير المضمّنة كالعربي
          const loading = pdfjs.getDocument({
            data: new Uint8Array(await blob.arrayBuffer()),
            cMapUrl: '/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/pdfjs/standard_fonts/',
            wasmUrl: '/pdfjs/wasm/',
            // تحذيرات خطوط الملف لا تؤثر على العرض
            verbosity: pdfjs.VerbosityLevel.ERRORS
          });
          task = loading;
          const doc: PdfDoc = await loading.promise;
          const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)));
          if (cancelled) return;
          setPdfPages(pages.map(page => {
            const v = page.getViewport({ scale: PX_PER_PT });
            return { page, w: v.width, h: v.height };
          }));
          // نصوص الصفحات للبحث (بمواقع منسوبة لأبعاد الصفحة)
          const texts = await Promise.all(pages.map(async page => {
            const v = page.getViewport({ scale: 1 });
            const content = await page.getTextContent();
            return (content.items as { str?: string; transform?: number[]; width?: number; height?: number }[])
              .filter(it => it.str && it.transform)
              .map(it => {
                const [, , , d, e, f] = it.transform!;
                const height = it.height || Math.abs(d) || 10;
                const [x, y] = v.convertToViewportPoint(e, f);
                return {
                  text: normalize(it.str!),
                  rtl: /[֐-ࣿ]/.test(it.str!),
                  x: x / v.width, y: (y - height) / v.height, w: (it.width || 0) / v.width, h: (height * 1.15) / v.height
                };
              });
          }));
          if (!cancelled) setPdfText(texts);
        } else {
          const rendered = await renderExcel(await blob.arrayBuffer(), file.id);
          if (cancelled) return;
          if (!rendered.length) throw new Error(t('finance:filePreview.noSheets'));
          setSheets(rendered);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('finance:filePreview.openFailed'));
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      task?.destroy();
    };
  }, [file.id, isPdf]);

  // Excel: قياس حجم الورقة الطبيعي (قبل التكبير)
  const sheet = sheets[activeSheet];
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    setSheetSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [sheet]);

  // البحث
  const q = normalize(query.trim());
  const pdfHits = useMemo(() => {
    if (!isPdf || !q) return [] as { page: number; hit: Hit }[];
    const out: { page: number; hit: Hit }[] = [];
    const qRev = [...q].reverse().join(''); // بعض ملفات PDF تخزّن العربي معكوسًا
    pdfText.forEach((items, page) => items.forEach(it => {
      let idx = it.text.indexOf(q);
      if (idx < 0 && it.rtl) idx = it.text.indexOf(qRev);
      while (idx >= 0) {
        // العربي: يُظلَّل العنصر كاملًا (ترتيب الحروف لا يطابق مواقعها)
        const hit = it.rtl || !it.text.length
          ? { x: it.x, y: it.y, w: it.w, h: it.h }
          : { x: it.x + (it.w * idx) / it.text.length, y: it.y, w: (it.w * q.length) / it.text.length, h: it.h };
        out.push({ page, hit });
        if (it.rtl) break;
        idx = it.text.indexOf(q, idx + q.length);
      }
    }));
    return out;
  }, [isPdf, q, pdfText]);

  const [excelHitCount, setExcelHitCount] = useState(0);
  const hitCount = isPdf ? pdfHits.length : excelHitCount;
  const current = hitCount ? ((hitIndex % hitCount) + hitCount) % hitCount : -1;

  // Excel: تمييز الخلايا المطابقة داخل الورقة
  useEffect(() => {
    const el = sheetRef.current;
    if (isPdf || !el) return;
    const cells = Array.from(el.querySelectorAll('td'));
    cells.forEach(td => td.classList.remove('xl-hit', 'xl-hit-current'));
    if (!q) { setExcelHitCount(0); return; }
    const matches = cells.filter(td => normalize(td.textContent || '').includes(q));
    matches.forEach(td => td.classList.add('xl-hit'));
    setExcelHitCount(matches.length);
    if (matches.length) {
      const cur = matches[((hitIndex % matches.length) + matches.length) % matches.length];
      cur.classList.add('xl-hit-current');
      cur.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
  }, [isPdf, q, hitIndex, sheet, sheetSize]);

  // PDF: التمرير لنتيجة البحث الحالية
  useEffect(() => {
    if (!isPdf || current < 0) return;
    requestAnimationFrame(() => scrollRef.current?.querySelector('[data-hit-current]')?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }));
  }, [isPdf, current, zoom, rotation]);

  useEffect(() => { setHitIndex(0); }, [q]);

  // لوحة المفاتيح (لا تعمل أثناء الكتابة في خانة البحث)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
      else if (e.key === '-') setZoom(z => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
      else if (e.key === '0') setZoom(1);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ready = isPdf ? pdfPages.length > 0 : !!sheet;

  // صورة تأشير صفحة بحجم معيّن (للطباعة)
  const inkDataUrl = (key: string, w: number, h: number) => {
    const list = strokes[key];
    if (!list?.length) return null;
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    list.forEach(s => drawStroke(ctx, s, w, h));
    return c.toDataURL('image/png');
  };

  const print = async () => {
    if (isPdf) {
      // بدون تأشير أو تدوير: الملف الأصلي بدقته الكاملة
      if (!hasInk && rotation === 0) {
        const win = pdfPrintRef.current?.contentWindow;
        win?.focus();
        win?.print();
        return;
      }
      const imgs: string[] = [];
      for (let i = 0; i < pdfPages.length; i++) {
        const { page } = pdfPages[i];
        const v = page.getViewport({ scale: 2 * PX_PER_PT });
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = v.width; pageCanvas.height = v.height;
        await page.render({ canvasContext: pageCanvas.getContext('2d')!, viewport: v, canvas: pageCanvas } as Parameters<PdfPage['render']>[0]).promise;
        const ctx = pageCanvas.getContext('2d')!;
        (strokes[`page:${i}`] || []).forEach(s => drawStroke(ctx, s, v.width, v.height));
        const swapped = rotation % 180 !== 0;
        const out = document.createElement('canvas');
        out.width = swapped ? v.height : v.width; out.height = swapped ? v.width : v.height;
        const octx = out.getContext('2d')!;
        octx.translate(out.width / 2, out.height / 2);
        octx.rotate((rotation * Math.PI) / 180);
        octx.drawImage(pageCanvas, -v.width / 2, -v.height / 2);
        imgs.push(out.toDataURL('image/jpeg', 0.92));
      }
      printHtml(`<!doctype html><html><head><meta charset="utf-8"><style>
        @page{margin:0} html,body{margin:0}
        img{display:block;width:100vw;height:100vh;object-fit:contain;page-break-after:always;break-after:page}
      </style></head><body>${imgs.map(src => `<img src="${src}">`).join('')}</body></html>`);
      return;
    }
    if (!sheet || !sheetSize) return;
    const { w, h } = sheetSize;
    const swapped = rotation % 180 !== 0;
    const ink = inkDataUrl(`sheet:${sheet.name}`, w, h);
    const landscape = swapped ? !sheet.landscape : sheet.landscape;
    printHtml(`<!doctype html><html><head><meta charset="utf-8"><style>
      ${excelSheetCss()}
      @page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:10mm} html,body{margin:0}
      .xl-page{padding:0}
    </style></head><body>
      <div class="box" style="position:relative;width:${swapped ? h : w}px;height:${swapped ? w : h}px">
        <div style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;transform:${rotateTransform(rotation, w, h) ?? 'none'};transform-origin:0 0">
          <div class="xl-page">${sheet.body}</div>
          ${ink ? `<img src="${ink}" style="position:absolute;inset:0;width:${w}px;height:${h}px">` : ''}
        </div>
      </div>
      <script>
        // ملاءمة الورقة لعرض الصفحة المطبوعة
        var box=document.querySelector('.box');document.body.style.zoom=Math.min(1,${landscape ? 1050 : 720}/box.offsetWidth);
      </script>
    </body></html>`);
  };

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.name;
    a.click();
  };

  const Icon = isPdf ? FileText : FileSpreadsheet;
  const toolBtn = 'w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors';

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150" dir={i18n.dir()} onClick={onClose}>
      <style>{excelSheetCss('.xl-scope')}</style>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-5xl h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* الرأس: اسم الملف والأزرار */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-sm text-slate-900 dark:text-white truncate">{file.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('finance:filePreview.title')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={download} disabled={!blobUrl} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-bold cursor-pointer">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('finance:filePreview.download')}</span>
            </button>
            <button type="button" onClick={print} disabled={!ready} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-black shadow-md cursor-pointer active:scale-95 transition-all">
              <Printer className="w-4 h-4" />
              {t('common:print.print')}
            </button>
            <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* شريط أدوات المحرر */}
        <div className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex flex-wrap items-center gap-2">
          {/* التكبير */}
          <div className="flex items-center rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 p-0.5" dir="ltr">
            <button type="button" onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} title={t('finance:filePreview.zoomOut')} className={toolBtn}><ZoomOut className="w-4 h-4" /></button>
            <button type="button" onClick={() => changeZoom(1)} title={t('finance:filePreview.actualSize')} className="min-w-[48px] h-8 px-1 rounded-lg text-[11px] font-black font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} title={t('finance:filePreview.zoomIn')} className={toolBtn}><ZoomIn className="w-4 h-4" /></button>
          </div>

          {/* التدوير */}
          <button type="button" onClick={rotate} title={t('finance:filePreview.rotateHint')} className="h-9 flex items-center gap-1.5 px-2.5 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer">
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">{t('finance:filePreview.rotate')}</span>
            {rotation !== 0 && <span className="font-mono text-[10px] text-teal-600 dark:text-teal-400">{rotation}°</span>}
          </button>

          {/* القلم والألوان */}
          <div className="flex items-center gap-1 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setPenColor(p => (p ? null : lastColor))}
              title={penColor ? t('finance:filePreview.penOff') : t('finance:filePreview.penOn')}
              className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${penColor ? 'bg-teal-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              <PenLine className="w-4 h-4" />
              <span className="hidden sm:inline">{t('finance:filePreview.pen')}</span>
            </button>
            {PEN_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { setLastColor(c); setPenColor(c); }}
                title={t('finance:filePreview.penColor')}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform ring-offset-1 ring-offset-white dark:ring-offset-slate-800 ${(penColor ?? lastColor) === c ? 'ring-2 ring-slate-500 scale-110' : 'hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
            <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <button type="button" onClick={undo} disabled={!hasInk} title={t('finance:filePreview.undo')} className={toolBtn}><Undo2 className="w-4 h-4" /></button>
            <button type="button" onClick={clearInk} disabled={!hasInk} title={t('finance:filePreview.clearInk')} className={toolBtn}><Eraser className="w-4 h-4" /></button>
          </div>

          {/* البحث */}
          <div className="flex items-center gap-1 ms-auto rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 ps-2.5 pe-0.5 py-0.5 focus-within:ring-2 focus-within:ring-teal-500">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setHitIndex(i => i + (e.shiftKey ? -1 : 1)); } }}
              placeholder={t('finance:filePreview.search')}
              className="w-32 sm:w-44 h-8 bg-transparent outline-none text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            {q && (
              <span className={`text-[10.5px] font-black font-mono shrink-0 px-1 ${hitCount ? 'text-slate-500' : 'text-rose-500'}`} dir="ltr">
                {hitCount ? `${current + 1}/${hitCount}` : '0'}
              </span>
            )}
            <button type="button" onClick={() => setHitIndex(i => i - 1)} disabled={!hitCount} title={t('common:pagination.prev')} className={toolBtn}><ChevronUp className="w-4 h-4" /></button>
            <button type="button" onClick={() => setHitIndex(i => i + 1)} disabled={!hitCount} title={t('common:pagination.next')} className={toolBtn}><ChevronDown className="w-4 h-4" /></button>
          </div>
        </div>

        {/* أوراق Excel */}
        {!isPdf && sheets.length > 1 && (
          <div className="px-4 pt-2 flex gap-1.5 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
            {sheets.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => { setActiveSheet(i); setSheetSize(null); }}
                className={`px-3 py-1.5 rounded-t-lg text-xs font-bold whitespace-nowrap cursor-pointer ${i === activeSheet ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* المحتوى */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-slate-200 dark:bg-slate-950">
          {error ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-bold">
              <AlertTriangle className="w-6 h-6" />
              {error}
            </div>
          ) : !ready ? (
            <div className="h-full flex items-center justify-center gap-2 text-slate-500 text-sm font-bold">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('finance:filePreview.loading')}
            </div>
          ) : isPdf ? (
            <div className="p-6 flex flex-col gap-6 w-max min-w-full" dir="ltr">
              {pdfPages.map(({ page, w, h }, i) => (
                <PageFrame
                  key={i}
                  w={w * zoom} h={h * zoom} rotation={rotation}
                  strokes={strokes[`page:${i}`] || []} onStroke={addStroke(`page:${i}`)} penColor={penColor}
                  hits={pdfHits.map((m, n) => ({ ...m, n })).filter(m => m.page === i).map(m => ({ ...m.hit, current: m.n === current }))}
                >
                  <PdfCanvas page={page} w={w * zoom} h={h * zoom} zoom={zoom} />
                </PageFrame>
              ))}
              <iframe ref={pdfPrintRef} src={blobUrl!} title={file.name} aria-hidden tabIndex={-1} className="fixed -left-[9999px] top-0 w-px h-px opacity-0 pointer-events-none" />
            </div>
          ) : (
            <div className="p-6 w-max min-w-full" dir="ltr">
              <PageFrame
                w={(sheetSize?.w ?? 0) * zoom} h={(sheetSize?.h ?? 0) * zoom} rotation={rotation}
                strokes={strokes[`sheet:${sheet.name}`] || []} onStroke={addStroke(`sheet:${sheet.name}`)} penColor={penColor}
              >
                <div className="xl-scope" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
                  <div ref={sheetRef} className="xl-page w-max" dangerouslySetInnerHTML={{ __html: sheet.body }} />
                </div>
              </PageFrame>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SaharaFilePreview;
