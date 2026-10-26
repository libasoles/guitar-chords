"""Leccion 7 de Aguado: Vals en Sol (3/4), transcrito a mano del facsimil de 1843 (paginas 28 del PDF, IMSLP265882).

    python scripts/aguado/transcribe_07.py

El libro escribe todo en una sola voz con plicas arriba: dos corcheas, un bajo de negra y un acorde de negra (o una
nota suelta) en cada compas. La armadura trae fa sostenido; el compas 12 baja por semitonos con un sostenido y un
becuadro. Los dedos de la izquierda (1-4) y las letras de la derecha (p i) son los que el libro imprime.
"""
from transcribe_lib import measure, write

NUMBER = 7
TITLE = "Lesson 7: Waltz in G"
KEY_FIFTHS = 1


def bar(first, second, bass, last, bass_mark=None):
    """Dos corcheas, un bajo de negra y la nota o el acorde del tercer pulso."""
    (a, a_mark), (b, b_mark) = first, second
    return [(0, 4, a, a_mark), (4, 4, b, b_mark), (8, 8, bass, bass_mark), (16, 8, last[0], last[1])]


MEASURES = [
    measure(up=bar(("G4", "p"), ("B4", "i"), "D4", ("A4+C5", None), "p"), words="Wals."),
    measure(up=bar(("B4", "4"), ("D5", "3|i"), "D4", ("G4+B4", None))),
    measure(up=bar(("A4", "2"), ("C5", "1"), "D4", ("F#4", "4|p"))),
    measure(up=bar(("G4", None), ("B4", None), "D4", ("R", None))),
    measure(up=bar(("G4", None), ("B4", None), "D4", ("A4+C5", None))),
    measure(up=bar(("B4", None), ("D5", None), "D4", ("G4+B4", None))),
    measure(up=bar(("A4", None), ("C5", None), "D4", ("F#4", None))),
    # 8: acorde de negra y dos silencios de negra; cierra la primera parte con repeticion
    measure(up=[(0, 8, "G4+B4", None), (8, 8, "R", None), (16, 8, "R", None)], repeat="backward"),
    # 9-16: segunda parte, con repeticion
    measure(up=bar(("C5", None), ("E5", None), "G4", ("C5+E5", None)), repeat="forward"),
    measure(up=bar(("B4", "4"), ("D5", "3"), "G4", ("B4+D5", None))),
    measure(up=bar(("C5", None), ("E5", None), "G4", ("C5+E5", None))),
    # 12: tres acordes de negra que bajan por semitonos: si-re, la sostenido-do sostenido, la-do con becuadros
    measure(up=[(0, 8, "B4+D5", "4"), (8, 8, "A#4+C#5", "2"), (16, 8, "A4+C5", "1")]),
    measure(up=bar(("G4", None), ("B4", None), "D4", ("A4+C5", None))),
    measure(up=bar(("B4", None), ("D5", None), "D4", ("G4+B4", None))),
    measure(up=bar(("A4", None), ("C5", None), "D4", ("F#4", None))),
    measure(up=[(0, 8, "G4+B4", None), (8, 8, "R", None), (16, 8, "R", None)], repeat="backward"),
]

if __name__ == "__main__":
    write(NUMBER + 14, TITLE, KEY_FIFTHS, (3, 4), MEASURES)
