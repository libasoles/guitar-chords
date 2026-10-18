"""MusicXML corregido del Preludio 11 (Fa mayor, 6/8), transcrito a mano de la imagen.

Las alturas salen de `detect_notes.py` (bajos macizos incluidos); dedos y alteraciones se leyeron a ojo.
Ver reports/prelude-11.md.

    python scripts/carcassi-preludios/transcribe_11.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrected", "prelude-11.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = -1  # Si bemol


def measure(first, second):
    """Dos mitades de 6/8 [bajo, a, b, c, d, e]; el bajo es de negra con puntillo y las cinco semicorcheas siguen."""
    return {"bass": bass((0, 6, first[0]), (6, 6, second[0])), "up": slots([N, *first[1:], N, *second[1:]])}


MEASURES = [
    measure(("F4:3", "A4:2", "C5", "F5", "C5", "A4"), ("F4", "A4", "C5", "F5", "C5", "A4")),
    measure(("C4:3", "G4", "C5:1", "E5", "C5", "G4"), ("C4", "G4", "C5", "E5", "C5", "G4")),
    # 3: si bemol de la armadura (el libro no lo repite)
    measure(("E4:2", "Bb4:3", "C5:1", "G5:4", "C5", "Bb4"), ("E4", "Bb4", "C5", "G5", "C5", "Bb4")),
    measure(("F4:3", "A4:2", "C5", "F5", "C5", "A4"), ("F4", "A4", "C5", "F5", "C5", "A4")),
    # 5: do# con sostenido (dura todo el compas)
    measure(("E4", "A4", "C#5", "G5:2", "C#5", "A4"), ("A3", "A4", "C#5", "G5", "C#5", "A4")),
    measure(("D4", "A4:2", "D5:4", "F5:1", "D5", "A4"), ("Bb3:1", "Bb4:4", "D5:4", "G5:4", "D5", "Bb4")),
    measure(("C4:3", "A4:2", "C5", "F5", "C5", "A4"), ("C4:3", "Bb4:4", "C5:1", "E5", "C5", "Bb4")),
    # 8: cierre, fa4 de negra con silencio de corchea en las dos voces
    {"bass": bass((0, 6, "F4:3"), (6, 4, "F4"), (10, 2, "R")),
     "up": slots([N, "A4:2", "C5", "F5", "C5", "A4"]) + [(10, 2, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 11 in F Major", KEY_FIFTHS, MEASURES, time=(6, 8))
