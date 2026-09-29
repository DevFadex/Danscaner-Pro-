# Leyes para Nexa (textos oficiales de InfoLeg)

Nexa consulta los códigos sin internet a partir de archivos en `knowledge/leyes/`. Se arman con dos pasos:

```bash
pip install graphifyy            # graphify (Apache-2.0): arma el grafo de remisiones entre artículos
python3 tools/leyes/descargar.py # baja de InfoLeg los textos listados en fuentes.json (necesita acceso a servicios.infoleg.gob.ar)
python3 tools/leyes/construir.py # separa por artículo y genera indice.json, <ley>.json, relaciones.json y graphify-out/graph.json
```

- `fuentes.json`: qué normas se cargan (Código Penal, Código Procesal Penal Federal, Código Procesal Penal de la Nación y Ley 24.660), con su URL oficial y los nombres con que se las puede pedir.
- Cada artículo guarda su texto, el libro / título / capítulo, la URL de InfoLeg y la fecha de descarga; Nexa los muestra como **texto oficial** con esa fuente.
- `relaciones.json` sale del grafo de graphify (`knowledge/leyes/graphify-out/graph.json`): para cada artículo, a qué artículos remite y cuáles lo citan. Se puede explorar con `graphify explain "CP art. 80" --graph knowledge/leyes/graphify-out/graph.json`.
- Para actualizar los textos, volver a correr los dos scripts y subir los archivos. Son normas públicas: no contienen datos de personas.
