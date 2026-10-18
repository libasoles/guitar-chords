"""MusicXML corregido del Preludio 16 (Do menor, 3/4), transcrito a mano de la imagen.

Las alturas salen de `detect_notes.py` (bajos de negra macizos incluidos); dedos, alteraciones y el acorde
final se leyeron a ojo. Ver reports/prelude-16.md.

    python scripts/carcassi-preludios/transcribe_16.py
"""
import os

from transcribe_lib import bass, slots, write

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrected", "prelude-16.musicxml")
N = None  # celda ocupada por el bajo
KEY_FIFTHS = -3  # Si bemol, Mi bemol, La bemol


def measure(basses, *beats):
    """Tres pulsos: bajo de negra (voz 2) y tres semicorcheas sobre cada uno (voz 1)."""
    cells = []
    for beat in beats:
        cells += [N, *beat]
    return {"bass": bass(*[(4 * i, 4, low) for i, low in enumerate(basses)]), "up": slots(cells)}


MEASURES = [
    measure(["C4:1", "C4", "C4"], ["Eb5:2", "C5:4", "G4:3"], ["G4", "C5", "Eb5"], ["Eb5", "C5", "G4"]),
    measure(["C4:3", "C4", "C4"], ["F5", "D5:4", "Ab4"], ["Ab4", "D5", "F5"], ["F5", "D5", "Ab4"]),
    # 3: si natural (la armadura tiene si bemol) en el bajo y en la nota del tercer pulso
    measure(["B3:2", "B3", "G3"], ["F5:1", "D5:4", "G4"], ["G4", "D5", "F5"], ["F5", "B4", "G4"]),
    measure(["C4:1", "C4", "C4"], ["Eb5:2", "C5:4", "G4:3"], ["G4", "C5", "Eb5"], ["Eb5", "C5", "G4"]),
    measure(["Eb4:4", "Eb4", "Eb4"], ["G5", "Eb5:2", "Bb4"], ["Bb4", "Eb5", "G5"], ["G5", "Eb5", "Bb4"]),
    measure(["F3", "F4:3", "F4"], ["F5", "D5:4", "Ab4"], ["Ab4", "D5", "F5"], ["F5", "D5", "Ab4"]),
    # 7: fa# con sostenido (dura todo el compas) y la natural
    measure(["F#4:1", "F#4", "F#4"], ["A5:4", "Eb5:2", "C5:3"], ["C5", "Eb5", "A5"], ["A5", "Eb5", "C5"]),
    # 8: si natural en el tercer pulso
    measure(["G4:3", "G4", "G3:1"], ["G5:1", "Eb5:2", "C5:4"], ["C5", "Eb5", "G5"], ["G4:3", "B4:2", "F5:4"]),
    measure(["C4:1", "C4", "C4"], ["Eb5:2", "C5:4", "G4:3"], ["C5", "Eb5", "G5"], ["Eb5", "C5", "G4"]),
    # 10: cierre, acorde de blanca (do5 y mi bemol4 arriba, do4 grave en el bajo) y silencio de negra en las dos voces
    {"bass": bass((0, 8, "C4:3"), (8, 4, "R")), "up": [(0, 8, "C5+Eb4", None), (8, 4, "R", None)]},
]

if __name__ == "__main__":
    write(TARGET, "Prelude 16 in C Minor", KEY_FIFTHS, MEASURES, time=(3, 4))
