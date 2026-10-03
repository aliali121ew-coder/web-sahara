// تسجيل عامل الخدمة (ملف منفصل بدل سكربت مضمّن حتى تسمح به سياسة أمان المحتوى CSP)
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
