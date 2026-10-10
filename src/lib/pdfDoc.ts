import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * فتح ملف PDF لقراءة نصه: عامل خلفي (worker) واحد مشترك لكل الملفات، والملف يُغلق بعد القراءة.
 * بدون ذلك كان كل ملف يشغّل عاملًا جديدًا ويبقى في الذاكرة (الرفع المتعدد = ~10 عمال)، فيثقل الهاتف ويتجمّد.
 */
const load = async () => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  return { pdfjs, worker: new pdfjs.PDFWorker() };
};
let ready: ReturnType<typeof load> | null = null;

/** fonts: خرائط الأحرف والخطوط (للملفات التي تحتاجها لاستخراج النص العربي) */
export const withPdf = async <T>(file: File, fonts: boolean, read: (pdf: PDFDocumentProxy) => Promise<T>): Promise<T> => {
  ready ??= load().catch(e => { ready = null; throw e; });
  const { pdfjs, worker } = await ready;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    worker,
    ...(fonts ? { cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/' } : {})
  });
  try {
    return await read(await task.promise);
  } finally {
    // يحرر الملف من ذاكرة العامل (العامل المشترك نفسه يبقى)
    void task.destroy();
  }
};
