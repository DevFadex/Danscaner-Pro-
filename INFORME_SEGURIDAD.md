# Informe de seguridad — Danscanner Pro

Revisión completa de la app: cómo maneja los datos, los permisos, la comunicación con servicios de internet y el guardado de información.

## 1. Qué encontré y por qué era un riesgo real

**a) Archivos HTML con código escondido.** Al convertir un HTML a PDF, la app metía el archivo tal cual dentro de la página. Solo sacaba las etiquetas `<script>`, pero un archivo preparado con mala intención podía ejecutar código igual (por ejemplo con `onerror=` dentro de una imagen). Ese código corría con los mismos permisos que la app: podía leer los documentos guardados o la clave de IA.

**b) Documentos Word con contenido activo.** La vista previa de Word mostraba el documento sin revisarlo. Mismo riesgo que el anterior.

**c) Sin control de qué se puede cargar y adónde se puede conectar.** La página aceptaba scripts de cualquier lado. Si alguien lograba inyectar algo, podía mandar los datos a un servidor propio.

**d) La clave de inteligencia artificial quedaba guardada siempre.** Se guardaba en el navegador sin opción de evitarlo. Cualquiera con el teléfono desbloqueado (o cualquier código malicioso) podía llevársela y gastar tu cuenta.

**e) El traductor y la IA mandaban el texto a internet sin avisar.** Un descuido podía terminar en datos de un interno o de un expediente saliendo del teléfono, sin que nadie lo advirtiera.

**f) Los documentos escaneados quedaban accesibles con solo abrir la app.** Sin ninguna traba: teléfono prestado o perdido = documentos a la vista.

**g) No había forma de limitar quién usa la app** una vez publicada en internet.

## 2. Qué cambié

1. **Limpieza de archivos ajenos.** Todo HTML y todo Word que entra se revisa antes de mostrarse: se sacan scripts, marcos, formularios, los atributos de eventos (`onclick`, `onerror`, etc.) y los enlaces `javascript:`.
2. **Reglas de seguridad del navegador (CSP).** La app ahora declara de dónde puede cargar código (solo los CDN conocidos) y bloquea todo lo demás. Está en la propia página y reforzado en el servidor con `vercel.json`, que además agrega protección contra encuadre en otras webs, contra adivinar tipos de archivo y deja la cámara habilitada solo para la app.
3. **Clave de IA opcional en memoria.** En Ajustes → Seguridad podés elegir que la clave no se guarde: queda solo mientras la app está abierta.
4. **Aviso antes de mandar algo a internet.** La primera vez que uses el traductor o la IA, la app avisa qué se envía y adónde, y pide confirmación. Se puede volver a activar el aviso cuando quieras.
5. **Bloqueo con PIN.** Con PBKDF2 y 150.000 vueltas (o sea, no se guarda el PIN sino una huella difícil de revertir). Bloquea al abrir y a los 5 minutos de inactividad.
6. **Control de acceso con administrador.** Ver el instructivo de Vercel y Supabase: entrada por correo, lista de usuarios, dar y quitar acceso, y enlaces de invitación que vencen a los 7 días. Los permisos están puestos en la base de datos (RLS), no solo en la pantalla: aunque alguien manipule la app desde el navegador, la base no le deja tocar los datos de otros.
7. **Enlaces externos** abren con `noopener`, y las vistas previas de HTML corren en un marco aislado sin permiso para ejecutar nada.

## 3. Lo que decidí y conviene que sepas

- **Los documentos no se suben a ningún servidor.** Supabase se usa solo para saber quién puede entrar. Es la opción más segura para documentación penitenciaria: si mañana querés que se sincronicen entre equipos, hay que pensar cifrado y resguardo aparte.
- **El PIN traba la app, no cifra los archivos.** Una persona con conocimientos técnicos y el equipo en la mano podría leer la base del navegador. Para cifrar de verdad hay que rearmar cómo se guardan los documentos; se puede hacer si lo necesitás.
- **La clave de IA vive en el dispositivo.** No hay forma de usarla desde el navegador sin exponerla un poco; por eso conviene una clave con límite de gasto, y borrarla si prestás el equipo.
- **Los CDN son un punto de confianza.** La app carga librerías de cdnjs y jsdelivr con la versión fijada. Es lo habitual, pero si alguna vez esos servicios fueran comprometidos, el código llegaría a la app. La alternativa es guardar las librerías dentro del repositorio.

## 4. Recomendaciones para mantenerla segura

1. Revisá cada tanto la lista de usuarios y sacá a quienes ya no corresponden.
2. Que cada teléfono tenga el Bloqueo con PIN activado y bloqueo de pantalla del sistema.
3. No uses el traductor ni la IA con datos de internos, causas o documentación reservada.
4. Borrá de la app los documentos que ya elevaste; no la uses como archivo permanente.
5. Si perdés un teléfono: quitale el acceso desde Administrar accesos y cambiá la clave de IA.
6. No pases el enlace de invitación por grupos abiertos; mandalo a la persona directamente.
7. Mantené el repositorio sin archivos con datos reales (planillas, fotos, PDF de expedientes).
