/* Voz de Nexa: escuchar (dictado) y hablar (lectura en voz alta) con lo que trae el navegador.
   - Hablar: speechSynthesis, prefiriendo voces instaladas en el equipo (no mandan el texto a internet).
   - Escuchar: SpeechRecognition. Si el equipo tiene dictado sin internet (Chrome reciente), se usa ese.
     Si no, el navegador puede usar los servidores de su fabricante para transcribir la voz: la app lo avisa
     y pide permiso una sola vez. Nada de esto pasa por la app ni por un servidor propio. */
const NexaVoz = {
  SR: window.SpeechRecognition || window.webkitSpeechRecognition || null,
  rec: null, escuchando: false, hablando: false, cola: [], modo: null,
  cfg: { voz: '', velocidad: 1, tono: 1 },

  puedeEscuchar() { return !!this.SR; },
  puedeHablar() { return 'speechSynthesis' in window; },

  /* ¿Hay dictado sin internet? 'local' | 'descargable' | 'red' | 'no' */
  async dictado() {
    if (!this.SR) return 'no';
    if (typeof this.SR.available !== 'function') return 'red';
    try {
      const r = await this.SR.available({ langs: ['es-AR'], processLocally: true }).catch(() => this.SR.available({ langs: ['es-ES'], processLocally: true }));
      return r === 'available' ? 'local' : (r === 'downloadable' || r === 'downloading') ? 'descargable' : 'red';
    } catch (e) { return 'red'; }
  },
  /* Descarga el dictado sin internet (lo hace el navegador, una vez). Necesita un toque del usuario. */
  async instalarDictado() {
    if (!this.SR || typeof this.SR.install !== 'function') return false;
    try { return !!(await this.SR.install({ langs: ['es-AR'], processLocally: true })); } catch (e) { return false; }
  },

  /* Escucha una frase. onParcial(texto) mientras habla, onFinal(texto) al terminar. */
  async escuchar({ onParcial, onFinal, onFin, onError } = {}) {
    if (!this.SR) { onError && onError('no-soportado'); return; }
    this.callar();
    this.detenerEscucha();
    const rec = new this.SR();
    rec.lang = 'es-AR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    if (this.modo === 'local' && 'processLocally' in rec) rec.processLocally = true;
    let final = '', huboFinal = false;
    rec.onresult = e => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else parcial += t;
      }
      onParcial && onParcial((final + ' ' + parcial).trim());
    };
    rec.onerror = e => { this.escuchando = false; onError && onError(e.error || 'error'); };
    rec.onend = () => {
      this.escuchando = false; this.rec = null;
      if (final.trim() && !huboFinal) { huboFinal = true; onFinal && onFinal(final.trim()); }
      onFin && onFin(!!final.trim());
    };
    this.rec = rec; this.escuchando = true;
    try { rec.start(); } catch (e) { this.escuchando = false; onError && onError('no-inicia'); }
  },
  detenerEscucha() { if (this.rec) { try { this.rec.abort(); } catch (e) { /* ya terminó */ } this.rec = null; } this.escuchando = false; },

  /* ---------- hablar ---------- */
  voces() {
    if (!this.puedeHablar()) return [];
    const v = speechSynthesis.getVoices().filter(x => /^es(-|_|$)/i.test(x.lang));
    // primero las del equipo (localService) y las de Argentina / Latinoamérica
    const peso = x => (x.localService ? 0 : 10) + (/AR/i.test(x.lang) ? 0 : /419|MX|US|CO|CL|UY/i.test(x.lang) ? 1 : 2);
    return v.sort((a, b) => peso(a) - peso(b));
  },
  vozElegida() {
    const vs = this.voces();
    return vs.find(v => v.voiceURI === this.cfg.voz) || vs[0] || null;
  },
  /* Divide en frases cortas: los navegadores cortan las lecturas largas */
  frases(t) {
    const limpio = String(t || '').replace(/[«»"“”]/g, '').replace(/\s*\n+\s*/g, '. ').replace(/\s+/g, ' ').trim();
    const out = [];
    for (const f of limpio.split(/(?<=[.;:?!])\s+/)) {
      if (f.length <= 220) { if (f) out.push(f); continue; }
      let resto = f;
      while (resto.length > 220) { let k = resto.lastIndexOf(', ', 220); if (k < 80) k = resto.lastIndexOf(' ', 220); out.push(resto.slice(0, k + 1).trim()); resto = resto.slice(k + 1); }
      if (resto.trim()) out.push(resto.trim());
    }
    return out;
  },
  hablar(texto, { onFin, onInicio } = {}) {
    if (!this.puedeHablar()) { onFin && onFin(); return; }
    this.callar();
    this.cola = this.frases(texto);
    this.hablando = true;
    const voz = this.vozElegida();
    const sig = () => {
      if (!this.hablando) return;
      const f = this.cola.shift();
      if (!f) { this.hablando = false; onFin && onFin(); return; }
      const u = new SpeechSynthesisUtterance(f);
      u.lang = voz ? voz.lang : 'es-AR';
      if (voz) u.voice = voz;
      u.rate = +this.cfg.velocidad || 1; u.pitch = +this.cfg.tono || 1;
      u.onend = sig;
      u.onerror = () => { this.hablando = false; onFin && onFin(); };
      speechSynthesis.speak(u);
    };
    onInicio && onInicio();
    sig();
  },
  callar() { this.cola = []; this.hablando = false; if (this.puedeHablar()) speechSynthesis.cancel(); }
};
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { if (NexaVoz.onVoces) NexaVoz.onVoces(); };
