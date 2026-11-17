/* VELOX Offline-Speicher: hält die App-Dateien auf dem Gerät vor.
   Immer zuerst das Netz (damit Updates sofort ankommen), bei keinem/schlechtem Netz die gespeicherte Version. */
const CACHE = 'velox-offline-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon.svg', 'cal.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // fremde Server (z. B. GitHub-Sync) nie anfassen
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
    const net = fetch(req).then(r => {
      if (r && r.ok && !url.searchParams.has('check')) cache.put(isPage ? 'index.html' : url.pathname.replace(/^.*\//, ''), r.clone()).catch(() => {});
      return r;
    });
    const fallback = async () => (await cache.match(isPage ? 'index.html' : req, { ignoreSearch: true })) || (await cache.match(url.pathname.replace(/^.*\//, ''), { ignoreSearch: true }));
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), isPage ? 4000 : 8000));
      return await Promise.race([net, timeout]);
    } catch (err) {
      const c = await fallback();
      if (c) return c;
      return net.catch(() => new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
    }
  })());
});
