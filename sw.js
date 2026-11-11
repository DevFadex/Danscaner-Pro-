// Danscanner Pro — funcionamiento sin conexión
const VERSION='danscaner-v98';
// Herramientas (PDF, OCR, idioma español, Word, Excel, IA local): se guardan aparte y NO se borran al actualizar la app
const LIBS = 'danscaner-libs';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png', './apple-touch-icon.png', './mod/admin.js', './mod/texto.js', './mod/excel.js', './mod/pptx.js', './mod/diseno.js', './mod/tabla.js', './mod/word.js', './mod/vision-core.js', './mod/vision-worker.js', './libs/fonts/atkinson-hyperlegible-latin-400-normal.woff2', './libs/fonts/atkinson-hyperlegible-latin-700-normal.woff2', './knowledge/knowledge-version.json', './knowledge/danscaner/manual.md', './knowledge/danscaner/herramientas.md', './knowledge/danscaner/nexa.md', './knowledge/documentos/escaneo.md', './knowledge/documentos/formatos.md', './knowledge/documentos/ocr.md', './knowledge/documentos/pdf.md', './knowledge/soporte/problemas.md', './knowledge/leyes/indice.json', './knowledge/leyes/relaciones.json', './knowledge/leyes/cp.json', './knowledge/leyes/cppf.json', './knowledge/leyes/cppn.json', './knowledge/leyes/ep.json', './knowledge/leyes/sppt.json', './knowledge/leyes/rd905.json'];
const SHELL_PATHS = new Set(SHELL.map(u => new URL(u, self.location).pathname));
const CDN = /(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com|fonts\.gstatic\.com|fonts\.googleapis\.com)$/;
const isLib = u => { try { const url = new URL(u); return (url.origin === self.location.origin && url.pathname.includes('/libs/')) || CDN.test(url.hostname); } catch (e) { return false; } };

self.addEventListener('install', e => {
  // además de la app, se guarda lo que se pide en cada arranque (configuración, letra y acceso), así la primera apertura tampoco espera a la red
  const warm = async () => {
    try { const c = await caches.open(VERSION); const r = await fetch('./config.js'); await c.put('./config.js', r.ok ? r : new Response('', { headers: { 'Content-Type': 'text/javascript' } })); } catch (err) {}
    try { const l = await caches.open(LIBS); for (const u of ['./libs/fonts/atkinson-hyperlegible-latin-400-normal.woff2', './libs/fonts/atkinson-hyperlegible-latin-700-normal.woff2', './libs/supabase.js']) { if (!(await l.match(u))) { const r = await fetch(u); if (r.ok) await l.put(u, r); } } } catch (err) {}
  };
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(warm).then(() => self.skipWaiting()));
});

// Al actualizar solo se reemplaza la copia de la app. Las herramientas guardadas en versiones anteriores
// se pasan a la caché permanente, y las cachés que no son de la app (por ejemplo el modelo de Nexa local) no se tocan.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const libs = await caches.open(LIBS);
    for (const k of await caches.keys()) {
      if (k === VERSION || k === LIBS || !/^danscaner-v\d+/.test(k)) continue;
      try {
        const old = await caches.open(k);
        for (const req of await old.keys()) {
          if (isLib(req.url) && !(await libs.match(req))) { const r = await old.match(req); if (r) await libs.put(req, r); }
        }
      } catch (err) {}
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

const fromLibs = req => caches.open(LIBS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
  if (r.ok || r.type === 'opaque') c.put(req, r.clone());
  return r;
})));

// Compartir desde otra app (WhatsApp, galería, correo) → los archivos se guardan un momento y la app los importa
const SHARE = 'danscaner-share';
async function recibirCompartido(req) {
  try {
    const fd = await req.formData();
    const c = await caches.open(SHARE);
    let i = 0;
    for (const f of fd.getAll('files')) {
      if (!f || typeof f === 'string' || !f.size) continue;
      await c.put('./__compartido/' + Date.now() + '-' + (i++), new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Name': encodeURIComponent(f.name || 'compartido') } }));
    }
  } catch (err) {}
  return Response.redirect('./?shared=1', 303);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).searchParams.has('share-target')) { e.respondWith(recibirCompartido(req)); return; }
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Librerías propias y externas (PDF, OCR, Word, Excel, íconos): primero la copia guardada (no cambian)
  if ((url.origin === location.origin && url.pathname.includes('/libs/')) || CDN.test(url.hostname)) {
    e.respondWith(fromLibs(req));
    return;
  }

  // La app (v98): primero la copia guardada de esta versión. Abre al instante y no vuelve a bajar 1 MB en cada apertura.
  // Las versiones nuevas llegan con el service worker nuevo (cambia VERSION), que guarda todos los archivos juntos y recarga la app.
  if (url.origin === location.origin) {
    const root = new URL('./', self.location).pathname;
    const isShell = SHELL_PATHS.has(url.pathname);
    const isStart = req.mode === 'navigate' && (url.pathname === root || url.pathname === root + 'index.html');
    if (isShell || isStart) {
      e.respondWith((async () => {
        const c = await caches.open(VERSION);
        const hit = (await c.match(req)) || (isStart ? await c.match('./index.html') : null);
        if (hit) return hit;
        try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
        catch (err) { return (await caches.match(req)) || (await c.match('./index.html')) || Response.error(); }
      })());
      return;
    }
    // config.js frena el arranque (es un <script> del encabezado): se usa la copia guardada y se actualiza por detrás para la próxima apertura
    if (url.pathname === root + 'config.js') {
      e.respondWith((async () => {
        const c = await caches.open(VERSION);
        const hit = await c.match(req);
        const fresh = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); else if (r.status === 404) c.put(req, new Response('', { headers: { 'Content-Type': 'text/javascript' } })); return r; });
        if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
        return fresh.catch(() => new Response('', { headers: { 'Content-Type': 'text/javascript' } }));
      })());
      return;
    }
    // Lo demás (base de conocimiento y otros): primero internet y, si no hay, la copia guardada
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  }
});
