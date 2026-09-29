# Aviso sobre Inteligencia Artificial y procesamiento automático

**Versión:** 1.0 · **Vigente desde:** [FECHA]

## 1. Qué funciones usan procesamiento automático o IA

| Función | Tecnología | ¿Dónde se procesa? |
|---|---|---|
| Detección de bordes, perspectiva, recorte, mejora de imagen, nitidez, análisis de calidad, estilos artísticos | Algoritmos de visión por computadora (no generativos) | **En tu dispositivo** |
| OCR (reconocimiento de texto) | Tesseract, un motor de reconocimiento con red neuronal | **En tu dispositivo** |
| Nombre automático, carpeta y etiquetas | Reglas sobre el texto reconocido | **En tu dispositivo** |
| Nexa "sin internet" | Modelo de lenguaje Qwen2.5 que corre en el dispositivo | **En tu dispositivo** |
| Consultas de leyes en Nexa | Búsqueda en textos oficiales (InfoLeg) guardados en la app | **En tu dispositivo** |
| Nexa "con internet" | Modelo de lenguaje del proveedor que elijas (Google Gemini, OpenAI, Anthropic) con tu clave | **En los servidores de ese proveedor** |
| Traducción | [SERVICIO] | **En los servidores del servicio** |
| Dictado por voz | Reconocimiento de voz del navegador o del sistema | En el dispositivo, si está disponible. Si no, en los servidores del proveedor del navegador (en Chrome, Google) |

Antes de cada envío fuera del dispositivo, la app te avisa **qué se envía y a quién**, y podés cancelar.

## 2. Posibles errores

- El **OCR** puede confundir letras o números (por ejemplo, 0 y O, 1 e I, ° y *), omitir texto o leer mal tablas, sellos o letra manuscrita.
- Las **traducciones** pueden cambiar el sentido, sobre todo en textos jurídicos o técnicos.
- La **extracción de datos** (nombres, DNI, fechas, montos, expedientes) puede equivocarse o dejar datos afuera.
- Los **resúmenes y respuestas de Nexa** pueden ser incompletos, desactualizados o incorrectos, aunque suenen seguros ("alucinaciones").
- Las **mejoras de imagen** y los **estilos** modifican la imagen y pueden ocultar detalles.
- Los **nombres automáticos** pueden asignar un tipo, número o dependencia incorrectos.

## 3. Tenés que verificar

**Revisá siempre los resultados contra el documento original** antes de usarlos o presentarlos. Para normas, consultá el texto oficial vigente (InfoLeg o el boletín oficial correspondiente).

## 4. No es asesoramiento profesional

Los resultados de la IA **no son asesoramiento jurídico, médico, financiero, contable ni profesional** y no reemplazan la consulta a un profesional matriculado.

## 5. Tus datos y la IA

- El contenido de tus documentos **no se usa para entrenar** modelos de IA propios.
- Si usás Nexa con internet, el proveedor que elijas trata lo enviado según **sus términos**. Revisá si ese proveedor usa los datos de la API para entrenamiento y cómo desactivarlo.
- Recomendación: **no envíes** datos sensibles o de terceros. Usá **Censurar** antes de enviar.

## 6. Reportar un problema

Si Nexa genera contenido ofensivo, dañino o incorrecto, tocá **⋯ → Reportar respuesta** en el mensaje, o escribinos a [CORREO]. [⚖️ Requisito de la política de contenido generado por IA de Google Play: implementar el botón.]
