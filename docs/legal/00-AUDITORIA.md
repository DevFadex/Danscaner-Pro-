# Danscanner Pro: auditoría legal y técnica para publicar en Google Play

**Fecha de consulta de las fuentes: 29/09/2026.**

> **Aviso.** Este documento es una auditoría preparatoria para reducir riesgos y cumplir las obligaciones aplicables. No es asesoramiento jurídico y no garantiza protección frente a reclamos. Los puntos marcados con ⚖️ tienen que ser revisados por un abogado argentino especializado en protección de datos, software y comercio electrónico. En la sección 8 está la lista de lo que debería revisar.

---

## 1. Qué hace hoy la app (relevado del código, versión interna 56)

| Área | Cómo funciona hoy | Dónde se procesan los datos |
|---|---|---|
| Escaneo con cámara, bordes, perspectiva, recorte, rotación, filtros, nitidez, estilos de imagen | JavaScript en el navegador (PWA) | **Local** (A) |
| PDF (crear, unir, dividir, comprimir, proteger, firmar con imagen, editar, censurar) | pdf-lib, pdf.js y @cantoo/pdf-lib | **Local** (A) |
| OCR | Tesseract.js con el idioma español incluido en la app | **Local** (A) |
| Almacenamiento de documentos | IndexedDB del navegador del dispositivo | **Local** (A) |
| Respaldo | Archivo ZIP o `.dsbackup` cifrado (AES-GCM + PBKDF2) que el usuario descarga | **Local** (A) |
| Bloqueo con PIN | Configuración local | **Local** (A) |
| Firmas guardadas | `localStorage` (`ds_sigs`) | **Local** (A) |
| Nexa "sin internet" | Modelos Qwen2.5 que corren en el dispositivo (web-llm / wllama). Se descargan de Hugging Face | **Local** (A). La descarga del modelo no envía documentos |
| Nexa "con internet" | El texto se envía **desde el dispositivo** a Google Gemini, OpenAI o Anthropic, con **una clave de API que carga el propio usuario**. Antes de enviar pide permiso (`NxOk`) | **API de terceros** (C) |
| Traducción | `translate.googleapis.com/translate_a/single?client=gtx` y `api.mymemory.translated.net` | **API de terceros** (C) ⚠️ |
| Dictado por voz (micrófono) | Web Speech API del navegador | En Chrome, **por defecto el audio se envía a un servicio de Google** (C). Hay opción en el dispositivo desde Chrome 139 |
| Lectura en voz alta | `speechSynthesis` del sistema | Normalmente local |
| Cuentas | Supabase Auth: correo, contraseña (hash), nombre, rol y estado en la tabla `profiles`, e invitaciones | **Servidor de un tercero** que actúa por cuenta del desarrollador (B/D) |
| Bibliotecas y tipografías | Se sirven desde la app o desde CDN (cdnjs, jsDelivr, unpkg), Google Fonts y Font Awesome | Los CDN reciben la **IP y el user-agent** del dispositivo |
| Publicidad, analítica, pagos | **No hay** | — |

Riesgos que surgen del código, antes de hablar de textos legales:

1. **Traductor por un endpoint no oficial de Google** (`client=gtx`). No es una API pública documentada. Según las fuentes consultadas, usarlo puede violar los términos de Google y puede dejar de funcionar sin aviso. **Recomendación:** reemplazarlo por Cloud Translation API a través de un backend propio (la clave nunca en la app) o por traducción en el dispositivo.
2. **MyMemory.** Según su documentación, los textos enviados pueden guardarse a largo plazo como memoria de traducción. No lo pude verificar directamente: el sitio está bloqueado en este entorno, así que hay que confirmarlo en <https://mymemory.translated.net/terms-and-conditions>. Para documentos judiciales, médicos o con DNI, es un **riesgo alto**. **Recomendación:** desactivarlo o avisar de forma destacada antes de cada uso.
3. **Modelo Qwen2.5-3B-Instruct.** Está bajo la *Qwen Research License*, que **no permite uso comercial** sin una licencia de Alibaba Cloud. Los modelos 0.5B y 1.5B son Apache-2.0. **Recomendación:** si la app va a ser comercial o a tener anuncios o compras, **quitar el 3B** u obtener la licencia.
4. **Eliminación de cuentas.** La app permite crear cuentas (registro e invitaciones), pero **el usuario no puede pedir la baja de su cuenta desde la app**. Además, el administrador hoy borra solo el perfil (`profiles`) y no el usuario de `auth.users`. Google Play exige un camino de eliminación dentro de la app y un enlace web (ver 3.2).
5. **Dictado por voz.** Hay que decir que el audio puede procesarse en servidores de Google, o usar el modo en el dispositivo cuando esté disponible.
6. **Firma.** "Firmar PDF" pega la **imagen** de una firma manuscrita. No es firma digital en el sentido de la Ley 25.506 (art. 2). A lo sumo podría encuadrar como firma electrónica (art. 5), cuya validez debe probar quien la invoca. Hay que aclararlo al usuario.
7. **Nombre inconsistente.** Aparecen "Danescaner Pro", "Danscaner" y "Danscanner Pro". Hay que unificarlo antes de registrar la marca y publicar.
8. **Publicación como PWA.** Para estar en Google Play, la PWA se empaqueta como *Trusted Web Activity* (Bubblewrap) con *Digital Asset Links*. Todas las políticas de Play se aplican igual que a una app nativa.

---

## 2. Normas y políticas aplicables, y por qué

### 2.1 Argentina (textos consultados en InfoLeg el 29/09/2026)

| Norma | ¿Aplica? | Por qué y qué artículos importan |
|---|---|---|
| **Ley 25.326** de Protección de Datos Personales | **Sí, en cuanto el desarrollador trate datos personales** (cuentas en Supabase, soporte por correo, y cualquier envío futuro a un servidor propio). Sobre el procesamiento **exclusivamente local**, el desarrollador no recibe datos. Igual conviene informar cómo funciona | Art. 2 (definiciones, **datos sensibles**: salud, origen racial, opiniones políticas, etc.). Art. 4 (calidad, finalidad, no exceso). **Art. 5** (consentimiento libre, expreso e informado, y excepciones del inc. 2, por ejemplo la d: relación contractual). **Art. 6** (qué hay que informar). **Art. 7** (sensibles; **7.4: los datos de antecedentes penales o contravencionales solo pueden ser tratados por autoridades públicas competentes**). **Art. 9** (seguridad). **Art. 10** (confidencialidad). Art. 11 (cesión). **Art. 12** (transferencia internacional). **Arts. 14 y 16** (acceso en 10 días corridos; rectificación y supresión en 5 días hábiles). **Art. 21** (registro). **Art. 25** (servicios por cuenta de terceros) |
| **Decreto 1558/2001** (reglamentario) | **Sí** | **Art. 1**: los bancos "privados destinados a dar informes" incluyen los que **exceden el uso exclusivamente personal**. Esto hace probable la inscripción de la base de cuentas en el Registro Nacional de Bases de Datos ⚖️. Art. 5 (consentimiento informado; revocable sin efecto retroactivo). **Art. 12** (la transferencia internacional se permite con **consentimiento expreso** del titular, entre otros supuestos). **Art. 25** (contrato con el encargado: actúa por instrucciones del responsable y queda sujeto al art. 9) |
| Disposición DNPDP 60/2016 y Resolución AAIP 34/2019 | **Sí, si hay transferencias internacionales** (Supabase, APIs de IA, traducción) | Aprueban los **contratos modelo** y la lista de países con protección adecuada: UE/EEE, Reino Unido, Suiza, Canadá (sector privado), Nueva Zelanda, Uruguay, entre otros. **Estados Unidos no figura** en la lista informada por la AAIP |
| Resolución AAIP 198/2023 | **Opcional** | Aprueba las cláusulas contractuales modelo de la RIPD para transferencias internacionales |
| **Ley 24.240** de Defensa del Consumidor | **Sí** | **Art. 1**: es consumidor quien usa servicios "en forma **gratuita** u onerosa" como destinatario final. La gratuidad no excluye la ley. **Art. 4** (información cierta, clara y detallada). **Art. 37** (se tienen por no convenidas las cláusulas que limiten la responsabilidad por daños o restrinjan derechos del consumidor) |
| **Código Civil y Comercial** | **Sí** | **Arts. 985 a 988** (cláusulas predispuestas: claras, autosuficientes y sin reenvíos a textos no facilitados; abusivas). **Arts. 1092 a 1094, 1100** (consumo e información). **Arts. 1106 a 1108** (medios electrónicos). **Art. 1109** (en contratos a distancia, la **cláusula de prórroga de jurisdicción se tiene por no escrita**). **Art. 1110** (revocación en 10 días, relevante si hay compras). **Art. 2654** (jurisdicción internacional en consumo) |
| **Ley 11.723** de Propiedad Intelectual | **Sí** | Art. 1 (el software fuente y objeto es obra protegida). **Art. 55 bis** (explotación del software por licencias de uso o reproducción) |
| Ley 22.362 de Marcas | **Recomendado** | Para proteger "Danscanner Pro" y el logo hay que registrarlos ante el INPI. No lo pude consultar en InfoLeg en esta sesión ⚖️ |
| **Ley 25.506** de Firma Digital | **Solo para aclarar alcances** | La app no emite firma digital (art. 2). La imagen de firma no cumple sus requisitos. El art. 5 define la firma electrónica: si se desconoce, "corresponde a quien la invoca acreditar su validez" |
| **Ley 27.078** Argentina Digital | **No, en principio** | Regula servicios TIC y telecomunicaciones (arts. 1 y 6). Una app de escaneo no es prestadora de servicios TIC en ese sentido. Si en el futuro se ofrecieran servicios de comunicaciones, habría que revisarlo ⚖️ |

### 2.2 Google Play (Developer Policy Center y Play Console Help, consultados por búsqueda el 29/09/2026)

> El acceso directo a `support.google.com` y `play.google.com` está **bloqueado en este entorno**. Las políticas se verificaron con los extractos de las páginas oficiales devueltos por el buscador. Antes de publicar, **releé cada página enlazada en la sección 9**.

| Política | Qué exige (extracto de la página oficial) | Cómo afecta a la app |
|---|---|---|
| **User Data** | Enlace a la política de privacidad en Play Console **y** dentro de la app. URL **activa, pública, sin geobloqueo, no PDF y no editable**. Junto con las divulgaciones en la app, debe cubrir todo el acceso, la recopilación, el uso y el intercambio de datos, no solo lo declarado en Data safety | **Obligatorio** |
| **Divulgación destacada y consentimiento** | Dentro de la app, en el uso normal y sin tener que ir a Ajustes. Debe describir qué datos y para qué. No puede estar solo en la política o los términos, ni mezclada con otras divulgaciones | **Obligatorio** para: envío de texto a IA en la nube, traductores, dictado por voz y creación de cuenta |
| **Aclaración del 15/07/2026** | Los requisitos de User Data **se aplican también a integraciones de IA de terceros**, y el desarrollador sigue siendo responsable (uso limitado, divulgación y consentimiento) | **Obligatorio** para Nexa con Gemini, OpenAI o Anthropic |
| **Data safety** | Hay que completarlo siempre. Los datos procesados **solo en el dispositivo** no se declaran. El procesamiento "efímero" se declara en el formulario pero puede no mostrarse. No es "compartir" la transferencia hecha por **acción específica del usuario** cuando este razonablemente la espera, o con divulgación destacada y consentimiento | **Obligatorio** |
| **Eliminación de cuenta** | Si la app permite crear cuentas desde la app, **debe permitir pedir su eliminación** dentro de la app y con un **enlace web** que funcione, nombre la app o el desarrollador y tenga el camino de baja bien visible. Hay que **borrar los datos asociados** a la cuenta y responder las preguntas de eliminación en Data safety | **Obligatorio** (la app tiene cuentas). **Hoy no se cumple** |
| **Permisos de fotos y videos** | Con destino Android 13 o superior, READ_MEDIA_IMAGES y READ_MEDIA_VIDEO solo si el selector del sistema no alcanza. Para usos puntuales, el selector | Como TWA la app usa el selector de archivos del navegador: **no pedir READ_MEDIA_*** |
| **Cámara y micrófono** | Pedirlos en el momento de uso y justificarlos | Cámara al escanear, micrófono al dictar |
| **Contenido generado por IA** | Las apps que **generan** contenido con IA (chatbots, generación de imágenes) deben tener **denuncia o marcado dentro de la app** y evitar contenido ofensivo | **Obligatorio si Nexa queda disponible** para usuarios (es un chatbot). Los estilos de imagen son filtros locales, no generativos. Conviene declararlos igual y revisarlo ⚖️ |
| **Declaración de contenido generado por IA en fichas** | Casilla en Play Console para recursos de la ficha creados con IA | Solo si las capturas o gráficos de la ficha se hacen con IA |
| **Clasificación de contenido (IARC)** | Todas las apps deben tener clasificación (cuestionario). Desde 07/2026 **no se permiten apps sin clasificar** | **Obligatorio** |
| **Público objetivo** | Declarar la franja de edad. Si incluye niños, se aplica la política de Familias | **Obligatorio**. Recomendado: **18+** |
| **Nivel de API objetivo** | Desde el **31/08/2026**, las apps nuevas y las actualizaciones deben apuntar a **Android 16 (API 36)**. Se podía pedir prórroga hasta el 01/11/2026 | **Obligatorio** (configurarlo en el proyecto Bubblewrap) |
| **Cuentas personales nuevas** | Prueba cerrada con **al menos 12 testers durante 14 días** antes de pedir acceso a producción | **Obligatorio** si la cuenta de desarrollador es personal y se creó después del 13/11/2023 |
| **Verificación de desarrolladores de Android** | Desde **09/2026** en Brasil, Indonesia, Singapur y Tailandia, y **global en 2027**: las apps deben estar registradas por un desarrollador con identidad verificada | **Obligatorio** en el calendario de Google |
| **Acceso a la app** | Si la app requiere inicio de sesión, hay que dar credenciales de prueba a la revisión | **Obligatorio** (la app tiene acceso por cuenta) |
| Anuncios y Families | Declarar si hay anuncios | Hoy: **no hay anuncios** |
| Pagos | Los bienes digitales se cobran con Google Play Billing (en TWA, con la Digital Goods API) | **Solo si se incorporan compras** |

---

## 3. Qué es obligatorio, qué es recomendado y qué depende de las funciones

### 3.1 OBLIGATORIO (con las funciones actuales)

1. Política de privacidad en una **URL pública HTML** (no PDF), enlazada en Play Console **y dentro de la app**.
2. **Data safety** completo y coherente con la política.
3. **Divulgación destacada y consentimiento** dentro de la app antes de:
   - enviar texto o documentos a la IA en la nube;
   - traducir con un servicio externo;
   - dictar por voz, si el audio sale del dispositivo;
   - crear la cuenta (qué datos se guardan en el servidor).
4. **Eliminación de cuenta** dentro de la app **y** con un enlace web, borrando también `auth.users`, `profiles`, invitaciones y registros asociados.
5. **Clasificación de contenido** (IARC) y **público objetivo**.
6. **API objetivo 36** en el paquete.
7. **Credenciales de prueba** en "Acceso a la app".
8. **Cumplir las licencias de terceros**: incluir los avisos MIT, BSD, Apache (y NOTICE si lo hay), OFL y CC BY 4.0 (ver `licencias-de-terceros.md`).
9. **No usar Qwen2.5-3B en forma comercial** sin licencia.
10. Ley 25.326 respecto de las cuentas:
    - informar lo del art. 6;
    - base legal (art. 5.2.d, relación contractual, para lo necesario del servicio);
    - seguridad (art. 9);
    - contrato con el encargado (Supabase) según el art. 25 del Decreto 1558/2001;
    - régimen de **transferencia internacional** (art. 12 de la ley y del decreto) según la región del proyecto Supabase ⚖️.
11. Términos que respeten la Ley 24.240 y el CCyC:
    - sin cláusulas que limiten la responsabilidad por daños en forma abusiva;
    - **sin prórroga de jurisdicción contra consumidores** (CCyC 1109);
    - accesibles antes de aceptar (CCyC 985).

### 3.2 RECOMENDADO

- **Inscribir la base de cuentas** en el Registro Nacional de Bases de Datos de la AAIP. El art. 1 del Decreto 1558/2001 hace probable que sea obligatorio si la base excede el uso personal ⚖️.
- **Registrar la marca** "Danscanner Pro" y el logo ante el INPI, y depositar el software en la DNDA (Ley 11.723).
- **Reemplazar el traductor `client=gtx`** y **desactivar MyMemory** por defecto.
- **Dictado en el dispositivo** cuando Chrome lo permita. Si no, aviso previo.
- **Autoalojar** Google Fonts y Font Awesome, y servir todas las bibliotecas desde la propia app. Así ningún CDN recibe la IP del usuario y se simplifica Data safety.
- **Aviso de documentos de terceros y datos sensibles** al importar o escanear (ver `textos-en-la-app.md`).
- Guardar la **versión y la fecha** en que cada usuario aceptó los términos y la privacidad.
- **Cifrar localmente** los documentos cuando se active el PIN. Hoy el PIN bloquea la interfaz pero IndexedDB no está cifrado.
- **No guardar documentos** en ningún servidor propio.
- Marcar en la **ficha de Play** que el procesamiento es local.

### 3.3 SOLO SI SE INCORPORA DETERMINADA FUNCIÓN

| Función futura | Obligaciones que se suman |
|---|---|
| **Servidor propio que procese documentos** (B) | Responsable de tratamiento pleno (arts. 4 a 12 de la Ley 25.326). Seguridad (art. 9). Inscripción en el registro. Contratos con el hosting (art. 25 del decreto). Política de conservación y borrado. Declarar recopilación en Data safety. Si hay **antecedentes penales**, **art. 7.4** ⚖️. Salud: art. 8 y datos sensibles (art. 7) ⚖️ |
| **API o IA de terceros operada por el desarrollador** (clave del desarrollador en un backend) (C) | El desarrollador pasa a ser responsable del envío. Contrato de encargado o transferencia internacional. Revisar los términos del proveedor: **uso para entrenamiento**, retención, región. Divulgación destacada y consentimiento. Data safety ("compartido" o "recopilado"). Política de IA generativa de Play: denuncias dentro de la app |
| **Sincronización o almacenamiento en la nube** (D) | Todo lo de B, más cifrado en tránsito y en reposo (idealmente **de extremo a extremo**: si el desarrollador no puede leer los datos, no se declaran como recopilados), borrado completo al dar de baja, plazos de conservación, respaldo y notificación de incidentes ⚖️ |
| **Anuncios** | Declararlos en Play. Política de anuncios y Families si hay menores. SDK de anuncios en Data safety. Consentimiento para perfiles publicitarios (art. 27 de la Ley 25.326). **Nunca usar el contenido de documentos para publicidad** |
| **Compras o suscripciones** | Google Play Billing (en TWA, la Digital Goods API). Información del precio (Ley 24.240 art. 4 y CCyC 1100). **Botón de arrepentimiento y revocación en 10 días** (CCyC 1110) ⚖️. Facturación e impuestos ⚖️ |
| **Firma digital real** | Certificador licenciado (Ley 25.506 y normas de aplicación) ⚖️ |
| **Integraciones con organismos judiciales o penitenciarios** | Convenio con el organismo, que es el responsable del tratamiento y el que puede tratar antecedentes (art. 7.4). El desarrollador quedaría como **encargado** (art. 25) ⚖️ |

---

## 4. Las cuatro modalidades de procesamiento

| | A. Solo local | B. Servidor propio | C. API o IA de terceros | D. Nube |
|---|---|---|---|---|
| ¿El desarrollador recibe el documento? | **No** | Sí | Depende: **no**, si la clave es del usuario y el envío va del dispositivo al proveedor; **sí**, si pasa por su backend | Sí, salvo cifrado de extremo a extremo |
| Ley 25.326 respecto del contenido | El usuario trata sus propios documentos; el desarrollador no es responsable de esa base. Conviene informarlo igual | **Responsable** (arts. 4 a 12, 14, 16 y 21) | Si el desarrollador opera el envío: responsable y **transferencia internacional** (art. 12, contratos modelo). Si es BYOK: divulgación y consentimiento, y el usuario elige al proveedor | Responsable, con custodia, seguridad reforzada y plazos |
| Data safety | **No se declara** (dato procesado en el dispositivo) | Se declara | Se declara como "compartido", salvo la excepción de acción del usuario con divulgación destacada ⚖️ | Se declara (salvo E2EE) |
| Consentimiento en la app | No para el procesamiento. Sí para cámara y micrófono (permisos del sistema) | Divulgación destacada y consentimiento | Divulgación destacada y consentimiento **antes de cada envío** o con opción clara | Divulgación, consentimiento y opción de desactivar |
| Datos sensibles y antecedentes penales | Riesgo bajo para el desarrollador | **Riesgo alto**: art. 7 y **7.4** | **Riesgo alto**: el proveedor recibe el contenido | **Riesgo alto** |
| Borrado | Lo hace el usuario en el dispositivo | Canal de supresión (art. 16: 5 días hábiles) | Depende del proveedor: informar su política | Borrado completo, incluidas copias de respaldo en un plazo informado |

**Conclusión.** El modelo actual es mayormente local y es el de menor riesgo. Los puntos de exposición son la IA en la nube, los traductores, el dictado y las cuentas. Si se mantiene así, casi toda la carga legal se concentra en las **cuentas** y en **informar bien** los envíos opcionales.

---

## 5. Documentos con datos personales, sensibles o de terceros

Documentos con DNI, nombres, domicilios, teléfonos, firmas, fotos, datos laborales, judiciales, médicos o financieros, expedientes o datos de terceros:

- **En modo local (A):** los datos no salen del dispositivo. El usuario es quien los trata. En la práctica, la responsabilidad del desarrollador se limita a la **seguridad del software** (Ley 24.240) y a **no prometer más de lo que la app hace**.
- **Datos de salud** y otros **sensibles** (Ley 25.326 art. 2 y 7): si alguna vez llegaran a un servidor del desarrollador, harían falta una base legal específica y medidas reforzadas. **Recomendación:** no recibirlos nunca.
- **Antecedentes penales o contravencionales** (art. 7.4): solo pueden tratarlos **autoridades públicas competentes**. Si la app la usan agentes judiciales o penitenciarios en su trabajo, lo hacen bajo la autoridad de su organismo. El desarrollador **no debe recibir ni guardar** esos datos, y conviene que el organismo **autorice formalmente** el uso de la app ⚖️.
- **Envío a IA o traducción (C):** el contenido llega a terceros, a menudo fuera del país. Por eso la app debe:
  - mostrar la advertencia antes de enviar (ya existe para Nexa y hay que sumarla a los traductores);
  - sugerir usar la **censura** para tapar datos antes de enviar;
  - permitir desactivar todas las funciones con internet.
- **Documentos de terceros:** el usuario declara que tiene derecho o autorización para tratarlos (términos) y la app no los usa para nada más.
- **Firmas:** las firmas guardadas quedan solo en el dispositivo (`ds_sigs`). Hay que advertir que pegar una firma no equivale a firma digital y que usarla sin autorización puede ser ilícito.

**Compromisos que conviene poner por escrito** (en la política y los términos):

- Danscanner Pro **no usa** el contenido de los documentos para publicidad.
- **No los vende.**
- **No crea perfiles** con ellos.
- **No los usa para entrenar modelos** de IA.
- **No hace análisis comercial** de ellos.

---

## 6. Medidas técnicas de seguridad

| Medida | Estado hoy | Acción |
|---|---|---|
| Procesamiento local por defecto | ✅ | Mantener. Que las funciones con internet estén **apagadas por defecto** |
| HTTPS y HSTS | ✅ (en `vercel.json`) | Mantener |
| CSP estricta | ✅ | Quitar los orígenes que dejen de usarse (MyMemory, `gtx`) |
| Cifrado en reposo | ⚠️ IndexedDB sin cifrar | Cifrar los documentos con una clave derivada del PIN (WebCrypto AES-GCM) cuando el usuario active el bloqueo |
| Respaldo cifrado | ✅ `.dsbackup` | Recomendar la opción con contraseña |
| Borrado seguro | ⚠️ | Botón "Borrar todos los datos de este dispositivo": IndexedDB, localStorage, cachés y service worker |
| Mínimo de permisos | ✅ cámara y micrófono al usarlos | En el TWA, no declarar READ_MEDIA_*, ubicación ni contactos |
| Claves de API | ✅ No hay claves secretas en el código. Las de IA las carga el usuario | **Nunca** poner claves propias en el APK o la web. Si se ofrece IA "del desarrollador", hacerlo con un backend y cuotas por usuario |
| Clave pública de Supabase | ✅ Es pública por diseño (anon o publishable) | La seguridad depende de las **RLS**. Auditarlas antes de publicar |
| Frontend y backend separados | ✅ | Toda operación privilegiada con funciones en el servidor (por ejemplo, borrar la cuenta) |
| Control de acceso | ✅ RLS y roles | Revisar que `is_admin()` no se pueda escalar. Activar la confirmación de correo |
| Logs sin datos sensibles | ✅ `sbLog` guarda solo eventos | No registrar nunca texto de documentos. Revisar los logs de Supabase |
| Cadena de suministro | ⚠️ Carga desde CDN con respaldo local | Servir todo desde `libs/`. Si se usa CDN, fijar la versión con SRI |
| Dependencias | ⚠️ SheetJS 0.18.5 está afectada por **CVE-2023-30533** (contaminación de prototipo al leer archivos manipulados, corregida en 0.19.3) y **CVE-2024-22363** (ReDoS, corregida en 0.20.2), según los [avisos de SheetJS](https://cdn.sheetjs.com/advisories/) | Actualizar a la versión 0.20.2 o posterior desde cdn.sheetjs.com y revisar el resto de las dependencias |

---

## 7. Información que falta para cerrar los documentos

1. **Responsable:** nombre completo o razón social, **CUIT**, domicilio legal, correo de privacidad y soporte, teléfono (opcional).
2. ¿Persona física o **empresa**? ¿La cuenta de Google Play es **personal u organización**?
3. **Nombre definitivo** de la app y del paquete Android (por ejemplo, `ar.danscanner.pro`).
4. **Dominio público** donde se alojarán la política, los términos y la página de baja (por ejemplo, `danscanner.app/privacidad`).
5. **Región del proyecto Supabase** y plan (para evaluar transferencia internacional y contrato de encargado).
6. ¿Las cuentas van a ser **abiertas al público** o solo por invitación de un organismo?
7. ¿La app se va a ofrecer **a organismos públicos** (Servicio Penitenciario, Poder Judicial)? ¿Con convenio?
8. ¿**Nexa** va a estar disponible para usuarios comunes o solo para administradores?
9. ¿Se van a mantener los **traductores externos**? ¿Cuáles?
10. ¿Habrá **anuncios, compras o suscripciones**? ¿Precio?
11. **Edad mínima** (recomendado 18+).
12. Plazos de **conservación** de cuentas inactivas y de copias de seguridad de Supabase.
13. ¿Existe **logo registrado** o marca en trámite? ¿Quién diseñó el logo? (hace falta la cesión de derechos si lo hizo un tercero)
14. ¿Algún **contenido de terceros** en la ficha (capturas, imágenes, textos)?
15. Canal y plazo de **atención de reclamos** de consumidores.

---

## 8. Qué debería revisar un abogado argentino ⚖️

1. Si la base de cuentas debe **inscribirse** en el Registro Nacional de Bases de Datos (Decreto 1558/2001, art. 1) y cómo.
2. **Transferencia internacional**: Supabase y proveedores de IA en EE. UU. u otros países. ¿Consentimiento expreso (Decreto 1558 art. 12) o contratos modelo (Disp. 60/2016 y Res. AAIP 198/2023)?
3. **Art. 7.4 de la Ley 25.326**: uso de la app por agentes que manejan antecedentes penales. Si hace falta autorización del organismo y el rol del desarrollador (responsable o encargado).
4. **Datos de salud** (informes psicológicos o médicos de internos) y su tratamiento, aun local.
5. Redacción de la **limitación de responsabilidad** compatible con la Ley 24.240 art. 37 y el CCyC 988.
6. **Jurisdicción y ley aplicable** para consumidores (CCyC 1109 y 2654) y para usuarios profesionales o empresas.
7. Si la información debe darse en **soporte físico** (Ley 24.240 art. 4, texto de la Ley 27.250) y cómo obtener la opción expresa por el medio electrónico.
8. Contrato de **encargado** con Supabase y con proveedores de IA si se opera con claves propias.
9. **Registro de marca** (INPI) y depósito del software (DNDA).
10. Si se agregan pagos: **botón de arrepentimiento**, facturación e impuestos.
11. Cumplimiento de la **política de IA generativa** de Play para Nexa y si conviene separarla.

---

## 9. Fuentes consultadas (29/09/2026)

**Argentina (InfoLeg):**
- [Ley 25.326](https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm)
- [Decreto 1558/2001](https://servicios.infoleg.gob.ar/infolegInternet/anexos/70000-74999/70368/norma.htm)
- [Ley 24.240](https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm)
- [Ley 11.723](https://servicios.infoleg.gob.ar/infolegInternet/anexos/40000-44999/42755/texact.htm)
- [Ley 25.506](https://servicios.infoleg.gob.ar/infolegInternet/anexos/70000-74999/70749/texact.htm)
- [Ley 27.078](https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/239771/texact.htm)
- [Código Civil y Comercial](https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/norma.htm)

**AAIP:**
- [Transferencias internacionales](https://www.argentina.gob.ar/transferencias-internacionales)
- [Resolución AAIP 198/2023](https://servicios.infoleg.gob.ar/infolegInternet/anexos/390000-394999/391538/norma.htm)
- [Obligaciones de los responsables](https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones)
- [Registrar bases de datos privadas](https://www.argentina.gob.ar/registrar-bases-de-datos-personales-privadas)

**Google Play:**
- [User Data](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Buenas prácticas de divulgación destacada](https://support.google.com/googleplay/android-developer/answer/11150561)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Eliminación de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Permisos de fotos y videos](https://support.google.com/googleplay/android-developer/answer/14115180)
- [Contenido generado por IA](https://support.google.com/googleplay/android-developer/answer/14094294)
- [Declarar contenido de IA](https://support.google.com/googleplay/android-developer/answer/17262077)
- [Anuncio del 15/07/2026](https://support.google.com/googleplay/android-developer/answer/17134731)
- [Nivel de API objetivo](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Pruebas para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Clasificación de contenido](https://support.google.com/googleplay/android-developer/answer/9898843)
- [Público objetivo](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Verificación de desarrolladores de Android](https://developer.android.com/developer-verification)
- [Trusted Web Activities](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)

**Terceros:**
- [Web Speech API en el dispositivo (Chrome 139)](https://developer.chrome.com/blog/new-in-chrome-139)
- [Licencia Qwen2.5-3B](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/LICENSE)
- [Términos de MyMemory](https://mymemory.translated.net/terms-and-conditions)
- Licencias de las bibliotecas: ver `licencias-de-terceros.md`.
