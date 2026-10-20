"""Edición Santisteban: MusicXML del Preludio 13 (Si bemol mayor, 12/8), transcrito a mano de la imagen.

Las alturas de las corcheas salen de `detect_notes.py`; los bajos huecos (con `bass_strips.py`), dedos y
alteraciones se leyeron a ojo. Ver reports/prelude-13.md.

    python scripts/carcassi-preludios/transcribe_13.py
"""
import os

from transcribe_lib import bass, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "santisteban", "prelude-13.musicxml")
KEY_FIFTHS = -2  # Si bemol, Mi bemol


def cell(text, pos):
    pitch, _, finger = text.partition(":")
    return (pos, 2, pitch, finger or None)


def measure(first, second):
    """Dos mitades de 12/8 [bajo de blanca con puntillo, cinco corcheas] (una unidad = una semicorchea)."""
    notes = [cell(t, 2 * (i + 1)) for i, t in enumerate(first[1])] + [cell(t, 12 + 2 * (i + 1)) for i, t in enumerate(second[1])]
    return {"bass": bass((0, 12, first[0]), (12, 12, second[0])), "up": notes}


MEASURES = [
    measure(("Bb3:1", ["F4:2", "Bb4:3", "D5:4", "Bb4", "F4"]), ("D4", ["Bb4", "D5", "F5:1", "D5", "Bb4"])),
    # 2: mi natural (la armadura tiene mi bemol)
    measure(("C4", ["G4:3", "Bb4", "E5:4", "Bb4", "G4"]), ("C4", ["G4", "Bb4", "E5", "Bb4", "G4"])),
    measure(("F3:1", ["F4:3", "A4:2", "Eb5:4", "A4", "F4"]), ("F3", ["F4", "A4", "Eb5", "A4", "F4"])),
    # 4: fa# de bajo con sostenido (vale para todo el compas)
    measure(("F#3:1", ["D4", "A4", "D5:4", "A4", "D4"]), ("F#3", ["D4", "A4", "D5", "A4", "D4"])),
    measure(("G3", ["D4:3", "G4:4", "Bb4", "G4", "D4"]), ("G4:2", ["Bb4", "D5", "Bb5:4", "D5", "Bb4"])),
    # 6: re bemol en la segunda mitad y mi natural en el bajo
    measure(("Eb4:1", ["G4", "C5:2", "G5:4", "C5", "G4"]), ("E4:1", ["G4", "Db5:2", "G5", "Db5", "G4"])),
    measure(("F4:2", ["Bb4:3", "D5:4", "F5:1", "D5", "Bb4"]), ("F4:1", ["C5:3", "Eb5:2", "A5:4", "Eb5", "C5"])),
    # 8: cierre, arpegio ascendente sobre el si bemol grave, si bemol de negra y silencios en las dos voces
    {"bass": bass((0, 12, "Bb3"), (12, 4, "Bb3"), (16, 2, "R"), (18, 4, "R"), (22, 2, "R")),
     "up": [cell(t, 2 * (i + 1)) for i, t in enumerate(["F4:3", "Bb4:4", "D5", "F5", "Bb5"])]
     + [(16, 2, "R", None), (18, 4, "R", None), (22, 2, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 13 in Bb Major", KEY_FIFTHS, MEASURES, time=(12, 8), group=12)
