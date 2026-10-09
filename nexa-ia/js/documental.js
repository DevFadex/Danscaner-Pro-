/* Nexa documental (de «Nexa básico» de Danscanner Pro): resume y extrae datos de un texto, sin IA y sin internet.
   El resumen son frases del propio texto (no reescribe nada), así no puede inventar. */
const Documental = {
  STOP: new Set(U.norm('de la que el en y a los del se las por un una para con no su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos unos yo otro otras otra tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mis tu te ti tus ellas os es son fue fueron era han ha he sido ser sera dicho dicha mismo misma cada solo asi segun ello').split(' ')),
  MESES: 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre',
  limpiar(t) { return String(t || '').replace(/\r/g, '').replace(/(\w)-\s*\n\s*(\w)/g, '$1$2').replace(/([^\n.:;!?])\n(?!\n)(?=\S)/g, '$1 ').replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/\n{3,}/g, '\n\n').trim(); },
  frases(t) { return this.limpiar(t).split(/(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"(])|\n{2,}/).map(s => s.trim()).filter(s => s.length >= 25 && s.length <= 450); },
  resumen(t, n = 5) {
    const ss = this.frases(t); if (ss.length <= n) return ss;
    const f = {};
    for (const s of ss) for (const w of U.norm(s).match(/[a-zñ0-9]{4,}/g) || []) if (!this.STOP.has(w)) f[w] = (f[w] || 0) + 1;
    return ss.map((s, i) => { const ws = (U.norm(s).match(/[a-zñ0-9]{4,}/g) || []).filter(w => !this.STOP.has(w)); return { i, s, v: ws.reduce((a, w) => a + f[w], 0) / Math.sqrt(ws.length + 1) + (i < 2 ? 1.5 : 0) }; })
      .sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map(x => x.s);
  },
  datos(t) {
    t = this.limpiar(t);
    const out = { dni: [], cuil: [], expedientes: [], fechas: [], montos: [], telefonos: [], emails: [], enlaces: [] };
    const add = (k, v) => { v = String(v).trim().replace(/[.,;:]+$/, ''); if (v && !out[k].some(x => U.norm(x) === U.norm(v))) out[k].push(v); };
    let m;
    const reD = /\b(?:D\.?\s?N\.?\s?I\.?|documento)\s*(?:n[°º.]?\s*)?[:\-]?\s*(\d{1,2}[.\s]?\d{3}[.\s]?\d{3})\b/gi; while ((m = reD.exec(t))) add('dni', m[1].replace(/\s/g, '.'));
    const reC = /\b(20|23|24|27|30|33|34)[-\s]?(\d{8})[-\s]?(\d)\b/g; while ((m = reC.exec(t))) add('cuil', m[1] + '-' + m[2] + '-' + m[3]);
    const reE = /\b(?:expte\.?|expediente|causa|legajo|oficio|resoluci[oó]n)\s*(?:n(?:ro|°|º)?\.?\s*)?[:\-]?\s*([A-Za-z]{0,4}[\-\s]?\d[\w\-\/.]{0,18})/gi; while ((m = reE.exec(t))) add('expedientes', m[0].replace(/\s+/g, ' '));
    const reF = /\b(0?[1-9]|[12]\d|3[01])[\/\-.](0?[1-9]|1[0-2])[\/\-.]((?:19|20)?\d{2})\b/g; while ((m = reF.exec(t))) add('fechas', m[0]);
    const reF2 = new RegExp('\\b(\\d{1,2})\\s+de\\s+(' + this.MESES + ')(?:\\s+de(?:l)?\\s+(\\d{4}))?', 'gi'); while ((m = reF2.exec(t))) add('fechas', m[0]);
    const reM = /\$\s?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\s?(?:pesos|ARS)\b/gi; while ((m = reM.exec(t))) add('montos', m[0]);
    const reT = /\b(?:tel(?:[eé]fono)?|cel(?:ular)?|whats?app|m[oó]vil)\.?\s*[:\-]?\s*(\+?[\d\s()\-]{7,20}\d)/gi; while ((m = reT.exec(t))) add('telefonos', m[1]);
    const reM2 = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g; while ((m = reM2.exec(t))) add('emails', m[0]);
    const reU = /\bhttps?:\/\/[^\s<>"']+/gi; while ((m = reU.exec(t))) add('enlaces', m[0]);
    return out;
  },
  ETIQ: { dni: 'DNI', cuil: 'CUIL / CUIT', expedientes: 'Expedientes y actuaciones', fechas: 'Fechas', montos: 'Montos', telefonos: 'Teléfonos', emails: 'Correos', enlaces: 'Enlaces' },
  datosMd(d) { return Object.keys(this.ETIQ).map(k => `- **${this.ETIQ[k]}:** ${d[k].length ? d[k].join(' · ') : 'no figura'}`).join('\n'); },

  /* «resumí: …», «extraé los datos de: …» o un texto largo pegado */
  responder(original) {
    const m = original.match(/^\s*(resum[ií]\w*|sintetiz\w*|extra[eé]\w*(?: los)?(?: datos)?|sac[aá](?: los)? datos|analiz[aá] (?:este )?(?:texto|documento))(?:\s+(?:de|del|este|el))?(?:\s+(?:texto|documento))?\s*:\s*([\s\S]{40,})$/i);
    const largo = !m && original.length > 600 && !/^https?:/.test(original.trim());
    if (!m && !largo) return null;
    const texto = m ? m[2] : original, pide = m ? U.norm(m[1]) : '';
    const sol = /^extra|^saca/.test(pide), res = /^resum|^sintet/.test(pide);
    const partes = [];
    if (!sol) { const r = this.resumen(texto, 5); partes.push('**Resumen** (frases del propio texto):\n' + (r.length ? r.map(x => '- ' + x).join('\n') : '*El texto es muy corto para resumir.*')); }
    if (!res) partes.push('**Datos que figuran:**\n' + this.datosMd(this.datos(texto)));
    return { texto: partes.join('\n\n'), fuente: 'documento', certeza: 'verificado', detalle: 'Extraído del texto, sin reescribirlo. Revisá los datos con el original.' };
  }
};
