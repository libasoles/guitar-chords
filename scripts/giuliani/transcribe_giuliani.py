"""24 Esercizi, Op. 48 de Giuliani (edicion de Stefan Apke, IMSLP): PDF -> MusicXML con notacion (sin TAB).

    python scripts/giuliani/transcribe_giuliani.py 1 [2 ...]    # escribe sources/NN.musicxml si pasa el control
    python scripts/giuliani/transcribe_giuliani.py check [N ...]  # solo comprueba (sin escribir)

El PDF (los 24 estudios en un solo archivo) va en `resources/giuliani-op48/` (no versionado; `RESOURCES_DIR` lo cambia
desde un worktree). Mismo lector y mismo control que Barrios (`barrios/apke_notes.py`, `barrios/transcribe_barrios.py`):
cada estudio termina en una barra final, y por ahi se parte la lectura de todo el PDF.
"""
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'barrios'))
sys.path.insert(0, str(ROOT / 'scripts' / 'sagreras'))
sys.path.insert(0, str(HERE))

import apke_notes as A  # noqa: E402
import fingers  # noqa: E402,F401  (dedos que la regla compartida deja sin cabeza)
import slurs  # noqa: E402,F401  (anota los ligados al leer cada pagina)
import transcribe_barrios as B  # noqa: E402
import transcribe as S  # noqa: E402  (sagreras/transcribe.py)

SOURCES = HERE / 'sources'
_MAIN = ROOT.parents[2] if ROOT.parent.name == 'worktrees' else ROOT
PDF = Path(os.environ.get('RESOURCES_DIR', _MAIN / 'resources')) / 'giuliani-op48' / 'IMSLP1038590-giuliani-op48-apke.pdf'
PIECES = json.loads((HERE / 'pieces.json').read_text(encoding='utf-8'))
AUTHOR = 'Mauro Giuliani'

# El lector de Barrios solo anota la metrica del primer sistema; aqui cada compas recuerda la de su sistema.
_read_system = A.P.read_system


def _tagged_read_system(*args, **kwargs):
    system = _read_system(*args, **kwargs)
    for m in system['measures']:
        m['sys_time'] = system['time']
    return system


A.P.read_system = _tagged_read_system
_book = None


def book():
    """Los 24 estudios, partidos por las barras finales: una lista de compases por estudio."""
    global _book
    if _book is None:
        pieces, current = [], []
        for m in A.read_pdf(PDF)['measures']:
            current.append(m)
            if m['right_bar_style'] == 'light-heavy':
                pieces.append(current)
                current = []
        if current:
            pieces.append(current)
        _book = pieces
    return _book


def read_piece(n):
    spec = PIECES[str(n)]
    measures = book()[n - 1]
    time = next((m['sys_time'] for m in measures if m['sys_time']), None)
    piece = {'fifths': spec.get('fifths', measures[0]['fifths']), 'time': tuple(spec['time']) if spec.get('time') else time or (4, 4),
             'measures': measures}
    for m in measures:
        if not spec.get('key_changes'):
            m['fifths'] = piece['fifths']  # una armadura por estudio: un sostenido junto a una barra se leia como cambio
        for key in ('eighth_triplets', 'sixteenth_sextuplets'):
            if spec.get(key):
                m[key] = True
                m['tuplets'] = []  # las cifras impresas ya estan contadas
    for i in spec.get('fine', ()):
        measures[i - 1]['fine'] = True
    return spec, piece


def to_xml(n, spec, piece, measures):
    xml = S.to_xml(n, piece, measures)
    xml = xml.replace(f'<work-title>Lesson {n}</work-title>', f'<work-title>{spec["title"]}</work-title>')
    return xml.replace('Julio Salvador Sagreras', AUTHOR)


def run(numbers, write):
    for n in numbers:
        spec, piece = read_piece(n)
        count = sum(len(h.get('slur_start', ())) for m in piece['measures'] for h in m['items'])
        try:
            measures = B.measures_of(piece)
        except Exception as error:  # noqa: BLE001
            print(f'{n:2d} ERROR de lectura: {type(error).__name__}: {error}')
            continue
        odd = B.odd_measures(piece, measures, spec.get('short', ()))
        status = 'OK ' if not odd else 'REVISAR'
        print(f"{n:2d} {status} {spec['title']} {piece['time']} fifths={piece['fifths']} compases={len(measures)} cortos/largos={odd} ligados={count}")
        if write and (not odd or spec.get('force')):
            SOURCES.mkdir(exist_ok=True)
            (SOURCES / f'{n:02d}.musicxml').write_text(to_xml(n, spec, piece, measures), encoding='utf-8')


if __name__ == '__main__':
    args = sys.argv[1:]
    write = args[:1] != ['check']
    if not write:
        args = args[1:]
    run([int(a) for a in args] or sorted(int(k) for k in PIECES), write)
