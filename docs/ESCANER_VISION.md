# Escáner en tiempo real (v73)

Danscanner Pro es una **PWA** (HTML + JavaScript, sin framework). Por eso no aplican VisionCamera, CameraX, AVFoundation, ML Kit ni VisionKit, que son APIs nativas que el navegador no expone.

En su lugar se usan los equivalentes web de alto rendimiento:

| Pedido nativo | Equivalente en la PWA |
|---|---|
| Frame processor fuera del hilo de UI | `Worker` dedicado (`mod/vision-worker.js`) |
| Buffer del frame sin copias | `requestVideoFrameCallback` + `createImageBitmap(video, {resizeWidth, resizeHeight})`, transferido al Worker (`postMessage(..., [bitmap])`) |
| OpenCV nativo | **OpenCV.js 4.10** (WASM, Apache-2.0), en `libs/opencv/`, opcional |
| Detector por deep learning (VisionKit / ML Kit) | No existe en el navegador. Se compensa con la envolvente convexa, el ajuste fino de lados y el puntaje por bordes (ver Pilar 1) |
| Torch y enfoque | `MediaStreamTrack.applyConstraints({advanced:[{torch}]})`, `focusMode` y `pointsOfInterest` |

## Archivos

| Archivo | Qué hace |
|---|---|
| `mod/vision-core.js` | Funciones puras: `detectDocument`, `orderCorners`, `destSize`, `blurScore`, `lumaStats`, `canny`, `approxPolyDP`, `refineQuad`, `torchDecision`, `captureAllowed`. También `VISION_CFG`, con todos los parámetros. |
| `mod/vision-worker.js` | Worker de la cámara. Motor `js` (por defecto) u `opencv`, y vuelta automática a `js` si OpenCV falla. |
| `index.html` (bloque v73) | `VisionEngine` (bucle, descarte de cuadros, marco interpolado a 30 FPS), `autoFocusFlash`, `correctPerspective`, `enhanceImage`, filtros nuevos, ajuste del motor y modo debug. |
| `libs/opencv/` | `opencv.js` 4.10.0 (10,4 MB; ≈3,4 MB comprimido) y su licencia Apache-2.0. Se descarga solo si el usuario lo activa. |

## Pilar 1: `detectDocument`

El pipeline es el siguiente:

1. El cuadro se reduce a **720 px de lado mayor**, fuera del hilo principal.
2. Gris → Gauss 5×5 → Canny(75, 200).
3. Se dilatan los bordes con un 3×3 para cerrar cortes.
4. Se buscan componentes conectados, equivalente a `findContours(RETR_LIST, CHAIN_APPROX_SIMPLE)`.
5. De cada componente se toma la **envolvente convexa** y se aplica `approxPolyDP` con 0,02 × perímetro, subiendo hasta 0,08 hasta que queden 4 vértices.
6. Se filtran los cuadriláteros: área entre 20 % y 98,5 %, convexo, ángulos entre 35° y 145°, lados ≥ 12 %.
7. La mancha clara (Otsu) siempre compite como candidata.
8. `refineQuad` ajusta cada lado al gradiente máximo cercano (recta por mínimos cuadrados) y corta las rectas, con precisión sub-píxel.
9. Se elige el candidato con mayor puntaje = área × proporción de los 4 lados que tienen borde real debajo.

Por qué la envolvente: un dedo o una sombra que muerde el borde crea una concavidad. La envolvente la puentea y el puntaje de bordes baja apenas.

**Casos límite probados** (`tests/app.test.js`, prueba «Escáner v73: lógica pura…»), todos con error de esquina ≤ 4 px:
- fondo oscuro
- sombra sobre media hoja
- dedo sobre el borde superior
- hoja girada 50°
- poca luz con ruido
- fondo de madera con textura
- sin documento: no inventa un marco

Medido en Node/Chromium de este servidor: ~15 ms por cuadro de 720×405 con el motor JS y ~8 ms con OpenCV. Un fondo con mucha textura sube a ~60–80 ms con el motor JS.

### Cómo ajustar los parámetros (`VISION_CFG`)

| Parámetro | Valor | Subirlo… | Bajarlo… |
|---|---|---|---|
| `analysisMaxSide` | 720 | más precisión en hojas chicas, más ms | más FPS en celulares lentos (480 sigue andando bien) |
| `blur` | 5 | menos grano y menos bordes falsos | bordes más finos |
| `cannyLo` / `cannyHi` | 75 / 200 | menos bordes de textura (fondos de madera o tela) | detecta hojas con poco contraste contra el fondo |
| `minAreaFrac` | 0,20 | ignora hojas lejanas | detecta tarjetas o hojas chicas |
| `approxEps` | 0,02 | acepta bordes más curvos (libros) | esquinas más exactas |
| `minAngle` | 35° | rechaza perspectivas extremas | acepta hojas muy inclinadas |
| `minSupport` | 0,45 | menos marcos falsos | tolera más oclusión (dedos) |
| `lowLuma` / `lowLumaOff` | 70 / 95 | flash más fácil | flash solo con mucha oscuridad |
| `blurMin` | 60 | exige más nitidez para auto-capturar | dispara antes |
| `minLongOut` | 2000 | más calidad OCR, más memoria | PDFs más livianos |

Para probar valores sin publicar, guardá en `S.visionCfg` un objeto con los campos a cambiar (se manda al Worker al abrir la cámara).

## Pilar 2: `correctPerspective`

- Ordena las esquinas como TL, TR, BR, BL (`orderCorners`, por ángulo alrededor del centro). Funciona con giros de más de 45°.
- El tamaño de destino es el mayor de los lados opuestos (`destSize`). Si la foto lo permite, el lado mayor queda en ≥ 2000 px: se agranda hasta 2× y nunca en miniaturas ni vistas previas.
- Se mantiene la corrección de proporción A4, Carta u Oficio (v61) y el muestreo 2×2 de `warpTo`.
- Se hace sobre la foto en resolución completa (ImageCapture / HD), no sobre el cuadro de 720 px.

## Pilar 3: `enhanceImage`

Hay tres filtros nuevos, en «más filtros»:
- **Nítido OCR** (`ocr`):
  - CLAHE (clip 2,0, grilla 8×8) sobre la luminancia;
  - gamma adaptativa según la media del histograma (0,75–1,25);
  - el papel (percentil 99) llevado a blanco;
  - máscara de enfoque suave (cantidad 0,6, radio 1).
  
  El color se conserva escalando R, G y B por el cambio de luminancia. Equivale a trabajar el canal L de LAB y es 3–4× más rápido que convertir a LAB.
- **Gris OCR** (`ocrgris`): lo mismo, en escala de grises.
- **B/N adaptativo** (`bnad`): umbral gaussiano con blockSize 11 y C = 2, igual a `cv.adaptiveThreshold(ADAPTIVE_THRESH_GAUSSIAN_C)`.

Corren en el Worker de filtros que ya existía (`FW`), así que no traban la interfaz.

## Pilar 4: `autoFocusFlash`

- **Flash** (modo Automático): usa la luminancia media del cuadro calculada en el Worker, con histéresis (se prende < 70 y se apaga > 95), así no parpadea. Además, deja pasar al menos 700 ms entre cambios.
- **Re-enfoque**: cuando la hoja cambia de lugar y queda quieta más de **300 ms**, enfoca una vez en su centro. Usa `focusMode: 'single-shot'` y `pointsOfInterest` y después vuelve a `continuous`.
- **Bloqueo por desenfoque**: la auto-captura espera hasta que la varianza del laplaciano dentro de la hoja supere `blurMin`. Una hoja casi en blanco (desvío < 10) no se bloquea porque no tiene textura para medir. A mano se puede disparar igual, y la foto movida se sigue descartando después (v58).

## Permisos

Al ser una PWA no hay Podfile, build.gradle ni Info.plist. Hace falta:
- **HTTPS**: Vercel ya lo da. Sin HTTPS, la app usa la cámara del sistema (`NativeCam`).
- **Encabezados** (ya están en `vercel.json`):
  - `Permissions-Policy: camera=(self)`
  - la CSP con `worker-src 'self' blob:` y `script-src 'wasm-unsafe-eval'` (OpenCV.js necesita WASM).
- **Linterna**: la expone Chrome en Android con `torch`. Safari en iOS no permite la linterna desde la web: el botón se oculta o avisa.
- **Navegadores**:
  - Chrome Android 92+ y Safari iOS 15.4+ tienen `requestVideoFrameCallback`.
  - Si falta, se usa `requestAnimationFrame`.
  - Sin `OffscreenCanvas` o sin `Worker`, se usa el detector anterior en el hilo principal.

## Modo debug

Se activa con `?debug=cam` en la dirección, o con `S.camDebug = true`. Muestra:
- el motor;
- FPS de detección y tamaño del cuadro;
- ms por etapa (gris, gauss, canny, contornos, total) y promedio;
- luz (media, p5, p95), nitidez, desvío y % de bordes;
- tiempo medio del warp;
- memoria pico (solo Chrome);
- estado del flash y cantidad de re-enfoques.

También dibuja en rojo punteado el contorno crudo, sin suavizar.

## Checklist de rendimiento

| Métrica | Antes (v72) | Ahora (v73) | Cómo se mide |
|---|---|---|---|
| Bloqueo del hilo de UI por detección | 48 ms mediana, 211 ms p90 | **0,1 ms** | `Cam.detect` cronometrado (prueba e2e: < 10 ms) |
| Frecuencia de detección | ~4 Hz (cada 240 ms) | cada cuadro de video que el Worker puede tomar (sin cola) | `VisionEngine._fps` (debug) |
| Costo por cuadro en el Worker | — | ~15 ms (JS) / ~8 ms (OpenCV) a 720×405 en este servidor | `r.t.total` |
| Marco en pantalla | saltos cada 240 ms | 30 FPS interpolado | `VisionEngine.animate` |
| Asignaciones en el bucle | canvas nuevo por tick | buffers reusados (`B`), matrices de OpenCV reusadas y liberadas con `.delete()` | código |
| Carga de OpenCV | — | en el Worker, sin bloquear el primer cuadro (mientras carga sigue el motor JS) | debug: «cargando OpenCV» |

Meta en gama media: **≥ 24 FPS de detección**. Con ~15 ms por cuadro en un servidor, un celular de gama media debería quedar en 25–40 ms, es decir 25–40 FPS. Se confirma en el celular con `?debug=cam`.
