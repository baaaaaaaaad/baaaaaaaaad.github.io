const STATIC_CACHE = 'static-v46';
const DYNAMIC_CACHE = 'dynamic-v3';
const DYNAMIC_MAX_ENTRIES = 200;

const STATIC_ASSETS = [
  './',
  'index.html',
  'post.html',
  'res/css/index.css',
  'res/js/config.js',
  'res/js/gist.js',
  'res/js/refresh-feedback.js',
  'res/js/index.js',
  'res/js/post.js',
  'res/js/admin.js',
  'res/js/theme.js',
  'res/js/nav.js',
  'res/js/sw-register.js',
  'res/js/vendor/marked.min.js',
  'res/js/vendor/purify.min.js',
  'res/img/rain.jpg',
  'res/icon/rainbow.png',
  'res/icon/bing-color.svg',
  'res/icon/baidu-color.svg',
  'res/icon/google-color.svg',
];

/** 仅缓存成功响应，并对动态缓存做简单容量上限（FIFO 淘汰最旧条目） */
async function cacheOKResponse(req, res) {
  if (!res || !res.ok) return;
  const cache = await caches.open(DYNAMIC_CACHE);
  await cache.put(req, res.clone());
  const keys = await cache.keys();
  if (keys.length > DYNAMIC_MAX_ENTRIES) {
    const excess = keys.length - DYNAMIC_MAX_ENTRIES;
    await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
  }
}

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
    // 保持 network-first：stale-while-revalidate 仍会在后台打 API、省不了配额，
    // 会话内去重已由 gist.js 缓存承担；这里只缓存成功响应并回退缓存。
    event.respondWith(
      fetch(req)
        .then((res) => {
          cacheOKResponse(req, res);
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (url.hostname !== location.hostname) return;

  if (url.pathname.endsWith('/rain.mp4') || url.pathname.endsWith('/rain.mp3')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          cacheOKResponse(req, res);
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
          cacheOKResponse(req, res);
          return res;
        })
    )
  );
});
