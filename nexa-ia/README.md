# Nexa IA

Asistente personal y de seguridad para el celular. App web instalable (PWA): se abre desde el navegador,
se instala en la pantalla de inicio y funciona sin internet.

- **Privada**: todo lo que guarda (memoria, conversaciones, recordatorios, claves) queda cifrado en el teléfono con tu PIN.
- **No inventa**: cada respuesta dice de dónde sale y cuánta certeza tiene. Si no sabe, dice «no lo sé».
- **Modo humano**: habla de forma natural sin cambiar ni recortar el contenido. Se puede apagar.
- **Aprende con vos**: «recordá que…», «cuando te pregunte…, respondé…», botón «Está mal» para corregirla.
- **Modo seguridad**: revisa lo que una app web puede ver, analiza mensajes y enlaces sospechosos, mide contraseñas
  y avisa intentos fallidos de PIN. También dice lo que no puede ver.
- **Leyes sin internet** (de Asistente Judicial Pro) y **resúmenes / datos de textos** (de Danscanner Pro).
- **IA opcional**: en el teléfono (sin mandar nada afuera) o en la nube con tu propia clave.

## Probarla

```bash
cd nexa-ia
python3 -m http.server 8767        # y abrir http://localhost:8767
```

## Pruebas

```bash
cd nexa-ia && python3 -m http.server 8767 &
cd tests && NODE_PATH=/opt/node22/lib/node_modules node nexa.test.js
ONLY="Memoria" …                    # una sola
```

## Documentos

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md): arquitectura de la versión nativa (Android/iOS).
- [`docs/ALCANCE.md`](docs/ALCANCE.md): qué hace esta versión, qué no puede hacer una app web y próximos pasos.

## Licencias

- WebLLM 0.2.85 (`libs/`): Apache-2.0, ver `libs/LICENSE-web-llm.txt`.
- Atkinson Hyperlegible (`fonts/`): SIL Open Font License, ver `fonts/OFL-Atkinson-Hyperlegible.txt`.
- Leyes (`knowledge/leyes/`): textos oficiales de InfoLeg y del Boletín Oficial de Tucumán, ver `knowledge/leyes/LEEME.md`.
