"""MusicXML corregido del Preludio 3 (Sol mayor), transcrito a mano de la imagen.

homr leyó los 7 compases con el ritmo coherente, pero los dedos aparecieron como
alteraciones y octavas absurdas (`Gb3`, `Cb5`) y el final quedó duplicado.
Ver reports/prelude-03.md.

    python scripts/carcassi-preludios/transcribe_03.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrected", "prelude-03.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = 1  # Sol mayor: Fa#


def beats(*groups):
    """Cuatro pulsos [bajo, a, b, c] -> (bass, up). Bajo y notas pueden llevar dedo: "G3:3"."""
    bass_events, cells = [], []
    for beat, (low, a, b, c) in enumerate(groups):
        bass_events.append((beat * 4, 4, low))
        cells += [N, a, b, c]
    return {"bass": bass(*bass_events), "up": slots(cells)}


MEASURES = [
    beats(("G3:3", "B4", "G5:4", "B4"), ("G4", "B4", "G5", "B4"), ("E4:2", "B4", "G5", "B4"), ("G4", "B4", "G5", "B4")),
    beats(("C4:3", "C5:1", "E5", "C5"), ("G4", "C5", "E5", "C5"), ("A3", "C5", "E5", "C5"), ("A4:2", "C5", "E5", "C5")),
    beats(("D4", "C5", "F#5:3", "C5"), ("A4:2", "C5", "F#5", "C5"), ("D#4:1", "B4", "F#5", "B4"), ("A4", "B4", "F#5", "B4")),
    beats(("E4:2", "B4", "G5:4", "B4"), ("G4", "B4", "G5", "B4"), ("C4:3", "C5:1", "G5", "C5"), ("A4:2", "C5", "G5", "C5")),
    beats(("D4", "B4", "G5", "B4"), ("G4", "B4", "G5", "B4"), ("D4", "C5:1", "F#5:3", "C5"), ("A4:2", "C5", "F#5", "C5")),
    beats(("G3:3", "B4", "G5:4", "B4"), ("B3:2", "B4", "G5", "B4"), ("D4", "B4", "G5", "B4"), ("B3", "B4", "G5", "B4")),
    # 7: cierre, sol grave de blanca y silencio de blanca
    {"bass": bass((0, 8, "G3")), "up": [(8, 8, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 3 in G Major", KEY_FIFTHS, MEASURES)
