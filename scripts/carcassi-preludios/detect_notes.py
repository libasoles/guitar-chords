"""Detecta las cabezas de nota macizas de un recorte (`extract.py crop N`) para ayudar a transcribir.

    python scripts/carcassi-preludios/detect_notes.py N

Imprime, por sistema y por compás, las cabezas de izquierda a derecha como letra+octava SIN alteraciones
(la armadura y los accidentales se ponen a mano mirando la imagen). No ve cabezas huecas (blancas):
esas, los silencios y los dedos se leen a ojo. Pensado como ayuda, no como OCR.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(os.path.dirname(os.path.dirname(HERE)), ".work", "carcassi-preludios")
LETTERS = "CDEFGAB"


def box_sum(mask, k):
    """Suma por ventana k x k (esquina superior izquierda) con imagen integral."""
    integral = np.pad(mask.astype(np.int32).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    return integral[k:, k:] - integral[:-k, k:] - integral[k:, :-k] + integral[:-k, :-k]


def opening(mask, k):
    """Apertura con ventana cuadrada k: quita lineas, plicas y barras finas y deja las cabezas macizas."""
    eroded = box_sum(mask, k) == k * k
    padded = np.pad(eroded, ((k - 1, k - 1), (k - 1, k - 1)))
    return box_sum(padded, k) > 0


def staff_lines(mask):
    """[[y de las 5 lineas]] por pentagrama, y el espaciado."""
    rows = np.where(mask.mean(1) > 0.5)[0]
    runs, current = [], [rows[0]]
    for r in rows[1:]:
        if r - current[-1] <= 2:
            current.append(r)
        else:
            runs.append(current)
            current = [r]
    runs.append(current)
    groups = [np.mean(run) for run in runs if len(run) <= 8]  # las barras horizontales son mas gruesas que una linea
    staves, i = [], 0
    while i + 4 < len(groups):
        five = groups[i:i + 5]
        gaps = np.diff(five)
        if gaps.max() - gaps.min() < 4 and gaps.mean() < 80:
            staves.append(five)
            i += 5
        else:
            i += 1
    spacing = float(np.mean([np.diff(s).mean() for s in staves]))
    return staves, spacing


def components(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        stack, pixels = [(y, x)], []
        seen[y, x] = True
        while stack:
            cy, cx = stack.pop()
            pixels.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        ys, xs = zip(*pixels)
        out.append((len(pixels), np.mean(xs), np.mean(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1))
    return out


def barlines(mask, five, spacing):
    top, bottom = int(five[0]), int(five[4])
    cols = []
    for x in range(mask.shape[1]):
        inside = mask[top:bottom + 1, x].mean()
        above = mask[max(0, top - int(.5 * spacing)):top - 2, x].mean() if top > 3 else 0
        below = mask[bottom + 3:bottom + int(.5 * spacing), x].mean()
        if inside > .97 and above < .3 and below < .3:
            cols.append(x)
    bars = []
    for x in cols:
        if not bars or x - bars[-1][-1] > 3:
            bars.append([x])
        else:
            bars[-1].append(x)
    return [float(np.mean(b)) for b in bars]


def name(step):
    """step 0 = E4 (linea inferior del pentagrama); devuelve letra+octava sin alteracion."""
    index = 2 + step  # E es la letra 2 de CDEFGAB, octava 4
    return LETTERS[index % 7] + str(4 + index // 7)


def main(number):
    path = os.path.join(WORK, f"prelude-{number:02d}.png")
    mask = np.array(Image.open(path).convert("L")) < 140
    staves, spacing = staff_lines(mask)
    k = max(3, int(round(.62 * spacing)))
    heads = opening(mask, k)
    area0 = .8 * spacing * spacing
    notes = [c for c in components(heads) if .35 * area0 < c[0] < 3 * area0 and c[3] < 2.2 * spacing and c[4] < 2 * spacing]
    print(f"{len(staves)} sistemas, espaciado {spacing:.1f}px")
    measure_no = 1
    for si, five in enumerate(staves):
        bars = barlines(mask, five, spacing)
        edges = [0.0] + [b for b in bars if b > 0] + [float(mask.shape[1])]
        mid = (five[0] + five[4]) / 2
        mine = [c for c in notes if abs(c[2] - mid) < 6 * spacing]
        print(f"\nSistema {si + 1}")
        # los compases: entre barras (la primera 'barra' puede ser el inicio del pentagrama)
        spans = [(a, b) for a, b in zip(edges, edges[1:]) if b - a > 4 * spacing]
        for a, b in spans:
            inside = sorted((c for c in mine if a < c[1] < b), key=lambda c: c[1])
            seq = " ".join(name(round((five[4] - c[2]) / (spacing / 2))) for c in inside)
            if inside:
                print(f"  c.{measure_no}: {seq}")
                measure_no += 1


if __name__ == "__main__":
    main(int(sys.argv[1]))
