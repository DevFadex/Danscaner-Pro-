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

## Motor de imagen tipo escáner (v32)

Se calibró contra el PDF que el usuario hizo con CamScanner. Mediciones de esas páginas:

- resolución completa del sensor (~2300-3000 × 4032);
- papel en blanco puro (mediana 255);
- texto casi negro (luminancia mediana entre 5 y 8);
- birome azul saturada (≈ RGB 45, 45, 135);
- solo un 3-4 % de medios tonos: bordes suaves, sin serrucho.

**Método de calibración**: a partir de esas páginas se generaron fotos simuladas con papel amarillento, degradé, una sombra con borde definido, tinta más clara, desenfoque, ruido y JPEG. Esas fotos se pasaron por el motor y el resultado se comparó con el PDF de CamScanner. Los valores elegidos para Magia Pro son `bpk .95`, `wp 220`, `γ 1,2`, `sat 1,75` y `mix .52`. Con ellos:

| | Antes (Documento) | Magia Pro nueva | CamScanner |
|---|---|---|---|
| Papel ≥ 245 | 95,5 % | 97,7 % | 100 % (referencia) |
| Luminancia del texto negro | 95 | 9 | ~6 |
| Medios tonos | 8,4 % | 3,9 % | 3,9 % |

**`flatField`** (reemplaza a `removeShadows` en los filtros de documento): estima el fondo por canal en una grilla fina, de alrededor de 220 bloques por el lado largo (antes eran 8 × 8). Aplica un cierre morfológico para ignorar las letras y un suavizado, y después divide cada canal por ese fondo. Así se van las sombras, los degradés y el tono amarillo del papel, y se distinguen los bordes de sombra definidos.

**`csEnhance`**: toma el punto negro adaptativo a partir de la mediana de la tinta de la hoja. Lleva el papel a blanco puro y aplica una curva γ para que el texto quede negro con bordes suaves. La tinta de color (croma > 10) conserva su tono con más saturación, así las firmas y los sellos azules siguen siendo azules.

**Tira de filtros** (como CamScanner): Original · **Magia Pro** (por defecto) · Mejorar · Aclarar · Color mágico · Sin sombras · Gris · B/N · Ahorro de tinta. Los demás filtros están en **Más filtros**. *Documento* es un alias de Magia Pro, para mantener la compatibilidad.

Si la imagen no parece un documento (por ejemplo, una foto), cada filtro usa su versión para fotos.

### Ajuste v33: birome azul y resolución (comparación con la planilla de asistencia)

Con los PDF reales del usuario (la misma planilla escaneada con Danscanner y con CamScanner):

- **Birome azul**: en Danscanner quedaba pálida y cortada (RGB medio 146, 148, 199), y en CamScanner, marcada (115, 113, 186). Ahora la tinta de color usa su propia curva (`cbp`, `cwp`, `cg`) y se oscurece como tinta, no como papel. Solo se considera papel si el croma es bajo (`pc`). Resultado en la simulación: luminancia del azul de 181 a ~139 en Magia Pro, y a ~132 en Mejorar.
- **Resolución**: la foto de Danscanner medía 1516 × 1933 y la de CamScanner 2190 × 3040. `hiResPhoto` pide a `ImageCapture` la resolución máxima del sensor (`getPhotoCapabilities`). Si el teléfono no entrega la foto HD, se avisa una vez y se sugiere usar la cámara nativa.

### Ajuste v24: color de la birome reconstruido y calidad máxima

- **Color local de la tinta**: las cámaras guardan el color con menos detalle que el brillo (croma submuestreada y suavizada), así un trazo fino de birome azul llega casi gris. `csEnhance` promedia el color de la tinta vecina en una grilla de unos 1400 px, ponderado por lo oscura que es cada muestra. Si el color local es de una tinta real (azul, violeta o rojo), lo usa en el píxel y lo refuerza hasta un croma mínimo (`lc`, `lmin`, `amax`). El amarillo o marrón que queda del papel no se refuerza, así el texto negro no se tiñe.
  Simulación con croma diluida: el azul conservado pasó del 2,5 % al 35 %. En fotos normales, del 60 % al 86 %.
- **Calidad máxima por defecto**: migración única que pone `maxCap` en 4200 y activa Foto HD.
- **Actualización**: al volver a la app se busca una versión nueva. Cuando se instala, la app se recarga sola si no hay nada abierto; si hay algo abierto, avisa. En Ajustes se muestra la versión.

### Ajuste v25: calibración con la foto real del usuario y enderezado sin cuñas

- Con la foto real de la planilla (filtro Original), Magia Pro deja un 0,70 % de píxeles azules, con mediana RGB 103, 112, 186. CamScanner deja un 0,73 %, con mediana 115, 113, 186. Valores: `sat 2,5` y `cg 1,9` (Mejorar: `sat 2,1` y `cg 2,2`).
- **Hoja "cruzada" en el editor**: después del recorte de 4 esquinas, la app volvía a girar la imagen unos grados (`deskewAngle`) y expandía el lienzo con cuñas blancas. Ahora:
  - si la página tiene recorte de 4 esquinas, no se vuelve a girar, porque el recorte ya la deja derecha;
  - si se gira (una página sin recorte), se recorta el rectángulo interior (`cropInscribed`) y no quedan esquinas blancas.

## Captura estilo escáner (v21)

Comparación con el flujo de las apps de escaneo comerciales, como CamScanner, y lo que se incorporó:

| En CamScanner | En Danscanner |
|---|---|
| Vista previa a pantalla completa | `object-fit: cover`: la vista previa ocupa toda la pantalla |
| Marco en vivo con puntos en las esquinas | Marco celeste con esquinas; se pone **verde** cuando la hoja está quieta |
| Auto-captura al quedar estable | En cualquier modo (antes solo en Lote). Después de capturar **espera la hoja siguiente**, para no repetir la misma página |
| Tipos de captura | **Documento · Libro · DNI / Tarjeta · Pizarra** |
| Libro: separa las dos páginas | Busca el lomo (la columna más oscura cerca del centro) y crea dos páginas |
| Bordes exactos | `refineQuad`: ajuste fino sobre la foto completa (ver abajo) |
| Recorte con manijas en esquinas y lados | Se agregaron las manijas en la mitad de cada lado |
| Limpieza de bordes | `cleanEdges`: restos oscuros de la mesa en la franja exterior (2,2 %) → blanco |

**`refineQuad`**: la detección rápida trabaja a 360 px, por eso las esquinas quedaban hasta unos 35 px corridas en una foto de 12 MP. Con la foto a 1400 px:

1. Para cada lado se toman unos 40 puntos.
2. En cada punto se busca, a lo largo de la perpendicular, el primer salto fuerte de oscuro (mesa) a claro (papel).
3. Se ajusta una recta por mínimos cuadrados totales, descartando los puntos que se alejan de la recta.
4. Las esquinas son las intersecciones de esas rectas.

Resultado: error de 2 a 3 px. Si falta contraste, se mantiene la detección original.

## Datos del documento

Botón **🪪 Datos** en la barra del documento. Si el documento todavía no tiene texto, primero lo lee con OCR (en el teléfono). Después muestra, listos para copiar:

- personas: incluye el formato `APELLIDO, Nombre`;
- DNI: se normaliza a `30.123.456`;
- CUIL/CUIT: se valida el dígito verificador y, si no coincide, aparece **⚠ revisar**;
- expedientes y actuaciones;
- fechas: se normalizan a `dd/mm/aaaa`;
- montos, teléfonos y correos.

**Corrección de OCR (`ocrFixNums`)**: dentro de grupos que ya son casi todo dígitos, se corrigen las confusiones típicas `O→0`, `l/I→1`, `S→5`, `B→8` y `Z→2`. También `N*` pasa a `N°` y `D.N.l` a `D.N.I.`. Las palabras no se tocan. La corrección se aplica también a Nexa y al nombre y la carpeta automáticos.

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

`tests/app.test.js` (Playwright, Chromium) tiene 19 pruebas de extremo a extremo. Las nuevas para este módulo son:

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

## v34 · Corregir texto del documento

En el editor, **Corregir** permite arreglar una palabra mal escrita de la hoja escaneada (por ejemplo «livertad» → «libertad») dejando el resto del documento como estaba.

- **Buscar** la palabra (la app lee el texto con OCR) o **Marcar a mano** pasando el dedo; el recuadro marcado se ajusta solo a la tinta.
- La palabra se tapa con el color del papel de alrededor (mezcla de los cuatro lados, con grano y bordes difuminados) y el texto nuevo se escribe con el **color de la tinta** detectado, el **mismo alto** de letra y la misma línea de base.
- Opciones: letra Arial / Times / Máquina, negrita, tinta automática / negra / azul, tamaño A− / A+, «Solo borrar» y «Corregir las N» cuando la misma palabra aparece varias veces.
- No es destructivo: cada corrección se guarda en `p.fixes` (proporciones de la página) y se dibuja al final de `renderPage`, así funciona con cualquier filtro y resolución y se puede **deshacer** con el deshacer del editor.

## v36 · Corregir palabras en «Editar PDF» y zoom

- En **Herramientas → Editar PDF**, cada página tiene el botón **Corregir** (o se toca la miniatura) y abre la misma pantalla de corrección del editor sobre esa página (renderizada a 2,5×).
- Cada corrección se agrega al PDF como un parche de imagen solo en la zona de la palabra; el resto de la página queda igual (si el PDF tiene texto digital, sigue siendo texto).
- **Zoom**: en Corregir, con dos dedos, rueda + Ctrl o los botones − / +; en **Colocar** (firma, texto, fecha, tapar, recortar) con dos dedos, rueda o − / +, y con un dedo se mueve la hoja cuando está ampliada. El zoom no cambia la posición ni el tamaño guardados.

## v37 · Corregir con la misma letra y varias palabras

- **PDF con texto digital**: se leen las palabras del archivo (sin OCR, funciona sin internet) con su posición exacta, la familia de letra (Times / Arial / Courier), negrita, cursiva y el tamaño en puntos. La corrección usa esos datos.
- **Escaneos y fotos**: la palabra se compara con Arial, Times y Máquina en normal, negrita y cursiva (`fixDetect`), y se elige la que mejor coincide. Se muestra «Letra detectada: … · ≈12 pt» y se puede cambiar.
- **Varias palabras**: buscar la frase («frias alberto tomas») o tocar la primera y la última palabra del renglón. La puntuación pegada (coma, punto, paréntesis) queda afuera y no se toca.
- **Espaciado**: se mide el ancho real de la letra en el documento (`sx0`) y la palabra nueva se escribe con el mismo espaciado.
- **Acomodar renglón** (activado por defecto): si la palabra nueva es más corta o más larga, el resto del renglón se corre para que no quede hueco ni se superponga.
- Al correr el renglón, lo que queda libre al final se rellena con el papel de arriba y de abajo (`fixFillCols`), así sigue el degradé de la hoja. En los escaneos, la caja de las palabras se vuelve a medir sobre la tinta, así la cola de una coma no agranda la letra.

## v38 · Nexa más rápida y más interactiva (Nexa 3.4)

- **Velocidad**
  - Gemini responde en **modo rápido**: `thinkingBudget:0` en 2.5 Flash y `thinkingLevel:'low'` en Gemini 3. Si el modelo no lo admite, se reintenta en modo normal.
  - Apenas se abre Nexa, la app se conecta al servidor de la IA (`preconnect`).
  - La IA local recibe solo las partes del documento relacionadas con la pregunta (`nxRelevant`): 2200 caracteres en modo procesador y 5000 en modo placa. En modo procesador se usan menos mensajes previos y no se incluyen ejemplos, así responde mucho antes y no se pasa del contexto.
  - El formato de los mensajes se memoriza, así la pantalla se redibuja más rápido.
- **Interacción**
  - Mientras responde se muestra qué está haciendo y los segundos que lleva.
  - Botones «Otra respuesta» y «Editar» (la última pregunta).
  - Sugerencias mientras escribís.
  - Botón para volver al final de la conversación.
  - Vibración corta al terminar de responder.
- **Conversaciones**: se guardan solas y se ven con el botón del reloj. Se pueden buscar, abrir y borrar. «Nueva conversación» guarda la anterior en lugar de borrarla.

## v39 · Nexa local nunca deja esperando (Nexa 3.5)

- En modo **Nexa local**, los saludos («hola», «gracias», «¿qué podés hacer?») se responden al instante con el modo básico.
- Si el modelo todavía no está cargado en la memoria del teléfono, la pregunta la responde el modo básico con un aviso, y el modelo se carga en segundo plano. Las siguientes preguntas ya las responde la IA local.
- Si el modelo no está descargado, responde en modo básico y ofrece «Descargar Nexa local».

## v40 · Diseño para computadora

- En pantallas de 1024 px o más aparece un **menú lateral** a la izquierda (marca, botón «Escanear», Inicio, Documentos, Herramientas, Ajustes) en lugar de la barra de abajo. El contenido usa todo el ancho, hasta 1560 px.
- Las grillas se adaptan: herramientas en columnas automáticas y botones del inicio más grandes.
- Nexa queda al lado del menú, más ancha (980 px), y ajusta su alto sin la barra de abajo.
- Todo está dentro de `@media (min-width:1024px)`: **en el celular no cambia nada**.

## v41 · Lo guardado para usar sin internet sobrevive a las actualizaciones

- **Antes:** al publicarse una versión nueva, el service worker borraba **todas** las cachés. Se perdían las herramientas guardadas (idioma del OCR, pdf.js, pdf-lib, Tesseract, Word/Excel, wllama) y también **el modelo descargado de Nexa local** (cachés `webllm/*`). «Actualizar la app» y «Limpieza rápida» hacían lo mismo.
- **Ahora:**
  - Las herramientas se guardan en una caché permanente (`danscaner-libs`) que no depende de la versión.
  - Al actualizar solo se borra la copia vieja de la app (`danscaner-vNN`), y lo que había en ella de herramientas se pasa a la caché permanente.
  - «Actualizar la app» solo borra las copias de la app.
  - «Limpieza rápida» solo borra las cachés de Danscanner. El modelo de Nexa local se borra únicamente desde Nexa, con «Borrar modelo».
