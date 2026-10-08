# Danscanner Pro — guía para Claude

PWA de escaneo de documentos para una oficina judicial penitenciaria (Unidad 5, Tucumán, Argentina). Se publica en Vercel desde `main`. El dueño (Dani, administrador) escribe en español rioplatense: respondé en español, simple y sin tecnicismos innecesarios.

## Cómo está hecha
- **Sin framework ni build**: HTML + JavaScript puro. Casi todo vive en `index.html` (~1 MB), con módulos en `mod/*.js` (cargados con `lazyMod('nombre')`) y librerías locales en `libs/`.
- **Patrón de extensión**: cada versión agrega un bloque al final del `<script>` con envoltorios `{const _f=fn;fn=function(){…_f.apply(this,arguments)…}}`. Las funciones declaradas con `function` se pueden reasignar; las `const` no. Para un cambio chico, preferí envolver antes que reescribir.
- **Piezas clave**:
  - `S` / `saveS()`: ajustes.
  - `Nav`: pila de pantallas.
  - `openSheet(título, html)`: hojas modales.
  - `toast()`: avisos.
  - `iconize()`: convierte emojis en íconos SVG; tenelo en cuenta al comparar textos en pruebas.
  - `Cam` / `CamPro`: cámara.
  - `VisionEngine`: Worker de detección, ver `docs/ESCANER_VISION.md`.
  - `renderPage`: recorte → giro → limpieza → filtro.
  - `FW`: Worker de filtros. Copia funciones por nombre: una función nueva que se use dentro de un filtro tiene que agregarse a su lista y no depender de variables externas.
  - `Nexa`: asistente IA, solo para administrador mientras está en desarrollo.
- `sw.js` cachea la app para usarla sin internet; agregá ahí los archivos nuevos de `mod/`.

## Reglas que no se negocian
- **Privacidad**: nada de datos personales reales (internos, DNI, expedientes) en el código, en las pruebas ni en commits. Las capturas o PDF que comparta el usuario son solo referencia visual.
- **Claves de API**: nunca en el código ni en el repositorio. Quedan en el equipo del usuario.
- **Procesamiento local primero**: on-device siempre que se pueda.
- **Licencias**: solo compatibles (MIT, Apache-2.0, BSD). Guardá la licencia junto a la librería en `libs/`.
- **Compatibilidad**: no romper ajustes ni documentos guardados de versiones anteriores.
- **Commits**: no incluir identificadores de modelo en commits, PR ni código.
- **Celular**: si el pedido es solo para PC, el formato de celular no se toca (usá `@media (min-width:1024px)`).

## Versiones y publicación
Cada entrega sube la versión en todos estos lugares:
- `APP_VER` y `BUILD` en `index.html`;
- `VERSION` en `sw.js` (`danscaner-vNN`);
- una sección nueva en `docs/CAMARA_Y_EDICION.md` y en `knowledge/danscaner/manual.md`;
- `knowledge/knowledge-version.json`.

Flujo:
1. Trabajar en la rama `claude/nexa-ia-danscaner-pro-i6h1qz`, actualizada desde `origin/main`.
2. Correr todas las pruebas.
3. Commit y push (sin `--force`).
4. Abrir PR a `main`.
5. Cuando el check **e2e** está verde, mergear.
6. Al usuario: solo «Versión NN lista». El usuario pidió publicar sin esperar confirmación una vez que las pruebas pasan.

## Pruebas
- E2E con Playwright en `tests/app.test.js`; cada cambio de comportamiento lleva su prueba.
- Para correrlas:
  ```
  python3 -m http.server 8765        # desde la raíz, en segundo plano
  cd tests && NODE_PATH=/opt/node22/lib/node_modules node app.test.js
  ONLY="parte del nombre" …          # para correr una sola prueba
  ```
- Si una prueba vieja falla por un cambio pedido, ajustala explicando por qué. Nunca la saltees ni la desactives.

## Diseño
- Estilo inspirado en Adobe Scan y CamScanner: limpio, botones grandes, iconos SVG, modo oscuro.
- Mobile-first, con letra legible al sol.
- Si está activa la skill **frontend-design**, usala para cualquier cambio de interfaz.
- Revisá contraste, foco visible y textos claros antes de publicar.

## Otro repositorio
`DevFadex/asistente-judicial-pro` (Asistente Judicial Pro) es una app aparte, con su propio Nexa jurídico sin internet. No mezclar código entre las dos.
