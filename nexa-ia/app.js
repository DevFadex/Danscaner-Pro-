/* Nexa IA — interfaz. Pantallas: bloqueo, conversación, seguridad, memoria y ajustes. */
const APP_VER = '1.0.0';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const App = {
  aj: { humano: true, hablar: false, bloqueo: 5 },
  ocultoDesde: 0, timer: null, ocupado: false, porVoz: false, ctrl: null,

  /* ---------- arranque ---------- */
  async init() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    await this.pantallaBloqueo();
    document.addEventListener('visibilitychange', () => this.visibilidad());
  },
  async pantallaBloqueo(msg) {
    $('#app').hidden = true; $('#lock').hidden = false;
    const existe = await Boveda.existe();
    this.creando = !existe;
    $('#lockSub').textContent = existe ? 'Ingresá tu PIN para abrir tu bóveda' : 'Creá un PIN o una frase para proteger todo lo que Nexa guarde';
    $('#pinLbl').textContent = existe ? 'PIN o frase' : 'Nuevo PIN o frase (mínimo 6)';
    $('#pin2').hidden = $('#pin2Lbl').hidden = existe;
    $('#pin2').required = !existe;
    $('#lockBtn').textContent = existe ? 'Entrar' : 'Crear y entrar';
    $('#lockNota').textContent = existe ? '' : 'Todo lo que Nexa aprenda queda cifrado en este teléfono. Si olvidás el PIN, no hay forma de recuperarlo: es lo que lo hace seguro.';
    $('#lockErr').textContent = msg || '';
    $('#pin').value = $('#pin2').value = '';
    $('#pin').focus();
    $('#lockForm').onsubmit = e => { e.preventDefault(); this.entrar(); };
  },
  async entrar() {
    const pin = $('#pin').value, btn = $('#lockBtn');
    $('#lockErr').textContent = '';
    btn.disabled = true;
    try {
      let fallos = [];
      if (this.creando) {
        if (pin !== $('#pin2').value) throw new Error('Los dos PIN no coinciden.');
        await Boveda.crear(pin);
      } else ({ fallos } = await Boveda.abrir(pin));
      await this.abrirApp(fallos);
    } catch (e) { $('#lockErr').textContent = e.message; $('#pin').select(); }
    finally { btn.disabled = false; }
  },
  async abrirApp(fallos) {
    this.aj = { ...this.aj, ...(await Boveda.get('ajustes', {})) };
    Humano.activo = this.aj.humano;
    await Promise.all([Memoria.load(), Nexa.cargar(), Recordatorios.cargar()]);
    NexaVoz.cfg = { ...NexaVoz.cfg, ...(this.aj.voz || {}) };
    $('#lock').hidden = true; $('#app').hidden = false;
    $('#swHumano').checked = this.aj.humano;
    this.enlazar();
    this.ir('chat');
    this.pintarChat();
    if (fallos && fallos.length) {
      this.agregarNexa({ texto: `**Ojo:** antes de que entraras hubo **${fallos.length} intento(s) fallido(s)** de PIN. El último fue el ${U.fechaHora(fallos[fallos.length - 1].t)}.\n\nSi no fuiste vos, alguien intentó abrir Nexa. Te conviene cambiar el PIN en Ajustes.`, fuente: 'seguridad', certeza: 'verificado' });
    }
    NexaJuridico.cargar().catch(() => {});
    this.revisarRecordatorios(true);
    clearInterval(this.timer); this.timer = setInterval(() => this.revisarRecordatorios(), 20e3);
    Seguridad.revisar().then(r => this.pintarScore(r)).catch(() => {});
  },
  bloquear() {
    Boveda.cerrar(); NexaVoz.callar(); NexaVoz.detenerEscucha();
    clearInterval(this.timer);
    Memoria.d = null; Nexa.historial = [];
    $('#log').innerHTML = '';
    this.pantallaBloqueo();
  },
  visibilidad() {
    if (document.hidden) { this.ocultoDesde = Date.now(); return; }
    if (Boveda.abierta() && this.aj.bloqueo > 0 && this.ocultoDesde && Date.now() - this.ocultoDesde > this.aj.bloqueo * 60e3) this.bloquear();
    else if (Boveda.abierta()) this.revisarRecordatorios(true);
  },

  enlazar() {
    if (this.enlazado) return; this.enlazado = true;
    $$('.nav button').forEach(b => b.onclick = () => this.ir(b.dataset.v));
    $('#btnLock').onclick = () => this.bloquear();
    $('#swHumano').onchange = e => this.setHumano(e.target.checked);
    $('#bar').onsubmit = e => { e.preventDefault(); this.enviar($('#inp').value); };
    const inp = $('#inp');
    inp.oninput = () => { inp.style.height = 'auto'; inp.style.height = Math.min(140, inp.scrollHeight) + 'px'; };
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); this.enviar(inp.value); } };
    $('#btnMic').onclick = () => this.microfono();
    $('#log').onclick = e => this.accionMsg(e);
    $('#sugs').onclick = e => { const c = e.target.closest('[data-q]'); if (c) this.enviar(c.dataset.q); };
    $('#btnRevisar').onclick = () => this.revisar();
    $('#btnAnalizar').onclick = () => this.analizar();
    $('#passTxt').oninput = e => this.pintarFortaleza(e.target.value);
    $('#btnBorrarChat').onclick = async () => { if (await this.confirmar('Borrar la conversación', 'Se borran los mensajes. Lo que aprendí queda.')) { await Nexa.nueva(); this.pintarChat(); this.toast('Conversación borrada'); } };
    $('#btnOlvidarTodo').onclick = async () => { if (await this.confirmar('Borrar todo lo aprendido', 'Me olvido de todo lo que me contaste y enseñaste. No se puede deshacer.', 'Borrar')) { await Memoria.olvidarTodo(); this.pintarMemoria(); this.toast('Listo, me olvidé de todo'); } };
    $('#memList').onclick = e => this.accionMemoria(e);
    $('#ajustes').onclick = e => this.accionAjustes(e);
    $('#ajustes').onchange = e => this.cambioAjustes(e);
  },

  ir(v) {
    $$('.view').forEach(x => x.classList.toggle('active', x.id === 'v-' + v));
    $$('.nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    $('#topSub').textContent = { chat: this.aj.humano ? 'Modo humano' : 'Modo preciso', seg: 'Seguridad', mem: 'Memoria', aj: 'Ajustes' }[v];
    if (v === 'seg') this.pintarSeguridad();
    if (v === 'mem') this.pintarMemoria();
    if (v === 'aj') this.pintarAjustes();
  },
  async setHumano(on) {
    this.aj.humano = Humano.activo = on; await this.guardarAjustes();
    $('#swHumano').checked = on; const s = $('#ajHumano'); if (s) s.checked = on;
    if ($('#v-chat').classList.contains('active')) $('#topSub').textContent = on ? 'Modo humano' : 'Modo preciso';
    this.toast(on ? 'Modo humano: respondo de forma natural, sin cambiar el contenido' : 'Modo preciso: respuestas directas');
  },
  async guardarAjustes() { await Boveda.set('ajustes', this.aj); },

  /* ---------- conversación ---------- */
  pintarChat() {
    const log = $('#log');
    if (!Nexa.historial.length) {
      const n = Memoria.nombre();
      log.innerHTML = `<div class="vacio"><img src="img/nexa.svg" alt="" width="64" height="64"><h2>${n ? 'Hola, ' + U.esc(n) : 'Hola, soy Nexa'}</h2><p>Te ayudo con lo tuyo y cuido tu seguridad. Si no sé algo, te lo digo. Todo queda cifrado en este teléfono.</p></div>`;
      this.sugerencias(['¿Qué podés hacer?', 'Revisá mi seguridad', 'Me llamo …', 'Recordame en 10 minutos tomar agua']);
      return;
    }
    log.innerHTML = Nexa.historial.map((h, i) => h.rol === 'yo' ? this.htmlYo(h.q) : this.htmlNexa(h.r, i)).join('');
    const ult = Nexa.historial[Nexa.historial.length - 1];
    this.sugerencias(ult && ult.r && ult.r.sugerencias || []);
    log.scrollTop = log.scrollHeight;
  },
  htmlYo(q) { return `<div class="msg yo">${U.esc(q)}</div>`; },
  htmlNexa(r, i) {
    const et = Humano.etiqueta(r);
    const humano = this.aj.humano;
    return `<div class="msg nx" data-i="${i}">
      ${humano && r.previa ? `<p class="previa">${U.esc(r.previa)}</p>` : ''}
      <div class="cuerpo">${U.md(r.texto)}</div>
      ${humano && r.cierre ? `<p class="cierre">${U.esc(r.cierre)}</p>` : ''}
      <div class="fte">${et.texto ? `<span class="cert ${et.certeza}">${U.esc(et.texto)}</span>` : ''}<span>Fuente: ${U.esc(et.fuente)}</span>${r.url ? `<a href="${U.esc(r.url)}" target="_blank" rel="noopener noreferrer">ver el original</a>` : ''}</div>
      ${et.detalle ? `<div class="fte" style="border:0;margin-top:2px;padding-top:0">${U.esc(et.detalle)}</div>` : ''}
      <div class="acts">
        <button data-a="hablar"><svg><use href="#i-play"/></svg>Escuchar</button>
        <button data-a="copiar"><svg><use href="#i-copy"/></svg>Copiar</button>
        <button data-a="mal"><svg><use href="#i-flag"/></svg>Está mal</button>
      </div></div>`;
  },
  sugerencias(lista) { $('#sugs').innerHTML = (lista || []).slice(0, 4).map(s => `<button class="chip" data-q="${U.esc(s)}">${U.esc(s)}</button>`).join(''); },
  agregarNexa(r) { Nexa.historial.push({ rol: 'nexa', r, t: Date.now() }); Nexa.guardar(); this.pintarChat(); },

  async enviar(texto) {
    texto = String(texto || '').trim();
    if (!texto || this.ocupado) return;
    if (/…\s*$/.test(texto)) { $('#inp').value = texto.replace(/…\s*$/, ''); $('#inp').focus(); return; } // sugerencias para completar
    this.ocupado = true; const porVoz = this.porVoz; this.porVoz = false;
    $('#inp').value = ''; $('#inp').style.height = 'auto';
    const log = $('#log');
    if (!Nexa.historial.length) log.innerHTML = '';
    log.insertAdjacentHTML('beforeend', this.htmlYo(texto) + '<div class="msg nx" id="pend"><span class="pensando">Pensando</span></div>');
    log.scrollTop = log.scrollHeight;
    $('#sugs').innerHTML = '';
    this.ctrl = new AbortController();
    const pend = $('#pend');
    const onText = t => { pend.innerHTML = U.md(t); log.scrollTop = log.scrollHeight; };
    try {
      const r = await Nexa.preguntar(texto, { signal: this.ctrl.signal, onText });
      this.pintarChat();
      if (porVoz || this.aj.hablar) this.hablar(r, porVoz);
    } finally { this.ocupado = false; this.ctrl = null; }
  },
  textoParaVoz(r) {
    const plano = s => String(s || '').replace(/\*\*|\*|`|#+\s/g, '').replace(/^\s*[-•]\s*/gm, '');
    if (r.fuente === 'leyes' && r.decir) return (this.aj.humano && r.previa ? r.previa + ' ' : '') + r.decir;
    return [this.aj.humano ? r.previa : '', plano(r.texto), this.aj.humano ? r.cierre : ''].filter(Boolean).join(' ');
  },
  hablar(r, seguir) {
    NexaVoz.hablar(this.textoParaVoz(r), { onFin: () => { if (seguir && this.aj.conversar) this.microfono(); } });
  },
  microfono() {
    const b = $('#btnMic');
    if (NexaVoz.escuchando) { NexaVoz.detenerEscucha(); b.classList.remove('on'); return; }
    if (!NexaVoz.puedeEscuchar()) return this.toast('Este navegador no permite dictar. Probá con Chrome.');
    b.classList.add('on');
    NexaVoz.escuchar({
      onParcial: t => { $('#inp').value = t; },
      onFinal: t => { b.classList.remove('on'); this.porVoz = true; this.enviar(t); },
      onFin: () => b.classList.remove('on'),
      onError: () => { b.classList.remove('on'); this.toast('No te pude escuchar'); }
    });
  },
  accionMsg(e) {
    const c = e.target.closest('[data-q]'); if (c) return this.enviar(c.dataset.q);
    const b = e.target.closest('[data-a]'); if (!b) return;
    const i = +b.closest('[data-i]').dataset.i, r = Nexa.historial[i] && Nexa.historial[i].r; if (!r) return;
    if (b.dataset.a === 'hablar') { if (NexaVoz.hablando) NexaVoz.callar(); else this.hablar(r); }
    if (b.dataset.a === 'copiar') { navigator.clipboard && navigator.clipboard.writeText(r.texto).then(() => this.toast('Copiado'), () => this.toast('No se pudo copiar')); }
    if (b.dataset.a === 'mal') { const inp = $('#inp'); inp.value = 'No, la respuesta correcta es '; inp.focus(); this.toast('Decime cuál es la respuesta correcta y la aprendo'); }
  },

  /* ---------- recordatorios ---------- */
  async revisarRecordatorios(alAbrir) {
    if (!Boveda.abierta()) return;
    const v = await Recordatorios.vencidos();
    for (const r of v) {
      const tarde = Date.now() - r.cuando > 120e3;
      const txt = `⏰ **Recordatorio:** ${r.texto}` + (tarde ? `\n\n*Era para el ${U.fechaHora(r.cuando)}; la app estaba cerrada y no pude avisarte a horario.*` : '');
      this.agregarNexa({ texto: txt, fuente: 'recordatorio', certeza: 'tuyo' });
      if ('Notification' in window && Notification.permission === 'granted' && (document.hidden || !alAbrir)) {
        try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) reg.showNotification('Nexa: recordatorio', { body: r.texto, icon: 'img/icon-192.png', tag: r.id }); else new Notification('Nexa: recordatorio', { body: r.texto }); } catch (e) { /* sin notificación */ }
      }
      this.toast('⏰ ' + r.texto);
    }
  },

  /* ---------- seguridad ---------- */
  pintarScore(res) {
    const s = Seguridad.nivelScore(res.score), ring = $('#ring');
    ring.style.setProperty('--p', res.score); ring.className = 'ring ' + s.c;
    $('#scoreN').textContent = res.score;
    $('#scoreTxt').textContent = `${s.n} · revisado ${U.fechaHora(res.t)}`;
    $('#segDot').hidden = res.score >= 85;
    $('#hall').innerHTML = res.hallazgos.sort((a, b) => ['alto', 'medio', 'bajo', 'info', 'ok'].indexOf(a.nivel) - ['alto', 'medio', 'bajo', 'info', 'ok'].indexOf(b.nivel))
      .map(h => `<li class="${h.nivel}"><b>${U.esc(h.titulo)}</b><small>${U.esc(h.detalle)}</small>${h.accion ? `<span class="acc">→ ${U.esc(h.accion)}</span>` : ''}</li>`).join('');
  },
  async pintarSeguridad() {
    $('#limites').innerHTML = Seguridad.LIMITES.map(l => `<li>${U.esc(l)}</li>`).join('');
    const ev = await Boveda.get('eventos', []), acc = await Boveda.get('accesos', []);
    const items = [...acc.slice(-10).map(a => ({ t: a.t, x: 'Acceso con PIN' + (a.fallosPrevios.length ? ` (después de ${a.fallosPrevios.length} intento/s fallido/s)` : '') })),
      ...ev.slice(-15).map(e => ({ t: e.t, x: `Revisión: ${e.score}/100` + (e.items.length ? ' — ' + e.items.map(i => i.titulo).join('; ') : '') }))].sort((a, b) => b.t - a.t).slice(0, 15);
    $('#eventos').innerHTML = items.map(i => `<li><b>${U.fechaHora(i.t)}</b> · ${U.esc(i.x)}</li>`).join('') || '<li>Sin eventos todavía.</li>';
  },
  async revisar() {
    const b = $('#btnRevisar'); b.disabled = true; b.textContent = 'Revisando…';
    try { this.pintarScore(await Seguridad.revisar()); await this.pintarSeguridad(); } finally { b.disabled = false; b.textContent = 'Revisar ahora'; }
  },
  analizar() {
    const t = $('#anaTxt').value.trim(), out = $('#anaRes');
    if (!t) { out.className = 'res'; out.innerHTML = ''; return this.toast('Pegá un mensaje o un enlace'); }
    const soloLink = /^\S+$/.test(t) && /\.[a-z]{2,}/i.test(t);
    const r = soloLink ? Seguridad.analizarEnlace(t) : Seguridad.analizarMensaje(t);
    out.className = 'res ' + r.nivel;
    out.innerHTML = U.md(Seguridad.resultadoTexto(r, soloLink ? 'Enlace' : 'Mensaje'));
  },
  pintarFortaleza(p) {
    const out = $('#passRes'), f = Seguridad.fortaleza(p);
    if (!f) { out.innerHTML = ''; out.className = 'res'; return; }
    out.className = 'res ' + f.nivel;
    out.innerHTML = `<p><b>${f.txt}</b></p><ul>${f.consejos.map(c => `<li>${U.esc(c)}</li>`).join('')}</ul>`;
  },

  /* ---------- memoria ---------- */
  pintarMemoria() {
    const d = Memoria.d, rec = Recordatorios.pendientes();
    const del = (tipo, id) => `<button class="ib" data-del="${tipo}" data-id="${U.esc(id)}" title="Borrar" aria-label="Borrar"><svg><use href="#i-trash"/></svg></button>`;
    $('#memList').innerHTML = `
      <div class="card"><h3>Tu nombre</h3>${d.prefs.nombre ? `<div class="item"><div>${U.esc(d.prefs.nombre)}</div>${del('nombre', '-')}</div>` : '<p class="muted small">Decime «me llamo …» y lo recuerdo.</p>'}</div>
      <div class="card"><h3>Lo que me contaste (${d.hechos.length})</h3>${d.hechos.length ? d.hechos.slice().reverse().map(h => `<div class="item"><div>${U.esc(h.texto)}<small>${U.fecha(h.t)}${h.usos ? ' · lo usé ' + h.usos + ' vez/veces' : ''}</small></div>${del('hecho', h.id)}</div>`).join('') : '<p class="muted small">Decime «recordá que …».</p>'}</div>
      <div class="card"><h3>Respuestas que me enseñaste (${d.ensenadas.length})</h3>${d.ensenadas.length ? d.ensenadas.slice().reverse().map(e => `<div class="item"><div><b>${U.esc(e.q)}</b><small>${U.esc(e.resp)} · ${U.fecha(e.t)}</small></div>${del('ensenada', e.id)}</div>`).join('') : '<p class="muted small">Decime «cuando te pregunte …, respondé …», o tocá «Está mal» en una respuesta.</p>'}</div>
      <div class="card"><h3>Recordatorios pendientes (${rec.length})</h3>${rec.length ? rec.map(r => `<div class="item"><div>${U.esc(r.texto)}<small>${U.fechaHora(r.cuando)}</small></div>${del('rec', r.id)}</div>`).join('') : '<p class="muted small">Decime «recordame mañana a las 9 …».</p>'}</div>`;
  },
  async accionMemoria(e) {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const { del: tipo, id } = b.dataset;
    if (tipo === 'nombre') delete Memoria.d.prefs.nombre;
    if (tipo === 'hecho') Memoria.d.hechos = Memoria.d.hechos.filter(h => h.id !== id);
    if (tipo === 'ensenada') Memoria.d.ensenadas = Memoria.d.ensenadas.filter(x => x.id !== id);
    if (tipo === 'rec') { Recordatorios.lista = Recordatorios.lista.filter(r => r.id !== id); await Recordatorios.guardar(); }
    await Memoria.save(); this.pintarMemoria(); this.toast('Borrado');
  },

  /* ---------- ajustes ---------- */
  async pintarAjustes() {
    const nube = await IANube.config(), localCfg = await IALocal.cfg(), sop = await IALocal.soporte();
    const notif = 'Notification' in window ? Notification.permission : 'no';
    const voces = NexaVoz.voces();
    $('#ajustes').innerHTML = `
      <div class="card"><h2>Cómo habla Nexa</h2>
        <label class="row"><div><b>Modo humano</b><small>Responde de forma natural y cercana. Nunca cambia ni recorta el contenido: solo agrega una frase antes y después.</small></div><span class="sw"><input type="checkbox" id="ajHumano" ${this.aj.humano ? 'checked' : ''}><span class="sw-ui"></span></span></label>
        <label class="row"><div><b>Leer las respuestas en voz alta</b><small>Siempre, aunque escribas.</small></div><span class="sw"><input type="checkbox" id="ajHablar" ${this.aj.hablar ? 'checked' : ''}><span class="sw-ui"></span></span></label>
        <label class="row"><div><b>Conversación de corrido</b><small>Si le hablás, responde en voz y vuelve a escuchar.</small></div><span class="sw"><input type="checkbox" id="ajConversar" ${this.aj.conversar ? 'checked' : ''}><span class="sw-ui"></span></span></label>
        ${voces.length ? `<label><b>Voz</b><select id="ajVoz">${voces.map(v => `<option value="${U.esc(v.voiceURI)}" ${v.voiceURI === NexaVoz.cfg.voz ? 'selected' : ''}>${U.esc(v.name)} (${U.esc(v.lang)})${v.localService ? '' : ' · usa internet'}</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="card"><h2>Inteligencia artificial</h2>
        <p class="muted small">Sin IA, Nexa responde con lo que le enseñaste, las leyes guardadas y la seguridad, y dice «no lo sé» en lo demás. Con IA también conversa de cualquier tema, siempre marcando esas respuestas como «puede equivocarse».</p>
        <div class="row"><div><b>IA en el teléfono</b><small>${localCfg.descargada ? 'Descargada ✓ · funciona sin internet y sin mandar nada afuera' : sop.ok ? 'Se descarga una vez (0,4 a 1,8 GB) y después funciona sin internet.' : U.esc(sop.why)}</small></div></div>
        ${sop.ok ? `<select id="ajModelo" ${localCfg.descargada ? 'disabled' : ''}>${IALocal.MODELOS.map(([id, n, d]) => `<option value="${id}" ${id === localCfg.base ? 'selected' : ''}>${n} · ${d}</option>`).join('')}</select>
          <div class="prog" id="ajProg" hidden><i></i></div><small class="muted" id="ajProgT"></small>
          ${localCfg.descargada ? '<button class="btn bad" data-ac="localBorrar">Borrar la IA del teléfono</button>' : '<button class="btn pri" data-ac="localBajar">Descargar la IA del teléfono</button>'}` : ''}
        <hr style="border:0;border-top:1px solid var(--line);width:100%">
        <label class="row"><div><b>IA en la nube (opcional)</b><small>Usa tu propia clave, que queda cifrada en este teléfono. Lo que preguntes sale a ese servicio (tapo DNI, CUIL, correos, teléfonos y tarjetas). La IA del teléfono tiene prioridad.</small></div><span class="sw"><input type="checkbox" id="ajNube" ${nube.activa ? 'checked' : ''}><span class="sw-ui"></span></span></label>
        <div id="ajNubeCfg" ${nube.activa ? '' : 'hidden'} style="display:grid;gap:8px">
          <select id="ajProv">${Object.entries(IANube.PROV).map(([k, p]) => `<option value="${k}" ${k === nube.prov ? 'selected' : ''}>${p.n}</option>`).join('')}</select>
          <input type="password" id="ajClave" autocomplete="off" placeholder="Tu clave (${U.esc((IANube.PROV[nube.prov || 'anthropic'] || {}).help || '')})" value="${U.esc(nube.claves[nube.prov || 'anthropic'] || '')}">
          <input type="text" id="ajMod" placeholder="Modelo (opcional): ${U.esc(IANube.PROV[nube.prov || 'anthropic'].m)}" value="${U.esc(nube.modelos[nube.prov || 'anthropic'] || '')}">
          <div class="row"><button class="btn pri" data-ac="nubeGuardar">Guardar</button><button class="btn bad" data-ac="nubeBorrar">Borrar clave</button></div>
        </div>
      </div>
      <div class="card"><h2>Seguridad de la app</h2>
        <label><b>Bloquear Nexa si queda en segundo plano</b><select id="ajBloqueo">${[[1, '1 minuto'], [5, '5 minutos'], [15, '15 minutos'], [60, '1 hora'], [0, 'Nunca (no recomendado)']].map(([v, t]) => `<option value="${v}" ${+this.aj.bloqueo === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <button class="btn" data-ac="pin">Cambiar el PIN</button>
        ${notif === 'default' ? '<button class="btn" data-ac="notif">Permitir notificaciones (para recordatorios)</button>' : notif === 'granted' ? '<p class="muted small">Notificaciones permitidas ✓</p>' : notif === 'denied' ? '<p class="muted small">Las notificaciones están bloqueadas en el navegador.</p>' : ''}
        <button class="btn bad" data-ac="borrarTodo">Borrar todo y empezar de cero</button>
      </div>
      <div class="card"><h2>Acerca de</h2>
        <p class="small muted">Nexa IA ${APP_VER}. Une la Nexa de Danscanner Pro (resúmenes, extracción de datos, IA local) y la de Asistente Judicial Pro (leyes sin internet, voz), con memoria, modo humano y modo seguridad. Librerías: WebLLM (Apache-2.0), tipografía Atkinson Hyperlegible (OFL).</p>
      </div>`;
  },
  async cambioAjustes(e) {
    const t = e.target;
    if (t.id === 'ajHumano') return this.setHumano(t.checked);
    if (t.id === 'ajHablar') { this.aj.hablar = t.checked; return this.guardarAjustes(); }
    if (t.id === 'ajConversar') { this.aj.conversar = t.checked; return this.guardarAjustes(); }
    if (t.id === 'ajVoz') { NexaVoz.cfg.voz = t.value; this.aj.voz = { ...NexaVoz.cfg }; return this.guardarAjustes(); }
    if (t.id === 'ajBloqueo') { this.aj.bloqueo = +t.value; return this.guardarAjustes(); }
    if (t.id === 'ajModelo') { (await IALocal.cfg()).base = t.value; return IALocal.guardar(); }
    if (t.id === 'ajNube') { const c = await IANube.config(); c.activa = t.checked; if (!c.prov) c.prov = 'anthropic'; await IANube.guardar(); return this.pintarAjustes(); }
    if (t.id === 'ajProv') { const c = await IANube.config(); c.prov = t.value; await IANube.guardar(); return this.pintarAjustes(); }
  },
  async accionAjustes(e) {
    const b = e.target.closest('[data-ac]'); if (!b) return;
    const ac = b.dataset.ac;
    if (ac === 'nubeGuardar') {
      const c = await IANube.config(); c.prov = $('#ajProv').value; c.claves[c.prov] = $('#ajClave').value.trim(); c.modelos[c.prov] = $('#ajMod').value.trim();
      await IANube.guardar(); this.toast(c.claves[c.prov] ? 'Clave guardada cifrada en este teléfono' : 'Sin clave: la IA en la nube no se va a usar');
    }
    if (ac === 'nubeBorrar') { const c = await IANube.config(); c.claves[c.prov] = ''; await IANube.guardar(); this.pintarAjustes(); this.toast('Clave borrada'); }
    if (ac === 'localBajar') {
      if (navigator.connection && navigator.connection.saveData) return this.toast('Tenés el ahorro de datos activado');
      if (!(await this.confirmar('Descargar la IA del teléfono', 'Son entre 0,4 y 1,8 GB según el modelo. Conviene hacerlo con Wi-Fi. Después funciona sin internet.', 'Descargar'))) return;
      const prog = $('#ajProg'), pt = $('#ajProgT'); prog.hidden = false; b.disabled = true;
      const f = (p, t) => { if (p >= 0) prog.firstElementChild.style.width = Math.round(p * 100) + '%'; pt.textContent = String(t || '').replace(/\[.*?\]\s*/g, '').slice(0, 90); };
      IALocal.oyentes.add(f);
      try { await IALocal.cargar(); this.toast('IA del teléfono lista'); this.pintarAjustes(); }
      catch (err) { pt.textContent = 'No se pudo: ' + err.message; b.disabled = false; }
      finally { IALocal.oyentes.delete(f); }
    }
    if (ac === 'localBorrar') { if (await this.confirmar('Borrar la IA del teléfono', 'Libera espacio. Podés volver a descargarla.', 'Borrar')) { await IALocal.borrar(); this.pintarAjustes(); } }
    if (ac === 'notif') { try { await Notification.requestPermission(); } catch (err) { /* nada */ } this.pintarAjustes(); }
    if (ac === 'pin') this.cambiarPin();
    if (ac === 'borrarTodo') {
      const ok = await this.confirmar('Borrar todo', 'Se borra la bóveda completa: memoria, conversaciones, recordatorios, claves y registros. No se puede recuperar. Escribí BORRAR para confirmar.', 'Borrar todo', true);
      if (ok) { await Boveda.borrarTodo(); location.reload(); }
    }
  },
  async cambiarPin() {
    const box = this.modal('Cambiar el PIN', '<label>PIN actual<input type="password" id="pA" autocomplete="off"></label><label>PIN nuevo<input type="password" id="pN" autocomplete="off"></label><label>Repetí el nuevo<input type="password" id="pN2" autocomplete="off"></label><p class="err" id="pErr"></p>', [['Cancelar', ''], ['Cambiar', 'ok', 'pri']]);
    const r = await box.esperar(async () => {
      if ($('#pN').value !== $('#pN2').value) { $('#pErr').textContent = 'Los PIN nuevos no coinciden'; return false; }
      try { await Boveda.cambiarPin($('#pA').value, $('#pN').value); return true; } catch (e) { $('#pErr').textContent = e.message; return false; }
    });
    if (r) this.toast('PIN cambiado');
  },

  /* ---------- avisos y diálogos ---------- */
  toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 3200); },
  modal(titulo, html, botones) {
    const m = $('#modal'); $('#modalT').textContent = titulo; $('#modalB').innerHTML = html;
    $('#modalA').innerHTML = botones.map(([t, v, c]) => `<button class="btn ${c || ''}" data-v="${v}">${U.esc(t)}</button>`).join('');
    m.hidden = false;
    const f = $('#modalB input') || $('#modalA [data-v="ok"]') || $('#modalA button'); f && f.focus();
    return {
      esperar: (validar) => new Promise(res => {
        const cerrar = v => { m.hidden = true; m.onclick = null; document.removeEventListener('keydown', esc); res(v); };
        const esc = e => { if (e.key === 'Escape') cerrar(false); };
        document.addEventListener('keydown', esc);
        m.onclick = async e => {
          if (e.target === m) return cerrar(false);
          const b = e.target.closest('[data-v]'); if (!b) return;
          if (!b.dataset.v) return cerrar(false);
          if (validar && !(await validar())) return;
          cerrar(true);
        };
      })
    };
  },
  confirmar(titulo, texto, si = 'Aceptar', escribir) {
    const box = this.modal(titulo, `<p>${U.esc(texto)}</p>${escribir ? '<input type="text" id="mConf" autocomplete="off" aria-label="Escribí BORRAR">' : ''}`, [['Cancelar', ''], [si, 'ok', escribir || /borr/i.test(si) ? 'bad' : 'pri']]);
    return box.esperar(escribir ? async () => $('#mConf').value.trim().toUpperCase() === 'BORRAR' : null);
  }
};

App.init();
