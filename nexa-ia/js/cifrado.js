/* Cifrado local con WebCrypto.
   - Cada usuario tiene una clave derivada de su contraseña (PBKDF2-SHA256, 310.000 vueltas).
   - Los datos se cifran con una única "clave de datos" (AES-GCM 256) que se guarda
     envuelta (cifrada) una vez por cada usuario. Sin una contraseña válida no se puede leer nada.
   - Si la contraseña es incorrecta, el descifrado falla: esa es la verificación. */
const Cipher = {
  ITER: 310000,
  enc: new TextEncoder(),
  dec: new TextDecoder(),

  rand(n) { return crypto.getRandomValues(new Uint8Array(n)); },
  b64(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  },
  unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },

  async deriveKek(pass, saltB64, iter) {
    const base = await crypto.subtle.importKey('raw', this.enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: this.unb64(saltB64), iterations: iter || this.ITER },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },

  newDataKey() {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  },

  async wrapKey(dataKey, kek) {
    const raw = await crypto.subtle.exportKey('raw', dataKey);
    const iv = this.rand(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);
    return { iv: this.b64(iv), ct: this.b64(ct) };
  },

  async unwrapKey(w, kek) {
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.unb64(w.iv) }, kek, this.unb64(w.ct));
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  },

  async seal(obj, key) {
    const iv = this.rand(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, this.enc.encode(JSON.stringify(obj)));
    return { iv: this.b64(iv), ct: this.b64(ct) };
  },

  async open(box, key) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.unb64(box.iv) }, key, this.unb64(box.ct));
    return JSON.parse(this.dec.decode(pt));
  }
};
