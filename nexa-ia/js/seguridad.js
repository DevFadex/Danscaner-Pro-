/* Modo seguridad de Nexa IA.
   Revisa lo que una app web SÍ puede ver desde el celular y lo explica sin exagerar:
   - postura: conexión segura, app instalada, almacenamiento persistente, permisos concedidos;
   - accesos: intentos fallidos de PIN, último acceso;
   - integridad: si los archivos de la app cambiaron sin una actualización (huella SHA-256 por versión);
   - señales de manipulación: la app dentro de otra página, navegador controlado por un programa.
   Además analiza enlaces y mensajes sospechosos (phishing, estafas por WhatsApp) y la fortaleza de una
   contraseña, todo en el equipo y sin mandar nada a internet.
   Lo que NO puede ver (otras apps, el Wi-Fi, virus del sistema) está en LIMITES y se dice siempre. */
const Seguridad = {
  ARCHIVOS: ['index.html', 'styles.css', 'app.js', 'js/util.js', 'js/cifrado.js', 'js/boveda.js', 'js/memoria.js', 'js/seguridad.js',
    'js/humano.js', 'js/documental.js', 'js/juridico.js', 'js/voz.js', 'js/ia-local.js', 'js/ia-nube.js', 'js/asistente.js', 'sw.js'],
  PESO: { alto: 30, medio: 12, bajo: 4, info: 0, ok: 0 },
  LIMITES: [
    'No puedo ver qué otras apps tenés instaladas ni qué hacen: el celular no se lo permite a una app web.',
    'No veo el nombre ni el tipo de seguridad de tu Wi-Fi, ni el tráfico de otras apps.',
    'No detecto virus del sistema ni si el celular está rooteado o con jailbreak.',
    'Solo reviso mientras la app está abierta: el celular no deja que una app web vigile en segundo plano.',
    'Para eso hace falta la versión nativa de Nexa (Android/iOS), descrita en docs/ARQUITECTURA.md.'
  ],

  /* ---------- revisión general ---------- */
  async revisar() {
    const H = [];
    const add = (nivel, id, titulo, detalle, accion) => H.push({ nivel, id, titulo, detalle, accion: accion || '' });

    if (window.isSecureContext) add('ok', 'https', 'Conexión segura', 'La app se abre con conexión cifrada (HTTPS) o desde este equipo.');
    else add('alto', 'https', 'Conexión sin cifrar', 'La app se abrió sin HTTPS: alguien en la misma red podría modificarla.', 'Abrí Nexa solo desde su dirección https://.');

    try { if (window.top !== window.self) add('alto', 'marco', 'Nexa está dentro de otra página', 'Otra página está mostrando a Nexa adentro. Así se suelen robar toques y datos (clickjacking).', 'Cerrá esa página y abrí Nexa directamente.'); }
    catch (e) { add('alto', 'marco', 'Nexa está dentro de otra página', 'Otra página la contiene.', 'Abrí Nexa directamente.'); }

    if (navigator.webdriver) add('medio', 'auto', 'El navegador está siendo controlado por un programa', 'El navegador avisa que lo maneja una herramienta de automatización. Si no lo estás haciendo vos a propósito, es raro.', 'Cerrá el navegador y volvé a abrirlo normalmente.');

    // accesos
    const acc = await Boveda.get('accesos', []);
    const ult = acc[acc.length - 1], ant = acc[acc.length - 2];
    if (ult && ult.fallosPrevios && ult.fallosPrevios.length) {
      add(ult.fallosPrevios.length >= 3 ? 'alto' : 'medio', 'pin', `${ult.fallosPrevios.length} intento(s) fallido(s) de PIN antes de este acceso`,
        'Último intento fallido: ' + U.fechaHora(ult.fallosPrevios[ult.fallosPrevios.length - 1]) + '. Si no fuiste vos, alguien probó abrir Nexa.', 'Si no fuiste vos, cambiá el PIN en Ajustes.');
    } else add('ok', 'pin', 'Sin intentos fallidos de PIN', ant ? 'Acceso anterior: ' + U.fechaHora(ant.t) + '.' : 'Es el primer acceso registrado.');
    if (ult && ant && ult.nav !== ant.nav) add('bajo', 'nav', 'Cambió el navegador desde el último acceso', 'Puede ser una actualización del navegador. Si no actualizaste nada, revisalo.');

    // integridad
    try { const r = await this.integridad(); if (r) add(r.nivel, 'integ', r.titulo, r.detalle, r.accion); } catch (e) { add('bajo', 'integ', 'No pude revisar los archivos de la app', e.message); }

    // almacenamiento y app instalada
    try {
      if (navigator.storage && navigator.storage.persisted) {
        if (await navigator.storage.persisted()) add('ok', 'persist', 'Tus datos están protegidos contra borrado automático', 'El navegador no va a borrar la bóveda para liberar espacio.');
        else add('bajo', 'persist', 'El navegador podría borrar los datos si falta espacio', 'Pasa en celulares con poco lugar. Instalar la app ayuda a evitarlo.', 'Instalá Nexa en la pantalla de inicio.');
      }
    } catch (e) { /* sin API */ }
    const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!instalada) add('info', 'inst', 'Nexa no está instalada', 'Instalada funciona sin internet, se abre como app y el navegador cuida más sus datos.');

    // permisos
    const perm = await this.permisos();
    const dados = perm.filter(p => p.estado === 'granted').map(p => p.nombre);
    add('info', 'perm', dados.length ? 'Permisos que le diste a Nexa: ' + dados.join(', ') : 'Nexa no tiene permisos especiales', dados.length ? 'Podés quitarlos desde los ajustes del navegador (candado al lado de la dirección).' : 'No usa cámara, ubicación ni notificaciones.');

    // red
    if (!navigator.onLine) add('info', 'red', 'Sin conexión', 'Nexa sigue funcionando: la memoria, las leyes y la seguridad no necesitan internet.');
    const c = navigator.connection;
    if (c && c.saveData) add('info', 'datos', 'Ahorro de datos activado', 'No descargo la IA local mientras esté activado.');

    // IA en la nube
    const nube = await IANube.config();
    if (nube.activa && nube.prov) add('info', 'nube', 'IA en la nube activada (' + IANube.PROV[nube.prov].n + ')', 'Las preguntas abiertas salen a ese servicio con tu clave. Lo demás (memoria, leyes, seguridad) queda en el equipo.', 'Si no la usás, desactivala en Ajustes.');

    const score = Math.max(0, 100 - H.reduce((s, h) => s + this.PESO[h.nivel], 0));
    const res = { t: Date.now(), score, hallazgos: H };
    await this.registrar(res);
    return res;
  },

  nivelScore(s) { return s >= 85 ? { n: 'Bien', c: 'ok' } : s >= 60 ? { n: 'Revisar', c: 'medio' } : { n: 'En riesgo', c: 'alto' }; },

  async permisos() {
    const out = [];
    if (!navigator.permissions) return out;
    for (const [n, nombre] of [['notifications', 'notificaciones'], ['camera', 'cámara'], ['microphone', 'micrófono'], ['geolocation', 'ubicación']]) {
      try { const s = await navigator.permissions.query({ name: n }); out.push({ n, nombre, estado: s.state }); } catch (e) { /* no soportado */ }
    }
    return out;
  },

  /* Huella de los archivos por versión: si cambian sin cambiar la versión, algo los modificó */
  async huellas() {
    const out = {};
    for (const f of this.ARCHIVOS) {
      try { const r = await fetch(f, { cache: 'no-cache' }); if (r.ok) out[f] = await U.sha256(await r.arrayBuffer()); } catch (e) { /* sin red y sin caché */ }
    }
    return out;
  },
  async integridad() {
    const ahora = await this.huellas();
    if (!Object.keys(ahora).length) return { nivel: 'bajo', titulo: 'No pude leer los archivos de la app', detalle: 'Sin conexión y sin copia guardada.' };
    const reg = await Boveda.get('huellas', {});
    const prev = reg[APP_VER];
    if (!prev) { reg[APP_VER] = ahora; for (const v of Object.keys(reg)) if (v !== APP_VER && Object.keys(reg).length > 3) delete reg[v]; await Boveda.set('huellas', reg); return { nivel: 'ok', titulo: 'Huella de la app guardada (versión ' + APP_VER + ')', detalle: 'Desde ahora aviso si los archivos cambian sin una actualización.' }; }
    const cambiados = Object.keys(ahora).filter(f => prev[f] && prev[f] !== ahora[f]);
    if (cambiados.length) return { nivel: 'alto', titulo: 'Archivos de la app cambiaron sin actualización', detalle: 'Cambiaron: ' + cambiados.join(', ') + '. La versión sigue siendo ' + APP_VER + '.', accion: 'No ingreses datos sensibles. Borrá los datos del sitio y volvé a instalar Nexa desde su dirección oficial.' };
    return { nivel: 'ok', titulo: 'Archivos de la app sin cambios', detalle: 'Coinciden con la huella de la versión ' + APP_VER + '.' };
  },

  /* Registro de eventos: se guarda cada revisión que cambia algo (máx. 200) */
  async registrar(res) {
    const ev = await Boveda.get('eventos', []);
    const malos = res.hallazgos.filter(h => ['alto', 'medio'].includes(h.nivel)).map(h => h.id + ':' + h.titulo).sort().join('|');
    const ult = ev[ev.length - 1];
    if (!ult || ult.firma !== malos || ult.score !== res.score) {
      ev.push({ t: res.t, score: res.score, firma: malos, items: res.hallazgos.filter(h => h.nivel !== 'ok' && h.nivel !== 'info').map(h => ({ nivel: h.nivel, titulo: h.titulo })) });
      await Boveda.set('eventos', ev.slice(-200));
    }
  },

  /* ---------- enlaces ---------- */
  MARCAS: { mercadopago: ['mercadopago.com.ar', 'mercadopago.com'], mercadolibre: ['mercadolibre.com.ar', 'mercadolibre.com'], afip: ['afip.gob.ar'], arca: ['arca.gob.ar'], anses: ['anses.gob.ar'],
    bna: ['bna.com.ar'], bancanacion: ['bna.com.ar'], galicia: ['bancogalicia.com', 'galicia.ar'], santander: ['santander.com.ar'], bbva: ['bbva.com.ar'], macro: ['macro.com.ar'], brubank: ['brubank.com'], uala: ['uala.com.ar'], naranjax: ['naranjax.com'],
    whatsapp: ['whatsapp.com', 'wa.me'], google: ['google.com', 'google.com.ar'], gmail: ['gmail.com', 'google.com'], apple: ['apple.com', 'icloud.com'], icloud: ['icloud.com', 'apple.com'], microsoft: ['microsoft.com', 'live.com', 'office.com'], facebook: ['facebook.com', 'fb.com'], instagram: ['instagram.com'], netflix: ['netflix.com'], paypal: ['paypal.com'], correoargentino: ['correoargentino.com.ar'] },
  ACORTADORES: ['bit.ly', 'tinyurl.com', 'cutt.ly', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'acortar.link', 'shorturl.at', 'rebrand.ly', 'rb.gy', 'tiny.cc', 's.id', 'v.gd'],
  TLD_RAROS: ['zip', 'mov', 'xyz', 'top', 'click', 'live', 'icu', 'buzz', 'rest', 'cam', 'quest', 'cfd', 'sbs', 'monster', 'gq', 'tk', 'ml', 'cf', 'ga', 'work', 'support', 'country'],
  SEGUNDO_NIVEL: ['com', 'gob', 'gov', 'org', 'net', 'edu', 'mil', 'int', 'co', 'tur'],
  dominioBase(host) {
    const p = host.split('.');
    if (p.length >= 3 && this.SEGUNDO_NIVEL.includes(p[p.length - 2]) && p[p.length - 1].length === 2) return p.slice(-3).join('.');
    return p.slice(-2).join('.');
  },
  analizarEnlace(txt) {
    let s = String(txt || '').trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s;
    let u; try { u = new URL(s); } catch (e) { return { nivel: 'medio', url: txt, motivos: ['No es una dirección web válida.'], consejo: 'No la abras.' }; }
    const host = u.hostname.toLowerCase(), base = this.dominioBase(host), M = [];
    let p = 0; const mal = (pts, m) => { p += pts; M.push(m); };
    if (u.protocol === 'http:' && /^https?:/i.test(String(txt).trim())) mal(15, 'No usa conexión segura (http, sin la «s»).');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) mal(35, 'Es una dirección numérica (IP) en lugar de un nombre: los sitios serios no hacen eso.');
    if (host.split('.').some(l => l.startsWith('xn--'))) mal(35, 'Usa letras de otros alfabetos que imitan a las normales (punycode).');
    if (u.username || u.password) mal(35, 'Tiene una «@» en la dirección: lo que va antes es un engaño, el sitio real es lo que va después.');
    if (this.ACORTADORES.includes(base) || this.ACORTADORES.includes(host)) mal(20, 'Es un enlace acortado: no se ve a dónde lleva realmente.');
    const tld = host.split('.').pop();
    if (this.TLD_RAROS.includes(tld)) mal(15, `Termina en «.${tld}», una terminación muy usada en estafas.`);
    if (host.split('.').length > 4) mal(10, 'Tiene muchos subdominios encadenados.');
    if ((host.match(/-/g) || []).length >= 3) mal(10, 'Tiene muchos guiones en el nombre.');
    // la marca tiene que aparecer como palabra del nombre (o dentro, si es larga): «evaluacion» no es «uala»
    const partes = host.split(/[.-]/);
    for (const [marca, oficiales] of Object.entries(this.MARCAS)) {
      if (!partes.some(t => t === marca || (marca.length >= 6 && t.includes(marca)))) continue;
      if (!oficiales.some(o => host === o || host.endsWith('.' + o))) { mal(45, `Usa el nombre «${marca}» pero el sitio real es «${base}», que no es el oficial (${oficiales[0]}).`); break; }
    }
    if (/(login|verific|valid|actualiz|suspend|bloque|desbloq|premio|regalo|sorteo|reembolso|token|clave|seguridad)/.test(U.norm(u.pathname + u.search + host)) && p > 0) mal(10, 'Usa palabras típicas de engaño (verificar, suspendida, premio…).');
    const nivel = p >= 40 ? 'alto' : p >= 15 ? 'medio' : 'bajo';
    return {
      nivel, url: u.href, sitio: base, motivos: M.length ? M : ['No encontré señales de engaño en la dirección.'],
      consejo: nivel === 'alto' ? 'No lo abras ni pongas datos. Si dice ser de tu banco u organismo, entrá escribiendo vos la dirección oficial.'
        : nivel === 'medio' ? 'Desconfiá. Antes de poner datos, fijate que el sitio real sea el oficial.'
        : 'La dirección no muestra señales de engaño, pero eso no garantiza que el sitio sea seguro: no puedo ver su contenido.'
    };
  },

  /* ---------- mensajes (estafas por WhatsApp, SMS, correo) ---------- */
  REGLAS_MSJ: [
    [/codigo (de )?(verificacion|de 6|que te (llego|llega|mande))|me (pasas|mandas|reenvias) (el|un) codigo|te llego un codigo|codigo por (sms|mensaje)/, 45, 'Pide un código de verificación: con ese código te roban la cuenta de WhatsApp, del banco o de Mercado Pago.'],
    [/cambie (de )?(numero|celular|telefono)|este es mi nuevo numero|agendame/, 25, 'Dice haber cambiado de número: es la forma más común de hacerse pasar por un familiar o conocido.'],
    [/transferi|transferencia|cbu|cvu|alias|deposita|pasame (plata|dinero)|me prestas|necesito plata|urgente.*(plata|dinero|pago)/, 25, 'Pide dinero o una transferencia.'],
    [/urgente|ahora mismo|de inmediato|hoy vence|ultimo aviso|en las proximas \d+ horas|se bloqueara|sera suspendid|cuenta (bloqueada|suspendida|inhabilitada)/, 20, 'Mete presión o urgencia para que no pienses.'],
    [/ganaste|ganador|premio|sorteo|beneficio (exclusivo|especial)|regalo|reintegro|reembolso|bono (de|del) (anses|gobierno)/, 25, 'Promete premios, sorteos o beneficios.'],
    [/(clave|contrasena|pin|token|numero de (la )?tarjeta|codigo de seguridad|cvv|home ?banking)/, 35, 'Pide claves o datos de tarjeta: ningún banco ni organismo los pide por mensaje.'],
    [/soy (de|del) (banco|soporte|anses|afip|arca|mercado ?pago|whatsapp|correo)|area de (seguridad|fraudes)|atencion al cliente/, 20, 'Dice ser de un banco, organismo o soporte técnico.'],
    [/descarga|instala|apk|anydesk|teamviewer|acceso remoto/, 30, 'Pide instalar una app o dar acceso remoto al celular.'],
    [/no le digas a nadie|no comentes|es confidencial|entre nosotros/, 20, 'Pide que no le cuentes a nadie.']
  ],
  analizarMensaje(texto) {
    const n = U.norm(texto), M = []; let p = 0;
    for (const [re, pts, m] of this.REGLAS_MSJ) if (re.test(n)) { p += pts; M.push(m); }
    const links = (String(texto).match(/\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|ar|net|org|xyz|top|click|live|ly|me|info|online|site|link)(?:\/[^\s<>"']*)?/gi) || []).slice(0, 5);
    const enl = links.map(l => this.analizarEnlace(l));
    for (const e of enl) if (e.nivel !== 'bajo') { p += e.nivel === 'alto' ? 35 : 15; M.push(`Enlace sospechoso (${e.sitio || e.url}): ${e.motivos[0]}`); }
    const nivel = p >= 45 ? 'alto' : p >= 20 ? 'medio' : 'bajo';
    return {
      nivel, motivos: M.length ? M : ['No encontré señales típicas de estafa.'], enlaces: enl,
      consejo: nivel === 'alto' ? 'Tiene todas las señales de una estafa. No respondas, no pases códigos ni datos y no hagas transferencias. Si dice ser alguien conocido, llamalo a su número de siempre.'
        : nivel === 'medio' ? 'Desconfiá: confirmá por otro medio (una llamada al número que ya tenías) antes de hacer lo que pide.'
        : 'No veo señales claras de estafa, pero las reglas no lo detectan todo. Si te pide dinero, códigos o datos, confirmalo por otro medio.'
    };
  },

  /* ---------- contraseñas (no se guarda ni se manda a ningún lado) ---------- */
  COMUNES: ['123456', 'password', 'qwerty', 'contrasena', 'admin', 'iloveyou', 'boca', 'river', 'argentina', 'tucuman', 'messi', 'dragon', 'monkey', 'abc123', '111111', 'letmein', 'futbol', 'teamo'],
  fortaleza(pass) {
    pass = String(pass || '');
    if (!pass) return null;
    let pool = 0;
    if (/[a-z]/.test(pass)) pool += 26; if (/[A-Z]/.test(pass)) pool += 26; if (/\d/.test(pass)) pool += 10; if (/[^A-Za-z0-9]/.test(pass)) pool += 33;
    let bits = pass.length * Math.log2(pool || 1);
    const C = [], n = U.norm(pass);
    if (this.COMUNES.some(c => n.includes(c))) { bits = Math.min(bits, 20); C.push('Contiene una palabra o número de los más usados.'); }
    if (/(.)\1{2,}/.test(pass)) { bits -= 10; C.push('Repite el mismo carácter varias veces.'); }
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(pass)) { bits -= 12; C.push('Tiene una secuencia fácil (1234, abcd, qwer…).'); }
    if (/(19|20)\d{2}/.test(pass)) { bits -= 6; C.push('Tiene un año: suele ser una fecha fácil de adivinar.'); }
    if (pass.length < 12) C.push('Es corta: mejor 12 caracteres o más.');
    if (pool < 40) C.push('Sumá mayúsculas, números o símbolos, o mejor, usá una frase de 4 palabras al azar.');
    bits = Math.max(0, Math.round(bits));
    const nivel = bits >= 70 ? 'ok' : bits >= 45 ? 'bajo' : bits >= 30 ? 'medio' : 'alto';
    const txt = { ok: 'Fuerte', bajo: 'Aceptable', medio: 'Débil', alto: 'Muy débil' }[nivel];
    return { nivel, txt, bits, consejos: C.length ? C : ['Bien. Usala solo en un sitio y guardala en un administrador de contraseñas.'] };
  },

  /* ---------- explicación en lenguaje natural ---------- */
  resumenTexto(res) {
    const s = this.nivelScore(res.score);
    const malos = res.hallazgos.filter(h => ['alto', 'medio', 'bajo'].includes(h.nivel));
    let t = `**Estado de seguridad: ${res.score}/100 (${s.n}).**\n`;
    t += malos.length ? '\nLo que encontré:\n' + malos.map(h => `- **${h.titulo}.** ${h.detalle}${h.accion ? ' → ' + h.accion : ''}`).join('\n') : '\nNo encontré problemas en lo que puedo revisar.';
    t += '\n\n**Lo que no puedo ver desde una app web:**\n' + this.LIMITES.slice(0, 4).map(l => '- ' + l).join('\n');
    return t;
  },
  resultadoTexto(r, que) {
    const tit = { alto: 'Peligroso', medio: 'Sospechoso', bajo: 'Sin señales claras' }[r.nivel];
    return `**${que}: ${tit}.**\n` + r.motivos.map(m => '- ' + m).join('\n') + '\n\n' + r.consejo;
  }
};
