"""MusicXML corregido del Preludio 4 (Mi menor, 6/8), transcrito a mano de la imagen.

Ver reports/prelude-04.md.

    python scripts/carcassi-preludios/transcribe_04.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrected", "prelude-04.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = 1  # Fa#


def measure(first, second):
    """Dos mitades de 6/8 [bajo, a, b, c, d, e]; el bajo es de negra con puntillo y las cinco semicorcheas siguen."""
    bass_events = [(0, 6, first[0]), (6, 6, second[0])]
    return {"bass": bass(*bass_events), "up": slots([N, *first[1:], N, *second[1:]])}


MEASURES = [
    measure(("E3", "G4", "B4", "G5:4", "G4", "B4"), ("E3", "G4", "B4", "E5", "G4", "B4")),
    measure(("E3", "A4:2", "C5:1", "F#5:3", "A4", "C5"), ("E3", "A4", "C5", "E5", "A4", "C5")),
    measure(("E3", "F#4:3", "A4:1", "D#5:4", "F#4", "A4"), ("E3", "A4:1", "B4", "F#5:2", "A4", "B4")),
    measure(("E3", "G4", "B4", "E5", "G4", "B4"), ("E4:3", "G4", "B4", "E5", "G4", "B4")),
    measure(("D4", "G#4:1", "B4", "F5:2", "G#4", "B4"), ("D4", "G#4", "B4", "E5", "G#4", "B4")),
    measure(("C4:4", "A4:3", "C5:1", "E5", "A4", "C5"), ("A3", "A4", "C5", "F#5:4", "A4", "C5")),
    measure(("B3:2", "G4", "B4", "E5", "G4", "B4"), ("B3", "A4:3", "B4", "F#5:4", "A4", "B4")),
    # 8: cierre, mi4 grave y armonico de mi (12 traste, cuerda 1) con calderon
    {"bass": bass((0, 6, "E3"), (6, 6, "E4")),
     "up": slots([N, "G4", "B4", "E5", "G4", "B4"]) + [(6, 6, "E6*", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 4 in E Minor", KEY_FIFTHS, MEASURES, time=(6, 8))
