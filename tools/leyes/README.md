# Leyes para Nexa (textos oficiales de InfoLeg)

Nexa consulta los códigos sin internet a partir de archivos en `knowledge/leyes/`. Se arman con dos pasos:

```bash
pip install graphifyy            # graphify (Apache-2.0): arma el grafo de remisiones entre artículos
python3 tools/leyes/descargar.py # baja de InfoLeg los textos listados en fuentes.json (necesita acceso a servicios.infoleg.gob.ar)
python3 tools/leyes/construir.py # separa por artículo y genera indice.json, <ley>.json, relaciones.json y graphify-out/graph.json
```

- `fuentes.json`: qué normas se cargan (Constitución Nacional, Código Penal, Código Procesal Penal Federal, Código Procesal Penal de la Nación, Ley 24.660, Ley 27.375, sus reglamentos —Decretos 18/97, 1136/97, 303/96, 140/2015 y 1139/2000— y Ley 23.737), con su URL oficial y los nombres con que se las puede pedir.
- Cada artículo guarda su texto, el libro / título / capítulo, la URL de InfoLeg y la fecha de descarga; Nexa los muestra como **texto oficial** con esa fuente.
- `relaciones.json` sale del grafo de graphify (`knowledge/leyes/graphify-out/graph.json`): para cada artículo, a qué artículos remite y cuáles lo citan. Se puede explorar con `graphify explain "CP art. 80" --graph knowledge/leyes/graphify-out/graph.json`.
- Normas que no se bajan de InfoLeg (PDF o copias escaneadas que provee el usuario: Ley 9.914, Res. 905/19, Res. 972/21 —protocolo de conflictos—, Decreto 396/99)
  van como texto en `transcripcion/` (un párrafo por renglón; los renglones sin punto final son títulos de sección) y en
  `fuentes.json` con `"transcripcion"`. Si falta la descarga de InfoLeg de una norma, `construir.py` conserva su `.json` ya armado.
- InfoLeg rechaza los pedidos sin identificación de navegador: `descargar.py` manda un User-Agent de navegador. La Constitución
  (`"estructura": "constitucion"`) se arma aparte: preámbulo, Parte › Título › Sección › Capítulo y disposiciones transitorias.
- Opciones por norma en `fuentes.json`: `desde` / `hasta` (recortan el texto: por ejemplo, solo el Anexo de un decreto),
  `arreglos` (erratas del original que impiden reconocer un artículo, como «Artículo 1 16») y `"estructura": "modificatoria"`
  (leyes que reforman otras, como la 27.375: cada artículo trae adentro el texto nuevo).
- Los títulos de sección que en InfoLeg quedan al final de cada artículo se sacan del texto y pasan a la ubicación (`u`)
  de los artículos siguientes, con el nombre de cada LIBRO / TÍTULO / CAPÍTULO.
- Para actualizar los textos, volver a correr los dos scripts y subir los archivos. Son normas públicas: no contienen datos de personas.

## graphify en Claude Code

El skill de graphify está en `.claude/skills/graphify/` (licencia Apache-2.0, con `LICENSE` y `NOTICE`), así que las sesiones de Claude Code en este repositorio pueden usar `/graphify`. El hook `.claude/hooks/session-start.sh` (configurado en `.claude/settings.json`) instala la herramienta `graphify` (`pip install graphifyy`) al iniciar cada sesión en la web.
