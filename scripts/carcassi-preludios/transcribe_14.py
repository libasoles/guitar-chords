"""Edición Santisteban: MusicXML del Preludio 14 (Sol menor, 12/8), transcrito a mano de la imagen.

Las alturas de las corcheas salen de `detect_notes.py`; los bajos huecos (con `bass_strips.py`), dedos,
acordes y alteraciones se leyeron a ojo. Ver reports/prelude-14.md.

    python scripts/carcassi-preludios/transcribe_14.py
"""
import os

from transcribe_lib import bass, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "santisteban", "prelude-14.musicxml")
KEY_FIFTHS = -2  # Si bemol, Mi bemol
HALF, BEATS = [0, 12, 24], [0, 12, 18, 24]  # agrupacion de barras: dos mitades / mitad + dos pulsos


def cell(text, pos):
    pitch, _, finger = text.partition(":")
    return (pos, 2, pitch, finger or None)


def halves(first, second):
    """Dos mitades [bajo de blanca con puntillo, cinco corcheas] (una unidad = una semicorchea)."""
    notes = [cell(t, 2 * (i + 1)) for i, t in enumerate(first[1])] + [cell(t, 12 + 2 * (i + 1)) for i, t in enumerate(second[1])]
    return {"bass": bass((0, 12, first[0]), (12, 12, second[0])), "up": notes, "group": HALF}


def beats(first, low1, up1, low2, up2):
    """Mitad con bajo de blanca con puntillo y dos pulsos de bajo de negra con puntillo + dos corcheas."""
    notes = [cell(t, 2 * (i + 1)) for i, t in enumerate(first[1])] + [cell(t, 14 + 2 * i) for i, t in enumerate(up1)] + [cell(t, 20 + 2 * i) for i, t in enumerate(up2)]
    return {"bass": bass((0, 12, first[0]), (12, 6, low1), (18, 6, low2)), "up": notes, "group": BEATS}


def beat(pos, low, single, chord):
    """Pulso del compas 7: bajo, una corchea y un acorde de corchea."""
    return bass((pos, 6, low)), [cell(single, pos + 2), (pos + 4, 2, chord, None)]


def chords(*pulses):
    bass_events, up = [], []
    for b, u in pulses:
        bass_events += b
        up += u
    return {"bass": bass_events, "up": up, "group": [0, 6, 12, 18, 24]}


BM = ["Bb4", "D5", "G5", "D5", "Bb4"]

MEASURES = [
    beats(("G4:3", BM), "G4", ["Bb4", "D5"], "D4:0", ["Bb4", "D5"]),
    # 2: fa# con sostenido (dura todo el compas)
    beats(("F#4:2", ["C5:3", "D5:1", "A5:4", "D5", "C5"]), "F#4", ["C5", "D5"], "D4:0", ["C5", "D5"]),
    halves(("G4:3", BM), ("C4:1", ["C5:3", "Eb5:2", "A5:4", "Eb5", "C5"])),
    # 4: do# de bajo y mi natural; fa# con sostenido en la segunda mitad
    halves(("C#4:2", ["Bb4", "E5:4", "G5", "E5", "Bb4"]), ("D4:0", ["A4", "D5:2", "F#5", "D5", "A4"])),
    # 5: la bemol y si natural
    halves(("D4", ["Ab4:1", "B4", "F5:2", "B4", "Ab4"]), ("C4:1", ["G4:3", "C5:4", "Eb5:2", "C5", "G4"])),
    halves(("A3:0", ["C5:4", "D5:2", "F#5:1", "D5", "C5"]), ("Bb3:1", ["Bb4:2", "D5:3", "G5:4", "D5", "Bb4"])),
    # 7: cuatro pulsos: bajo de negra con puntillo, una corchea y un acorde de dos o tres notas
    chords(
        beat(0, "C4:1", "C5:3", "Eb5:2+A5:4"),
        beat(6, "D4:0", "Bb4", "D5+G5"),
        beat(12, "D4:0", "A4:2", "C5:1+F#5:3"),
        beat(18, "D4", "A4", "C5+F#5"),
    ),
    # 8: cierre, sol4 de blanca con puntillo, sol3 de negra y silencios de corchea, negra y corchea
    {"bass": bass((0, 12, "G4:3"), (12, 4, "G3:2"), (16, 2, "R"), (18, 4, "R"), (22, 2, "R")),
     "up": [cell(t, 2 * (i + 1)) for i, t in enumerate(BM)] + [(16, 2, "R", None), (18, 4, "R", None), (22, 2, "R", None)],
     "group": HALF},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 14 in G Minor", KEY_FIFTHS, MEASURES, time=(12, 8), group=12)
