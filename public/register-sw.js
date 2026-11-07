// تسجيل عامل الخدمة (ملف منفصل بدل سكربت مضمّن حتى تسمح به سياسة أمان المحتوى CSP)
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
    // تخزين صور العربات مسبقًا (يكمل الناقص مع كل فتح)
    navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage('cache-vehicle-images'));
  });
}
