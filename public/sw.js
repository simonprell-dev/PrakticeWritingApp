// Offline support: after the first visit the app also runs without internet (school Wi-Fi).
const CACHE = 'buchstaben-zoo-v2';
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/fonts/Fredoka.woff2',
  '/fonts/Druckvorlage.woff2',
  '/fonts/PlaywriteDEGrund.woff2',
  '/model/templates-v1.json',
  '/model/templates-v1.bin',
  '/model/glyphnet-v1.json',
  '/model/glyphnet-v1.bin',
  '/legal.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname === '/healthz') return;

  if (req.mode === 'navigate') {
    // network first, so updates arrive; cached page when offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req))),
    );
    return;
  }

  if (url.pathname === '/legal.json') {
    // operator details (imprint, privacy contact) must always be current
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // stale-while-revalidate for everything else
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
