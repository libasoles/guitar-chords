"""Casillas del motor contra las de la TAB impresa de la edicion (cuerda y traste, no solo la altura).

    python scripts/giuliani-arpegios/compare_positions.py [N ...]    # por ejercicio: casillas distintas / casillas impresas

`transcribe.py` solo comprueba que las alturas coincidan; aqui se mide cuanto se parece la digitacion que propone el
motor (con las reglas de arpegio) a la del libro. Solo mide; no escribe nada.
"""
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'backend' / 'engine'))

import transcribe as T  # noqa: E402
import tabify  # noqa: E402


def engine_cells(number):
    with T.B.reviewed_tuplets(tabify, number):
        score, part = tabify.load_score([str(HERE / 'sources' / f'{number:03d}.musicxml')])
    measures, _ = tabify.build_columns(part, tabify.octave_shifts(list(part.getElementsByClass(tabify.m21.stream.Measure))))
    tabify.assign_frets(measures, tabify.STANDARD_TUNING, 'auto' if number in T.B.ARPEGGIO else False)
    return Counter((s, f) for m in measures for col in m['columns'] for s, f in enumerate(col['cells']) if f is not None)


def run(numbers):
    exercises = T.read_exercises()
    numbers = numbers or sorted(int(p.stem) for p in (HERE / 'sources').glob('*.musicxml'))
    total_diff = total = 0
    for n in numbers:
        printed = Counter((s, f) for _, s, f in exercises[n]['cells'])
        mine = engine_cells(n)
        diff = sum(((mine - printed) + (printed - mine)).values()) // 2
        size = sum(printed.values())
        total_diff += diff
        total += size
        print(f'{n:3d} {diff:3d}/{size:3d}' + (f'  motor de mas={sorted((mine - printed).items())[:6]} impresas={sorted((printed - mine).items())[:6]}' if diff else ''))
    print(f'total {total_diff}/{total}')


if __name__ == '__main__':
    run([int(a) for a in sys.argv[1:]])
