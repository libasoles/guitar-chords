"""Edición Santisteban: MusicXML del Preludio 12 (Re menor), transcrito a mano de la imagen.

Las alturas de las semicorcheas salen de `detect_notes.py`; los bajos huecos (con `bass_strips.py`), dedos y
alteraciones se leyeron a ojo. Ver reports/prelude-12.md.

    python scripts/carcassi-preludios/transcribe_12.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "santisteban", "prelude-12.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = -1  # Si bemol


def halves(first, second):
    """Dos mitades [bajo de blanca, siete semicorcheas]."""
    return {"bass": bass((0, 8, first[0]), (8, 8, second[0])), "up": slots([N, *first[1], N, *second[1]])}


def walking(first, notes, bass_line, top):
    """Primera mitad como `halves`; la segunda lleva cuatro bajos de corchea con una semicorchea aguda en cada contratiempo."""
    events = [(8 + 2 * i, 2, p.partition(":")[0], p.partition(":")[2] or None) for i, p in enumerate(bass_line)]
    upper = slots([N, *notes]) + [(9 + 2 * i, 1, p.partition(":")[0], p.partition(":")[2] or None) for i, p in enumerate(top)]
    return {"bass": bass((0, 8, first), *[(e[0], e[1], e[2] + (":" + e[3] if e[3] else "")) for e in events]), "up": upper}


A_D = ["A4:2", "D5:4", "A4", "F5:1", "A4", "D5", "A4"]  # arpegio de re menor con dedos
A_PLAIN = ["A4", "D5", "A4", "F5", "A4", "D5", "A4"]
BB = ["Bb4:3", "C#5:2", "Bb4", "G5:4", "Bb4", "C#5", "Bb4"]
A_C = ["A4:2", "C#5:3", "A4", "E5", "A4", "C#5", "A4"]
D5s = ["D5:4", "D5", "D5", "D5"]

MEASURES = [
    halves(("D4", A_D), ("D4", BB)),
    walking("D4", A_D, ["D4", "F4:3", "D4", "C4:3"], D5s),
    # 3: si natural de bajo (la armadura tiene si bemol) y sol# con sostenido
    halves(("B3:2", ["G#4:1", "D5:4", "G#4", "E5", "G#4", "D5", "G#4"]), ("E3", ["G#4", "D5", "G#4", "E5", "G#4", "D5", "G#4"])),
    # 4: do# y si natural en el bajo de corcheas
    walking("A3", A_C, ["A3", "B3:1", "C#4:4", "A3"], ["A4:2", "A4", "A4", "A4"]),
    halves(("D4", A_D), ("D4", BB)),
    walking("D4", A_PLAIN, ["D4", "F4:3", "E4:2", "D4"], D5s),
    halves(("C4:3", ["Bb4:4", "C5:1", "Bb4", "E5", "Bb4", "C5", "Bb4"]), ("E4:2", ["Bb4:3", "C5:1", "Bb4", "G5:4", "Bb4", "C5", "Bb4"])),
    halves(("F4:3", ["A4:2", "C5", "A4", "F5", "A4", "C5", "A4"]), ("F3", ["A4", "C5", "A4", "F5", "A4", "C5", "A4"])),
    walking("E3", ["A4", "C#5", "A4", "G5:3", "A4", "C#5", "A4"], ["A3", "B3:1", "C#4:4", "A3"], ["A4:2", "A4", "A4", "A4"]),
    # 10: sexta aumentada (si bemol, sol#, re, fa)
    halves(("D4", A_D), ("Bb3", ["G#4", "D5:4", "G#4", "F5", "G#4", "D5", "G#4"])),
    halves(("A3", A_D), ("A3", A_C)),
    # 12: cierre, re4 de negra en tres pulsos, acorde de negra (fa5, la5, re6) y silencio de negra en las dos voces
    {"bass": bass((0, 4, "D4"), (4, 4, "D4"), (8, 4, "D4"), (12, 4, "R")),
     "up": slots([N, "A4:2", "D5:4", "F5:1", N, "D5:3", "F5:2", "A5:1"]) + [(8, 4, "F5+A5+D6", None), (12, 4, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 12 in D Minor", KEY_FIFTHS, MEASURES)
