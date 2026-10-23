// Pruebas de extremo a extremo de Nexa IA (Chromium con Playwright).
// Uso: servir la carpeta nexa-ia en BASE_URL (por defecto http://localhost:8767) y correr `node nexa.test.js`.
// Datos de prueba inventados: no usar datos reales.
const { chromium } = require('playwright');
const assert = require('assert/strict');
const BASE = process.env.BASE_URL || 'http://localhost:8767';
const W = ms => new Promise(r => setTimeout(r, ms));
const PIN = 'prueba-segura-1';
const results = [];

async function nueva(browser) {
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  pg.errors = []; pg.on('pageerror', e => pg.errors.push(e.message));
  await pg.goto(BASE + '/index.html'); await pg.waitForSelector('#lockForm');
  return pg;
}
async function crearYEntrar(pg) {
  await pg.fill('#pin', PIN); await pg.fill('#pin2', PIN); await pg.click('#lockBtn');
  await pg.waitForSelector('#app:not([hidden])');
}
const preguntar = (pg, q) => pg.evaluate(q => Nexa.preguntar(q), q);
async function escribir(pg, q) {
  const n = await pg.$$eval('.msg.nx', x => x.length);
  await pg.fill('#inp', q); await pg.click('#btnSend');
  await pg.waitForFunction(n => document.querySelectorAll('.msg.nx:not(#pend)').length > n && !document.querySelector('#pend'), n);
  return pg.evaluate(() => { const m = [...document.querySelectorAll('.msg.nx')].pop(); return m.innerText; });
}

async function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const browser = await chromium.launch(); let pg;
  try { pg = await nueva(browser); await fn(pg); assert.deepEqual(pg.errors, [], 'errores de JavaScript'); results.push(['✅', name]); }
  catch (e) { results.push(['❌', name, e.message.replace(/\s+/g, ' ').slice(0, 400)]); }
  finally { await browser.close(); }
}

(async () => {
await test('Crear PIN, bloquear y volver a entrar; un PIN corto o fácil no se acepta', async pg => {
  assert.equal(await pg.title(), 'Nexa IA');
  assert.match(await pg.textContent('#lockBtn'), /Crear/);
  await pg.fill('#pin', '111111'); await pg.fill('#pin2', '111111'); await pg.click('#lockBtn');
  await pg.waitForFunction(() => document.querySelector('#lockErr').textContent);
  assert.match(await pg.textContent('#lockErr'), /fácil/);
  await crearYEntrar(pg);
  await pg.click('#btnLock');
  await pg.waitForSelector('#lock:not([hidden])');
  assert.match(await pg.textContent('#lockBtn'), /Entrar/);
  await pg.fill('#pin', PIN); await pg.click('#lockBtn');
  await pg.waitForSelector('#app:not([hidden])');
});

await test('Intentos fallidos de PIN: se avisan al entrar, quedan en Seguridad y frenan a quien prueba muchos', async pg => {
  await crearYEntrar(pg); await pg.click('#btnLock'); await pg.waitForSelector('#lock:not([hidden])');
  for (let i = 0; i < 2; i++) { await pg.fill('#pin', 'otro-pin-' + i); await pg.click('#lockBtn'); await pg.waitForFunction(() => /incorrecto/.test(document.querySelector('#lockErr').textContent)); await pg.evaluate(() => { document.querySelector('#lockErr').textContent = ''; }); }
  await pg.fill('#pin', PIN); await pg.click('#lockBtn'); await pg.waitForSelector('#app:not([hidden])');
  assert.match(await pg.textContent('#log'), /2 intento\(s\) fallido\(s\)/);
  const res = await pg.evaluate(() => Seguridad.revisar());
  const pin = res.hallazgos.find(h => h.id === 'pin');
  assert.equal(pin.nivel, 'medio'); assert.ok(res.score < 100);
  // después de 5 fallos seguidos hay que esperar
  const espera = await pg.evaluate(async () => { Boveda.cerrar(); for (let i = 0; i < 5; i++) { try { await Boveda.abrir('mal-' + i); } catch (e) { /* esperado */ } } try { await Boveda.abrir('mal-x'); return 0; } catch (e) { return e.espera || 0; } });
  assert.ok(espera > 0, 'debería pedir que espere');
});

await test('La bóveda guarda todo cifrado: lo aprendido no aparece en texto plano en el teléfono', async pg => {
  await crearYEntrar(pg);
  await preguntar(pg, 'Recordá que mi color favorito es el turquesa');
  const crudo = await pg.evaluate(() => new Promise(res => { const r = indexedDB.open('nexa-ia'); r.onsuccess = () => { const t = r.result.transaction(['sealed', 'plain']); const a = t.objectStore('sealed').getAll(), b = t.objectStore('plain').getAll(); t.oncomplete = () => res(JSON.stringify([a.result, b.result])); }; }));
  assert.ok(!/turquesa/i.test(crudo), 'el dato quedó sin cifrar');
  assert.ok(/"ct"/.test(crudo));
});

await test('Memoria: aprende lo que le contás, lo usa diciendo de dónde salió, lo reemplaza si cambia y lo olvida a pedido', async pg => {
  await crearYEntrar(pg);
  let r = await preguntar(pg, 'Me llamo Ana');
  assert.match(r.texto, /Ana/);
  r = await preguntar(pg, 'Recordá que mi turno médico es el martes 14 a las 10');
  assert.match(r.texto, /Anotado/);
  r = await preguntar(pg, '¿Cuándo es mi turno médico?');
  assert.equal(r.fuente, 'memoria'); assert.equal(r.certeza, 'tuyo');
  assert.match(r.texto, /martes 14 a las 10/); assert.match(r.detalle, /No lo verifiqué/);
  r = await preguntar(pg, 'Recordá que mi turno médico es el jueves 16');
  assert.match(r.texto, /Antes me habías dicho «mi turno médico es el martes 14 a las 10»/);
  r = await preguntar(pg, '¿cuándo es mi turno médico?');
  assert.match(r.texto, /jueves 16/); assert.ok(!/martes/.test(r.texto));
  r = await preguntar(pg, '¿Qué sabés de mí?');
  assert.match(r.texto, /Ana/); assert.match(r.texto, /jueves 16/); assert.match(r.texto, /no tengo nada más sobre vos/);
  r = await preguntar(pg, 'Olvidá mi turno médico');
  assert.match(r.texto, /lo olvidé/);
  assert.equal(await pg.evaluate(() => Memoria.d.hechos.length), 0);
  // contraseñas no
  r = await preguntar(pg, 'Recordá que la clave del banco es gato1234');
  assert.match(r.texto, /no lo guardo/); assert.equal(await pg.evaluate(() => Memoria.d.hechos.length), 0);
  // en la pantalla de Memoria se ve y se borra
  await preguntar(pg, 'Recordá que el alquiler vence el 10');
  await pg.click('.nav [data-v="mem"]');
  assert.match(await pg.textContent('#memList'), /alquiler vence el 10/);
  await pg.click('#memList [data-del="hecho"]');
  await pg.waitForFunction(() => !/alquiler/.test(document.querySelector('#memList').textContent));
});

await test('No inventa: si no sabe dice «no lo sé», y si lo corregís aprende la respuesta', async pg => {
  await crearYEntrar(pg);
  await pg.click('.chip[data-q="¿Qué podés hacer?"]');
  await pg.waitForFunction(() => document.querySelectorAll('.msg.nx').length >= 1 && !document.querySelector('#pend'));
  let t = await escribir(pg, '¿A qué hora abre la biblioteca del barrio?');
  assert.match(t, /No lo sé/); assert.match(t, /no te voy a inventar/);
  assert.match(t, /Sin fuente/);
  // botón «Está mal» → prepara la corrección
  await pg.click('.msg.nx:last-child [data-a="mal"]');
  assert.match(await pg.inputValue('#inp'), /No, la respuesta correcta es/);
  t = await escribir(pg, 'No, la respuesta correcta es de 9 a 18');
  assert.match(t, /Gracias por corregirme/);
  t = await escribir(pg, '¿A qué hora abre la biblioteca del barrio?');
  assert.match(t, /de 9 a 18/); assert.match(t, /Me lo enseñaste/);
  // también «cuando te pregunte…, respondé…»
  const r = await preguntar(pg, 'Cuando te pregunte por el wifi de casa, respondé que está en la heladera');
  assert.match(r.texto, /Aprendido/);
  assert.match((await preguntar(pg, 'el wifi de casa')).texto, /heladera/);
});

await test('Modo humano: responde natural sin cambiar el contenido; el modo preciso muestra solo el contenido', async pg => {
  await crearYEntrar(pg);
  const conf = await preguntar(pg, 'Me llamo Ana');
  assert.ok(!conf.previa, 'una confirmación («Un gusto, Ana») no lleva frase extra'); assert.equal(conf.certeza, 'accion');
  const r = await preguntar(pg, 'Revisá mi seguridad');
  assert.ok(r.previa, 'falta la frase natural de entrada');
  const base = await pg.evaluate(async () => { Humano.activo = false; const x = await Nexa.preguntar('Revisá mi seguridad', { sinGuardar: true }); Humano.activo = true; return x; });
  assert.ok(!base.previa);
  assert.equal(r.texto.split('\n')[0], base.texto.split('\n')[0], 'el modo humano no puede cambiar el contenido');
  await pg.evaluate(() => App.pintarChat());
  assert.ok(await pg.$('.msg.nx .previa'));
  await pg.click('.sw-ui'); // apagar desde la barra de arriba
  await pg.waitForFunction(() => !document.querySelector('.msg.nx .previa') || !Humano.activo);
  assert.equal(await pg.evaluate(() => Humano.activo), false);
  await pg.evaluate(() => App.pintarChat());
  assert.equal(await pg.$('.msg.nx .previa'), null);
  assert.match(await pg.textContent('#topSub'), /preciso/);
});

await test('Leyes sin internet: artículo con texto oficial completo, fuente y seguimiento («el siguiente»)', async pg => {
  await crearYEntrar(pg);
  let r = await preguntar(pg, 'Artículo 79 del Código Penal');
  assert.equal(r.fuente, 'leyes'); assert.equal(r.certeza, 'verificado');
  assert.match(r.texto, /Texto oficial completo/); assert.match(r.texto, /matare a otro/i);
  assert.match(r.detalle, /InfoLeg/); assert.ok(r.url);
  r = await preguntar(pg, 'el siguiente');
  assert.match(r.texto, /Artículo 80/);
  r = await preguntar(pg, 'artículo 999 del Código Penal');
  assert.match(r.texto, /No encontré/); assert.equal(r.certeza, 'no-se');
});

await test('Seguridad: enlaces falsos, mensajes de estafa y contraseñas débiles', async pg => {
  await crearYEntrar(pg);
  const e = await pg.evaluate(() => [Seguridad.analizarEnlace('https://mercadopago-verificacion.xyz/login'), Seguridad.analizarEnlace('https://www.mercadopago.com.ar/ayuda'), Seguridad.analizarEnlace('http://192.168.0.10/banco'), Seguridad.analizarEnlace('https://evaluacion.example.com')]);
  assert.equal(e[0].nivel, 'alto'); assert.match(e[0].motivos.join(' '), /mercadopago/);
  assert.equal(e[1].nivel, 'bajo');
  assert.equal(e[2].nivel, 'alto');
  assert.equal(e[3].nivel, 'bajo', '«evaluacion» no es la marca «uala»');
  const m = await pg.evaluate(() => Seguridad.analizarMensaje('Hola ma, cambié de número. Me pasás el código de verificación que te llegó? Es urgente'));
  assert.equal(m.nivel, 'alto');
  const ok = await pg.evaluate(() => Seguridad.analizarMensaje('Mañana nos vemos en la reunión de las 10.'));
  assert.equal(ok.nivel, 'bajo'); assert.match(ok.consejo, /no lo detectan todo/);
  const f = await pg.evaluate(() => [Seguridad.fortaleza('123456'), Seguridad.fortaleza('caballo-lámpara-río-nube-73')]);
  assert.equal(f[0].txt, 'Muy débil'); assert.equal(f[1].txt, 'Fuerte');
  // desde la conversación
  const r = await preguntar(pg, '¿Es seguro este enlace? https://mercadopago-verificacion.xyz/login');
  assert.match(r.texto, /Peligroso/); assert.equal(r.fuente, 'seguridad');
  // desde la pantalla de Seguridad
  await pg.click('.nav [data-v="seg"]');
  await pg.fill('#anaTxt', 'Ganaste un premio de ANSES! Ingresá tu clave del home banking en bit.ly/premio-ya');
  await pg.click('#btnAnalizar');
  assert.match(await pg.textContent('#anaRes'), /Peligroso/);
  await pg.fill('#passTxt', 'qwerty2024');
  assert.match(await pg.textContent('#passRes'), /débil/i);
  assert.match(await pg.textContent('#limites'), /otras apps/);
});

await test('Seguridad: revisión con puntaje, huella de la app y aviso si un archivo cambia sin actualización', async pg => {
  await crearYEntrar(pg);
  await pg.click('.nav [data-v="seg"]');
  await pg.click('#btnRevisar');
  await pg.waitForFunction(() => document.querySelector('#scoreN').textContent !== '—');
  assert.match(await pg.textContent('#hall'), /Conexión segura/);
  assert.match(await pg.textContent('#hall'), /Huella de la app guardada|sin cambios/);
  // se simula que un archivo cambió: la huella guardada no coincide
  const r = await pg.evaluate(async () => { const h = await Boveda.get('huellas'); h[APP_VER]['app.js'] = 'x'; await Boveda.set('huellas', h); return Seguridad.revisar(); });
  const integ = r.hallazgos.find(h => h.id === 'integ');
  assert.equal(integ.nivel, 'alto'); assert.match(integ.detalle, /app\.js/);
  assert.ok(r.score <= 70);
  await pg.click('#btnRevisar');
  await pg.waitForFunction(() => /cambiaron sin actualización/.test(document.querySelector('#hall').textContent));
  assert.match(await pg.textContent('#eventos'), /Revisión/);
});

await test('Recordatorios: se anotan con fecha y se avisan cuando vencen (aunque la app haya estado cerrada)', async pg => {
  await crearYEntrar(pg);
  let r = await preguntar(pg, 'Recordame en 10 minutos tomar agua');
  assert.match(r.texto, /tomar agua/); assert.match(r.texto, /está cerrada/);
  r = await preguntar(pg, 'Recordame pagar la luz');
  assert.match(r.texto, /¿Cuándo te aviso/);
  r = await preguntar(pg, '¿Qué recordatorios tengo?');
  assert.match(r.texto, /tomar agua/);
  const c = await pg.evaluate(() => { const d = new Date(2026, 9, 9, 20, 0); return [Recordatorios.cuando('manana a las 9', d), Recordatorios.cuando('el 15/11 a las 10:30', d), Recordatorios.cuando('a las 8 de la noche', d)].map(x => new Date(x.t).toString()); });
  assert.match(c[0], /Oct 10 2026 09:00/); assert.match(c[1], /Nov 15 2026 10:30/); assert.match(c[2], /Oct 0?9 2026 20:00/);
  await pg.evaluate(async () => { Recordatorios.lista[0].cuando = Date.now() - 600e3; await App.revisarRecordatorios(true); });
  await pg.waitForFunction(() => /Recordatorio:.*tomar agua/.test(document.querySelector('#log').textContent));
  assert.match(await pg.textContent('#log'), /no pude avisarte a horario/);
});

await test('Textos: resume con frases del propio texto y saca los datos, sin inventar', async pg => {
  await crearYEntrar(pg);
  const txt = 'Resumí: La reunión de vecinos se hizo el 3 de marzo de 2026 en el club del barrio. Se decidió arreglar la plaza principal con un presupuesto de $ 450.000 que aporta el municipio. Los trabajos empiezan el 15/04/2026 y deben terminar antes del invierno. Para consultas, escribir a vecinos@ejemplo.com. La próxima reunión será en mayo para revisar el avance de la obra.';
  const r = await preguntar(pg, txt);
  assert.equal(r.fuente, 'documento');
  assert.match(r.texto, /Resumen/); assert.ok(!/Datos que figuran/.test(r.texto));
  const r2 = await preguntar(pg, txt.replace('Resumí:', 'Extraé los datos:'));
  assert.match(r2.texto, /\$ 450\.000/); assert.match(r2.texto, /15\/04\/2026/); assert.match(r2.texto, /vecinos@ejemplo\.com/);
});

await test('IA en la nube (opcional): tapa datos personales, marca la respuesta como IA y controla los artículos que cita', async pg => {
  await crearYEntrar(pg);
  let enviado = '';
  await pg.route('https://api.anthropic.com/**', async route => {
    enviado = route.request().postData();
    const ev = t => 'data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n';
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: ev('Según el artículo 999 del Código Penal ') + ev('y el artículo 79 del Código Penal, depende del caso.') + 'data: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }) + '\n\n' });
  });
  await pg.evaluate(async () => { const c = await IANube.config(); c.activa = true; c.prov = 'anthropic'; c.claves.anthropic = 'clave-de-prueba'; await IANube.guardar(); });
  const r = await preguntar(pg, 'Mi vecino con DNI 30.111.222 me debe plata, ¿qué hago?');
  const body = JSON.parse(enviado);
  assert.ok(!/30\.111\.222/.test(enviado), 'el DNI salió sin tapar'); assert.match(enviado, /\[DNI\]/);
  assert.match(body.system, /No inventes/); assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(r.fuente, 'ia-nube'); assert.equal(r.certeza, 'ia');
  assert.match(r.texto, /artículo 999 del Código Penal y no lo encuentro/);
  assert.match(r.detalle, /artículo 79 del Código Penal existe/);
  await pg.evaluate(() => App.pintarChat());
  assert.match(await pg.textContent('#log'), /Generado por IA: puede equivocarse/);
  // la clave no queda en texto plano
  const crudo = await pg.evaluate(() => new Promise(res => { const q = indexedDB.open('nexa-ia'); q.onsuccess = () => { const t = q.result.transaction('sealed'); const a = t.objectStore('sealed').getAll(); t.oncomplete = () => res(JSON.stringify(a.result)); }; }));
  assert.ok(!/clave-de-prueba/.test(crudo));
});

await test('Pantallas: navegación, ajustes, bloqueo automático y sin desborde en el celular', async pg => {
  await crearYEntrar(pg);
  for (const v of ['seg', 'mem', 'aj', 'chat']) {
    await pg.click(`.nav [data-v="${v}"]`);
    assert.ok(await pg.isVisible('#v-' + v));
    const ancho = await pg.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(ancho <= 390, 'desborde horizontal en ' + v + ': ' + ancho);
  }
  await pg.click('.nav [data-v="aj"]');
  await pg.waitForSelector('#ajBloqueo');
  assert.match(await pg.textContent('#ajustes'), /IA en el teléfono/);
  await pg.selectOption('#ajBloqueo', '1');
  await W(200);
  assert.equal(await pg.evaluate(() => App.aj.bloqueo), 1);
  // pasó más de un minuto en segundo plano → se bloquea
  await pg.evaluate(() => { App.ocultoDesde = Date.now() - 61e3; App.visibilidad(); });
  await pg.waitForSelector('#lock:not([hidden])');
  assert.equal(await pg.evaluate(() => Boveda.abierta()), false);
});

await test('Borrar todo: elimina la bóveda completa (pide escribir BORRAR)', async pg => {
  await crearYEntrar(pg);
  await preguntar(pg, 'Recordá que mi planta se riega los lunes');
  await pg.click('.nav [data-v="aj"]');
  await pg.click('[data-ac="borrarTodo"]');
  await pg.click('#modalA [data-v="ok"]');
  assert.equal(await pg.isVisible('#modal'), true, 'sin escribir BORRAR no debe borrar');
  await pg.fill('#mConf', 'borrar');
  await Promise.all([pg.waitForNavigation(), pg.click('#modalA [data-v="ok"]')]);
  await pg.waitForSelector('#lockForm');
  assert.match(await pg.textContent('#lockBtn'), /Crear/);
});

console.log(results.map(r => r.join(' ')).join('\n'));
const mal = results.filter(r => r[0] === '❌').length;
console.log(`\n${results.length - mal}/${results.length} pruebas bien`);
process.exit(mal ? 1 : 0);
})();
