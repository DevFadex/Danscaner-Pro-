# Checklist para publicar Danscanner Pro en Google Play

Estado al 29/09/2026: ✅ listo · ⚠️ falta o hay que corregir · ⬜ trámite pendiente.

## Documentos y privacidad
- [ ] ⚠️ **Política de privacidad** completada con los datos del responsable (`politica-de-privacidad.md`)
- [ ] ⚠️ **URL pública de privacidad** en HTML, no PDF y sin geobloqueo. Enlazarla en Play Console y **dentro de la app**
- [ ] ⚠️ **Términos y condiciones** accesibles antes de aceptar (CCyC art. 985) y en Ajustes
- [ ] ⚠️ Licencia de uso, Aviso de IA y Política de eliminación de datos publicados
- [ ] ⚠️ **Pantalla de aceptación** con registro de versión y fecha
- [ ] ⚠️ Revisión por un **abogado** (ver `00-AUDITORIA.md` sección 8)

## Data safety (Play Console → Contenido de la app)
- [ ] ⬜ Completar el formulario:
  - **Recopilados:** correo, nombre e ID de usuario (cuentas).
  - Documentos **no**, porque se procesan en el dispositivo.
- [ ] ⬜ **Compartidos:** declarar el envío a IA, traductor y voz, o justificar la excepción de "acción iniciada por el usuario con divulgación destacada" ⚖️
- [ ] ⬜ Prácticas de seguridad: **cifrado en tránsito: sí** · **se puede pedir la eliminación: sí**
- [ ] ⬜ Preguntas de **eliminación de datos** y URL de baja
- [ ] ⚠️ Verificar que coincida con la política de privacidad

## Permisos
- [ ] ⬜ Cámara: se pide al escanear, con aviso previo
- [ ] ⬜ Micrófono: se pide al dictar, con aviso de que el audio puede salir del dispositivo
- [ ] ⬜ **No declarar READ_MEDIA_IMAGES ni READ_MEDIA_VIDEO**: usar el selector del sistema
- [ ] ⬜ No pedir ubicación, contactos, SMS ni registro de llamadas
- [ ] ⬜ Revisar el `AndroidManifest.xml` que genera Bubblewrap

## Funciones
- [ ] ✅ **OCR** local (Tesseract, Apache-2.0)
- [ ] ⚠️ **IA:** divulgación y consentimiento antes de enviar (ya existe para Nexa: revisar el texto contra `textos-en-la-app.md`)
- [ ] ⬜ **IA generativa (Nexa):** hoy solo la ve el administrador. Antes de habilitarla para usuarios: botón **Reportar respuesta**
- [ ] ⚠️ **Traductor:** reemplazar el endpoint `client=gtx` y revisar o quitar MyMemory. Agregar aviso previo
- [ ] ⚠️ **Dictado:** aviso previo y reconocimiento en el dispositivo cuando esté disponible
- [x] ✅ **Firmar PDF:** aviso de que no es firma digital (v57)
- [ ] ⚠️ **APIs externas:** ninguna clave propia en la app ✅. Las claves del usuario quedan locales ✅
- [ ] ⚠️ **SDKs y bibliotecas:** servir desde `libs/` y dejar de cargar CDN y Google Fonts en producción
- [ ] ⚠️ **Licencias:** incluir `LICENCIAS-TERCEROS.txt` y la pantalla de licencias. **Quitar Qwen2.5-3B** si hay uso comercial. SheetJS ✅ actualizada a 0.20.3 (v57)

## Cuentas y eliminación
- [ ] ⚠️ **Eliminar mi cuenta dentro de la app.** Función segura en el servidor: por ejemplo, una función SQL `security definer` que borre `auth.users` del usuario actual, o una Edge Function
- [ ] ⚠️ **Enlace web de eliminación** que nombre la app tal como figura en Play
- [ ] ⚠️ **Borrar todos los datos de este dispositivo**
- [ ] ⚠️ El borrado del administrador también tiene que eliminar `auth.users`, no solo `profiles`
- [ ] ⬜ **Acceso a la app:** cargar credenciales de prueba para la revisión de Google

## Clasificación, público y monetización
- [ ] ⬜ **Clasificación de contenido** (cuestionario IARC)
- [ ] ⬜ **Público objetivo: 18+**. Así no se aplica la política de Familias
- [ ] ⬜ **Anuncios:** declarar "No contiene anuncios"
- [ ] ⬜ **Compras:** ninguna por ahora. Si se agregan: Play Billing, precio, arrepentimiento y revocación
- [ ] ⬜ Declaración de **contenido generado por IA** en los recursos de la ficha, si corresponde

## Técnico y cuenta de desarrollador
- [ ] ⬜ Empaquetar como **TWA** (Bubblewrap) con `assetlinks.json` en `/.well-known/` y la huella de la **clave de firma de Google Play**
- [ ] ⬜ **API objetivo 36** (Android 16), exigida para apps nuevas desde el 31/08/2026
- [ ] ⬜ Cuenta personal nueva: **prueba cerrada con 12 testers durante 14 días**
- [ ] ⬜ **Verificación de identidad** del desarrollador y registro del paquete (Android developer verification)
- [ ] ⬜ **Información del desarrollador:** nombre, correo de contacto público y dirección si se exige. Sitio web
- [ ] ⬜ **Contacto de soporte** en la ficha
- [ ] ⬜ Ficha: descripción precisa (sin prometer "100 % seguro" ni validez legal), capturas reales, ícono y nombre unificado **"Danscanner Pro"**

## Argentina
- [ ] ⬜ Inscripción de la base de cuentas en el **Registro Nacional de Bases de Datos** (AAIP) ⚖️
- [ ] ⬜ Régimen de **transferencia internacional** según la región de Supabase y los proveedores ⚖️
- [ ] ⬜ **Marca** en el INPI y **depósito del software** en la DNDA (recomendado)
- [ ] ⬜ Autorización del **organismo** si se usa en el trabajo con documentos judiciales o penitenciarios ⚖️

## Revisión final
- [ ] ⬜ **Seguridad:** RLS de Supabase auditadas, sin datos en logs, CSP ajustada, dependencias actualizadas
- [ ] ⬜ **Privacidad:** política, Data safety, textos de la app y comportamiento real **coinciden**
- [ ] ⬜ Probar el flujo completo en un teléfono limpio: aceptación → escaneo → exportar → IA con aviso → borrar datos → eliminar cuenta
