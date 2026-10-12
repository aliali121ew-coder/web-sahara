/**
 * بعد نشر نسخة جديدة تُحذف ملفات الصفحات القديمة من الخادم، والجهاز الذي ما زال يشغّل النسخة القديمة
 * يطلبها فيرد الخادم بصفحة HTML بدل JavaScript ("Failed to fetch dynamically imported module")
 * فتبقى الصفحة فارغة. عندها يُعاد تحميل التطبيق مرة واحدة ليأخذ النسخة الجديدة.
 * الحماية من التكرار: لا إعادة ثانية خلال دقيقة (لو كان العطل شيئًا آخر لا تدخل الصفحة في حلقة تحميل).
 */
const KEY = 'sahara_stale_build_reload_at';

export const reloadForNewBuild = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* بلا sessionStorage: نعيد التحميل مرة واحدة على الأقل */
  }
  location.reload();
  return true;
};

/** هل الخطأ فشل تحميل ملف صفحة من نسخة قديمة؟ */
export const isStaleChunkError = (e: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Expected a JavaScript/i
    .test(String((e as { message?: string })?.message ?? e));

// Vite يطلق هذا الحدث عند فشل تحميل ملف صفحة (أو ملف تابع لها)
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewBuild()) event.preventDefault();
});
window.addEventListener('unhandledrejection', (event) => {
  if (isStaleChunkError(event.reason) && reloadForNewBuild()) event.preventDefault();
});
