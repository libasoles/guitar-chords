"""MusicXML corregido de un vals -> PDF con TAB, MusicXML final y vistas previas SVG.

    python scripts/carcassi-valses/build.py 2

Reutiliza `build` de carcassi-preludios/extract.py (mismo motor, misma digitacion de TAB y mismos SVG) con las
rutas y los titulos de los valses. Salida: downloads/carcassi-valses/ y src/site/articles/carcassi-valses/.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'carcassi-preludios'))

import extract  # noqa: E402

# Numero del Op. 59 (Tercera parte) -> tonalidad, comprobada con la armadura y el final de cada vals.
KEYS = {2: 'C Major', 5: 'D Major', 7: 'A Major', 10: 'D Minor', 15: 'D Minor', 26: 'C Major', 34: 'D Major',
        36: 'A Major', 43: 'D Major', 45: 'D Major', 49: 'A Major'}
PER_ROW = {n: 6 for n in KEYS}

extract.EDITION = 'valses'
extract.SCORE_PREFIX = 'waltz-'
extract.CORRECTED = os.path.join(HERE, 'corrected')
extract.OUT_DIR = os.path.join(ROOT, 'downloads', 'carcassi-valses')
extract.PREVIEW_DIR = os.path.join(ROOT, 'src', 'site', 'articles', 'carcassi-valses')
extract.PAGES_DIR = os.path.join(extract.PREVIEW_DIR, 'full')
extract.PER_ROW = PER_ROW
extract.TITLES = {n: f'Waltz {n} in {key}' for n, key in KEYS.items()}
extract.PREVIEW_MEASURES = {}
# Grabado mas pequeno sobre una pagina virtual mas grande (el PDF sigue siendo A4) para que el ultimo sistema no pase a una
# segunda pagina.
extract.PDF_OVERRIDES = {36: {'scale': 40, 'pageWidth': 2363, 'pageHeight': 3341}}

_source = extract.build


def build(number):
    # `extract.build` lee prelude-NN.musicxml: los valses se llaman waltz-NN.musicxml.
    original = extract.os.path.join

    def join(*parts):
        if parts and isinstance(parts[-1], str) and parts[-1] == f'prelude-{number:02d}.musicxml':
            return original(*parts[:-1], f'waltz-{number:02d}.musicxml')
        return original(*parts)

    extract.os.path.join = join
    try:
        _source(number)
    finally:
        extract.os.path.join = original


if __name__ == '__main__':
    build(int(sys.argv[1]))
