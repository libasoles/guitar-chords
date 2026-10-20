"""Edición Santisteban: MusicXML del Preludio 8 (Fa# menor, 3/4), transcrito a mano de la imagen.

Las alturas salen de `detect_notes.py`; bajos huecos, dedos, alteraciones y el acorde final se leyeron a ojo.
Ver reports/prelude-08.md.

    python scripts/carcassi-preludios/transcribe_08.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "santisteban", "prelude-08.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = 3  # Fa#, Do#, Sol#


def measure(low, high, first, second, third):
    """Bajo de blanca (pulsos 1-2) y de negra (pulso 3); la voz superior lleva 3 + 4 + 3 semicorcheas."""
    return {"bass": bass((0, 8, low), (8, 4, high)), "up": slots([N, *first, *second, N, *third])}


MEASURES = [
    measure("F#4:3", "F#4", ["A4", "C#5", "A4"], ["F#5", "A4", "C#5", "A4"], ["A4", "C#5", "F#5"]),
    measure("D4", "D4", ["A4", "D5:2", "A4"], ["F#5", "A4", "D5", "A4"], ["A4", "D5", "F#5"]),
    measure("B3:1", "B3", ["B4:3", "D5:2", "B4"], ["G#5:4", "B4", "D5", "B4"], ["B4", "D5", "G#5"]),
    # 4: do#4 de bajo; mi# con sostenido (dura todo el compas)
    measure("C#4", "C#4", ["G#4:3", "B4", "G#4"], ["E#5:4", "G#4", "B4", "G#4"], ["G#4", "B4", "E#5"]),
    measure("F#4:3", "F#4", ["A4", "C#5", "A4"], ["F#5", "A4", "C#5", "A4"], ["A4", "C#5", "F#5"]),
    # 6: si# con sostenido (dura todo el compas)
    measure("D4", "D4", ["A4:2", "B#4:1", "A4"], ["F#5:3", "A4", "B#4", "A4"], ["A4", "B#4", "F#5"]),
    # 7: si natural
    measure("C#4", "C#4", ["G#4:3", "B4", "G#4"], ["F#5:4", "G#4", "B4", "G#4"], ["G#4", "B4", "F#5"]),
    measure("C#4", "C#4", ["G#4:3", "B4", "G#4"], ["E#5:4", "G#4", "B4", "G#4"], ["G#4", "B4", "E#5"]),
    measure("F#4:3", "C#4:3", ["A4", "C#5", "A4"], ["F#5", "A4", "C#5", "A4"], ["A4", "C#5", "F#5"]),
    # 10: tres bajos de negra y tres semicorcheas ascendentes sobre cada uno
    {"bass": bass((0, 4, "A3:0"), (4, 4, "C#4:3"), (8, 4, "A3:0")),
     "up": slots([N, "A4", "C#5", "F#5", N, "A4", "C#5", "F#5", N, "A4", "C#5", "F#5"])},
    # 11: cierre, fa#3 de blanca con puntillo, silencio de negra y acorde de blanca
    {"bass": bass((0, 12, "F#3:2")),
     "up": [(0, 4, "R", None), (4, 8, "A4+C#5+F#5", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 8 in F# Minor", KEY_FIFTHS, MEASURES, time=(3, 4))
