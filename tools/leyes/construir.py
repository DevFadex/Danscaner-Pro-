#!/usr/bin/env python3
"""Arma los archivos que usa Nexa a partir de los textos oficiales descargados.

- knowledge/leyes/<id>.json  : artículos (número, texto, libro/título/capítulo) + fuente y fecha
- knowledge/leyes/indice.json: lista de leyes disponibles
- knowledge/leyes/relaciones.json: artículos relacionados (remisiones entre artículos),
  calculados con graphify (grafo en knowledge/leyes/graphify-out/)

Uso: python3 tools/leyes/construir.py
"""
import html, json, re, pathlib

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
CRUDO = AQUI / "crudo"
SALIDA = RAIZ / "knowledge" / "leyes"

SUF = r"(?:\s*(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?"
RX_ART = re.compile(r"(?:^|\n)\s*ART[IÍ]CULO\s+(\d+" + SUF + r")\s*[º°o]?\s*[.:\-–—]+\s*", re.I)
RX_ENC = re.compile(r"^\s*(LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N|PARTE)\b[^\n]{0,120}$", re.I | re.M)
RX_REF = re.compile(r"\bart(?:[íi]culos?|s?\.)\s*((?:\d+" + SUF + r"(?:\s*[º°])?(?:\s*,\s*|\s+y\s+|\s+o\s+|\s+a\s+|\s*-\s*)?)+)", re.I)

def limpiar(h):
    h = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", h)
    h = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</h\d>|</li>|</tr>", "\n", h)
    h = re.sub(r"<[^>]+>", " ", h)
    h = html.unescape(h).replace("\xa0", " ")
    h = re.sub(r"[ \t]+", " ", h)
    return re.sub(r"\n\s*\n+", "\n", h).strip()

def norm_num(n):
    n = re.sub(r"\s+", " ", n.strip().lower()).replace("quáter", "quater")
    return n

def articulos(texto):
    """Separa el texto en artículos, respetando el orden y guardando el encabezado (libro/título/capítulo) vigente."""
    marcas = list(RX_ART.finditer(texto))
    out, vistos = [], set()
    for i, m in enumerate(marcas):
        fin = marcas[i + 1].start() if i + 1 < len(marcas) else len(texto)
        cuerpo = texto[m.end():fin].strip()
        previo = texto[marcas[i - 1].end() if i else 0:m.start()]
        encs = RX_ENC.findall(previo)
        n = norm_num(m.group(1))
        # los textos actualizados a veces repiten un número (texto anterior / nota): se queda con el primero
        if n in vistos:
            continue
        vistos.add(n)
        cuerpo = re.split(r"\n\s*(?:\(?Art[íi]culo sustituido|\(?Art[íi]culo incorporado|\(?Nota Infoleg)", cuerpo, 1)[0].strip()
        out.append({"n": n, "t": cuerpo[:6000]})
    return out

def encabezados(texto):
    """Para cada artículo, el último LIBRO / TÍTULO / CAPÍTULO que aparece antes."""
    res, cur = {}, {}
    pos_arts = [(m.start(), norm_num(m.group(1))) for m in RX_ART.finditer(texto)]
    encs = [(m.start(), m.group(0).strip()) for m in RX_ENC.finditer(texto)]
    j = 0
    for pos, n in pos_arts:
        while j < len(encs) and encs[j][0] < pos:
            e = encs[j][1]
            k = e.split()[0].upper().replace("Í", "I").replace("Ó", "O")
            cur[k] = e
            if k == "LIBRO":
                cur.pop("TITULO", None); cur.pop("CAPITULO", None)
            if k == "TITULO":
                cur.pop("CAPITULO", None)
            j += 1
        res.setdefault(n, " › ".join(cur[x] for x in ("LIBRO", "TITULO", "CAPITULO") if x in cur))
    return res

def referencias(t):
    refs = []
    for m in RX_REF.finditer(t):
        for x in re.findall(r"\d+" + SUF, m.group(1), re.I):
            refs.append(norm_num(x))
    return refs

def grafo(leyes):
    """Remisiones entre artículos con graphify: nodos = artículos, aristas = «references» EXTRACTED."""
    from graphify.build import build_from_json
    from graphify.cluster import cluster
    from graphify.export import to_json
    nodos, aristas = [], []
    for ley in leyes:
        ids = {a["n"] for a in ley["articulos"]}
        for a in ley["articulos"]:
            nid = f"{ley['id']}_art_{a['n'].replace(' ', '_')}"
            nodos.append({"id": nid, "label": f"{ley['abrev']} art. {a['n']}", "file_type": "document",
                          "source_file": f"knowledge/leyes/{ley['id']}.json", "source_location": f"art. {a['n']}",
                          "source_url": ley["fuente"], "captured_at": ley["descargado"], "author": None, "contributor": None})
            for r in set(referencias(a["t"])):
                if r in ids and r != a["n"]:
                    aristas.append({"source": nid, "target": f"{ley['id']}_art_{r.replace(' ', '_')}", "relation": "references",
                                    "confidence": "EXTRACTED", "confidence_score": 1.0,
                                    "source_file": f"knowledge/leyes/{ley['id']}.json", "source_location": f"art. {a['n']}", "weight": 1.0})
    extraction = {"nodes": nodos, "edges": aristas, "hyperedges": [], "input_tokens": 0, "output_tokens": 0}
    G = build_from_json(extraction, root=str(RAIZ), directed=True)
    comunidades = cluster(G)
    out = SALIDA / "graphify-out"
    out.mkdir(parents=True, exist_ok=True)
    to_json(G, comunidades, str(out / "graph.json"))
    # graphify normaliza los id; se vuelve a «ley:artículo» con la etiqueta de cada nodo
    por_etiqueta = {f"{ley['abrev']} art. {a['n']}": f"{ley['id']}:{a['n']}" for ley in leyes for a in ley["articulos"]}
    clave = {u: por_etiqueta.get(G.nodes[u].get("label")) for u in G.nodes}
    rel = {}
    for u in G.nodes:
        if not clave.get(u):
            continue
        salen = [clave[v] for v in G.successors(u) if clave.get(v)]
        entran = [clave[v] for v in G.predecessors(u) if clave.get(v)]
        if salen or entran:
            rel[clave[u]] = {"remite": sorted(set(salen))[:12], "citado": sorted(set(entran))[:12]}
    return rel, G.number_of_nodes(), G.number_of_edges()

def main():
    fuentes = json.loads((AQUI / "fuentes.json").read_text(encoding="utf-8"))["leyes"]
    SALIDA.mkdir(parents=True, exist_ok=True)
    indice, leyes = [], []
    for f in fuentes:
        crudo = CRUDO / f"{f['id']}.htm"
        if not crudo.exists():
            print(f"{f['id']}: falta {crudo.name} (correr descargar.py)")
            continue
        meta = json.loads((CRUDO / f"{f['id']}.meta.json").read_text(encoding="utf-8"))
        texto = limpiar(crudo.read_text(encoding="utf-8"))
        arts = articulos(texto)
        enc = encabezados(texto)
        for a in arts:
            if enc.get(a["n"]):
                a["u"] = enc[a["n"]]
        abrev = {"cp": "CP", "cppf": "CPPF", "cppn": "CPPN", "ep": "Ley 24.660"}.get(f["id"], f["id"].upper())
        doc = {"id": f["id"], "nombre": f["nombre"], "norma": f["norma"], "abrev": abrev, "fuente": meta["url"],
               "descargado": meta["descargado"], "articulos": arts}
        (SALIDA / f"{f['id']}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        indice.append({k: doc[k] for k in ("id", "nombre", "norma", "abrev", "fuente", "descargado")} | {"alias": f["alias"], "archivo": f"{f['id']}.json", "total": len(arts)})
        leyes.append(doc)
        print(f"{f['id']}: {len(arts)} artículos")
    if not leyes:
        return
    rel, nn, ne = grafo(leyes)
    (SALIDA / "relaciones.json").write_text(json.dumps(rel, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (SALIDA / "indice.json").write_text(json.dumps({"version": max(l["descargado"] for l in leyes), "leyes": indice}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"grafo: {nn} artículos, {ne} remisiones")

if __name__ == "__main__":
    main()
