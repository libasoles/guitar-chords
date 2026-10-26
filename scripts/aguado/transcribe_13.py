"""Leccion 13 de Aguado (3/8), transcrita a mano del facsimil de 1843 (pagina 33 del PDF, IMSLP265882).

    python scripts/aguado/transcribe_13.py

Continua la 12: dos partes de ocho compases con repeticion (la primera acaba en Sol, la segunda en Do). Cada compas es un
grupo de semicorchea con puntillo, fusa y dos corcheas sobre un bajo que dura todo el compas (§95: «en el compas 21 el
do grave tiene puntillo»). Cuando el libro une el bajo a la barra o le pone dos plicas (compases 2, 4, 18, 20 y 15) se
escribe una sola vez en la voz que corresponde: la nota que dura todo el compas en la voz aguda (compases 2, 4, 18, 20) o
en la grave (compas 15), y el arpegio de semicorcheas del bajo (do mi sol, si re sol) en la voz grave.
"""
from transcribe_lib import measure, write

NUMBER = 13
TITLE = "Lesson 13"
KEY_FIFTHS = 0

E, Q, DQ = 4, 8, 12  # corchea, negra, negra con puntillo (en treintaidosavos)
LETTERS = ("m", "i", "i", "m")


def group(a, b, c, d, marks=LETTERS):
    """Semicorchea con puntillo, fusa y dos corcheas en la voz aguda."""
    return [(0, 3, a, marks[0]), (3, 1, b, marks[1]), (4, E, c, marks[2]), (8, E, d, marks[3])]


def over_bass(a, b, c, d, bass, marks=LETTERS, bass_finger=None):
    """Grupo agudo sobre un bajo de negra con puntillo."""
    return {"up": group(a, b, c, d, marks), "down": [(0, DQ, bass, bass_finger)]}


def held_with_arpeggio(low, middle, high, fingers=(None, None, None), rest=False):
    """Sol agudo-medio que dura todo el compas (voz aguda) y arpegio de tres semicorcheas en la voz grave."""
    first = [(0, E, "R", None)] if rest else []
    return {"up": [(0, DQ, "G4", None)],
            "down": first + [(4, 2, low, fingers[0]), (6, 2, middle, fingers[1]), (8, 2, high, fingers[2])]}


# Cierre de las dos partes: acorde de negra y silencio de corchea en cada voz
def close(high, low, bass):
    return {"up": [(0, Q, high, None), (8, E, "R", None)], "down": [(0, Q, bass, None), (8, E, "R", None)]}


MEASURES = [
    measure(**over_bass("E5", "C5", "G4", "G4", "C4")),                                                 # 1
    measure(**held_with_arpeggio("C4", "E4", "G3", ("4", "2", "3"))),                                   # 2
    measure(**over_bass("E5", "C5", "G4", "G4", "C4")),                                                 # 3
    measure(**held_with_arpeggio("C4", "E4", "G3", (None, None, None), rest=True)),                     # 4
    measure(**over_bass("F5", "D5", "G4", "G4", "C4")),                                                 # 5
    measure(**over_bass("E5", "C5", "G4", "G4", "C4")),                                                 # 6
    # 7: re grave y, en cada uno de los otros dos movimientos, fa sostenido y do agudos juntos (acorde de re septima)
    measure(up=[(0, E, "D4", "3"), (4, E, "F#5+C5", None), (8, E, "F#5+C5", None)]),
    measure(**close("G5+B4", "G4", "G4"), repeat="backward"),                                           # 8
    measure(**over_bass("G5", "C#5", "A4", "A4", "A3", ("4|m", "i", "i", "m")), repeat="forward"),      # 9
    measure(**over_bass("F5", "D5", "A4", "A4", "A3")),                                                 # 10
    measure(**over_bass("E5", "C#5", "A4", "G5", "A3")),                                                # 11
    measure(up=[(0, Q, "F5+D5", "4"), (8, E, "R", None)], down=[(0, Q, "D4", None), (8, E, "R", None)]),  # 12
    measure(**over_bass("F5", "D5", "G4", "G4", "B3", ("m", "i", "4", "m"))),                           # 13
    measure(**over_bass("E5", "C5", "G4", "G4", "C4")),                                                 # 14
    # 15: sol grave que dura todo el compas; el sol agudo de la fusa queda ligado al sol del acorde del tercer movimiento
    measure(up=[(3, 1, "G4~", None), (4, E, "F5", None), (8, E, "~G4+E5", None)],
            down=[(0, DQ, "G3", None)], voices={3: [(8, 2, "C4", None)]}),
    measure(up=[(0, Q, "B3:2+G4+D5", None), (8, E, "R", None)]),                                        # 16
    measure(**over_bass("E5", "C5", "G4", "G4", "C4")),                                                 # 17
    measure(**held_with_arpeggio("C4", "E4", "G3", (None, None, "4"), rest=True)),                      # 18
    measure(**over_bass("F5", "D5", "G4", "G4", "B3", ("m", "i", "4", "m"))),                           # 19
    measure(up=[(0, DQ, "G4", None)], down=[(4, 2, "B3", None), (6, 2, "D4", None), (8, 2, "G3", None)]),  # 20
    # 21: do septima: mi agudo con puntillo, do, sol (con mi grave de corchea) y si bemol sobre el do grave
    measure(up=group("E5", "C5", "G4", "Bb4", ("m", "i", "i", "4|m")), down=[(0, DQ, "C4", None)],
            voices={3: [(4, E, "E4", "2")]}),
    measure(up=[(0, E, "A4", None), (4, E, "D5", "4"), (8, E, "C5", None)], down=[(0, DQ, "F4", None)]),  # 22
    measure(up=[(0, Q, "B4", None), (8, E, "D5+F4:3", "4")], down=[(0, E, "G4", None), (4, E, "G3", "2")]),  # 23
    measure(**close("C5+E4", "C4", "C4"), repeat="backward"),                                           # 24
]

if __name__ == "__main__":
    write(NUMBER + 14, TITLE, KEY_FIFTHS, (3, 8), MEASURES)
