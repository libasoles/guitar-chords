"""Edición Santisteban: MusicXML del Preludio 2 (La menor), transcrito a mano de la imagen.

homr leyó los 8 compases con las alturas casi correctas, pero los dedos aparecieron como
alteraciones y octavas absurdas (`Ab4`, `Cb5`) y no conservó dedos ni alteraciones reales.
Ver reports/prelude-02.md.

    python scripts/carcassi-preludios/transcribe_02.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "santisteban", "prelude-02.musicxml")
N = None  # celda ocupada por el bajo

MEASURES = [
    # 1-2: bajo de negra con puntillo + corchea; el flujo de semicorcheas ocupa el resto
    {"bass": bass((0, 6, "A3"), (6, 2, "A3"), (8, 6, "F4:4"), (14, 2, "F4")),
     "up": slots([N, "A4:3", "C5:1", "A4", "C5", "A4", N, "A4", N, "A4", "C5", "A4", "C5", "A4", N, "A4"])},
    {"bass": bass((0, 6, "D4"), (6, 2, "D4"), (8, 6, "E4:2"), (14, 2, "E4")),
     "up": slots([N, "A4:3", "B4", "A4", "B4", "A4", N, "A4", N, "G#4:1", "B4", "G#4", "B4", "G#4", N, "G#4"])},
    # 3-4, 6-7: bajo de blanca y siete semicorcheas
    {"bass": bass((0, 8, "A3"), (8, 8, "G3:3")),
     "up": slots([N, "A4:2", "C5", "A4", "E5", "A4", "C5", "A4", N, "G4", "B4", "G4", "F5:1", "G4", "B4", "G4"])},
    {"bass": bass((0, 8, "C4:4"), (8, 8, "B3:2")),
     "up": slots([N, "G4", "C5:1", "G4", "E5", "G4", "C5", "G4", N, "G#4:1", "D5:4", "G#4", "E5", "G#4", "D5", "G#4"])},
    # 5: bajo de negra
    {"bass": bass((0, 4, "A3"), (4, 4, "F4:4"), (8, 4, "D4"), (12, 4, "E4:2")),
     "up": slots([N, "A4:3", "C5:1", "A4", N, "A4", "C5", "A4", N, "A4", "B4", "A4", N, "G#4:1", "B4", "G#4"])},
    {"bass": bass((0, 8, "A3"), (8, 8, "E3")),
     "up": slots([N, "A4", "C5", "A4", "E5", "A4", "C5", "A4", N, "G#4:1", "B4", "G#4", "E5", "G#4", "B4", "G#4"])},
    {"bass": bass((0, 8, "A3"), (8, 8, "E3")),
     "up": slots([N, "A4", "C5", "A4", "E5", "A4", "C5", "A4", N, "G#4", "D5:4", "G#4", "E5", "G#4", "D5", "G#4"])},
    # 8: cierre, A4 de negra y silencio
    {"bass": bass((0, 8, "A3"), (8, 4, "A3"), (12, 4, "R")),
     "up": slots([N, "E4:2", "A4:3", "E4", "C5:1", "A4", "E5", "C5"]) + [(8, 4, "A4", None), (12, 4, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 2 in A Minor", 0, MEASURES)
