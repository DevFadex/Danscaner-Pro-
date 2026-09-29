# Licencias de terceros de Danscanner Pro

**Relevado del código el 29/09/2026.** Las licencias se verificaron en los archivos `LICENSE` de los repositorios oficiales (raw.githubusercontent.com), en los encabezados de los archivos incluidos en `libs/` y en `package.json`. Donde dice "verificar", no se pudo confirmar en la fuente oficial en esta sesión.

> **Regla:** antes de publicar, generá un archivo `libs/LICENCIAS-TERCEROS.txt` con el **texto completo** de cada licencia y los avisos de copyright, y mostralo en **Ajustes → Legal → Licencias de terceros**. Las licencias MIT, BSD y Apache exigen conservar los avisos al redistribuir. Apache-2.0 exige además incluir el archivo **NOTICE**, si existe.

## 1. Bibliotecas incluidas en la app

| Biblioteca (versión) | Uso | Licencia | ¿Uso comercial? | Obligaciones principales | Notas |
|---|---|---|---|---|---|
| **pdf.js** (Mozilla) 3.11.174 | Leer y mostrar PDF | **Apache-2.0** ✅ | Sí | Incluir la licencia y avisos. Indicar los cambios si se modifica. Incluir NOTICE si existe | — |
| **pdf-lib** 1.17.1 | Crear y editar PDF | **MIT** ✅ | Sí | Incluir el aviso de copyright y la licencia | El bundle incluye dependencias con sus propios avisos: conservar los comentarios de licencia del archivo |
| **@cantoo/pdf-lib** 2.11.1 | PDF con contraseña | **MIT** ✅ (fork de pdf-lib) | Sí | Igual que arriba | — |
| **tesseract.js** 5.1.1 | OCR | **Apache-2.0** ✅ | Sí | Licencia y avisos | `libs/tesseract/LICENSE-tesseract.js.txt` |
| **tesseract.js-core** (motor Tesseract en WebAssembly) | OCR | **Apache-2.0** ✅ | Sí | Licencia y avisos | `libs/tesseract/LICENSE-tesseract-core.txt` |
| **Datos de idioma `spa.traineddata`** (tessdata) | OCR en español | **Apache-2.0** ✅ | Sí | Licencia y avisos | — |
| **mammoth.js** 1.6.0 | Word a HTML | **BSD-2-Clause** ✅ | Sí | Al distribuir en binario o minificado, **reproducir el copyright, las condiciones y el descargo** en la documentación | — |
| **html2pdf.js** 0.10.1 | HTML a PDF | **MIT** ✅ | Sí | Aviso y licencia | **Incluye jsPDF (MIT ✅) y html2canvas (MIT ✅)**: sus avisos también |
| **html2canvas** | Capturas HTML | **MIT** ✅ | Sí | Aviso y licencia | — |
| **jsQR** 1.4.0 | Leer códigos QR | **Apache-2.0** ✅ | Sí | Licencia y avisos | — |
| **SheetJS CE (xlsx)** 0.20.3 | Excel | **Apache-2.0** ✅ (`libs/LICENSE-sheetjs.txt`) | Sí | Licencia y avisos | ✅ Actualizada en la v57 (corrige CVE-2023-30533 y CVE-2024-22363). Obtenida de la réplica npm `@e965/xlsx`; verificar contra cdn.sheetjs.com |
| **JSZip** 3.10.1 | ZIP | **MIT o GPLv3** (a elección) ✅ | Sí | **Elegir MIT** y conservar el aviso | — |
| **PptxGenJS** 3.12.0 | PowerPoint | **MIT** ✅ | Sí | Aviso y licencia | El bundle incluye JSZip |
| **docx-preview** | Vista previa de Word | **Apache-2.0** ✅ | Sí | Licencia y avisos | — |
| **supabase-js** | Cliente de autenticación | **MIT** ✅ | Sí | Aviso y licencia | El **servicio** Supabase tiene sus propios términos (sección 3) |
| **qrcode.js** (davidshimjs) | Generar QR | **MIT** ✅ | Sí | Aviso y licencia | "QR Code" es marca registrada de DENSO WAVE; conviene mencionarlo en el aviso |
| **fontkit** 1.1.1 | Fuentes en PDF | **MIT** ✅ | Sí | Aviso y licencia | — |
| **web-llm** (MLC) 0.2.85 | IA local (WebGPU) | **Apache-2.0** ✅ | Sí | Licencia y avisos | El bundle incluye avisos MIT de dependencias: conservarlos |
| **wllama** | IA local (WebAssembly) | **MIT** ✅ | Sí | Aviso y licencia | `libs/wllama/LICENSE-MIT.txt`. Incluye **llama.cpp** (MIT ✅) |

## 2. Tipografías, íconos y recursos

| Recurso | Licencia | ¿Comercial? | Obligaciones | Notas |
|---|---|---|---|---|
| **Liberation Sans** | **SIL OFL 1.1** ✅ | Sí | Incluir la licencia OFL. No vender la fuente sola. Si se modifica, no usar el nombre reservado | `libs/fonts/LICENSE-LiberationSans-OFL.txt` |
| **Barlow** y **Barlow Condensed** (Google Fonts) | **SIL OFL 1.1** ✅ | Sí | Incluir la licencia si se empaqueta la fuente | Hoy se cargan desde Google Fonts, que recibe la IP del usuario. Recomendado: **autoalojar** |
| **Font Awesome Free** 6.4.0 | **Íconos: CC BY 4.0. Fuentes: SIL OFL 1.1. Código: MIT** ✅ | Sí | **CC BY 4.0 exige atribución** (por ejemplo, "Íconos de Font Awesome Free, fontawesome.com, CC BY 4.0") | Hoy se carga desde cdnjs. "Font Awesome" es nombre reservado |
| **Íconos propios de la app** (SVG en `ICONS`) | Propios, si los creó el titular | — | — | Confirmar autoría |
| **Logo** | Del titular, si lo creó él o tiene la cesión | — | — | ⚖️ Si lo hizo un diseñador, hace falta la **cesión de derechos** por escrito |

## 3. Modelos de IA

| Modelo | Licencia | ¿Comercial? | Obligaciones | Riesgo |
|---|---|---|---|---|
| **Qwen2.5-0.5B-Instruct** | **Apache-2.0** | Sí | Licencia y avisos | Bajo |
| **Qwen2.5-1.5B-Instruct** | **Apache-2.0** | Sí | Licencia y avisos | Bajo |
| **Qwen2.5-3B-Instruct** | **Qwen Research License** (según el LICENSE del modelo y las fuentes consultadas) | **No**, sin licencia comercial de Alibaba Cloud | Uso no comercial | ⚠️ **Alto**: quitarlo de la app o conseguir la licencia antes de monetizar |

Las licencias de modelos se verificaron por búsqueda: Hugging Face está bloqueado en este entorno. **Confirmar en <https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/LICENSE>.**

## 4. Servicios de terceros (no son bibliotecas: se rigen por sus términos de servicio)

| Servicio | Uso | Qué revisar |
|---|---|---|
| **Supabase** | Cuentas | Términos, DPA (acuerdo de tratamiento de datos), región del proyecto, subencargados |
| **Google Gemini API** | Nexa con internet (clave del usuario) | Términos de la API. **Uso de los datos para mejorar los modelos según el plan** (gratuito o pago): informárselo al usuario |
| **OpenAI API** | Igual | Términos y política de uso de datos de la API |
| **Anthropic API** | Igual | Términos comerciales y política de uso de datos |
| **Traductor de Google (`translate.googleapis.com`, `client=gtx`)** | Traducción | ⚠️ **No es una API pública oficial**. Reemplazarla por **Cloud Translation API** (con backend) o quitarla |
| **MyMemory** (translated.net) | Traducción | ⚠️ Límites de uso y **posible almacenamiento de los textos enviados**. Verificar sus términos antes de mantenerlo |
| **Hugging Face** | Descarga de modelos | Términos del sitio y licencia de cada modelo |
| **cdnjs, jsDelivr, unpkg, Google Fonts** | Entrega de bibliotecas y fuentes | Reciben la IP. Recomendado: servir todo desde la app |
| **Vercel** | Hosting | Términos y DPA |

## 5. Bibliotecas mencionadas que **no** están en el código actual

| Biblioteca | Licencia verificada | Si se incorpora |
|---|---|---|
| **OpenCV** (opencv.js) 4.x | **Apache-2.0** ✅ (versión 4.5.0 en adelante) | Licencia y avisos. Revisar los módulos incluidos en el build |
| **jscanify** | **MIT** ✅ | Aviso y licencia. Depende de OpenCV |

## 6. Textos normativos (Nexa)

Los textos de leyes de InfoLeg y las transcripciones de normas provinciales se muestran citando la fuente. ⚖️ Confirmar con un abogado el régimen de los textos oficiales frente a la Ley 11.723. Mantener siempre la **fuente**, la **fecha de descarga** y la **aclaración de que no son la publicación oficial**.
