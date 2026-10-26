"""Leccion 8 de Aguado: ejercicios A y B (4/4), transcritos a mano del facsimil de 1843 (paginas 28-29 del PDF, IMSLP265882).

    python scripts/aguado/transcribe_08.py

Practica del pulgar y el indice alternando (§82-85): cada pulso son dos corcheas, la grave con el pulgar y la aguda, a una
octava, con el indice. Cada ejercicio tiene siete compases; el ultimo lleva tres pulsos de silencio o uno de silencio.
Los dos ejercicios van en una sola partitura, con una doble barra entre ellos.
"""
from transcribe_lib import measure, write

NUMBER = 8
TITLE = "Lesson 8: Exercises"
KEY_FIFTHS = 0

E, Q = 4, 8  # corchea y negra (en treintaidosavos)


def bar(*pairs, rests=0):
    """Compas de 4/4 con un pulso por cada pareja de octavas y `rests` pulsos de silencio al final."""
    events = []
    for beat, (low, high, *marks) in enumerate(pairs):
        low_mark, high_mark = (marks + [None, None])[:2]
        events += [(beat * Q, E, low, low_mark), (beat * Q + E, E, high, high_mark)]
    events += [((len(pairs) + i) * Q, Q, "R", None) for i in range(rests)]
    return events


# Ejercicio A (compases 1-7) y B (8-14): los compases que se repiten se construyen de nuevo para no compartir el texto «A»/«B»
def a_first(words=None):
    return measure(up=bar(("C4", "C5", "3"), ("B3", "B4", "2"), ("C4", "C5"), ("B3", "B4")), words=words)


def a_second():
    return measure(up=bar(("C4", "C5"), ("E4", "E5", "2"), ("G4", "G5", None, "4"), ("E4", "E5", "2")))


def a_third():
    return measure(up=bar(("C4", "C5", "3"), ("G3", "G4", "3"), ("C4", "C5"), ("E4", "E5")))


def b_first(words=None):
    return measure(up=bar(("C4", "C5"), ("E4", "E5"), ("G4", "G5", None, "4"), ("E4", "E5")), words=words)


def b_second():
    return measure(up=bar(("F4", "F5", "3"), ("D4", "D5"), ("B3", "B4", "2"), ("G3", "G4", "3")))


def b_third():
    return measure(up=bar(("C4", "C5"), ("E4", "E5"), ("G4", "G5", None, "4"), ("G3", "G4", "2")))


MEASURES = [
    a_first("A"), a_second(), a_first(), a_second(), a_third(), a_third(),
    measure(up=bar(("C4", "C5"), ("C4", "C5"), ("C4", "C5"), rests=1), bar="double"),          # 7
    b_first("B"), b_second(), b_first(), b_second(), b_third(), b_third(),
    measure(up=bar(("C4", "C5"), rests=3)),                                                     # 14
]

if __name__ == "__main__":
    write(NUMBER + 14, TITLE, KEY_FIFTHS, (4, 4), MEASURES)
