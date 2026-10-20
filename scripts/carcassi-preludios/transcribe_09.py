"""Edición Santisteban: MusicXML del Preludio 9 (Mi mayor), transcrito a mano de la imagen.

Las alturas de las semicorcheas salen de `detect_notes.py`; los bajos huecos (con `bass_strips.py`), dedos y
alteraciones se leyeron a ojo. Ver reports/prelude-09.md.

    python scripts/carcassi-preludios/transcribe_09.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "santisteban", "prelude-09.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = 4  # Fa#, Do#, Sol#, Re#


def measure(first, second):
    """Dos mitades [bajo de blanca, siete semicorcheas]."""
    return {"bass": bass((0, 8, first[0]), (8, 8, second[0])), "up": slots([N, *first[1], N, *second[1]])}


MEASURES = [
    measure(("E3", ["B4", "E5:2", "B4", "G#5", "B4", "E5", "B4"]), ("E3", ["B4", "E5", "B4", "G#5", "B4", "E5", "B4"])),
    measure(("C#4", ["C#5:3", "E5:2", "C#5", "G#5", "C#5", "E5", "C#5"]), ("C#4", ["C#5", "E5", "C#5", "G#5", "C#5", "E5", "C#5"])),
    # 3-4: la5 natural (la no esta en la armadura)
    measure(("F#4:1", ["C#5:3", "F#5:4", "C#5", "A5:2", "C#5", "F#5", "C#5"]), ("F#4", ["C#5", "F#5", "C#5", "A5", "C#5", "F#5", "C#5"])),
    measure(("F#4", ["B4", "D#5", "B4", "A5:2", "B4", "D#5", "B4"]), ("B3", ["B4:3", "D#5:4", "B4", "F#5", "B4", "D#5", "B4"])),
    measure(("E3", ["B4", "E5:2", "B4", "G#5", "B4", "E5", "B4"]), ("E3", ["B4", "E5", "B4", "G#5", "B4", "E5", "B4"])),
    # 6: la3 y la#3 de bajo; sol natural en la segunda mitad
    measure(("A3", ["A4", "C#5", "A4", "F#5", "A4", "C#5", "A4"]), ("A#3:1", ["G4", "C#5:3", "G4", "E5", "G4", "C#5", "G4"])),
    measure(("B3:2", ["G#4:1", "B4", "G#4", "E5", "G#4", "B4", "G#4"]), ("B3", ["F#4:3", "A4", "F#4", "D#5:4", "F#4", "A4", "F#4"])),
    # 8: cierre, arpegio ascendente sobre el mi3 de blanca y acorde de blanca (sol#4 con dedo 3 y mi5 al aire)
    {"bass": bass((0, 8, "E3"), (8, 8, "E3")),
     "up": slots([N, "B3:2", "E4:3", "G#4:1", "B4:0", "E5:0", "G#5:1", "B5:4"]) + [(8, 8, "G#4:3+E5:0", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 9 in E Major", KEY_FIFTHS, MEASURES)
