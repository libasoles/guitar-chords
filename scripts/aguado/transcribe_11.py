"""Leccion 11 de Aguado (3/8), transcrita a mano del facsimil de 1843 (pagina 32 del PDF, IMSLP265882).

    python scripts/aguado/transcribe_11.py

Continua la leccion 10: dos voces, un bajo que dura todo el compas (negra con puntillo) y arpegios arriba. Primera parte
(compases 1-8) con repeticion. Segun el §93, cuando una nota lleva dos colas con valores distintos se toca con el mayor:
el do grave del compas 5, que el libro une a la barra de las corcheas, es una negra con puntillo; aqui va solo en la
voz grave y el arpegio agudo empieza en la fusa siguiente. «Corchea con puntillo y semicorchea» no aparece: los grupos de
cuatro notas son semicorchea con puntillo, fusa y dos corcheas (o corchea, semicorchea con puntillo, fusa y corchea).
"""
from transcribe_lib import measure, write

NUMBER = 11
TITLE = "Lesson 11"
KEY_FIFTHS = 0

E, Q, DQ = 4, 8, 12  # corchea, negra, negra con puntillo (en treintaidosavos)


def arpeggio_down(low, middle, high, marks=(None, None, None)):
    """Tres corcheas en la voz grave (plicas abajo), como el arpegio del compas 1."""
    return {"down": [(0, E, low, marks[0]), (4, E, middle, marks[1]), (8, E, high, marks[2])]}


def quarter_then_pair(top, a, b, marks=("m", "i", "p")):
    """Negra aguda y dos semicorcheas (compases 2 y 4)."""
    return {"up": [(0, Q, top, marks[0]), (8, 2, a, marks[1]), (10, 2, b, marks[2])]}


def trio(a, b, c, marks=(None, None, None), bass=None):
    """Tres corcheas en la voz aguda, con un bajo opcional (lista de eventos de la voz grave)."""
    m = {"up": [(0, E, a, marks[0]), (4, E, b, marks[1]), (8, E, c, marks[2])]}
    if bass:
        m["down"] = bass
    return m


def dotted_first(note, last=None, marks=("i", "i", None, "m"), bass=None):
    """Semicorchea con puntillo, fusa y dos corcheas: el mismo sol (o el sol y una nota final)."""
    m = {"up": [(0, 3, note, marks[0]), (3, 1, note, marks[1]), (4, E, note, marks[2]), (8, E, last or note, marks[3])]}
    if bass:
        m["down"] = bass
    return m


def dotted_second(note, marks=(None, None, None, None)):
    """Corchea, semicorchea con puntillo, fusa y corchea (compas 13)."""
    return {"up": [(0, E, note, marks[0]), (4, 3, note, marks[1]), (7, 1, note, marks[2]), (8, E, note, marks[3])]}


MEASURES = [
    measure(**arpeggio_down("C4", "E4", "G4", ("p", "p", "i"))),                                       # 1
    measure(**quarter_then_pair("C5", "G4", "E4")),                                                    # 2
    measure(**arpeggio_down("C4", "E4", "G4", ("p", "p", "i"))),                                       # 3
    measure(**quarter_then_pair("C5", "G4", "E4")),                                                    # 4
    # 5: do grave de negra con puntillo; el arpegio agudo mi-sol-do empieza en el segundo movimiento
    measure(up=[(4, 2, "E4", "p"), (6, 2, "G4", "i"), (8, E, "C5", "m")], down=[(0, DQ, "C4", None)]),
    measure(up=[(0, E, "B4", "m"), (4, E, "G4", None), (8, E, "D5", "4|i")],                            # 6
            down=[(0, Q, "D4", None), (8, 2, "F4", "3")]),
    measure(up=[(0, E, "C5", "m"), (4, E, "G4", None), (8, E, "E5", "i")],                              # 7
            down=[(0, Q, "E4", "1"), (8, 2, "C4", "3")]),
    # 8: re agudo de negra, sol de corchea y si grave con puntillo; cierra la primera parte con repeticion
    measure(up=[(0, Q, "D5", "4"), (8, E, "G4", None)], down=[(0, DQ, "B3", "2")], repeat="backward"),
    measure(**dotted_first("G4")),                                                                     # 9
    measure(**trio("G4", "F4", "D5", ("3|i", "4", "m"))),                                              # 10
    measure(**dotted_first("G4")),                                                                     # 11
    measure(**trio("G4", "E4", "C5", ("p", None, "m"))),                                               # 12
    measure(**dotted_second("G4")),                                                                    # 13
    measure(**trio("G4", "F5", "D5", (None, "4", None), bass=[(0, DQ, "B3", None)])),                  # 14
    measure(**trio("G4", "E5", "C5", bass=[(0, DQ, "C4", None)])),                                     # 15
    # 16: corchea con puntillo y semicorchea (dos movimientos) y una corchea
    measure(up=[(0, 6, "D5", "4|i"), (6, 2, "B4", None), (8, E, "G4", "i")], down=[(0, DQ, "B3", "2")]),
    measure(**dotted_first("G4")),                                                                     # 17
    measure(**trio("G4", "F4", "D5")),                                                                 # 18
    measure(**dotted_first("G4")),                                                                     # 19
    measure(**trio("G4", "E4", "C5")),                                                                 # 20
    measure(**dotted_first("G4", "C5", marks=(None, None, None, None), bass=[(0, DQ, "E4", None)])),   # 21
    # 22: sol grave y fa con si agudo (septima de dominante) y re agudo de corchea
    measure(up=[(0, Q, "B4", "2|i"), (8, E, "D5", "4")], down=[(0, DQ, "F4+G3:1", None)]),
    measure(up=[(0, E, "B4", "i"), (4, E, "A4", None), (8, E, "B4", None)], down=[(0, DQ, "F4+G3:2", None)]),  # 23
    measure(up=[(0, Q, "C5+E4", None), (8, E, "R", None)], down=[(0, Q, "C4", None), (8, E, "R", None)]),      # 24
]

if __name__ == "__main__":
    write(NUMBER + 14, TITLE, KEY_FIFTHS, (3, 8), MEASURES)
