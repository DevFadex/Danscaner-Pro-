# Propiedad intelectual de Danscanner Pro

**Análisis al 29/09/2026.** ⚖️ Revisión recomendada por un abogado de propiedad intelectual.

## 1. Qué protege la ley y cómo

| Elemento | Régimen | Cómo protegerlo | Estado / acción |
|---|---|---|---|
| **Software** (código fuente y objeto) | Obra protegida por la **Ley 11.723** (art. 1, incorporado por la Ley 25.036). Se explota por licencias de uso o reproducción (art. 55 bis) | La protección nace con la creación. El **depósito o registro en la DNDA** sirve como prueba de autoría y fecha. **Recomendado** | Depositar una versión con el código propio (sin las bibliotecas de terceros) |
| **Nombre "Danscanner Pro"** y **logotipo** | **Marca**: se protege con el **registro ante el INPI** (Ley 22.362, no consultada en esta sesión) | Buscar antecedentes, registrar en las clases que correspondan (por ejemplo, software y servicios) | ✅ Unificado como **"Danscanner Pro"** (v57). Búsqueda web del 29/09/2026 sin coincidencias. **Falta buscarlo en el INPI** antes de registrarlo |
| **Diseño e interfaz** | Pueden protegerse como obra (aspectos originales) o, según el caso, como modelo o diseño industrial | Guardar pruebas de fecha: capturas, repositorio con historial | El historial de Git ya es evidencia de fecha |
| **Textos propios** (manual, ayuda, base de conocimiento, textos de Nexa) | Obra literaria (Ley 11.723) | Aviso de copyright en la app | — |
| **Íconos SVG propios** | Obra, si son originales | Aviso de copyright | Confirmar que ninguno esté copiado de otro set |
| **Nombre "Nexa"** | Posible marca | Buscar antecedentes en el INPI antes de promocionarlo | ⚖️ Verificar que no haya conflicto con marcas registradas |
| **Bibliotecas de terceros** | Licencias de cada autor | Cumplir sus condiciones | Ver [Licencias de Terceros](./licencias-de-terceros.md) |
| **Modelos de IA** | Licencias de los modelos | Cumplir sus condiciones | **Quitar Qwen2.5-3B** si hay uso comercial |
| **APIs** | Términos de cada proveedor | Cumplir sus términos | **Reemplazar el traductor no oficial** |
| **Documentos de los usuarios** | Del usuario o de sus autores | La app no adquiere derechos | Declarado en los Términos |

## 2. Titularidad

- Si el código lo escribió el titular, le pertenece. Si participó otra persona (programador, diseñador), hace falta un **contrato de cesión de derechos** por escrito ⚖️.
- **Código escrito con ayuda de herramientas de IA:** conviene que el titular revise, adapte y documente su intervención creativa. La protección de lo generado por IA está en discusión en varias jurisdicciones ⚖️.
- **Repositorio:** `DevFadex/Danscaner-Pro-` en GitHub **no tiene archivo LICENSE**. Verificá si está **público**: en ese caso vale lo que sigue. Sin licencia explícita, por defecto no se otorgan permisos de uso, pero:
  - el código queda visible y copiable en la práctica;
  - conviene agregar un `LICENSE` con **"Todos los derechos reservados"** y la referencia a la Licencia de Uso;
  - **evaluar hacer privado el repositorio**, sobre todo porque contiene configuración (`config.js`), transcripciones y la lógica completa.

## 3. Aviso para mostrar en la app

> © [AÑO] [TITULAR]. Danscanner Pro, su logo, su interfaz y su software propio están protegidos por la Ley 11.723 y las normas de marcas. Todos los derechos reservados. Los componentes de terceros se usan según sus licencias (ver "Licencias de terceros").
