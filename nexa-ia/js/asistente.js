/* Nexa: el cerebro que decide quién responde.
   Orden: lo que le enseñás → recordatorios → seguridad → texto pegado → lo que ya aprendió → charla →
   leyes (sin internet) → IA (en el teléfono o en la nube, si la activaste) → «no lo sé».
   Nunca rellena con una respuesta inventada: si nadie sabe, lo dice y te ofrece enseñárselo. */
const Nexa = {
  historial: [],       // [{rol:'yo'|'nexa', q?, r?, t}]
  ultimaPregunta: '',
  ultimaFuente: '',

  async cargar() { this.historial = await Boveda.get('chat', []); },
  async guardar() { this.historial = this.historial.slice(-200); await Boveda.set('chat', this.historial); },
  async nueva() { this.historial = []; this.ultimaPregunta = ''; NexaJuridico.reiniciar && NexaJuridico.reiniciar(); await this.guardar(); },

  r(texto, fuente, extra = {}) { return { texto, fuente, certeza: (Humano.FUENTES[fuente] || {}).c, ...extra }; },

  async preguntar(texto, opc = {}) {
    const q = String(texto || '').trim();
    let r;
    try { r = await this.responder(q, opc); }
    catch (e) { r = this.r('Tuve un problema y no pude responder: ' + e.message + '. No te doy una respuesta a medias.', 'ninguna', { certeza: 'no-se' }); }
    r = Humano.componer(r, q);
    if (r.fuente !== 'memoria' || !/^(Anotado|Aprendido|Listo|Gracias por corregirme)/.test(r.texto)) this.ultimaPregunta = q;
    this.ultimaFuente = r.fuente;
    if (!opc.sinGuardar) {
      this.historial.push({ rol: 'yo', q, t: Date.now() }, { rol: 'nexa', r, t: Date.now() });
      Memoria.contarTemas(q);
      await Promise.all([this.guardar(), Memoria.save()]);
    }
    return r;
  },

  async responder(q, opc) {
    const qn = U.norm(q).replace(/[.]+$/, '');
    if (!qn) return this.r('Decime en qué te ayudo.', 'nexa');

    // 1. enseñar, corregir u olvidar
    { const m = await Memoria.interpretar(q, this.ultimaPregunta); if (m) return m; }
    // 2. recordatorios
    { const m = await Recordatorios.interpretar(q); if (m) return m; }
    // 3. seguridad
    { const m = await this.seguridad(q, qn); if (m) return m; }
    // 4. texto pegado para resumir o sacar datos
    { const m = Documental.responder(q); if (m) return m; }
    // 5. lo que ya aprendió
    { const m = Memoria.responder(q); if (m) return m; }
    // 6. charla
    { const m = this.charla(qn); if (m) return m; }
    // 7. leyes
    { const m = await this.leyes(q, qn); if (m && !m.sinResultado) return m; if (m && m.sinResultado && !(await this.hayIA())) return m; }
    // 8. IA
    if (await this.hayIA()) return this.ia(q, opc);
    // 9. no lo sé
    return this.r('No lo sé, y no te voy a inventar una respuesta. Lo que sé viene de tres lugares: lo que vos me enseñás, las leyes guardadas en el teléfono y la revisión de seguridad.\n\nSi querés que lo aprenda, decime: «cuando te pregunte ' + (q.length < 60 ? q.replace(/[¿?]/g, '') : '…') + ', respondé …». Para preguntas abiertas podés activar la **IA del teléfono** en Ajustes.',
      'ninguna', { certeza: 'no-se', sugerencias: ['¿Qué podés hacer?', 'Revisá mi seguridad'] });
  },

  async hayIA() { return (await IALocal.lista()) || (await IANube.lista()); },

  /* ---------- seguridad ---------- */
  async seguridad(q, qn) {
    let m;
    if (/^(revisa|chequea|controla|analiza)(me)? (mi |la |el )?(seguridad|celular|telefono|dispositivo)|estado de (la )?seguridad|^(estoy|esta mi celular|estoy) segur[oa]|como esta mi seguridad|modo seguridad/.test(qn)) {
      const res = await Seguridad.revisar();
      return this.r(Seguridad.resumenTexto(res), 'seguridad', { sugerencias: ['Analizá este mensaje: …', '¿Es seguro este enlace? …'] });
    }
    if ((m = q.match(/^(?:analiz[aá]|revis[aá]|mir[aá])?\s*(?:este )?(?:mensaje|sms|correo|mail|whatsapp)(?: que me lleg[oó])?\s*:\s*([\s\S]{8,})$/i)) || (m = q.match(/^me lleg[oó] (?:este|un) (?:mensaje|sms|correo|mail|whatsapp)\s*:?\s*([\s\S]{8,})$/i))) {
      return this.r(Seguridad.resultadoTexto(Seguridad.analizarMensaje(m[1]), 'Mensaje'), 'seguridad', { detalle: 'Reglas fijas en el equipo: detectan las estafas más comunes, no todas.' });
    }
    const link = q.match(/\b(?:https?:\/\/|www\.)[^\s<>"']+/i) || (/(enlace|link|pagina|sitio|url|direccion)/.test(qn) && q.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/i));
    if (link && (/(segur|confiable|truch|falso|estafa|phishing|abro|abrir|entro|entrar|enlace|link|sitio|pagina)/.test(qn) || q.trim() === link[0])) {
      return this.r(Seguridad.resultadoTexto(Seguridad.analizarEnlace(link[0]), 'Enlace'), 'seguridad', { detalle: 'Analicé solo la dirección, sin abrirla.' });
    }
    if ((m = q.match(/(?:contrase[nñ]a|clave)\s*(?:es\s+)?(?:segura|fuerte|buena)?\s*[:?]\s*(\S+)\s*$/i))) {
      const f = Seguridad.fortaleza(m[1]);
      return this.r(`**Contraseña: ${f.txt}.**\n` + f.consejos.map(c => '- ' + c).join('\n') + '\n\nNo la guardé ni la mandé a ningún lado. Igual, no escribas tus contraseñas reales en ningún chat: probá con una parecida.', 'seguridad');
    }
    return null;
  },

  /* ---------- charla ---------- */
  charla(qn) {
    const n = Memoria.nombre(), hola = n ? `¡Hola, ${n}!` : '¡Hola!';
    const hoy = new Date(), MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    if (/^(hola|buen(os|as)( dias| tardes| noches)?|que tal|hey|holis)\b/.test(qn) && qn.split(' ').length <= 5) return this.r(`${hola} ¿En qué te doy una mano?`, 'nexa', { sugerencias: ['¿Qué podés hacer?', 'Revisá mi seguridad', '¿Qué sabés de mí?'] });
    if (/^(quien sos|que sos|sos una persona|sos humana|sos real|sos un robot)/.test(qn)) return this.r('Soy Nexa, una asistente que vive en tu teléfono. No soy una persona: soy un programa. Hablo de forma natural, pero siempre te digo de dónde sale lo que te respondo, y si no sé algo, te lo digo.', 'nexa');
    if (/^(que podes hacer|en que me (podes|puedes) ayudar|que haces|ayuda|como funcionas)\b/.test(qn)) return this.r('Te puedo ayudar con esto:\n- **Recordar cosas** que me contás: «recordá que…». Y aprender respuestas: «cuando te pregunte…, respondé…».\n- **Recordatorios**: «recordame mañana a las 9 pagar la luz».\n- **Seguridad**: revisar tu teléfono, analizar mensajes y enlaces sospechosos, y ver si una contraseña es débil.\n- **Leyes**: Código Penal, Constitución, Ley 24.660 y más, con el texto oficial, sin internet.\n- **Textos**: resumir y sacar datos de un texto que pegues.\n- **Hablar**: tocá el micrófono y conversamos.\n\nTodo queda cifrado en tu teléfono. Si activás una IA, también charlo de cualquier tema, pero te aviso que puede equivocarse.', 'nexa', { sugerencias: ['Revisá mi seguridad', 'Recordame en 10 minutos tomar agua', 'Artículo 14 de la Constitución'] });
    if (/^(gracias|muchas gracias|genial|perfecto|buenisimo|joya)\b/.test(qn) && qn.split(' ').length <= 4) return this.r(U.elegir(['¡De nada! Acá estoy.', 'Cuando quieras.', 'Un gusto ayudarte.'], qn), 'nexa');
    if (/^(chau|adios|hasta luego|nos vemos)\b/.test(qn)) return this.r(n ? `Chau, ${n}. Cuando quieras seguimos.` : 'Chau. Cuando quieras seguimos.', 'nexa');
    if (/^(que (dia|fecha) es hoy|que dia es|que fecha es|en que fecha estamos)/.test(qn)) return this.r(`Hoy es ${DIA[hoy.getDay()]} ${hoy.getDate()} de ${MES[hoy.getMonth()]} de ${hoy.getFullYear()}.`, 'calculo', { detalle: 'Según el reloj del teléfono.' });
    if (/^(que hora es|que hora tenes|me decis la hora)/.test(qn)) return this.r(`Son las ${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}.`, 'calculo', { detalle: 'Según el reloj del teléfono.' });
    const fs = [...qn.matchAll(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g)].map(m => new Date(+(m[3].length === 2 ? '20' + m[3] : m[3]), +m[2] - 1, +m[1]));
    if (/cuantos dias|dias (hay|faltan|pasaron)|faltan para|pasaron desde/.test(qn) && fs.length) {
      const h = new Date(); h.setHours(0, 0, 0, 0);
      const [a, b] = fs.length >= 2 ? fs : [h, fs[0]];
      const d = Math.round((b - a) / 864e5), f = x => `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
      return this.r(`Del ${f(a)} al ${f(b)} hay ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'} corridos${d < 0 ? ' (la segunda fecha es anterior)' : ''}.`, 'calculo');
    }
    return null;
  },

  /* ---------- leyes (módulo jurídico de Asistente Judicial Pro) ---------- */
  LEGAL: /\b(ley|leyes|articulo|art|arts|codigo|constitucion|decreto|resolucion|norma|normas|pena|penal|delito|condena|condicional|salidas? transitorias?|ejecucion|interno|internos|procesad|imputad|excarcelacion|prision|reclusion|sancion|disciplin|visita|estupefacientes|juez|juzgado|fiscal|defensor|habeas|amparo|derecho|derechos|garantia|cppf|cppn|24660|24 660|27375|9914)\b/,
  SIGUE: /^(si|dale|leelo|lee(lo)? completo|texto completo|el siguiente|siguiente|el anterior|anterior|explicame mas|mas simple|palabras simples|que pena|cuanta pena|relacionad\w*|y el (siguiente|anterior))\b/,
  async leyes(q, qn) {
    await NexaJuridico.cargar();
    const sigue = this.ultimaFuente === 'leyes' && NexaJuridico.ctx && NexaJuridico.ctx.ley && this.SIGUE.test(qn);
    if (!sigue && !this.LEGAL.test(qn) && !NexaJuridico.detectarLey(qn)) return null;
    const j = await NexaJuridico.preguntar(q, { sinAyuda: true });
    if (!j) return null;
    return this.deJuridico(j);
  },
  deJuridico(j) {
    const extra = { sugerencias: (j.sugerencias || []).filter(s => !/acta|nota de elevacion|app/i.test(U.norm(s))), decir: j.decir, sinResultado: !!j.sinResultado };
    if (j.tipo === 'articulo') {
      const e = j.ex, f = j.ficha;
      let t = (j.nota ? j.nota + '\n\n' : '') + `**${j.titulo}**${j.u ? '\n*' + j.u + '*' : ''}\n\n`;
      if (e.derogado) t += '**Atención: este artículo está derogado.**\n\n';
      t += '**En palabras simples:** ' + NexaJuridico.aNumeros(e.simple.join(' ')) + '\n';
      if (e.pena) t += '\n**Pena:** ' + e.pena + '\n';
      if (e.glos.length) t += '\n' + e.glos.map(g => '- ' + g).join('\n') + '\n';
      t += '\n**Texto oficial completo:**\n' + j.texto;
      if (e.mods.length) t += '\n\n*Modificaciones: ' + e.mods.join(' · ') + '*';
      if ((j.otros || []).length) t += '\n\n**También tiene que ver:**\n' + j.otros.map(o => `- Art. ${o.n} · ${o.nombre}`).join('\n');
      return this.r(t, 'leyes', { ...extra, detalle: f ? `${f.norma} · ${f.articulo} · ${f.fuente} · ${f.fecha}. ${f.vigencia}.` : '', url: f && f.url });
    }
    if (j.tipo === 'norma') {
      const t = `**${j.titulo}** (${j.norma})\n\n${j.resumen}\n\n**Cómo está organizada (${j.total} artículos):**\n` + j.estructura.map(g => `- ${g.t}: ${g.desde === g.hasta ? 'art. ' + g.desde : 'arts. ' + g.desde + ' a ' + g.hasta}`).join('\n')
        + (j.clave.length ? '\n\n**Artículos clave:** ' + j.clave.map(c => c.n).join(', ') : '');
      return this.r(t, 'leyes', { ...extra, detalle: `${j.origen || j.norma} · texto del ${j.descargado || '—'}. Verificá la vigencia antes de citarla.`, url: j.fuente });
    }
    if (j.tipo === 'tema') {
      const t = `**${j.titulo}**\n\n` + j.puntos.map(p => `- **${p.asp}:** ${NexaJuridico.aNumeros(p.frase)}${p.n ? ` *(art. ${p.n}${p.ley !== j.ley ? ' ' + p.abrev : ''})*` : ''}`).join('\n');
      return this.r(t, 'leyes', { ...extra, detalle: `${j.origen || j.norma} · texto del ${j.descargado || '—'}. Verificá la vigencia antes de citarlo.`, url: j.fuente });
    }
    // respuestas de texto del módulo de leyes: «no encontré…», listas de normas, etc.
    const nada = j.sinResultado || /^(No encontr|No tengo|Todav[ií]a no tengo|Perd[oó]n, no tengo)/.test(j.texto);
    return this.r(j.texto, nada ? 'ninguna' : 'leyes', { ...extra, certeza: nada ? 'no-se' : 'verificado' });
  },

  /* ---------- IA ---------- */
  async ia(q, opc) {
    const local = await IALocal.lista();
    const ctx = Memoria.contexto(q);
    const system = Humano.reglas(Humano.activo) + (ctx ? '\n\n' + ctx : '') + `\n\nHoy es ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`;
    const hist = this.historial.slice(-8).map(h => h.rol === 'yo' ? { role: 'user', text: h.q } : { role: 'assistant', text: (h.r && h.r.texto) || '' }).filter(m => m.text);
    hist.push({ role: 'user', text: q });
    let texto;
    if (local) texto = await IALocal.chat([{ role: 'system', content: system }, ...hist.map(m => ({ role: m.role, content: m.text }))], opc);
    else texto = await IANube.chat(hist, { system, ...opc });
    if (!texto) return this.r('La IA no devolvió nada. Probá de nuevo.', 'ninguna', { certeza: 'no-se' });
    const avisos = await Humano.verificarIA(texto);
    const malos = avisos.filter(a => !a.ok);
    if (malos.length) texto += '\n\n' + malos.map(a => '**' + a.t + '**').join('\n');
    return this.r(texto, local ? 'ia-local' : 'ia-nube', { detalle: avisos.filter(a => a.ok).map(a => a.t).join(' ') });
  }
};

/* Recordatorios: se avisan con la app abierta. Con la app cerrada el celular no deja que una app web
   avise a horario, así que los vencidos se muestran apenas la abrís (y se dice así, sin prometer de más). */
const Recordatorios = {
  lista: [],
  async cargar() { this.lista = await Boveda.get('recordatorios', []); },
  async guardar() { await Boveda.set('recordatorios', this.lista); },
  pendientes() { return this.lista.filter(r => !r.hecho).sort((a, b) => a.cuando - b.cuando); },

  /* «mañana a las 9», «en 20 minutos», «el 15/11 a las 10:30», «hoy a las 18» */
  cuando(qn, ahora = new Date()) {
    let m, d = new Date(ahora);
    if ((m = qn.match(/\ben (\d+|un|una|media) (minutos?|min|horas?|hs|dias?)\b/))) {
      const n = m[1] === 'media' ? 0.5 : /^un/.test(m[1]) ? 1 : +m[1];
      const ms = /^min/.test(m[2]) ? 6e4 : /^(hora|hs)/.test(m[2]) ? 36e5 : 864e5;
      return { t: ahora.getTime() + n * ms, txt: m[0] };
    }
    if ((m = qn.match(/\bel (\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/))) {
      d = new Date(m[3] ? +(m[3].length === 2 ? '20' + m[3] : m[3]) : ahora.getFullYear(), +m[2] - 1, +m[1], 9, 0);
      if (!m[3] && d < ahora) d.setFullYear(d.getFullYear() + 1);
    } else if (/\bpasado manana\b/.test(qn)) { d.setDate(d.getDate() + 2); d.setHours(9, 0, 0, 0); }
    else if (/\bmanana\b/.test(qn)) { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    const h = qn.match(/\ba las (\d{1,2})(?:[:.](\d{2}))?\s*(?:hs|horas)?(?:\s*(de la (manana|tarde|noche)|am|pm))?/);
    if (h) {
      let hh = +h[1]; const mm = +(h[2] || 0);
      if (/tarde|noche|pm/.test(h[3] || '') && hh < 12) hh += 12;
      d.setHours(hh, mm, 0, 0);
      if (d < ahora && !/manana|\bel \d/.test(qn)) d.setDate(d.getDate() + 1);
    } else if (d.getTime() === ahora.getTime()) return null;
    return { t: d.getTime() };
  },

  async interpretar(original) {
    const qn = U.norm(original);
    if (/^(que recordatorios|mis recordatorios|recordatorios pendientes|que tengo pendiente|tengo recordatorios)/.test(qn)) {
      const p = this.pendientes();
      return { texto: p.length ? 'Tus recordatorios pendientes:\n' + p.map(r => `- ${U.fechaHora(r.cuando)}: ${r.texto}`).join('\n') : 'No tenés recordatorios pendientes.', fuente: 'recordatorio', certeza: 'tuyo' };
    }
    const m = original.trim().match(/^(?:recordame|avisame|haceme acordar(?: de)?|record[aá]me|av[ií]same)\s+(?:que\s+)?(.+)$/i);
    if (!m) return null;
    const c = this.cuando(qn);
    const texto = m[1].replace(/\b(pasado )?ma[nñ]ana\b|\ben (\d+|un|una|media) (minutos?|min|horas?|hs|d[ií]as?)\b|\bel \d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|\ba las \d{1,2}(?:[:.]\d{2})?\s*(?:hs|horas)?(?:\s*(?:de la (?:ma[nñ]ana|tarde|noche)|am|pm))?|\bhoy\b/gi, ' ').replace(/^\s*(?:de|que)\s+/i, '').replace(/\s+/g, ' ').trim();
    if (!c) return { texto: `¿Cuándo te aviso de «${texto}»? Decime, por ejemplo: «recordame mañana a las 9 ${texto}» o «en 30 minutos».`, fuente: 'recordatorio', certeza: 'pregunta' };
    if (!texto) return { texto: '¿Qué te recuerdo?', fuente: 'recordatorio', certeza: 'pregunta' };
    this.lista.push({ id: U.id(), texto, cuando: c.t, creado: Date.now(), hecho: false });
    await this.guardar();
    const notif = 'Notification' in window && Notification.permission === 'granted';
    return {
      texto: `Listo: el ${U.fechaHora(c.t)} te recuerdo «${texto}».\n\n${notif ? 'Te aviso con una notificación si la app está abierta o en segundo plano.' : 'Te aviso si la app está abierta.'} Si está cerrada a esa hora, el celular no me deja avisarte: te lo muestro apenas la abras.`,
      fuente: 'recordatorio', certeza: 'accion', sugerencias: ['¿Qué recordatorios tengo?']
    };
  },

  /* Devuelve los que vencieron y los marca como avisados */
  async vencidos() {
    const ahora = Date.now(), v = this.lista.filter(r => !r.hecho && r.cuando <= ahora);
    if (!v.length) return [];
    v.forEach(r => { r.hecho = true; r.avisado = ahora; });
    await this.guardar();
    return v;
  }
};
