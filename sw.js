// Danscanner Pro — funcionamiento sin conexión
const VERSION = 'danscaner-v38';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png', './apple-touch-icon.png', './mod/admin.js', './mod/texto.js', './mod/excel.js', './mod/pptx.js', './mod/diseno.js'];
const CDN = /(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com|fonts\.gstatic\.com|fonts\.googleapis\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Librerías propias: primero la copia guardada (no cambian)
  if (url.origin === location.origin && url.pathname.includes('/libs/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return r;
    })));
    return;
  }

  // La app: primero internet (para tener siempre la última versión), si no hay, la copia guardada
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }

  // Librerías (PDF, OCR, Word, Excel, íconos): se guardan la primera vez que se usan
  if (CDN.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return r;
    })));
  }
});
