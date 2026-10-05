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
# encabezados de artículo: en mayúscula o con inicial mayúscula («ARTICULO 1º.-», «Artículo 109:», «Art. 109. -»);
# las menciones dentro del texto («el artículo 186.») van en minúscula y no cuentan
RX_ART = re.compile(r"(?:^|\n|(?<=[.;:]) )\s*(?:ART[IÍ]CULO|Art[ií]culo|Art\.)\s+(\d+" + SUF + r")\s*[º°o]?\s*[.:\-–—]+\s*")
RX_ENC = re.compile(r"^\s*(LIBRO|Libro|T[IÍ]TULO|T[ií]tulo|CAP[IÍ]TULO|Cap[ií]tulo|SECCI[OÓ]N|Secci[oó]n|PARTE)\s+(?:[IVXLC]+\b|\d+|PRIMER[OA]?|SEGUND[OA]|TERCER[OA]?|CUART[OA]|QUINT[OA]|SEXT[OA]|S[ÉE]PTIM[OA]|OCTAV[OA]|NOVEN[OA]|D[ÉE]CIM[OA]|[ÚU]NIC[OA]|Primer[oa]?|Segund[oa]|Tercer[oa]?|Cuart[oa]|Quint[oa]|[ÚU]nic[oa])(?![^\n]*,)[^\n]{0,60}$", re.M)
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

def unir_renglones(t):
    """InfoLeg corta los renglones a lo ancho de la página: se unen, salvo antes de un inciso o un punto y aparte."""
    t = re.sub(r"(?<![.:;])[ \t]*\n[ \t]*(?!(?:\d+\s*[º°)\-.]|[a-zñ]\s*[).]\s|[IVX]+\s*[.)\-]|[-–—•]))", " ", t)
    return re.sub(r"[ \t]{2,}", " ", t).strip()

RX_TITULO = re.compile(r"^(?!(?:ART[IÍ]CULO|Art[ií]culo|Art\.)\s)(?![a-zñ0-9]{1,3}[.)\-]\s?)(?![IVX]+[.)]\s)[A-ZÁÉÍÓÚÑ\-][^\n]{1,85}(?<![.;:,])$")

def marcar_titulos(texto):
    """En las transcripciones, los renglones sueltos sin punto final son títulos de sección («Régimen de Licencias»)."""
    return "\n".join("§§" + l.strip() if RX_TITULO.match(l.strip()) and not l.strip().startswith("-") else l for l in texto.split("\n"))

def aplicar_titulos(arts, previo=""):
    """Saca los títulos del final de cada artículo y los usa como sección de los artículos siguientes."""
    cap, sec = "", ""
    for p in re.findall(r"§§([^\n]+)", previo):
        if re.match(r"CAP[IÍ]TULO\b", p):
            cap, sec = p.strip(), ""
        elif re.match(r"CAP[IÍ]TULO\b", cap) and not sec and cap.count(" ") < 2:
            cap = cap + " " + p.strip()
        elif cap:
            sec = p.strip()
    for a in arts:
        if cap or sec:
            a["u"] = " › ".join(x for x in (cap, sec) if x)
        partes = re.split(r"\s*§§", a["t"])
        a["t"] = partes[0].strip()
        for p in partes[1:]:
            p = p.strip()
            if re.match(r"CAP[IÍ]TULO\b", p):
                cap, sec = p, ""
            elif cap and re.match(r"CAP[IÍ]TULO\b", cap) and not sec and len(p) > 0 and cap.count(" ") < 2:
                cap = cap + " " + p
            else:
                sec = p

def marcas(texto):
    """Inicios de artículo que siguen la numeración (descarta menciones como «artículo 186.» dentro del texto)."""
    out, last = [], 0
    for m in RX_ART.finditer(texto):
        n = norm_num(m.group(1))
        base = int(re.match(r"\d+", n).group(0))
        if base == last or (last < base <= last + 25) or (not out and base == 1):
            out.append((m, n))
            last = base
    return out

RX_FIN = re.compile(r"[.;:)»]\s*$")

def separar_titulos(cuerpo):
    """Los títulos de sección que siguen a un artículo («TITULO II DE LAS PENAS», «Visitas») quedan al final de su texto:
    son los renglones posteriores al último que cierra con puntuación, si son cortos y no son incisos."""
    lineas = cuerpo.split("\n")
    k = len(lineas) - 1
    while k >= 0 and (not RX_FIN.search(lineas[k]) or RX_ENC.match(lineas[k])):
        k -= 1
    # un título con nombre terminado en punto («CAPITULO II bis: / Excepciones … ejecución.») también es título
    for j in range(max(0, len(lineas) - 4), len(lineas)):
        if RX_ENC.match(lineas[j].strip()):
            k = min(k, j - 1)
            break
    cola = [l.strip() for l in lineas[k + 1:] if l.strip()]
    sigue = lambda i: i > 0 and not RX_FIN.search(cola[i - 1])  # renglón que continúa el anterior («de la / ejecución.»)
    # renglones unidos (un título que ocupa dos renglones); si un «título» pasa de 100 letras, es texto sin punto final
    segmentos = []
    for i, l in enumerate(cola):
        if sigue(i) and segmentos:
            segmentos[-1] += " " + l
        else:
            segmentos.append(l)
    rotulo = lambda x: re.match(r"(?:LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N|(?:PRIMERA|SEGUNDA|TERCERA) PARTE)\b", x, re.I)
    if any(len(x) > 100 and not rotulo(x) for x in segmentos):
        return cuerpo, []
    if k < 0 or not cola or len(" ".join(cola)) > 300 or any((len(l) > 110 and not rotulo(l)) or (l[0].islower() and not sigue(i)) or re.match(r"(?:\d+|[a-zñ]{1,2})\s*[).º°\-]", l) for i, l in enumerate(cola)):
        return cuerpo, []
    return "\n".join(lineas[:k + 1]).strip(), cola

def articulos(texto, titulos=False):
    """Separa el texto en artículos, en orden. Si un artículo aparece como título («Artículo 109: Defensor común») y
    enseguida su cuerpo («Art. 109. - …»), los une; si un número se repite más adelante, se queda con el primero.
    Con titulos=True (textos de InfoLeg), saca los títulos de sección del final de cada artículo y los guarda en «_tit»."""
    ms = marcas(texto)
    out, vistos = [], {}
    for i, (m, n) in enumerate(ms):
        fin = ms[i + 1][0].start() if i + 1 < len(ms) else len(texto)
        cuerpo = re.sub(r"[ \t]+\n", "\n", texto[m.end():fin]).strip()
        tit = []
        if titulos:
            # primero los títulos (van después de las notas de InfoLeg) y después se sacan las notas
            cuerpo, tit = separar_titulos(cuerpo)
        cuerpo = re.split(r"\n\s*\(?\s*(?:Art[íi]culo sustituido|Art[íi]culo incorporado|Nota Infoleg|Expresi[óo]n sustituida)", cuerpo, 1)[0].strip()
        if n in vistos:
            prev = out[vistos[n]]
            if len(prev["t"]) < 140 and "ti" not in prev:
                prev["ti"] = prev["t"].strip(" .:-")
                prev["t"] = cuerpo[:6000]
            continue
        vistos[n] = len(out)
        out.append({"n": n, "t": cuerpo[:6000]} | ({"_tit": tit} if tit else {}))
    for a in out:
        a["t"] = re.sub(r"^[\s\-–—.:]+", "", a["t"])
        # algunos textos repiten el encabezado adentro («Artículo 16: …»)
        a["t"] = re.sub(r"^(?:ART[IÍ]CULO|Art[ií]culo|Art\.)\s+" + re.escape(a["n"]) + r"\s*[º°]?\s*[.:\-–—]+\s*", "", a["t"], flags=re.I)
        a["t"] = unir_renglones(a["t"])
        if "ti" in a:
            a["ti"] = re.sub(r"^[\s\-–—.:]+", "", a["ti"])
    return out

def nombre_encabezado(texto, m):
    """«TITULO I» seguido de «DELITOS CONTRA LAS PERSONAS» → « — Delitos contra las personas» (solo si el título no trae ya su nombre)."""
    if not re.fullmatch(r"\S+\s+\S+(?:\s+(?:bis|ter|qu[aá]ter))?\s*:?", m.group(0).strip()):
        return ""
    sig = ""
    # el nombre puede ocupar dos renglones («Excepciones a las modalidades básicas de la / ejecución.»)
    for l in texto[m.end():].lstrip(" \t\n").split("\n")[:2]:
        l = l.strip()
        if not l or RX_ENC.match(l) or re.match(r"(?:ART[IÍ]CULO|Art[ií]culo|Art\.)\s", l):
            break
        if sig and not re.search(r"\b(?:de|del|la|las|los|el|y|e|en|a|al|para|por|con|sin|sobre)$", sig, re.I) and not l[0].islower():
            break
        sig = (sig + " " + l).strip()
        if RX_FIN.search(l):
            if not l.endswith("."):
                return ""
            break
    # si en el mismo renglón empieza otro título («… PROCESALES TÍTULO I …»), el nombre termina ahí
    sig = re.split(r"\s+(?=(?:LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N)\s+[IVXLC\d])", sig)[0].rstrip(" .")
    if not sig or len(sig) > 150:
        return ""
    return " — " + (sig[0].upper() + sig[1:].lower() if sig.isupper() else sig)

def encabezados(texto):
    """Para cada artículo, el último LIBRO / TÍTULO / CAPÍTULO que aparece antes."""
    res, cur = {}, {}
    pos_arts = [(m.start(), n) for m, n in marcas(texto)]
    encs = [(m.start(), m.group(0).strip() + nombre_encabezado(texto, m)) for m in RX_ENC.finditer(texto)]
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

RX_OTRA = re.compile(r"^\s*[º°]?\s*(?:,?\s*(?:(?:inc(?:iso)?s?\.?|ap(?:artado)?\.?)\s*[\w°º)]+|[IVX]+\b)\s*,?)*\s*(?:de\s+la|del|de)\s+(?:Ley|ley|Decreto|decreto|C[oó]digo|Convenci[oó]n|Constituci[oó]n|Reglamento|r[ée]gimen|Estatuto)", re.I)

def referencias(t):
    """Artículos de la MISMA norma que el texto menciona. Se descartan las notas de InfoLeg entre paréntesis
    («sustituido por art. 3° de la Ley …») y las menciones a otras normas («artículos 5° y 6° de la ley 23.737»)."""
    t = re.sub(r"\([^()]*(?:Ley|ley|B\.O\.|Decreto|sustituid|incorporad|derogad)[^()]*\)", " ", t)
    refs = []
    for m in RX_REF.finditer(t):
        if RX_OTRA.match(t[m.end():m.end() + 60]):
            continue
        if re.search(r"(incorporad|sustituid|derogad|modificad|agregad)[oa]s?\s+por\s*$", t[max(0, m.start() - 30):m.start()], re.I):
            continue
        if re.match(r"[^.;]{0,60}\b(?:Ley|ley|Decreto)\s+N", t[m.end():m.end() + 80]):
            continue
        for x in re.findall(r"\d+" + SUF, m.group(1), re.I):
            refs.append(norm_num(x))
    return refs

ORDINALES = ["Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima",
             "Undécima", "Duodécima", "Decimotercera", "Decimocuarta", "Decimoquinta", "Decimosexta", "Decimoséptima"]
RX_ENC_CN = re.compile(r"^\s*(PRIMERA PARTE|SEGUNDA PARTE|T[IÍ]TULO\s+\w+|SECCI[OÓ]N\s+\w+|CAP[IÍ]TULO\s+\w+)\s*$", re.I | re.M)

NOMBRES_CN = ["Nación", "Gobierno Federal", "Poder Legislativo", "Poder Ejecutivo", "Poder Judicial", "Ministerio Público",
              "Cámara de Diputados", "Senado", "Congreso", "Auditoría General de la Nación", "Defensor del Pueblo",
              "Jefe de Gabinete", "Gobiernos de Provincia", "Autoridades de la Nación"]

def nombre_cn(s):
    """Nombre de un encabezado de la Constitución en minúscula, con mayúscula inicial y en los nombres propios."""
    s = s.lower()
    for n in sorted(NOMBRES_CN, key=len, reverse=True):
        s = re.sub("(?i)" + re.escape(n.lower()).replace("ó", "[oó]").replace("á", "[aá]").replace("í", "[ií]"), n, s)
    return s[0].upper() + s[1:]

RX_MOD = re.compile(r"(?m)^\s*(?:ART[IÍ]CULO|Art[ií]culo)\s+(\d+)\s*[°º]?\s*(?:\.\s*[-–—]|[-–—])\s*")

def modificatoria(texto):
    """Leyes que reforman otras (Ley 27.375): cada artículo trae adentro el texto nuevo («Artículo 14: …»), así que
    solo cuentan como inicio los encabezados con guion («Artículo 38.- Modifícase…»), no los que llevan dos puntos."""
    ms = list(RX_MOD.finditer(texto))
    out = []
    for i, m in enumerate(ms):
        fin = ms[i + 1].start() if i + 1 < len(ms) else len(texto)
        cuerpo = re.split(r"\n\s*DADA EN LA SALA DE SESIONES", texto[m.end():fin], 1)[0]
        out.append({"n": m.group(1), "t": unir_renglones(cuerpo.strip())[:6000]})
    return out

def constitucion(texto):
    """Constitución Nacional (Ley 24.430): preámbulo, artículos con Parte › Título › Sección › Capítulo (y su nombre)
    y disposiciones transitorias. Se dejan afuera los artículos de la Ley 24.430 que ordena su publicación."""
    texto = texto[texto.index("PREÁMBULO"):]
    texto = re.split(r"\n\s*DADA EN LA SALA DE SESIONES DE LA CONVENCI", texto, 1)[0]
    cuerpo, trans = re.split(r"\n\s*DISPOSICIONES TRANSITORIAS\s*\n", texto, 1)
    pre = re.split(r"\n\s*PRIMERA PARTE", cuerpo, 1)[0].replace("PREÁMBULO", "", 1)
    arts = articulos(cuerpo)
    # estructura: cada encabezado con el nombre del renglón siguiente («SECCIÓN SEGUNDA › Del Poder Ejecutivo»)
    niveles = ["PARTE", "TITULO", "SECCION", "CAPITULO"]
    cur, encs = {}, []
    for m in RX_ENC_CN.finditer(cuerpo):
        sig = cuerpo[m.end():].lstrip("\n").split("\n", 1)[0].strip()
        nombre = sig if sig and not RX_ENC_CN.match(sig) and not re.match(r"Art[ií]culo\s", sig) else ""
        nivel = "PARTE" if "PARTE" in m.group(1).upper() else m.group(1).split()[0].upper().replace("Í", "I").replace("Ó", "O")
        etiqueta = re.sub(r"\s+", " ", m.group(1).strip()).lower()
        etiqueta = re.sub(r"^titulo", "título", re.sub(r"^seccion", "sección", re.sub(r"^capitulo", "capítulo", etiqueta))).replace("septimo", "séptimo")
        encs.append((m.start(), nivel, etiqueta[0].upper() + etiqueta[1:] + (" — " + nombre_cn(nombre) if nombre else "")))
    j = 0
    for (m, n), a in zip(marcas(cuerpo), arts):
        while j < len(encs) and encs[j][0] < m.start():
            _, nivel, e = encs[j]
            cur[nivel] = e
            for x in niveles[niveles.index(nivel) + 1:]:
                cur.pop(x, None)
            j += 1
        a["u"] = " › ".join(cur[x] for x in niveles if x in cur)
    out = [{"n": "preámbulo", "t": unir_renglones(pre.strip()), "u": "Preámbulo"}] + arts
    partes = re.split(r"\n\s*(" + "|".join(ORDINALES) + r")\s*\.\s*", "\n" + trans)
    for i in range(1, len(partes) - 1, 2):
        out.append({"n": f"transitoria {ORDINALES.index(partes[i]) + 1}", "t": unir_renglones(partes[i + 1].strip()),
                    "u": f"Disposiciones transitorias › {partes[i]}"})
    return out

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
        if f.get("transcripcion"):
            # documentos escaneados (no están en InfoLeg): texto transcripto a mano desde el PDF
            texto = (AQUI / f["transcripcion"]).read_text(encoding="utf-8")
            meta = {"url": f["url"], "descargado": f["fecha"]}
        else:
            crudo = CRUDO / f"{f['id']}.htm"
        if not f.get("transcripcion") and not crudo.exists():
            previo = SALIDA / f"{f['id']}.json"
            if not previo.exists():
                print(f"{f['id']}: falta {crudo.name} (correr descargar.py)")
                continue
            # sin acceso a InfoLeg: se conserva el texto ya armado, para no perder la norma al agregar otras
            doc = json.loads(previo.read_text(encoding="utf-8"))
            indice.append({k: doc[k] for k in ("id", "nombre", "norma", "abrev", "fuente", "descargado") if k in doc} | {"alias": f["alias"], "archivo": f"{f['id']}.json", "total": len(doc["articulos"])})
            leyes.append(doc)
            print(f"{f['id']}: {len(doc['articulos'])} artículos (texto ya armado, falta {crudo.name})")
            continue
        if not f.get("transcripcion"):
            meta = json.loads((CRUDO / f"{f['id']}.meta.json").read_text(encoding="utf-8"))
            texto = limpiar(crudo.read_text(encoding="utf-8"))
        # erratas de tipeo del original que impiden reconocer un artículo («Artículo 1 16», «ARTICULO. 18»)
        for mal, bien in f.get("arreglos", []):
            texto = texto.replace(mal, bien)
        if f.get("desde"):
            m0 = re.search(f["desde"], texto)
            if m0:
                texto = texto[m0.start():]
        if f.get("hasta"):
            texto = re.split(f["hasta"], texto, 1)[0]
        if f.get("transcripcion"):
            texto = marcar_titulos(texto)
        if f.get("estructura"):
            arts = {"constitucion": constitucion, "modificatoria": modificatoria}[f["estructura"]](texto)
        else:
            arts = articulos(texto, titulos=not f.get("transcripcion"))
        if f.get("transcripcion"):
            m0 = RX_ART.search(texto)
            aplicar_titulos(arts, texto[:m0.start()] if m0 else "")
        enc = {} if f.get("estructura") else encabezados(texto)
        sub = ""
        for a in arts:
            u = " › ".join(x for x in (enc.get(a["n"], ""), sub) if x)
            if u:
                a["u"] = u
            # los subtítulos que cierran este artículo («Salidas transitorias») valen para los siguientes; los LIBRO /
            # TÍTULO / CAPÍTULO y su nombre (el renglón siguiente) ya están en enc
            if "_tit" in a:
                # se descartan los títulos, sus nombres (ya en enc) y las notas entre paréntesis
                nombres = " ".join(enc.values()).lower()
                sueltos = [t for t in a.pop("_tit") if not RX_ENC.match(t) and not t.startswith("(")
                           and t.rstrip(" .").lower() not in nombres and not re.search(r"(?:\bPARTE$|\b(?:LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N)\s+[IVXLC\d])", t)]
                sub = " › ".join(sueltos)
        abrev = f.get("abrev") or {"cp": "CP", "cppf": "CPPF", "cppn": "CPPN", "ep": "Ley 24.660"}.get(f["id"], f["id"].upper())
        doc = {"id": f["id"], "nombre": f["nombre"], "norma": f["norma"], "abrev": abrev, "fuente": meta["url"],
               "descargado": meta["descargado"], "articulos": arts}
        if f.get("origen"):
            doc["origen"] = f["origen"]
        (SALIDA / f"{f['id']}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        indice.append({k: doc[k] for k in ("id", "nombre", "norma", "abrev", "fuente", "descargado") if k in doc} | ({"origen": doc["origen"]} if "origen" in doc else {}) | {"alias": f["alias"], "archivo": f"{f['id']}.json", "total": len(arts)})
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
