"""Transcripción manual a MusicXML de un preludio de arpegios (4/4, flujo de semicorcheas).

Cuando el OCR no es publicable (confunde dedos con notas y duplica voces), el preludio se
transcribe desde la imagen con esta librería. Cada compás se describe en semicorcheas
(`pos` 0..15 dentro del compás, `dur` en semicorcheas):

    bass: [(pos, dur, pitch, finger)]   voz 2, plica abajo
    up:   [(pos, dur, pitch, finger)]   voz 1, plica arriba; pitch "R" = silencio visible

Los huecos se rellenan con silencios ocultos, así las notas caen en su sitio sin dibujar
silencios que el libro no tiene. La nota grave que el libro une a la barra de las
semicorcheas va solo en `bass` (la tablatura no la duplica). Alteraciones: la primera
aparición en el compás de cada altura que difiere de la armadura o de lo ya alterado.
Los dedos van como `fingering`; las letras p-i-m-a no se transcriben (el motor no las dibuja).
"""
import os
from xml.sax.saxutils import escape

DIVISIONS = 4  # por negra: 1 = semicorchea
TYPES = {1: "16th", 2: "eighth", 3: "eighth", 4: "quarter", 6: "quarter", 8: "half", 12: "half", 16: "whole"}
DOTTED = {3, 6, 12}
SHARP_ORDER = "FCGDAEB"
FLAT_ORDER = "BEADGCF"


def key_alters(fifths):
    alters = {}
    for step in (SHARP_ORDER[:fifths] if fifths > 0 else FLAT_ORDER[:-fifths]):
        alters[step] = 1 if fifths > 0 else -1
    return alters


def parse(pitch):
    step, rest = pitch[0], pitch[1:]
    alter = 1 if rest.startswith("#") else -1 if rest.startswith("b") else 0
    return step, alter, int(rest.lstrip("#b"))


class Accidentals:
    """Estado de alteraciones dentro de un compás."""

    def __init__(self, fifths):
        self.key, self.state = key_alters(fifths), {}

    def xml(self, step, alter, octave):
        current = self.state.get((step, octave), self.key.get(step, 0))
        self.state[(step, octave)] = alter
        if alter == current:
            return ""
        return {1: "sharp", -1: "flat", 0: "natural"}[alter]


def pitch_xml(step, alter, octave):
    a = f"<alter>{alter}</alter>" if alter else ""
    return f"<pitch><step>{step}</step>{a}<octave>{octave}</octave></pitch>"


def note_xml(event, voice, stem, acc, beams=None):
    pos, dur, pitch, finger = event
    if "+" in pitch:  # acorde: "C#5:1+A5:4" (cada nota con su dedo); las siguientes llevan <chord/>
        parts = pitch.split("+")
        return "".join(
            note_xml((pos, dur, p.partition(":")[0], p.partition(":")[2] or None), voice, stem, acc, beams).replace(
                "<note>", "<note><chord/>" if i else "<note>", 1)
            for i, p in enumerate(parts))
    kind = f"<type>{TYPES[dur]}</type>" + ("<dot/>" if dur in DOTTED else "")
    if pitch == "R":
        return f"<note><rest/><duration>{dur}</duration><voice>{voice}</voice>{kind}</note>"
    harmonic = pitch.endswith("*")  # armonico natural: cabeza de rombo
    step, alter, octave = parse(pitch.rstrip("*"))
    accidental = acc.xml(step, alter, octave)
    accidental = f"<accidental>{accidental}</accidental>" if accidental else ""
    beam = "".join(f'<beam number="{n}">{state}</beam>' for n, state in (beams or {}).items())
    technical = (f"<fingering>{finger}</fingering>" if finger else "") + ("<harmonic/>" if harmonic else "")
    notations = f"<notations><technical>{technical}</technical></notations>" if technical else ""
    head = "<notehead>diamond</notehead>" if harmonic else ""
    return (f"<note>{pitch_xml(step, alter, octave)}<duration>{dur}</duration><voice>{voice}</voice>{kind}"
            f"{accidental}<stem>{stem}</stem>{head}{beam}{notations}</note>")


def hidden_rest(dur, voice):
    return f'<note print-object="no"><rest/><duration>{dur}</duration><voice>{voice}</voice><type>{TYPES.get(dur, "16th")}</type></note>'


def fill(events, voice, length=16):
    """Events sorted by position with hidden rests in the gaps."""
    out, cursor = [], 0
    for event in sorted(events):
        pos = event[0]
        if pos < cursor:
            raise ValueError(f"eventos solapados en la posicion {pos}")
        for gap in _split(pos - cursor):
            out.append(("gap", gap))
        out.append(("note", event))
        cursor = pos + event[1]
    for gap in _split(length - cursor):
        out.append(("gap", gap))
    return out


def _split(n):
    parts = []
    for size in (8, 4, 2, 1):
        while n >= size:
            parts.append(size)
            n -= size
    return parts


def beam_states(events, length=16, group_size=4):
    """Barras de semicorchea por grupo (un pulso: 4 posiciones en 4/4, 6 en 6/8): begin/continue/end."""
    beamed = {}
    for beat in range(length // group_size):
        group = sorted(e for e in events if e[1] == 1 and e[2] != "R"
                       and beat * group_size <= e[0] < (beat + 1) * group_size)
        for i, e in enumerate(group):
            if len(group) > 1:
                state = "begin" if i == 0 else "end" if i == len(group) - 1 else "continue"
                beamed[e[0]] = {1: state, 2: state}
    return beamed


def measure_xml(number, fifths, bass, up, first=False, time=(4, 4)):
    acc = Accidentals(fifths)
    beats, beat_type = time
    length = beats * 16 // beat_type
    attrs = ""
    if first:
        symbol = ' symbol="common"' if time == (4, 4) else ""
        attrs = (f"<attributes><divisions>{DIVISIONS}</divisions><key><fifths>{fifths}</fifths></key>"
                 f"<time{symbol}><beats>{beats}</beats><beat-type>{beat_type}</beat-type></time>"
                 "<clef><sign>G</sign><line>2</line></clef></attributes>")
    beams = beam_states(up, length, 4 if beat_type == 4 else 6)
    v1 = ""
    # alteraciones en orden de lectura: se recorre cada voz en su orden y se mezcla por posicion
    order = sorted([(e[0], 0, e) for e in up] + [(e[0], 1, e) for e in bass])
    rendered = {}
    for pos, voice_index, event in order:
        voice, stem = (1, "up") if voice_index == 0 else (2, "down")
        rendered[(voice, event[0])] = note_xml(event, voice, stem, acc, beams.get(event[0]) if voice == 1 else None)
    for kind, item in fill(up, 1, length):
        v1 += hidden_rest(item, 1) if kind == "gap" else rendered[(1, item[0])]
    v2 = ""
    for kind, item in fill(bass, 2, length):
        v2 += hidden_rest(item, 2) if kind == "gap" else rendered[(2, item[0])]
    return (f'<measure number="{number}">{attrs}{v1}<backup><duration>{length}</duration></backup>{v2}</measure>')


def write(path, title, fifths, measures, time=(4, 4)):
    """`measures`: [{"bass": [...], "up": [...]}]; escribe el MusicXML corregido en `path`."""
    body = "".join(measure_xml(i + 1, fifths, m["bass"], m["up"], first=i == 0, time=time) for i, m in enumerate(measures))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>'
           f'<score-partwise version="3.1"><work><work-title>{escape(title)}</work-title></work>'
           '<identification><creator type="composer">Matteo Carcassi</creator></identification>'
           '<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>'
           f'<part id="P1">{body}</part></score-partwise>\n')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
    print("escrito", path)


def slots(cells):
    """16 celdas -> eventos de semicorchea. Celda: None (la ocupa el bajo), "A4" o "A4:2" (con dedo)."""
    events = []
    for pos, cell in enumerate(cells):
        if cell:
            pitch, _, finger = cell.partition(":")
            events.append((pos, 1, pitch, finger or None))
    return events


def bass(*items):
    """Bajos: (pos, dur, "A3") o (pos, dur, "A3:4") con dedo."""
    events = []
    for pos, dur, cell in items:
        pitch, _, finger = cell.partition(":")
        events.append((pos, dur, pitch, finger or None))
    return events
