"""MusicXML corregido del Preludio 15 (Mi bemol mayor), transcrito a mano de la imagen.

Las alturas salen de `detect_notes.py` (que separa los acordes apilados) y de `bass_strips.py alto`; dedos y
alteraciones se leyeron a ojo. Ver reports/prelude-15.md.

    python scripts/carcassi-preludios/transcribe_15.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrected", "prelude-15.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = -3  # Si bemol, Mi bemol, La bemol


def split(text):
    pitch, _, finger = text.partition(":")
    return pitch, finger or None


def with_chords(low, three, single, chord, offset=0):
    """Mitad con bajo de blanca, tres semicorcheas, una corchea y un acorde de corchea."""
    up = [(offset + 1 + i, 1, *split(t)) for i, t in enumerate(three)]
    up += [(offset + 4, 2, *split(single)), (offset + 6, 2, chord, None)]
    return [(offset, 8, *split(low))], up


def chords(first, second):
    (b1, u1), (b2, u2) = with_chords(*first), with_chords(*second, offset=8)
    return {"bass": b1 + b2, "up": u1 + u2}


def halves(first, second):
    """Dos mitades [bajo de blanca, siete semicorcheas]."""
    return {"bass": bass((0, 8, first[0]), (8, 8, second[0])), "up": slots([N, *first[1], N, *second[1]])}


def quarters(low, first, bass3, up3, bass4, up4):
    """Mitad de bajo de blanca con siete semicorcheas y mitad con dos bajos de negra y tres semicorcheas cada uno."""
    up = slots([N, *first]) + [(9 + i, 1, *split(t)) for i, t in enumerate(up3)] + [(13 + i, 1, *split(t)) for i, t in enumerate(up4)]
    return {"bass": [(0, 8, *split(low)), (8, 4, *split(bass3)), (12, 4, *split(bass4))], "up": up}


MEASURES = [
    chords(("Eb4:4", ["G4:3", "Bb4:1", "G4"], "Eb5:2", "Eb5+Bb4+G4"), ("G4", ["Bb4", "Eb5", "Bb4"], "Bb5:4", "Bb5+Eb5+Bb4")),
    # 2: la natural en la primera mitad (la armadura tiene la bemol) y la bemol en la segunda
    chords(("F4:1", ["C5:3", "Eb5:2", "C5"], "A5:4", "A5+Eb5+C5"), ("Bb3:1", ["Bb4:2", "D5:3", "Bb4"], "Ab5:4", "Ab5+D5+Bb4")),
    # 3: si natural de bajo
    chords(("B3:1", ["G4", "D5:3", "D4"], "G5:4", "G5+D5+G4"), ("C4:1", ["G4:3", "C5:4", "G4"], "Eb5:2", "Eb5+C5+G4")),
    chords(("Ab3:1", ["Ab4:3", "C5:2", "Ab4"], "F5:4", "F5+C5+Ab4"), ("Bb3", ["F4:3", "Ab4", "F4"], "D5:4", "D5+Ab4+F4")),
    quarters("Eb4:4", ["G4:3", "Bb4", "G4", "Eb5:2", "G4", "Bb4", "G4"], "Eb4", ["G4", "Bb4", "Eb5"], "Eb4", ["Bb4", "Eb5", "G5"]),
    halves(("F4:1", ["Bb4:2", "D5:3", "Bb4", "Ab5:4", "Bb4", "D5", "Bb4"]), ("Bb3:1", ["Bb4", "D5", "Bb4", "Ab5", "Bb4", "D5", "Bb4"])),
    quarters("Eb4:4", ["Bb4", "Eb5:2", "Bb4", "G5", "Bb4", "Eb5", "Bb4"], "Eb4", ["G4:3", "Bb4", "Eb5"], "Eb4", ["Bb4", "Eb5", "G5"]),
    # 8: cierre, acorde de blanca (mi bemol grave en el bajo) y silencio de blanca en las dos voces
    {"bass": bass((0, 8, "Eb4"), (8, 8, "R")), "up": [(0, 8, "Eb5+Bb4+G4", None), (8, 8, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 15 in Eb Major", KEY_FIFTHS, MEASURES)
