/* IA en el teléfono (de «Nexa local» de Danscanner Pro): un modelo abierto que corre en el celular con WebGPU.
   Se descarga una sola vez (desde Hugging Face, la única conexión que hace) y después funciona sin internet.
   Los textos que le mandás no salen del teléfono. Librería: WebLLM (Apache-2.0), en libs/. */
const IALocal = {
  URL: 'libs/web-llm-0.2.85.js',
  MODELOS: [['Qwen2.5-0.5B-Instruct', 'Liviano', '≈ 0,4 GB · rápido, para celulares básicos'], ['Qwen2.5-1.5B-Instruct', 'Recomendado', '≈ 1 GB · buen español, equilibrado'], ['Qwen2.5-3B-Instruct', 'Máxima calidad', '≈ 1,8 GB · para celulares potentes']],
  engine: null, cargando: null, lib: null, oyentes: new Set(), cfgCache: null,

  async cfg() { if (!this.cfgCache) this.cfgCache = await Boveda.get('ia-local', { base: 'Qwen2.5-1.5B-Instruct', descargada: false, id: '' }); return this.cfgCache; },
  async guardar() { await Boveda.set('ia-local', this.cfgCache); },
  async lista() { return !!(await this.cfg()).descargada; },
  async soporte() {
    if (!('gpu' in navigator)) return { ok: false, why: 'Este navegador no tiene WebGPU. Usá Chrome actualizado en Android o Safari reciente en iPhone.' };
    try {
      const ad = await navigator.gpu.requestAdapter();
      if (!ad) return { ok: false, why: 'El teléfono no permitió usar la placa gráfica (WebGPU).' };
      const lim = ad.limits && ad.limits.maxComputeWorkgroupStorageSize;
      if (lim && lim < 32768) return { ok: false, why: 'La placa gráfica de este teléfono no alcanza para la IA local (es un límite del hardware, no de espacio).' };
      return { ok: true, f16: ad.features.has('shader-f16') };
    } catch (e) { return { ok: false, why: 'WebGPU no disponible: ' + e.message }; }
  },
  emitir(p, t) { this.oyentes.forEach(f => { try { f(p, t); } catch (e) { /* oyente roto */ } }); },
  async cargar() {
    if (this.engine) return this.engine;
    if (this.cargando) return this.cargando;
    this.cargando = (async () => {
      const s = await this.soporte(); if (!s.ok) throw new Error(s.why);
      if (!this.lib) this.lib = await import(new URL(this.URL, location.href).href);
      const c = await this.cfg(), id = c.base + (s.f16 ? '-q4f16_1-MLC' : '-q4f32_1-MLC');
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* opcional */ }
      this.emitir(0, 'Preparando la IA del teléfono…');
      const eng = await this.lib.CreateMLCEngine(id, { initProgressCallback: r => this.emitir(r.progress || 0, r.text || '') });
      c.id = id; c.descargada = true; await this.guardar();
      this.engine = eng; this.emitir(1, 'IA del teléfono lista');
      return eng;
    })();
    try { return await this.cargando; } catch (e) { this.cargando = null; this.emitir(-1, e.message); throw e; } finally { if (this.engine) this.cargando = null; }
  },
  async chat(messages, { signal, onText } = {}) {
    const eng = await this.cargar();
    let text = '';
    signal && signal.addEventListener('abort', () => { try { eng.interruptGenerate(); } catch (e) { /* ya terminó */ } }, { once: true });
    const stream = await eng.chat.completions.create({ messages, stream: true, temperature: 0.3, max_tokens: 900 });
    for await (const ch of stream) { const d = ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content; if (d) { text += d; onText && onText(text); } if (signal && signal.aborted) break; }
    return text.trim();
  },
  async borrar() {
    const c = await this.cfg();
    try { if (this.engine) await this.engine.unload(); } catch (e) { /* nada */ }
    this.engine = null;
    try { if (!this.lib) this.lib = await import(new URL(this.URL, location.href).href); if (c.id) await this.lib.deleteModelAllInfoInCache(c.id); } catch (e) { /* nada */ }
    c.descargada = false; c.id = ''; await this.guardar();
  }
};
