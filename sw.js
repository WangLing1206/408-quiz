/* 题库练习 Service Worker：应用壳预缓存 + 题库/图片运行时缓存 */
'use strict';

const VERSION = 'q408-v2.3.0-beta1';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const RAW = 'raw-img-v1';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/style.css',
  'assets/js/core.js',
  'assets/js/store.js',
  'assets/js/bank.js',
  'assets/js/kg.js',
  'assets/js/ai.js',
  'assets/js/sync.js',
  'assets/js/app.js',
  'data/bank.json',
  'data/kg.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/favicon.png',
  'assets/media/launch.mp4',
  'assets/media/launch-poster.jpg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL && k !== RUNTIME && k !== RAW).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

function isImage(url, request) {
  return request.destination === 'image' || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname);
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return hit || network;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 页面导航：优先网络，离线回退到缓存的 index.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('index.html', res.clone());
        return res;
      } catch (e) {
        const cache = await caches.open(SHELL);
        return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // GitHub 原始文件（同步新增题目的配图）：缓存优先
  if (url.hostname === 'raw.githubusercontent.com' && isImage(url, req)) {
    event.respondWith(cacheFirst(req, RAW).catch(() => fetch(req)));
    return;
  }

  if (url.origin !== location.origin) return;

  // 题库数据：网络优先，保证更新可见
  if (/\/data\/.*\.json$/i.test(url.pathname)) {
    event.respondWith(networkFirst(req, RUNTIME).catch(() => caches.match(req)));
    return;
  }

  // 配图：缓存优先
  if (isImage(url, req)) {
    event.respondWith(cacheFirst(req, RUNTIME).catch(() => fetch(req)));
    return;
  }

  // 其他静态资源：stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req, SHELL));
});
