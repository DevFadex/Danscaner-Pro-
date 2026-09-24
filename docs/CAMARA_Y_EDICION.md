# Danscanner Pro — Cámara y edición de imagen

Documentación técnica del módulo de cámara, el procesamiento de imagen, Magic Pro y la exportación a PDF.

## Plataforma

Danscanner Pro es una **aplicación web instalable (PWA)**: HTML + JavaScript, sin paso de compilación, publicada en Vercel.
Todo el procesamiento de imagen y el OCR corren **en el dispositivo** (Canvas 2D, Web Worker, Tesseract.js).

Por ser web, algunas capacidades del pedido dependen de lo que el navegador expone:

| Pedido | Estado en la PWA |
|---|---|
| Enfoque automático continuo | ✅ `focusMode: continuous` si la cámara lo ofrece |
| Exposición automática + compensación EV | ✅ `exposureMode: continuous` + control deslizante EV (si el teléfono lo expone) |
| Balance de blancos automático | ✅ `whiteBalanceMode: continuous` |
| Resolución máxima | ✅ hasta 4K por video y foto completa del sensor con `ImageCapture.takePhoto()` (Foto HD) |
| Flash apagado / encendido / automático | ✅ el automático prende la linterna cuando hay poca luz |
| Detección de bordes, perspectiva, auto-captura, ráfaga (Lote), cuadrícula | ✅ ya existían |
| Nivel horizontal y aviso de sombras / poca luz | ✅ nuevos |
| Captura RAW / DNG | ❌ los navegadores no dan acceso a RAW |
| Estabilización óptica | ⚠️ la aplica el propio teléfono; el navegador no la controla |

## Filtros

| Filtro | Qué hace | Uso recomendado |
|---|---|---|
| **Documento** (por defecto) | Fondo blanco puro, texto negro con bordes suaves, **tinta de color conservada** (firmas, sellos azules/violetas/rojos, logos) | Oficios, notas, partes diarios |
| **Magia Pro** | Inteligente: si detecta un documento aplica *Documento* reforzado; si es una foto o credencial, mejora color y nitidez | Uso general |
| **Magic Color** | Color vivo con fondo limpio | Documentos a color, folletos |
| **Gris** | Escala de grises con contraste local | Copias en grises |
| **Blanco y Negro** | Binarización adaptativa (Sauvola), B/N exacto | Ahorro de tinta |
| **Alto contraste** | Contraste fuerte | Documentos muy tenues |
| **Original** | Sin procesar (solo recorte y perspectiva) | Fotos, pruebas |

**Modo B/N puro para impresión** (Ajustes → Escaneo y cámara): opcional, apagado por defecto. Si se activa, *todos* los filtros terminan en blanco y negro exacto (como en la versión anterior).

### Algoritmo del filtro Documento (`docEnhance`)

1. **Iluminación**: se estima el fondo por bloques con interpolación bilineal (`removeShadows`) y se divide la imagen por ese fondo. Así se eliminan las sombras y los degradés.
2. **Balance de blancos del papel**: se toma el percentil 60 de cada canal entre los píxeles claros y se escala para que el papel quede neutro (sin amarillos).
3. **Clasificación por píxel**:
   - *Papel*: luminancia alta y poco croma → blanco puro `#FFFFFF`.
   - *Tinta neutra* (texto): curva tonal `lo=62 … hi=236`, γ = 1,15. El texto queda negro y se conservan los bordes suavizados, sin serrucho.
   - *Tinta de color* (croma ≥ 42): se oscurece levemente (×0,82) y se refuerza la saturación (×1,22). Así firmas y sellos quedan nítidos y en su color.
4. **Nitidez**: máscara de enfoque (`unsharpPro`).

Los umbrales se calibraron con los PDF de referencia (sellos ovalados tenues, firmas en birome azul, notas manuscritas). Las referencias se usaron solo localmente y **no se guardaron en el repositorio**.

### Ajustes manuales (editor)

Brillo, contraste, saturación, temperatura, nitidez, intensidad del filtro y, nuevos:

- **Sombras** y **Luces**: realce de tonos oscuros y claros.
- **Gamma**: −50 … +50, equivale a un exponente de 2 a 0,5.
- **Nivel de negro** y **Nivel de blanco**: niveles o curva de entrada.

Todos se aplican con una LUT de 256 entradas (`toneAdjust`), también en el Web Worker.

### Editor

- **◐ Antes/Después**: mantener apretado para ver el original.
- **↶ Deshacer / ↷ Rehacer**: historial por página de hasta 40 pasos (filtro, ajustes, giro, recorte y firmas).
- **Presets**: Judicial/oficio, Administrativo, Factura/recibo (papel térmico), Documento arrugado o con sombras, Foto/credencial, Ahorro de tinta. Además, los presets propios (*Guardar preset*).
- **Aplicar a todas**: copia el filtro y todos los ajustes a todas las páginas.

## OCR y PDF

- **PDF buscable**: la capa de texto usa **Liberation Sans** (SIL OFL 1.1), incrustada como subconjunto con **fontkit** (MIT). Antes se usaba Helvetica estándar (WinAnsi), que no puede codificar muchos caracteres. Ahora `ñ`, tildes, `“ ”`, `°` y `€` se copian y se buscan bien, sin bloques de números ni símbolos raros.
- Cada palabra se ajusta al ancho de su recuadro, para que la selección coincida con la imagen. El texto va invisible (opacidad 0), encima de la imagen.
- La fuente se incrusta **una sola vez** por PDF (antes se repetía en cada página).
- Tesseract (español) usa `preserve_interword_spaces=1`.
- **Calidad**: Alta pasa a 3000 px con JPEG 0,90 y Máxima a 4200 px con 0,95. Se agrega **Original (sin reducir)**, a resolución completa con 0,96.
- También exporta a PDF/A, JPG, PNG, Word y texto (herramientas existentes).
- **Límite**: la letra manuscrita se reconoce solo parcialmente; Tesseract está pensado para texto impreso.

## Cámara (`CamPro`)

- Al abrir la cámara se activan enfoque, exposición y balance de blancos continuos, si el dispositivo los ofrece.
- Cada 700 ms se analiza un cuadro reducido a 48×64, dividido en 12 celdas:
  - **Poca luz** (media < 70): aviso; en modo automático, se prende la linterna.
  - **Sombra** (diferencia entre celdas claras y oscuras > 70): aviso para mover la luz o el teléfono.
- **Nivel**: se usa `DeviceOrientation`. La burbuja se pone verde cuando el teléfono está paralelo al documento (±5°). En iPhone pide permiso al abrir la cámara.
- **Flash**: el botón rota apagado → encendido → automático; también se elige desde el panel ⚙.
- **Exposición (EV)**: control deslizante en el panel ⚙, con el rango que informa el teléfono.

## Rendimiento

- Los filtros pesados corren en un **Web Worker**, así la interfaz no se traba.
- La vista previa del editor se muestra primero a 760 px y después a 1800 px.
- El análisis de luz y sombra usa un cuadro de 48×64 cada 700 ms, con costo despreciable.

## Pruebas

`tests/app.test.js` (Playwright, Chromium) tiene 13 pruebas de extremo a extremo. Las nuevas para este módulo son:

- **Filtro Documento**: el papel queda blanco, el texto negro y se conserva la tinta azul. Con el modo B/N activo no queda color.
- **PDF buscable**: `Tucumán`, `“Expte.”`, `N°`, `Peñaloza` se extraen intactos y sin bloques de números.
- **Editor**: tono, deshacer/rehacer, presets y aplicar a todas.

Se corren solas en GitHub Actions (`.github/workflows/tests.yml`) en cada pull request.

## Compilación y despliegue

No hay compilación. Para probar localmente:

```bash
python3 -m http.server 8765        # en la carpeta del proyecto
cd tests && npm install && npx playwright install chromium && npm test
```

Despliegue: cada cambio en `main` se publica solo en Vercel. El service worker (`sw.js`) sube de versión para que los teléfonos instalados se actualicen.

## Licencias de lo agregado

- `libs/fontkit-1.1.1.umd.min.js`: MIT.
- `libs/fonts/LiberationSans-Regular.ttf`: SIL Open Font License 1.1 (ver `libs/fonts/LICENSE-LiberationSans-OFL.txt`).
