"""MusicXML corregido del Preludio 5 (Re mayor), transcrito a mano de la imagen.

Ver reports/prelude-05.md.

    python scripts/carcassi-preludios/transcribe_05.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrected", "prelude-05.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = 2  # Fa#, Do#


def measure(first, second):
    """Dos mitades [bajo de blanca, siete semicorcheas]."""
    return {"bass": bass((0, 8, first[0]), (8, 8, second[0])), "up": slots([N, *first[1], N, *second[1]])}


MEASURES = [
    measure(("D4", ["A4:2", "D5:4", "A4", "F#5:3", "A4", "D5", "A4"]), ("D#4:1", ["A4", "B4", "A4", "F#5", "A4", "B4", "A4"])),
    measure(("E4:1", ["G4", "B4", "G4", "G5:3", "G4", "B4", "G4"]), ("A3", ["A4:1", "C#5:1", "A4", "G5:2", "A4", "C#5", "A4"])),
    measure(("A3", ["A4:1", "C#5:2", "A4", "E5", "A4", "C#5", "A4"]), ("D4", ["A4", "D5:3", "A4", "F#5:2", "A4", "D5", "A4"])),
    measure(("D4", ["A4:2", "C5:1", "A4", "F#5:3", "A4", "C5", "A4"]), ("G3:2", ["G4", "B4", "G4", "G5:3", "G4", "B4", "G4"])),
    measure(("E3", ["G#4:1", "B4:4", "G#4", "E5", "G#4", "B4", "G#4"]), ("E4:2", ["G#4", "B4", "G#4", "E5", "G#4", "B4", "G#4"])),
    measure(("A3", ["A4:1", "C#5:2", "A4", "E5", "A4", "C#5", "A4"]), ("A3", ["A4:1", "C#5:1", "A4", "G5:2", "A4", "C#5", "A4"])),
    measure(("D4", ["A4:1", "D5:2", "A4", "F#5:1", "A4", "D5", "A4"]), ("A4:3", ["A4", "D5", "A4", "F#5", "A4", "D5", "A4"])),
    # 8: cierre, re4 de blanca, re4 de negra y silencio de negra en las dos voces
    {"bass": bass((0, 8, "D4"), (8, 4, "D4"), (12, 4, "R")),
     "up": slots([N, "A4", "D5", "A4", "F#5", "A4", "D5", "A4"]) + [(12, 4, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 5 in D Major", KEY_FIFTHS, MEASURES)
