/* Utilidades comunes de Nexa IA */
const U = {
  norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!«»"“”]/g, '').replace(/\s+/g, ' ').trim(); },
  STOP: new Set('que del los las por para con una uno unos unas como cual cuales esta este esto estos estas ese esa eso sus son ser fue era hay sobre entre desde hasta cuando donde quien quienes cuanto cuantos mas pero porque segun sin sea mis tus nos les the and decime deci contame podes podrias sabes sabe quiero tengo tenes tiene muy bien algo nada todo'.split(' ')),
  /* Raíz simple de 5 letras: «vencimiento» y «vence» se parecen */
  toks(s) { return [...new Set(this.norm(s).split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !this.STOP.has(w)).map(w => w.length > 5 ? w.slice(0, 5) : w))]; },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); },
  fecha(t) { const d = new Date(t); return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); },
  fechaHora(t) { const d = new Date(t); return U.fecha(t) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); },
  id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  /* Markdown liviano y seguro (de Danscanner Pro): negritas, cursivas, listas y títulos */
  md(s) {
    const inl = t => U.esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const out = []; let list = null; const close = () => { if (list) { out.push('</' + list + '>'); list = null; } };
    String(s || '').split('\n').forEach(l => {
      let m;
      if ((m = l.match(/^\s*#{1,6}\s+(.*)/))) { close(); out.push('<h4>' + inl(m[1]) + '</h4>'); }
      else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inl(m[1]) + '</li>'); }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inl(m[1]) + '</li>'); }
      else if (!l.trim()) close();
      else { close(); out.push('<p>' + inl(l) + '</p>'); }
    });
    close(); return out.join('');
  },
  /* Elección estable (no al azar) para que las mismas respuestas suenen igual de naturales y se puedan probar */
  elegir(lista, semilla) { let h = 0; for (const c of String(semilla || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return lista[h % lista.length]; },
  async sha256(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
};
