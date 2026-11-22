// Bird Grand Prix offline helper (service worker).
// The first time you open the game online, the browser saves a copy of it.
// After that it opens even with no internet (Wi-Fi off, aeroplane mode).
// When you are online it quietly downloads updates for next time.
const CACHE = 'bgp-v0.6.1';
const CORE = ['./', './index.html', './icon.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bgp-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Use the saved copy straight away (fast, works offline) and refresh it in the background.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const saved = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (saved) {
        e.waitUntil(fresh);
        return saved;
      }
      const res = await fresh;
      return res || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    }),
  );
});
