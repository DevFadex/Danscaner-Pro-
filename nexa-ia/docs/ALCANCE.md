# Nexa IA 1.0 (app web) — qué hace hoy y qué queda para la versión nativa

La arquitectura completa ([`ARQUITECTURA.md`](ARQUITECTURA.md)) es para apps nativas de Android e iOS
(Kotlin/Swift, ~9 meses de un equipo). Esta carpeta es la **primera versión usable**: una app web instalable (PWA)
que corre en el celular, hecha igual que Danscanner Pro y Asistente Judicial Pro (HTML + JavaScript, sin compilar).

Regla de esta versión: **no prometer nada que una app web no pueda hacer de verdad.**

## Lo que ya funciona

| Pieza de la arquitectura | En Nexa IA 1.0 | Archivo |
|---|---|---|
| Bóveda cifrada (§5) | PIN o frase → PBKDF2-SHA256 (310.000 vueltas) → envuelve una clave de datos AES-GCM 256. Todo lo guardado va cifrado. Cambiar el PIN re-envuelve la clave sin volver a cifrar todo. «Borrar todo» = borrado criptográfico. | `js/boveda.js`, `js/cifrado.js` |
| Bloqueo y accesos (§6.1 «Cuenta») | Registro de accesos e intentos fallidos de PIN, aviso al entrar, espera creciente después de 5 fallos, bloqueo automático en segundo plano. | `js/boveda.js`, `app.js` |
| Postura e integridad (§6.1, §8) | HTTPS, app dentro de otra página (clickjacking), navegador automatizado, almacenamiento persistente, permisos concedidos, huella SHA-256 de cada archivo por versión (avisa si cambian sin actualización). | `js/seguridad.js` |
| Agregador de riesgo (§6.2) | Puntaje 0–100 con pesos por nivel y registro de eventos (solo cuando algo cambia, para no cansar con avisos). | `js/seguridad.js` |
| Reglas deterministas (§6.2) | Enlaces (marcas imitadas, punycode, IP, acortadores, terminaciones raras, «@»), mensajes de estafa típicos de Argentina (código de WhatsApp, «cambié de número», CBU/alias, premios de ANSES…), fortaleza de contraseñas. | `js/seguridad.js` |
| Router de LLM (§7.1) | Primero lo propio y verificable (memoria, leyes, seguridad, cálculos), después IA en el teléfono, después IA en la nube (opcional, con tu clave), y si no hay nada: «no lo sé». | `js/asistente.js` |
| LLM en el dispositivo (§7.1) | WebLLM (Qwen 2.5 de 0,5B a 3B) con WebGPU, de Danscanner Pro. | `js/ia-local.js` |
| Redacción de datos personales (§7.1) | Antes de mandar a la nube se tapan DNI, CUIL, correos, teléfonos y tarjetas. | `js/ia-nube.js` |
| Seguridad del LLM (§7.4) | Reglas de verdad en cada pedido, textos pegados tratados como datos, control de los artículos de ley que cita la IA contra la base local. | `js/humano.js` |
| Plantillas sin LLM (§7.1) | Toda la seguridad, la memoria y las leyes funcionan sin IA. | — |
| Recordatorios (§7.3 `create_reminder`) | Con fecha y hora en lenguaje natural; aviso con la app abierta y, si estaba cerrada, apenas se abre. | `js/asistente.js` |

## Lo que pidió el dueño, además de la arquitectura

- **Modo humano**: responde natural (nombre, frase de entrada y de cierre), pero el contenido de la fuente no se toca.
  Se puede apagar (modo preciso). Prueba: «Modo humano: responde natural sin cambiar el contenido».
- **No miente ni omite**: cada respuesta muestra su fuente y su certeza («Sale de una fuente concreta»,
  «Me lo dijiste vos; no lo verifiqué», «Generado por IA: puede equivocarse», «No lo sé»). Las leyes se muestran con
  el texto oficial completo. El resumen de textos usa frases del propio texto.
- **Aprende a medida que van**: «recordá que…», «cuando te pregunte…, respondé…», el botón «Está mal» para corregir,
  «olvidá…», «¿qué sabés de mí?». Todo cifrado, visible y borrable en la pantalla Memoria. No guarda contraseñas.
- **Unifica las dos Nexa**: la jurídica de Asistente Judicial Pro (`js/juridico.js`, `js/voz.js`,
  `knowledge/leyes/`) y la documental de Danscanner Pro (`js/documental.js`, `js/ia-local.js`, `js/ia-nube.js`).

## Lo que una app web no puede hacer (y Nexa lo dice)

| Capacidad | Por qué no | Dónde se resuelve |
|---|---|---|
| Ver otras apps o su uso | El navegador no da acceso | Android nativo (`UsageStatsManager`) |
| Ver el tráfico o el Wi-Fi | Sin acceso a la red del sistema | `VpnService` / Network Extension |
| Detectar root/jailbreak o malware | Sin acceso al sistema | Play Integrity / App Attest |
| Vigilar en segundo plano | El celular suspende las apps web | Foreground Service / BGTaskScheduler |
| Clave en hardware (Keystore/Secure Enclave) y biometría | WebCrypto no expone el hardware de forma portable | Nativo; en web se podría sumar WebAuthn más adelante |
| Avisar a horario con la app cerrada | Las notificaciones programadas no son estándar en la web | Notificaciones nativas o push desde un servidor |

## Próximos pasos sugeridos

1. Desbloqueo con huella/cara usando WebAuthn (passkey del propio teléfono) como segundo factor de la bóveda.
2. Resguardo cifrado exportable (como el de Asistente Judicial Pro).
3. Empaquetar la PWA con Capacitor para Android y sumar los sensores nativos de la sección 6, empezando por UsageStats.
4. Lista de dominios de estafa actualizable y firmada (§6.2 «paquete firmado»).
