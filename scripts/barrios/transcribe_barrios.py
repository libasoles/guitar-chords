"""Piezas de Barrios (edicion de Stefan Apke, IMSLP): PDF -> MusicXML con notacion (sin TAB).

    python scripts/barrios/transcribe_barrios.py 1 [2 ...]    # escribe sources/NN.musicxml si pasa el control
    python scripts/barrios/transcribe_barrios.py check [N ...]  # solo comprueba (sin escribir)

El PDF original va en `resources/barrios/imslp/` (no versionado; `RESOURCES_DIR` lo cambia desde un worktree).
Lee la geometria del PDF con `apke_notes.py` y convierte con las rutinas de Sagreras (`sagreras/transcribe.py`):
el MusicXML lleva solo alturas, duraciones y dedos; la TAB la propone el motor (ver build.py). Como la edicion no trae
TAB impresa, el control es que cada compas sume su duracion, voz por voz.
"""
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'barrios'))
sys.path.insert(0, str(ROOT / 'scripts' / 'sagreras'))

import apke_notes as A  # noqa: E402
import transcribe as S  # noqa: E402  (sagreras/transcribe.py)

SOURCES = HERE / 'sources'
# `resources/` (no versionado) solo existe en el checkout principal: desde un worktree (.claude/worktrees/<n>) se sube a el.
_MAIN = ROOT.parents[2] if ROOT.parent.name == 'worktrees' else ROOT
RESOURCES = Path(os.environ.get('RESOURCES_DIR', _MAIN / 'resources')) / 'barrios' / 'imslp'
PIECES = json.loads((HERE / 'pieces.json').read_text(encoding='utf-8'))
AUTHOR = 'Agustin Barrios Mangore'


_original_groups = S._original_groups


def original_groups(m):
    """Lectura base de grupos de plica. Las corcheas (o semicorcheas) de una pieza en tresillos continuos, con el «3» o
    el «6» impreso solo al principio, valen 2/3: se escala aqui, antes de las reglas de Sagreras (que comparan el total
    del compas para decidir si es una sola voz)."""
    groups = _original_groups(m)
    for key, dur in (('eighth_triplets', 2), ('sixteenth_sextuplets', 1)):
        if m.get(key):
            for g in groups:
                if g['dur'] == dur and not g.get('triplet') and not g['grace']:
                    g['dur'] = dur * 2 / 3
                    g['triplet'] = True
    return groups


S._original_groups = original_groups


def read_piece(n):
    spec = PIECES[str(n)]
    piece = A.read_pdf(RESOURCES / spec['pdf'])
    for i in spec.get('fine', ()):  # «Fine» que el PDF dibuja como grafico y no como texto
        piece['measures'][i - 1]['fine'] = True
    for key in ('eighth_triplets', 'sixteenth_sextuplets'):
        if spec.get(key):
            for m in piece['measures']:
                m[key] = True
                m['tuplets'] = []  # las cifras impresas ya estan contadas
    if spec.get('time'):
        piece['time'] = tuple(spec['time'])
    if piece['time'] is None:
        piece['time'] = (4, 4)
    if spec.get('fifths') is not None:
        piece['fifths'] = spec['fifths']
    if not spec.get('key_changes'):
        # Un sostenido o bemol de nota junto a una barra doble se lee como cambio de armadura: la pieza lleva una sola,
        # salvo las que cambian de verdad (`key_changes`, que conservan lo leido por compas).
        for m in piece['measures']:
            m['fifths'] = piece['fifths']
    return spec, piece


def measures_of(piece):
    """`lesson_measures` de Sagreras, recortando los silencios finales de una voz que desbordan el compas: un silencio
    de la voz aguda cuya altura cae bajo el centro del pentagrama se asigna a la voz grave (cierre del Preludio en Do menor)."""
    measures = S.lesson_measures(piece)
    full = piece['time'][0] * 16 // piece['time'][1] * S.SCALE
    for data in measures:
        if data['length'] <= full:
            continue
        for voice in data['voices']:
            events = sorted(voice['events'])
            while events and events[-1][2] == 'R' and events[-1][0] + events[-1][1] > full:
                events.pop()
            voice['events'] = events
        end = max([o + d for voice in data['voices'] for o, d, *_ in voice['events']], default=0)
        data['length'] = full if end <= full else end
    return measures


def odd_measures(piece, measures, short=()):
    """Compases que no suman la duracion del compas. `short`: los compases cortos que la edicion imprime asi."""
    full = piece['time'][0] * 16 // piece['time'][1] * S.SCALE
    odd = [i + 1 for i, d in enumerate(measures) if d['length'] != full]
    if short:
        return [i for i in odd if i not in short] + [i for i in short if i > len(measures) or measures[i - 1]['length'] >= full]
    if odd and set(odd) <= {1, len(measures)} and measures[0]['length'] + measures[-1]['length'] == full:
        return []  # anacrusa y compas final complementarios
    if odd == [1] and measures[0]['length'] < full:
        return []  # anacrusa sin compas complementario al final
    return odd


def to_xml(n, spec, piece, measures):
    xml = S.to_xml(n, piece, measures)
    xml = xml.replace(f'<work-title>Lesson {n}</work-title>', f'<work-title>{spec["title"]}</work-title>')
    return xml.replace('Julio Salvador Sagreras', AUTHOR)


def run(numbers, write):
    for n in numbers:
        spec, piece = read_piece(n)
        try:
            measures = measures_of(piece)
        except Exception as error:  # noqa: BLE001
            print(f'{n:2d} ERROR de lectura: {type(error).__name__}: {error}')
            continue
        odd = odd_measures(piece, measures, spec.get('short', ()))
        status = 'OK ' if not odd else 'REVISAR'
        print(f"{n:2d} {status} {spec['title']} {piece['time']} fifths={piece['fifths']} compases={len(measures)} cortos/largos={odd}")
        if write and (not odd or spec.get('force')):
            SOURCES.mkdir(exist_ok=True)
            (SOURCES / f'{n:02d}.musicxml').write_text(to_xml(n, spec, piece, measures), encoding='utf-8')


if __name__ == '__main__':
    args = sys.argv[1:]
    write = args[:1] != ['check']
    if not write:
        args = args[1:]
    run([int(a) for a in args] or sorted(int(k) for k in PIECES), write)
