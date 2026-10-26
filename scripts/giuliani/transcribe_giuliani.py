"""24 Esercizi, Op. 48 de Giuliani (edicion de Stefan Apke, IMSLP): PDF -> MusicXML con notacion (sin TAB).

    python scripts/giuliani/transcribe_giuliani.py 1 [2 ...]    # escribe sources/NN.musicxml si pasa el control
    python scripts/giuliani/transcribe_giuliani.py check [N ...]  # solo comprueba (sin escribir)

El PDF (los 24 estudios en un solo archivo) va en `resources/giuliani-op48/` (no versionado; `RESOURCES_DIR` lo cambia
desde un worktree). Mismo lector y mismo control que Barrios (`barrios/apke_notes.py`, `barrios/transcribe_barrios.py`):
cada estudio termina en una barra final, y por ahi se parte la lectura de todo el PDF.
"""
import json
import os
import re
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
_configure_rhythm = S.configure_rhythm


def configure_rhythm(scale):
    """Con fusas (escala 6) la semicorchea con puntillo (9 unidades) tambien hace falta: Estudio 15 y siguientes."""
    _configure_rhythm(scale)
    if scale == 6:
        S.T.TYPES[9] = '16th'
        S.T.DOTTED.add(9)


S.configure_rhythm = configure_rhythm


def rests_xml(length, voice):
    """Silencios ocultos que suman `length`: la descomposicion voraz de Sagreras deja 1 unidad suelta en 9 (8 + 1)."""
    sizes = (96, 48, 24, 16, 12, 8, 6, 4, 3, 2) if S.SCALE == 6 else (48, 24, 12, 8, 6, 4, 3, 2, 1)
    rest = int(length)
    greedy = []
    for size in sizes:
        while rest >= size:
            greedy.append(size)
            rest -= size
    if not rest:
        return ''.join(S.T.hidden_rest(size, voice) for size in greedy)
    best = {0: []}
    for total in range(1, int(length) + 1):
        options = [best[total - size] + [size] for size in sizes if total >= size and (total - size) in best]
        if options:
            best[total] = min(options, key=len)
    if int(length) not in best:
        raise ValueError(f'hueco de {length} unidades sin silencio posible')
    return ''.join(S.T.hidden_rest(size, voice) for size in best[int(length)])


S.rests_xml = rests_xml
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
    for i, x in spec.get('low_rests', ()):  # silencios de la voz grave que el lector asigna a la aguda: [compas, x del silencio]
        for r in measures[i - 1]['rests']:
            if abs(r['x'] - x) < 3:
                r['y'] = measures[i - 1]['bottom'] + measures[i - 1]['space']
    for i in spec.get('fine', ()):
        measures[i - 1]['fine'] = True
    return spec, piece


def order_slurs(xml):
    """Verovio enlaza cada <slur> de inicio con el siguiente de fin segun el orden del documento. En un compas con dos voces
    la voz 2 va despues de un <backup>, asi que un ligado de la voz 2 hacia la 1 (o al reves) puede tener el fin escrito antes
    que el inicio y la curva se alarga hasta otro compas. Se intercambian los dos extremos: une las mismas notas."""
    def fix(measure):
        marks = list(re.finditer(r'<slur type="(start|stop)" number="(\d+)"/>', measure.group(0)))
        flips, early, depth, renumber = set(), {}, {}, {}
        for i, mark in enumerate(marks):
            kind, number = mark.groups()
            if kind == 'start':
                if early.get(number):
                    first = early[number].pop(0)  # empareja con el primer fin sin inicio
                    flips.update({first, i})
                    renumber[first] = renumber[i] = 9 + len(renumber) // 2 % 8  # numero propio: varias en fila no se confunden
                else:
                    depth[number] = depth.get(number, 0) + 1
            elif depth.get(number):
                depth[number] -= 1
            else:
                early.setdefault(number, []).append(i)  # fin sin inicio antes en el documento
        out, last = [], 0
        for i, mark in enumerate(marks):
            kind, number = mark.groups()
            if i in flips:
                kind = 'start' if kind == 'stop' else 'stop'
            out.append(measure.group(0)[last:mark.start()] + f'<slur type="{kind}" number="{renumber.get(i, number)}"/>')
            last = mark.end()
        return ''.join(out) + measure.group(0)[last:]
    return re.sub(r'<measure\b.*?</measure>', fix, xml, flags=re.S)


def to_xml(n, spec, piece, measures):
    xml = order_slurs(S.to_xml(n, piece, measures))
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
            try:
                xml = to_xml(n, spec, piece, measures)
            except (ValueError, KeyError) as error:
                print(f'{n:2d} ERROR al escribir: {error}')
                continue
            (SOURCES / f'{n:02d}.musicxml').write_text(xml, encoding='utf-8')


if __name__ == '__main__':
    args = sys.argv[1:]
    write = args[:1] != ['check']
    if not write:
        args = args[1:]
    run([int(a) for a in args] or sorted(int(k) for k in PIECES), write)
