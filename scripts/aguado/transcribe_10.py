"""Leccion 10 de Aguado: Vals en Do (3/8), transcrito a mano del facsimil de 1843 (paginas 30-31 del PDF, IMSLP265882).

    python scripts/aguado/transcribe_10.py

Dos voces: la aguda con plicas arriba y la grave con plicas abajo. El compas son tres «movimientos» (corcheas) y el libro
pone el puntillo al final del compas para decir que el bajo suena todo el compas (§91), asi que cada bajo con ese
puntillo es una negra con puntillo. Valores:

- La figura corta tras un puntillo («corchea con puntillo y semicorchea» en los compases 5, 9, 11, 17, 19, 29) no se
  toca aparte (§91): se anota como en la fuente de TabGuitar de la leccion 14, semicorchea con puntillo y fusa, que
  llena el segundo movimiento; el primero y el tercero son corcheas.
- La nota aguda que el libro imprime con dos corchetes tras un silencio de negra (compases 1, 2, 25, 26) vale la
  corchea del puntillo del bajo (§91); se deja como esta impresa (semicorchea) y el resto del movimiento es un silencio oculto.
- Las notas del bajo que la plica une a la barra de las corcheas agudas (compases 22, 23, 24, 27) van en la voz aguda.
"""
from transcribe_lib import measure, write

NUMBER = 10
TITLE = "Lesson 10: Waltz in C"
KEY_FIFTHS = 0

E, Q, DQ = 4, 8, 12  # corchea, negra, negra con puntillo (en treintaidosavos)


def figure(first, middle, last, marks=("m", "i", "i", "m")):
    """Corchea, semicorchea con puntillo, fusa y corchea (el «grupo del puntillo»): `middle` es la nota repetida."""
    return [(0, E, first, marks[0]), (4, 3, middle, marks[1]), (7, 1, middle, marks[2]), (8, E, last, marks[3])]


def trio(a, b, c, marks=(None, None, None)):
    """Tres corcheas, una por movimiento, unidas por una barra."""
    return [(0, E, a, marks[0]), (4, E, b, marks[1]), (8, E, c, marks[2])]


def sustained(high, low, finger=None, low_finger=None):
    """Acorde o nota aguda de negra mas el bajo de negra, con un silencio de corchea en cada voz (compases 4, 8, 10...)."""
    return {"up": [(0, Q, high, finger), (8, E, "R", None)], "down": [(0, Q, low, low_finger), (8, E, "R", None)]}


def held(bass, high, bass_finger=None):
    """Silencio de negra en la voz aguda, una nota en el tercer movimiento y bajo de negra con puntillo."""
    return {"up": [(0, Q, "R", None), (8, 2, high, None)], "down": [(0, DQ, bass, bass_finger)]}


MEASURES = [
    measure(**held("C4", "C5", "3"), words="Wals."),                                  # 1
    measure(**held("E4", "E5", "2")),                                                # 2
    measure(up=[(0, E, "R", None), (4, E, "C5", None), (8, E, "E5", "i")],                             # 3
            down=[(0, E, "C4", "p"), (8, 2, "E4", "p")]),
    measure(**sustained("G5", "G4", "4|i")),                                                           # 4
    measure(up=figure("B4", "G4", "G4"), down=[(0, DQ, "F4", "p")]),                                   # 5
    measure(up=trio("C5", "G4", "G5", ("i", "i", "4")), down=[(0, DQ, "E4", None)]),                    # 6
    # 7: el tercer movimiento del bajo es un acorde de semicorchea (fa y sol grave)
    measure(up=trio("G5", "B4", "D5", ("i", None, None)), down=[(0, Q, "D4", None), (8, 2, "F4+G3:2", None)]),
    measure(up=[(0, Q, "C5+E4", None), (8, E, "R", None)], down=[(0, Q, "C4", None), (8, E, "R", None)], bar="double"),  # 8
    measure(up=figure("D5", "G4", "G4"), down=[(0, DQ, "B3", "2")]),                                   # 9
    measure(**sustained("D5+G4", "B3", "4")),                                                          # 10
    measure(up=figure("E5", "G4", "G4"), down=[(0, DQ, "C4", None)]),                                  # 11
    measure(**sustained("E5+G4", "C4")),                                                               # 12
    # 13: do sostenido con el 4.º dedo (cuerda quinta, 4.º traste) en el tercer movimiento del bajo
    measure(up=trio("F5", "G4", "E5", ("m", "i", None)), down=[(0, Q, "D4", None), (8, 2, "C#4", "4")]),
    measure(up=trio("F5", "G4", "E5", ("m", "i", None)), down=[(0, Q, "D4", None), (8, 2, "C4", "3")]),   # 14
    # 15: la sostenido (cuerda quinta, traste 1) y do sostenido (cuerda segunda, traste 2)
    measure(up=trio("D5", "G4", "C#5", ("4|m", None, "3")), down=[(0, Q, "B3", "2"), (8, 2, "A#3", "1")]),
    measure(**sustained("D5+G4", "B3", "4", "2")),                                                     # 16
    measure(up=figure("D5", "G4", "G4"), down=[(0, DQ, "B3", "2")]),                                   # 17
    measure(**sustained("D5+G4", "B3", "4")),                                                          # 18
    measure(up=figure("E5", "G4", "G4"), down=[(0, DQ, "C4", None)]),                                  # 19
    measure(**sustained("E5+G4", "C4")),                                                               # 20
    measure(up=[(0, E, "R", None), (4, E, "C5", None), (8, E, "A4", None)], down=[(0, DQ, "B3", None)]),  # 21
    measure(up=trio("B3", "F#5", "C5", (None, "m", "i"))),                                             # 22
    measure(up=trio("G4", "B4", "G5", ("p", "i", "4|m"))),                                             # 23
    measure(up=trio("G3", "A3", "B3", ("p", "1|p", "p"))),                                             # 24
    measure(**held("C4", "C5", "3")),                                                # 25
    measure(**held("E4", "E5", "2")),                                                # 26
    measure(up=trio("C4", "C5", "E5"), down=[(8, 2, "E4", None)]),                                     # 27
    measure(**sustained("G5", "G4", "4")),                                                             # 28
    measure(up=figure("B4", "G4", "G4"), down=[(0, DQ, "F4", "3")]),                                   # 29
    measure(up=trio("C5", "G4", "G5", ("i", "i", "4")), down=[(0, DQ, "E4", None)]),                    # 30
    measure(up=trio("G5", "B4", "D5", ("i", None, None)), down=[(0, Q, "D4", None), (8, 2, "F4+G3:2", None)]),  # 31
    measure(up=[(0, Q, "C5+E4", None), (8, E, "R", None)], down=[(0, Q, "C4", None), (8, E, "R", None)]),  # 32
]

if __name__ == "__main__":
    write(NUMBER + 14, TITLE, KEY_FIFTHS, (3, 8), MEASURES)
