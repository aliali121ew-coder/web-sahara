// عامل الخدمة: يجعل التطبيق قابلاً للتثبيت ويعمل بلا إنترنت.
// - الصفحة الرئيسية: من الشبكة أولًا وتُحدَّث نسختها المخزنة، وعند الانقطاع تُعرض المخزنة
// - ملفات البناء (/assets/): أسماؤها تحمل بصمة محتواها فلا تتغير، تُخزَّن عند أول استخدام وتُقرأ من الذاكرة
// - الصور والملفات الثابتة الأخرى: تُعرض المخزنة فورًا وتُحدَّث في الخلفية
// - البيانات (/api/): من الشبكة دائمًا (البيانات نفسها محفوظة في الجهاز وتُزامَن عند عودة الاتصال)
// كانت النسخة السابقة تخزّن الصفحة الرئيسية فقط بلا ملفات JS/CSS، فتظهر شاشة بيضاء بلا إنترنت.
// v3: أيقونة واسم جديدان (Sahara Fuel) — تجديد ذاكرة الملفات الثابتة
// v4: ملف بناء محذوف (بعد نشر جديد) كان يرد بصفحة HTML فيُخزَّن مكان ملف JS ويبقى العطل حتى بعد التحديث؛
//     تجديد الذاكرة لحذف ما خُزّن خطأً، ولا يُخزَّن بعد الآن إلا رد ليس HTML
const VERSION = 'v5';
const SHELL = `sahara-shell-${VERSION}`;
const ASSETS = `sahara-assets-${VERSION}`;
const STATIC = `sahara-static-${VERSION}`;
const KEEP = [SHELL, ASSETS, STATIC];
/** حد ملفات البناء المخزنة (تتراكم مع كل تحديث): الأقدم يُحذف أولًا */
const MAX_ASSETS = 400;
/**
 * صور العربات تُخزَّن مسبقًا حتى تظهر مع النت الضعيف أو المقطوع، ولو لم تُعرض من قبل على هذا الجهاز.
 * اختبار etihadCoverage.test.ts يتأكد أن القائمة تشمل كل ملفات public/trucks
 */
const typeImages = 'a at bs head hf hr hw is k ka kb kh kn ko kr ks l m r sa sf sf1 sl sr'.split(' ');
const labImages = 'a at bs head hf hr hw k ka kb kh kn ks l m r sf1 sl sr'.split(' ');
const VEHICLE_IMAGES = [
  '/trucks/semi_truck.jpg', '/trucks/tank/empty.webp', '/trucks/tank/glass-mask.png',
  ...typeImages.map((k) => `/trucks/types/${k}.webp`),
  ...labImages.map((k) => `/trucks/lab/${k}.webp`),
];
/** بديل صورة لم تُخزَّن بعد ولا يوجد اتصال: رسم شاحنة بسيط بدل أيقونة الصورة المكسورة */
const TRUCK_FALLBACK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><g fill="none" stroke="#94a3b8" stroke-width="4" stroke-linejoin="round"><path d="M12 54V22h58v32M70 34h20l16 16v4H70"/><circle cx="34" cy="60" r="8"/><circle cx="88" cy="60" r="8"/></g></svg>';

/** يخزّن الناقص من صور العربات واحدة واحدة، حتى لا يزاحم التطبيق على نت ضعيف؛ ما يفشل يُعاد في الفتح التالي */
const cacheVehicleImages = async () => {
  const cache = await caches.open(STATIC);
  for (const url of VEHICLE_IMAGES) {
    if (await cache.match(url)) continue;
    try {
      const res = await fetch(url);
      if (res.ok && (res.headers.get('content-type') || '').startsWith('image/')) await cache.put(url, res);
    } catch {
      return;
    }
  }
};

self.addEventListener('message', (event) => {
  if (event.data === 'cache-vehicle-images') event.waitUntil(cacheVehicleImages());
});

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
        if (res.ok && !(res.headers.get('content-type') || '').includes('text/html')) {
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
      if (url.pathname.startsWith('/trucks/')) {
        return net.catch(() => new Response(TRUCK_FALLBACK, { headers: { 'Content-Type': 'image/svg+xml' } }));
      }
      return net;
    }))
  );
});
