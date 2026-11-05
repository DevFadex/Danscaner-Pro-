# Licencias de las librerías de terceros

Danscanner Pro usa estas librerías sin modificar, guardadas en `libs/` para funcionar sin internet.
Todas tienen licencias compatibles: MIT, Apache 2.0, BSD u OFL.
Las que ya traían su licencia en un archivo propio (OpenCV, Tesseract, ExcelJS, SheetJS, wllama y las fuentes) la tienen al lado.
Este archivo completa los avisos de las que no la traían en un archivo aparte.

| Archivo | Proyecto | Licencia | Titular |
|---|---|---|---|
| `supabase.js`, `591.supabase.js` | supabase-js | MIT | Copyright (c) 2020 Supabase |
| `fontkit-1.1.1.umd.min.js` | fontkit 1.1.1 | MIT | Copyright (c) 2014 Devon Govett |
| `jsQR.js` | jsQR | Apache 2.0 (texto completo en `LICENSE-Apache-2.0.txt`) | Copyright 2017 Cosmo Wolfe |
| `mammoth.browser.min.js` | mammoth.js | BSD de 2 cláusulas | Copyright (c) 2013, Michael Williamson |
| `pdf-lib-cifrado.min.js` | @cantoo/pdf-lib 2.11.1 (pdf-lib con cifrado) | MIT | Copyright (c) 2019 Andrew Dillon; Cantoo |
| `pptxgen.bundle.js` | PptxGenJS 3.12.0 (incluye JSZip, MIT) | MIT | Copyright (c) 2015-present Brent Ely |
| `qrcode.min.js` | qrcodejs | MIT | Copyright (c) 2012 davidshimjs |
| `xlsx.full.min.js` | SheetJS Community Edition | Apache 2.0 (ver `LICENSE-sheetjs.txt`) | Copyright (C) 2013-present SheetJS LLC |

Las demás (`pdf.min.js` y `pdf.worker.min.js` de PDF.js, `pdf-lib.min.js`, `jszip.min.js`, `html2canvas.min.js`, `html2pdf.bundle.min.js`, `docx-preview.min.js`, `tesseract.min.js` y `web-llm-0.2.85.js`) llevan el aviso de licencia dentro del mismo archivo.

## Texto de la licencia MIT

Se aplica a supabase-js, fontkit, @cantoo/pdf-lib, PptxGenJS y qrcodejs, con el titular de la tabla.

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Texto de la licencia BSD de 2 cláusulas

Se aplica a mammoth.js (Copyright (c) 2013, Michael Williamson. All rights reserved.).

> Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
>
> 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Licencia Apache 2.0

Se aplica a jsQR y SheetJS. El texto completo está en `LICENSE-Apache-2.0.txt`.
