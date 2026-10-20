"""Edición Santisteban: MusicXML del Preludio 1 (Do mayor), transcrito a mano de la imagen.

homr leyó los 8 compases pero confundió los números de dedo con notas (C-14, D-15...)
y duplicó voces; ver informe de calidad. Este script es la corrección: cada compás es
un bajo de blanca (voz 2, plica abajo) y dos grupos de tres corcheas (voz 1, plica arriba)
que empiezan en la segunda corchea. Dedos de la mano izquierda (`fingering`) y letras
p-i-m-a (`pluck`) como en la edición.

    python scripts/carcassi-preludios/transcribe_01.py
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TARGET = os.path.join(ROOT, "scripts", "carcassi-preludios", "santisteban", "prelude-01.musicxml")

# note = (pitch, left-hand finger | None, pluck letter | None)
N = lambda p, f=None, l=None: (p, f, l)  # noqa: E731

# per measure: (bass1, upper1 x3, bass2, upper2 x3); None bass at m8 = final chord
MEASURES = [
    (N("C4", "3", "p"), [N("G4", None, "i"), N("C5", "1", "m"), N("E5", None, "a")],
     N("E4", "2"), [N("G4"), N("C5"), N("E5")]),
    (N("A3"), [N("A4", "2"), N("C5"), N("E5")],
     N("C4", "3"), [N("A4"), N("C5"), N("E5")]),
    (N("D4"), [N("A4"), N("D5", "4"), N("F5", "1")],
     N("F4", "3"), [N("A4"), N("D5"), N("F5")]),
    (N("G3", "3"), [N("G4"), N("B4"), N("F5")],
     N("B3", "2"), [N("G4"), N("D5", "4"), N("F5")]),
    (N("C4", "3"), [N("G4"), N("C5", "1"), N("E5")],
     N("A3"), [N("G4"), N("C#5", "3"), N("E5")]),
    (N("D4"), [N("A4", "2"), N("D5", "4"), N("F5", "1")],
     N("F4", "3"), [N("A4"), N("D5"), N("F5")]),
    (N("G3", "3"), [N("G4"), N("C5", "1"), N("E5")],
     N("G3"), [N("G4"), N("B4"), N("F5", "1")]),
]


def pitch_xml(p):
    step, octave = p[0], p[-1]
    alter = "<alter>1</alter>" if "#" in p else ""
    return f"<pitch><step>{step}</step>{alter}<octave>{octave}</octave></pitch>"


def note(n, duration, kind, voice, stem, beam=None, chord=False):
    p, finger, pluck = n
    tech, lyric = "", ""
    if finger:
        tech += f"<fingering>{finger}</fingering>"
    if pluck:
        lyric = f"<lyric><text>{pluck}</text></lyric>"
    notations = f"<notations><technical>{tech}</technical></notations>" if tech else ""
    accidental = "<accidental>sharp</accidental>" if "#" in p else ""
    beam_xml = f'<beam number="1">{beam}</beam>' if beam else ""
    return (f"<note>{'<chord/>' if chord else ''}{pitch_xml(p)}<duration>{duration}</duration>"
            f"<voice>{voice}</voice><type>{kind}</type>{accidental}<stem>{stem}</stem>{beam_xml}{notations}{lyric}</note>")


def measure(number, bass1, up1, bass2, up2):
    first = number == 1
    attrs = ("<attributes><divisions>2</divisions><key><fifths>0</fifths></key>"
             "<time symbol=\"common\"><beats>4</beats><beat-type>4</beat-type></time>"
             "<clef><sign>G</sign><line>2</line></clef></attributes>"
             if first else "")
    # voice 1: upper arpeggio, an invisible eighth rest first so the notes fall after the bass attack
    v1 = ""
    for bass, up in ((bass1, up1), (bass2, up2)):
        v1 += ('<note print-object="no"><rest/><duration>1</duration><voice>1</voice><type>eighth</type></note>')
        for i, n in enumerate(up):
            v1 += note(n, 1, "eighth", 1, "up", beam=("begin" if i == 0 else "end" if i == 2 else "continue"))
    v2 = note(bass1, 4, "half", 2, "down") + note(bass2, 4, "half", 2, "down")
    return (f'<measure number="{number}">{attrs}{v1}<backup><duration>8</duration></backup>{v2}</measure>')


def final_measure(number):
    chord = [N("C4"), N("G4"), N("C5"), N("E5")]
    notes = "".join(note(n, 4, "half", 1, "up", chord=i > 0) for i, n in enumerate(chord))
    return (f'<measure number="{number}">{notes}'
            '<note><rest/><duration>4</duration><voice>1</voice><type>half</type></note></measure>')


def main():
    body = "".join(measure(i + 1, *m) for i, m in enumerate(MEASURES)) + final_measure(len(MEASURES) + 1)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>'
           '<score-partwise version="3.1"><work><work-title>Prelude 1 in C Major</work-title></work>'
           '<identification><creator type="composer">Matteo Carcassi</creator></identification>'
           '<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>'
           f'<part id="P1">{body}</part></score-partwise>\n')
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    with open(TARGET, "w", encoding="utf-8") as f:
        f.write(xml)
    print("escrito", TARGET)


if __name__ == "__main__":
    main()
