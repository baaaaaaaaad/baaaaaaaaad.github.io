const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

const STATIC_ASSETS = [
  './',
  'index.html',
  'post.html',
  'admin.html',
  'res/css/index.css',
  'res/js/config.js',
  'res/js/gist.js',
  'res/js/index.js',
  'res/js/post.js',
  'res/js/admin.js',
  'res/js/nav.js',
  'res/js/vendor/marked.min.js',
  'res/js/vendor/purify.min.js',
  'res/icon/rainbow.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.hostname === 'api.github.com') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (url.hostname !== location.hostname) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then((c) => c.put(req, clone));
          return res;
        })
    )
  );
});