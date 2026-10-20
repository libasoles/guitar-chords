"""Revisa que cada compas de un PDF fuente sume su duracion: python check.py 5 [7 10 ...]."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pdf_notes as P  # noqa: E402
from transcribe_valses import SOURCES  # noqa: E402

for n in sys.argv[1:]:
    m = P.read(str(SOURCES / f'op59-{int(n):02d}.pdf'))
    t = m['time']
    full = t[0] * 16 // t[1]
    bad, short = [], []
    for i, x in enumerate(m['measures']):
        s = P.length_of(x)
        mid = (x['top'] + x['bottom']) / 2
        up = s['up'] + sum(full if r['dur'] == 16 else r['dur'] for r in x['rests'] if r['y'] < mid)
        dn = s['down'] + sum(full if r['dur'] == 16 else r['dur'] for r in x['rests'] if r['y'] >= mid)
        ok = (up == full and dn in (0, full)) or (dn == full and up in (0, full)) or (up + dn == full and 0 in (up, dn))
        if up > full or dn > full:
            bad.append((i + 1, up, dn))  # una voz se pasa del compas: error de lectura
        elif not ok:
            short.append(i + 1)
    print(n, m['fifths'], t, len(m['measures']), 'revisar:', bad, 'cortos (anacrusa/cierre/descansos):', short)
