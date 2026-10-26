"""Leccion 12 de Aguado (3/8), transcrita a mano del facsimil de 1843 (pagina 32 del PDF, IMSLP265882).

    python scripts/aguado/transcribe_12.py

Sigue la leccion 11, con dos partes de ocho compases y repeticion en cada una. El §94 confirma las duraciones del bajo:
«do mi del compas 1.º duran dos movimientos» (el mi grave dura los dos primeros), «el tercer movimiento del compas 2.º
es un silencio en las notas graves», «mi grave del compas 13 dura todo el, asi como fa del compas 14».

En el compas 1 una mancha de tinta tapa el acorde grave del tercer movimiento; se lee como en la leccion 10 (fa y sol
grave con el 2.º dedo, semicorchea), que es el mismo gesto con la misma digitacion.
"""
from transcribe_lib import measure, write

NUMBER = 12
TITLE = "Lesson 12"
KEY_FIFTHS = 0

E, Q, DQ = 4, 8, 12  # corchea, negra, negra con puntillo (en treintaidosavos)


def group(a, b, c, d, marks=(None, None, None, None), bounds=None):
    """Semicorchea con puntillo, fusa y dos corcheas en la voz aguda (`bounds` parte las barras como el libro)."""
    m = {"up": [(0, 3, a, marks[0]), (3, 1, b, marks[1]), (4, E, c, marks[2]), (8, E, d, marks[3])]}
    if bounds:
        m["bounds"] = bounds
    return m


def trio(a, b, c, marks=(None, None, None)):
    return {"up": [(0, E, a, marks[0]), (4, E, b, marks[1]), (8, E, c, marks[2])]}


def with_bass(upper, bass):
    return {**upper, "down": bass}


# Cierre de las dos partes (compases 8 y 16): do agudo y mi con un acorde de negra y silencio de corchea
CLOSE = {"up": [(0, Q, "C5+E4", None), (8, E, "R", None)], "down": [(0, Q, "C4", None), (8, E, "R", None)]}

MEASURES = [
    # 1: do agudo con puntillo y sol, sol y re agudo; mi grave de negra y, en el tercer movimiento, fa y sol grave
    measure(**with_bass(group("C5", "G4", "G4", "D5", (None, "i", "m", "4")), [(0, Q, "E4", "p"), (8, 2, "F4+G3:2", None)])),
    measure(**with_bass(group("C5", "G4", "G4", "E5", (None, "i", "m", None)), [(0, Q, "E4", "p"), (8, E, "R", None)])),  # 2
    measure(**with_bass(group("D5", "G4", "G4", "F5", bounds=[0, 4, 8, 12]), [(0, Q, "B3", "2"), (8, E, "R", None)])),  # 3
    measure(up=[(0, Q, "E5", None), (8, E, "C5", None)], down=[(0, DQ, "C4", "p")]),                  # 4
    measure(**with_bass(group("C5", "G4", "G4", "C5", (None, None, "i", "m"), bounds=[0, 8, 12]), [(0, DQ, "C4", "p")])),  # 5
    measure(up=[(0, Q, "A4", None), (8, E, "D5", "4")], down=[(0, Q, "F4", None), (8, 2, "G3", None)]),  # 6
    measure(up=[(0, E, "B4", "1"), (4, E, "A4", None), (8, E, "B4", None)], down=[(0, DQ, "F4+G3:4", None)]),  # 7
    measure(**CLOSE, repeat="backward"),                                                               # 8
    measure(**with_bass(group("D5", "G4", "G4", "E5", (None, None, "i", "m")), [(0, Q, "B3", "2"), (8, 2, "C4", None)]), repeat="forward"),  # 9
    measure(**with_bass(trio("D5", "G4", "G4"), [(0, DQ, "B3", None)])),                               # 10
    measure(**with_bass(group("E5", "G4", "G4", "F5", (None, None, "i", "m")), [(0, Q, "C4", "p"), (8, 2, "B3", "2")])),  # 11
    measure(up=[(0, Q, "E5", None), (8, E, "C5", None)], down=[(0, DQ, "C4", "p")]),                  # 12
    # 13: sol agudo con puntillo, do, si y si bemol sobre el mi grave que dura todo el compas (acorde de do septima)
    measure(**with_bass(group("G5", "C5", "B4", "Bb4", ("4", None, None, "3")), [(0, DQ, "E4", "2")])),
    measure(**with_bass(trio("A4", "D5", "C5", (None, "4", None)), [(0, DQ, "F4", None)])),            # 14
    measure(up=[(0, Q, "B4", None), (8, E, "D5", "4")], down=[(0, Q, "G4", None), (8, 2, "F4+G3", None)]),  # 15
    measure(**CLOSE, repeat="backward"),                                                               # 16
]

if __name__ == "__main__":
    write(NUMBER + 14, TITLE, KEY_FIFTHS, (3, 8), MEASURES)
