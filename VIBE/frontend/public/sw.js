// public/sw.js — VIBE SW v3 (single, robust handler)

// ---- Config ----
const CACHE_NAME = 'vibe-phase1-cache-v3';
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest'];
const SAME_ORIGIN = self.location.origin;

// ---- Install: pre-cache core shell ----
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
  })());
  self.skipWaiting();
});

// ---- Activate: clean old caches & take control ----
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
  })());
  self.clients.claim();
});

// ---- Fetch: guard schemes & apply strategies ----
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET + http(s); skip chrome-extension:, chrome:, blob:, data:, etc.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigation (SPA): network-first, fall back to cached shell
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, '/index.html'));
    return;
  }

  // Same-origin static assets: cache-first
  const isSameOrigin = url.origin === SAME_ORIGIN;
  const isStatic = /\.(?:css|js|mjs|ico|png|jpg|jpeg|svg|webp|gif|woff2?|ttf|otf|map)$/.test(url.pathname);
  if (isSameOrigin && isStatic) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else (APIs, cross-origin): network-first (don’t cache opaque/error)
  event.respondWith(networkFirst(req));
});

// ---- Strategies ----
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    try { await cache.put(req, res.clone()); } catch {}
  }
  return res;
}

async function networkFirst(req, fallbackPath) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    // Only cache successful same-origin GET responses
    const sameOrigin = new URL(req.url).origin === SAME_ORIGIN;
    if (req.method === 'GET' && res.ok && res.type === 'basic' && sameOrigin) {
      try { await cache.put(req, res.clone()); } catch {}
    }
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;

    // Optional SPA fallback for navigations
    if (fallbackPath) {
      const shell = await cache.match(fallbackPath);
      if (shell) return shell;
    }
    throw e;
  }
}

