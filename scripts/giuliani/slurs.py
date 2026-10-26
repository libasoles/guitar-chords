"""Ligados (ligaduras de expresion) de la edicion de Apke: curvas negras del PDF -> cabezas de inicio y de fin.

`barrios/apke_notes.py` (y el lector de Sagreras) solo reconocen las ligaduras de union: curvas entre dos cabezas de la
misma altura. Aqui se emparejan las demas. Una curva cerrada de dos tramos Bezier une dos cabezas: su inicio cae sobre
la primera (o sobre su plica) y su final sobre la ultima, por encima o por debajo segun hacia donde se curve. Se anota en
las cabezas (`slur_start` / `slur_stop`: numeros de ligadura, distintos si se solapan) y
`carcassi-valses/transcribe_valses.py` los escribe como `<slur>` en el MusicXML.

Una ligadura que cruza de un sistema al siguiente se dibuja como dos curvas: la primera sin cabeza final y la segunda
sin cabeza inicial. Se guarda la abierta y se cierra con la primera curva sin inicio del sistema siguiente (las paginas
se leen en orden). `UNMATCHED` recoge las curvas que no se pudieron emparejar.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'scripts' / 'sagreras'))

import marieh_notes as M  # noqa: E402

_mark_ties = M.mark_ties
UNMATCHED = []
_open = []  # [(cabeza inicial, numero)] de las ligaduras que siguen en el sistema siguiente


def curves_of(drawings, space):
    """Curvas negras de dos tramos: su caja, sus extremos y si se curvan hacia arriba."""
    out = []
    for d in drawings:
        curves = [i for i in d['items'] if i[0] == 'c']
        r = d['rect']
        if d['fill'] != (0., 0., 0.) or len(curves) != len(d['items']) or not curves or r.width < 1.5 * space:
            continue
        first = curves[0]
        out.append({'x0': first[1].x, 'x1': first[4].x, 'above': first[2].y < first[1].y, 'rect': r})
    return out


def column(heads, x, above, space):
    """Cabeza bajo el extremo `x` de la curva. La curva arranca en el centro de la cabeza o en su plica (borde derecho si
    la plica va arriba, izquierdo si va abajo): se toma la columna de cabezas mas cercana y, dentro de ella, la mas alta
    si la curva va por encima y la mas baja si va por debajo."""
    hw = space * 1.18
    near = [(abs(h['x'] + hw / 2 - x), h) for h in heads if h['x'] - 0.5 * hw <= x <= h['x'] + 1.6 * hw]
    if not near:
        return None
    nearest = min(d for d, _ in near)
    return (min if above else max)((h for d, h in near if d - nearest < 1.5), key=lambda h: h['y'])


def mark_slurs(system, drawings, lines):
    space = (lines[-1] - lines[0]) / 4
    heads = [h for m in system['measures'] for h in m['items']]
    found, starts, stops = [], [], []
    for c in curves_of(drawings, space):
        r = c['rect']
        if r.y0 < lines[0] - 10 * space or r.y1 > lines[-1] + 10 * space or r.width > 40 * space:
            continue
        left, right = column(heads, c['x0'], c['above'], space), column(heads, c['x1'], c['above'], space)
        if left is not None and right is not None and left is not right and left['x'] < right['x']:
            if left['pos'] == right['pos'] and left.get('tie_next') and right.get('tie_prev'):
                continue  # es una ligadura de union, ya marcada
            found.append((left, right))
        elif left is not None and right is None and c['x1'] > max(h['x'] for h in heads) + space:
            starts.append((left, c))  # sigue en el sistema siguiente
        elif right is not None and left is None and c['x0'] < min(h['x'] for h in heads):
            stops.append((right, c))  # viene del sistema anterior
        else:
            UNMATCHED.append((round(c['x0']), round(c['rect'].y0), left is not None, right is not None))
    # Numeros: los que no se solapan con otra ligadura abierta reutilizan el 1.
    active = []
    carried = list(_open)
    _open.clear()
    for right, _ in stops:
        if carried:
            left, number = carried.pop(0)
            right.setdefault('slur_stop', []).append(number)
            active.append((right, number))
        else:
            UNMATCHED.append(('sin inicio', round(right['x']), round(right['y'])))
    spans = [(left, right) for left, right in found] + [(left, {'x': float('inf')}) for left, _ in starts]
    for left, right in sorted(spans, key=lambda p: p[0]['x']):
        active = [(r, n) for r, n in active if r['x'] > left['x']]
        number = next(n for n in range(1, 9) if n not in {n for _, n in active})
        active.append((right, number))
        left.setdefault('slur_start', []).append(number)
        if right['x'] == float('inf'):
            _open.append((left, number))
        else:
            right.setdefault('slur_stop', []).append(number)


def mark_ties(system, drawings, lines):
    _mark_ties(system, drawings, lines)
    mark_slurs(system, drawings, lines)


M.mark_ties = mark_ties
