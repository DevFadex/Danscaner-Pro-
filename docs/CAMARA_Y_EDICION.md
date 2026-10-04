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

## v42 · Revisión completa, OCR incluido en la app

- **Revisión automática** de las 37 herramientas con archivos de prueba (PDF, foto, Word, Excel, PowerPoint, texto): todas generan su resultado. También se revisaron Ajustes, el inicio, todos los botones del editor, la cámara, Documentos y Nexa.
- **Lector de texto (OCR) incluido**: `libs/tesseract/` (worker, motor LSTM con y sin SIMD, idioma español `best_int`; Apache-2.0). Antes se bajaba de un CDN la primera vez, y sin internet fallaba la cámara (nombre automático), Corregir, OCR y Extraer texto con un error técnico en inglés. Ahora funciona sin internet y se guarda en la caché permanente.
- **Mensajes claros** cuando algo necesita internet, en lugar de errores técnicos.
- **Repetido**: «Firmar PDF» era una versión reducida de «Editar PDF» con otro código. Ahora abre el mismo editor completo. El nombre queda en el menú.

## v43 · Detección de la hoja nueva, tamaño A4/oficio/certificado y borrar la foto en la cámara

- **Detector nuevo** (`docQuad2`), para la foto final y la vista en vivo:
  - busca líneas rectas con Hough, usando la orientación del gradiente;
  - descarta o resta peso a los trazos finos (renglones y líneas de tabla) y busca por separado las líneas verticales y las horizontales;
  - puntúa cada cuadrilátero posible por bordes marcados en los 4 lados, contraste hoja/mesa, área y proporción de hoja (A4, oficio, carta);
  - después se ajusta con `refineQuad`; si no encuentra nada, usa el detector anterior.
- **Resultados** en escenas simuladas (hoja sobre madera, gris, beige o azul, con perspectiva, sombras, tablas y otro papel detrás), medido con IoU contra el recorte real:

  | Detector | IoU promedio | Malas (< 0,9) |
  | --- | --- | --- |
  | anterior | 0,61 | 54 de 80 |
  | nuevo | 0,93 | 13 de 80 |

  Los errores del PDF de muestra (tomar solo una tabla interna, dejar parte de la mesa o de otra hoja) son justamente los que corrige.
- **Tamaño de hoja «Automático»** (nuevo predeterminado):
  - si la foto tiene forma de A4, la página sale A4 exacta (210 × 297 mm);
  - si tiene forma de oficio, sale oficio (216 × 356 mm);
  - si tiene forma de carta, sale carta;
  - si no coincide con ninguna, respeta la proporción de la foto.

  En el editor, el botón **Hoja** permite elegir para cada página, o para todas: A4, Oficio, Carta, Certificado A5 (148 × 210 mm) o Tamaño de la foto.
- **Modo Certificado** en la cámara: las páginas salen en A5, su tamaño real, sin agrandarse a A4.
- **Borrar la foto en la cámara:**
  - en **Individual**, después de la foto aparece una revisión con Repetir, Agregar más (pasa a lote) y Listo;
  - en **Lote**, el botón «Borrar última».
- **Enderezado**: ya no se inventa una inclinación en hojas casi vacías. Antes una hoja en blanco se giraba 6° y cambiaba de proporción.

## v44 — Certificado centrado en hoja A4

- El modo **Certificado** de la cámara ahora arma una hoja **A4 blanca** con el certificado en su tamaño real (dentro de 148 × 210 mm, sin agrandar ni deformar), centrado. Si el certificado es apaisado, la hoja A4 sale acostada.
- En el editor, **Hoja → Certificado centrado en hoja A4** aplica lo mismo a cualquier página. También está en Ajustes y en Exportar.
- Las páginas guardadas antes como **Certificado (A5)** siguen saliendo en A5, y esa opción sigue disponible.

## v45 — Nexa en dos modos, detener que siempre corta y enseñarle a Nexa

- **Dos modos** en el menú de Nexa (antes eran «gratis», «local» y «básico»):
  - **Nexa sin internet**: gratis y privada. Usa la IA del teléfono si está descargada; si no, el modo rápido (datos, resúmenes y búsquedas al instante). Para sacar datos de un documento usa siempre el modo rápido.
  - **Nexa con internet**: Gemini gratis o la clave que tengas cargada. Si no hay conexión, responde sin internet.
  - Las conversaciones viejas pasan solas al modo que corresponde.
- **Detener (■)**: corta siempre, también mientras Nexa lee un escaneo sin texto (el OCR se cancela) o mientras prepara la IA. Lo que termine después en segundo plano ya no aparece en la conversación. La lectura avisa página por página, dentro de la conversación.
- **Enseñar a Nexa**: en el chat («si te preguntan horario de visitas, respondé de 9 a 12») o en ⚙ Configurar Nexa → Enseñar a Nexa (agregar, ver, borrar, guardar y cargar un archivo `.json`). Lo enseñado se usa en los dos modos y queda solo en el teléfono. Trae de base respuestas sobre cómo usar la app.

## v46 — Análisis del documento

- En Nexa (adjuntar el documento y pedir «analizá el documento», o la sugerencia **Analizar escaneo**) y en el editor (botón **Analizar**) sale un informe:
  - documento, formato aproximado (A4 / oficio / carta / otro), perspectiva, iluminación, sombras, nitidez, texto detectable y calidad estimada del OCR (con resolución aproximada en ppp);
  - recomendaciones concretas (repetir la foto de frente, más luz, filtro B/N, HD, enfoque).
- Se mide en el teléfono, sin internet, y **no modifica** el documento.
- Cómo se mide: bordes y ángulos de las esquinas (perspectiva), tono del papel en una grilla de 8 × 8 (luz y sombras), pendiente de los bordes de las letras (nitidez) y ancho de la hoja en píxeles (resolución).

## v47 — Base de conocimiento con fuentes, OCR con confianza y permiso antes de enviar documentos

- **Base de conocimiento** en `knowledge/` (versión en `knowledge/knowledge-version.json`): manual, herramientas, Nexa, buen escaneo, tamaños de hoja, OCR, PDF y solución de problemas. Solo describe funciones que existen en la app.
  - Se divide por secciones (`##`) y se busca por palabras (BM25 con raíces de palabras y sinónimos). Es instantáneo y no usa internet: los archivos se guardan para usar sin conexión.
  - Sin internet, Nexa responde con la sección y la etiqueta **✅ Confirmado · fuente: …**. Si no hay información, dice **⚪ No tengo información confirmada**.
  - La IA con internet o la del teléfono recibe las secciones que corresponden. La etiqueta la pone la app: ✅ si la respuesta sale de la guía, 🟡 si pregunta por la app y no figura.
  - Al subir el número de versión, la app vuelve a indexar sola.
  - **Para agregar conocimiento de la oficina**: crear `knowledge/oficina/<tema>.md` con secciones `##`, sumarlo a `archivos` en `knowledge-version.json`, subir la versión y agregarlo a la lista del service worker (`sw.js`). Nunca incluir datos de personas: la app es pública.
  - Preguntas doradas en `tests/fixtures/preguntas-doradas.json`, que la prueba e2e verifica.
- **OCR con confianza**: al extraer el texto se muestra la confianza media de la lectura y se marcan en amarillo las palabras con menos del 70%. El botón **Quitar marcas** las saca antes de exportar.
- **Privacidad**: con internet, Nexa pide permiso antes de enviar cada documento adjunto a la IA. La otra opción es responder sin internet. Se puede desactivar en ⚙ Configurar Nexa → Privacidad.
- **Seguridad**: se avisa a la IA que el texto de los documentos es solo información y que no debe seguir instrucciones escritas dentro de ellos.
- **Voz**: el micrófono quedaba bloqueado por la política de permisos (`vercel.json`, `microphone=()`) y ahora está permitido para la app (`microphone=(self)`). El dictado se activa o desactiva en ⚙ Configurar Nexa → **Dictar por voz**; leer las respuestas en voz alta se maneja aparte.

## v48 — Voces de Nexa, estilos de imagen, leyes y comandos rápidos

- **Voces**: tres perfiles (Clara, Grave, Neutra) que eligen voces distintas en español del teléfono, o cambian el tono si hay una sola. Nexa lee por frases, así que la **velocidad** (0,6× a 2×), la **pausa** y la voz se cambian mientras habla, desde la barra que aparece sobre el cuadro de texto o desde ⚙ Configurar Nexa → Voz.
- **Estilos artísticos** (editor → **Estilo**): Animado (caricatura), Relieve 3D, Anaglifo 3D, Minimalista y Boceto a lápiz. Se aplican al mostrar y exportar la página; la foto original no se toca.
- **Leyes** (`knowledge/leyes/`, ver `tools/leyes/README.md`): textos oficiales de InfoLeg separados por artículo. Nexa responde el **artículo exacto** con la fuente y la fecha, busca **por tema** y muestra los **artículos relacionados**, calculados con un grafo de **graphify**. Con internet, la IA recibe los artículos para citarlos. Si los códigos no están cargados, lo avisa.
- **Comandos rápidos**: escribir «/» en Nexa muestra /articulo, /ley, /resumir, /datos, /analizar, /redactar, /corregir, /explicar, /buscar y /ayuda.

## v49 — Códigos cargados (InfoLeg)

- Textos oficiales descargados de InfoLeg el 29/09/2026 y separados por artículo con `tools/leyes`:
  - Código Penal de la Nación, Ley 11.179, texto actualizado: 389 artículos.
  - Código Procesal Penal Federal, Ley 27.063, texto ordenado por el Decreto 118/2019, Anexo I: 397 artículos. InfoLeg no publica un texto actualizado de este código; es el texto ordenado de 2019.
  - Código Procesal Penal de la Nación (anterior), Ley 23.984, texto actualizado: 572 artículos.
  - Ley 24.660 de Ejecución de la Pena, texto actualizado: 242 artículos.
- Grafo de graphify con 1600 artículos y 551 remisiones entre artículos de una misma norma. Se descartan las notas de modificación de InfoLeg y las menciones a otras leyes.
- Se precargan para usar sin internet, alrededor de 1 MB.

## v50 — Normas provinciales: Ley 9.914 y Resolución 905/19

- **Ley 9.914** (Tucumán, 2025): ratifica el Decreto Acuerdo 7/7 (MS) del 26/08/2025, el nuevo régimen del Servicio Penitenciario Provincial, y deroga la Ley 4.611. Son 193 artículos, con capítulo y sección.
- **Resolución 905/19 DGSPPT**: el Reglamento General para sumarios disciplinarios de internos, Anexo 1. Son 44 artículos, con sección.
- Las dos se transcribieron a mano desde copias escaneadas que dio el usuario, página por página contra la imagen. El texto está en `tools/leyes/transcripcion/`. Nexa las cita con esa aclaración y recomienda verificar contra el original ante cualquier duda.
- `tools/leyes/fuentes.json` admite fuentes con `"transcripcion"`. Los títulos de sección que quedan sueltos en esos textos se pasan como sección del artículo siguiente.
- Arreglo de paso: los encabezados de libro, título y capítulo ya no toman renglones partidos del texto de un artículo.

## v51 — Varias páginas a la vez y visor con zoom

- **Documento → ☑️ Seleccionar**: se tocan las páginas para marcarlas, o se usa Todas / Ninguna. Con las marcadas se puede:
  - 🗑 Borrar varias juntas, con **↶ Deshacer**. No deja borrar todas.
  - ↻ Girar.
  - 📄 Extraer a un documento nuevo, sin tocar el original.
  - 🔍 Verlas con zoom.
- **Visor con zoom** (🔍 Ver / Zoom en el documento, 🔍 en el editor de página y en cada página de Editar, Censurar y Recortar PDF):
  - Pellizco, rueda del mouse, doble toque (acerca al 250 % donde se toca, otro doble toque vuelve).
  - Arrastrar para moverse, deslizar para pasar de página, botones − ＋ ⤢ y flechas del teclado. Hasta 600 %.
- **Editar PDF → 🗑 en cada página** marca las páginas que se van a borrar. También se puede escribir un rango (ej. `2-5,9`) → Marcar. Se quitan al guardar, junto con las demás ediciones.
- **Documentos → Seleccionar → Todos** marca todos los documentos visibles para borrarlos, unirlos o bajarlos juntos.
- **Corregir texto**: ya copiaba letra, tamaño, negrita y color, y corría el resto del renglón. Ahora, si la palabra nueva es más larga y el renglón no tiene lugar para correrse entero, se corre lo que entra y la palabra se angosta apenas lo justo. Antes quedaba toda comprimida.

## v52 — Panel de administrador: cuentas y contraseñas

- **Mi cuenta**, arriba del panel: muestra tu nombre y tu **usuario para entrar** (el correo). Tiene ✏️ Cambiar mi nombre y 🔑 Cambiar mi contraseña.
- **La contraseña no se puede ver**, ni la propia ni la de otros. Supabase la guarda cifrada (hash) y nadie puede leerla, tampoco el administrador. Por eso existe la opción de poner una nueva.
- **Crear cuenta con usuario y contraseña**:
  - El administrador carga nombre, correo, contraseña (🎲 propone una segura) y rol.
  - La cuenta queda activa y la pantalla muestra usuario y contraseña **una sola vez**, con Copiar y Enviar.
  - Se crea con un cliente de Supabase aparte y sin guardar sesión, así el administrador no pierde la suya.
  - Si Supabase tiene activo "Confirm email", la persona tiene que tocar el enlace del correo antes de entrar.
- **Ficha de cada usuario**: muestra el usuario para entrar, ✏️ Cambiar nombre y 🔑 Enlace para nueva contraseña (llega por correo).
- **Ajustes → 🔑 Cambiar contraseña**: cualquier usuario con sesión iniciada puede cambiar la suya.
- **Arreglo**: el enlace de "Olvidé mi contraseña" iniciaba sesión pero no pedía la contraseña nueva. Ahora abre la pantalla para ponerla.

## v53 — Versión pública para los usuarios

- Los usuarios ven **versión 1.2** en Ajustes y en Nexa. El número está en `PUBLIC_VER`, en `index.html`, y se cambia a mano solo cuando se decide anunciar una versión nueva para todos.
- El administrador (rol admin y activo en Supabase) ve la versión interna (`BUILD`), que cambia con cada modificación, y la aclaración "los usuarios ven 1.2".
- Se quitó el número fijo del pie de Ajustes. De ahora en más, en cada versión se actualizan `BUILD`, `APP_VER` y `VERSION` en `sw.js`.

## v54 — Nexa más grande en la PC

- En pantallas de 1024 px o más, Nexa agranda todo:
  - Letra de las respuestas a 18 px y burbujas más amplias.
  - Botones de sugerencia y de acciones más grandes.
  - Cuadro de texto más alto: crece hasta el 45 % de la pantalla.
  - La conversación usa más ancho, hasta 1240 px.
- En el celular no cambia nada.

## v55 — Compartir a Danscanner y nombre automático más completo

- **Compartir desde otra app** (WhatsApp, galería, correo, Archivos): el menú Compartir muestra **Danscanner** y lo compartido entra como documento nuevo. Acepta fotos y PDF, uno o varios.
  - `manifest.webmanifest` declara `share_target`: POST multipart, campo `files`.
  - `sw.js` recibe el POST, guarda los archivos un momento en la caché `danscaner-share` y abre `./?shared=1`.
  - La app los importa con `importShared()` y borra esa caché.
  - Requisitos: Android con Chrome o Edge y la app instalada en la pantalla de inicio. iPhone no permite que las apps web aparezcan en el menú Compartir.
- **Nombre automático**: además de tipo, expediente y fecha, ahora suma:
  - El número del oficio, nota o resolución, por ejemplo "Oficio N° 1234/26".
  - Quién lo manda, por ejemplo "Juzgado de Ejecución Penal de la II Nominación". Solo toma nombres propios: en "informa al Juzgado que…" no inventa nada.
  - Se aplica al cerrar el documento si todavía tiene el nombre por defecto.
  - Ahora también funciona sin internet, con el OCR incluido en la app.

## v56 — Estilos de imagen profesionales

- **10 estilos**: Animado, Cómic, Óleo, Acuarela, Boceto a lápiz, Minimalista (plano), Relieve 3D, Blanco y negro cine, Vintage y Anaglifo 3D.
- **Técnica** (todo en el teléfono, sin internet):
  - Filtro guiado: suaviza piel y fondos sin borrar bordes ni formar bloques.
  - Kuwahara: pinceladas del óleo y formas planas del minimalista.
  - Cuantización del brillo que conserva el color: la piel no queda gris.
  - Líneas finas por diferencia de gaussianas, trama de puntos para el cómic, iluminación por relieve, grano, viñeta y curva de contraste.
- **Se adapta a la foto**:
  - Corrige los niveles de luz antes de convertir.
  - Detecta si es un documento y usa un suavizado más leve para que el texto siga legible.
  - Las fotos de más de 1400 px se procesan reducidas y vuelven a su tamaño, así no se tilda el teléfono.
- **Intensidad** Suave, Normal o Fuerte. Las miniaturas se regeneran al cambiarla y se guarda por página (`p.artK`).
- Las páginas con los estilos anteriores siguen funcionando: los nombres internos `cartoon`, `relief`, `anaglyph`, `minimal` y `sketch` no cambiaron.

## v57 — Nombre unificado, aviso de firma y SheetJS actualizado

- **Nombre:** todo lo que ve el usuario dice **"Danscanner Pro"** (manifiesto, avisos, notificaciones, Nexa, guía y base de conocimiento). Los identificadores internos (`danescaner_pro` en IndexedDB y las cachés `danscaner-*`) quedan igual, para no perder datos. La búsqueda del 29/09/2026 no encontró apps ni marcas con ese nombre; falta la consulta en el INPI.
- **Firma:** la pantalla de firma aclara que la firma es una imagen, que **no es firma digital** (Ley 25.506) y que solo se usa la propia o una autorizada.
- **SheetJS 0.20.3** (antes 0.18.5): corrige CVE-2023-30533 y CVE-2024-22363.
  - Se tomó de la réplica npm `@e965/xlsx`, porque el CDN oficial está bloqueado en este entorno; conviene verificar el archivo contra cdn.sheetjs.com.
  - La licencia está en `libs/LICENSE-sheetjs.txt`.

## v58 — Cámara de lote rápida y Magia Pro para fotocopias claras

- **Lote sin esperas:** la foto se toma y el disparador queda libre al instante.
  - El recorte, el filtro y la miniatura siguen en una cola en segundo plano y en orden. El contador muestra las fotos que todavía se están procesando.
  - "Borrar última" cancela la última foto aunque siga en proceso.
  - Si se toca "Listo" con fotos en proceso, la cámara se apaga, se espera a que terminen y se entregan todas juntas.
- **Recorte igual al marco en vivo:** la foto HD suele tener otro encuadre que el video. El marco verde se traslada a la foto (recorte centrado según la proporción) y se afina con `refineQuad`. Se usa si la detección sobre la foto se aleja más de un 3,5 % del marco visto. Así no entra la mesa ni el borde de otra hoja.
- **Detección más ágil:** revisa cada 240 ms (antes 380), tolera más el pulso (0,04, antes 0,028) y la auto-captura dispara con 3 cuadros quietos (antes 4).
- **Tocar para enfocar** en el punto tocado, con `pointsOfInterest` y `single-shot`, si el teléfono lo permite.
- **Perfiles** (⚙️ → Perfil de escaneo):
  - **Lote automático** (recomendado y predeterminado);
  - Lote manual;
  - Lote ultrarrápido (cuadro de video, instantáneo);
  - Una sola hoja.
  
  La pantalla de inicio abre la cámara en el modo de siempre. Si se cambia una opción suelta, el perfil pasa a personalizado.
- **Magia Pro con fotocopias claras:**
  - El punto negro tenía un tope fijo de 150, así que la tinta más clara que eso salía casi blanca. Ahora sigue a la tinta real, medida contra el papel y en el centro de la hoja, para que un borde de mesa no la engañe.
  - En hojas de tinta tenue se descuenta el tinte que el papel amarillento le da al gris, que antes se pintaba de azul como si fuera birome.
  - Las hojas con texto oscuro y birome quedan igual que antes.

## v59 — Fotos nítidas y sin reflejos

- **Nitidez medible:** `camSharpOf` calcula la energía del laplaciano dividida por la varianza. Así no depende del contraste ni del ruido: nítida ≈ 4, apenas movida ≈ 0,14.
  - Mientras la hoja está quieta se guarda la nitidez del video como referencia.
  - Una foto vale si mide al menos la mitad de esa referencia (`CAM_BLUR_K`). La comparación se hace sobre la zona central equivalente, aunque la foto HD tenga otra proporción.
- **Foto HD movida:** se repite sola una vez. Si sigue movida, se descarta, no entra al lote y vibra con el aviso "Salió movida…". En auto-captura la hoja queda lista para dispararse de nuevo.
- **Ultrarrápido (mejor de varias tomas):** compara el cuadro actual con los dos últimos guardados mientras la hoja estaba quieta y se queda con el más nítido. No espera nada, así que el disparador sigue siendo instantáneo aunque haya fotos procesándose.
- **Reflejos:** dentro de la hoja se busca una zona quemada (casi blanca, sin color) más clara que el papel. Si ocupa más del 0,6 %, aparece en vivo el aviso "✨ Reflejo de luz sobre la hoja: inclinala un poco o mové la luz".

## v60 — Lote: hojas al revés, repetidas y revisión antes de guardar

- **Enderezar** (`pageOrient`), sin internet ni OCR:
  - Si los renglones son verticales, la hoja está de costado.
  - Para saber si está al revés, en cada renglón se compara la tinta por encima de la zona central de las letras (astas de l, d, t, b, mayúsculas y tildes) con la de abajo (p, q, g, j, y). En latín las astas hacia arriba son mayoría.
  - Se corrige la rotación de la página y se avisa. Si el texto es todo en mayúsculas o hay pocos renglones, no se adivina.
- **Hojas repetidas** (`pageSig` y `sigSim`): por cada renglón se registra dónde caen las palabras y los espacios. Se busca un único corrimiento y escala para toda la página.
  - La misma hoja con otro recorte da ≈ 0,88; otra hoja del mismo formato ≈ 0,67. Desde 0,80 se marca como repetida.
- **Revisión al tocar "Listo"** (en lote): grilla con avisos (Repetida de la N, Enderezada, Sin bordes), girar o borrar cada hoja, "Seguir sacando" o "Guardar N páginas".
- Las opciones "Enderezar hojas al revés" y "Revisar el lote al terminar" se pueden apagar en ⚙️.

## v61 — Cámara profesional: proporción real, lente, sensor 4:3 y enfoque

- **Proporción real de la hoja** (`pageAspect`, envuelve `warp`):
  - Antes, el ancho y el alto del recorte salían del lado más largo de cada par. Con la hoja en perspectiva eso estira la página hasta un 14 %.
  - Ahora, con las cuatro esquinas, se estima la distancia focal de la cámara y la proporción real del rectángulo (método de Zhang y He, "Whiteboard scanning and image enhancement"). Si el foco estimado no es razonable para un teléfono (entre 0,5 y 1,6 veces el lado mayor), se usa 0,75.
  - En simulación con 200 tomas inclinadas y 3 px de error en las esquinas, el error máximo baja del 14 % al 2 %.
  - Si queda a menos del 3 % de **A4, Carta u Oficio (216×356)**, se usa la medida exacta. La cantidad de píxeles es la misma que antes.
  - Una hoja fotografiada de frente no cambia.
  - Se puede apagar con **⚙️ → Proporción real de la hoja**. Vale también para las páginas ya guardadas.
- **Recorte sin serrucho** (`warpTo`): si la hoja sale más chica que la foto, cada píxel promedia 2×2 muestras.
- **Lente** (`camPickLens`, `camNextLens`):
  - Si el navegador abre el ultra gran angular, el teleobjetivo o el macro, la cámara pasa sola al principal.
  - **⚙️ → Lente** recorre las cámaras traseras y recuerda la elegida (`S.camDev`).
- **Sensor completo 4:3** (`camFullSensor`):
  - Si la cámara lo permite, el video pasa a 4:3: lo que se ve es lo que sale en la foto HD.
  - Solo se aplica si una hoja A4 que llena el cuadro queda con al menos un 5 % más de píxeles. Si el teléfono no lo respeta, vuelve a la resolución anterior.
- **Enfoque y luz siguen a la hoja** (`camFollowFocus`): cada 1,2 s, si el documento se movió, el punto de enfoque y medición (`pointsOfInterest`) se pone en el centro de la hoja. Durante 4 s no lo hace después de tocar la pantalla.
- **Enfocar antes de la foto HD** (`camFocusLock`):
  - Si el cuadro está menos nítido que lo habitual, enfoca una vez (`single-shot`) en el centro de la hoja.
  - Espera el pico de nitidez, con un máximo de 0,9 s, y vuelve al enfoque continuo.
  - Si ya estaba nítido, dispara sin esperar.

## v62 — Limpiar y aplanar: dedos, manchas y hojas curvas

Todo se calcula en el teléfono, en `pageClean`, dentro de `renderPage` y antes del filtro. Primero se aplana y después se rellenan los dedos y las manchas.

Cada arreglo guarda la clave del recorte y del giro con que se calculó (`pageKey`). Si después se cambia el recorte o se gira la hoja, ese arreglo se ignora.

- **Aplanar hojas curvas** (`dewarpAnalyze`, `dewarpApply`, se guarda en `p.dw`):
  1. Detecta la tinta comparándola con el promedio local (ventana de 31 px).
  2. Une las letras de cada renglón cerrando huecos horizontales de hasta 2,5 % del ancho.
  3. Se queda con los componentes anchos y bajos y calcula la línea central de cada renglón en franjas de 12 px.
  4. Por mínimos cuadrados ajusta un desplazamiento vertical suave d(x,y), de grado 3 en x y 2 en y, que lleva cada renglón a su altura media.
  - Se aplica solo si hay al menos 5 renglones, el modelo explica el 50 % o más de la ondulación y el desplazamiento máximo queda entre 0,4 % y 6 % del alto. Una hoja plana no se toca.
  - En la prueba, una hoja curvada 40 px queda por debajo del umbral después de aplanarla.
  - Limitación: corrige la ondulación de los renglones. No corrige la compresión horizontal cerca del lomo.
- **Borrar dedos** (`fingerDetect`, se guarda en `p.fg` como una grilla de 8 px):
  1. Busca píxeles color piel en YCbCr, con un umbral relativo al tinte y a la luz del papel. Así el papel amarillento o con luz cálida no cuenta como dedo.
  2. Se queda con los componentes que tocan el borde, ocupan entre 0,15 % y 8 % de la hoja, entran como mucho un 35 % y están rellenos.
  3. Incluye la sombra: los píxeles grises más oscuros que el papel, hasta un 4,5 % alrededor.
- **Borrar manchas a mano:** en el editor, el botón **Limpiar** abre el pincel. Los trazos se guardan normalizados en `p.erase`.
- **Relleno** (`inpaintMask`): usa una pirámide "push-pull" que promedia el papel de alrededor, solo dentro del recuadro de la máscara más un margen.
- **Cámara:** `camPostProcess` llama a `pageAutoClean` después de enderezar. La revisión del lote muestra "🧽 Sin dedos" y "📖 Aplanada". Las dos funciones se pueden apagar en ⚙️ (`S.autoFinger`, `S.autoDewarp`).

## v63 — Panel ⚙️ de la cámara sin trabas y «Mejorar» rehecho

- **Panel ⚙️:**
  - Antes se redibujaba entero con cada `Cam.updUI()`, que se llama, por ejemplo, cada vez que termina de procesarse una foto del lote. Por eso volvía arriba y perdía los toques.
  - Ahora solo se redibuja si cambió alguna opción, y conserva el desplazamiento.
  - Mientras está abierto, la detección y la auto-captura se pausan ("⏸ Cámara en pausa mientras configurás").
  - Tocar la imagen de la cámara o el disparador lo cierra.
  - El panel se desplaza dentro de sí mismo (`overscroll-behavior:contain`, `touch-action:pan-y`).
- **«Mejorar»** (`photoEnhance`, autocontenido para que también corra en el hilo de trabajo de los filtros). El anterior agrandaba el ruido y no blanqueaba el papel. El nuevo:
  1. Mide el ruido y lo quita en la luz con un filtro guiado que respeta los bordes de las letras. Suaviza el ruido de color.
  2. Si la imagen es un documento, estima el papel por bloques (percentil 90), lo suaviza y divide. Así se van las sombras y la luz despareja.
  3. Aplica un balance de blancos con el tinte del papel.
  4. El papel pasa a blanco con un umbral que se adapta al ruido que quedó. La tinta se lleva casi a negro desde su percentil 1,5. El color de la birome y de los sellos se conserva y se aviva.
  5. Borra los puntitos grises sueltos (la tinta oscura no se toca) y aplica nitidez sobre la luz, con un umbral según el ruido.
  - Si la imagen no es un documento (es una foto), aplica niveles automáticos suaves y un poco de contraste local.

## v64 — Resumen del documento y tarjeta personal a contacto (ideas de Adobe Scan, sin nube)

- **Resumen** (botón en la pantalla del documento):
  - Usa el texto guardado o, si no hay, hace OCR de todas las páginas (`docFullText`) y lo guarda.
  - **Datos clave** (`docSummaryData`): tipo y número, dependencia, expediente, fecha, personas, DNI, otras fechas, montos, teléfonos y correos, con `docAnalyze` y `nbEntities`.
  - **Lo principal** (`docSummary`): resumen por extracción. Puntúa cada oración por la frecuencia de sus palabras, con un extra para los verbos de lo que se pide, ordena o fija (`SUM_KEY`) y para las primeras oraciones, y le baja el peso a saludos y encabezados. Muestra de 4 a 5 oraciones en el orden original.
  - No inventa texto: todo sale del documento. Se puede copiar o guardar como .txt.
- **A contacto** (botón en la pantalla del documento):
  - Hace OCR de la primera página y `cardParse` detecta nombre (con Dr., Dra., Lic. y similares), cargo, empresa u organismo, teléfonos, correo, web y dirección.
  - Los datos se muestran en un formulario editable. `vcardOf` genera un vCard 3.0 (.vcf) que el teléfono agrega a la agenda.
