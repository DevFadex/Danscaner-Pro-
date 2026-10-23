/* Memoria de Nexa: aprende a medida que hablan, siempre a pedido y a la vista.
   - Hechos: «recordá que mi turno médico es el martes 14» → lo guarda tal cual lo dijiste.
   - Respuestas enseñadas: «cuando te pregunte X, respondé Y» o una corrección («no, es Y») a la última respuesta.
   - Tu nombre y cómo querés que te hable.
   - Temas que más consultás (solo para sugerirte cosas; no guarda el texto de la pregunta).
   Todo queda cifrado en la bóveda. Lo aprendido se muestra siempre con su origen y fecha: Nexa nunca
   presenta como verificado algo que solo le dijiste vos. No guarda contraseñas, PIN ni datos de tarjetas.
   Idea tomada de js/aprendizaje.js de Asistente Judicial Pro. */
const Memoria = {
  KEY: 'memoria',
  d: null,

  async load() { this.d = { hechos: [], ensenadas: [], prefs: {}, temas: {}, ...(await Boveda.get(this.KEY, {})) }; return this.d; },
  async save() { await Boveda.set(this.KEY, this.d); },
  async olvidarTodo() { this.d = { hechos: [], ensenadas: [], prefs: {}, temas: {} }; await this.save(); },
  nombre() { return (this.d && this.d.prefs.nombre) || ''; },
  resumen() { const d = this.d || {}; return { hechos: (d.hechos || []).length, ensenadas: (d.ensenadas || []).length, nombre: this.nombre() }; },

  SENSIBLE: /contrase|password|\bclave (del?|de mi|bancaria|del banco|de la tarjeta|del mail|del correo|de home ?banking)|\bpin\b|\bcvv\b|\bcvc\b|codigo de (seguridad|verificacion)|numero de (la )?tarjeta|\btoken\b|\b(?:\d[ -]?){15,16}\b/,

  r(texto, extra = {}) { return { texto, fuente: 'memoria', certeza: 'accion', ...extra }; },
  /* Algo que el usuario contó y Nexa repite: se marca como no verificado */
  dato(texto, extra = {}) { return { texto, fuente: 'memoria', certeza: 'tuyo', recuerdo: true, ...extra }; },

  /* Pedidos para enseñar, corregir, olvidar o ver lo aprendido. Devuelve una respuesta o null. */
  async interpretar(original, ultima) {
    const q = U.norm(original).replace(/[.]+$/, '');
    let m;
    if (/^(que (sabes|recordas|te acordas|aprendiste|tenes guardado) (de|sobre) mi|que (aprendiste|recordas|sabes de mi)|mostra(me)? (tu|la) memoria|que te ensene)$/.test(q)) return this.listar();
    if (/^olvida(te)? (de )?todo$/.test(q)) return this.r('Para borrar todo lo que aprendí, andá a **Memoria → Borrar todo lo aprendido**. Te voy a pedir confirmación, porque no se puede deshacer.', { sugerencias: ['¿Qué sabés de mí?'] });
    if ((m = q.match(/^(?:olvida(?:te)?|borra)(?: de)?(?: que)? (.+)$/))) return this.olvidar(m[1]);
    if ((m = original.trim().match(/^(?:me llamo|mi nombre es|llamame|decime)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)?)\.?$/i))) {
      const n = m[1].replace(/\b\w/g, c => c.toUpperCase()), antes = this.d.prefs.nombre;
      this.d.prefs.nombre = n; await this.save();
      return this.r(antes && antes !== n ? `Listo, desde ahora te llamo ${n} (antes te decía ${antes}).` : `Un gusto, ${n}. Lo anoto para la próxima.`);
    }
    if ((m = original.trim().match(/^(?:cuando|si)\s+te\s+(?:pregunte|pregunto|pida|pido|diga|digo)\s+(.+?)[,:]?\s+(?:respond[eé](?:me)?|dec[ií](?:me)?|contest[aá](?:me)?)\s*(?:que\s+)?(.+)$/i))) return this.ensenar(m[1], m[2]);
    if (ultima && (m = original.trim().match(/^(?:no[,.]?\s+|eso (?:est[aá] mal|no es (?:as[ií]|correcto|cierto))[,.]?\s+|te equivocaste[,.]?\s+|incorrecto[,.]?\s+)(?:la respuesta (?:correcta )?es|es|era|son)\s+(.+)$/i)) && !/^(lo que|eso|as[ií]|correcto|cierto|verdad|tan as[ií])\b/i.test(m[1])) {
      const r = await this.ensenar(ultima, m[1]);
      r.texto = 'Gracias por corregirme. ' + r.texto;
      return r;
    }
    if ((m = original.trim().match(/^(?:record[aá]|acordate|anot[aá]|guard[aá]|aprend[eé]|ten[eé] en cuenta)(?:\s+que|\s+de que|:)?\s+(.+)$/i))) return this.anotar(m[1]);
    return null;
  },

  async anotar(texto) {
    texto = texto.trim().replace(/\s*[.]+$/, '');
    if (this.SENSIBLE.test(U.norm(texto))) return this.r('Eso parece una contraseña, un PIN o datos de una tarjeta, así que **no lo guardo**. Aunque mi memoria está cifrada, ese tipo de dato va en un administrador de contraseñas, no en un asistente. Si alguien te lo pide por mensaje, es una estafa.', { fuente: 'seguridad', certeza: 'verificado' });
    if (texto.length < 4) return this.r('No entendí qué querés que recuerde. Decime, por ejemplo: «recordá que mi turno es el martes 14».');
    const clave = this.claveDe(texto);
    let aviso = '';
    if (clave) {
      const i = this.d.hechos.findIndex(h => h.clave === clave);
      if (i >= 0) { aviso = ` Antes me habías dicho «${this.d.hechos[i].texto}»; lo reemplacé.`; this.d.hechos.splice(i, 1); }
    }
    this.d.hechos.push({ id: U.id(), texto, clave, t: Date.now(), usos: 0 });
    await this.save();
    return this.r(`Anotado: «${texto}».${aviso} Si después me lo preguntás, te lo digo aclarando que me lo contaste vos.`, { sugerencias: ['¿Qué sabés de mí?'] });
  },
  /* «mi turno médico es el martes» → «turno medico» (para reemplazarlo si cambia) */
  claveDe(texto) {
    const m = U.norm(texto).match(/^(?:mi|mis|nuestro|nuestra|el|la)\s+(.{2,40}?)\s+(?:es|son|esta|estan|queda|quedan|vence|vencen|cae|sera)\b/);
    return m ? m[1].trim() : '';
  },

  async ensenar(pregunta, resp) {
    pregunta = String(pregunta).trim(); resp = String(resp).trim().replace(/^[«"]|[»"]$/g, '');
    if (this.SENSIBLE.test(U.norm(resp))) return this.r('Esa respuesta parece tener una contraseña o datos de tarjeta: no la guardo.', { fuente: 'seguridad', certeza: 'verificado' });
    const qn = U.norm(pregunta);
    this.d.ensenadas = this.d.ensenadas.filter(e => U.norm(e.q) !== qn);
    this.d.ensenadas.push({ id: U.id(), q: pregunta, resp, t: Date.now() });
    await this.save();
    return this.r(`Aprendido: cuando me preguntes «${pregunta}», te voy a responder «${resp}» y te voy a aclarar que me lo enseñaste vos.`);
  },

  async olvidar(algo) {
    const t = U.toks(algo); if (!t.length) return this.r('Decime qué querés que olvide.');
    const parecido = x => { const k = U.toks(x); return t.filter(w => k.includes(w)).length / t.length >= 0.6; };
    const h0 = this.d.hechos.length, e0 = this.d.ensenadas.length;
    const borrados = this.d.hechos.filter(h => parecido(h.texto)).map(h => h.texto).concat(this.d.ensenadas.filter(e => parecido(e.q + ' ' + e.resp)).map(e => e.q));
    this.d.hechos = this.d.hechos.filter(h => !parecido(h.texto));
    this.d.ensenadas = this.d.ensenadas.filter(e => !parecido(e.q + ' ' + e.resp));
    if (h0 === this.d.hechos.length && e0 === this.d.ensenadas.length) return this.r(`No tengo nada guardado sobre «${algo}».`);
    await this.save();
    return this.r('Listo, lo olvidé:\n' + borrados.map(b => '- ' + b).join('\n'));
  },

  listar() {
    const d = this.d;
    if (!d.hechos.length && !d.ensenadas.length && !d.prefs.nombre) return this.r('Todavía no me enseñaste nada. Podés decirme, por ejemplo: «recordá que el vencimiento del alquiler es el 10» o «cuando te pregunte por el horario, respondé de 8 a 14».');
    const out = [];
    if (d.prefs.nombre) out.push(`**Tu nombre:** ${d.prefs.nombre}`);
    if (d.hechos.length) out.push('**Lo que me contaste:**\n' + d.hechos.map(h => `- ${h.texto} *(${U.fecha(h.t)})*`).join('\n'));
    if (d.ensenadas.length) out.push('**Respuestas que me enseñaste:**\n' + d.ensenadas.map(e => `- «${e.q}» → ${e.resp} *(${U.fecha(e.t)})*`).join('\n'));
    return this.dato(out.join('\n\n') + '\n\nEsto es todo lo que guardé: no tengo nada más sobre vos. Podés borrar cualquier cosa diciendo «olvidá …».');
  },

  /* ¿Lo que preguntás está en lo que me enseñaste? */
  responder(original) {
    const qn = U.norm(original), qt = U.toks(original);
    if (!qt.length) return null;
    const jac = (a, b) => { const B = new Set(b); const i = a.filter(x => B.has(x)).length; return i / (new Set([...a, ...b]).size || 1); };
    const e = this.d.ensenadas.map(e => ({ e, s: U.norm(e.q) === qn ? 1 : jac(qt, U.toks(e.q)) })).sort((a, b) => b.s - a.s)[0];
    if (e && e.s >= 0.7) return this.dato(`${e.e.resp}`, { detalle: `Me lo enseñaste el ${U.fecha(e.e.t)}` });
    const hs = this.relevantes(original, true);
    if (hs.length) {
      hs.forEach(h => h.usos++);
      return this.dato((hs.length === 1 ? `Me dijiste: «${hs[0].texto}».` : 'Esto es lo que me dijiste:\n' + hs.map(h => `- «${h.texto}» *(${U.fecha(h.t)})*`).join('\n')),
        { detalle: hs.length === 1 ? `Me lo contaste el ${U.fecha(hs[0].t)}. No lo verifiqué por otro lado.` : 'Me lo contaste vos. No lo verifiqué por otro lado.' });
    }
    return null;
  },
  /* Hechos que tienen que ver con la pregunta. estricto: solo si la pregunta es sobre vos o calza la clave. */
  relevantes(original, estricto) {
    const qn = U.norm(original), qt = U.toks(original);
    const sobreMi = /\b(mi|mis|me|yo|nuestro|nuestra|nuestros|tengo|recordas|acordas|te dije|anotaste)\b/.test(qn);
    return this.d.hechos.map(h => {
      const ht = U.toks(h.texto), comun = qt.filter(w => ht.includes(w)).length;
      const clave = h.clave && U.toks(h.clave).every(w => qt.includes(w));
      return { h, s: (clave ? 2 : 0) + comun };
    }).filter(x => estricto ? (x.s >= 2 && (sobreMi || x.s >= 3)) : x.s >= 1).sort((a, b) => b.s - a.s).slice(0, 4).map(x => x.h);
  },

  /* Temas frecuentes (palabras sueltas, sin guardar la pregunta) */
  contarTemas(original) {
    for (const w of U.toks(original)) this.d.temas[w] = (this.d.temas[w] || 0) + 1;
    const ks = Object.keys(this.d.temas);
    if (ks.length > 300) ks.sort((a, b) => this.d.temas[a] - this.d.temas[b]).slice(0, ks.length - 300).forEach(k => delete this.d.temas[k]);
  },

  /* Lo aprendido, en texto, para darle contexto a una IA (local o en la nube) */
  contexto(original) {
    const hs = this.relevantes(original, false);
    const out = [];
    if (this.nombre()) out.push(`El usuario se llama ${this.nombre()}.`);
    if (hs.length) out.push('Datos que el usuario le contó a Nexa (no verificados):\n' + hs.map(h => `- ${h.texto} (${U.fecha(h.t)})`).join('\n'));
    return out.join('\n');
  }
};
