"""Dedos de la izquierda de la edicion de Apke: cifra -> cabeza.

`marieh_notes.attach_fingers` empareja cada cifra con la cabeza mas cercana, como si estuviera centrada sobre ella. En
esta edicion la cifra va a la izquierda de la cabeza (y de su alteracion, que ocupa unos 2 espacios mas) o, en notas con
plica, encima o debajo; con la regla compartida una cifra junto a una alteracion se asignaba a la nota vecina. Aqui la
distancia horizontal se mide contra esas tres posiciones posibles. `LOST` guarda las cifras sin pareja para revisarlas.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'scripts' / 'sagreras'))

import marieh_notes as M  # noqa: E402

LOST = []
SHARED = M.attach_fingers  # la regla compartida, por si hay que compararla


def attach_fingers(system, marks, lines, key='finger'):
    """Cada indicacion pasa a una cabeza (campo `key`); una cabeza toma una sola. -> las que no encontraron cabeza."""
    top, bottom = lines[0], lines[-1]
    space = (bottom - top) / 4
    mine = [m for m in marks if top - 9 * space <= m[1] <= bottom + 5 * space and system['measures']
            and min(ms['left'] for ms in system['measures']) <= m[0] <= max(ms['right'] for ms in system['measures'])]
    heads = [h for m in system['measures'] for h in m['items'] if not h['grace']]

    def cost(x, y, h, tolerance):
        dx = (h['x'] - x) / space  # >0: la cifra queda a la izquierda de la cabeza
        # centrada encima / debajo, junto a la cabeza, o a la izquierda de su alteracion
        near = min(abs(dx + 0.5), abs(dx - 0.9), abs(dx - 2.0))
        return near ** 2 + ((h['y'] - y) / space) ** 2 if near <= tolerance else None

    used_mark, used_head = set(), set()
    # Primera pasada: posiciones habituales. Segunda: las que sobran, con radio ancho y solo sobre cabezas sin dedo.
    for tolerance in (1.0, 4.0):
        pairs = sorted((c, i, j) for i, (x, y, _) in enumerate(mine) for j, h in enumerate(heads)
                       if i not in used_mark and j not in used_head and (c := cost(x, y, h, tolerance)) is not None)
        for _, i, j in pairs:
            if i not in used_mark and j not in used_head:
                used_mark.add(i)
                used_head.add(j)
                heads[j][key] = mine[i][2]
    lost = [mine[i] for i in range(len(mine)) if i not in used_mark]
    LOST.extend(lost)
    return lost


M.attach_fingers = attach_fingers
