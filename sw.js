// CineSnap service worker: makes the app installable and usable offline.
// App files are fetched network-first (so updates show up straight away) with
// the cache as an offline fallback. Pinned CDN libraries are cache-first.
const CACHE = 'cinesnap-v2';
const APP_SHELL = ['./', 'index.html', 'style.css', 'app.js', 'favicon.svg', 'manifest.webmanifest'];
const CDN_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://unpkg.com/lucide@1.60.0/dist/umd/lucide.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await Promise.all(CDN_LIBS.map(url => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never touch local film object URLs or range requests
  if (url.protocol === 'blob:' || req.headers.has('range')) return;

  if (CDN_LIBS.includes(req.url)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
    );
  }
});
