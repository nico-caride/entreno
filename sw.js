// Cambiá la versión si querés forzar que se borre el caché viejo.
const CACHE = 'entreno-v1';
const ARCHIVOS = [
  './', './index.html', './styles.css', './app.js', './plan.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (así ves los cambios de plan.js al toque); si no hay señal
// o tarda más de 3 s, usa lo guardado.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const red = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const res = await Promise.race([red, timeout]);
      if (res) return res;
    } catch (err) { /* sin red */ }
    const guardado = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' && await cache.match('./index.html'));
    if (guardado) return guardado;
    return red;
  })());
});
