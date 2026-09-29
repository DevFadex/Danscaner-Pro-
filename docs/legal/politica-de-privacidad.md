# Política de Privacidad de Danscanner Pro

**Versión:** 1.0 · **Vigente desde:** [FECHA DE PUBLICACIÓN] · **Última actualización:** [FECHA]

> Borrador preparado el 29/09/2026 a partir de la Ley 25.326, el Decreto 1558/2001 y la política User Data de Google Play vigentes a esa fecha. Completar los datos entre corchetes y hacerlo revisar por un abogado antes de publicar. Tiene que publicarse en una **URL pública en formato HTML** (no PDF) y enlazarse desde la app y desde Play Console.

## 1. Quién es el responsable

**Responsable:** [NOMBRE COMPLETO O RAZÓN SOCIAL]
**CUIT:** [CUIT]
**Domicilio:** [DOMICILIO LEGAL], [LOCALIDAD], Provincia de [PROVINCIA], República Argentina
**Correo de privacidad:** [CORREO] · **Sitio:** [URL]

En esta política, "Danscanner Pro", "la app", "nosotros" o "el responsable" se refieren a la aplicación Danscanner Pro y a su responsable. "Vos" o "el usuario" es la persona que usa la app.

## 2. Lo más importante, en pocas líneas

- **Tus documentos son tuyos.** Escaneo, filtros, recorte, PDF, OCR (reconocimiento de texto), estilos de imagen y la IA "sin internet" **funcionan dentro de tu dispositivo**. No recibimos esos documentos.
- Solo salen del dispositivo si **vos** usás una función con internet: IA en la nube, traductor o dictado por voz. La app **te avisa antes** y podés no usarlas.
- **No vendemos** tus datos. **No usamos** el contenido de tus documentos para **publicidad**, **perfiles**, **análisis comercial** ni para **entrenar modelos de IA**.
- Si creás una **cuenta**, guardamos tu correo, tu nombre y tu estado de acceso para permitirte entrar. Podés **pedir que la borremos** (sección 11).

## 3. Qué datos se tratan y dónde

### 3.1 Datos que quedan solo en tu dispositivo (no los recibimos)

| Dato | Para qué | Dónde queda |
|---|---|---|
| Fotos tomadas con la cámara y archivos que importás (imágenes y PDF) | Crear y editar tus documentos | Almacenamiento interno del navegador o la app (IndexedDB) |
| Texto reconocido por OCR | Buscar, copiar, exportar, nombrar y organizar el documento automáticamente | Igual que arriba |
| Firmas que guardás | Insertarlas en tus PDF | Almacenamiento local |
| Preferencias, carpetas, etiquetas, PIN de bloqueo, memoria de Nexa (por ejemplo, cómo querés que te llame) | Configurar la app | Almacenamiento local |
| Claves de API de IA que cargues | Usar el proveedor de IA que elijas | Almacenamiento local. Podés pedir que se borren al cerrar la app |
| Modelos de IA locales | Usar Nexa sin internet | Caché del dispositivo. Se descargan de Hugging Face; esa descarga **no envía tus documentos** |

Estos datos **no se transmiten** a nosotros. Se borran si eliminás los documentos, si usás "Borrar todos los datos de este dispositivo" o si desinstalás la app o borrás los datos del navegador.

### 3.2 Datos que tratamos nosotros (solo si usás una cuenta)

| Dato | Finalidad | Base |
|---|---|---|
| Correo electrónico | Identificarte e iniciar sesión, recuperar la contraseña, avisos del servicio | Necesario para brindarte el servicio que pediste (Ley 25.326 art. 5, inc. 2 d) |
| Contraseña | Iniciar sesión. **La guarda el proveedor de autenticación en forma cifrada (hash): nadie, ni el administrador, puede verla** | Igual que arriba |
| Nombre y apellido | Mostrarlo en la app y en la administración de accesos | Igual que arriba |
| Rol, estado (activo, pendiente, bloqueado), fecha de alta, invitaciones | Controlar quién puede usar la app | Igual que arriba |
| Datos técnicos de la sesión (fecha y hora de acceso, tokens, IP registrada por el proveedor) | Seguridad y prevención de abusos | Interés legítimo en la seguridad del servicio (art. 9) |

**No guardamos tus documentos en nuestros servidores.**

### 3.3 Datos que se envían a terceros solo cuando usás ciertas funciones

| Función (opcional) | Qué se envía | A quién | Cuándo |
|---|---|---|---|
| **Nexa con internet** | El texto de tu consulta y, si lo pedís, el texto o fragmento del documento | Al proveedor que elijas (Google Gemini, OpenAI o Anthropic), con **tu propia clave**. El envío va **directo desde tu dispositivo** a ese proveedor | Solo después de que confirmes el aviso de envío |
| **Traductor** | El texto a traducir | [SERVICIO DE TRADUCCIÓN QUE QUEDE ACTIVO] | Solo cuando tocás "Traducir" y aceptás el aviso |
| **Dictado por voz** | El audio de tu voz | El servicio de reconocimiento de voz del navegador o del sistema. En Chrome, por defecto, un servicio de Google. Si tu dispositivo lo permite, la app usa el reconocimiento **dentro del dispositivo** | Solo mientras mantenés activo el micrófono |
| **Carga de la app y bibliotecas** | Dirección IP y datos técnicos del navegador (no documentos) | Proveedores de hosting y distribución de contenido: [VERCEL / CDN QUE SE USEN] | Al abrir o actualizar la app |

Estos proveedores tratan los datos según **sus propias políticas**, que te recomendamos leer:
- Google: <https://policies.google.com/privacy>
- OpenAI: <https://openai.com/policies/privacy-policy>
- Anthropic: <https://www.anthropic.com/legal/privacy>
- [OTROS]

Cuando el envío lo hacés **con tu propia clave**, la relación de uso de ese servicio es **entre vos y el proveedor**. Nosotros no recibimos ni vemos lo que se envía.

## 4. Permisos del dispositivo

| Permiso | Para qué | Cuándo se pide |
|---|---|---|
| **Cámara** | Escanear documentos | Al tocar "Escanear". Podés negarlo e importar archivos |
| **Micrófono** | Dictar a Nexa | Solo si activás el dictado. Se puede apagar en Ajustes |
| **Archivos y fotos** | Importar imágenes o PDF que **vos elegís** con el selector del sistema | Al importar. La app no recorre tu galería |
| **Notificaciones** (si se habilitan) | [FINALIDAD] | [CUÁNDO] |

La app **no** pide ubicación, contactos, SMS ni registro de llamadas.

## 5. Documentos con datos personales, sensibles o de terceros

Tus documentos pueden tener DNI, domicilios, teléfonos, firmas, fotos, datos laborales, judiciales, médicos o financieros, expedientes o datos de **otras personas**.

- Mientras uses las funciones locales, esos datos **no salen de tu dispositivo** y **no los recibimos**.
- **Antes de enviar un documento a la IA en la nube o a un traductor**, fijate si contiene datos sensibles (salud, origen, opiniones políticas o religiosas, vida sexual, entre otros; Ley 25.326 art. 2) o datos de terceros. Si es así, usá la herramienta **Censurar** para taparlos o no los envíes.
- Si usás la app en tu **trabajo** (por ejemplo, en un organismo público), seguí las instrucciones de tu organismo sobre el manejo de documentos. Los datos sobre **antecedentes penales o contravencionales** solo pueden ser tratados por las autoridades públicas competentes (Ley 25.326 art. 7.4).
- Al tratar datos de terceros, **vos sos responsable** de contar con el derecho o la autorización para hacerlo.

## 6. Lo que **no** hacemos con tus datos

- No vendemos ni alquilamos datos personales.
- No usamos el contenido de tus documentos para publicidad, perfiles, análisis comercial ni para entrenar modelos de IA propios o de terceros.
- No compartimos tus datos con terceros, salvo:
  - lo indicado en la sección 3.3, a pedido tuyo;
  - proveedores que nos prestan servicios por nuestra cuenta (sección 7);
  - una orden de autoridad competente o una obligación legal.
- No incluimos anuncios ni herramientas de seguimiento publicitario. [SI SE AGREGAN, ACTUALIZAR ESTA POLÍTICA ANTES]

## 7. Proveedores que tratan datos por nuestra cuenta (encargados)

| Proveedor | Servicio | Datos | País o región |
|---|---|---|---|
| Supabase Inc. | Autenticación y base de datos de cuentas | Los de la sección 3.2 | [REGIÓN DEL PROYECTO] |
| [Vercel Inc.] | Hosting de la app web | Datos técnicos de acceso (IP, fecha y hora) | [REGIÓN] |
| [OTROS] | | | |

Estos proveedores actúan según nuestras instrucciones y están obligados a mantener la seguridad y la confidencialidad (Ley 25.326 art. 25 y Decreto 1558/2001 art. 25).

## 8. Transferencias internacionales

Algunos proveedores pueden estar **fuera de Argentina**, incluso en países que no están en la lista de protección adecuada de la AAIP (por ejemplo, Estados Unidos). En esos casos, la transferencia se hace:
- con tu **consentimiento expreso**, que se te pide en la app (Decreto 1558/2001 art. 12); y/o
- con **cláusulas contractuales** aprobadas por la autoridad de control (Disposición DNPDP 60/2016 y Resolución AAIP 198/2023).

[⚖️ Completar según la región de cada proveedor.]

## 9. Cuánto tiempo guardamos los datos

- **Documentos:** no los guardamos. En tu dispositivo quedan hasta que los borres.
- **Cuenta:** mientras esté activa. Si la cerrás o pedís la eliminación, borramos los datos de la cuenta en un plazo máximo de [30] días, salvo lo que debamos conservar por **obligación legal** (sección 11.4).
- **Registros técnicos de seguridad:** hasta [90] días. [AJUSTAR SEGÚN LO QUE PERMITA EL PROVEEDOR]
- **Copias de seguridad del proveedor:** se sobrescriben en un máximo de [PLAZO].

## 10. Seguridad

Tomamos medidas técnicas y organizativas razonables (Ley 25.326 art. 9), entre ellas:
- conexión cifrada (HTTPS);
- procesamiento local por defecto;
- control de acceso por roles y reglas de seguridad en la base de datos;
- contraseñas guardadas con hash por el proveedor de autenticación;
- ninguna clave secreta propia dentro de la app;
- respaldo con cifrado opcional;
- bloqueo de la app con PIN.

Ningún sistema es infalible. Te recomendamos:
- activar el **bloqueo con PIN** y el bloqueo de pantalla del dispositivo;
- hacer **respaldos cifrados**;
- no compartir tu cuenta.

## 11. Tus derechos y cómo ejercerlos

Como titular de los datos, tenés derecho a:
- **acceder** a ellos: te respondemos en un máximo de **10 días corridos** (Ley 25.326 art. 14);
- **rectificarlos**, **actualizarlos** o **suprimirlos**: en un máximo de **5 días hábiles** (art. 16);
- **revocar el consentimiento** que hayas dado, sin efecto retroactivo (Decreto 1558/2001 art. 5).

### 11.1 Cómo hacerlo
- Escribinos a **[CORREO DE PRIVACIDAD]** desde el correo de tu cuenta, o usá la opción de la app.
- Podemos pedirte que acredites tu identidad.

### 11.2 Borrar tus documentos
En la app: **Documentos → Seleccionar → 🗑**. Para borrar todo: **Ajustes → Borrar todos los datos de este dispositivo**. [IMPLEMENTAR]

### 11.3 Eliminar tu cuenta
- En la app: **Ajustes → Cuenta → Eliminar mi cuenta**. [IMPLEMENTAR]
- En la web: **[URL DE ELIMINACIÓN]**.
- Ver también la [Política de Eliminación de Datos](./eliminacion-de-datos.md).

### 11.4 Qué podríamos conservar
Solo lo necesario para cumplir una obligación legal, resolver reclamos o prevenir fraudes, por el plazo que la ley exija, y bloqueado para cualquier otro uso.

### 11.5 Autoridad de control
**La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.** Sitio: <https://www.argentina.gob.ar/aaip>

> ⚖️ Verificar con un abogado el texto vigente de la leyenda que la AAIP exige incluir.

## 12. Menores de edad

La app está dirigida a **mayores de 18 años**. No está destinada a niños y no recopilamos a sabiendas datos de menores. Si detectamos una cuenta de un menor, la eliminamos.

## 13. Cambios en esta política

Si cambiamos esta política, publicamos la nueva versión con su fecha y te avisamos dentro de la app. Si el cambio amplía el uso de tus datos, te pedimos de nuevo el consentimiento antes de aplicarlo.

## 14. Contacto

**[NOMBRE DEL RESPONSABLE]** · [CORREO] · [DOMICILIO]
