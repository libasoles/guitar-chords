"""Tiras de ayuda para leer a ojo los bajos (cabezas huecas) de un preludio.

    python scripts/carcassi-preludios/bass_strips.py N [sistema ...]

Escribe `.work/strips-NN.png`: por cada mitad de sistema, el pentagrama y la zona de los bajos con una guia
gris por semitono (paso diatonico) rotulada con la nota. Mira donde cae el centro de cada cabeza.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import detect_notes as d  # noqa: E402


def main(number, only):
    png = os.path.join(d.WORK, f"prelude-{number:02d}.png")
    image = Image.open(png).convert("RGB")
    mask = np.array(image.convert("L")) < 140
    staves, spacing = d.staff_lines(mask)
    step = spacing / 2
    strips = []
    for si, five in enumerate(staves):
        if only and si + 1 not in only:
            continue
        top, bottom = int(five[0] - spacing * .6), int(five[4] + spacing * 4.2)
        for half in range(2):
            x0, x1 = (0, 1700) if half == 0 else (1600, image.width)
            strip = image.crop((x0, top, x1, bottom))
            draw = ImageDraw.Draw(strip)
            pix = np.array(strip)
            overlay = Image.new("RGB", strip.size, (255, 255, 255))
            od = ImageDraw.Draw(overlay)
            for k in range(-9, 10):
                y = five[4] - k * step - top
                if 0 <= y < strip.height:
                    od.line([(0, y), (strip.width, y)], fill=(255, 150, 150) if k % 2 == 0 else (150, 170, 255), width=1)
                    od.text((x0 and 4 or 4, y - 5), d.name(k), fill=(200, 0, 0))
            ov = np.array(overlay)
            white = (pix > 235).all(axis=2)
            pix[white] = np.minimum(pix[white], ov[white])
            strip = Image.fromarray(pix)
            ImageDraw.Draw(strip).text((strip.width - 80, 2), f"s{si + 1}{'ab'[half]}", fill=(0, 120, 0))
            strips.append(strip)
    # tres tiras por imagen para que se lean a tamano real
    out = []
    for i in range(0, len(strips), 4):
        group = strips[i:i + 4]
        sheet = Image.new("RGB", (max(s.width for s in group), sum(s.height for s in group)), "white")
        y = 0
        for s in group:
            sheet.paste(s, (0, y))
            y += s.height
        path = os.path.join(os.path.dirname(d.WORK), f"strips-{number:02d}-{i // 4 + 1}.png")
        sheet.save(path)
        out.append(path)
    print("\n".join(out))


if __name__ == "__main__":
    main(int(sys.argv[1]), {int(a) for a in sys.argv[2:]})
