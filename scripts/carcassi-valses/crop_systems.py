"""Recorta cada sistema (pentagrama con su bajo) de una pagina del escaneo de Ditson para revisarlo a ojo.

    python crop_systems.py <pagina-pdf> <directorio-salida> [dpi]
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

SOURCE = Path(__file__).resolve().parents[2] / 'resources' / 'Libro Carcassi - Metodo.pdf'


def systems(gray):
    dark = (gray < 110).mean(axis=1)
    rows = np.where(dark > 0.35)[0]
    lines, last = [], None
    for r in rows:
        if last is None or r - last > 3:
            lines.append([r])
        else:
            lines[-1].append(r)
        last = r
    centers = [int(np.mean(l)) for l in lines]
    groups, cur = [], [centers[0]]
    for c in centers[1:]:
        if c - cur[-1] < 40:
            cur.append(c)
        else:
            groups.append(cur)
            cur = [c]
    groups.append(cur)
    return [g for g in groups if len(g) >= 5]


def main(page, out, dpi=200):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(page), '-l', str(page), '-png', str(SOURCE), f'{tmp}/p'], check=True)
        img = Image.open(next(Path(tmp).glob('p-*.png'))).convert('L')
    gray = np.array(img)
    found = systems(gray)
    print(len(found), 'sistemas', [(g[0], g[-1]) for g in found])
    for i, g in enumerate(found):
        top = max(0, g[0] - 110)
        nxt = found[i + 1][0] - 110 if i + 1 < len(found) else gray.shape[0]
        bottom = min(gray.shape[0], g[-1] + 140, nxt + 20)
        img.crop((int(img.width * 0.05), top, int(img.width * 0.97), bottom)).save(out / f'p{page}-s{i + 1}.png')


if __name__ == '__main__':
    main(int(sys.argv[1]), sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 200)
