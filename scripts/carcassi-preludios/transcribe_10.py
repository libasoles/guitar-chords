"""MusicXML corregido del Preludio 10 (Do# menor, 12/8), transcrito a mano de la imagen.

Las alturas de las corcheas salen de `detect_notes.py`; los bajos huecos (con `bass_strips.py`), dedos y
alteraciones se leyeron a ojo. Ver reports/prelude-10.md.

    python scripts/carcassi-preludios/transcribe_10.py
"""
import os

from transcribe_lib import bass, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrected", "prelude-10.musicxml")
KEY_FIFTHS = 4  # Fa#, Do#, Sol#, Re#


def cell(text, pos):
    pitch, _, finger = text.partition(":")
    return (pos, 2, pitch, finger or None)


def measure(first, second):
    """Dos mitades de 12/8 [bajo de blanca con puntillo, cinco corcheas] (una unidad = una semicorchea)."""
    notes = [cell(t, 2 * (i + 1)) for i, t in enumerate(first[1:])] + [cell(t, 12 + 2 * (i + 1)) for i, t in enumerate(second[1:])]
    return {"bass": bass((0, 12, first[0]), (12, 12, second[0])), "up": notes}


MEASURES = [
    measure(("C#4:1", "G#4:3", "C#5:4", "E5:2", "C#5", "G#4"), ("C#4", "G#4", "C#5", "E5", "C#5", "G#4")),
    # 2: si# con sostenido (dura todo el compas): sol#7 sobre re#
    measure(("D#4", "G#4", "B#4", "F#5:2", "B#4", "G#4"), ("D#4", "G#4", "B#4", "F#5", "B#4", "G#4")),
    # 3: mi# de bajo y re natural
    measure(("E#4:1", "B4:3", "D5:2", "G#5:4", "D5", "B4"), ("E#4", "B4", "D5", "G#5", "D5", "B4")),
    measure(("F#4:3", "A4", "C#5", "A5:4", "C#5", "A4"), ("F#4", "A4", "C#5", "A5", "C#5", "A4")),
    # 5: si# otra vez y re# de la armadura
    measure(("F#4", "B#4:2", "D#5", "G#5", "D#5", "B#4"), ("F#4", "B#4", "D#5", "G#5", "D#5", "B#4")),
    measure(("E4:2", "G#4:1", "C#5:3", "G#5:4", "C#5", "G#4"), ("E4", "G#4", "C#5", "G#5", "C#5", "G#4")),
    measure(("D#4:1", "A4:2", "C#5:3", "F#5:4", "C#5", "A4"), ("D#4", "A4", "C#5", "F#5", "C#5", "A4")),
    measure(("G#3:1", "G#4:3", "C#5:4", "E5:2", "C#5", "G#4"), ("F#3", "F#4:3", "A4", "D#5:4", "A4", "F#4")),
    # 9: la segunda mitad lleva si# con sostenido (sol#7 sobre sol#3)
    measure(("E3", "E4:2", "G#4:1", "C#5:3", "G#4", "E4"), ("G#3:4", "D#4", "G#4", "B#4", "G#4", "D#4")),
    # 10: cierre, arpegio ascendente de seis corcheas, do#6 de blanca (el libro lo antecede con una
    # apoyatura que no se dibuja) y silencio de negra
    {"bass": [],
     "up": [cell(t, 2 * i) for i, t in enumerate(["C#4:4", "E4:2", "G#4:1", "C#5:1", "E5:4", "G#5:4"])]
     + [(12, 8, "C#6", "4"), (20, 4, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 10 in C# Minor", KEY_FIFTHS, MEASURES, time=(12, 8), group=12)
