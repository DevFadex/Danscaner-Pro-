/* Bóveda de Nexa IA: todo lo que Nexa guarda queda cifrado en este equipo (IndexedDB + WebCrypto).
   - Se abre con un PIN o frase. De ahí sale la clave que envuelve la "clave de datos" (AES-GCM 256).
   - Sin el PIN no se puede leer nada: ni la memoria, ni las conversaciones, ni las claves de IA.
   - Los intentos fallidos se registran (solo fecha y hora) y frenan a quien prueba PIN tras PIN.
   - "Borrar todo" destruye la clave: es un borrado criptográfico instantáneo.
   Basado en js/storage.js y js/crypto.js de Asistente Judicial Pro. */
const Boveda = {
  DB: 'nexa-ia', VER: 1,
  key: null, _db: null,
  LIBRES: 5,            // intentos sin espera
  MAX_ESPERA: 3600e3,   // tope de espera: 1 hora

  _open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const r = indexedDB.open(this.DB, this.VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const s of ['plain', 'sealed']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      r.onsuccess = () => { this._db = r.result; res(this._db); };
      r.onerror = () => rej(r.error);
    });
  },
  async _tx(store, mode, fn) {
    const db = await this._open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      let out;
      const req = fn(t.objectStore(store));
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  },
  getPlain(k) { return this._tx('plain', 'readonly', s => s.get(k)); },
  setPlain(k, v) { return this._tx('plain', 'readwrite', s => s.put(v, k)); },

  abierta() { return !!this.key; },
  async existe() { return !!(await this.getPlain('cuenta')); },

  async get(k, def) {
    if (!this.key) throw new Error('La bóveda está cerrada');
    const box = await this._tx('sealed', 'readonly', s => s.get(k));
    return box ? Cipher.open(box, this.key) : def;
  },
  async set(k, v) {
    if (!this.key) throw new Error('La bóveda está cerrada');
    const box = await Cipher.seal(v, this.key);
    return this._tx('sealed', 'readwrite', s => s.put(box, k));
  },

  validarPin(pin) {
    pin = String(pin || '');
    if (pin.length < 6) return 'Usá al menos 6 caracteres.';
    if (/^(\d)\1+$/.test(pin) || '0123456789012'.includes(pin) || '9876543210987'.includes(pin)) return 'Ese PIN es muy fácil de adivinar.';
    return '';
  },

  async crear(pin) {
    const err = this.validarPin(pin); if (err) throw new Error(err);
    const salt = Cipher.b64(Cipher.rand(16));
    const kek = await Cipher.deriveKek(pin, salt);
    const dk = await Cipher.newDataKey();
    await this.setPlain('cuenta', { salt, iter: Cipher.ITER, w: await Cipher.wrapKey(dk, kek), creada: Date.now() });
    await this.setPlain('fallos', []);
    this.key = dk;
    await this._registrarAcceso();
  },

  /* Milisegundos que hay que esperar antes de otro intento (crece con cada fallo) */
  async esperaRestante() {
    const f = (await this.getPlain('fallos')) || [];
    if (f.length < this.LIBRES) return 0;
    const espera = Math.min(this.MAX_ESPERA, 30e3 * 2 ** (f.length - this.LIBRES));
    return Math.max(0, f[f.length - 1].t + espera - Date.now());
  },

  /* Abre con el PIN. Devuelve los intentos fallidos que hubo desde el último acceso. */
  async abrir(pin) {
    const espera = await this.esperaRestante();
    if (espera > 0) { const e = new Error(`Demasiados intentos. Esperá ${Math.ceil(espera / 1000)} segundos.`); e.espera = espera; throw e; }
    const c = await this.getPlain('cuenta');
    if (!c) throw new Error('Todavía no creaste tu PIN');
    let key;
    try { key = await Cipher.unwrapKey(c.w, await Cipher.deriveKek(pin, c.salt, c.iter)); }
    catch (e) {
      const f = (await this.getPlain('fallos')) || [];
      f.push({ t: Date.now() });
      await this.setPlain('fallos', f.slice(-50));
      throw new Error('PIN incorrecto');
    }
    this.key = key;
    const fallos = (await this.getPlain('fallos')) || [];
    await this.setPlain('fallos', []);
    await this._registrarAcceso(fallos);
    return { fallos };
  },

  async _registrarAcceso(fallos = []) {
    const acc = await this.get('accesos', []);
    acc.push({ t: Date.now(), fallosPrevios: fallos.map(f => f.t), nav: navigator.userAgent.slice(0, 160) });
    await this.set('accesos', acc.slice(-100));
  },

  cerrar() { this.key = null; },

  async cambiarPin(actual, nuevo) {
    const err = this.validarPin(nuevo); if (err) throw new Error(err);
    const c = await this.getPlain('cuenta');
    let dk;
    try { dk = await Cipher.unwrapKey(c.w, await Cipher.deriveKek(actual, c.salt, c.iter)); }
    catch (e) { throw new Error('El PIN actual no es correcto'); }
    const salt = Cipher.b64(Cipher.rand(16));
    // se re-envuelve la misma clave de datos: no hace falta volver a cifrar todo
    await this.setPlain('cuenta', { ...c, salt, iter: Cipher.ITER, w: await Cipher.wrapKey(dk, await Cipher.deriveKek(nuevo, salt)) });
    this.key = dk;
  },

  async borrarTodo() {
    this.key = null;
    if (this._db) { try { this._db.close(); } catch (e) { /* ya cerrada */ } this._db = null; }
    await new Promise(res => { const r = indexedDB.deleteDatabase(this.DB); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  }
};
