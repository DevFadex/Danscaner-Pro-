# Nexa IA — guía para Claude

App aparte de Danscanner Pro: asistente personal + seguridad para el celular. Vive en la carpeta `nexa-ia/`
(rama `claude/nexa-ia-mobile-assistant-crw06v`) hasta que tenga su propio repositorio. No mezclar su código con el
de Danscanner Pro ni con el de Asistente Judicial Pro: si se mejora algo que vino de ahí, se copia, no se enlaza.
El dueño escribe en español rioplatense: respondé igual, simple y sin tecnicismos.

## Cómo está hecha
- PWA sin compilar: `index.html`, `styles.css`, `app.js` (pantallas) y módulos en `js/` (objetos globales).
- `Boveda` (cifrado con PIN) → `Memoria`, `Nexa` (decide quién responde), `Humano` (modo humano y verdad),
  `Seguridad`, `NexaJuridico` (copia de `js/nexa.js` de Asistente Judicial Pro), `Documental`, `IALocal`, `IANube`, `NexaVoz`.
- Toda respuesta es `{ texto, fuente, certeza, detalle?, sugerencias? }`. `fuente` y `certeza` se muestran siempre.

## Reglas
- **Verdad**: nunca responder sin fuente. Si nadie sabe, «no lo sé». El modo humano solo agrega `previa`/`cierre`,
  jamás cambia `texto`. Lo que dice una IA se marca `certeza: 'ia'`.
- **Privacidad**: todo en la bóveda; nada de datos reales en código, pruebas ni commits; claves de IA solo en el teléfono.
- **Honestidad del alcance**: no prometer sensores que una app web no tiene (ver `docs/ALCANCE.md`).
- **Licencias**: solo MIT, Apache-2.0, BSD (y OFL para fuentes), con la licencia junto al archivo.
- Archivo nuevo en `js/` → sumarlo a `sw.js` (`SHELL`) y a `Seguridad.ARCHIVOS`.
- Versión: `APP_VER` en `app.js` y `VERSION` en `sw.js` (`nexa-ia-vNN`).
- Cada cambio de comportamiento lleva su prueba en `tests/nexa.test.js`. Nunca saltear ni desactivar una prueba.
