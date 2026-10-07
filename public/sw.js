// عامل الخدمة: يجعل التطبيق قابلاً للتثبيت ويعمل بلا إنترنت.
// - الصفحة الرئيسية: من الشبكة أولًا وتُحدَّث نسختها المخزنة، وعند الانقطاع تُعرض المخزنة
// - ملفات البناء (/assets/): أسماؤها تحمل بصمة محتواها فلا تتغير، تُخزَّن عند أول استخدام وتُقرأ من الذاكرة
// - الصور والملفات الثابتة الأخرى: تُعرض المخزنة فورًا وتُحدَّث في الخلفية
// - البيانات (/api/): من الشبكة دائمًا (البيانات نفسها محفوظة في الجهاز وتُزامَن عند عودة الاتصال)
// كانت النسخة السابقة تخزّن الصفحة الرئيسية فقط بلا ملفات JS/CSS، فتظهر شاشة بيضاء بلا إنترنت.
const VERSION = 'v2';
const SHELL = `sahara-shell-${VERSION}`;
const ASSETS = `sahara-assets-${VERSION}`;
const STATIC = `sahara-static-${VERSION}`;
const KEEP = [SHELL, ASSETS, STATIC];
/** حد ملفات البناء المخزنة (تتراكم مع كل تحديث): الأقدم يُحذف أولًا */
const MAX_ASSETS = 400;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.add(new Request('/', { cache: 'reload' }))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

const trim = async (name, max) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // التنقل (فتح التطبيق أو تحديث الصفحة)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(SHELL).then((c) => c.put('/', copy)));
          }
          return res;
        })
        .catch(() => caches.match('/', { cacheName: SHELL }).then((r) => r || Response.error()))
    );
    return;
  }

  // ملفات البناء: من الذاكرة أولًا (لا تتغير أبدًا)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req, { cacheName: ASSETS }).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(ASSETS).then((c) => c.put(req, copy)).then(() => trim(ASSETS, MAX_ASSETS)));
        }
        return res;
      }))
    );
    return;
  }

  // باقي الملفات الثابتة (الشعار، الأيقونات، صور الترحيب، ملفات pdfjs): المخزنة فورًا وتحديثها في الخلفية
  event.respondWith(
    caches.open(STATIC).then((cache) => cache.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) event.waitUntil(cache.put(req, res.clone()));
        return res;
      });
      if (hit) {
        event.waitUntil(net.catch(() => {}));
        return hit;
      }
      return net;
    }))
  );
});
