// عامل خدمة بسيط لجعل التطبيق قابلاً للتثبيت (Open in app)
// يجلب من الشبكة دائمًا، ويعود للنسخة المخزنة من الصفحة الرئيسية عند انقطاع الاتصال
const CACHE = 'etihad-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
  }
});
