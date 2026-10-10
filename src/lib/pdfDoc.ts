import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * فتح ملف PDF لقراءة نصه: عامل خلفي (worker) واحد مشترك لكل الملفات، والملف يُغلق بعد القراءة.
 * بدون ذلك كان كل ملف يشغّل عاملًا جديدًا ويبقى في الذاكرة (الرفع المتعدد = ~10 عمال)، فيثقل الهاتف ويتجمّد.
 */
const load = async () => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  // تحذيرات الخطوط داخل الملفات (TT: undefined function) لا تؤثر على القراءة: الأخطاء فقط
  return { pdfjs, worker: new pdfjs.PDFWorker({ verbosity: pdfjs.VerbosityLevel.ERRORS }) };
};
let ready: ReturnType<typeof load> | null = null;

/** fonts: خرائط الأحرف والخطوط (للملفات التي تحتاجها لاستخراج النص العربي) */
export const withPdf = async <T>(file: File, fonts: boolean, read: (pdf: PDFDocumentProxy) => Promise<T>): Promise<T> => {
  ready ??= load().catch(e => { ready = null; throw e; });
  const { pdfjs, worker } = await ready;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    worker,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    ...(fonts ? { cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/' } : {})
  });
  try {
    return await read(await task.promise);
  } finally {
    // يحرر الملف من ذاكرة العامل (العامل المشترك نفسه يبقى)
    void task.destroy();
  }
};

/**
 * تجهيز مسبق لمكتبات قراءة الملفات (PDF وExcel) في وقت فراغ المتصفح:
 * بدونه يُحمَّل ويُجهَّز كودها لحظة اختيار الملفات لأول مرة (نحو 300 KB مضغوطة)، فيتجمّد الهاتف الضعيف عدة ثوانٍ
 * ثم تصبح المرة الثانية سريعة لأنها جاهزة في الذاكرة. لا يعمل مع "توفير البيانات" أو الشبكة البطيئة جدًا.
 */
let warmed = false;
export const warmFileReaders = () => {
  if (warmed || typeof window === 'undefined') return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') return;
  warmed = true;
  const run = () => {
    // عامل PDF يبدأ وهو يُحمَّل؛ مكتبة Excel تُجلب وتُجهَّز دون قراءة أي ملف
    ready ??= load().catch(e => { ready = null; throw e; });
    void ready.catch(() => undefined);
    void import('xlsx').catch(() => undefined);
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 6000 }); else setTimeout(run, 3000);
};
