"""Edición Santisteban: MusicXML del Preludio 7 (La mayor, 6/8), transcrito a mano de la imagen.

Las alturas salen de `detect_notes.py`; bajos huecos, dedos, alteraciones y el acorde final se leyeron a ojo.
Ver reports/prelude-07.md.

    python scripts/carcassi-preludios/transcribe_07.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "santisteban", "prelude-07.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = 3  # Fa#, Do#, Sol#


def measure(first, second):
    """Dos mitades de 6/8 [bajo, a, b, c, d, e]; el bajo es de negra con puntillo y las cinco semicorcheas siguen."""
    return {"bass": bass((0, 6, first[0]), (6, 6, second[0])), "up": slots([N, *first[1:], N, *second[1:]])}


MEASURES = [
    measure(("A3", "A4:2", "C#5:3", "A4", "C#5", "A4"), ("A3", "A4", "C#5", "A4", "E5", "A4")),
    measure(("D4", "A4:2", "B4", "A4", "B4", "A4"), ("D4", "A4", "B4", "A4", "F#5:3", "A4")),
    # 3: re♯ del bajo (el segundo re sigue siendo re♯ por la alteracion del compas)
    measure(("D#4:1", "A4:2", "B4", "A4", "B4", "A4"), ("D#4", "A4", "B4", "A4", "F#5:3", "A4")),
    measure(("E4:2", "G#4:1", "B4", "G#4", "B4", "G#4"), ("E4", "G#4", "B4", "G#4", "E5", "G#4")),
    # 5: sol natural (la armadura tiene sol♯)
    measure(("A3", "A4", "C#5", "A4", "C#5", "A4"), ("A3", "A4", "C#5", "A4", "G5:2", "A4")),
    # 6: re♯ en la segunda mitad y do natural
    measure(("D4", "A4", "D5:2", "A4", "F#5", "A4"), ("D#4", "A4:2", "C5", "A4", "F#5:3", "A4")),
    measure(("E4:1", "A4:2", "C#5:3", "A4", "E5", "A4"), ("E3", "G#4:2", "B4", "G#4", "E5", "G#4")),
    # 8: seis semicorcheas de la voz superior sobre el la3 de negra con puntillo; luego acorde de negra
    # (do♯5 con dedo 1 y la5 con dedo 4), la3 de negra y silencio de corchea en las dos voces
    {"bass": bass((0, 6, "A3"), (6, 4, "A3"), (10, 2, "R")),
     "up": slots(["A4", "A4", "C#5:3", "C#5", "E5", "E5"]) + [(6, 4, "C#5:1+A5:4", None), (10, 2, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 7 in A Major", KEY_FIFTHS, MEASURES, time=(6, 8))
