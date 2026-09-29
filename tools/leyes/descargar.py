#!/usr/bin/env python3
"""Descarga los textos oficiales de InfoLeg listados en fuentes.json a tools/leyes/crudo/<id>.htm.

Uso: python3 tools/leyes/descargar.py [id ...]
Guarda también la fecha y la URL de cada descarga en crudo/<id>.meta.json.
"""
import json, sys, datetime, pathlib, urllib.request

AQUI = pathlib.Path(__file__).resolve().parent
CRUDO = AQUI / "crudo"

def main(ids):
    fuentes = json.loads((AQUI / "fuentes.json").read_text(encoding="utf-8"))["leyes"]
    CRUDO.mkdir(exist_ok=True)
    for f in fuentes:
        if ids and f["id"] not in ids:
            continue
        req = urllib.request.Request(f["url"], headers={"User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        # InfoLeg publica en windows-1252 / latin-1
        texto = data.decode("windows-1252", errors="replace")
        (CRUDO / f"{f['id']}.htm").write_text(texto, encoding="utf-8")
        (CRUDO / f"{f['id']}.meta.json").write_text(json.dumps({"url": f["url"], "descargado": datetime.date.today().isoformat(), "bytes": len(data)}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{f['id']}: {len(data)} bytes")

if __name__ == "__main__":
    main(set(sys.argv[1:]))
