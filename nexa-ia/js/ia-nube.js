/* IA en la nube, opcional y apagada de fábrica (de aiChatStream de Danscanner Pro).
   Usa TU clave, que queda cifrada en la bóveda de este teléfono (nunca en el código ni en el repositorio).
   Antes de enviar, se tapan DNI, CUIL, correos, teléfonos y números de tarjeta del texto. */
const IANube = {
  PROV: {
    anthropic: { n: 'Claude (Anthropic)', m: 'claude-opus-5-5', help: 'Clave en console.anthropic.com' },
    gemini: { n: 'Google Gemini', m: 'gemini-2.5-flash', help: 'Clave en aistudio.google.com/apikey' },
    openai: { n: 'ChatGPT (OpenAI)', m: 'gpt-4o-mini', help: 'Clave en platform.openai.com/api-keys' }
  },
  _cfg: null,
  async config() { if (!this._cfg) this._cfg = await Boveda.get('ia-nube', { activa: false, prov: '', claves: {}, modelos: {} }); return this._cfg; },
  async guardar() { await Boveda.set('ia-nube', this._cfg); },
  async lista() { const c = await this.config(); return !!(c.activa && c.prov && c.claves[c.prov]); },

  /* Datos personales que no hace falta mandar */
  tapar(t) {
    return String(t || '')
      .replace(/\b(?:\d[ -]?){15,16}\b/g, '[tarjeta]')
      .replace(/\b(20|23|24|27|30|33|34)[-\s]?\d{8}[-\s]?\d\b/g, '[CUIL]')
      .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}\b/g, '[DNI]')
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[correo]')
      .replace(/(\+?54\s?9?\s?)?\b(\d{2,4}[\s-]?)?\d{3,4}[\s-]\d{4}\b/g, '[teléfono]');
  },

  async chat(msgs, { system, signal, onText } = {}) {
    const c = await this.config(), prov = c.prov, key = c.claves[prov];
    if (!key) throw new Error('Falta tu clave de ' + this.PROV[prov].n + '. Cargala en Ajustes.');
    const model = (c.modelos[prov] || '').trim() || this.PROV[prov].m;
    msgs = msgs.map(m => ({ ...m, text: this.tapar(m.text) }));
    let url, body; const headers = { 'Content-Type': 'application/json' };
    if (prov === 'gemini') {
      url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse'; headers['x-goog-api-key'] = key;
      body = { contents: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text || ' ' }] })), generationConfig: { maxOutputTokens: 4000 } };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
    } else if (prov === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions'; headers.Authorization = 'Bearer ' + key;
      body = { model, stream: true, max_tokens: 4000, messages: [...(system ? [{ role: 'system', content: system }] : []), ...msgs.map(m => ({ role: m.role, content: m.text || ' ' }))] };
    } else {
      url = 'https://api.anthropic.com/v1/messages';
      Object.assign(headers, { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
      // si el modelo principal se niega por sus filtros, el servidor prueba con otro (fallback)
      const fb = /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model);
      if (fb) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body = { model, stream: true, max_tokens: 16000, ...(fb ? { fallbacks: 'default' } : {}), ...(system ? { system } : {}), messages: msgs.map(m => ({ role: m.role, content: m.text || ' ' })) };
    }
    const nombre = this.PROV[prov].n;
    let r;
    try { r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal }); }
    catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Sin conexión con ' + nombre + '. Revisá internet.'); }
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch (e) { /* sin cuerpo */ } const m = (Array.isArray(j) ? j[0] : j)?.error?.message; throw new Error(m || ('Error de ' + nombre + ' (' + r.status + ')')); }
    let text = '', stop = '';
    const add = t => { if (t) { text += t; onText && onText(text); } };
    const handle = d => {
      if (prov === 'gemini') { add((d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')); stop = d.candidates?.[0]?.finishReason || stop; }
      else if (prov === 'openai') { add(d.choices?.[0]?.delta?.content || ''); stop = d.choices?.[0]?.finish_reason || stop; }
      else if (d.type === 'content_block_delta' && d.delta?.type === 'text_delta') add(d.delta.text);
      else if (d.type === 'message_delta') stop = d.delta?.stop_reason || stop;
      else if (d.type === 'error') throw new Error(d.error?.message || 'Error de Anthropic');
    };
    const line = l => { l = l.replace(/\r$/, ''); if (!l.startsWith('data:')) return; const t = l.slice(5).trim(); if (!t || t === '[DONE]') return; let d; try { d = JSON.parse(t); } catch (e) { return; } handle(d); };
    if (!r.body) (await r.text()).split('\n').forEach(line);
    else {
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); } }
      if (buf) line(buf);
    }
    if (stop === 'refusal' || stop === 'SAFETY') text += (text ? '\n\n' : '') + '*El servicio no quiso responder esto por sus políticas.*';
    else if (stop === 'max_tokens' || stop === 'length' || stop === 'MAX_TOKENS') text += '\n\n*(La respuesta se cortó por largo.)*';
    return text.trim();
  }
};
