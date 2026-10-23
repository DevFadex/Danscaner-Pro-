// Nexa IA — funcionamiento sin conexión
const VERSION = 'nexa-ia-v1';
// La librería de IA local (6 MB) se guarda aparte y no se borra al actualizar la app
const LIBS = 'nexa-ia-libs';
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './img/nexa.svg', './img/icon-192.png', './img/icon-512.png',
  './fonts/atkinson-regular.woff2', './fonts/atkinson-bold.woff2',
  './js/util.js', './js/cifrado.js', './js/boveda.js', './js/memoria.js', './js/juridico.js', './js/documental.js', './js/humano.js',
  './js/ia-local.js', './js/ia-nube.js', './js/seguridad.js', './js/voz.js', './js/asistente.js',
  ...['indice', 'relaciones', 'cn', 'cp', 'cppf', 'cppn', 'd1136', 'd1139', 'd140', 'd18', 'd303', 'd396', 'ep', 'est', 'l27375', 'r972', 'rd905', 'sppt'].map(f => './knowledge/leyes/' + f + '.json')];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (/^nexa-ia-v\d+$/.test(k) && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // solo archivos propios: las consultas a servicios externos (IA, descarga del modelo) pasan directo
  if (url.origin !== self.location.origin) return;
  const cache = url.pathname.includes('/libs/') ? LIBS : VERSION;
  e.respondWith(caches.open(cache).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok) c.put(req, r.clone());
    return r;
  }).catch(() => req.mode === 'navigate' ? c.match('./index.html') : Response.error()))));
});
// tocar la notificación de un recordatorio abre Nexa
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ws => ws.length ? ws[0].focus() : self.clients.openWindow('./')));
});
