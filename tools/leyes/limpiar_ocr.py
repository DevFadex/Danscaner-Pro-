#!/usr/bin/env python3
"""Corrige los errores repetitivos del OCR (Tesseract) en las páginas del compendio escaneado.

Uso: python3 tools/leyes/limpiar_ocr.py entrada.txt salida.txt
Solo corrige patrones seguros (símbolo de grado, «N°», números romanos en títulos, guiones); no inventa texto.
"""
import re, sys

def limpiar(t):
    # «Artículo 1”%.-», «ARTICULO 2*.-», «Artículo 3%.-» → «Artículo 1°.-»
    t = re.sub(r"\b((?:ART[IÍ]CULO|Art[ií]culo|Art\.)\s*,?\s*\d+)\s*(?:[”\"'*%º°]+|°)(?=\s*[.\-–—:])", r"\1°", t)
    # «N*», «N”», «Nº» → «N°» delante de números
    t = re.sub(r"\bN\s*[*”\"º°%]+\s*(?=[:\d])", "N° ", t)
    t = re.sub(r"\bN° +:", "N°:", t)
    # ordinales en incisos y fechas: «1”)», «2*)», «inc. 3”»
    t = re.sub(r"(?<=\d)[”*%](?=[\s).,;-])", "°", t)
    # números romanos leídos como «|», «l» o «!» en títulos: «TITULO |», «CAPITULO ||», «ANEXO!»
    def rom(m):
        return m.group(1) + " " + m.group(2).replace("|", "I").replace("!", "I").replace("l", "I")
    t = re.sub(r"\b(T[IÍ]TULO|CAP[IÍ]TULO|ANEXO|SECCI[OÓ]N|LIBRO)\s*([|!lIVX]{1,6})(?=\s*$|\s*[\n.-])", rom, t, flags=re.M)
    # comillas y rayas raras
    t = t.replace("—-", "—").replace("--", "-")
    # espacios dobles y renglones vacíos repetidos
    t = re.sub(r"[ \t]{2,}", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    open(dst, "w", encoding="utf-8").write(limpiar(open(src, encoding="utf-8").read()))
