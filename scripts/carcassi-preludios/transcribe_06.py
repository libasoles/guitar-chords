"""MusicXML corregido del Preludio 6 (Si menor, 3/4 con tresillos), transcrito a mano de la imagen.

Las alturas de las corcheas salen de `detect_notes.py`; bajos, dedos, alteraciones y ligadura se leyeron
a ojo. Ver reports/prelude-06.md.

    python scripts/carcassi-preludios/transcribe_06.py
"""
import os

from transcribe_lib import bass, slots
from transcribe_triplets import write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrected", "prelude-06.musicxml")
N = None  # posicion 0: la ocupa el bajo, unido a la barra del primer tresillo
KEY_FIFTHS = 2  # Fa#, Do#


def measure(low, notes):
    """Bajo de blanca (pulsos 1-2) y ocho corcheas de tresillo en las posiciones 1..8."""
    return {"bass": bass((0, 6, low)), "up": slots([N, *notes])}


# Los dedos van como "F#4:3"; do natural (c. 11-12) y la♯ (c. 5-6, 14) se escriben en la altura.
BM = ["F#4", "B4", "D5", "B4", "F#4", "F#5", "D5", "B4"]
FS = ["F#4", "A#4", "C#5", "A#4", "F#4", "F#5", "C#5", "A#4"]
EM = ["G4", "B4", "E5", "B4", "G4", "G5", "E5", "B4"]
G = ["G4", "B4", "D5", "B4", "G4", "G5", "D5", "B4"]
EC = ["E4", "G4", "C5", "G4", "E4", "G5", "C5", "G4"]


def fingers(notes, **by_index):
    out = list(notes)
    for index, finger in by_index.items():
        out[int(index[1:])] += f":{finger}"
    return out


MEASURES = [
    measure("B3", fingers(BM, i0=3, i1=4, i2=2)),
    measure("B3", BM),
    measure("E3", fingers(EM, i0=3, i1=2, i2=4, i5=1)),
    measure("E3", EM),
    measure("F#3", fingers(FS, i0=3, i1=2)),
    measure("F#3", FS),
    measure("B3", fingers(BM, i0=3, i1=4, i2=2)),
    measure("B3", BM),
    measure("G3", fingers(G, i0=3, i1=2)),
    measure("G3", G),
    measure("E3", fingers(EC, i0=2, i2=1, i5=4)),
    measure("E3", EC),
    measure("F#3", fingers(BM, i0=3, i1=4, i2=2)),
    measure("F#3", fingers(FS, i0=3, i1=2)),
    # 15: si3 de blanca con puntillo ligada al compas siguiente; la segunda corchea del pulso 2 repite re5
    {"bass": bass((0, 9, "B3~")),
     "up": slots([N, "F#4:3", "B4:4", "D5:2", "B4", "D5", "F#5", "D5", "B4"])},
    # 16: si3 ligado, tresillo descendente re5-si4-fa#4, si3 de negra y silencio de negra en las dos voces
    {"bass": bass((0, 3, "B3_"), (3, 3, "B3"), (6, 3, "R")),
     "up": slots(["D5", "B4", "F#4"]) + [(6, 3, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 6 in B Minor", KEY_FIFTHS, MEASURES)
