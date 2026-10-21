"""Detecta las cabezas de nota macizas de un recorte (`extract.py crop N`) para ayudar a transcribir.

    python scripts/carcassi-preludios/detect_notes.py N

Imprime, por sistema y por compás, los Ataques de izquierda a derecha como letra+octava SIN alteraciones
(la armadura y los accidentales se ponen a mano mirando la imagen). Las cabezas que comparten plica forman un
acorde, aunque una segunda las desplace a ambos lados; las barras dan el valor (`/8` una barra, `/16` dos).
Lo que la imagen no resuelve se marca con `?` y el motivo (ver backend/ocr/chord_groups.py): revisar ese compás
a ojo. No ve cabezas huecas (blancas): esas, los silencios y los dedos se leen a ojo. Pensado como ayuda, no como OCR.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(os.path.dirname(os.path.dirname(HERE)), ".work", "carcassi-preludios")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "backend", "ocr"))
import chord_groups  # noqa: E402  (agrupacion por plica, compartida con las pruebas)

LETTERS = "CDEFGAB"


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


def label(chord, five, spacing):
    """`[B4 D5 E5]/8` for a chord, `E4` for a single head; `?motivo` when the image leaves it open."""
    pitches = [name(round((five[4] - h["cy"]) / (spacing / 2))) for h in chord["heads"]]
    text = pitches[0] if len(pitches) == 1 else "[" + " ".join(pitches) + "]"
    if chord["beams"]:
        text += {1: "/8", 2: "/16", 3: "/32"}.get(chord["beams"], f"/{chord['beams']}barras")
    if chord["issues"]:
        text += "?" + ",".join(chord["issues"])
    return text


def main(number):
    path = os.path.join(WORK, f"prelude-{number:02d}.png")
    mask = np.array(Image.open(path).convert("L")) < 140
    staves, spacing = staff_lines(mask)
    heads = chord_groups.find_heads(mask, spacing)
    print(f"{len(staves)} sistemas, espaciado {spacing:.1f}px")
    measure_no = 1
    for si, five in enumerate(staves):
        bars = barlines(mask, five, spacing)
        edges = [0.0] + [b for b in bars if b > 0] + [float(mask.shape[1])]
        mid = (five[0] + five[4]) / 2
        mine = [h for h in heads if abs(h["cy"] - mid) < 6 * spacing]
        chords = chord_groups.read_chords(mask, mine, int(five[0] - 4 * spacing), int(five[4] + 4 * spacing), spacing, bars)
        print(f"\nSistema {si + 1}")
        # los compases: entre barras (la primera 'barra' puede ser el inicio del pentagrama)
        spans = [(a, b) for a, b in zip(edges, edges[1:]) if b - a > 4 * spacing]
        for a, b in spans:
            inside = [c for c in chords if a < c["x"] < b]
            if inside:
                review = " (REVISAR)" if any(c["issues"] for c in inside) else ""
                print(f"  c.{measure_no}: " + " ".join(label(c, five, spacing) for c in inside) + review)
                measure_no += 1


if __name__ == "__main__":
    main(int(sys.argv[1]))
